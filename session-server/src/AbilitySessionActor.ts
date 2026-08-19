import type { Ability } from "../../src/models/abilities/Ability";
import {
  endAbilityEffect,
  restoreAbilityUse,
  useAbilityEffect,
} from "../../src/models/abilities/abilityActivation";
import {
  getCharacterConditions,
  withCharacterConditions,
} from "../../src/models/characters/characterConditionStorage";
import { getCurrentMaxHp } from "../../src/models/characters/characterHp";
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../src/models/characters/CharacterTemplate";
import { SessionActor as BaseSessionActor } from "./SessionActor";
import {
  parseAbilityClientMessage,
  type SessionAbilityOperation,
  type SessionAbilitySeed,
  type SessionAbilitySource,
  type SessionAbilityState,
} from "./abilityProtocol";
import { MAX_HP_LOG_RECORDS } from "./hpState";
import type {
  SessionConditionsState,
  SessionConnection,
  SessionHpState,
} from "./protocol";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";
const HP_LOG_KEY = "hp-log";

type AbilityReverseOperation = {
  type: "character.ability.restore";
  characterId: string;
  snapshot: {
    ability: SessionAbilityState;
    hp: SessionHpState;
    conditions: SessionConditionsState;
  };
};

type AbilityLogRecord = {
  id: string;
  actorId: string;
  createdAt: string;
  operation:
    | SessionAbilityOperation
    | { type: "character.hp.undo"; characterId: string; sourceLogId: string };
  reverseOperation: AbilityReverseOperation;
  undoneAt?: string;
  undoneBy?: string;
};

type AnySessionLogRecord = AbilityLogRecord | {
  id: string;
  actorId: string;
  createdAt: string;
  operation: { type: string; characterId?: string; [key: string]: unknown };
  reverseOperation: { type: string; characterId: string; [key: string]: unknown };
  undoneAt?: string;
  undoneBy?: string;
};

export class SessionActor extends BaseSessionActor {
  override async fetch(request: Request): Promise<Response> {
    const response = await super.fetch(request);
    if (response.status !== 101) return response;

    const clientId = request.headers.get("x-session-client-id")?.trim();
    if (!clientId) return response;

    const socket = this.ctx.getWebSockets().find((candidate) =>
      this.readConnection(candidate)?.clientId === clientId,
    );
    if (socket) await this.sendAbilitiesSnapshot(socket);
    return response;
  }

  override async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const raw = typeof message === "string"
      ? message
      : new TextDecoder().decode(message);

    const undoLogId = parseUndoLogId(raw);
    if (undoLogId) {
      const log = await this.readUnifiedLog();
      const source = log.find((record) => record.id === undoLogId);
      if (source && isAbilityReverseOperation(source.reverseOperation)) {
        const connection = this.readConnection(webSocket);
        if (!connection) {
          webSocket.close(1011, "Missing connection attachment");
          return;
        }
        this.touchConnection(webSocket, connection);
        await this.handleAbilityUndo(webSocket, connection, undoLogId, log);
        return;
      }
    }

    const parsed = parseAbilityClientMessage(raw);
    if (!parsed) {
      await super.webSocketMessage(webSocket, message);
      return;
    }

    const connection = this.readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    this.touchConnection(webSocket, connection);

    if (parsed.type === "session.abilities.initialize") {
      await this.initializeAbilities(webSocket, connection, parsed.characters);
      return;
    }

    await this.handleAbilityOperation(webSocket, connection, parsed.operation);
  }

  private async initializeAbilities(
    webSocket: WebSocket,
    connection: SessionConnection,
    seeds: SessionAbilitySeed[],
  ): Promise<void> {
    if (connection.role !== "MASTER") {
      this.sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can initialize authoritative ability state.");
      return;
    }

    const state = await this.readAbilityState();
    let changed = false;

    for (const seed of seeds) {
      if (state[seed.characterId]?.initialized) continue;

      let character: CharacterTemplate;
      try {
        character = CharacterTemplate.fromJSON(
          seed.character as Partial<CharacterTemplateProps>,
        );
      } catch {
        this.sendError(webSocket, "INVALID_ABILITY_SEED", "The ability state seed contains an invalid character snapshot.");
        return;
      }

      if (character.get("id") !== seed.characterId) {
        this.sendError(webSocket, "ABILITY_SEED_ID_MISMATCH", "The ability state seed does not match the target character.");
        return;
      }

      state[seed.characterId] = {
        characterId: seed.characterId,
        character: character.toJSON() as unknown as Record<string, unknown>,
        initialized: true,
        revision: 0,
      };
      changed = true;
    }

    if (changed) {
      await this.ctx.storage.put(ABILITIES_STATE_KEY, state);
      this.broadcastAbility({
        type: "session.abilities.snapshot",
        characters: Object.values(state),
      });
    } else {
      await this.sendAbilitiesSnapshot(webSocket);
    }
  }

  private async handleAbilityOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionAbilityOperation,
  ): Promise<void> {
    const [abilityState, hpState, conditionsState, log] = await Promise.all([
      this.readAbilityState(),
      this.readHpState(),
      this.readConditionsState(),
      this.readUnifiedLog(),
    ]);

    const storedAbility = abilityState[operation.characterId];
    const hp = hpState[operation.characterId];
    const conditions = conditionsState[operation.characterId];

    if (!storedAbility?.initialized || !hp || !conditions?.initialized) {
      this.sendError(webSocket, "ABILITY_STATE_NOT_INITIALIZED", "Ability state for this character has not been initialized by the MASTER.");
      return;
    }

    if (!canMutateCharacter(connection, hp.ownerUserId)) {
      this.sendError(webSocket, "CHARACTER_ACCESS_DENIED", "You cannot change abilities for this character.");
      return;
    }

    let current: CharacterTemplate;
    try {
      current = hydrateAuthoritativeCharacter(storedAbility, hp, conditions);
    } catch {
      this.sendError(webSocket, "ABILITY_STATE_INVALID", "The authoritative ability snapshot is invalid.");
      return;
    }

    const next = applyAbilityOperation(current, operation);
    if (!next) {
      this.sendError(webSocket, "ABILITY_OPERATION_INVALID", "The requested ability operation is invalid for the current character state.");
      return;
    }

    const currentJson = current.toJSON();
    const nextJson = next.toJSON();
    if (JSON.stringify(currentJson) === JSON.stringify(nextJson)) {
      this.sendError(webSocket, "ABILITY_OPERATION_REJECTED", "The ability could not be changed in its current state.");
      return;
    }

    const nextAbilityState: SessionAbilityState = {
      characterId: operation.characterId,
      character: nextJson as unknown as Record<string, unknown>,
      initialized: true,
      revision: storedAbility.revision + 1,
    };

    const nextHp = extractHpState(next, hp);
    const nextConditions = extractConditionsState(next, conditions);
    const hpChanged = !sameHpRuntime(hp, nextHp);
    const conditionsChanged = JSON.stringify(conditions.conditions) !== JSON.stringify(nextConditions.conditions);

    abilityState[operation.characterId] = nextAbilityState;
    if (hpChanged) hpState[operation.characterId] = nextHp;
    if (conditionsChanged) conditionsState[operation.characterId] = nextConditions;

    const record: AbilityLogRecord = {
      id: crypto.randomUUID(),
      actorId: connection.userId,
      createdAt: new Date().toISOString(),
      operation,
      reverseOperation: {
        type: "character.ability.restore",
        characterId: operation.characterId,
        snapshot: {
          ability: storedAbility,
          hp,
          conditions,
        },
      },
    };
    log.push(record);
    const nextLog = log.slice(-MAX_HP_LOG_RECORDS);

    await this.ctx.storage.put({
      [ABILITIES_STATE_KEY]: abilityState,
      ...(hpChanged ? { [HP_STATE_KEY]: hpState } : {}),
      ...(conditionsChanged ? { [CONDITIONS_STATE_KEY]: conditionsState } : {}),
      [HP_LOG_KEY]: nextLog,
    });

    this.broadcastAbility({ type: "session.abilities.updated", character: nextAbilityState });
    if (hpChanged) this.broadcastRaw({ type: "session.hp.updated", character: nextHp });
    if (conditionsChanged) {
      this.broadcastRaw({ type: "session.conditions.updated", character: nextConditions });
    }
    this.broadcastLogToMasters(nextLog);
  }

  private async handleAbilityUndo(
    webSocket: WebSocket,
    connection: SessionConnection,
    logId: string,
    log: AnySessionLogRecord[],
  ): Promise<void> {
    if (connection.role !== "MASTER") {
      this.sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can undo session changes.");
      return;
    }

    const sourceIndex = log.findIndex((record) => record.id === logId);
    if (sourceIndex < 0) {
      this.sendError(webSocket, "LOG_NOT_FOUND", "The selected log entry no longer exists.");
      return;
    }

    const source = log[sourceIndex];
    if (!isAbilityReverseOperation(source.reverseOperation)) {
      await super.webSocketMessage(
        webSocket,
        JSON.stringify({ type: "session.log.undo", logId }),
      );
      return;
    }
    if (source.operation.type === "character.hp.undo") {
      this.sendError(webSocket, "UNDO_OF_UNDO_NOT_SUPPORTED", "Undo records cannot be undone.");
      return;
    }

    const characterId = source.reverseOperation.characterId;
    const newerActiveChange = log.slice(sourceIndex + 1).some(
      (record) =>
        !record.undoneAt &&
        record.operation.type !== "character.hp.undo" &&
        record.reverseOperation.characterId === characterId,
    );
    if (newerActiveChange) {
      this.sendError(webSocket, "UNDO_NOT_LATEST", "Undo newer changes for this character first.");
      return;
    }

    const [abilityState, hpState, conditionsState] = await Promise.all([
      this.readAbilityState(),
      this.readHpState(),
      this.readConditionsState(),
    ]);
    const currentAbility = abilityState[characterId];
    const currentHp = hpState[characterId];
    const currentConditions = conditionsState[characterId];
    if (!currentAbility || !currentHp || !currentConditions) {
      this.sendError(webSocket, "ABILITY_STATE_NOT_INITIALIZED", "The current ability state required for undo is missing.");
      return;
    }

    const now = new Date().toISOString();
    log[sourceIndex] = {
      ...source,
      undoneAt: now,
      undoneBy: connection.userId,
    };

    const undoRecord: AbilityLogRecord = {
      id: crypto.randomUUID(),
      actorId: connection.userId,
      createdAt: now,
      operation: {
        type: "character.hp.undo",
        characterId,
        sourceLogId: source.id,
      },
      reverseOperation: {
        type: "character.ability.restore",
        characterId,
        snapshot: {
          ability: currentAbility,
          hp: currentHp,
          conditions: currentConditions,
        },
      },
    };
    log.push(undoRecord);
    const nextLog = log.slice(-MAX_HP_LOG_RECORDS);

    abilityState[characterId] = source.reverseOperation.snapshot.ability;
    hpState[characterId] = source.reverseOperation.snapshot.hp;
    conditionsState[characterId] = source.reverseOperation.snapshot.conditions;

    await this.ctx.storage.put({
      [ABILITIES_STATE_KEY]: abilityState,
      [HP_STATE_KEY]: hpState,
      [CONDITIONS_STATE_KEY]: conditionsState,
      [HP_LOG_KEY]: nextLog,
    });

    this.broadcastAbility({
      type: "session.abilities.updated",
      character: source.reverseOperation.snapshot.ability,
    });
    this.broadcastRaw({
      type: "session.hp.updated",
      character: source.reverseOperation.snapshot.hp,
    });
    this.broadcastRaw({
      type: "session.conditions.updated",
      character: source.reverseOperation.snapshot.conditions,
    });
    this.broadcastLogToMasters(nextLog);
  }

  private async readAbilityState(): Promise<Record<string, SessionAbilityState>> {
    return (await this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY)) ?? {};
  }

  private async readHpState(): Promise<Record<string, SessionHpState>> {
    return (await this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY)) ?? {};
  }

  private async readConditionsState(): Promise<Record<string, SessionConditionsState>> {
    return (await this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY)) ?? {};
  }

  private async readUnifiedLog(): Promise<AnySessionLogRecord[]> {
    return (await this.ctx.storage.get<AnySessionLogRecord[]>(HP_LOG_KEY)) ?? [];
  }

  private async sendAbilitiesSnapshot(webSocket: WebSocket): Promise<void> {
    const state = await this.readAbilityState();
    this.sendAbility(webSocket, {
      type: "session.abilities.snapshot",
      characters: Object.values(state),
    });
  }

  private readConnection(webSocket: WebSocket): SessionConnection | null {
    try {
      const value = webSocket.deserializeAttachment() as SessionConnection | null;
      if (!value || typeof value.clientId !== "string" || typeof value.userId !== "string") {
        return null;
      }
      return value;
    } catch {
      return null;
    }
  }

  private touchConnection(webSocket: WebSocket, connection: SessionConnection): void {
    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);
  }

  private sendError(webSocket: WebSocket, code: string, message: string): void {
    this.sendAbility(webSocket, { type: "session.error", code, message });
  }

  private sendAbility(webSocket: WebSocket, message: unknown): void {
    try {
      webSocket.send(JSON.stringify(message));
    } catch {
      // Connection cleanup remains owned by the base SessionActor.
    }
  }

  private broadcastAbility(message: unknown): void {
    this.broadcastRaw(message);
  }

  private broadcastRaw(message: unknown): void {
    const encoded = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(encoded); } catch { /* base actor handles stale sockets */ }
    }
  }

  private broadcastLogToMasters(records: AnySessionLogRecord[]): void {
    const encoded = JSON.stringify({ type: "session.hp.log", records });
    for (const socket of this.ctx.getWebSockets()) {
      const connection = this.readConnection(socket);
      if (connection?.role !== "MASTER") continue;
      try { socket.send(encoded); } catch { /* base actor handles stale sockets */ }
    }
  }
}

function canMutateCharacter(
  connection: SessionConnection,
  ownerUserId?: string,
): boolean {
  return connection.role === "MASTER" || Boolean(ownerUserId && ownerUserId === connection.userId);
}

function hydrateAuthoritativeCharacter(
  abilityState: SessionAbilityState,
  hp: SessionHpState,
  conditions: SessionConditionsState,
): CharacterTemplate {
  let character = CharacterTemplate.fromJSON(
    abilityState.character as Partial<CharacterTemplateProps>,
  );
  const sheet = character.get("sheet");

  character = character.withPatch({
    sheet: {
      ...sheet,
      attributes: hp.attributesInitialized
        ? { ...hp.attributes }
        : sheet.attributes,
      savingThrowProficiencies: hp.savingThrowsInitialized
        ? { ...hp.savingThrows }
        : sheet.savingThrowProficiencies,
      skills: hp.skillsInitialized
        ? { ...hp.skills }
        : sheet.skills,
      stats: hp.statsInitialized
        ? {
            ...sheet.stats,
            armorClassAdjustment: hp.stats.armorClassAdjustment,
            initiativeAdjustment: hp.stats.initiativeAdjustment,
            mobilityAdjustment: hp.stats.mobilityAdjustment,
            passivePerceptionAdjustment: hp.stats.passivePerceptionAdjustment,
            exhaustion: hp.stats.exhaustion,
            inspiration: hp.stats.inspiration,
            experience: hp.stats.experience,
          }
        : sheet.stats,
      HP: {
        ...sheet.HP,
        current: hp.current,
        temporary: hp.temporary,
        max: hp.max,
        currentMax: hp.currentMax,
      },
    },
  });

  return withCharacterConditions(character, conditions.conditions as any);
}

function applyAbilityOperation(
  character: CharacterTemplate,
  operation: SessionAbilityOperation,
): CharacterTemplate | null {
  if (operation.type === "character.ability.save") {
    return character.saveAbility(operation.ability as unknown as Ability);
  }
  if (operation.type === "character.ability.remove") {
    return character.removeAbility(operation.abilityId);
  }

  const { source } = operation;
  switch (source.type) {
    case "character":
      if (operation.type === "character.ability.use") {
        return character.useAbility(source.abilityId, operation.activationOptionId);
      }
      if (operation.type === "character.ability.restore") {
        return character.restoreAbility(source.abilityId);
      }
      return character.deactivateAbility(source.abilityId);

    case "equipment":
      if (operation.type === "character.ability.use") {
        return character.useEquipmentAbility(
          source.itemId,
          source.abilityId,
          operation.activationOptionId,
        );
      }
      if (operation.type === "character.ability.restore") {
        return character.restoreEquipmentAbility(source.itemId, source.abilityId);
      }
      return character.deactivateEquipmentAbility(source.itemId, source.abilityId);

    case "condition": {
      const projectedId = `condition:${source.conditionId}:${source.abilityId}`;
      if (operation.type === "character.ability.use") {
        return character.useAbility(projectedId, operation.activationOptionId);
      }
      if (operation.type === "character.ability.restore") {
        return character.restoreAbility(projectedId);
      }
      return character.deactivateAbility(projectedId);
    }

    case "race":
      return updateRaceAbilityState(
        character,
        source,
        operation.type === "character.ability.use"
          ? "use"
          : operation.type === "character.ability.restore"
            ? "restore"
            : "deactivate",
        operation.type === "character.ability.use"
          ? operation.activationOptionId
          : undefined,
      );
  }
}

function updateRaceAbilityState(
  character: CharacterTemplate,
  source: Extract<SessionAbilitySource, { type: "race" }>,
  action: "use" | "restore" | "deactivate",
  optionId?: string,
): CharacterTemplate {
  const race = character.get("sheet").race;
  const ability = (race.naturalAbilities ?? []).find(
    (current) => current.id === source.abilityId,
  );
  if (!ability) return character;

  if (action === "use") {
    return useAbilityEffect(
      character,
      ability,
      { type: "race", sourceLabel: "Raça" },
      optionId,
    );
  }
  if (action === "deactivate") {
    return endAbilityEffect(
      character,
      ability,
      { type: "race", sourceLabel: "Raça" },
    );
  }

  return character.withSheet("race", {
    ...race,
    naturalAbilities: (race.naturalAbilities ?? []).map((current) =>
      current.id === source.abilityId ? restoreAbilityUse(current) : current,
    ),
  });
}

function extractHpState(
  character: CharacterTemplate,
  previous: SessionHpState,
): SessionHpState {
  const hp = character.get("sheet").HP;
  const currentMax = getCurrentMaxHp(character);
  return {
    ...previous,
    current: hp.current,
    temporary: hp.temporary,
    max: hp.max,
    currentMax,
    maxHpBonus: character.getEffectiveMaxHp() - currentMax,
    revision: previous.revision + 1,
  };
}

function extractConditionsState(
  character: CharacterTemplate,
  previous: SessionConditionsState,
): SessionConditionsState {
  return {
    ...previous,
    conditions: getCharacterConditions(character) as any,
    revision: previous.revision + 1,
  };
}

function sameHpRuntime(left: SessionHpState, right: SessionHpState): boolean {
  return (
    left.current === right.current &&
    left.temporary === right.temporary &&
    left.max === right.max &&
    left.currentMax === right.currentMax &&
    left.maxHpBonus === right.maxHpBonus
  );
}

function parseUndoLogId(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed?.type === "session.log.undo" && typeof parsed.logId === "string"
      ? parsed.logId
      : null;
  } catch {
    return null;
  }
}

function isAbilityReverseOperation(
  value: AnySessionLogRecord["reverseOperation"],
): value is AbilityReverseOperation {
  return value?.type === "character.ability.restore" &&
    typeof value.characterId === "string" &&
    typeof (value as AbilityReverseOperation).snapshot === "object";
}

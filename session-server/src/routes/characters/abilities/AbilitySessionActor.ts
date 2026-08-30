import type { Ability } from "../../../../../src/models/abilities/Ability";
import {
  canActivateAbility,
  endAbilityEffect,
  restoreAbilityUse,
  useAbilityEffect,
} from "../../../../../src/models/abilities/abilityActivation";
import { spendAbilityResourceCosts } from "../../../../../src/models/abilities/abilityResourceCosts";
import { getChannelDivinityPool } from "../../../../../src/models/characters/characterChannelDivinity";
import { getKiPool } from "../../../../../src/models/characters/characterKi";
import {
  getCharacterConditions,
  withCharacterConditions,
} from "../../../../../src/models/characters/characterConditionStorage";
import { spendGrantedSpellAbilityUse } from "../../../../../src/models/characters/characterGrantedSpells";
import { getCurrentMaxHp } from "../../../../../src/models/characters/characterHp";
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../../../src/models/characters/CharacterTemplate";
import { normalizeDamageAffinities } from "../../../../../src/models/combat/Damage";
import { listResolvedBonusRolls } from "../../../../../src/models/bonuses/BonusRoll";
import { SessionActor as BaseSessionActor } from "../../session/SessionActor";
import {
  parseAbilityClientMessage,
  type SessionAbilityOperation,
  type SessionAbilitySeed,
  type SessionAbilitySource,
  type SessionAbilityState,
} from "./abilityProtocol";
import { MAX_CHARACTER_STATE_LOG_RECORDS } from "../sheet/characterState";
import type {
  SessionConditionsState,
  SessionConnection,
  SessionHpState,
} from "../../session/protocol";
import {
  commitSessionMutation,
  createSessionLogRecord,
  readSessionLog,
} from "../../session/sessionLog";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";

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
      this.sendAbilityError(webSocket, "MASTER_REQUIRED", "Only the MASTER can initialize authoritative ability state.");
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
        this.sendAbilityError(webSocket, "INVALID_ABILITY_SEED", "The ability state seed contains an invalid character snapshot.");
        return;
      }

      if (character.get("id") !== seed.characterId) {
        this.sendAbilityError(webSocket, "ABILITY_SEED_ID_MISMATCH", "The ability state seed does not match the target character.");
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
      this.readAbilityHpState(),
      this.readAbilityConditionsState(),
      readSessionLog(this.ctx.storage),
    ]);

    const storedAbility = abilityState[operation.characterId];
    const hp = hpState[operation.characterId];
    const conditions = conditionsState[operation.characterId];

    if (!storedAbility?.initialized || !hp || !conditions?.initialized) {
      this.sendAbilityError(webSocket, "ABILITY_STATE_NOT_INITIALIZED", "Ability state for this character has not been initialized by the MASTER.");
      return;
    }

    if (!canMutateCharacter(connection, hp.ownerUserId)) {
      this.sendAbilityError(webSocket, "CHARACTER_ACCESS_DENIED", "You cannot change abilities for this character.");
      return;
    }

    let current: CharacterTemplate;
    try {
      current = hydrateAuthoritativeCharacter(storedAbility, hp, conditions);
    } catch {
      this.sendAbilityError(webSocket, "ABILITY_STATE_INVALID", "The authoritative ability snapshot is invalid.");
      return;
    }

    const next = applyAbilityOperation(current, operation);
    if (!next) {
      this.sendAbilityError(webSocket, "ABILITY_OPERATION_INVALID", "The requested ability operation is invalid for the current character state.");
      return;
    }

    const currentJson = current.toJSON();
    const nextJson = next.toJSON();
    if (JSON.stringify(currentJson) === JSON.stringify(nextJson)) {
      this.sendAbilityError(webSocket, "ABILITY_OPERATION_REJECTED", "The ability could not be changed in its current state.");
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

    let loggedOperation = operation;
    if (operation.type === "character.ability.use") {
      const resolvedAbility = findAbilityForSource(next, operation.source);
      const bonusRollResults = listResolvedBonusRolls(resolvedAbility?.bonuses);
      if (bonusRollResults.length > 0) {
        loggedOperation = { ...operation, bonusRollResults };
      }
    }

    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation: loggedOperation,
      reverseOperation: {
        type: "character.ability.restore",
        characterId: operation.characterId,
        snapshot: {
          ability: storedAbility,
          hp,
          conditions,
        },
      },
    });

    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: {
        [ABILITIES_STATE_KEY]: abilityState,
        ...(hpChanged ? { [HP_STATE_KEY]: hpState } : {}),
        ...(conditionsChanged ? { [CONDITIONS_STATE_KEY]: conditionsState } : {}),
      },
      record,
      currentLog: log,
      maxRecords: MAX_CHARACTER_STATE_LOG_RECORDS,
    });

    this.broadcastAbility({ type: "session.abilities.updated", character: nextAbilityState });
    if (hpChanged) this.broadcastRaw({ type: "session.hp.updated", character: nextHp });
    if (conditionsChanged) {
      this.broadcastRaw({ type: "session.conditions.updated", character: nextConditions });
    }
  }

  private async readAbilityState(): Promise<Record<string, SessionAbilityState>> {
    return (await this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY)) ?? {};
  }

  private async readAbilityHpState(): Promise<Record<string, SessionHpState>> {
    return (await this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY)) ?? {};
  }

  private async readAbilityConditionsState(): Promise<Record<string, SessionConditionsState>> {
    return (await this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY)) ?? {};
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

  private sendAbilityError(webSocket: WebSocket, code: string, message: string): void {
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
      try { socket.send(encoded); }
      catch { /* base actor handles stale sockets */ }
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
  if (operation.type === "character.damageAffinities.set") {
    return character.withSheet(
      "damageAffinities",
      normalizeDamageAffinities(operation.damageAffinities),
    );
  }
  if (operation.type === "character.ability.usage.spend") {
    return spendGrantedSpellAbilityUse(character, operation.source);
  }

  const { source } = operation;
  let nextCharacter = character;
  if (operation.type === "character.ability.use") {
    const ability = findAbilityForSource(character, source);
    if (!ability || !canActivateAbility(character, ability)) return null;
    if ((source.type === "character" || source.type === "condition") && ability.category === "channelDivinity" && (getChannelDivinityPool(character)?.current ?? 0) <= 0) return null;
    if ((source.type === "character" || source.type === "condition") && ability.category === "martialArts" && (getKiPool(character)?.current ?? 0) <= 0) return null;
    const payment = spendAbilityResourceCosts(character, ability, operation.resourceSelection);
    if (!payment.ok) return null;
    nextCharacter = payment.character;
  }

  switch (source.type) {
    case "character":
      if (operation.type === "character.ability.use") {
        return nextCharacter.useAbility(source.abilityId, operation.activationOptionId, operation.bonusRollValues);
      }
      if (operation.type === "character.ability.restore") {
        return character.restoreAbility(source.abilityId);
      }
      return character.deactivateAbility(source.abilityId);

    case "equipment":
      if (operation.type === "character.ability.use") {
        return nextCharacter.useEquipmentAbility(source.itemId, source.abilityId, operation.bonusRollValues);
      }
      if (operation.type === "character.ability.restore") {
        return character.restoreEquipmentAbility(source.itemId, source.abilityId);
      }
      return character.deactivateEquipmentAbility(source.itemId, source.abilityId);

    case "condition": {
      const projectedId = `condition:${source.conditionId}:${source.abilityId}`;
      if (operation.type === "character.ability.use") {
        return nextCharacter.useAbility(projectedId, operation.activationOptionId, operation.bonusRollValues);
      }
      if (operation.type === "character.ability.restore") {
        return character.restoreAbility(projectedId);
      }
      return character.deactivateAbility(projectedId);
    }

    case "race":
      return updateRaceAbilityState(
        operation.type === "character.ability.use" ? nextCharacter : character,
        source,
        operation.type === "character.ability.use"
          ? "use"
          : operation.type === "character.ability.restore"
            ? "restore"
            : "deactivate",
        operation.type === "character.ability.use"
          ? operation.activationOptionId
          : undefined,
        operation.type === "character.ability.use"
          ? operation.bonusRollValues
          : undefined,
      );
  }
}

function findAbilityForSource(
  character: CharacterTemplate,
  source: SessionAbilitySource,
): Ability | undefined {
  if (source.type === "race") {
    return character.get("sheet").race.naturalAbilities?.find((ability) => ability.id === source.abilityId);
  }
  if (source.type === "equipment") {
    return character.getEquipmentAbilities().find((ability) =>
      ability.sourceItemId === source.itemId && ability.originalAbilityId === source.abilityId
    );
  }
  if (source.type === "condition") {
    return character.getCharacterAbilities().find((ability) =>
      ability.source === "condition" &&
      ability.sourceConditionId === source.conditionId &&
      ability.originalAbilityId === source.abilityId
    );
  }
  return character.getCharacterAbilities().find((ability) =>
    ability.id === source.abilityId && ability.source !== "equipment" && ability.source !== "condition"
  );
}

function updateRaceAbilityState(
  character: CharacterTemplate,
  source: Extract<SessionAbilitySource, { type: "race" }>,
  action: "use" | "restore" | "deactivate",
  optionId?: string,
  bonusRollValues?: Record<string, number>,
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
      bonusRollValues,
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
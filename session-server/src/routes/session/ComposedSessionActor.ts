import { SessionActor as BaseSessionActor } from "./SessionActor";
import { SessionActor as AbilitySessionActor } from "../characters/abilities/AbilitySessionActor";
import { SessionActor as MagicSessionActor } from "../characters/spells/MagicSessionActor";
import { SessionActor as EquipmentSessionActor } from "../characters/equipment/EquipmentSessionActor";
import { SessionActor as InventorySessionActor } from "../characters/inventory/InventorySessionActor";
import { SessionActor as ProficiencySessionActor } from "../characters/proficiencies/ProficiencySessionActor";
import { SessionActor as RaceSessionActor } from "../characters/race/RaceSessionActor";
import { SessionActor as ProfileSessionActor } from "../characters/profile/ProfileSessionActor";
import { parseAbilityClientMessage, type SessionAbilityState } from "../characters/abilities/abilityProtocol";
import { parseMagicClientMessage } from "../characters/spells/magicProtocol";
import { parseEquipmentClientMessage } from "../characters/equipment/equipmentProtocol";
import { parseInventoryClientMessage } from "../characters/inventory/inventoryProtocol";
import { parseProficiencyClientMessage } from "../characters/proficiencies/proficiencyProtocol";
import { parseRaceClientMessage } from "../characters/race/raceProtocol";
import { parseProfileClientMessage } from "../characters/profile/profileProtocol";
import {
  applyHpUndo,
  defaultSavingThrows,
  defaultSkills,
  MAX_HP_LOG_RECORDS,
} from "../characters/sheet/hpState";
import { applyConditionUndo } from "../characters/sheet/conditionState";
import { applyConcentrationUndo } from "../characters/sheet/concentrationState";
import type {
  SessionConditionsState,
  SessionConnection,
  SessionHpLogRecord,
  SessionHpState,
} from "./protocol";
import {
  parseCharacterLifecycleClientMessage,
  type SessionCharacterLifecycleOperation,
  type SessionCharacterLifecycleState,
} from "./characterLifecycleProtocol";
import {
  commitSessionMutation,
  commitSessionUndo,
  createSessionLogRecord,
  readSessionLog,
  validateUndoOrdering,
  type SessionLogRecord,
} from "./sessionLog";
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../../src/models/characters/CharacterTemplate";
import { getCurrentMaxHp } from "../../../../src/models/characters/characterHp";
import { getCharacterConditions } from "../../../../src/models/characters/characterConditionStorage";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";
const INVENTORY_STATE_KEY = "inventory-state";
const CHARACTER_LIFECYCLE_STATE_KEY = "characters-state";

type DomainActor = {
  webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void>;
};

type SharedInventoryState = {
  initialized: boolean;
  revision: number;
  partyInventory: unknown[];
  groundInventory: unknown[];
};

type CharacterLifecycleReverse = {
  type: "session.character.restore";
  characterId: string;
  affectedScopes?: string[];
  snapshot: {
    lifecycle?: SessionCharacterLifecycleState;
    ability?: SessionAbilityState;
    hp?: SessionHpState;
    conditions?: SessionConditionsState;
  };
};

type AbilityReverse = {
  type: "character.ability.restore";
  characterId: string;
  affectedScopes?: string[];
  snapshot: {
    ability: SessionAbilityState;
    hp: SessionHpState;
    conditions: SessionConditionsState;
  };
};

type RestReverse = {
  type: "session.rest.restore";
  characterId: string;
  affectedScopes?: string[];
  snapshot: {
    ability: SessionAbilityState;
    hp: SessionHpState;
    conditions: SessionConditionsState;
    inventory?: SharedInventoryState;
  };
};

type InventoryReverse = {
  type: "session.inventory.restore";
  characterId: string;
  affectedScopes?: string[];
  snapshot: {
    abilities: Record<string, SessionAbilityState>;
    hp: Record<string, SessionHpState>;
    conditions: Record<string, SessionConditionsState>;
    inventory: SharedInventoryState;
  };
};

type ProficiencyReverse = {
  type: "session.proficiency.restore";
  characterId: string;
  affectedScopes?: string[];
  snapshot: SessionAbilityState;
};

type RaceOrProfileReverse = {
  type: "session.race.restore" | "session.profile.restore";
  characterId: string;
  affectedScopes?: string[];
  snapshot: { ability: SessionAbilityState; hp: SessionHpState };
};

type CentrallyRestorableReverse =
  | CharacterLifecycleReverse
  | AbilityReverse
  | RestReverse
  | InventoryReverse
  | ProficiencyReverse
  | RaceOrProfileReverse;

/**
 * The only Durable Object exported by the worker.
 *
 * Domain actors are isolated forward-operation containers. This class owns
 * routing, lifecycle, unified timeline ordering and every undo path.
 */
export class SessionActor extends BaseSessionActor {
  private readonly abilityRoute = bindDomainActor(AbilitySessionActor.prototype, this.ctx);
  private readonly magicRoute = bindDomainActor(MagicSessionActor.prototype, this.ctx);
  private readonly equipmentRoute = bindDomainActor(EquipmentSessionActor.prototype, this.ctx);
  private readonly inventoryRoute = bindDomainActor(InventorySessionActor.prototype, this.ctx);
  private readonly proficiencyRoute = bindDomainActor(ProficiencySessionActor.prototype, this.ctx);
  private readonly raceRoute = bindDomainActor(RaceSessionActor.prototype, this.ctx);
  private readonly profileRoute = bindDomainActor(ProfileSessionActor.prototype, this.ctx);

  override async fetch(request: Request): Promise<Response> {
    const response = await super.fetch(request);
    if (response.status !== 101) return response;

    const clientId = request.headers.get("x-session-client-id")?.trim();
    if (!clientId) return response;

    const socket = this.ctx.getWebSockets().find((candidate) => {
      try {
        const connection = candidate.deserializeAttachment() as { clientId?: unknown } | null;
        return connection?.clientId === clientId;
      } catch {
        return false;
      }
    });
    if (!socket) return response;

    await Promise.all([
      this.sendAbilitySnapshot(socket),
      this.sendInventorySnapshot(socket),
      this.sendCharacterLifecycleSnapshot(socket),
    ]);
    return response;
  }

  override async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);

    const undoLogId = parseUndoLogId(raw);
    if (undoLogId) {
      await this.handleCentralUndo(webSocket, undoLogId);
      return;
    }

    const lifecycle = parseCharacterLifecycleClientMessage(raw);
    if (lifecycle) {
      const connection = readSessionConnection(webSocket);
      if (!connection) {
        webSocket.close(1011, "Missing connection attachment");
        return;
      }
      connection.lastHeartbeatAt = Date.now();
      webSocket.serializeAttachment(connection);
      await this.handleCharacterLifecycleOperation(webSocket, connection, lifecycle.operation);
      return;
    }

    const route = resolveMessageRoute(raw, {
      ability: this.abilityRoute,
      magic: this.magicRoute,
      equipment: this.equipmentRoute,
      inventory: this.inventoryRoute,
      proficiency: this.proficiencyRoute,
      race: this.raceRoute,
      profile: this.profileRoute,
    });

    if (route) {
      await route.webSocketMessage(webSocket, message);
      return;
    }

    await super.webSocketMessage(webSocket, message);
  }

  private async handleCentralUndo(webSocket: WebSocket, logId: string): Promise<void> {
    const connection = readSessionConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    if (connection.role !== "MASTER") {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can undo session changes.");
      return;
    }

    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    const log = await readSessionLog(this.ctx.storage);
    const validation = validateUndoOrdering(log, logId);
    if (!validation.ok) {
      sendError(webSocket, validation.code, validation.message);
      return;
    }

    const reverseType = validation.record.reverseOperation.type;
    if (isCentrallyRestorable(validation.record.reverseOperation)) {
      await this.restoreCentralSnapshot(
        webSocket,
        connection,
        log,
        validation.index,
        validation.record,
        validation.affectedScopes,
      );
      return;
    }

    if (
      reverseType === "character.condition.delete"
      || reverseType === "character.condition.restore"
      || reverseType === "character.concentration.restore"
    ) {
      await this.restoreConditionState(
        webSocket,
        connection,
        log,
        validation.index,
        validation.record,
      );
      return;
    }

    await this.restoreHpState(
      webSocket,
      connection,
      log,
      validation.index,
      validation.record,
    );
  }

  private async restoreHpState(
    webSocket: WebSocket,
    connection: SessionConnection,
    log: SessionLogRecord[],
    sourceIndex: number,
    source: SessionLogRecord,
  ): Promise<void> {
    const state = await this.readComposedHpState();
    const characterId = source.reverseOperation.characterId;
    const current = state[characterId];
    if (!current) {
      sendError(webSocket, "HP_NOT_INITIALIZED", "Authoritative state for this character is missing.");
      return;
    }

    const result = applyHpUndo(
      current,
      source as unknown as SessionHpLogRecord,
      connection,
    );
    if (!result.ok) {
      sendError(webSocket, result.code, result.message);
      return;
    }

    state[characterId] = result.next;
    await commitSessionUndo(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [HP_STATE_KEY]: state },
      currentLog: log,
      sourceIndex,
      userId: connection.userId,
      undoRecord: result.record as unknown as SessionLogRecord,
      maxRecords: MAX_HP_LOG_RECORDS,
      undoneAt: result.record.createdAt,
    });
    broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: result.next });
  }

  private async restoreConditionState(
    webSocket: WebSocket,
    connection: SessionConnection,
    log: SessionLogRecord[],
    sourceIndex: number,
    source: SessionLogRecord,
  ): Promise<void> {
    const state = await this.readComposedConditionsState();
    const characterId = source.reverseOperation.characterId;
    const current = state[characterId];
    if (!current?.initialized) {
      sendError(webSocket, "CONDITIONS_NOT_INITIALIZED", "Authoritative conditions for this character are missing.");
      return;
    }

    const legacySource = source as unknown as SessionHpLogRecord;
    const result = source.reverseOperation.type === "character.concentration.restore"
      ? applyConcentrationUndo(current, legacySource, connection)
      : applyConditionUndo(current, legacySource, connection);
    if (!result.ok) {
      sendError(webSocket, result.code, result.message);
      return;
    }

    state[characterId] = result.next;
    await commitSessionUndo(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [CONDITIONS_STATE_KEY]: state },
      currentLog: log,
      sourceIndex,
      userId: connection.userId,
      undoRecord: result.record as unknown as SessionLogRecord,
      maxRecords: MAX_HP_LOG_RECORDS,
      undoneAt: result.record.createdAt,
    });
    broadcast(this.ctx.getWebSockets(), { type: "session.conditions.updated", character: result.next });
  }

  private async restoreCentralSnapshot(
    webSocket: WebSocket,
    connection: SessionConnection,
    log: SessionLogRecord[],
    sourceIndex: number,
    source: SessionLogRecord,
    affectedScopes: string[],
  ): Promise<void> {
    const reverse = source.reverseOperation as CentrallyRestorableReverse;
    const [abilities, hp, conditions, inventory, lifecycle] = await Promise.all([
      this.readAbilitiesState(),
      this.readComposedHpState(),
      this.readComposedConditionsState(),
      this.readInventoryState(),
      this.readCharacterLifecycleState(),
    ]);

    const characterId = reverse.characterId;
    let inverseReverse: CentrallyRestorableReverse;
    const writes: Record<string, unknown> = {};

    switch (reverse.type) {
      case "character.ability.restore": {
        const currentAbility = abilities[characterId];
        const currentHp = hp[characterId];
        const currentConditions = conditions[characterId];
        if (!currentAbility || !currentHp || !currentConditions) {
          sendError(webSocket, "ABILITY_STATE_NOT_INITIALIZED", "The current ability state required for undo is missing.");
          return;
        }
        inverseReverse = {
          type: reverse.type,
          characterId,
          affectedScopes,
          snapshot: { ability: currentAbility, hp: currentHp, conditions: currentConditions },
        };
        abilities[characterId] = reverse.snapshot.ability;
        hp[characterId] = reverse.snapshot.hp;
        conditions[characterId] = reverse.snapshot.conditions;
        writes[ABILITIES_STATE_KEY] = abilities;
        writes[HP_STATE_KEY] = hp;
        writes[CONDITIONS_STATE_KEY] = conditions;
        break;
      }
      case "session.rest.restore": {
        const currentAbility = abilities[characterId];
        const currentHp = hp[characterId];
        const currentConditions = conditions[characterId];
        if (!currentAbility || !currentHp || !currentConditions) {
          sendError(webSocket, "REST_STATE_NOT_INITIALIZED", "The current rest state required for undo is missing.");
          return;
        }
        inverseReverse = {
          type: reverse.type,
          characterId,
          affectedScopes,
          snapshot: {
            ability: currentAbility,
            hp: currentHp,
            conditions: currentConditions,
            inventory: reverse.snapshot.inventory ? structuredClone(inventory) : undefined,
          },
        };
        abilities[characterId] = reverse.snapshot.ability;
        hp[characterId] = reverse.snapshot.hp;
        conditions[characterId] = reverse.snapshot.conditions;
        writes[ABILITIES_STATE_KEY] = abilities;
        writes[HP_STATE_KEY] = hp;
        writes[CONDITIONS_STATE_KEY] = conditions;
        if (reverse.snapshot.inventory) writes[INVENTORY_STATE_KEY] = reverse.snapshot.inventory;
        break;
      }
      case "session.inventory.restore": {
        inverseReverse = {
          type: reverse.type,
          characterId,
          affectedScopes,
          snapshot: {
            abilities: structuredClone(abilities),
            hp: structuredClone(hp),
            conditions: structuredClone(conditions),
            inventory: structuredClone(inventory),
          },
        };
        writes[ABILITIES_STATE_KEY] = reverse.snapshot.abilities;
        writes[HP_STATE_KEY] = reverse.snapshot.hp;
        writes[CONDITIONS_STATE_KEY] = reverse.snapshot.conditions;
        writes[INVENTORY_STATE_KEY] = reverse.snapshot.inventory;
        break;
      }
      case "session.proficiency.restore": {
        const currentAbility = abilities[characterId];
        if (!currentAbility) {
          sendError(webSocket, "PROFICIENCY_STATE_NOT_INITIALIZED", "The current proficiency state required for undo is missing.");
          return;
        }
        inverseReverse = {
          type: reverse.type,
          characterId,
          affectedScopes,
          snapshot: currentAbility,
        };
        abilities[characterId] = reverse.snapshot;
        writes[ABILITIES_STATE_KEY] = abilities;
        break;
      }
      case "session.race.restore":
      case "session.profile.restore": {
        const currentAbility = abilities[characterId];
        const currentHp = hp[characterId];
        if (!currentAbility || !currentHp) {
          sendError(webSocket, "CHARACTER_STATE_NOT_INITIALIZED", "The current character state required for undo is missing.");
          return;
        }
        inverseReverse = {
          type: reverse.type,
          characterId,
          affectedScopes,
          snapshot: { ability: currentAbility, hp: currentHp },
        };
        abilities[characterId] = reverse.snapshot.ability;
        hp[characterId] = reverse.snapshot.hp;
        writes[ABILITIES_STATE_KEY] = abilities;
        writes[HP_STATE_KEY] = hp;
        break;
      }
      case "session.character.restore": {
        inverseReverse = {
          type: reverse.type,
          characterId,
          affectedScopes,
          snapshot: {
            lifecycle: lifecycle[characterId],
            ability: abilities[characterId],
            hp: hp[characterId],
            conditions: conditions[characterId],
          },
        };
        restoreOptionalEntry(lifecycle, characterId, reverse.snapshot.lifecycle);
        restoreOptionalEntry(abilities, characterId, reverse.snapshot.ability);
        restoreOptionalEntry(hp, characterId, reverse.snapshot.hp);
        restoreOptionalEntry(conditions, characterId, reverse.snapshot.conditions);
        writes[CHARACTER_LIFECYCLE_STATE_KEY] = lifecycle;
        writes[ABILITIES_STATE_KEY] = abilities;
        writes[HP_STATE_KEY] = hp;
        writes[CONDITIONS_STATE_KEY] = conditions;
        break;
      }
    }

    const now = new Date().toISOString();
    const undoRecord = createSessionLogRecord({
      actorId: connection.userId,
      createdAt: now,
      operation: { type: "character.hp.undo", characterId, sourceLogId: source.id },
      reverseOperation: inverseReverse,
      affectedScopes,
    });

    await commitSessionUndo(this.ctx.storage, this.ctx.getWebSockets(), {
      writes,
      currentLog: log,
      sourceIndex,
      userId: connection.userId,
      undoRecord,
      maxRecords: MAX_HP_LOG_RECORDS,
      undoneAt: now,
    });
    await this.broadcastAuthoritativeStateForReverse(reverse);
  }

  private async handleCharacterLifecycleOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionCharacterLifecycleOperation,
  ): Promise<void> {
    if (connection.role !== "MASTER") {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can change session character lifecycle state.");
      return;
    }

    const [lifecycle, abilities, hp, conditions, log] = await Promise.all([
      this.readCharacterLifecycleState(),
      this.readAbilitiesState(),
      this.readComposedHpState(),
      this.readComposedConditionsState(),
      readSessionLog(this.ctx.storage),
    ]);
    const characterId = operation.characterId;
    const snapshot: CharacterLifecycleReverse["snapshot"] = {
      lifecycle: lifecycle[characterId] ? structuredClone(lifecycle[characterId]) : undefined,
      ability: abilities[characterId] ? structuredClone(abilities[characterId]) : undefined,
      hp: hp[characterId] ? structuredClone(hp[characterId]) : undefined,
      conditions: conditions[characterId] ? structuredClone(conditions[characterId]) : undefined,
    };

    if (operation.type === "character.session.remove") {
      const currentLifecycle = lifecycle[characterId];
      const currentAbility = abilities[characterId];
      const currentHp = hp[characterId];
      if ((!currentLifecycle || !currentLifecycle.active) && !currentAbility && !currentHp) {
        sendError(webSocket, "CHARACTER_NOT_IN_SESSION", "The character is not active in this session.");
        return;
      }
      lifecycle[characterId] = {
        characterId,
        character: currentLifecycle?.character ?? currentAbility?.character ?? {},
        ownerUserId: currentLifecycle?.ownerUserId ?? currentHp?.ownerUserId,
        active: false,
        revision: (currentLifecycle?.revision ?? 0) + 1,
      };
      delete abilities[characterId];
      delete hp[characterId];
      delete conditions[characterId];
    } else if (operation.type === "character.session.owner.set") {
      const storedAbility = abilities[characterId];
      const storedHp = hp[characterId];
      if (!storedAbility?.initialized || !storedHp || lifecycle[characterId]?.active === false) {
        sendError(webSocket, "CHARACTER_NOT_IN_SESSION", "The character is not active in this session.");
        return;
      }
      let character: CharacterTemplate;
      try {
        character = CharacterTemplate.fromJSON(storedAbility.character as Partial<CharacterTemplateProps>);
      } catch {
        sendError(webSocket, "CHARACTER_STATE_INVALID", "The authoritative character snapshot is invalid.");
        return;
      }
      const nextCharacter = character.withPatch({ owner: operation.owner });
      const nextAbility: SessionAbilityState = {
        ...storedAbility,
        character: nextCharacter.toJSON() as unknown as Record<string, unknown>,
        revision: storedAbility.revision + 1,
      };
      abilities[characterId] = nextAbility;
      hp[characterId] = {
        ...storedHp,
        ownerUserId: operation.owner.id,
        revision: storedHp.revision + 1,
      };
      lifecycle[characterId] = {
        characterId,
        character: nextAbility.character,
        ownerUserId: operation.owner.id,
        active: true,
        revision: (lifecycle[characterId]?.revision ?? 0) + 1,
      };
    } else {
      let character: CharacterTemplate;
      try {
        character = CharacterTemplate.fromJSON(operation.character as Partial<CharacterTemplateProps>);
      } catch {
        sendError(webSocket, "CHARACTER_SNAPSHOT_INVALID", "The supplied character snapshot is invalid.");
        return;
      }
      if (character.get("id") !== characterId) {
        sendError(webSocket, "CHARACTER_ID_MISMATCH", "The supplied character does not match the target character id.");
        return;
      }
      if (operation.type === "character.session.add" && (lifecycle[characterId]?.active || abilities[characterId]?.initialized)) {
        sendError(webSocket, "CHARACTER_ALREADY_IN_SESSION", "The character is already active in this session.");
        return;
      }
      if (operation.type === "character.session.resync" && lifecycle[characterId]?.active === false) {
        sendError(webSocket, "CHARACTER_NOT_IN_SESSION", "A removed character must be added again before it can be resynchronized.");
        return;
      }

      const runtime = runtimeStateFromCharacter(character, abilities[characterId], hp[characterId], conditions[characterId]);
      abilities[characterId] = runtime.ability;
      hp[characterId] = runtime.hp;
      conditions[characterId] = runtime.conditions;
      lifecycle[characterId] = {
        characterId,
        character: runtime.ability.character,
        ownerUserId: runtime.hp.ownerUserId,
        active: true,
        revision: (lifecycle[characterId]?.revision ?? -1) + 1,
      };
    }

    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation,
      reverseOperation: {
        type: "session.character.restore",
        characterId,
        snapshot,
      },
    });

    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: {
        [CHARACTER_LIFECYCLE_STATE_KEY]: lifecycle,
        [ABILITIES_STATE_KEY]: abilities,
        [HP_STATE_KEY]: hp,
        [CONDITIONS_STATE_KEY]: conditions,
      },
      record,
      currentLog: log,
      maxRecords: MAX_HP_LOG_RECORDS,
    });

    if (operation.type === "character.session.remove") {
      broadcast(this.ctx.getWebSockets(), { type: "session.character.removed", characterId });
      broadcast(this.ctx.getWebSockets(), { type: "session.abilities.snapshot", characters: Object.values(abilities) });
      broadcast(this.ctx.getWebSockets(), { type: "session.hp.snapshot", characters: Object.values(hp) });
      broadcast(this.ctx.getWebSockets(), { type: "session.conditions.snapshot", characters: Object.values(conditions) });
      return;
    }

    broadcast(this.ctx.getWebSockets(), { type: "session.character.updated", character: lifecycle[characterId] });
    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: abilities[characterId] });
    broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: hp[characterId] });
    broadcast(this.ctx.getWebSockets(), { type: "session.conditions.updated", character: conditions[characterId] });
  }

  private async broadcastAuthoritativeStateForReverse(reverse: CentrallyRestorableReverse): Promise<void> {
    if (reverse.type === "session.rest.restore") {
      broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: reverse.snapshot.ability });
      broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: reverse.snapshot.hp });
      broadcast(this.ctx.getWebSockets(), { type: "session.conditions.updated", character: reverse.snapshot.conditions });
      if (reverse.snapshot.inventory) {
        broadcast(this.ctx.getWebSockets(), { type: "session.inventory.updated", state: reverse.snapshot.inventory });
      }
      return;
    }

    if (reverse.type === "session.inventory.restore") {
      broadcast(this.ctx.getWebSockets(), { type: "session.abilities.snapshot", characters: Object.values(reverse.snapshot.abilities) });
      broadcast(this.ctx.getWebSockets(), { type: "session.hp.snapshot", characters: Object.values(reverse.snapshot.hp) });
      broadcast(this.ctx.getWebSockets(), { type: "session.conditions.snapshot", characters: Object.values(reverse.snapshot.conditions) });
      broadcast(this.ctx.getWebSockets(), { type: "session.inventory.updated", state: reverse.snapshot.inventory });
      return;
    }

    if (reverse.type === "session.character.restore") {
      const snapshot = reverse.snapshot;
      if (snapshot.lifecycle) {
        broadcast(this.ctx.getWebSockets(), { type: "session.character.updated", character: snapshot.lifecycle });
        if (!snapshot.lifecycle.active) {
          broadcast(this.ctx.getWebSockets(), { type: "session.character.removed", characterId: reverse.characterId });
        }
      } else {
        broadcast(this.ctx.getWebSockets(), { type: "session.character.removed", characterId: reverse.characterId });
      }
      const [abilities, hp, conditions] = await Promise.all([
        this.readAbilitiesState(),
        this.readComposedHpState(),
        this.readComposedConditionsState(),
      ]);
      broadcast(this.ctx.getWebSockets(), { type: "session.abilities.snapshot", characters: Object.values(abilities) });
      broadcast(this.ctx.getWebSockets(), { type: "session.hp.snapshot", characters: Object.values(hp) });
      broadcast(this.ctx.getWebSockets(), { type: "session.conditions.snapshot", characters: Object.values(conditions) });
      return;
    }

    if (reverse.type === "session.proficiency.restore") {
      broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: reverse.snapshot });
      return;
    }

    broadcast(this.ctx.getWebSockets(), { type: "session.abilities.updated", character: reverse.snapshot.ability });
    if ("hp" in reverse.snapshot) {
      broadcast(this.ctx.getWebSockets(), { type: "session.hp.updated", character: reverse.snapshot.hp });
    }
    if ("conditions" in reverse.snapshot) {
      broadcast(this.ctx.getWebSockets(), { type: "session.conditions.updated", character: reverse.snapshot.conditions });
    }
  }

  private async readAbilitiesState(): Promise<Record<string, SessionAbilityState>> {
    return (await this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY)) ?? {};
  }

  private async readComposedHpState(): Promise<Record<string, SessionHpState>> {
    return (await this.ctx.storage.get<Record<string, SessionHpState>>(HP_STATE_KEY)) ?? {};
  }

  private async readComposedConditionsState(): Promise<Record<string, SessionConditionsState>> {
    return (await this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY)) ?? {};
  }

  private async readInventoryState(): Promise<SharedInventoryState> {
    return (await this.ctx.storage.get<SharedInventoryState>(INVENTORY_STATE_KEY)) ?? {
      initialized: false,
      revision: 0,
      partyInventory: [],
      groundInventory: [],
    };
  }

  private async readCharacterLifecycleState(): Promise<Record<string, SessionCharacterLifecycleState>> {
    const stored = (await this.ctx.storage.get<Record<string, SessionCharacterLifecycleState>>(CHARACTER_LIFECYCLE_STATE_KEY)) ?? {};
    if (Object.keys(stored).length) return stored;

    const [abilities, hp] = await Promise.all([this.readAbilitiesState(), this.readComposedHpState()]);
    const migrated = Object.fromEntries(
      Object.values(abilities)
        .filter((entry) => entry.initialized)
        .map((entry) => [entry.characterId, {
          characterId: entry.characterId,
          character: entry.character,
          ownerUserId: hp[entry.characterId]?.ownerUserId,
          active: true,
          revision: entry.revision,
        } satisfies SessionCharacterLifecycleState]),
    );
    if (Object.keys(migrated).length) await this.ctx.storage.put(CHARACTER_LIFECYCLE_STATE_KEY, migrated);
    return migrated;
  }

  private async sendAbilitySnapshot(socket: WebSocket): Promise<void> {
    const state = await this.readAbilitiesState();
    send(socket, { type: "session.abilities.snapshot", characters: Object.values(state) });
  }

  private async sendInventorySnapshot(socket: WebSocket): Promise<void> {
    const state = await this.readInventoryState();
    send(socket, { type: "session.inventory.snapshot", state });
  }

  private async sendCharacterLifecycleSnapshot(socket: WebSocket): Promise<void> {
    const state = await this.readCharacterLifecycleState();
    send(socket, { type: "session.characters.snapshot", characters: Object.values(state) });
  }
}

function runtimeStateFromCharacter(
  character: CharacterTemplate,
  previousAbility?: SessionAbilityState,
  previousHp?: SessionHpState,
  previousConditions?: SessionConditionsState,
): { ability: SessionAbilityState; hp: SessionHpState; conditions: SessionConditionsState } {
  const characterId = character.get("id");
  const sheet = character.get("sheet");
  const rawHp = sheet.HP;
  const currentMax = getCurrentMaxHp(character);
  const hitDice = Object.fromEntries(
    Object.entries(rawHp.hitDice).flatMap(([side, pool]) =>
      pool ? [[side, { current: pool.current.quantity, max: pool.max.quantity }]] : [],
    ),
  ) as SessionHpState["hitDice"];

  return {
    ability: {
      characterId,
      character: character.toJSON() as unknown as Record<string, unknown>,
      initialized: true,
      revision: (previousAbility?.revision ?? -1) + 1,
    },
    hp: {
      characterId,
      ownerUserId: character.get("owner")?.id?.trim() || undefined,
      current: rawHp.current,
      temporary: rawHp.temporary,
      max: rawHp.max,
      currentMax,
      maxHpBonus: character.getEffectiveMaxHp() - currentMax,
      hitDice,
      stats: {
        armorClassAdjustment: sheet.stats.armorClassAdjustment ?? 0,
        initiativeAdjustment: sheet.stats.initiativeAdjustment ?? 0,
        mobilityAdjustment: sheet.stats.mobilityAdjustment ?? 0,
        passivePerceptionAdjustment: sheet.stats.passivePerceptionAdjustment ?? 0,
        exhaustion: sheet.stats.exhaustion ?? 0,
        inspiration: sheet.stats.inspiration ?? false,
        experience: sheet.stats.experience ?? 0,
      },
      statsInitialized: true,
      attributes: { ...sheet.attributes },
      attributesInitialized: true,
      savingThrows: { ...defaultSavingThrows(), ...sheet.savingThrowProficiencies },
      savingThrowsInitialized: true,
      skills: { ...defaultSkills(), ...sheet.skills },
      skillsInitialized: true,
      revision: (previousHp?.revision ?? -1) + 1,
    },
    conditions: {
      characterId,
      conditions: getCharacterConditions(character),
      initialized: true,
      revision: (previousConditions?.revision ?? -1) + 1,
    },
  };
}

function restoreOptionalEntry<T>(state: Record<string, T>, characterId: string, value?: T): void {
  if (value === undefined) delete state[characterId];
  else state[characterId] = value;
}

function isCentrallyRestorable(reverse: SessionLogRecord["reverseOperation"]): reverse is CentrallyRestorableReverse {
  return reverse.type === "character.ability.restore"
    || reverse.type === "session.rest.restore"
    || reverse.type === "session.inventory.restore"
    || reverse.type === "session.proficiency.restore"
    || reverse.type === "session.race.restore"
    || reverse.type === "session.profile.restore"
    || reverse.type === "session.character.restore";
}

function resolveMessageRoute(
  raw: string,
  routes: {
    ability: DomainActor;
    magic: DomainActor;
    equipment: DomainActor;
    inventory: DomainActor;
    proficiency: DomainActor;
    race: DomainActor;
    profile: DomainActor;
  },
): DomainActor | null {
  if (parseAbilityClientMessage(raw)) return routes.ability;
  if (parseMagicClientMessage(raw)) return routes.magic;
  if (parseEquipmentClientMessage(raw)) return routes.equipment;
  if (parseInventoryClientMessage(raw)) return routes.inventory;
  if (parseProficiencyClientMessage(raw)) return routes.proficiency;
  if (parseRaceClientMessage(raw)) return routes.race;
  if (parseProfileClientMessage(raw)) return routes.profile;
  return null;
}

function bindDomainActor<T extends DomainActor>(prototype: T, ctx: unknown): T {
  const actor = Object.create(null) as T;
  for (const key of Reflect.ownKeys(prototype)) {
    if (key === "constructor") continue;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
    if (descriptor) Object.defineProperty(actor, key, descriptor);
  }
  Object.defineProperty(actor, "ctx", {
    value: ctx,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return actor;
}

function parseUndoLogId(raw: string): string | null {
  try {
    const value = JSON.parse(raw) as { type?: unknown; logId?: unknown };
    return value.type === "session.log.undo" && typeof value.logId === "string"
      ? value.logId
      : null;
  } catch {
    return null;
  }
}

function readSessionConnection(socket: WebSocket): SessionConnection | null {
  try {
    return socket.deserializeAttachment() as SessionConnection | null;
  } catch {
    return null;
  }
}

function sendError(socket: WebSocket, code: string, message: string): void {
  send(socket, { type: "session.error", code, message });
}

function send(socket: WebSocket, value: unknown): void {
  try {
    socket.send(JSON.stringify(value));
  } catch {
    // Stale sockets are cleaned up by the base SessionActor.
  }
}

function broadcast(sockets: WebSocket[], value: unknown): void {
  const payload = JSON.stringify(value);
  for (const socket of sockets) {
    try { socket.send(payload); } catch {}
  }
}

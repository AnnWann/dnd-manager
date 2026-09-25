import { DurableObject } from "cloudflare:workers";
import {
  applyConditionOperation,
  normalizeConditionsSeed,
} from "../characters/sheet/conditionState";
import {
  applyConcentrationOperation,
  isConcentrationCondition,
} from "../characters/sheet/concentrationState";
import {
  applyCharacterStateOperation,
  defaultAttributes,
  defaultSavingThrows,
  defaultSkills,
  defaultStats,
  MAX_CHARACTER_STATE_LOG_RECORDS,
  normalizeAttributesSeed,
  normalizeCharacterStateSeed,
  normalizeSavingThrowsSeed,
  normalizeSkillsSeed,
  normalizeStatsSeed,
} from "../characters/sheet/characterState";
import type { SessionAbilityState } from "../characters/abilities/abilityProtocol";
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../../src/models/characters/CharacterTemplate";
import { getCurrentMaxHp } from "../../../../src/models/characters/characterHp";
import { getCharacterGrantedSpells } from "../../../../src/models/characters/characterGrantedSpells";
import { hasProficiency } from "../../../../src/models/characters/characterProficiencies";
import { getUnarmedAttackProfile } from "../../../../src/models/characters/unarmedAttack";
import {
  getWeaponAttackAttribute,
  getWeaponDamageDie,
  isWeaponImprovisedGrip,
  type Weapon,
} from "../../../../src/models/items/equipment/Weapon";
import type { Attribute } from "../../../../src/models/sheet/Attribute";
import type { Skill } from "../../../../src/models/sheet/Skills";
import {
  getCharacterConditions,
  withCharacterConditions,
} from "../../../../src/models/characters/characterConditionStorage";
import { takeShortRest } from "../../../../src/models/characters/characterRest";
import {
  takeLongRest,
  takePartialLongRest,
} from "../../../../src/models/characters/characterRestWithSorcery";
import { runCustomSystemAutomations } from "../../../../src/lib/customSystems/CustomAutomationRuntime";
import type { CustomSystemDefinition } from "../../../../src/models/customSystems/CustomSystemDefinition";
import type { Itemmable } from "../../../../src/models/items/item";
import {
  consumeSelectedSupplies,
  getRequiredSupplyForRace,
  type LongRestSupplySelection,
} from "../../../../src/models/supplies/partySupply";
import {
  encodeServerSessionMessage,
  parseClientSessionMessage,
  type ServerSessionMessage,
  type SessionConditionOperation,
  type SessionConditionSeed,
  type SessionConcentrationOperation,
  type SessionConditionsState,
  type SessionConnection,
  type SessionDieSides,
  type SessionHpLogRecord,
  type SessionHpSeed,
  type SessionHpState,
  type SessionPresenceUser,
  type SessionRestOperation,
} from "./protocol";
import {
  SHARED_INVENTORY_SCOPE,
  characterScope,
  commitSessionMutation,
  createSessionLogRecord,
  readSessionLog,
  type SessionLogRecord,
} from "./sessionLog";
import { readRuntimeConfig } from "./runtimeConfigAccess";
import type { SessionRuntimeConfigSnapshot } from "../../../../src/shared/session-runtime/sessionRuntimeConfig";
import type { SessionActionRollRequest, SessionActionRollResult, SessionDiceRollRequest, SessionDiceRollResult, SessionResolvedD20Roll, SessionResolvedDamageRoll } from "../../../../src/shared/session-runtime/diceRollProtocol";
import {
  broadcastVisibilityFiltered,
  refreshConnectionVisibility,
  sendVisibilityFiltered,
} from "./visibilityDelivery";

const CONNECTION_TIMEOUT_MS = 90_000;
const CLOSE_CODE_TIMEOUT = 4000;
const CLOSE_CODE_REPLACED = 4001;
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";
const ABILITIES_STATE_KEY = "abilities-state";
const INVENTORY_STATE_KEY = "inventory-state";

type StoredSessionHpState = SessionHpState & {
  /** Distinguishes an old HP-only state from an intentionally empty hit-dice state. */
  hitDiceInitialized?: boolean;
};

type SharedInventoryState = {
  initialized: boolean;
  revision: number;
  partyInventory: unknown[];
  groundInventory: unknown[];
};

export class SessionActor extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade.", { status: 426 });
    }
    const connection = this.readConnectionHeaders(request);
    if (!connection) return new Response("Invalid session connection metadata.", { status: 400 });

    this.replaceExistingClientConnection(connection.clientId);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment(connection);
    this.ctx.acceptWebSocket(server);
    refreshConnectionVisibility(server, await readRuntimeConfig(this.ctx.storage));

    this.send(server, { type: "session.ready", sessionId: connection.sessionId, clientId: connection.clientId, serverTime: Date.now() });
    await Promise.all([this.sendHpSnapshot(server), this.sendConditionsSnapshot(server)]);
    if (connection.role === "MASTER") await this.sendHpLog(server);
    this.broadcastPresence();
    await this.scheduleNextAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = parseClientSessionMessage(raw);
    if (!parsed) {
      this.sendError(webSocket, "INVALID_MESSAGE", "Unsupported or malformed session message.");
      return;
    }

    const connection = this.getConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    if (parsed.type === "session.heartbeat" && parsed.clientId !== connection.clientId) {
      this.sendError(webSocket, "CLIENT_ID_MISMATCH", "Heartbeat clientId does not match this connection.");
      return;
    }

    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    switch (parsed.type) {
      case "session.heartbeat":
        this.send(webSocket, { type: "session.heartbeat.ack", serverTime: Date.now() });
        break;
      case "session.ping":
        this.send(webSocket, { type: "session.pong", serverTime: Date.now() });
        break;
      case "session.hp.initialize":
        await this.initializeHp(webSocket, connection, parsed.characters);
        break;
      case "session.hp.operation":
        await this.handleHpOperation(webSocket, connection, parsed.operation);
        break;
      case "session.conditions.initialize":
        await this.initializeConditions(webSocket, connection, parsed.characters);
        break;
      case "session.conditions.operation":
        await this.handleConditionOperation(webSocket, connection, parsed.operation);
        break;
      case "session.sheet.operation":
        if (
          parsed.operation.type.startsWith("character.condition.") ||
          parsed.operation.type.startsWith("character.concentration.")
        ) {
          await this.handleConditionOperation(
            webSocket,
            connection,
            parsed.operation as SessionConditionOperation | SessionConcentrationOperation,
          );
        } else {
          await this.handleHpOperation(
            webSocket,
            connection,
            parsed.operation as Parameters<typeof applyCharacterStateOperation>[1],
          );
        }
        break;
      case "session.dice.roll":
        await this.handleDiceRoll(webSocket, connection, parsed.request);
        break;
      case "session.action.roll":
        await this.handleActionRoll(webSocket, connection, parsed.request);
        break;
      case "session.log.undo":
        this.sendError(webSocket, "UNDO_ROUTING_ERROR", "Session undo must be handled by the composed session actor.");
        break;
    }
    await this.scheduleNextAlarm();
  }

  async webSocketClose(): Promise<void> {
    this.broadcastPresence();
    await this.scheduleNextAlarm();
  }

  async webSocketError(webSocket: WebSocket): Promise<void> {
    try { webSocket.close(1011, "WebSocket error"); }
    finally {
      this.broadcastPresence();
      await this.scheduleNextAlarm();
    }
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    for (const webSocket of this.ctx.getWebSockets()) {
      const connection = this.getConnection(webSocket);
      if (!connection) {
        webSocket.close(1011, "Missing connection attachment");
        continue;
      }
      if (now - connection.lastHeartbeatAt >= CONNECTION_TIMEOUT_MS) {
        webSocket.close(CLOSE_CODE_TIMEOUT, "Session heartbeat timeout");
      }
    }
    this.broadcastPresence(now);
    await this.scheduleNextAlarm(now);
  }

  private async handleActionRoll(
    webSocket: WebSocket,
    connection: SessionConnection,
    request: SessionActionRollRequest,
  ): Promise<void> {
    const [hpState, abilities, conditionsState, runtimeConfig] = await Promise.all([
      this.readHpState(),
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.readConditionsState(),
      readRuntimeConfig(this.ctx.storage),
    ]);
    const hp = hpState[request.characterId];
    const ability = abilities[request.characterId];
    const conditions = conditionsState[request.characterId];

    if (!hp || !ability?.initialized || !conditions?.initialized) {
      this.sendError(webSocket, "CHARACTER_NOT_INITIALIZED", "Authoritative character state has not been initialized.");
      return;
    }
    if (connection.role !== "MASTER" && hp.ownerUserId !== connection.userId) {
      this.sendError(webSocket, "CHARACTER_ACCESS_DENIED", "You cannot roll for this character.");
      return;
    }

    let character: CharacterTemplate;
    try {
      character = hydrateCharacterForRest(ability, hp, conditions);
    } catch {
      this.sendError(webSocket, "CHARACTER_STATE_INVALID", "The authoritative character snapshot is invalid.");
      return;
    }

    let resolved: ActionResolution;
    try {
      resolved = resolveServerActionRoll(request, connection.userId, character, runtimeConfig);
    } catch {
      this.sendError(webSocket, "ACTION_ROLL_RESOLUTION_FAILED", "The authoritative action roll could not be resolved.");
      return;
    }
    if (!resolved.ok) {
      this.sendError(webSocket, resolved.code, resolved.message);
      return;
    }

    this.broadcast({ type: "session.action.result", result: resolved.result });
  }

  private async handleDiceRoll(
    webSocket: WebSocket,
    connection: SessionConnection,
    request: SessionDiceRollRequest,
  ): Promise<void> {
    const [hpState, abilities, conditionsState] = await Promise.all([
      this.readHpState(),
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.readConditionsState(),
    ]);
    const hp = hpState[request.characterId];
    const ability = abilities[request.characterId];
    const conditions = conditionsState[request.characterId];

    if (!hp || !ability?.initialized || !conditions?.initialized) {
      this.sendError(webSocket, "CHARACTER_NOT_INITIALIZED", "Authoritative character state has not been initialized.");
      return;
    }
    if (connection.role !== "MASTER" && hp.ownerUserId !== connection.userId) {
      this.sendError(webSocket, "CHARACTER_ACCESS_DENIED", "You cannot roll for this character.");
      return;
    }

    let character: CharacterTemplate;
    try {
      character = hydrateCharacterForRest(ability, hp, conditions);
    } catch {
      this.sendError(webSocket, "CHARACTER_STATE_INVALID", "The authoritative character snapshot is invalid.");
      return;
    }

    let resolved: DiceResolution;
    try {
      resolved = resolveServerDiceRoll(request, connection.userId, character);
    } catch {
      this.sendError(webSocket, "ROLL_RESOLUTION_FAILED", "The authoritative roll could not be resolved.");
      return;
    }
    if (!resolved.ok) {
      this.sendError(webSocket, resolved.code, resolved.message);
      return;
    }

    this.broadcast({ type: "session.dice.result", result: resolved.result });
  }

  private async initializeHp(webSocket: WebSocket, connection: SessionConnection, seeds: SessionHpSeed[]): Promise<void> {
    if (connection.role !== "MASTER") {
      this.sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can initialize authoritative character state.");
      return;
    }

    const state = await this.readHpState();
    let changed = false;
    for (const seed of seeds) {
      const normalized = normalizeCharacterStateSeed(seed);
      const existing = state[seed.characterId];
      if (!existing) {
        state[seed.characterId] = { ...normalized, hitDiceInitialized: seed.hitDice !== undefined };
        changed = true;
        continue;
      }

      let next = existing;
      let entryChanged = false;
      if (existing.hitDiceInitialized !== true && seed.hitDice !== undefined) {
        const nextHitDice = { ...(existing.hitDice ?? {}) };
        for (const [side, pool] of Object.entries(normalized.hitDice)) {
          const typedSide = side as SessionDieSides;
          if (!pool || nextHitDice[typedSide]) continue;
          nextHitDice[typedSide] = pool;
        }
        next = { ...next, hitDice: nextHitDice, hitDiceInitialized: true };
        entryChanged = true;
      }
      if (existing.statsInitialized !== true && seed.stats !== undefined) {
        next = { ...next, stats: normalizeStatsSeed(seed.stats), statsInitialized: true };
        entryChanged = true;
      }
      if (existing.attributesInitialized !== true && seed.attributes !== undefined) {
        next = { ...next, attributes: normalizeAttributesSeed(seed.attributes), attributesInitialized: true };
        entryChanged = true;
      }
      if (existing.savingThrowsInitialized !== true && seed.savingThrows !== undefined) {
        next = { ...next, savingThrows: normalizeSavingThrowsSeed(seed.savingThrows), savingThrowsInitialized: true };
        entryChanged = true;
      }
      if (existing.skillsInitialized !== true && seed.skills !== undefined) {
        next = { ...next, skills: normalizeSkillsSeed(seed.skills), skillsInitialized: true };
        entryChanged = true;
      }
      if (entryChanged) {
        state[seed.characterId] = next;
        changed = true;
      }
    }

    if (changed) {
      await this.ctx.storage.put(HP_STATE_KEY, state);
      await this.broadcastHpSnapshot();
    } else {
      await this.sendHpSnapshot(webSocket);
    }
  }

  private async initializeConditions(webSocket: WebSocket, connection: SessionConnection, seeds: SessionConditionSeed[]): Promise<void> {
    if (connection.role !== "MASTER") {
      this.sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can initialize authoritative conditions.");
      return;
    }
    const state = await this.readConditionsState();
    let changed = false;
    for (const seed of seeds) {
      const existing = state[seed.characterId];
      if (existing?.initialized) continue;
      state[seed.characterId] = normalizeConditionsSeed(seed.characterId, seed.conditions);
      changed = true;
    }
    if (changed) {
      await this.ctx.storage.put(CONDITIONS_STATE_KEY, state);
      await this.broadcastConditionsSnapshot();
    } else {
      await this.sendConditionsSnapshot(webSocket);
    }
  }

  private async handleHpOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: Parameters<typeof applyCharacterStateOperation>[1],
  ): Promise<void> {
    if (operation.type === "character.rest.short" || operation.type === "character.rest.long") {
      await this.handleRestOperation(webSocket, connection, operation);
      return;
    }

    const [state, conditionsState, abilities, runtimeConfig, log] = await Promise.all([
      this.readHpState(),
      this.readConditionsState(),
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      readRuntimeConfig(this.ctx.storage),
      readSessionLog(this.ctx.storage),
    ]);
    const current = state[operation.characterId];
    if (!current) {
      this.sendError(webSocket, "HP_NOT_INITIALIZED", "Authoritative state for this character has not been initialized by the MASTER.");
      return;
    }

    let effectiveOperation = operation;
    if (operation.type === "character.hp.damage") {
      const concentration = conditionsState[operation.characterId]?.conditions.find(isConcentrationCondition);
      effectiveOperation = {
        ...operation,
        requiresConcentrationCheck: Boolean(concentration),
        concentrationDc: concentration ? Math.max(10, Math.floor(operation.amount / 2)) : undefined,
        concentrationSource: concentration?.source || undefined,
      };
    }

    const result = applyCharacterStateOperation(current, effectiveOperation, connection);
    if (!result.ok) {
      this.sendError(webSocket, result.code, result.message);
      return;
    }

    const storedNext: StoredSessionHpState = {
      ...result.next,
      hitDiceInitialized: current.hitDiceInitialized ?? true,
    };
    state[operation.characterId] = storedNext;

    const event = operation.type === "character.hp.damage"
      ? "damageTaken"
      : operation.type === "character.hp.heal"
        ? "healingReceived"
        : null;
    const storedAbility = abilities[operation.characterId];
    const currentConditions = conditionsState[operation.characterId];
    let automationAbility: SessionAbilityState | null = null;
    let record = result.record as unknown as SessionLogRecord;

    if (event && storedAbility?.initialized && currentConditions?.initialized && runtimeConfig) {
      try {
        const hydrated = hydrateCharacterForRest(storedAbility, storedNext, currentConditions);
        const definitions = runtimeDefinitionsForCharacter(
          hydrated,
          runtimeConfig,
          operation.characterId,
        );
        const automationResult = runCustomSystemAutomations(hydrated, definitions, event);
        if (automationResult.applied.length) {
          const nextCharacter = automationResult.character;
          automationAbility = {
            characterId: operation.characterId,
            character: nextCharacter.toJSON() as unknown as Record<string, unknown>,
            initialized: true,
            revision: storedAbility.revision + 1,
          };
          abilities[operation.characterId] = automationAbility;
          record = createSessionLogRecord({
            actorId: connection.userId,
            operation: result.record.operation as unknown as SessionLogRecord["operation"],
            reverseOperation: {
              type: "character.ability.restore",
              characterId: operation.characterId,
              snapshot: {
                ability: structuredClone(storedAbility),
                hp: structuredClone(current),
                conditions: structuredClone(currentConditions),
              },
            },
          });
        }
      } catch (error) {
        this.sendError(
          webSocket,
          "CUSTOM_AUTOMATION_REJECTED",
          error instanceof Error ? error.message : "A custom automation triggered by this HP operation failed.",
        );
        return;
      }
    }

    const writes: Record<string, unknown> = { [HP_STATE_KEY]: state };
    if (automationAbility) writes[ABILITIES_STATE_KEY] = abilities;
    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes,
      record,
      currentLog: log,
      maxRecords: MAX_CHARACTER_STATE_LOG_RECORDS,
    });
    this.broadcast({ type: "session.hp.updated", character: result.next });
    if (automationAbility) {
      this.broadcastSessionRaw({ type: "session.abilities.updated", character: automationAbility });
    }
  }

  private async handleRestOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionRestOperation,
  ): Promise<void> {
    const [abilities, hpState, conditionsState, inventory, runtimeConfig, log] = await Promise.all([
      this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY).then((value) => value ?? {}),
      this.readHpState(),
      this.readConditionsState(),
      this.readRestInventoryState(),
      readRuntimeConfig(this.ctx.storage),
      readSessionLog(this.ctx.storage),
    ]);

    const storedAbility = abilities[operation.characterId];
    const currentHp = hpState[operation.characterId];
    const currentConditions = conditionsState[operation.characterId];
    if (!storedAbility?.initialized || !currentHp || !currentConditions?.initialized) {
      this.sendError(webSocket, "REST_STATE_NOT_INITIALIZED", "All authoritative character state must be initialized before resting.");
      return;
    }
    if (connection.role !== "MASTER" && currentHp.ownerUserId !== connection.userId) {
      this.sendError(webSocket, "CHARACTER_ACCESS_DENIED", "You cannot rest this character.");
      return;
    }

    let current: CharacterTemplate;
    try {
      current = hydrateCharacterForRest(storedAbility, currentHp, currentConditions);
    } catch {
      this.sendError(webSocket, "REST_STATE_INVALID", "The authoritative character snapshot is invalid.");
      return;
    }

    const restDefinitions = runtimeConfig
      ? runtimeDefinitionsForCharacter(current, runtimeConfig, operation.characterId)
      : [];

    let next: CharacterTemplate;
    let nextInventory = inventory;
    let canonicalOperation: SessionLogRecord["operation"] = operation;
    let reverseOperation: SessionLogRecord["reverseOperation"];
    let affectedScopes: string[] | undefined;

    if (operation.type === "character.rest.short") {
      if (!Number.isInteger(operation.healing) || operation.healing < 0) {
        this.sendError(webSocket, "INVALID_SHORT_REST_HEALING", "Short-rest healing must be a non-negative integer.");
        return;
      }
      for (const [side, requested] of Object.entries(operation.hitDiceConsumption)) {
        const amount = Math.trunc(Number(requested) || 0);
        const pool = currentHp.hitDice[side as SessionDieSides];
        if (amount < 0 || amount > (pool?.current ?? 0)) {
          this.sendError(webSocket, "INSUFFICIENT_HIT_DICE", `Invalid ${side} hit-dice consumption for this short rest.`);
          return;
        }
      }
      next = takeShortRest(current, operation.healing, operation.hitDiceConsumption as any, restDefinitions);
      reverseOperation = {
        type: "session.rest.restore",
        characterId: operation.characterId,
        snapshot: {
          ability: structuredClone(storedAbility),
          hp: structuredClone(currentHp),
          conditions: structuredClone(currentConditions),
        },
      };
    } else {
      const supplied = operation.selection;
      if (!isLongRestSelection(supplied)) {
        this.sendError(webSocket, "INVALID_LONG_REST_SUPPLIES", "Long rests require a valid server-verifiable supply selection.");
        return;
      }
      const consumption = consumeSelectedSupplies(inventory.partyInventory as Itemmable[], supplied);
      if (!consumption.valid) {
        this.sendError(webSocket, "INVALID_LONG_REST_SUPPLIES", "The selected supplies are no longer available in the shared inventory.");
        return;
      }
      const required = getRequiredSupplyForRace(current.get("sheet").race);
      const recovery = consumption.selectedPortions + 0.000001 < required ? "partial" : "full";
      next = recovery === "partial" ? takePartialLongRest(current, restDefinitions) : takeLongRest(current, restDefinitions);
      nextInventory = {
        ...inventory,
        initialized: true,
        revision: inventory.revision + 1,
        partyInventory: consumption.items,
      };
      canonicalOperation = { ...operation, recovery };
      reverseOperation = {
        type: "session.rest.restore",
        characterId: operation.characterId,
        snapshot: {
          ability: structuredClone(storedAbility),
          hp: structuredClone(currentHp),
          conditions: structuredClone(currentConditions),
          inventory: structuredClone(inventory),
        },
      };
      affectedScopes = [characterScope(operation.characterId), SHARED_INVENTORY_SCOPE];
    }

    if (runtimeConfig) {
      try {
        next = runCustomSystemAutomations(
          next,
          restDefinitions,
          operation.type === "character.rest.short" ? "shortRestCompleted" : "longRestCompleted",
        ).character;
      } catch (error) {
        this.sendError(
          webSocket,
          "CUSTOM_AUTOMATION_REJECTED",
          error instanceof Error ? error.message : "A custom automation triggered by this rest failed.",
        );
        return;
      }
    }

    const nextAbility: SessionAbilityState = {
      characterId: operation.characterId,
      character: next.toJSON() as unknown as Record<string, unknown>,
      initialized: true,
      revision: storedAbility.revision + 1,
    };
    const nextHp = sessionHpFromCharacter(next, currentHp);
    const nextConditions: SessionConditionsState = {
      characterId: operation.characterId,
      conditions: getCharacterConditions(next) as any,
      initialized: true,
      revision: currentConditions.revision + 1,
    };

    abilities[operation.characterId] = nextAbility;
    hpState[operation.characterId] = { ...nextHp, hitDiceInitialized: true };
    conditionsState[operation.characterId] = nextConditions;

    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation: canonicalOperation,
      reverseOperation,
      affectedScopes,
    });
    const writes: Record<string, unknown> = {
      [ABILITIES_STATE_KEY]: abilities,
      [HP_STATE_KEY]: hpState,
      [CONDITIONS_STATE_KEY]: conditionsState,
    };
    if (operation.type === "character.rest.long") writes[INVENTORY_STATE_KEY] = nextInventory;

    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes,
      record,
      currentLog: log,
      maxRecords: MAX_CHARACTER_STATE_LOG_RECORDS,
    });

    this.broadcastSessionRaw({ type: "session.abilities.updated", character: nextAbility });
    this.broadcast({ type: "session.hp.updated", character: nextHp });
    this.broadcast({ type: "session.conditions.updated", character: nextConditions });
    if (operation.type === "character.rest.long") {
      this.broadcastSessionRaw({ type: "session.inventory.updated", state: nextInventory });
    }
  }

  private async handleConditionOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionConditionOperation | SessionConcentrationOperation,
  ): Promise<void> {
    const [hpState, conditionsState, log] = await Promise.all([
      this.readHpState(),
      this.readConditionsState(),
      readSessionLog(this.ctx.storage),
    ]);
    const hp = hpState[operation.characterId];
    if (!hp) {
      this.sendError(webSocket, "CHARACTER_NOT_INITIALIZED", "Authoritative character state has not been initialized by the MASTER.");
      return;
    }
    const current = conditionsState[operation.characterId];
    if (!current?.initialized) {
      this.sendError(webSocket, "CONDITIONS_NOT_INITIALIZED", "Authoritative conditions for this character are missing.");
      return;
    }

    const result = operation.type.startsWith("character.concentration.")
      ? applyConcentrationOperation(current, operation as SessionConcentrationOperation, connection, hp.ownerUserId)
      : applyConditionOperation(current, operation as SessionConditionOperation, connection, hp.ownerUserId);
    if (!result.ok) {
      this.sendError(webSocket, result.code, result.message);
      return;
    }

    conditionsState[operation.characterId] = result.next;
    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [CONDITIONS_STATE_KEY]: conditionsState },
      record: result.record as unknown as SessionLogRecord,
      currentLog: log,
      maxRecords: MAX_CHARACTER_STATE_LOG_RECORDS,
    });
    this.broadcast({ type: "session.conditions.updated", character: result.next });
  }

  private async readHpState(): Promise<Record<string, StoredSessionHpState>> {
    const raw = (await this.ctx.storage.get<Record<string, StoredSessionHpState>>(HP_STATE_KEY)) ?? {};
    return Object.fromEntries(
      Object.entries(raw).map(([id, state]) => [id, {
        ...state,
        hitDice: state.hitDice ?? {},
        stats: state.stats ?? defaultStats(),
        statsInitialized: state.statsInitialized ?? false,
        attributes: state.attributes ?? defaultAttributes(),
        attributesInitialized: state.attributesInitialized ?? false,
        savingThrows: state.savingThrows ?? defaultSavingThrows(),
        savingThrowsInitialized: state.savingThrowsInitialized ?? false,
        skills: state.skills ?? defaultSkills(),
        skillsInitialized: state.skillsInitialized ?? false,
      }]),
    );
  }

  private async readConditionsState(): Promise<Record<string, SessionConditionsState>> {
    return (await this.ctx.storage.get<Record<string, SessionConditionsState>>(CONDITIONS_STATE_KEY)) ?? {};
  }

  private async readRestInventoryState(): Promise<SharedInventoryState> {
    return (await this.ctx.storage.get<SharedInventoryState>(INVENTORY_STATE_KEY)) ?? {
      initialized: false,
      revision: 0,
      partyInventory: [],
      groundInventory: [],
    };
  }

  private async sendHpSnapshot(webSocket: WebSocket): Promise<void> {
    const state = await this.readHpState();
    this.send(webSocket, { type: "session.hp.snapshot", characters: Object.values(state) });
  }

  private async broadcastHpSnapshot(): Promise<void> {
    const state = await this.readHpState();
    this.broadcast({ type: "session.hp.snapshot", characters: Object.values(state) });
  }

  private async sendConditionsSnapshot(webSocket: WebSocket): Promise<void> {
    const state = await this.readConditionsState();
    this.send(webSocket, { type: "session.conditions.snapshot", characters: Object.values(state) });
  }

  private async broadcastConditionsSnapshot(): Promise<void> {
    const state = await this.readConditionsState();
    this.broadcast({ type: "session.conditions.snapshot", characters: Object.values(state) });
  }

  private async sendHpLog(webSocket: WebSocket): Promise<void> {
    const records = await readSessionLog(this.ctx.storage);
    this.send(webSocket, {
      type: "session.hp.log",
      records: records as unknown as SessionHpLogRecord[],
    });
  }

  private readConnectionHeaders(request: Request): SessionConnection | null {
    const sessionId = request.headers.get("x-session-id")?.trim();
    const clientId = request.headers.get("x-session-client-id")?.trim();
    const userId = request.headers.get("x-session-user-id")?.trim();
    const userName = request.headers.get("x-session-user-name")?.trim() || undefined;
    const role = request.headers.get("x-session-role")?.trim();
    const expiresAt = Number(request.headers.get("x-session-expires-at"));
    if (!sessionId || !clientId || !userId || (role !== "MASTER" && role !== "PLAYER") || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    const now = Date.now();
    return { sessionId, clientId, userId, userName, role, connectedAt: now, lastHeartbeatAt: now };
  }

  private replaceExistingClientConnection(clientId: string): void {
    for (const webSocket of this.ctx.getWebSockets()) {
      const connection = this.getConnection(webSocket);
      if (connection?.clientId === clientId) webSocket.close(CLOSE_CODE_REPLACED, "Connection replaced by reconnect");
    }
  }

  private getConnection(webSocket: WebSocket): SessionConnection | null {
    try { return webSocket.deserializeAttachment() as SessionConnection; }
    catch { return null; }
  }

  private sendError(webSocket: WebSocket, code: string, message: string): void {
    this.send(webSocket, { type: "session.error", code, message });
  }

  private send(webSocket: WebSocket, message: ServerSessionMessage): void {
    sendVisibilityFiltered(webSocket, message);
  }

  private broadcast(message: ServerSessionMessage): void {
    broadcastVisibilityFiltered(this.activeSockets(), message);
  }

  private broadcastSessionRaw(message: unknown): void {
    broadcastVisibilityFiltered(this.activeSockets(), message);
  }

  private activeSockets(now = Date.now()): WebSocket[] {
    return this.ctx.getWebSockets().filter((webSocket) => {
      const connection = this.getConnection(webSocket);
      return connection !== null && now - connection.lastHeartbeatAt < CONNECTION_TIMEOUT_MS;
    });
  }

  private broadcastPresence(now = Date.now()): void {
    const activeSockets = this.activeSockets(now);
    const users: SessionPresenceUser[] = activeSockets.flatMap((webSocket) => {
      const connection = this.getConnection(webSocket);
      return connection ? [{ userId: connection.userId, userName: connection.userName, clientId: connection.clientId, role: connection.role }] : [];
    });
    const payload = encodeServerSessionMessage({ type: "session.presence", users });
    for (const webSocket of activeSockets) {
      try { webSocket.send(payload); } catch {}
    }
  }

  private async scheduleNextAlarm(now = Date.now()): Promise<void> {
    let nextDeadline: number | null = null;
    for (const webSocket of this.ctx.getWebSockets()) {
      const connection = this.getConnection(webSocket);
      if (!connection) continue;
      const deadline = connection.lastHeartbeatAt + CONNECTION_TIMEOUT_MS;
      if (deadline <= now) continue;
      if (nextDeadline === null || deadline < nextDeadline) nextDeadline = deadline;
    }
    if (nextDeadline === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(nextDeadline);
  }
}

type ActionResolution =
  | { ok: true; result: SessionActionRollResult }
  | { ok: false; code: string; message: string };

function resolveServerActionRoll(
  request: SessionActionRollRequest,
  actorId: string,
  character: CharacterTemplate,
  runtimeConfig: SessionRuntimeConfigSnapshot | null,
): ActionResolution {
  const base = {
    id: crypto.randomUUID(),
    requestId: request.requestId,
    actorId,
    characterId: request.characterId,
    createdAt: new Date().toISOString(),
  };

  if (request.source.type === "weapon") {
    const weapon = findEquippedWeapon(character, request.source.weaponId);
    if (!weapon) return missingWeapon();

    const attribute = getWeaponAttackAttribute(weapon);
    const proficiency = weapon.proficient && !isWeaponImprovisedGrip(weapon)
      ? character.getProficiencyBonus()
      : 0;
    const attack = rollActionD20(
      request.mode,
      character.getEffectiveWeaponAttackBonus(
        weapon,
        character.getEffectiveAttributeModifier(attribute) + proficiency,
      ),
    );
    const critical = attack.natural === 20;
    const die = getWeaponDamageDie(weapon) ?? weapon.damage;
    const damage = rollActionDamage(
      [{ quantity: Math.max(1, Math.trunc(die.quantity) || 1), sides: parseDieSides(die.sides) }],
      character.getEffectiveWeaponDamageBonus(
        weapon,
        character.getEffectiveAttributeModifier(attribute),
      ),
      critical,
    );

    return {
      ok: true,
      result: {
        ...base,
        sourceType: "weapon",
        title: weapon.name || "Arma",
        subtitle: isWeaponImprovisedGrip(weapon) ? "Ataque com arma improvisada" : "Ataque com arma",
        description: joinDescription(weapon.desc, weapon.notes),
        details: [
          `Atributo: ${attribute.toUpperCase()}`,
          ...(weapon.properties ?? []).map((property) => property.name),
        ],
        attack,
        damage,
        critical,
      },
    };
  }

  if (request.source.type === "unarmed") {
    const profile = getUnarmedAttackProfile(character);
    const attack = rollActionD20(request.mode, profile.attack);
    const critical = attack.natural === 20;
    const groups = profile.damageDie
      ? [{
          quantity: Math.max(1, Math.trunc(profile.damageDie.quantity) || 1),
          sides: parseDieSides(profile.damageDie.sides),
        }]
      : [];
    const damage = rollActionDamage(
      groups,
      profile.damageDie ? profile.damageBonus : 1 + profile.damageBonus,
      critical,
    );

    return {
      ok: true,
      result: {
        ...base,
        sourceType: "unarmed",
        title: "Ataque desarmado",
        subtitle: profile.monkLevel > 0 ? `Ataque desarmado · Monge ${profile.monkLevel}` : "Ataque desarmado",
        description: "Ataque corpo a corpo realizado sem uma arma equipada.",
        attack,
        damage,
        critical,
      },
    };
  }

  if (request.source.type === "ability") {
    const ability = character.getCharacterAbilities().find((candidate) =>
      candidate.id === request.source.abilityId
      || candidate.originalAbilityId === request.source.abilityId
    );
    if (!ability) {
      return { ok: false, code: "ABILITY_NOT_FOUND", message: "The requested ability is not available to this character." };
    }
    return {
      ok: true,
      result: {
        ...base,
        sourceType: "ability",
        title: ability.name || "Habilidade",
        subtitle: ability.actionKind ? `Habilidade · ${ability.actionKind}` : "Habilidade",
        description: ability.description?.trim() || undefined,
        details: ability.trigger ? [`Gatilho: ${ability.trigger}`] : undefined,
        critical: false,
      },
    };
  }

  if (!runtimeConfig) {
    return { ok: false, code: "RUNTIME_CONFIG_NOT_INITIALIZED", message: "Session spell configuration is not available." };
  }

  const spell = runtimeConfig.config.spells.find((candidate) => candidate.index === request.source.spellIndex);
  if (!spell) {
    return { ok: false, code: "SPELL_NOT_FOUND", message: "The requested spell is not available in this session." };
  }
  const knownSource = character.get("magic")?.spells.knownSpells.find((entry) =>
    entry.spells.id === spell.index && entry.source.sourceId === request.source.sourceId
  )?.source;
  const grantedSource = getCharacterGrantedSpells(character).find((entry) =>
    entry.index === spell.index && entry.source.sourceId === request.source.sourceId
  )?.source;
  const source = knownSource ?? grantedSource;
  if (!source) {
    return { ok: false, code: "SPELL_SOURCE_NOT_FOUND", message: "The requested spell source is not available to this character." };
  }

  const attribute = source.attribute;
  const modifier = character.getEffectiveAttributeModifier(attribute);
  const attack = spell.targeting.hasAttackRoll
    ? rollActionD20(
        request.mode,
        character.getEffectiveSpellAttackBonus(
          attribute,
          modifier + character.getProficiencyBonus(),
        ),
      )
    : undefined;
  const critical = attack?.natural === 20;
  const save = spell.targeting.hasSavingThrow && spell.targeting.savingThrowAttribute
    ? {
        attribute: spell.targeting.savingThrowAttribute,
        dc: character.getEffectiveSpellSaveDc(
          attribute,
          8 + modifier + character.getProficiencyBonus(),
        ),
      }
    : undefined;
  const damage = spell.damageDice
    ? rollActionDamage(
        [{
          quantity: Math.max(1, Math.trunc(spell.damageDice.quantity) || 1),
          sides: parseDieSides(spell.damageDice.sides),
        }],
        character.getEffectiveSpellDamageBonus(attribute, 0),
        Boolean(critical),
      )
    : undefined;

  return {
    ok: true,
    result: {
      ...base,
      sourceType: "spell",
      title: spell.displayName || spell.name,
      subtitle: `${spell.slotLevel === 0 ? "Truque" : `Magia de nível ${spell.slotLevel}`} · ${source.name}`,
      description: joinDescription(
        spell.description,
        spell.higherLevelText?.trim()
          ? `Em níveis superiores: ${spell.higherLevelText}`
          : undefined,
      ),
      details: [
        `Atributo de conjuração: ${attribute.toUpperCase()}`,
        ...(spell.concentration ? ["Concentração"] : []),
        ...(spell.ritual ? ["Ritual"] : []),
      ],
      attack,
      save,
      damage,
      critical: Boolean(critical),
    },
  };
}

function rollActionD20(
  mode: SessionDiceRollResult["mode"],
  modifier: number,
): SessionResolvedD20Roll {
  const rolls = mode === "normal"
    ? [rollServerDie(20)]
    : [rollServerDie(20), rollServerDie(20)];
  const kept = mode === "advantage"
    ? Math.max(...rolls)
    : mode === "disadvantage"
      ? Math.min(...rolls)
      : rolls[0];
  return {
    mode,
    groups: [{ quantity: rolls.length, sides: 20, rolls, kept }],
    modifier,
    total: kept + modifier,
    natural: kept,
  };
}

function rollActionDamage(
  groups: Array<{ quantity: number; sides: number }>,
  modifier: number,
  critical: boolean,
): SessionResolvedDamageRoll {
  const resolvedGroups = groups.map((group) => {
    const quantity = critical ? group.quantity * 2 : group.quantity;
    return {
      quantity,
      sides: group.sides,
      rolls: Array.from({ length: quantity }, () => rollServerDie(group.sides)),
    };
  });
  const diceTotal = resolvedGroups.reduce(
    (sum, group) => sum + group.rolls.reduce((groupSum, value) => groupSum + value, 0),
    0,
  );
  return {
    groups: resolvedGroups,
    modifier,
    total: diceTotal + modifier,
    critical,
  };
}

function joinDescription(...parts: Array<string | undefined>): string | undefined {
  const content = parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  return content.length ? content.join("\n\n") : undefined;
}

type DiceResolution =
  | { ok: true; result: SessionDiceRollResult }
  | { ok: false; code: string; message: string };

type DicePlan = {
  kind: SessionDiceRollResult["kind"];
  mode: SessionDiceRollResult["mode"];
  groups: Array<{ quantity: number; sides: number }>;
  modifier: number;
};

function resolveServerDiceRoll(
  request: SessionDiceRollRequest,
  actorId: string,
  character: CharacterTemplate,
): DiceResolution {
  const plan = buildAuthoritativeDicePlan(request, character);
  if (!plan.ok) return plan;

  if (plan.plan.kind !== "damage") {
    const rolls = plan.plan.mode === "normal"
      ? [rollServerDie(20)]
      : [rollServerDie(20), rollServerDie(20)];
    const kept = plan.plan.mode === "advantage"
      ? Math.max(...rolls)
      : plan.plan.mode === "disadvantage"
        ? Math.min(...rolls)
        : rolls[0];

    return {
      ok: true,
      result: {
        id: crypto.randomUUID(),
        requestId: request.requestId,
        actorId,
        characterId: request.characterId,
        label: request.label,
        kind: plan.plan.kind,
        mode: plan.plan.mode,
        groups: [{ quantity: rolls.length, sides: 20, rolls, kept }],
        modifier: plan.plan.modifier,
        total: kept + plan.plan.modifier,
        natural: kept,
        createdAt: new Date().toISOString(),
      },
    };
  }

  const groups = plan.plan.groups.map((group) => ({
    ...group,
    rolls: Array.from({ length: group.quantity }, () => rollServerDie(group.sides)),
  }));
  const diceTotal = groups.reduce(
    (sum, group) => sum + group.rolls.reduce((groupSum, value) => groupSum + value, 0),
    0,
  );

  return {
    ok: true,
    result: {
      id: crypto.randomUUID(),
      requestId: request.requestId,
      actorId,
      characterId: request.characterId,
      label: request.label,
      kind: "damage",
      mode: "normal",
      groups,
      modifier: plan.plan.modifier,
      total: diceTotal + plan.plan.modifier,
      createdAt: new Date().toISOString(),
    },
  };
}

function buildAuthoritativeDicePlan(
  request: SessionDiceRollRequest,
  character: CharacterTemplate,
): { ok: true; plan: DicePlan } | { ok: false; code: string; message: string } {
  const source = request.source;
  switch (source.type) {
    case "ability":
      return d20Plan("ability", request.mode, character.getEffectiveAttributeModifier(source.attribute));
    case "skill":
      return d20Plan("skill", request.mode, getAuthoritativeSkillBonus(character, source.skill));
    case "save":
      return d20Plan("save", request.mode, character.getSavingThrowBonus(source.attribute));
    case "initiative":
      return d20Plan("initiative", request.mode, character.getEffectiveInitiative());
    case "spell-attack": {
      const modifier = character.getEffectiveAttributeModifier(source.attribute);
      return d20Plan(
        "spell-attack",
        request.mode,
        character.getEffectiveSpellAttackBonus(
          source.attribute,
          modifier + character.getProficiencyBonus(),
        ),
      );
    }
    case "weapon-attack": {
      const weapon = findEquippedWeapon(character, source.weaponId);
      if (!weapon) return missingWeapon();
      const attribute = getWeaponAttackAttribute(weapon);
      const proficiency = weapon.proficient && !isWeaponImprovisedGrip(weapon)
        ? character.getProficiencyBonus()
        : 0;
      return d20Plan(
        "attack",
        request.mode,
        character.getEffectiveWeaponAttackBonus(
          weapon,
          character.getEffectiveAttributeModifier(attribute) + proficiency,
        ),
      );
    }
    case "unarmed-attack":
      return d20Plan("attack", request.mode, getUnarmedAttackProfile(character).attack);
    case "weapon-damage": {
      const weapon = findEquippedWeapon(character, source.weaponId);
      if (!weapon) return missingWeapon();
      const die = getWeaponDamageDie(weapon) ?? weapon.damage;
      const attribute = getWeaponAttackAttribute(weapon);
      const modifier = character.getEffectiveWeaponDamageBonus(
        weapon,
        character.getEffectiveAttributeModifier(attribute),
      );
      return {
        ok: true,
        plan: {
          kind: "damage",
          mode: "normal",
          groups: [{ quantity: Math.max(1, Math.trunc(die.quantity) || 1), sides: parseDieSides(die.sides) }],
          modifier,
        },
      };
    }
    case "unarmed-damage": {
      const profile = getUnarmedAttackProfile(character);
      const die = profile.damageDie;
      return {
        ok: true,
        plan: {
          kind: "damage",
          mode: "normal",
          groups: die
            ? [{ quantity: Math.max(1, Math.trunc(die.quantity) || 1), sides: parseDieSides(die.sides) }]
            : [],
          modifier: die ? profile.damageBonus : 1 + profile.damageBonus,
        },
      };
    }
  }
}

function d20Plan(
  kind: Exclude<SessionDiceRollResult["kind"], "damage">,
  mode: SessionDiceRollResult["mode"],
  modifier: number,
): { ok: true; plan: DicePlan } {
  return {
    ok: true,
    plan: {
      kind,
      mode,
      groups: [{ quantity: 1, sides: 20 }],
      modifier,
    },
  };
}

function getAuthoritativeSkillBonus(character: CharacterTemplate, skill: Skill): number {
  const attribute = SKILL_ATTRIBUTES[skill];
  const label = SKILL_LABELS[skill];
  const proficiency = character.get("sheet").skills[skill] ?? "none";
  const granted =
    hasProficiency(character, "skill", label)
    || hasProficiency(character, "skill", skill);
  const effective = proficiency === "expertise"
    ? "expertise"
    : proficiency === "proficient" || granted
      ? "proficient"
      : "none";
  const proficiencyBonus = character.getProficiencyBonus();

  return character.getEffectiveAttributeModifier(attribute)
    + (effective === "proficient" ? proficiencyBonus : 0)
    + (effective === "expertise" ? proficiencyBonus * 2 : 0);
}

function findEquippedWeapon(character: CharacterTemplate, weaponId: string): Weapon | undefined {
  return character.get("equipment").weapons.find((weapon) => weapon.id === weaponId);
}

function missingWeapon(): { ok: false; code: string; message: string } {
  return {
    ok: false,
    code: "WEAPON_NOT_EQUIPPED",
    message: "The requested weapon is not equipped by this character.",
  };
}

function parseDieSides(value: number | string): number {
  const parsed = typeof value === "number"
    ? value
    : Number(String(value).trim().toLowerCase().replace(/^d/, ""));
  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 1000) {
    throw new Error(`Invalid authoritative die sides: ${String(value)}`);
  }
  return parsed;
}

function rollServerDie(sides: number): number {
  const range = 0x1_0000_0000;
  const limit = range - (range % sides);
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return (buffer[0] % sides) + 1;
}

const SKILL_ATTRIBUTES: Record<Skill, Attribute> = {
  acrobatics: "dex",
  arcana: "int",
  athletics: "str",
  animalHandling: "wis",
  performance: "cha",
  deception: "cha",
  stealth: "dex",
  history: "int",
  intimidation: "cha",
  insight: "wis",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  persuasion: "cha",
  sleightOfHand: "dex",
  religion: "int",
  survival: "wis",
};

const SKILL_LABELS: Record<Skill, string> = {
  acrobatics: "Acrobacia",
  arcana: "Arcanismo",
  athletics: "Atletismo",
  animalHandling: "Lidar com Animais",
  performance: "Atuação",
  deception: "Blefe",
  stealth: "Furtividade",
  history: "História",
  intimidation: "Intimidação",
  insight: "Intuição",
  investigation: "Investigação",
  medicine: "Medicina",
  nature: "Natureza",
  perception: "Percepção",
  persuasion: "Persuasão",
  sleightOfHand: "Prestidigitação",
  religion: "Religião",
  survival: "Sobrevivência",
};

function hydrateCharacterForRest(
  state: SessionAbilityState,
  hp: SessionHpState,
  conditions: SessionConditionsState,
): CharacterTemplate {
  let character = CharacterTemplate.fromJSON(state.character as Partial<CharacterTemplateProps>);
  const sheet = character.get("sheet");
  const hitDice = Object.fromEntries(
    Object.entries(hp.hitDice).flatMap(([side, pool]) => pool ? [[side, {
      current: { quantity: pool.current, sides: side },
      max: { quantity: pool.max, sides: side },
    }]] : []),
  ) as typeof sheet.HP.hitDice;

  character = character.withPatch({
    sheet: {
      ...sheet,
      attributes: hp.attributesInitialized ? { ...hp.attributes } : sheet.attributes,
      savingThrowProficiencies: hp.savingThrowsInitialized ? { ...hp.savingThrows } : sheet.savingThrowProficiencies,
      skills: hp.skillsInitialized ? { ...hp.skills } : sheet.skills,
      stats: hp.statsInitialized ? {
        ...sheet.stats,
        armorClassAdjustment: hp.stats.armorClassAdjustment,
        initiativeAdjustment: hp.stats.initiativeAdjustment,
        mobilityAdjustment: hp.stats.mobilityAdjustment,
        passivePerceptionAdjustment: hp.stats.passivePerceptionAdjustment,
        exhaustion: hp.stats.exhaustion,
        inspiration: hp.stats.inspiration,
        experience: hp.stats.experience,
      } : sheet.stats,
      HP: {
        ...sheet.HP,
        current: hp.current,
        temporary: hp.temporary,
        max: hp.max,
        currentMax: hp.currentMax,
        hitDice,
      },
    },
  });
  return withCharacterConditions(character, conditions.conditions as any);
}

function sessionHpFromCharacter(character: CharacterTemplate, previous: SessionHpState): SessionHpState {
  const sheet = character.get("sheet");
  const rawHp = sheet.HP;
  const currentMax = getCurrentMaxHp(character);
  const hitDice = Object.fromEntries(
    Object.entries(rawHp.hitDice).flatMap(([side, pool]) =>
      pool ? [[side, { current: pool.current.quantity, max: pool.max.quantity }]] : [],
    ),
  ) as SessionHpState["hitDice"];

  return {
    ...previous,
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
    attributes: { ...previous.attributes },
    savingThrows: { ...previous.savingThrows },
    skills: { ...previous.skills },
    revision: previous.revision + 1,
  };
}

function runtimeDefinitionsForCharacter(
  character: CharacterTemplate,
  runtimeConfig: SessionRuntimeConfigSnapshot,
  characterId: string,
): CustomSystemDefinition[] {
  const configured = runtimeConfig.config.characters.find((entry) => entry.characterId === characterId);
  if (!configured) return [];
  const installations = new Map(
    configured.customSystems
      .filter((entry) => entry.enabled)
      .map((entry) => [entry.systemId, entry]),
  );
  const states = new Map(
    (character.get("sheet").customSystems ?? []).map((state) => [state.systemId, state]),
  );

  return runtimeConfig.config.customSystems.filter((definition) => {
    const installation = installations.get(definition.id);
    const state = states.get(definition.id);
    return Boolean(
      installation
      && state?.enabled
      && installation.systemVersion === definition.version
      && state.systemVersion === installation.systemVersion,
    );
  });
}

function isLongRestSelection(value: unknown): value is LongRestSupplySelection[] {
  return Array.isArray(value) && value.every((entry) =>
    Boolean(entry)
    && typeof entry === "object"
    && typeof (entry as { itemId?: unknown }).itemId === "string"
    && (entry as { itemId: string }).itemId.trim().length > 0
    && typeof (entry as { portions?: unknown }).portions === "number"
    && Number.isFinite((entry as { portions: number }).portions)
    && (entry as { portions: number }).portions > 0,
  );
}

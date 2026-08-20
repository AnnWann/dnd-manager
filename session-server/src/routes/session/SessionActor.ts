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
  applyHpOperation,
  defaultAttributes,
  defaultSavingThrows,
  defaultSkills,
  defaultStats,
  MAX_HP_LOG_RECORDS,
  normalizeAttributesSeed,
  normalizeHpSeed,
  normalizeSavingThrowsSeed,
  normalizeSkillsSeed,
  normalizeStatsSeed,
} from "../characters/sheet/hpState";
import type { SessionAbilityState } from "../characters/abilities/abilityProtocol";
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../../src/models/characters/CharacterTemplate";
import { getCurrentMaxHp } from "../../../../src/models/characters/characterHp";
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

  private async initializeHp(webSocket: WebSocket, connection: SessionConnection, seeds: SessionHpSeed[]): Promise<void> {
    if (connection.role !== "MASTER") {
      this.sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can initialize authoritative character state.");
      return;
    }

    const state = await this.readHpState();
    let changed = false;
    for (const seed of seeds) {
      const normalized = normalizeHpSeed(seed);
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
    operation: Parameters<typeof applyHpOperation>[1],
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

    const result = applyHpOperation(current, effectiveOperation, connection);
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
      maxRecords: MAX_HP_LOG_RECORDS,
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
      next = takeShortRest(current, operation.healing, operation.hitDiceConsumption as any);
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
      next = recovery === "partial" ? takePartialLongRest(current) : takeLongRest(current);
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
        const definitions = runtimeDefinitionsForCharacter(next, runtimeConfig, operation.characterId);
        next = runCustomSystemAutomations(
          next,
          definitions,
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
      maxRecords: MAX_HP_LOG_RECORDS,
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
      maxRecords: MAX_HP_LOG_RECORDS,
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
    return (await this.ctx.storage.get<SharedInventoryState>>(INVENTORY_STATE_KEY)) ?? {
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
    const role = request.headers.get("x-session-role")?.trim();
    const expiresAt = Number(request.headers.get("x-session-expires-at"));
    if (!sessionId || !clientId || !userId || (role !== "MASTER" && role !== "PLAYER") || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    const now = Date.now();
    return { sessionId, clientId, userId, role, connectedAt: now, lastHeartbeatAt: now };
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
      return connection ? [{ userId: connection.userId, clientId: connection.clientId, role: connection.role }] : [];
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

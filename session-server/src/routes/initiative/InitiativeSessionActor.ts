import { MAX_HP_LOG_RECORDS } from "../characters/sheet/hpState";
import type { SessionConnection } from "../session/protocol";
import {
  commitSessionMutation,
  createSessionLogRecord,
  readSessionLog,
} from "../session/sessionLog";
import {
  addInitiativeEntries,
  advanceInitiativeTurn,
  canTradeConsecutiveAllies,
  createInitiativeSession,
  endInitiativeCombat,
  normalizeInitiativeSession,
  removeInitiativeEntry,
  rewindInitiativeTurn,
  sortInitiativeEntries,
  startInitiativeCombat,
  tradeConsecutiveAllies,
  updateInitiativeEntry,
  type InitiativeEntry,
  type InitiativeSession,
  type NewInitiativeEntry,
} from "../../../../src/models/initiative/Initiative";
import {
  parseInitiativeClientMessage,
  type SessionInitiativeOperation,
  type SessionInitiativeState,
} from "./initiativeProtocol";

export const INITIATIVE_STATE_KEY = "initiative-state";
export const INITIATIVE_SHARED_SCOPE = "initiative:shared";

export class SessionActor {
  declare protected readonly ctx: DurableObjectState;

  async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = parseInitiativeClientMessage(raw);
    if (!parsed) return;

    const connection = readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    if (connection.role !== "MASTER") {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can mutate initiative state.");
      return;
    }

    if (parsed.type === "session.initiative.initialize") {
      const current = await readInitiativeState(this.ctx.storage);
      if (current.initialized) {
        send(webSocket, { type: "session.initiative.snapshot", state: current });
        return;
      }
      const normalized = normalizeInitiativeSession(parsed.session as Partial<InitiativeSession>);
      const state: SessionInitiativeState = {
        initialized: true,
        revision: 0,
        session: normalized as unknown as Record<string, unknown>,
      };
      await this.ctx.storage.put(INITIATIVE_STATE_KEY, state);
      broadcast(this.ctx.getWebSockets(), { type: "session.initiative.snapshot", state });
      return;
    }

    await this.handleOperation(webSocket, connection, parsed.operation);
  }

  private async handleOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: SessionInitiativeOperation,
  ): Promise<void> {
    const [state, log] = await Promise.all([
      readInitiativeState(this.ctx.storage),
      readSessionLog(this.ctx.storage),
    ]);
    if (!state.initialized) {
      sendError(webSocket, "INITIATIVE_STATE_NOT_INITIALIZED", "Initiative has not been initialized by the MASTER.");
      return;
    }

    const current = normalizeInitiativeSession(state.session as Partial<InitiativeSession>);
    const before = structuredClone(state);
    const result = applyInitiativeOperation(current, operation);
    if (!result.ok) {
      sendError(webSocket, result.code, result.message);
      return;
    }

    state.session = result.session as unknown as Record<string, unknown>;
    state.revision += 1;
    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation: result.operation,
      affectedScopes: [INITIATIVE_SHARED_SCOPE],
      reverseOperation: {
        type: "session.initiative.restore",
        characterId: "session",
        affectedScopes: [INITIATIVE_SHARED_SCOPE],
        snapshot: before,
      },
    });

    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [INITIATIVE_STATE_KEY]: state },
      record,
      currentLog: log,
      maxRecords: MAX_HP_LOG_RECORDS,
    });
    broadcast(this.ctx.getWebSockets(), { type: "session.initiative.updated", state });
  }
}

export async function readInitiativeState(storage: DurableObjectStorage): Promise<SessionInitiativeState> {
  return (await storage.get<SessionInitiativeState>(INITIATIVE_STATE_KEY)) ?? {
    initialized: false,
    revision: 0,
    session: emptyInitiativeSession() as unknown as Record<string, unknown>,
  };
}

function applyInitiativeOperation(
  current: InitiativeSession,
  operation: SessionInitiativeOperation,
): { ok: true; session: InitiativeSession; operation: SessionInitiativeOperation } | { ok: false; code: string; message: string } {
  switch (operation.type) {
    case "initiative.entries.add": {
      if (!operation.entries.length || operation.entries.length > 50) return invalid("INITIATIVE_ENTRIES_INVALID", "Add between 1 and 50 initiative entries at a time.");
      const inputs = operation.entries.flatMap((entry) => normalizeEntryInput(entry));
      if (inputs.length !== operation.entries.length) return invalid("INITIATIVE_ENTRY_INVALID", "One or more initiative entries are invalid.");
      const existingIds = new Set(current.entries.map((entry) => entry.id));
      const session = current.started
        ? addEntriesDuringCombat(current, inputs)
        : addInitiativeEntries(current, inputs);
      const addedEntries = session.entries.filter((entry) => !existingIds.has(entry.id));
      return {
        ok: true,
        session,
        operation: {
          ...operation,
          entries: addedEntries as unknown as Record<string, unknown>[],
        },
      };
    }
    case "initiative.entry.update": {
      const existing = current.entries.find((entry) => entry.id === operation.entryId);
      if (!existing) return invalid("INITIATIVE_ENTRY_NOT_FOUND", "Initiative entry was not found.");
      const patch = normalizeEntryPatch(operation.patch);
      if (!Object.keys(patch).length) return invalid("INITIATIVE_PATCH_INVALID", "No supported initiative fields were supplied.");
      const session = updateInitiativeEntry(current, operation.entryId, (entry) => ({ ...entry, ...patch, id: entry.id, order: entry.order, createdAt: entry.createdAt }));
      return { ok: true, session, operation: { ...operation, patch } };
    }
    case "initiative.entry.remove": {
      if (!current.entries.some((entry) => entry.id === operation.entryId)) return invalid("INITIATIVE_ENTRY_NOT_FOUND", "Initiative entry was not found.");
      return { ok: true, session: removeInitiativeEntry(current, operation.entryId), operation };
    }
    case "initiative.sort": {
      if (current.started) return invalid("INITIATIVE_COMBAT_STARTED", "Initiative cannot be manually sorted after combat starts.");
      return { ok: true, session: sortInitiativeEntries(current), operation };
    }
    case "initiative.combat.start": {
      if (current.started) return invalid("INITIATIVE_ALREADY_STARTED", "Combat is already running.");
      if (!current.entries.length) return invalid("INITIATIVE_EMPTY", "Add at least one creature before starting combat.");
      return { ok: true, session: startInitiativeCombat(current), operation };
    }
    case "initiative.combat.end": {
      if (!current.started) return invalid("INITIATIVE_NOT_STARTED", "Combat is not running.");
      return { ok: true, session: endInitiativeCombat(current), operation };
    }
    case "initiative.turn.next": {
      if (!current.started) return invalid("INITIATIVE_NOT_STARTED", "Combat is not running.");
      return { ok: true, session: advanceInitiativeTurn(current), operation };
    }
    case "initiative.turn.previous": {
      if (!current.started) return invalid("INITIATIVE_NOT_STARTED", "Combat is not running.");
      return { ok: true, session: rewindInitiativeTurn(current), operation };
    }
    case "initiative.allies.trade": {
      if (!canTradeConsecutiveAllies(current, operation.entryId, 1)) return invalid("INITIATIVE_TRADE_INVALID", "These entries cannot trade initiative positions.");
      return { ok: true, session: tradeConsecutiveAllies(current, operation.entryId, 1), operation };
    }
    case "initiative.viewMode.set": {
      if (current.viewMode === operation.viewMode) return invalid("INITIATIVE_VIEW_UNCHANGED", "Initiative already uses this view mode.");
      return { ok: true, session: { ...current, viewMode: operation.viewMode, updatedAt: Date.now() }, operation };
    }
    case "initiative.reset": {
      return { ok: true, session: createInitiativeSession(current.name || "Combate da sessão"), operation };
    }
  }
}

/**
 * Inserts reinforcements without re-sorting existing combatants. Existing
 * manual trades and the current turn therefore remain intact. The round anchor
 * stays at the front of the cycle; a reinforcement inserted before the current
 * actor naturally waits until the next cycle, while one inserted after it can
 * still act this round.
 */
function addEntriesDuringCombat(current: InitiativeSession, inputs: NewInitiativeEntry[]): InitiativeSession {
  const seeded = addInitiativeEntries({ ...current, started: false }, inputs);
  const additions = seeded.entries
    .slice(current.entries.length)
    .sort(compareInitiative);
  const entries = [...current.entries];
  const anchorIndex = current.roundAnchorEntryId
    ? Math.max(0, entries.findIndex((entry) => entry.id === current.roundAnchorEntryId))
    : 0;
  const minimumInsertIndex = Math.min(entries.length, anchorIndex + 1);

  for (const addition of additions) {
    let insertAt = entries.length;
    for (let index = minimumInsertIndex; index < entries.length; index += 1) {
      if (compareInitiative(addition, entries[index]) < 0) {
        insertAt = index;
        break;
      }
    }
    entries.splice(insertAt, 0, addition);
  }

  return {
    ...current,
    entries: entries.map((entry, order) => ({ ...entry, order })),
    activeEntryId: current.activeEntryId,
    roundAnchorEntryId: current.roundAnchorEntryId,
    updatedAt: Date.now(),
  };
}

function compareInitiative(left: InitiativeEntry, right: InitiativeEntry): number {
  if (right.initiative !== left.initiative) return right.initiative - left.initiative;
  if (right.initiativeBonus !== left.initiativeBonus) return right.initiativeBonus - left.initiativeBonus;
  if ((right.dexterity ?? 0) !== (left.dexterity ?? 0)) return (right.dexterity ?? 0) - (left.dexterity ?? 0);
  return left.createdAt - right.createdAt;
}

function normalizeEntryInput(value: Record<string, unknown>): NewInitiativeEntry[] {
  const name = readString(value.name);
  const initiative = finite(value.initiative);
  const initiativeBonus = finite(value.initiativeBonus);
  const sourceType = value.sourceType;
  const side = value.side;
  if (!name || initiative === null || initiativeBonus === null) return [];
  if (sourceType !== "character" && sourceType !== "npc" && sourceType !== "monster" && sourceType !== "custom") return [];
  if (side !== "ally" && side !== "enemy" && side !== "neutral") return [];
  return [{
    sourceId: optionalString(value.sourceId),
    sourceType,
    name,
    imageUrl: optionalString(value.imageUrl),
    initiative,
    initiativeBonus,
    dexterity: optionalFinite(value.dexterity),
    side,
    armorClass: optionalFinite(value.armorClass),
    currentHp: optionalFinite(value.currentHp),
    maxHp: optionalFinite(value.maxHp),
    temporaryHp: optionalFinite(value.temporaryHp),
    hidden: value.hidden === true,
    defeated: value.defeated === true,
    conditions: Array.isArray(value.conditions) ? structuredClone(value.conditions) as InitiativeEntry["conditions"] : [],
  }];
}

function normalizeEntryPatch(value: Record<string, unknown>): Partial<InitiativeEntry> {
  const patch: Partial<InitiativeEntry> = {};
  if (typeof value.name === "string" && value.name.trim()) patch.name = value.name.trim();
  for (const key of ["initiative", "initiativeBonus", "dexterity", "armorClass", "currentHp", "maxHp", "temporaryHp"] as const) {
    if (!(key in value)) continue;
    const parsed = optionalFinite(value[key]);
    if (parsed !== undefined) patch[key] = parsed;
  }
  if (value.side === "ally" || value.side === "enemy" || value.side === "neutral") patch.side = value.side;
  if (typeof value.hidden === "boolean") patch.hidden = value.hidden;
  if (typeof value.defeated === "boolean") patch.defeated = value.defeated;
  if (Array.isArray(value.conditions)) patch.conditions = structuredClone(value.conditions) as InitiativeEntry["conditions"];
  return patch;
}

function emptyInitiativeSession(): InitiativeSession {
  return {
    version: 1,
    id: "session-initiative",
    name: "Combate da sessão",
    entries: [],
    round: 1,
    started: false,
    viewMode: "table",
    createdAt: 0,
    updatedAt: 0,
  };
}
function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function optionalFinite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function optionalString(value: unknown): string | undefined {
  return readString(value) || undefined;
}
function invalid(code: string, message: string) {
  return { ok: false as const, code, message };
}
function readConnection(webSocket: WebSocket): SessionConnection | null {
  try { return webSocket.deserializeAttachment() as SessionConnection; } catch { return null; }
}
function send(webSocket: WebSocket, value: unknown): void {
  try { webSocket.send(JSON.stringify(value)); } catch {}
}
function sendError(webSocket: WebSocket, code: string, message: string): void {
  send(webSocket, { type: "session.error", code, message });
}
function broadcast(sockets: WebSocket[], value: unknown): void {
  const payload = JSON.stringify(value);
  for (const socket of sockets) {
    try { socket.send(payload); } catch {}
  }
}

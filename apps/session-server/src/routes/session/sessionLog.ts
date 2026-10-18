import { reconcileSessionSupplyProjection } from "./supplyProjection";

export const SESSION_LOG_KEY = "hp-log";
export const SHARED_INVENTORY_SCOPE = "inventory:shared";
export const SESSION_LOG_PAGE_SIZE = 20;

export type SessionLogOperation = {
  type: string;
  characterId?: string;
  [key: string]: unknown;
};

export type SessionReverseOperation = {
  type: string;
  characterId: string;
  affectedScopes?: string[];
  [key: string]: unknown;
};

export type SessionLogRecord = {
  id: string;
  actorId: string;
  actorName?: string;
  createdAt: string;
  operation: SessionLogOperation;
  reverseOperation: SessionReverseOperation;
  undoneAt?: string;
  undoneBy?: string;
};

export type SessionClientLogRecord = Omit<SessionLogRecord, "reverseOperation"> & {
  reverseOperation: Pick<SessionReverseOperation, "type" | "characterId" | "affectedScopes">;
};

export type SessionLogPage = {
  records: SessionLogRecord[];
  hasMore: boolean;
  cursor: string | null;
  pageKind: "latest" | "older";
};

export type UndoValidationResult =
  | {
      ok: true;
      index: number;
      record: SessionLogRecord;
      affectedScopes: string[];
    }
  | {
      ok: false;
      code: "LOG_NOT_FOUND" | "UNDO_NOT_AVAILABLE" | "UNDO_OF_UNDO_NOT_SUPPORTED" | "UNDO_NOT_LATEST";
      message: string;
    };

export type SessionLogCoalescePredicate = (
  previous: SessionLogRecord,
  incoming: SessionLogRecord,
) => boolean;

export type CommitSessionMutationArgs = {
  writes: Record<string, unknown>;
  record: SessionLogRecord;
  maxRecords: number;
  currentLog?: SessionLogRecord[];
  coalesceLatest?: SessionLogCoalescePredicate;
};

export type CommitSessionMutationsArgs = {
  writes: Record<string, unknown>;
  records: SessionLogRecord[];
  maxRecords: number;
  currentLog?: SessionLogRecord[];
};

export type CommitSessionUndoArgs = {
  writes: Record<string, unknown>;
  currentLog: SessionLogRecord[];
  sourceIndex: number;
  userId: string;
  undoRecord: SessionLogRecord;
  maxRecords: number;
  undoneAt?: string;
};

export function characterScope(characterId: string): string {
  return `character:${characterId}`;
}

export function readSessionLog(
  storage: DurableObjectStorage,
): Promise<SessionLogRecord[]> {
  return storage.get<SessionLogRecord[]>(SESSION_LOG_KEY).then((value) => value ?? []);
}

export function trimSessionLog(records: SessionLogRecord[], maxRecords: number): SessionLogRecord[] {
  return records.slice(-maxRecords);
}

export function getSessionLogPage(
  records: SessionLogRecord[],
  beforeLogId?: string,
): SessionLogPage {
  const beforeIndex = beforeLogId
    ? records.findIndex((record) => record.id === beforeLogId)
    : records.length;
  const end = beforeIndex >= 0 ? beforeIndex : records.length;
  const start = Math.max(0, end - SESSION_LOG_PAGE_SIZE);
  const pageRecords = records.slice(start, end);
  return {
    records: pageRecords,
    hasMore: start > 0,
    cursor: pageRecords[0]?.id ?? null,
    pageKind: beforeLogId ? "older" : "latest",
  };
}

export function sendSessionLogPage(
  socket: WebSocket,
  records: SessionLogRecord[],
  beforeLogId?: string,
): void {
  const page = getSessionLogPage(records, beforeLogId);
  try {
    socket.send(JSON.stringify({
      type: "session.hp.log",
      ...page,
      records: page.records.map((record) => toClientLogRecord(withResolvedActorName(record, [socket]))),
    }));
  } catch {}
}

export async function writeSessionLog(
  storage: DurableObjectStorage,
  sockets: WebSocket[],
  records: SessionLogRecord[],
): Promise<void> {
  normalizeSessionLogRecordsInPlace(records);
  await storage.put(SESSION_LOG_KEY, records);
  broadcastSessionLogToMasters(sockets, records);
}

/**
 * Atomic state + timeline commit used by every authoritative domain.
 * Domain actors provide state writes and semantic/reverse operations; this
 * function owns timeline append/coalescing, trimming, persistence and MASTER
 * broadcast.
 */
export async function commitSessionMutation(
  storage: DurableObjectStorage,
  sockets: WebSocket[],
  args: CommitSessionMutationArgs,
): Promise<SessionLogRecord[]> {
  const records = (args.currentLog ? [...args.currentLog] : await readSessionLog(storage))
    .map((record) => withResolvedActorName(record, sockets));
  const incoming = withResolvedActorName(args.record, sockets);
  const previous = records[records.length - 1];

  if (previous && args.coalesceLatest?.(previous, incoming)) {
    records[records.length - 1] = {
      ...incoming,
      id: previous.id,
      actorId: previous.actorId,
      actorName: previous.actorName ?? incoming.actorName,
      reverseOperation: previous.reverseOperation,
      undoneAt: previous.undoneAt,
      undoneBy: previous.undoneBy,
    };
  } else {
    records.push(incoming);
  }

  const next = trimSessionLog(records, args.maxRecords);
  normalizeSessionLogRecordsInPlace(next);
  await storage.put({ ...args.writes, [SESSION_LOG_KEY]: next });
  await refreshSupplyProjectionAfterWrites(storage, sockets, args.writes);
  broadcastSessionLogToMasters(sockets, next);
  return next;
}

/**
 * Atomic variant for a group of semantic operations that must publish one
 * final state snapshot. Individual log records are preserved so existing
 * operation consumers and undo ordering continue to see the original types.
 */
export async function commitSessionMutations(
  storage: DurableObjectStorage,
  sockets: WebSocket[],
  args: CommitSessionMutationsArgs,
): Promise<SessionLogRecord[]> {
  const current = (args.currentLog ? [...args.currentLog] : await readSessionLog(storage))
    .map((record) => withResolvedActorName(record, sockets));
  current.push(...args.records.map((record) => withResolvedActorName(record, sockets)));
  const next = trimSessionLog(current, args.maxRecords);
  normalizeSessionLogRecordsInPlace(next);
  await storage.put({ ...args.writes, [SESSION_LOG_KEY]: next });
  await refreshSupplyProjectionAfterWrites(storage, sockets, args.writes);
  broadcastSessionLogToMasters(sockets, next);
  return next;
}

/**
 * Atomic undo commit. The composed actor is the sole caller: it marks the
 * source record undone, appends the generated undo record, persists all
 * restored state and broadcasts the canonical timeline to MASTER clients.
 */
export async function commitSessionUndo(
  storage: DurableObjectStorage,
  sockets: WebSocket[],
  args: CommitSessionUndoArgs,
): Promise<SessionLogRecord[]> {
  const at = args.undoneAt ?? new Date().toISOString();
  const records = markLogUndone(args.currentLog, args.sourceIndex, args.userId, at);
  records.push(args.undoRecord);
  const next = trimSessionLog(records, args.maxRecords);
  normalizeSessionLogRecordsInPlace(next);
  await storage.put({ ...args.writes, [SESSION_LOG_KEY]: next });
  await refreshSupplyProjectionAfterWrites(storage, sockets, args.writes);
  broadcastSessionLogToMasters(sockets, next);
  return next;
}

export async function appendSessionLog(
  storage: DurableObjectStorage,
  sockets: WebSocket[],
  record: SessionLogRecord,
  maxRecords: number,
): Promise<SessionLogRecord[]> {
  return commitSessionMutation(storage, sockets, {
    writes: {},
    record,
    maxRecords,
  });
}

export function createSessionLogRecord(args: {
  actorId: string;
  operation: SessionLogOperation;
  reverseOperation: SessionReverseOperation;
  affectedScopes?: string[];
  createdAt?: string;
}): SessionLogRecord {
  const scopes = normalizeScopes(args.affectedScopes ?? inferOperationScopes(args.operation, args.reverseOperation));
  return {
    id: crypto.randomUUID(),
    actorId: args.actorId,
    createdAt: args.createdAt ?? new Date().toISOString(),
    operation: args.operation,
    reverseOperation: {
      ...args.reverseOperation,
      affectedScopes: scopes,
    },
  };
}

/** Normalizes records in place so old stored records follow the central scope contract. */
export function normalizeSessionLogRecordsInPlace(records: SessionLogRecord[]): boolean {
  let changed = false;
  for (const record of records) {
    const scopes = logRecordScopes(record);
    const current = record.reverseOperation.affectedScopes ?? [];
    if (sameScopes(current, scopes)) continue;
    record.reverseOperation.affectedScopes = scopes;
    changed = true;
  }
  return changed;
}

/** Makes older stored records conform to the central log contract. */
export async function normalizeStoredSessionLog(
  storage: DurableObjectStorage,
): Promise<SessionLogRecord[]> {
  const records = await readSessionLog(storage);
  if (normalizeSessionLogRecordsInPlace(records)) {
    await storage.put(SESSION_LOG_KEY, records);
  }
  return records;
}

export function validateUndoOrdering(
  records: SessionLogRecord[],
  logId: string,
): UndoValidationResult {
  const index = records.findIndex((record) => record.id === logId);
  if (index < 0) {
    return { ok: false, code: "LOG_NOT_FOUND", message: "The selected log entry no longer exists." };
  }

  const record = records[index];
  if (record.undoneAt) {
    return { ok: false, code: "UNDO_NOT_AVAILABLE", message: "This change has already been undone." };
  }
  if (record.operation.type === "character.hp.undo") {
    return { ok: false, code: "UNDO_OF_UNDO_NOT_SUPPORTED", message: "Undo records cannot be undone." };
  }

  const affectedScopes = logRecordScopes(record);
  const newerConflict = records.slice(index + 1).some((candidate) =>
    !candidate.undoneAt
    && candidate.operation.type !== "character.hp.undo"
    && scopesOverlap(affectedScopes, logRecordScopes(candidate)),
  );
  if (newerConflict) {
    return {
      ok: false,
      code: "UNDO_NOT_LATEST",
      message: "Undo newer changes affecting the same state first.",
    };
  }

  return { ok: true, index, record, affectedScopes };
}

export function markLogUndone(
  records: SessionLogRecord[],
  index: number,
  userId: string,
  at = new Date().toISOString(),
): SessionLogRecord[] {
  const next = [...records];
  next[index] = { ...next[index], undoneAt: at, undoneBy: userId };
  return next;
}

export function logRecordScopes(record: SessionLogRecord): string[] {
  const explicit = record.reverseOperation.affectedScopes;
  if (explicit?.length) return normalizeScopes(explicit);
  return normalizeScopes(inferOperationScopes(record.operation, record.reverseOperation));
}

export function scopesOverlap(left: string[], right: string[]): boolean {
  if (!left.length || !right.length) return false;
  const values = new Set(left);
  return right.some((scope) => values.has(scope));
}

export function inferOperationScopes(
  operation: SessionLogOperation,
  reverseOperation?: Pick<SessionReverseOperation, "characterId">,
): string[] {
  const scopes: string[] = [];
  const characterId = typeof operation.characterId === "string"
    ? operation.characterId
    : reverseOperation?.characterId;
  if (characterId) scopes.push(characterScope(characterId));

  if (
    operation.type.startsWith("party.")
    || operation.type.startsWith("ground.")
    || operation.type === "character.equipment.move.ground"
  ) {
    scopes.push(SHARED_INVENTORY_SCOPE);
  }

  if (operation.type === "inventory.item.transfer") {
    const request = operation.request as {
      from?: { type?: string; characterId?: string };
      to?: { type?: string; characterId?: string };
    } | undefined;
    for (const location of [request?.from, request?.to]) {
      if (!location) continue;
      if (location.type === "character" && location.characterId) {
        scopes.push(characterScope(location.characterId));
      } else if (location.type === "party" || location.type === "ground") {
        scopes.push(SHARED_INVENTORY_SCOPE);
      }
    }
  }

  return normalizeScopes(scopes);
}

export function broadcastSessionLogToMasters(sockets: WebSocket[], records: SessionLogRecord[]): void {
  const page = getSessionLogPage(records);
  const payload = JSON.stringify({
    type: "session.hp.log",
    ...page,
    records: page.records.map((record) => toClientLogRecord(withResolvedActorName(record, sockets))),
  });
  for (const socket of sockets) {
    const connection = readConnection(socket);
    if (connection?.role !== "MASTER") continue;
    try { socket.send(payload); } catch {}
  }
}

function toClientLogRecord(record: SessionLogRecord): SessionClientLogRecord {
  return {
    id: record.id,
    actorId: record.actorId,
    ...(record.actorName ? { actorName: record.actorName } : {}),
    createdAt: record.createdAt,
    operation: record.operation,
    reverseOperation: {
      type: record.reverseOperation.type,
      characterId: record.reverseOperation.characterId,
      affectedScopes: record.reverseOperation.affectedScopes,
    },
    ...(record.undoneAt ? { undoneAt: record.undoneAt } : {}),
    ...(record.undoneBy ? { undoneBy: record.undoneBy } : {}),
  };
}

async function refreshSupplyProjectionAfterWrites(
  storage: DurableObjectStorage,
  sockets: WebSocket[],
  writes: Record<string, unknown>,
): Promise<void> {
  if (
    !("abilities-state" in writes) &&
    !("characters-state" in writes) &&
    !("inventory-state" in writes)
  ) {
    return;
  }

  const projection = await reconcileSessionSupplyProjection(storage);
  if (!projection.changed || !projection.state) return;

  const payload = JSON.stringify({
    type: "session.inventory.updated",
    state: projection.state,
  });
  for (const socket of sockets) {
    try { socket.send(payload); } catch {}
  }
}

function normalizeScopes(scopes: string[]): string[] {
  return [...new Set(scopes.filter((scope) => typeof scope === "string" && scope.trim()).map((scope) => scope.trim()))];
}

function sameScopes(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const values = new Set(left);
  return right.every((scope) => values.has(scope));
}

function withResolvedActorName(record: SessionLogRecord, sockets: WebSocket[]): SessionLogRecord {
  if (record.actorName?.trim()) return record;
  for (const socket of sockets) {
    const connection = readConnection(socket);
    if (connection?.userId !== record.actorId) continue;
    const actorName = connection.userName?.trim();
    if (actorName) return { ...record, actorName };
  }
  return record;
}

function readConnection(socket: WebSocket): { role?: string; userId?: string; userName?: string } | null {
  try {
    return socket.deserializeAttachment() as { role?: string; userId?: string; userName?: string } | null;
  } catch {
    return null;
  }
}

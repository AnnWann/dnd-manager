export const SESSION_LOG_KEY = "hp-log";
export const SHARED_INVENTORY_SCOPE = "inventory:shared";

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
  createdAt: string;
  operation: SessionLogOperation;
  reverseOperation: SessionReverseOperation;
  undoneAt?: string;
  undoneBy?: string;
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

export async function writeSessionLog(
  storage: DurableObjectStorage,
  sockets: WebSocket[],
  records: SessionLogRecord[],
): Promise<void> {
  normalizeSessionLogRecordsInPlace(records);
  await storage.put(SESSION_LOG_KEY, records);
  broadcastSessionLogToMasters(sockets, records);
}

export async function appendSessionLog(
  storage: DurableObjectStorage,
  sockets: WebSocket[],
  record: SessionLogRecord,
  maxRecords: number,
): Promise<SessionLogRecord[]> {
  const records = await readSessionLog(storage);
  records.push(record);
  const next = trimSessionLog(records, maxRecords);
  await writeSessionLog(storage, sockets, next);
  return next;
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

/** Normalizes records in place so existing domain broadcasts see the same canonical data. */
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
  const payload = JSON.stringify({ type: "session.hp.log", records });
  for (const socket of sockets) {
    const connection = readConnection(socket);
    if (connection?.role !== "MASTER") continue;
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

function readConnection(socket: WebSocket): { role?: string } | null {
  try {
    return socket.deserializeAttachment() as { role?: string } | null;
  } catch {
    return null;
  }
}

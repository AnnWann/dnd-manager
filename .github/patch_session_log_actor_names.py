from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)

# Signed session token carries the authenticated display name.
path = "src/shared/session-runtime/sessionConnectionToken.ts"
text = read(path)
text = replace_once(
    text,
    '  userId: string\n  role: SessionConnectionRole\n',
    '  userId: string\n  /** Authenticated user display name used by session presence/log UI. */\n  userName?: string\n  role: SessionConnectionRole\n',
    "token claim userName",
)
text = replace_once(
    text,
    '  if (!isIdentifier(value.sessionId) || !isIdentifier(value.userId)) return false\n  if (!isIdentifier(value.clientId)) return false\n',
    '  if (!isIdentifier(value.sessionId) || !isIdentifier(value.userId)) return false\n  if (value.userName !== undefined && !isDisplayName(value.userName)) return false\n  if (!isIdentifier(value.clientId)) return false\n',
    "token claim validation",
)
text = replace_once(
    text,
    'function isIdentifier(value: unknown): value is string {\n',
    'function isDisplayName(value: unknown): value is string {\n  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_IDENTIFIER_LENGTH\n}\n\nfunction isIdentifier(value: unknown): value is string {\n',
    "display name helper",
)
write(path, text)

# Vercel signs the Better Auth name into the short-lived session token.
path = "api/session-connection.ts"
text = read(path)
text = replace_once(
    text,
    '        userId: session.user.id,\n        role,\n',
    '        userId: session.user.id,\n        userName: session.user.name.trim(),\n        role,\n',
    "session token user name",
)
write(path, text)

# Worker auth preserves the signed name (development mode may provide one too).
path = "session-server/src/routes/session/auth.ts"
text = read(path)
text = replace_once(
    text,
    '  userId: string;\n  role: SessionRole;\n',
    '  userId: string;\n  userName?: string;\n  role: SessionRole;\n',
    "worker claim userName",
)
text = replace_once(
    text,
    '      userId: claims.userId,\n      role: claims.role,\n',
    '      userId: claims.userId,\n      userName: claims.userName,\n      role: claims.role,\n',
    "worker verified claim userName",
)
text = replace_once(
    text,
    '  const userId = url.searchParams.get("userId")?.trim();\n  const role = url.searchParams.get("role")?.trim().toUpperCase();\n',
    '  const userId = url.searchParams.get("userId")?.trim();\n  const userName = url.searchParams.get("userName")?.trim();\n  const role = url.searchParams.get("role")?.trim().toUpperCase();\n',
    "development userName read",
)
text = replace_once(
    text,
    '      userId,\n      role,\n      clientId: requestedClientId || crypto.randomUUID(),\n',
    '      userId,\n      userName: userName || undefined,\n      role,\n      clientId: requestedClientId || crypto.randomUUID(),\n',
    "development userName claim",
)
write(path, text)

# Forward trusted name to the Durable Object.
path = "session-server/src/routes/index.ts"
text = read(path)
text = replace_once(
    text,
    '    forwardedHeaders.set("x-session-user-id", claims.userId);\n    forwardedHeaders.set("x-session-role", claims.role);\n',
    '    forwardedHeaders.set("x-session-user-id", claims.userId);\n    if (claims.userName) forwardedHeaders.set("x-session-user-name", claims.userName);\n    forwardedHeaders.set("x-session-role", claims.role);\n',
    "forward actor name",
)
write(path, text)

# Connection/presence and server log protocol support an optional display name.
path = "session-server/src/routes/session/protocol.ts"
text = read(path)
text = replace_once(
    text,
    '  userId: string;\n  role: SessionRole;\n  connectedAt: number;\n',
    '  userId: string;\n  userName?: string;\n  role: SessionRole;\n  connectedAt: number;\n',
    "connection userName",
)
text = replace_once(
    text,
    'export type SessionHpLogRecord = {\n  id: string;\n  createdAt: string;\n  actorId: string;\n',
    'export type SessionHpLogRecord = {\n  id: string;\n  createdAt: string;\n  actorId: string;\n  actorName?: string;\n',
    "server hp log actorName",
)
text = replace_once(
    text,
    'export type SessionPresenceUser = {\n  userId: string;\n  clientId: string;\n  role: SessionRole;\n',
    'export type SessionPresenceUser = {\n  userId: string;\n  userName?: string;\n  clientId: string;\n  role: SessionRole;\n',
    "presence userName",
)
write(path, text)

# Read the trusted header into the websocket attachment and presence payload.
path = "session-server/src/routes/session/SessionActor.ts"
text = read(path)
text = replace_once(
    text,
    '    const userId = request.headers.get("x-session-user-id")?.trim();\n    const role = request.headers.get("x-session-role")?.trim();\n',
    '    const userId = request.headers.get("x-session-user-id")?.trim();\n    const userName = request.headers.get("x-session-user-name")?.trim() || undefined;\n    const role = request.headers.get("x-session-role")?.trim();\n',
    "read userName header",
)
text = replace_once(
    text,
    '    return { sessionId, clientId, userId, role, connectedAt: now, lastHeartbeatAt: now };\n',
    '    return { sessionId, clientId, userId, userName, role, connectedAt: now, lastHeartbeatAt: now };\n',
    "connection with userName",
)
text = replace_once(
    text,
    '      return connection ? [{ userId: connection.userId, clientId: connection.clientId, role: connection.role }] : [];\n',
    '      return connection ? [{ userId: connection.userId, userName: connection.userName, clientId: connection.clientId, role: connection.role }] : [];\n',
    "presence with userName",
)
write(path, text)

# Central session log resolves actor names from authenticated websocket attachments.
path = "session-server/src/routes/session/sessionLog.ts"
text = read(path)
text = replace_once(
    text,
    '  actorId: string;\n  createdAt: string;\n',
    '  actorId: string;\n  actorName?: string;\n  createdAt: string;\n',
    "central log actorName",
)
text = replace_once(
    text,
    '  const records = args.currentLog ? [...args.currentLog] : await readSessionLog(storage);\n  const previous = records[records.length - 1];\n\n  if (previous && args.coalesceLatest?.(previous, args.record)) {\n',
    '  const records = (args.currentLog ? [...args.currentLog] : await readSessionLog(storage))\n    .map((record) => withResolvedActorName(record, sockets));\n  const incoming = withResolvedActorName(args.record, sockets);\n  const previous = records[records.length - 1];\n\n  if (previous && args.coalesceLatest?.(previous, incoming)) {\n',
    "commit resolve names",
)
text = replace_once(
    text,
    '      ...args.record,\n      id: previous.id,\n      actorId: previous.actorId,\n      reverseOperation: previous.reverseOperation,\n',
    '      ...incoming,\n      id: previous.id,\n      actorId: previous.actorId,\n      actorName: previous.actorName ?? incoming.actorName,\n      reverseOperation: previous.reverseOperation,\n',
    "coalesce actorName",
)
text = replace_once(
    text,
    '    records.push(args.record);\n',
    '    records.push(incoming);\n',
    "push resolved record",
)
text = replace_once(
    text,
    '  const current = args.currentLog ? [...args.currentLog] : await readSessionLog(storage);\n  current.push(...args.records);\n',
    '  const current = (args.currentLog ? [...args.currentLog] : await readSessionLog(storage))\n    .map((record) => withResolvedActorName(record, sockets));\n  current.push(...args.records.map((record) => withResolvedActorName(record, sockets)));\n',
    "multi commit actor names",
)
text = replace_once(
    text,
    '    id: record.id,\n    actorId: record.actorId,\n    createdAt: record.createdAt,\n',
    '    id: record.id,\n    actorId: record.actorId,\n    ...(record.actorName ? { actorName: record.actorName } : {}),\n    createdAt: record.createdAt,\n',
    "client actorName",
)
text = replace_once(
    text,
    '    records: page.records.map(toClientLogRecord),\n',
    '    records: page.records.map((record) => toClientLogRecord(withResolvedActorName(record, sockets))),\n',
    "broadcast old record names",
)
text = replace_once(
    text,
    'function readConnection(socket: WebSocket): { role?: string } | null {\n  try {\n    return socket.deserializeAttachment() as { role?: string } | null;\n',
    'function withResolvedActorName(record: SessionLogRecord, sockets: WebSocket[]): SessionLogRecord {\n  if (record.actorName?.trim()) return record;\n  for (const socket of sockets) {\n    const connection = readConnection(socket);\n    if (connection?.userId !== record.actorId) continue;\n    const actorName = connection.userName?.trim();\n    if (actorName) return { ...record, actorName };\n  }\n  return record;\n}\n\nfunction readConnection(socket: WebSocket): { role?: string; userId?: string; userName?: string } | null {\n  try {\n    return socket.deserializeAttachment() as { role?: string; userId?: string; userName?: string } | null;\n',
    "connection actor name resolver",
)
write(path, text)

# Frontend transport models are backwards compatible: actorName is optional.
path = "src/features/session-runtime/sessionProtocol.ts"
text = read(path)
text = replace_once(
    text,
    'export type SessionRuntimePresenceUser = { userId: string; clientId: string; role: SessionRuntimeRole }\n',
    'export type SessionRuntimePresenceUser = { userId: string; userName?: string; clientId: string; role: SessionRuntimeRole }\n',
    "frontend presence actorName",
)
text = replace_once(
    text,
    'export type SessionHpLogRecord = {\n  id: string\n  actorId: string\n  createdAt: string\n',
    'export type SessionHpLogRecord = {\n  id: string\n  actorId: string\n  actorName?: string\n  createdAt: string\n',
    "frontend hp log actorName",
)
write(path, text)

path = "src/features/session-runtime/sessionLogProtocol.ts"
text = read(path)
text = replace_once(
    text,
    'export type SessionRuntimeLogRecord = {\n  id: string\n  actorId: string\n  createdAt: string\n',
    'export type SessionRuntimeLogRecord = {\n  id: string\n  actorId: string\n  actorName?: string\n  createdAt: string\n',
    "frontend runtime log actorName",
)
write(path, text)

# Log UI displays the authenticated name and keeps the stable id as tooltip/fallback.
path = "src/features/session/SessionActionLog.tsx"
text = read(path)
text = replace_once(
    text,
    '        <span className="truncate" title={record.actorId}>{record.actorId}</span>\n',
    '        <span className="truncate" title={record.actorId}>{record.actorName?.trim() || record.actorId}</span>\n',
    "session log actor display",
)
write(path, text)

print("session log actor names patch applied")

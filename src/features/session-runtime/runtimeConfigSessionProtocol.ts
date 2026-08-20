import type { SessionRuntimeConfigSnapshot } from "../../shared/session-runtime/sessionRuntimeConfig"

export type SessionRuntimeConfigPublishMessage = {
  type: "session.config.publish"
  snapshot: SessionRuntimeConfigSnapshot
}

export type SessionRuntimeConfigSnapshotMessage = {
  type: "session.config.snapshot"
  snapshot: SessionRuntimeConfigSnapshot | null
}

export type SessionRuntimeConfigClientMessage = SessionRuntimeConfigPublishMessage
export type SessionRuntimeConfigServerMessage = SessionRuntimeConfigSnapshotMessage

export function parseRuntimeConfigServerMessage(
  raw: string,
): SessionRuntimeConfigServerMessage | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const message = value as Record<string, unknown>
  if (message.type !== "session.config.snapshot") return null
  if (message.snapshot === null) {
    return { type: "session.config.snapshot", snapshot: null }
  }
  if (!isRuntimeConfigSnapshot(message.snapshot)) return null
  return {
    type: "session.config.snapshot",
    snapshot: message.snapshot,
  }
}

function isRuntimeConfigSnapshot(
  value: unknown,
): value is SessionRuntimeConfigSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const snapshot = value as Record<string, unknown>
  if (
    !Number.isInteger(snapshot.creationRevision) ||
    Number(snapshot.creationRevision) < 1 ||
    !snapshot.config ||
    typeof snapshot.config !== "object" ||
    Array.isArray(snapshot.config)
  ) {
    return false
  }

  const config = snapshot.config as Record<string, unknown>
  return (
    Array.isArray(config.characters) &&
    Array.isArray(config.spells) &&
    Array.isArray(config.customSystems)
  )
}

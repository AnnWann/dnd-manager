/** Session-wide master control. This state is authoritative in the session Durable Object. */
export type SessionPauseState = { paused: boolean; updatedAt: string; updatedBy: string | null }
export type SessionPauseClientMessage = { type: "session.pause.set"; paused: boolean }
export type SessionPauseServerMessage = { type: "session.pause.state"; state: SessionPauseState }

/** UI lockdown applies only to players, never to the session master. */
export function shouldBlockPlayerSessionUI(
  role: string | null | undefined,
  state: SessionPauseState | null | undefined,
): boolean {
  return role === "PLAYER" && state?.paused === true
}

/** Only heartbeat/ping remain accepted from players while paused. */
export function isSessionPlayerOperationBlocked(paused: boolean, role: string, type: string | undefined): boolean {
  return paused && role !== "MASTER" && type !== "session.heartbeat" && type !== "session.ping"
}

export function parseSessionPauseMessage(raw: string): SessionPauseClientMessage | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null
    const candidate = value as Record<string, unknown>
    return candidate.type === "session.pause.set" && typeof candidate.paused === "boolean"
      ? { type: "session.pause.set", paused: candidate.paused }
      : null
  } catch {
    return null
  }
}

export function parseSessionPauseServerMessage(raw: string): SessionPauseServerMessage | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null
    const candidate = value as Record<string, unknown>
    if (candidate.type !== "session.pause.state") return null
    const state = candidate.state
    if (typeof state !== "object" || state === null || Array.isArray(state)) return null
    const current = state as Record<string, unknown>
    return typeof current.paused === "boolean"
      && typeof current.updatedAt === "string"
      && (current.updatedBy === null || typeof current.updatedBy === "string")
      ? { type: "session.pause.state", state: { paused: current.paused, updatedAt: current.updatedAt, updatedBy: current.updatedBy as string | null } }
      : null
  } catch {
    return null
  }
}

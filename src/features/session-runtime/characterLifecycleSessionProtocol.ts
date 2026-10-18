import type { Player } from "../../models/player/Player"
import type {
  SessionCharacterLifecycleOperation as SharedOperation,
  SessionCharacterLifecycleClientMessage as SharedMessage,
  SessionCharacterLifecycleState,
  SessionCharacterLifecycleServerMessage,
} from "../../../packages/session-protocol/src/characterLifecycle"
export type SessionCharacterLifecycleOperation = SharedOperation<Player>
export type SessionCharacterLifecycleClientMessage = SharedMessage<Player>
export type { SessionCharacterLifecycleState, SessionCharacterLifecycleServerMessage } from "../../../packages/session-protocol/src/characterLifecycle"

export function parseCharacterLifecycleServerMessage(raw: string): SessionCharacterLifecycleServerMessage | null {
  let value: unknown
  try { value = JSON.parse(raw) } catch { return null }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const parsed = value as Record<string, unknown>

  if (parsed.type === "session.characters.snapshot" && Array.isArray(parsed.characters)) {
    return parsed as SessionCharacterLifecycleServerMessage
  }
  if (parsed.type === "session.character.updated" && parsed.character && typeof parsed.character === "object") {
    return parsed as SessionCharacterLifecycleServerMessage
  }
  if (parsed.type === "session.character.removed" && typeof parsed.characterId === "string") {
    return parsed as SessionCharacterLifecycleServerMessage
  }
  return null
}

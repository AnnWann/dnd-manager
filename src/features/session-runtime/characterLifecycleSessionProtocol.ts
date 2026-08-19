import type { Player } from "../../models/player/Player"

export type SessionCharacterLifecycleOperation =
  | {
      type: "character.session.add"
      characterId: string
      character: Record<string, unknown>
    }
  | {
      type: "character.session.remove"
      characterId: string
    }
  | {
      type: "character.session.owner.set"
      characterId: string
      owner: Player
    }
  | {
      type: "character.session.resync"
      characterId: string
      character: Record<string, unknown>
    }

export type SessionCharacterLifecycleClientMessage = {
  type: "session.character.operation"
  operation: SessionCharacterLifecycleOperation
}

export type SessionCharacterLifecycleState = {
  characterId: string
  character: Record<string, unknown>
  ownerUserId?: string
  active: boolean
  revision: number
}

export type SessionCharacterLifecycleServerMessage =
  | { type: "session.characters.snapshot"; characters: SessionCharacterLifecycleState[] }
  | { type: "session.character.updated"; character: SessionCharacterLifecycleState }
  | { type: "session.character.removed"; characterId: string }

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

import type { CharacterProfile } from "../../models/characters/characterProfile"

export type SessionProfileOperation = {
  type: "character.profile.replace"
  characterId: string
  profile: CharacterProfile
}

export type SessionProfileClientMessage = {
  type: "session.profile.operation"
  operation: SessionProfileOperation
}

import type { CharacterBackground } from "../../models/characters/CharacterBackground"
import type { CharacterProfile } from "../../models/characters/characterProfile"

export type SessionProfileOperation =
  | {
      type: "character.profile.replace"
      characterId: string
      profile: CharacterProfile
    }
  | {
      type: "character.profile.background.save"
      characterId: string
      background: CharacterBackground
      addEquipment: boolean
    }
  | {
      type: "character.profile.background.remove"
      characterId: string
    }

export type SessionProfileClientMessage = {
  type: "session.profile.operation"
  operation: SessionProfileOperation
}

import type { CharacterProfile } from "../../models/characters/characterProfile"
import type { Itemmable } from "../../models/items/item"
import type { Proficiency } from "../../models/sheet/Proficiency"
import type { SkillProficiency } from "../../models/sheet/Skills"

export type SessionProfileOperation = {
  type: "character.profile.replace"
  characterId: string
  profile: CharacterProfile
  inventory: Itemmable[]
  skills: Record<string, SkillProficiency>
  proficiencies: Proficiency[]
}

export type SessionProfileClientMessage = {
  type: "session.profile.operation"
  operation: SessionProfileOperation
}

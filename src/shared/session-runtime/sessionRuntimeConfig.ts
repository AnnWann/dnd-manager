import type {
  CreationCharacterCustomSystemConfiguration,
  CreationState,
} from "../creation/creation.types"
import type { CharacterType } from "../../models/characters/CharacterType"
import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"
import type { Spell } from "../../models/magic/spells/Spell"

/**
 * Small projection of CreationState required by the authoritative session
 * runtime. CreationState remains database-owned; this object is only the
 * configuration cache used to validate/adjudicate live operations.
 */
export type SessionRuntimeConfig = {
  characters: SessionRuntimeCharacterConfig[]
  spells: Spell[]
  customSystems: CustomSystemDefinition[]
}

export type SessionRuntimeCharacterConfig = {
  characterId: string
  type: CharacterType
  visibility: "private" | "party" | "master"
  unique: boolean
  ownerId: string
  customSystems: CreationCharacterCustomSystemConfiguration[]
}

export function toSessionRuntimeConfig(
  creation: CreationState,
): SessionRuntimeConfig {
  return {
    characters: creation.characters.map((character) => ({
      characterId: character.characterId,
      type: character.type,
      visibility: character.visibility,
      unique: character.unique,
      ownerId: character.ownerId,
      customSystems: character.customSystems,
    })),
    spells: creation.spells,
    customSystems: creation.customSystems,
  }
}

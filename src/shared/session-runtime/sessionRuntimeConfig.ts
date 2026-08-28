import type {
  CreationCharacterCustomSystemConfiguration,
  CreationSnapshot,
  CreationState,
} from "../creation/creation.types"
import type { CharacterType } from "../../models/characters/CharacterType"
import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"
import type { CompendiumCreature } from "../../models/creatures/CompendiumCreature"
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
  /** MASTER-only rules data used to adjudicate compendium combatants. */
  creatureCompendium: CompendiumCreature[]
}

export type SessionRuntimeConfigSnapshot = {
  creationRevision: number
  config: SessionRuntimeConfig
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
    creatureCompendium: creation.creatureCompendium,
  }
}

export function toSessionRuntimeConfigSnapshot(
  creation: CreationSnapshot,
): SessionRuntimeConfigSnapshot {
  return {
    creationRevision: creation.revision,
    config: toSessionRuntimeConfig(creation.data),
  }
}

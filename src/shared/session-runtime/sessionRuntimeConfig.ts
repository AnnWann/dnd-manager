import type {
  CreationCharacterCustomSystemConfiguration,
  CreationSnapshot,
  CreationState,
} from "../creation/creation.types"
import type { CharacterType } from "../../models/characters/CharacterType"
import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"
import type { CompendiumCreature } from "../../models/creatures/CompendiumCreature"
import type { Spell } from "../../models/magic/spells/Spell"
import {
  projectCampaignProgressionForPlayers,
  type CampaignProgressionSettings,
} from "../progression/campaignProgression"
import {
  normalizeLongRestSupplySettings,
  type LongRestSupplySettings,
} from "../rest/longRestSupplySettings"

/**
 * Small projection of CreationState required by the authoritative session
 * runtime. CreationState remains database-owned; this object is only the
 * configuration cache used to validate/adjudicate live operations.
 */
export type SessionRuntimeConfig = {
  /** Defaults to true for snapshots created before this setting existed. */
  diceRollingEnabled?: boolean
  /** Player-safe projection. Hidden custom goals are deliberately omitted. */
  progression?: CampaignProgressionSettings
  /** Authoritative long-rest supply policy for this campaign. */
  longRestSupplies?: LongRestSupplySettings
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
  const customSystemVersionById = new Map(
    creation.customSystems.map((definition) => [
      definition.id,
      definition.version,
    ]),
  )

  return {
    diceRollingEnabled: creation.diceRollingEnabled !== false,
    progression: projectCampaignProgressionForPlayers(creation.progression),
    longRestSupplies: normalizeLongRestSupplySettings(creation.longRestSupplies),
    characters: creation.characters.map((character) => ({
      characterId: character.characterId,
      type: character.type,
      visibility: character.visibility,
      unique: character.unique,
      ownerId: character.ownerId,
      customSystems: character.customSystems.map((installation) => ({
        ...installation,
        systemVersion:
          customSystemVersionById.get(installation.systemId)
          ?? installation.systemVersion,
      })),
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

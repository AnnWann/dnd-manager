import type { CharacterType } from "../../models/characters/CharacterType"
import type {
  CustomAbilityAcquisitionExceptionState,
  CustomSystemDefinition,
} from "../../models/customSystems/CustomSystemDefinition"
import type { CompendiumCreature } from "../../models/creatures/CompendiumCreature"
import type { Itemmable } from "../../models/items/item"
import type { Spell } from "../../models/magic/spells/Spell"

/**
 * Persistent configuration authored from the MASTER Creation area.
 *
 * This intentionally excludes workflow/admin state such as pending requests,
 * campaign membership and editor UI state. Those are not part of the draftable
 * Creation document and continue to use their existing APIs until migrated.
 */
export type CreationState = {
  version: 1
  characters: CreationCharacterConfiguration[]
  spells: Spell[]
  itemCompendium: CreationItemCompendiumEntry[]
  creatureCompendium: CompendiumCreature[]
  customSystems: CustomSystemDefinition[]
}

/**
 * Creation-owned character settings only. Live character state (HP, slots,
 * inventory, conditions, initiative, custom resource counters, etc.) must not
 * be copied into CreationState.
 */
export type CreationCharacterConfiguration = {
  characterId: string
  type: CharacterType
  visibility: "private" | "party" | "master"
  unique: boolean
  ownerId: string
  /** Display projection for the session assignment; refreshed from campaign membership. */
  ownerName?: string
  hiddenCharacterTabs: string[]
  customSystems: CreationCharacterCustomSystemConfiguration[]
}

/**
 * Configuration aspects of an installed character custom system. Runtime
 * values such as fields/resources/ability usage remain part of live character
 * state and are deliberately excluded.
 */
export type CreationCharacterCustomSystemConfiguration = {
  systemId: string
  systemVersion: number
  enabled: boolean
  /**
   * A suppressed installation is intentionally removed by the MASTER while
   * retaining a lightweight marker so automatic-install rules do not add it
   * back until the MASTER explicitly reinstalls it.
   */
  suppressed?: boolean
  abilityAcquisitionExceptions?: Record<
    string,
    CustomAbilityAcquisitionExceptionState
  >
  installationSource?: "master" | "automatic"
}

export type CreationItemCompendiumVisibility = "PUBLIC" | "MASTER"

/**
 * Authoring representation of an item-compendium entry. Audit metadata such as
 * createdAt/updatedAt/createdById belongs to persistence, not the editable
 * Creation document.
 */
export type CreationItemCompendiumEntry = {
  templateId: string
  item: Itemmable | null
  custom: boolean
  visibility: CreationItemCompendiumVisibility
}

export type CreationManagedDomains = {
  spells: boolean
  creatureCompendium: boolean
  customSystems: boolean
}

export type CreationSnapshot = {
  revision: number
  updatedAt: string
  data: CreationState
  /**
   * Identifies domains that have already crossed from their legacy stores into
   * the canonical Creation persistence. This prevents intentionally empty
   * canonical domains from being re-seeded from old local/provider data.
   */
  managedDomains?: CreationManagedDomains
}

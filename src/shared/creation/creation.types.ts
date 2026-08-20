import type { CharacterType } from "../../models/characters/CharacterType"
import type { CharacterCustomSystemState } from "../../models/customSystems/CustomSystem"
import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"
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
 * inventory, conditions, initiative, etc.) must not be copied into
 * CreationState.
 */
export type CreationCharacterConfiguration = {
  characterId: string
  type: CharacterType
  visibility: "private" | "party" | "master"
  unique: boolean
  ownerId: string
  hiddenCharacterTabs: string[]
  customSystems: CharacterCustomSystemState[]
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

export type CreationSnapshot = {
  revision: number
  updatedAt: string
  data: CreationState
}

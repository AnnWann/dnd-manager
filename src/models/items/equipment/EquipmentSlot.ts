import type { Ability, Usage } from "../../abilities/Ability"
import type { BonusCollection } from "../../bonuses/Bonus"
import type { SpellGrant } from "../../magic/spells/SpellGrant"
import type { Item } from "../item"

export type { Bonus, BonusCollection } from "../../bonuses/Bonus"

export type EquipmentSpellGrant = SpellGrant & {
  usage: Usage
}

export type Equipment = Item & {
  bonuses?: BonusCollection
  abilities?: Ability[]
  spells?: EquipmentSpellGrant[]
}

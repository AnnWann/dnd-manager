import type { Trigger } from "../../abilities/Ability"
import type { Attribute } from "../../sheet/Attribute"
import type { Item } from "../item"

export type Equipment = Item & {
  bonuses?: {
    armorClass?: Bonus[]
    initiative?: Bonus[]
    maxHp?: Bonus[] 
    temporaryHp?: Bonus[]
    passivePerception?: Bonus[]
    attackBonus?: Bonus[]
    speed?: Bonus[]
    attribute?: {
      attribute: Attribute
      bonus: Bonus
    }[]
    attributeModifier?: {
      attribute: Attribute
      bonus: Bonus
    }[]
    attack?: {
      type: 'always' | 'equipment' | 'conditional'
      condition?: Trigger | string
      bonus: Bonus
    }
    damage?: {
      type: 'always' | 'equipment' | 'conditional'
      condition?: Trigger | string
      bonus: Bonus
    }
  }
}

export type Bonus = {
  type: 'add' | 'sub' | 'flat'
  value: number
}
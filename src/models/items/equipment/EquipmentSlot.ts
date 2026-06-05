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
      Attribute: Attribute
      Bonus: Bonus[]
    }
  }
}

export type Bonus = {
  type: 'add' | 'sub' | 'flat'
  value: number
}
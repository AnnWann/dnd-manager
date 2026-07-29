import type { Attribute } from "../sheet/Attribute"

export type Bonus = {
  type: "add" | "sub" | "flat"
  /** Fallback numérico e compatibilidade com bônus antigos. */
  value: number
  /** Fórmula recalculada com as variáveis atuais da ficha. */
  formula?: string
  label?: string
}

export type BonusCollection = {
  armorClass?: Bonus[]
  initiative?: Bonus[]
  maxHp?: Bonus[]
  temporaryHp?: Bonus[]
  passivePerception?: Bonus[]
  attackBonus?: Bonus[]
  saveDcBonus?: Bonus[]
  damageBonus?: Bonus[]
  speed?: Bonus[]
  attribute?: Array<{
    attribute: Attribute
    bonus: Bonus
  }>
  attributeModifier?: Array<{
    attribute: Attribute
    bonus: Bonus
  }>
  attack?: {
    type: "always" | "equipment" | "conditional"
    condition?: string
    bonus: Bonus
  }
  damage?: {
    type: "always" | "equipment" | "conditional"
    condition?: string
    bonus: Bonus
  }
}

export type NormalBonusKey =
  | "armorClass"
  | "initiative"
  | "maxHp"
  | "temporaryHp"
  | "passivePerception"
  | "attackBonus"
  | "saveDcBonus"
  | "damageBonus"
  | "speed"

export type BonusTarget =
  | NormalBonusKey
  | "attribute"
  | "attributeModifier"

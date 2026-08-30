import type { DamageAffinity } from "../combat/Damage"
import type { Attribute } from "../sheet/Attribute"

export type Bonus = {
  type: "add" | "sub" | "flat"
  /** Fallback numérico e compatibilidade com bônus antigos. */
  value: number
  /** Fórmula recalculada com as variáveis atuais da ficha. */
  formula?: string
  label?: string
}

export type AttributeScopedBonus = {
  /** Ausente significa todos os atributos válidos para o escopo. */
  attribute?: Attribute
  bonus: Bonus
}

export type BonusCollection = {
  armorClass?: Bonus[]
  initiative?: Bonus[]
  maxHp?: Bonus[]
  temporaryHp?: Bonus[]
  passivePerception?: Bonus[]
  /** Afinidades de dano concedidas enquanto a fonte deste conjunto de bônus estiver ativa. */
  damageAffinities?: DamageAffinity[]
  /** Bônus global aplicado a qualquer jogada de ataque. */
  attackBonus?: Bonus[]
  /** Bônus aplicado apenas a ataques com armas. */
  weaponAttackBonus?: AttributeScopedBonus[]
  /** Bônus aplicado apenas a ataques mágicos. */
  spellAttackBonus?: AttributeScopedBonus[]
  /** Bônus global aplicado a qualquer teste de resistência. */
  savingThrowBonus?: Bonus[]
  /** Bônus aplicado a testes de resistência de um atributo específico (ou todos, quando sem atributo). */
  savingThrowAttributeBonus?: AttributeScopedBonus[]
  /** Bônus global aplicado a qualquer CD calculada. */
  saveDcBonus?: Bonus[]
  /** Bônus aplicado apenas a CDs de magia. */
  spellSaveDcBonus?: AttributeScopedBonus[]
  /** Bônus aplicado apenas a CDs de habilidades e efeitos. */
  abilitySaveDcBonus?: AttributeScopedBonus[]
  /** Bônus global aplicado a qualquer rolagem de dano. */
  damageBonus?: Bonus[]
  /** Bônus aplicado apenas a danos com armas. */
  weaponDamageBonus?: AttributeScopedBonus[]
  /** Bônus aplicado apenas a danos mágicos. */
  spellDamageBonus?: AttributeScopedBonus[]
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
  | "savingThrowBonus"
  | "saveDcBonus"
  | "damageBonus"
  | "speed"

export type ScopedBonusKey =
  | "weaponAttackBonus"
  | "spellAttackBonus"
  | "savingThrowAttributeBonus"
  | "weaponDamageBonus"
  | "spellDamageBonus"
  | "spellSaveDcBonus"
  | "abilitySaveDcBonus"

export type BonusTarget =
  | NormalBonusKey
  | ScopedBonusKey
  | "attribute"
  | "attributeModifier"
  | "damageAffinity"

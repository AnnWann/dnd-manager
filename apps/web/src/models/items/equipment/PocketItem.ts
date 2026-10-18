import type { BonusCollection } from "../../bonuses/Bonus"
import type { Die } from "../../dice/Die"
import type { SpellGrant } from "../../magic/spells/SpellGrant"
import type { Item, Itemmable } from "../item"

export type PocketItem = Itemmable & {
  pocketUse?: "stored" | "sheathed" | "consumable" | "throwable"
}

export type ConsumableEffectPersistence = "temporary" | "permanent"

export type ConsumableEffect = {
  /** Identificador estável usado para atualizar o mesmo efeito sem duplicá-lo. */
  id?: string
  /** Nome exibido na condição ou habilidade criada após o consumo. */
  name?: string
  description?: string
  persistence: ConsumableEffectPersistence
  /** Texto narrativo da duração quando o efeito for temporário. */
  durationText?: string
  bonuses?: BonusCollection
  grantedSpells?: SpellGrant[]
}

export type ConsumableItem = Item & {
  kind: "consumable"
  useText?: string
  /** Efeito aplicado ao personagem quando uma unidade for consumida. */
  consumptionEffect?: ConsumableEffect
}

export type ThrowableItem = Item & {
  kind: "throwable"
  range?: string
  damage?: Die
}

import type { Attribute } from "../../sheet/Attribute"
import type { SpellResourceCost } from "./Spell"

export type SpellGrantCastingMode = "source" | "known"

export type SpellGrant = {
  index: string
  castingMode?: SpellGrantCastingMode
  attribute?: Attribute
  /**
   * Custo próprio desta concessão. Quando definido, substitui o contador da
   * habilidade/origem e os espaços normais para esta cópia da magia.
   */
  resourceCost?: SpellResourceCost
}

export function getSpellGrantCastingMode(
  grant: SpellGrant,
): SpellGrantCastingMode {
  return grant.castingMode ?? "source"
}

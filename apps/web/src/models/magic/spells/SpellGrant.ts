import type { CharacterAcquisitionMetadata } from "../../characters/CharacterAcquisition"
import type { Attribute } from "../../sheet/Attribute"
import type { SpellResourceCost } from "./Spell"

export type SpellGrantCastingMode = "source" | "known"

export type AdditionalSpellResourceCost = { resourceId: string; amount: number; mode?: "all" | "oneOf" }

export type SpellGrant = {
  /** Counter payment: cumulative by default; oneOf allows slots OR this counter. */
  additionalResourceCost?: AdditionalSpellResourceCost
  index: string
  /** Cargas do contador da habilidade consumidas por conjuração (padrão: 1). */
  abilityChargeCost?: number
  castingMode?: SpellGrantCastingMode
  attribute?: Attribute
  /**
   * Custo próprio desta concessão. Quando definido, substitui o contador da
   * habilidade/origem e os espaços normais para esta cópia da magia.
   */
  resourceCost?: SpellResourceCost
  acquisition?: CharacterAcquisitionMetadata
}

export function getSpellGrantCastingMode(
  grant: SpellGrant,
): SpellGrantCastingMode {
  return grant.additionalResourceCost ? "known" : grant.castingMode ?? "source"
}

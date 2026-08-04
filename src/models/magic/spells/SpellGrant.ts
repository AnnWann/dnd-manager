import type { CharacterAcquisitionMetadata } from "../../characters/CharacterAcquisition"
import type { Attribute } from "../../sheet/Attribute"

export type SpellGrantCastingMode = "source" | "known"

export type SpellGrant = {
  index: string
  castingMode?: SpellGrantCastingMode
  attribute?: Attribute
  acquisition?: CharacterAcquisitionMetadata
}

export function getSpellGrantCastingMode(
  grant: SpellGrant,
): SpellGrantCastingMode {
  return grant.castingMode ?? "source"
}

import type { Ability } from "../abilities/Ability"
import type { Attribute } from "../sheet/Attribute"
import type { ClassName } from "../sheet/Class"
import type { CharacterAcquisitionMetadata } from "./CharacterAcquisition"

export type CharacterAsiKind = "feat" | "half-feat" | "ability-score"

export type CharacterAsi = {
  id: string
  className: ClassName
  classLevel: number
  kind: CharacterAsiKind
  /** Feats remain full abilities, but are owned by the ASI entry. */
  ability?: Ability
  /** Permanent base-score increases granted by this ASI. */
  increases: Partial<Record<Attribute, number>>
  acquisition?: CharacterAcquisitionMetadata
}

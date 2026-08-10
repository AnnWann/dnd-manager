import type { Ability } from "../abilities/Ability"
import type { Attribute } from "../sheet/Attribute"
import type { ClassName } from "../sheet/Class"
import type { CharacterAcquisitionMetadata } from "./CharacterAcquisition"
import type {
  CharacterTemplate,
  CharacterTemplateProps,
} from "./CharacterTemplate"

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

type CharacterTemplatePropsWithAsi = CharacterTemplateProps & {
  asi?: CharacterAsi[]
}

/**
 * ASIs are persisted as a top-level `asi` field in character JSON. Keeping the
 * read/write logic here prevents the rest of the app from depending on legacy
 * ability storage for feats.
 */
export function getCharacterAsis(character: CharacterTemplate): CharacterAsi[] {
  const props = character.toJSON() as CharacterTemplatePropsWithAsi
  return Array.isArray(props.asi) ? props.asi : []
}

export function withCharacterAsis(
  character: CharacterTemplate,
  asi: CharacterAsi[],
): CharacterTemplate {
  return character.withPatch({ asi } as Partial<CharacterTemplateProps>)
}

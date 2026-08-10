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
 * ASIs are exposed as a top-level `asi` field. `magic.asi` is read only as a
 * compatibility mirror so older CharacterTemplate hydration cannot discard it.
 */
export function getCharacterAsis(character: CharacterTemplate): CharacterAsi[] {
  const props = character.toJSON() as CharacterTemplatePropsWithAsi
  if (Array.isArray(props.asi)) return props.asi
  const mirrored = character.get("magic")?.asi
  return Array.isArray(mirrored) ? mirrored : []
}

export function withCharacterAsis(
  character: CharacterTemplate,
  asi: CharacterAsi[],
): CharacterTemplate {
  const magic = character.getOrCreateMagic()
  const mirrored = character.with("magic", {
    ...magic,
    asi,
  })
  return mirrored.withPatch(
    { asi } as unknown as Partial<CharacterTemplateProps>,
  )
}

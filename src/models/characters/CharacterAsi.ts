import type { Ability } from "../abilities/Ability"
import type { Attribute } from "../sheet/Attribute"
import type { ClassName } from "../sheet/Class"
import type { CharacterAcquisitionMetadata } from "./CharacterAcquisition"
import type { CharacterTemplate } from "./CharacterTemplate"

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

export function getCharacterAsis(character: CharacterTemplate): CharacterAsi[] {
  const direct = character.get("asi")
  if (Array.isArray(direct)) return direct
  const mirrored = character.get("magic")?.asi
  return Array.isArray(mirrored) ? mirrored : []
}

export function withCharacterAsis(
  character: CharacterTemplate,
  asi: CharacterAsi[],
): CharacterTemplate {
  const magic = character.getOrCreateMagic()
  return character
    .with("asi", asi)
    .with("magic", {
      ...magic,
      asi,
    })
}

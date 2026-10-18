import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { ClassName } from "../sheet/Class"

export type DynamicSubclassSpellMode =
  | "expanded-list"
  | "always-prepared"
  | "bonus-known"

export type DynamicSubclassSpellGrant = {
  className: ClassName
  subclassId: string
  classLevel: number
  spellName: string
  mode: DynamicSubclassSpellMode
  sourceName: string
}

/** No subclass spell catalog is bundled. */
export function getDynamicSubclassSpellGrants(
  _character: CharacterTemplate,
  _className: ClassName,
  _subclassId: string | undefined,
  _classLevel: number,
): DynamicSubclassSpellGrant[] {
  return []
}

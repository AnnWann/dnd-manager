import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { Attribute } from "../sheet/Attribute"
import { parseAsiSelection } from "./ProgressionFeatureFinalization"

export function enforceAsiAttributeCaps(
  character: CharacterTemplate,
): CharacterTemplate {
  const affected = new Set<Attribute>()

  for (const classEntry of character.get("sheet").classes ?? []) {
    for (const values of Object.values(classEntry.levelChoices ?? {})) {
      const selection = parseAsiSelection(values[0])
      if (selection?.mode !== "attributes") continue
      for (const increase of selection.increases) {
        affected.add(increase.attribute)
      }
    }
  }

  if (!affected.size) return character

  const sheet = character.get("sheet")
  const attributes = { ...sheet.attributes }
  for (const attribute of affected) {
    const racialBonus = sheet.race.attributeBonus[attribute] ?? 0
    attributes[attribute] = Math.min(
      attributes[attribute],
      Math.max(1, 20 - racialBonus),
    )
  }

  return character.withPatch({
    sheet: {
      ...sheet,
      attributes,
    },
  })
}

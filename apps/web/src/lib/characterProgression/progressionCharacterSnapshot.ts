import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import { ATTRIBUTE_KEYS } from "../../models/sheet/Attribute"

export function createProgressionCalculationCharacter(
  character: CharacterTemplate,
): CharacterTemplate {
  const sheet = character.get("sheet")
  const race = sheet.race
  const attributes = Object.fromEntries(
    ATTRIBUTE_KEYS.map((attribute) => [
      attribute,
      sheet.attributes[attribute] + (race.attributeBonus[attribute] ?? 0),
    ]),
  ) as typeof sheet.attributes

  return character.withPatch({
    sheet: {
      ...sheet,
      attributes,
      race: {
        ...race,
        attributeBonus: {},
      },
    },
  })
}

export function restoreStoredProgressionAttributes(
  character: CharacterTemplate,
  original: CharacterTemplate,
): CharacterTemplate {
  const originalSheet = original.get("sheet")
  const currentSheet = character.get("sheet")

  return character.withPatch({
    sheet: {
      ...currentSheet,
      attributes: { ...originalSheet.attributes },
      race: {
        ...currentSheet.race,
        attributeBonus: { ...originalSheet.race.attributeBonus },
      },
    },
  })
}

import type { CharacterTemplate } from "../characters/CharacterTemplate"

export function prepareCharacterForProgression(
  character: CharacterTemplate,
): CharacterTemplate {
  const magic = character.get("magic") ?? {
    spells: {
      knownSpells: [],
      castingDescriptions: {},
      slots: {},
      pactSlots: {
        level: 0,
        max: 0,
        current: 0,
      },
    },
  }

  return character.with("magic", {
    ...magic,
    spells: {
      ...magic.spells,
      knownSpells: magic.spells.knownSpells ?? [],
      castingDescriptions: magic.spells.castingDescriptions ?? {},
      slots: magic.spells.slots ?? {},
      pactSlots: magic.spells.pactSlots ?? {
        level: 0,
        max: 0,
        current: 0,
      },
    },
    metamagic: magic.metamagic ?? {
      metamagics: [],
      sorceryPoints: {
        max: 0,
        current: 0,
      },
    },
  })
}

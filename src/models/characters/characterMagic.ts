// models/characters/characterMagic.ts

import type { CharacterTemplate } from "./CharacterTemplate"
import type { Magic } from "../magic/Magic"
import type { Slot } from "../magic/spells/LeveledSlots"
import type { Spell } from "../magic/spells/Spell"
import type { MagicCircleLevel } from "../magic/spells/spellDefinitions"
import {
  deriveLeveledSlotsFromClasses,
} from "../magic/spells/SpellSlotProgression"
import { derivePactSlotsFromClasses } from "../magic/spells/WarlockSpellSlotProgression"

function createEmptyMagic(): Magic {
  return {
    spells: {
      knownSpells: [],
      slots: {},
      pactSlots: {
        level: 0,
        max: 0,
        current: 0,
      },
    },
    metamagic: [],
  }
}

export function getOrCreateMagic(
  character: CharacterTemplate,
): Magic {
  return character.get("magic") ?? createEmptyMagic()
}

export function ensureMagic(
  character: CharacterTemplate,
): CharacterTemplate {
  if (character.get("magic")) return character

  return character.with("magic", createEmptyMagic())
}

export function getSpells(
  character: CharacterTemplate,
): Spell[] {
  return character.get("magic")?.spells.knownSpells ?? []
}

export function addSpell(
  character: CharacterTemplate,
  spell: Spell,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)

  const alreadyExists = currentMagic.spells.knownSpells.some(
    (s) => s.index === spell.index,
  )

  if (alreadyExists) return character

  return character.with("magic", {
    ...currentMagic,
    spells: {
      ...currentMagic.spells,
      knownSpells: [
        ...currentMagic.spells.knownSpells,
        spell,
      ],
    },
  })
}

export function updateSpell(
  character: CharacterTemplate,
  spell: Spell,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)

  const exists = currentMagic.spells.knownSpells.some(
    (s) => s.index === spell.index,
  )

  if (!exists) {
    return addSpell(character, spell)
  }

  return character.with("magic", {
    ...currentMagic,
    spells: {
      ...currentMagic.spells,
      knownSpells: currentMagic.spells.knownSpells.map((s) =>
        s.index === spell.index ? spell : s,
      ),
    },
  })
}

export function removeSpell(
  character: CharacterTemplate,
  spellIndex: string,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)

  return character.with("magic", {
    ...currentMagic,
    spells: {
      ...currentMagic.spells,
      knownSpells: currentMagic.spells.knownSpells.filter(
        (spell) => spell.index !== spellIndex,
      ),
    },
  })
}

export function setSpellPrepared(
  character: CharacterTemplate,
  spellIndex: string,
  prepared: boolean,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)

  return character.with("magic", {
    ...currentMagic,
    spells: {
      ...currentMagic.spells,
      knownSpells: currentMagic.spells.knownSpells.map((spell) =>
        spell.index === spellIndex
          ? {
              ...spell,
              prepared,
            }
          : spell,
      ),
    },
  })
}

export function getDerivedSpellSlots(
  character: CharacterTemplate,
): Partial<Record<MagicCircleLevel, Slot>> {
  return deriveLeveledSlotsFromClasses(
    character.get("sheet").classes ?? [],
  )
}

export function getDerivedPactSlots(
  character: CharacterTemplate,
): Slot | undefined {
  return derivePactSlotsFromClasses(
    character.get("sheet").classes ?? [],
  )
}

export function getSpellSlots(
  character: CharacterTemplate,
): Partial<Record<MagicCircleLevel, Slot>> {
  const derivedSlots = getDerivedSpellSlots(character)
  const savedSlots = character.get("magic")?.spells.slots ?? {}

  if (character.get("sheet").type !== "pc") {
    return savedSlots
  }

  const nextSlots: Partial<Record<MagicCircleLevel, Slot>> = {}

  for (const [levelKey, derivedSlot] of Object.entries(derivedSlots)) {
    const level = Number(levelKey) as MagicCircleLevel
    const savedSlot = savedSlots[level]

    if (!derivedSlot) continue

    nextSlots[level] = {
      level,
      max: derivedSlot.max,
      current: Math.min(
        savedSlot?.current ?? derivedSlot.max,
        derivedSlot.max,
      ),
    }
  }

  return nextSlots
}

export function getPactSlots(
  character: CharacterTemplate,
): Slot | undefined {
  const derivedPactSlots = getDerivedPactSlots(character)
  const savedPactSlots = character.get("magic")?.spells.pactSlots

  if (character.get("sheet").type !== "pc") {
    return savedPactSlots
  }

  if (!derivedPactSlots || derivedPactSlots.max <= 0) {
    return undefined
  }

  return {
    ...derivedPactSlots,
    current: Math.min(
      savedPactSlots?.current ?? derivedPactSlots.max,
      derivedPactSlots.max,
    ),
  }
}

export function syncMagicWithClasses(
  character: CharacterTemplate,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)

  return character.with("magic", {
    ...currentMagic,
    spells: {
      ...currentMagic.spells,
      slots: getSpellSlots(character),
      pactSlots: getPactSlots(character) ?? {
        level: 0,
        max: 0,
        current: 0,
      },
    },
  })
}

export function spendSpellSlot(
  character: CharacterTemplate,
  level: MagicCircleLevel,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)
  const slots = getSpellSlots(character)
  const slot = slots[level]

  if (!slot || slot.current <= 0) return character

  return character.with("magic", {
    ...currentMagic,
    spells: {
      ...currentMagic.spells,
      slots: {
        ...currentMagic.spells.slots,
        [level]: {
          ...slot,
          current: slot.current - 1,
        },
      },
    },
  })
}

export function restoreSpellSlot(
  character: CharacterTemplate,
  level: MagicCircleLevel,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)
  const slots = getSpellSlots(character)
  const slot = slots[level]

  if (!slot) return character

  return character.with("magic", {
    ...currentMagic,
    spells: {
      ...currentMagic.spells,
      slots: {
        ...currentMagic.spells.slots,
        [level]: {
          ...slot,
          current: Math.min(slot.max, slot.current + 1),
        },
      },
    },
  })
}

export function spendPactSlot(
  character: CharacterTemplate,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)
  const pactSlots = getPactSlots(character)

  if (!pactSlots || pactSlots.current <= 0) return character

  return character.with("magic", {
    ...currentMagic,
    spells: {
      ...currentMagic.spells,
      pactSlots: {
        ...pactSlots,
        current: pactSlots.current - 1,
      },
    },
  })
}

export function restorePactSlot(
  character: CharacterTemplate,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)
  const pactSlots = getPactSlots(character)

  if (!pactSlots) return character

  return character.with("magic", {
    ...currentMagic,
    spells: {
      ...currentMagic.spells,
      pactSlots: {
        ...pactSlots,
        current: Math.min(pactSlots.max, pactSlots.current + 1),
      },
    },
  })
}
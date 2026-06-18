// models/characters/characterMagic.ts

import type { CharacterTemplate } from "./CharacterTemplate"
import type { Magic } from "../magic/Magic"
import type { Slot } from "../magic/spells/LeveledSlots"
import type { CharacterSpells } from "../magic/spells/CharacterSpells"
import type { MagicCircleLevel } from "../magic/spells/spellDefinitions"
import { deriveLeveledSlotsFromClasses } from "../magic/spells/SpellSlotProgression"
import { derivePactSlotsFromClasses } from "../magic/spells/WarlockSpellSlotProgression"
import type { MetamagicId } from "../magic/metamagic/Metamagic"
import type { CharacterMetamagics } from "../magic/metamagic/CharacterMetamagics"
import type { SpellSource } from "../magic/spells/SpellSource"

type KnownSpellEntry = CharacterSpells["knownSpells"][number]

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
  }
}

export function getOrCreateMagic(character: CharacterTemplate): Magic {
  return character.get("magic") ?? createEmptyMagic()
}

function getOrCreateMetamagic(character: CharacterTemplate): CharacterMetamagics {
  const metamagic = getOrCreateMagic(character).metamagic

  return {
    metamagics: metamagic?.metamagics ?? [],
    sorceryPoints: metamagic?.sorceryPoints ?? {
      max: 0,
      current: 0,
    },
  }
}

export function ensureMagic(character: CharacterTemplate): CharacterTemplate {
  if (character.get("magic")) return character

  return character.with("magic", createEmptyMagic())
}

export function getSpells(character: CharacterTemplate): KnownSpellEntry[] {
  return character.get("magic")?.spells.knownSpells ?? []
}

export function addSpell(
  character: CharacterTemplate,
  spellEntry: KnownSpellEntry,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)

  const alreadyExists = currentMagic.spells.knownSpells.some(
    (entry) => entry.spells.id === spellEntry.spells.id,
  )

  if (alreadyExists) return character

  return character.with("magic", {
    ...currentMagic,
    spells: {
      ...currentMagic.spells,
      knownSpells: [
        ...currentMagic.spells.knownSpells,
        spellEntry,
      ],
    },
  })
}

export function updateSpell(
  character: CharacterTemplate,
  spellEntry: KnownSpellEntry,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)

  const exists = currentMagic.spells.knownSpells.some(
    (entry) => entry.spells.id === spellEntry.spells.id,
  )

  if (!exists) {
    return addSpell(character, spellEntry)
  }

  return character.with("magic", {
    ...currentMagic,
    spells: {
      ...currentMagic.spells,
      knownSpells: currentMagic.spells.knownSpells.map((entry) =>
        entry.spells.id === spellEntry.spells.id ? spellEntry : entry,
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
        (entry) => entry.spells.id !== spellIndex,
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
      knownSpells: currentMagic.spells.knownSpells.map((entry) =>
        entry.spells.id === spellIndex
          ? {
              ...entry,
              spells: {
                ...entry.spells,
                prepared,
              },
            }
          : entry,
      ),
    },
  })
}

export function getDerivedSpellSlots(
  character: CharacterTemplate,
): Partial<Record<MagicCircleLevel, Slot>> {
  return deriveLeveledSlotsFromClasses(character.get("sheet").classes ?? [])
}

export function getDerivedPactSlots(
  character: CharacterTemplate,
): Slot | undefined {
  return derivePactSlotsFromClasses(character.get("sheet").classes ?? [])
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

export function getPactSlots(character: CharacterTemplate): Slot | undefined {
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
  const currentMetamagic = getOrCreateMetamagic(character)
  const derivedSorceryPoints = getDerivedSorceryPoints(character)

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
    metamagic: {
      ...currentMetamagic,
      sorceryPoints: {
        max: derivedSorceryPoints.max,
        current: Math.min(
          currentMetamagic.sorceryPoints.current || derivedSorceryPoints.max,
          derivedSorceryPoints.max,
        ),
      },
    },
  })
}

function getDerivedSorceryPoints(character: CharacterTemplate) {
  const sorcererLevel = character.getClassLevel("sorcerer")

  if (sorcererLevel < 2) 
    return {
      max: 0,
      current: 0
    }

  return {
    max: sorcererLevel,
    current: sorcererLevel,
  }
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

export function spendPactSlot(character: CharacterTemplate): CharacterTemplate {
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

export function restorePactSlot(character: CharacterTemplate): CharacterTemplate {
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

export function addMetamagic(
  character: CharacterTemplate,
  metamagicId: MetamagicId,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)
  const currentMetamagic = getOrCreateMetamagic(character)

  if (currentMetamagic.metamagics.includes(metamagicId)) {
    return character
  }

  return character.with("magic", {
    ...currentMagic,
    metamagic: {
      ...currentMetamagic,
      metamagics: [...currentMetamagic.metamagics, metamagicId],
    },
  })
}

export function removeMetamagic(
  character: CharacterTemplate,
  metamagicId: MetamagicId,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)
  const currentMetamagic = getOrCreateMetamagic(character)

  return character.with("magic", {
    ...currentMagic,
    metamagic: {
      ...currentMetamagic,
      metamagics: currentMetamagic.metamagics.filter(
        (id) => id !== metamagicId,
      ),
    },
  })
}

export function setSorceryPoints(
  character: CharacterTemplate,
  current: number,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)
 const currentMetamagic = getOrCreateMetamagic(character)

  return character.with("magic", {
    ...currentMagic,
    metamagic: {
      ...currentMetamagic,
      sorceryPoints: {
        ...currentMetamagic.sorceryPoints,
        current: Math.max(
          0,
          Math.min(current, currentMetamagic.sorceryPoints.max),
        ),
      },
    },
  })
}

export function getSorceryPoints(character: CharacterTemplate) {
  const currentMagic = getOrCreateMagic(character)
  const sorceryPoints = currentMagic.metamagic?.sorceryPoints

  return sorceryPoints ?? {
    max: 0,
    current: 0,
  }
}

export function spendSorceryPoint(
  character: CharacterTemplate,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)
  const currentMetamagic = getOrCreateMetamagic(character)

  if (currentMetamagic.sorceryPoints.current <= 0) return character

  return character.with("magic", {
    ...currentMagic,
    metamagic: {
      ...currentMetamagic,
      sorceryPoints: {
        ...currentMetamagic.sorceryPoints,
        current: currentMetamagic.sorceryPoints.current - 1,
      },
    },
  })
}

export function restoreSorceryPoint(
  character: CharacterTemplate,
): CharacterTemplate {
  const currentMagic = getOrCreateMagic(character)
  const currentMetamagic = getOrCreateMetamagic(character)

  if (
    currentMetamagic.sorceryPoints.current >=
    currentMetamagic.sorceryPoints.max
  ) {
    return character
  }

  return character.with("magic", {
    ...currentMagic,
    metamagic: {
      ...currentMetamagic,
      sorceryPoints: {
        ...currentMetamagic.sorceryPoints,
        current: currentMetamagic.sorceryPoints.current + 1,
      },
    },
  })
}

export function getSpellSource(
  character: CharacterTemplate,
  spellId: string,
): SpellSource | undefined {
  return character
    .get("magic")
    ?.spells.knownSpells.find(
      (entry) => entry.spells.id === spellId,
    )?.source
}
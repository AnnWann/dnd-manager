import type { Magic } from "../magic/Magic"
import type { CharacterTemplate } from "./CharacterTemplate"

export type SorceryPointPool = {
  max: number
  current: number
}

export function getSorcererLevel(character: CharacterTemplate): number {
  return (character.get("sheet").classes ?? []).reduce((total, classData) => {
    const rawClassName = String(classData.className ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()

    if (rawClassName !== "sorcerer" && rawClassName !== "feiticeiro") {
      return total
    }

    const level = Number(classData.level)
    return total + (Number.isFinite(level) ? Math.max(0, Math.trunc(level)) : 0)
  }, 0)
}

export function getDerivedSorceryPointMaximum(
  character: CharacterTemplate,
): number {
  const sorcererLevel = getSorcererLevel(character)
  return sorcererLevel >= 2 ? sorcererLevel : 0
}

export function getSorceryPointPool(
  character: CharacterTemplate,
): SorceryPointPool {
  const max = getDerivedSorceryPointMaximum(character)
  if (max <= 0) return { max: 0, current: 0 }

  const saved = character.get("magic")?.metamagic?.sorceryPoints

  // Old characters often persisted the empty fallback { max: 0, current: 0 }.
  // Treat that as uninitialized instead of as a genuinely spent resource.
  if (!saved || !Number.isFinite(saved.max) || saved.max <= 0) {
    return { max, current: max }
  }

  const savedCurrent = Number(saved.current)
  const current = Number.isFinite(savedCurrent)
    ? Math.max(0, Math.min(max, Math.trunc(savedCurrent)))
    : max

  return { max, current }
}

export function isSorceryPointPoolSynchronized(
  character: CharacterTemplate,
): boolean {
  const saved = character.get("magic")?.metamagic?.sorceryPoints
  const effective = getSorceryPointPool(character)

  return (
    saved?.max === effective.max &&
    saved?.current === effective.current
  )
}

export function synchronizeSorceryPointPool(
  character: CharacterTemplate,
): CharacterTemplate {
  return writeSorceryPointPool(character, getSorceryPointPool(character))
}

export function setSorceryPointCurrent(
  character: CharacterTemplate,
  current: number,
): CharacterTemplate {
  const pool = getSorceryPointPool(character)

  return writeSorceryPointPool(character, {
    max: pool.max,
    current: Math.max(0, Math.min(pool.max, Math.trunc(current))),
  })
}

export function spendSorceryPointDerived(
  character: CharacterTemplate,
): CharacterTemplate {
  const pool = getSorceryPointPool(character)
  if (pool.current <= 0) return synchronizeSorceryPointPool(character)

  return writeSorceryPointPool(character, {
    ...pool,
    current: pool.current - 1,
  })
}

export function restoreSorceryPointDerived(
  character: CharacterTemplate,
): CharacterTemplate {
  const pool = getSorceryPointPool(character)
  if (pool.current >= pool.max) return synchronizeSorceryPointPool(character)

  return writeSorceryPointPool(character, {
    ...pool,
    current: pool.current + 1,
  })
}

export function restoreSorceryPointsByFraction(
  character: CharacterTemplate,
  fraction: number,
): CharacterTemplate {
  const pool = getSorceryPointPool(character)
  const normalizedFraction = Math.max(0, Math.min(1, fraction))
  const missing = Math.max(0, pool.max - pool.current)
  const recovered = Math.ceil(missing * normalizedFraction)

  return writeSorceryPointPool(character, {
    ...pool,
    current: Math.min(pool.max, pool.current + recovered),
  })
}

function writeSorceryPointPool(
  character: CharacterTemplate,
  sorceryPoints: SorceryPointPool,
): CharacterTemplate {
  const currentMagic = character.get("magic") ?? createEmptyMagic()
  const currentMetamagic = currentMagic.metamagic

  return character.with("magic", {
    ...currentMagic,
    metamagic: {
      metamagics: currentMetamagic?.metamagics ?? [],
      ...currentMetamagic,
      sorceryPoints,
    },
  })
}

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

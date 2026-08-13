import type { CharacterTemplate } from "./CharacterTemplate"

export type KiPool = {
  max: number
  current: number
  used: number
}

export function getKiMax(character: CharacterTemplate): number {
  const monkLevel = character.getClassLevel("monk")
  return monkLevel >= 2 ? monkLevel : 0
}

export function getKiPool(character: CharacterTemplate): KiPool | undefined {
  const max = getKiMax(character)
  if (max <= 0) return undefined

  const savedUsed = character.get("magic")?.ki?.used ?? 0
  const used = Math.min(max, Math.max(0, Math.trunc(savedUsed) || 0))

  return {
    max,
    used,
    current: max - used,
  }
}

export function spendKi(
  character: CharacterTemplate,
  amount = 1,
): CharacterTemplate {
  const pool = getKiPool(character)
  const normalizedAmount = Math.max(0, Math.trunc(amount) || 0)
  if (!pool || normalizedAmount <= 0 || pool.current < normalizedAmount) {
    return character
  }
  return withKiUsed(character, pool.used + normalizedAmount)
}

export function restoreKi(
  character: CharacterTemplate,
  amount = 1,
): CharacterTemplate {
  const pool = getKiPool(character)
  const normalizedAmount = Math.max(0, Math.trunc(amount) || 0)
  if (!pool || normalizedAmount <= 0 || pool.used <= 0) return character
  return withKiUsed(character, pool.used - normalizedAmount)
}

export function recoverKi(character: CharacterTemplate): CharacterTemplate {
  const pool = getKiPool(character)
  if (!pool || pool.used <= 0) return character
  return withKiUsed(character, 0)
}

function withKiUsed(
  character: CharacterTemplate,
  used: number,
): CharacterTemplate {
  const max = getKiMax(character)
  if (max <= 0) return character

  const magic = character.getOrCreateMagic()
  return character.with("magic", {
    ...magic,
    ki: {
      used: Math.min(max, Math.max(0, Math.trunc(used) || 0)),
    },
  })
}

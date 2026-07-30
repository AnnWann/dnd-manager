import type { CharacterTemplate } from "./CharacterTemplate"

export type ChannelDivinityPool = {
  max: number
  current: number
  used: number
}

export function getChannelDivinityMax(
  character: CharacterTemplate,
): number {
  const clericLevel = character.getClassLevel("cleric")
  const paladinLevel = character.getClassLevel("paladin")

  const clericUses =
    clericLevel >= 18
      ? 3
      : clericLevel >= 6
        ? 2
        : clericLevel >= 2
          ? 1
          : 0
  const paladinUses = paladinLevel >= 3 ? 1 : 0

  // Multiclassing grants additional Channel Divinity options, not additive uses.
  return Math.max(clericUses, paladinUses)
}

export function getChannelDivinityPool(
  character: CharacterTemplate,
): ChannelDivinityPool | undefined {
  const max = getChannelDivinityMax(character)
  if (max <= 0) return undefined

  const savedUsed = character.get("magic")?.channelDivinity?.used ?? 0
  const used = Math.min(max, Math.max(0, Math.trunc(savedUsed) || 0))

  return {
    max,
    used,
    current: max - used,
  }
}

export function spendChannelDivinity(
  character: CharacterTemplate,
): CharacterTemplate {
  const pool = getChannelDivinityPool(character)
  if (!pool || pool.current <= 0) return character
  return withChannelDivinityUsed(character, pool.used + 1)
}

export function restoreChannelDivinity(
  character: CharacterTemplate,
): CharacterTemplate {
  const pool = getChannelDivinityPool(character)
  if (!pool || pool.used <= 0) return character
  return withChannelDivinityUsed(character, pool.used - 1)
}

export function recoverChannelDivinity(
  character: CharacterTemplate,
  fraction = 1,
): CharacterTemplate {
  const pool = getChannelDivinityPool(character)
  if (!pool || pool.used <= 0) return character

  const normalizedFraction = Math.max(0, Math.min(1, fraction))
  const recovered = Math.ceil(pool.used * normalizedFraction)
  return withChannelDivinityUsed(character, pool.used - recovered)
}

function withChannelDivinityUsed(
  character: CharacterTemplate,
  used: number,
): CharacterTemplate {
  const max = getChannelDivinityMax(character)
  if (max <= 0) return character

  const magic = character.getOrCreateMagic()
  return character.with("magic", {
    ...magic,
    channelDivinity: {
      used: Math.min(max, Math.max(0, Math.trunc(used) || 0)),
    },
  })
}

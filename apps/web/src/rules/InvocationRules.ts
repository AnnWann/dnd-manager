export function getInvocationLimit(warlockLevel: number): number {
  const level = Math.max(0, Math.min(20, Math.trunc(warlockLevel || 0)))
  if (level < 2) return 0
  if (level < 5) return 2
  if (level < 7) return 3
  if (level < 9) return 4
  if (level < 12) return 5
  if (level < 15) return 6
  if (level < 18) return 7
  return 8
}

/** A Warlock that already has invocations may exchange one on each later Warlock level. */
export function getInvocationReplacementLimit(warlockLevel: number): number {
  const level = Math.max(0, Math.min(20, Math.trunc(warlockLevel || 0)))
  return level >= 3 ? 1 : 0
}

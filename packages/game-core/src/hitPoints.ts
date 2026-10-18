/** Framework-independent HP arithmetic. Values are supplied by the host character model. */
export type HitPointPool = { current: number; temporary: number }
export function applyHitPointDamage<T extends HitPointPool>(hp: T, damage: number): T {
  const amount = Math.max(0, damage)
  let remaining = amount
  let temporary = hp.temporary
  if (temporary > 0) {
    const absorbed = Math.min(temporary, remaining)
    temporary -= absorbed
    remaining -= absorbed
  }
  return { ...hp, temporary, current: Math.max(0, hp.current - remaining) }
}
export function applyHitPointHealing<T extends HitPointPool>(hp: T, amount: number, maxHp: number): T {
  return { ...hp, current: Math.min(maxHp, hp.current + Math.max(0, amount)) }
}
export function applyTemporaryHitPoints<T extends HitPointPool>(hp: T, amount: number): T {
  return { ...hp, temporary: Math.max(hp.temporary, Math.max(0, amount)) }
}

import type { SpellEffect } from '../features/models/types'

export function effectsEqual(a: SpellEffect[] | undefined, b: SpellEffect[] | undefined): boolean {
  const aa = a ?? []
  const bb = b ?? []
  if (aa.length !== bb.length) return false
  for (let i = 0; i < aa.length; i++) {
    if (JSON.stringify(aa[i]) !== JSON.stringify(bb[i])) return false
  }
  return true
}

export function cloneEffects(effects: SpellEffect[] | undefined): SpellEffect[] | undefined {
  if (!effects) return undefined
  return effects.map((e) => ({
    ...e,
    rollAppliesTo: e.rollAppliesTo ? [...e.rollAppliesTo] : undefined,
  }))
}

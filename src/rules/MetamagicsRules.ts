import type { Metamagic, MetamagicId } from "../models/magic/metamagic/Metamagic";

export const metamagicRules: Record<
  MetamagicId,
  Omit<Metamagic, 'id' | 'name' | 'desc'>
> = {
  'careful-spell': {
    sorceryPointCost: 1,
    timing: 'on-cast',
    canCombineWithOtherMetamagic: false,
    isAvailableForSpell: (spell) =>
      spell.targeting.hasSavingThrow && spell.targeting.affectsArea,
  },

  'distant-spell': {
    sorceryPointCost: 1,
    timing: 'on-cast',
    canCombineWithOtherMetamagic: false,
    isAvailableForSpell: (spell) =>
      spell.range.origin !== 'self',
  },

  'empowered-spell': {
    sorceryPointCost: 1,
    timing: 'on-damage-roll',
    canCombineWithOtherMetamagic: true,
    isAvailableForSpell: (spell) =>
      !!spell.damageDice,
  },

  'extended-spell': {
    sorceryPointCost: 1,
    timing: 'on-cast',
    canCombineWithOtherMetamagic: false,
    isAvailableForSpell: (spell) =>
      spell.duration.value >= 1 && spell.duration.unit !== 'instantaneous',
  },

  'heightened-spell': {
    sorceryPointCost: 3,
    timing: 'on-cast',
    canCombineWithOtherMetamagic: false,
    isAvailableForSpell: (spell) =>
      spell.targeting.hasSavingThrow,
  },

  'quickened-spell': {
    sorceryPointCost: 2,
    timing: 'on-cast',
    canCombineWithOtherMetamagic: false,
    isAvailableForSpell: (spell) =>
      spell.castingTime.type === 'action',
  },

  'seeking-spell': {
    sorceryPointCost: 2,
    timing: 'on-miss',
    canCombineWithOtherMetamagic: true,
    isAvailableForSpell: (spell) =>
      spell.targeting.hasAttackRoll,
  },

  'subtle-spell': {
    sorceryPointCost: 1,
    timing: 'on-cast',
    canCombineWithOtherMetamagic: false,
    isAvailableForSpell: (spell) =>
      spell.components.includes('V') || spell.components.includes('S'),
  },

  'transmuted-spell': {
    sorceryPointCost: 1,
    timing: 'on-cast',
    canCombineWithOtherMetamagic: false,
    isAvailableForSpell: (spell) =>
      !!spell.damageDice,
  },

  'twinned-spell': {
    sorceryPointCost: 'spell-level',
    timing: 'on-cast',
    canCombineWithOtherMetamagic: false,
    isAvailableForSpell: (spell) =>
      spell.targeting.kind === 'single-creature' &&
      spell.targeting.targetCount === 1 &&
      !spell.targeting.canTargetMoreAtHigherLevels &&
      spell.range.origin !== 'self',
  },
}

export function getMetamagicLimit(sorcererLevel: number): number {
  if (sorcererLevel < 3) return 0
  if (sorcererLevel < 10) return 2
  if (sorcererLevel < 17) return 3
  return 4
}

/** One metamagic may be exchanged on Sorcerer ASI levels. */
export function getMetamagicReplacementLimit(sorcererLevel: number): number {
  return [4, 8, 12, 16, 19].includes(Math.trunc(sorcererLevel || 0)) ? 1 : 0
}

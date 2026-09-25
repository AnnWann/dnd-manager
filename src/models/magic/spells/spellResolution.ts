import type {
  Spell,
  SpellDamageComponent,
  SpellNumericScaling,
  SpellResolution,
  SpellScaledNumber,
} from "./Spell"

export type SpellResolutionContext = {
  castLevel: number
  characterLevel: number
}

export function getEffectiveSpellResolution(spell: Spell): SpellResolution {
  if (spell.resolution) return spell.resolution

  return {
    roll: spell.targeting.hasAttackRoll
      ? { type: "attack" }
      : spell.targeting.hasSavingThrow && spell.targeting.savingThrowAttribute
        ? {
            type: "save",
            attribute: spell.targeting.savingThrowAttribute,
            onSuccess: "none",
          }
        : { type: "none" },
    damage: spell.damageDice
      ? [{
          id: "legacy-damage",
          label: "Dano",
          dice: {
            quantity: spell.damageDice.quantity,
            sides: spell.damageDice.sides,
          },
          appliesOn: spell.targeting.hasAttackRoll
            ? "hit"
            : spell.targeting.hasSavingThrow
              ? "failed-save"
              : "always",
          critical: spell.targeting.hasAttackRoll,
        }]
      : undefined,
  }
}

export function evaluateSpellScaledNumber(
  value: SpellScaledNumber | undefined,
  context: SpellResolutionContext,
  fallback = 1,
): number {
  if (!value) return fallback
  return Math.max(0, Math.trunc(value.base) + evaluateSpellScaling(value.scaling, context))
}

export function evaluateSpellDamageDiceQuantity(
  component: SpellDamageComponent,
  context: SpellResolutionContext,
): number {
  return Math.max(
    0,
    Math.trunc(component.dice.quantity)
      + evaluateSpellScaling(component.diceScaling, context),
  )
}

export function evaluateSpellScaling(
  scaling: SpellNumericScaling | undefined,
  context: SpellResolutionContext,
): number {
  if (!scaling) return 0
  const level = scaling.source === "slot-level"
    ? context.castLevel
    : context.characterLevel

  if (scaling.type === "thresholds") {
    return scaling.thresholds
      .filter((entry) => level >= Math.max(0, Math.trunc(entry.level)))
      .reduce((total, entry) => total + Math.trunc(entry.amount), 0)
  }

  const interval = Math.max(1, Math.trunc(scaling.interval) || 1)
  const startLevel = Math.max(0, Math.trunc(scaling.startLevel))
  const completedSteps = Math.max(0, Math.floor((level - startLevel) / interval))
  const steps = scaling.maxSteps === undefined
    ? completedSteps
    : Math.min(completedSteps, Math.max(0, Math.trunc(scaling.maxSteps)))

  return steps * Math.trunc(scaling.amountPerStep)
}

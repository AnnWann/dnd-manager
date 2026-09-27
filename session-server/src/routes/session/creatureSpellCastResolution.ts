import { abilityShortPtBr } from "../../../../src/i18n/ptBR"
import {
  getCreatureEffectiveAbilityModifier,
  getCreatureEffectiveSpellAttackBonus,
  getCreatureEffectiveSpellDamageBonus,
  getCreatureEffectiveSpellSaveDc,
} from "../../../../src/models/creatures/CreatureCombatRuntime"
import type { CompendiumCreature } from "../../../../src/models/creatures/CompendiumCreature"
import type { InitiativeEntry } from "../../../../src/models/initiative/Initiative"
import type { Spell } from "../../../../src/models/magic/spells/Spell"
import {
  evaluateSpellDamageDiceQuantity,
  evaluateSpellScaledNumber,
  getEffectiveSpellResolution,
} from "../../../../src/models/magic/spells/spellResolution"
import type {
  SessionActionInstanceResult,
  SessionActionRollResult,
  SessionDiceRollMode,
  SessionResolvedD20Roll,
  SessionResolvedDamageRoll,
  SessionRollVisibility,
} from "../../../../src/shared/session-runtime/diceRollProtocol"

const MAX_SPELL_INSTANCES = 100
const MAX_SPELL_DAMAGE_COMPONENTS = 20
const MAX_DICE_PER_DAMAGE_COMPONENT = 200

export function resolveCreatureSpellCastAction(args: {
  requestId: string
  actorId: string
  creature: CompendiumCreature
  entry?: InitiativeEntry
  spell: Spell
  castLevel: number
  mode: SessionDiceRollMode
  visibility?: SessionRollVisibility
  rollDice?: boolean
}): SessionActionRollResult {
  const {
    requestId,
    actorId,
    creature,
    entry,
    spell,
    castLevel,
    mode,
    visibility,
    rollDice = true,
  } = args
  const spellcasting = creature.spellcasting
  if (!spellcasting) {
    throw new Error("Creature does not have spellcasting configured.")
  }

  const conditions = entry?.conditions ?? []
  const resolution = getEffectiveSpellResolution(spell)
  const context = {
    castLevel,
    characterLevel: Math.max(1, Math.trunc(spellcasting.casterLevel)),
  }
  const attackBonus = getCreatureEffectiveSpellAttackBonus(
    creature,
    conditions,
    entry,
  )
  const saveDc = getCreatureEffectiveSpellSaveDc(
    creature,
    conditions,
    entry,
  )

  const base = {
    id: crypto.randomUUID(),
    requestId,
    actorId,
    characterId: `creature:${entry?.id ?? creature.id}`,
    visibility: visibility ?? "public",
    sourceName: creature.name,
    sourceType: "creature" as const,
    title: spell.displayName || spell.name,
    subtitle: `${creature.name} · ${spell.slotLevel === 0 ? "Truque" : `Magia de nível ${spell.slotLevel}`}`,
    description: joinDescription(
      spell.description,
      spell.higherLevelText?.trim()
        ? `Em níveis superiores: ${spell.higherLevelText}`
        : undefined,
    ),
    details: [
      `Atributo de conjuração: ${abilityShortPtBr(spellcasting.ability)}`,
      ...(castLevel > spell.slotLevel
        ? [`Conjurada no nível ${castLevel}`]
        : []),
      ...(spell.concentration ? ["Concentração"] : []),
      ...(spell.ritual ? ["Ritual"] : []),
    ],
    castLevel,
    createdAt: new Date().toISOString(),
  }

  if (!rollDice) {
    return { ...base, critical: false }
  }

  if ((resolution.damage?.length ?? 0) > MAX_SPELL_DAMAGE_COMPONENTS) {
    throw new Error("Spell resolution has too many damage components.")
  }

  const instanceCount = Math.max(
    1,
    evaluateSpellScaledNumber(resolution.instances, context, 1),
  )
  if (instanceCount > MAX_SPELL_INSTANCES) {
    throw new Error("Spell resolution has too many independent instances.")
  }

  if (resolution.roll.type === "attack") {
    if (attackBonus === undefined) {
      throw new Error("Creature spell attack bonus is unavailable.")
    }
    const instances: SessionActionInstanceResult[] = Array.from(
      { length: instanceCount },
      (_, index) => {
        const attack = rollD20(mode, attackBonus)
        const critical = attack.natural === 20
        return {
          label: instanceCount > 1 ? `Ataque ${index + 1}` : "Ataque",
          attack,
          damages: resolveDamageComponents({
            creature,
            entry,
            spell,
            components: resolution.damage ?? [],
            context,
            critical,
            allowedApplications: new Set(["hit", "always"]),
          }),
        }
      },
    )

    return {
      ...base,
      instances,
      critical: instances.some((instance) => instance.attack?.natural === 20),
    }
  }

  if (resolution.roll.type === "save") {
    if (saveDc === undefined) {
      throw new Error("Creature spell save DC is unavailable.")
    }
    return {
      ...base,
      save: {
        attribute: resolution.roll.attribute,
        dc: saveDc,
        onSuccess: resolution.roll.onSuccess,
      },
      damages: resolveDamageComponents({
        creature,
        entry,
        spell,
        components: resolution.damage ?? [],
        context,
        critical: false,
        allowedApplications: new Set([
          "failed-save",
          "successful-save",
          "always",
        ]),
      }),
      critical: false,
    }
  }

  if (instanceCount > 1) {
    return {
      ...base,
      instances: Array.from({ length: instanceCount }, (_, index) => ({
        label: `Instância ${index + 1}`,
        damages: resolveDamageComponents({
          creature,
          entry,
          spell,
          components: resolution.damage ?? [],
          context,
          critical: false,
          allowedApplications: new Set(["always"]),
        }),
      })),
      critical: false,
    }
  }

  return {
    ...base,
    damages: resolveDamageComponents({
      creature,
      entry,
      spell,
      components: resolution.damage ?? [],
      context,
      critical: false,
      allowedApplications: new Set(["always"]),
    }),
    critical: false,
  }
}

function resolveDamageComponents(args: {
  creature: CompendiumCreature
  entry?: InitiativeEntry
  spell: Spell
  components: NonNullable<ReturnType<typeof getEffectiveSpellResolution>["damage"]>
  context: { castLevel: number; characterLevel: number }
  critical: boolean
  allowedApplications: ReadonlySet<string>
}): SessionResolvedDamageRoll[] {
  const {
    creature,
    entry,
    components,
    context,
    critical,
    allowedApplications,
  } = args
  const spellcasting = creature.spellcasting!
  const conditions = entry?.conditions ?? []

  return components
    .filter((component) => allowedApplications.has(component.appliesOn))
    .map((component) => {
      const baseQuantity = evaluateSpellDamageDiceQuantity(component, context)
      const doublesOnCritical =
        component.critical ?? component.appliesOn === "hit"
      const quantity =
        critical && doublesOnCritical ? baseQuantity * 2 : baseQuantity

      if (quantity > MAX_DICE_PER_DAMAGE_COMPONENT) {
        throw new Error("Spell damage component rolls too many dice.")
      }

      const damageDice = component.dice
      const groups =
        quantity > 0 && damageDice
          ? (() => {
              const sides = parseDieSides(damageDice.sides)
              return [{
                quantity,
                sides,
                rolls: Array.from(
                  { length: quantity },
                  () => rollServerDie(sides),
                ),
              }]
            })()
          : []

      const flat = Math.trunc(component.flat ?? 0)
      const castingModifier = component.addCastingModifier
        ? getCreatureEffectiveAbilityModifier(
            creature,
            spellcasting.ability,
            conditions,
            entry,
          )
        : 0
      const modifier = getCreatureEffectiveSpellDamageBonus(
        creature,
        flat + castingModifier,
        conditions,
        entry,
      )
      const diceTotal = groups.reduce(
        (sum, group) =>
          sum + group.rolls.reduce((groupSum, value) => groupSum + value, 0),
        0,
      )

      return {
        groups,
        modifier,
        total: diceTotal + modifier,
        critical: critical && doublesOnCritical,
        label: component.label?.trim() || "Dano",
        damageType: component.damageType?.trim() || undefined,
      }
    })
}

function rollD20(
  mode: SessionDiceRollMode,
  modifier: number,
): SessionResolvedD20Roll {
  const rolls =
    mode === "normal"
      ? [rollServerDie(20)]
      : [rollServerDie(20), rollServerDie(20)]
  const kept =
    mode === "advantage"
      ? Math.max(...rolls)
      : mode === "disadvantage"
        ? Math.min(...rolls)
        : rolls[0]

  return {
    mode,
    groups: [{ quantity: rolls.length, sides: 20, rolls, kept }],
    modifier,
    total: kept + modifier,
    natural: kept,
  }
}

function parseDieSides(value: number | string): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).trim().toLowerCase().replace(/^d/, ""))
  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 1000) {
    throw new Error(`Invalid authoritative die sides: ${String(value)}`)
  }
  return parsed
}

function rollServerDie(sides: number): number {
  const range = 0x1_0000_0000
  const limit = range - (range % sides)
  const buffer = new Uint32Array(1)
  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0] >= limit)
  return (buffer[0] % sides) + 1
}

function joinDescription(
  ...parts: Array<string | undefined>
): string | undefined {
  const content = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
  return content.length ? content.join("\n\n") : undefined
}

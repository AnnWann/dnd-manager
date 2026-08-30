import { evaluateCharacterSheetFormula } from "../../lib/customSystems/CharacterSheetFormula"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type {
  Bonus,
  BonusCollection,
  BonusRollResolution,
} from "./Bonus"

export type BonusRollRequirement = {
  key: string
  label: string
  mode: "automatic" | "manual"
  dice: string
  formula?: string
}

const DIRECT_KEYS = [
  "armorClass",
  "initiative",
  "maxHp",
  "temporaryHp",
  "passivePerception",
  "attackBonus",
  "savingThrowBonus",
  "saveDcBonus",
  "damageBonus",
  "speed",
] as const

const SCOPED_KEYS = [
  "weaponAttackBonus",
  "spellAttackBonus",
  "savingThrowAttributeBonus",
  "weaponDamageBonus",
  "spellDamageBonus",
  "spellSaveDcBonus",
  "abilitySaveDcBonus",
] as const

export function listBonusRollRequirements(
  bonuses: BonusCollection | undefined,
): BonusRollRequirement[] {
  if (!bonuses) return []
  const result: BonusRollRequirement[] = []

  for (const key of DIRECT_KEYS) {
    ;(bonuses[key] ?? []).forEach((bonus, index) => {
      pushRequirement(result, `${key}:${index}`, key, bonus)
    })
  }

  for (const key of SCOPED_KEYS) {
    ;(bonuses[key] ?? []).forEach((entry, index) => {
      pushRequirement(result, `${key}:${index}`, key, entry.bonus)
    })
  }

  ;(bonuses.attribute ?? []).forEach((entry, index) => {
    pushRequirement(result, `attribute:${index}`, `attribute ${entry.attribute}`, entry.bonus)
  })
  ;(bonuses.attributeModifier ?? []).forEach((entry, index) => {
    pushRequirement(
      result,
      `attributeModifier:${index}`,
      `attributeModifier ${entry.attribute}`,
      entry.bonus,
    )
  })

  if (bonuses.attack?.bonus) {
    pushRequirement(result, "legacy:attack", "attack", bonuses.attack.bonus)
  }
  if (bonuses.damage?.bonus) {
    pushRequirement(result, "legacy:damage", "damage", bonuses.damage.bonus)
  }

  return result
}

export function hasManualBonusRolls(bonuses: BonusCollection | undefined): boolean {
  return listBonusRollRequirements(bonuses).some((entry) => entry.mode === "manual")
}

export function resolveBonusCollectionRolls(
  character: CharacterTemplate,
  bonuses: BonusCollection | undefined,
  suppliedRollValues: Record<string, number> = {},
): { bonuses: BonusCollection | undefined; results: BonusRollResolution[] } {
  if (!bonuses) return { bonuses, results: [] }
  const results: BonusRollResolution[] = []

  const resolve = (key: string, label: string, bonus: Bonus): Bonus => {
    if (!bonus.roll) return bonus
    const dice = bonus.roll.dice.trim()
    const diceError = validateBonusRollDiceExpression(dice)
    if (diceError) throw new Error(`${label}: ${diceError}`)

    const supplied = suppliedRollValues[key]
    const diceValue = typeof supplied === "number" && Number.isFinite(supplied)
      ? supplied
      : bonus.roll.mode === "automatic"
        ? rollBonusDice(dice)
        : supplied

    if (typeof diceValue !== "number" || !Number.isFinite(diceValue)) {
      throw new Error(`Informe o resultado da rolagem de ${label} antes de usar a habilidade.`)
    }

    const formula = bonus.roll.formula?.trim()
    const evaluated = formula
      ? evaluateCharacterSheetFormula(formula, character)
      : 0
    if (formula && evaluated === undefined) {
      throw new Error(`Não foi possível calcular a fórmula da rolagem ${label}.`)
    }

    const formulaBonus = evaluated ?? 0
    const total = diceValue + formulaBonus
    const rollResult: BonusRollResolution = {
      key,
      label: bonus.label?.trim() || label,
      mode: bonus.roll.mode,
      dice,
      diceValue,
      formulaBonus,
      total,
    }
    results.push(rollResult)
    return { ...bonus, value: total, rollResult }
  }

  const next: BonusCollection = { ...bonuses }

  for (const key of DIRECT_KEYS) {
    const values = bonuses[key]
    if (values) {
      ;(next as Record<string, unknown>)[key] = values.map((bonus, index) =>
        resolve(`${key}:${index}`, key, bonus),
      )
    }
  }

  for (const key of SCOPED_KEYS) {
    const values = bonuses[key]
    if (values) {
      ;(next as Record<string, unknown>)[key] = values.map((entry, index) => ({
        ...entry,
        bonus: resolve(`${key}:${index}`, key, entry.bonus),
      }))
    }
  }

  if (bonuses.attribute) {
    next.attribute = bonuses.attribute.map((entry, index) => ({
      ...entry,
      bonus: resolve(`attribute:${index}`, `attribute ${entry.attribute}`, entry.bonus),
    }))
  }
  if (bonuses.attributeModifier) {
    next.attributeModifier = bonuses.attributeModifier.map((entry, index) => ({
      ...entry,
      bonus: resolve(
        `attributeModifier:${index}`,
        `attributeModifier ${entry.attribute}`,
        entry.bonus,
      ),
    }))
  }
  if (bonuses.attack?.bonus) {
    next.attack = {
      ...bonuses.attack,
      bonus: resolve("legacy:attack", "attack", bonuses.attack.bonus),
    }
  }
  if (bonuses.damage?.bonus) {
    next.damage = {
      ...bonuses.damage,
      bonus: resolve("legacy:damage", "damage", bonuses.damage.bonus),
    }
  }

  return { bonuses: next, results }
}

export function listResolvedBonusRolls(
  bonuses: BonusCollection | undefined,
): BonusRollResolution[] {
  if (!bonuses) return []
  const result: BonusRollResolution[] = []

  const collect = (bonus: Bonus) => {
    if (bonus.rollResult) result.push(bonus.rollResult)
  }

  for (const key of DIRECT_KEYS) (bonuses[key] ?? []).forEach(collect)
  for (const key of SCOPED_KEYS) (bonuses[key] ?? []).forEach((entry) => collect(entry.bonus))
  ;(bonuses.attribute ?? []).forEach((entry) => collect(entry.bonus))
  ;(bonuses.attributeModifier ?? []).forEach((entry) => collect(entry.bonus))
  if (bonuses.attack?.bonus) collect(bonuses.attack.bonus)
  if (bonuses.damage?.bonus) collect(bonuses.damage.bonus)

  return result
}

export function validateBonusRollDiceExpression(expression: string): string | undefined {
  const parsed = parseDiceExpression(expression)
  if (!parsed) return "Use uma notação como 1d6, 2d8+1 ou 1d10-1."
  if (parsed.count < 1 || parsed.count > 100) return "A rolagem deve usar entre 1 e 100 dados."
  if (parsed.sides < 2 || parsed.sides > 1000) return "Cada dado deve ter entre 2 e 1000 lados."
  return undefined
}

function pushRequirement(
  result: BonusRollRequirement[],
  key: string,
  fallbackLabel: string,
  bonus: Bonus,
) {
  if (!bonus.roll) return
  result.push({
    key,
    label: bonus.label?.trim() || fallbackLabel,
    mode: bonus.roll.mode,
    dice: bonus.roll.dice,
    formula: bonus.roll.formula,
  })
}

function rollBonusDice(expression: string): number {
  const parsed = parseDiceExpression(expression)
  if (!parsed) throw new Error("Rolagem de bônus inválida.")
  let total = parsed.modifier
  for (let index = 0; index < parsed.count; index += 1) {
    total += randomInteger(parsed.sides) + 1
  }
  return total
}

function parseDiceExpression(expression: string): {
  count: number
  sides: number
  modifier: number
} | undefined {
  const match = expression.trim().match(/^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?$/i)
  if (!match) return undefined
  const count = match[1] ? Number(match[1]) : 1
  const sides = Number(match[2])
  const modifierValue = match[4] ? Number(match[4]) : 0
  const modifier = match[3] === "-" ? -modifierValue : modifierValue
  if (![count, sides, modifier].every(Number.isFinite)) return undefined
  return { count, sides, modifier }
}

function randomInteger(maxExclusive: number): number {
  const cryptoObject = (
    globalThis as typeof globalThis & {
      crypto?: {
        getRandomValues?: (buffer: Uint32Array) => Uint32Array
      }
    }
  ).crypto

  if (cryptoObject?.getRandomValues) {
    const range = 0x1_0000_0000
    const limit = range - (range % maxExclusive)
    const buffer = new Uint32Array(1)
    do {
      cryptoObject.getRandomValues(buffer)
    } while (buffer[0] >= limit)
    return buffer[0] % maxExclusive
  }
  return Math.floor(Math.random() * maxExclusive)
}

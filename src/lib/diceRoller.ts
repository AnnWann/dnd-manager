export type DiceRollMode = "normal" | "advantage" | "disadvantage"
export type DiceRollKind =
  | "ability"
  | "skill"
  | "save"
  | "initiative"
  | "attack"
  | "damage"
  | "spell-attack"
  | "custom"

export type DiceRollGroup = {
  quantity: number
  sides: number
  rolls: number[]
  kept?: number
}

export type DiceRollResult = {
  id: string
  label: string
  kind: DiceRollKind
  mode: DiceRollMode
  groups: DiceRollGroup[]
  modifier: number
  total: number
  natural?: number
  createdAt: number
}

export const DICE_ROLL_EVENT = "dndmm:dice-roll"

export function rollD20(input: {
  label: string
  modifier?: number
  kind: Exclude<DiceRollKind, "damage">
  mode?: DiceRollMode
}): DiceRollResult {
  const mode = input.mode ?? "normal"
  const rolls =
    mode === "normal"
      ? [rollDie(20)]
      : [rollDie(20), rollDie(20)]

  const kept =
    mode === "advantage"
      ? Math.max(...rolls)
      : mode === "disadvantage"
        ? Math.min(...rolls)
        : rolls[0]

  return publishRoll({
    label: input.label,
    kind: input.kind,
    mode,
    groups: [{ quantity: rolls.length, sides: 20, rolls, kept }],
    modifier: input.modifier ?? 0,
    total: kept + (input.modifier ?? 0),
    natural: kept,
  })
}

export function rollDamage(input: {
  label: string
  quantity: number
  sides: number | string
  modifier?: number
}): DiceRollResult {
  const sides = normalizeSides(input.sides)
  const quantity = Math.max(1, Math.trunc(input.quantity) || 1)
  const rolls = Array.from({ length: quantity }, () => rollDie(sides))
  const modifier = input.modifier ?? 0

  return publishRoll({
    label: input.label,
    kind: "damage",
    mode: "normal",
    groups: [{ quantity, sides, rolls }],
    modifier,
    total: rolls.reduce((sum, value) => sum + value, 0) + modifier,
  })
}

export function rollModeFromEvent(
  event: Pick<MouseEvent, "shiftKey" | "altKey">,
): DiceRollMode {
  if (event.shiftKey) return "advantage"
  if (event.altKey) return "disadvantage"
  return "normal"
}

export function rollModifierHint(): string {
  return "Clique para rolar. Shift: vantagem. Alt: desvantagem."
}

function publishRoll(
  value: Omit<DiceRollResult, "id" | "createdAt">,
): DiceRollResult {
  const result: DiceRollResult = {
    ...value,
    id: createRollId(),
    createdAt: Date.now(),
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<DiceRollResult>(DICE_ROLL_EVENT, { detail: result }),
    )
  }

  return result
}

function rollDie(sides: number): number {
  if (!Number.isInteger(sides) || sides < 2) {
    throw new Error(`Invalid die sides: ${sides}`)
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const range = 0x1_0000_0000
    const limit = range - (range % sides)
    const buffer = new Uint32Array(1)

    do {
      crypto.getRandomValues(buffer)
    } while (buffer[0] >= limit)

    return (buffer[0] % sides) + 1
  }

  return Math.floor(Math.random() * sides) + 1
}

function normalizeSides(value: number | string): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number(value.trim().toLowerCase().replace(/^d/, ""))

  if (!Number.isInteger(parsed) || parsed < 2) {
    throw new Error(`Invalid die sides: ${String(value)}`)
  }

  return parsed
}

function createRollId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

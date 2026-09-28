import { parseManualDiceExpression } from "../../shared/session-runtime/manualDiceExpression"
import type { Itemmable } from "../items/item"

export type CreatureDropGroup = {
  id: string
  items: Itemmable[]
}

export type CreatureDrops = {
  guaranteed: Itemmable[]
  rollGroups: CreatureDropGroup[]
}

export function createCreatureDrops(
  patch: Partial<CreatureDrops> = {},
): CreatureDrops {
  return {
    guaranteed: normalizeDropItems(patch.guaranteed),
    rollGroups: normalizeCreatureDropGroups(patch.rollGroups),
  }
}

export function createCreatureDropGroup(
  patch: Partial<CreatureDropGroup> = {},
): CreatureDropGroup {
  return {
    id: patch.id?.trim() || crypto.randomUUID(),
    items: normalizeDropItems(patch.items),
  }
}

export function normalizeCreatureDrops(value: unknown): CreatureDrops {
  const record = asRecord(value)
  if (!record) return createCreatureDrops()

  return {
    guaranteed: normalizeDropItems(
      record.guaranteed ?? record.default ?? record.defaultItems,
    ),
    rollGroups: normalizeCreatureDropGroups(
      record.rollGroups ?? record.groups,
    ),
  }
}

export function cloneCreatureDropItemForGround(
  item: Itemmable,
  random: () => number = Math.random,
): Itemmable {
  return {
    ...structuredClone(item),
    id: crypto.randomUUID(),
    quantity: rollCreatureDropQuantity(item, random),
    dropQuantityFormula: undefined,
    heldHands: undefined,
    insideBagOfHolding: false,
    attuned: false,
  }
}

export function validateCreatureDropQuantityFormula(
  expression: string,
): string | undefined {
  const parsed = parseManualDiceExpression(expression)
  if (!parsed.ok) return parsed.message
  if (parsed.value.terms.some((term) => term.mode !== "normal")) {
    return "A quantidade do drop não aceita vantagem ou desvantagem."
  }
  return undefined
}

export function normalizeCreatureDropQuantityFormula(
  value: unknown,
): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined
  const parsed = parseManualDiceExpression(value)
  if (!parsed.ok) return undefined
  if (parsed.value.terms.some((term) => term.mode !== "normal")) return undefined
  return parsed.value.expression
}

export function rollCreatureDropQuantity(
  item: Pick<Itemmable, "quantity" | "dropQuantityFormula">,
  random: () => number = Math.random,
): number {
  const fallback = Math.max(1, Math.trunc(finiteNumber(item.quantity, 1)))
  const expression = normalizeCreatureDropQuantityFormula(item.dropQuantityFormula)
  if (!expression) return fallback

  const parsed = parseManualDiceExpression(expression)
  if (!parsed.ok) return fallback

  let total = parsed.value.modifier
  for (const term of parsed.value.terms) {
    for (let index = 0; index < term.quantity; index += 1) {
      const normalizedRandom = Math.min(0.9999999999999999, Math.max(0, random()))
      total += Math.floor(normalizedRandom * term.sides) + 1
    }
  }

  return Math.max(1, Math.trunc(total))
}

function normalizeCreatureDropGroups(value: unknown): CreatureDropGroup[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    const record = asRecord(entry)
    if (!record) return []
    return [
      createCreatureDropGroup({
        id: stringValue(record.id).trim() || undefined,
        items: normalizeDropItems(record.items),
      }),
    ]
  })
}

function normalizeDropItems(value: unknown): Itemmable[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    const record = asRecord(entry)
    if (!record) return []
    const name = stringValue(record.name).trim()
    if (!name) return []

    const dropQuantityFormula = normalizeCreatureDropQuantityFormula(
      record.dropQuantityFormula,
    )

    return [
      {
        ...structuredClone(record),
        id: stringValue(record.id).trim() || crypto.randomUUID(),
        name,
        desc: stringValue(record.desc),
        notes: stringValue(record.notes),
        quantity: Math.max(1, Math.trunc(finiteNumber(record.quantity, 1))),
        dropQuantityFormula,
        weight: Math.max(0, finiteNumber(record.weight, 0)),
        pocketable: Boolean(record.pocketable),
        kind: stringValue(record.kind, "common"),
      } as Itemmable,
    ]
  })
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function stringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return fallback
}

function finiteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

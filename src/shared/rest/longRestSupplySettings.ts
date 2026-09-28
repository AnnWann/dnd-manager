export type LongRestSupplyShortageMode = "partial" | "block"

export type LongRestSupplyResourceRule = {
  enabled: boolean
  /** Number of abstract inventory portions required for a standard humanoid. */
  portionsPerStandardRest: number
  /** Physical amount represented by one inventory portion, for display. */
  amountPerPortion: number
  unit: string
  label: string
}

export type LongRestSupplySettings = {
  enabled: boolean
  useRaceMultipliers: boolean
  shortageMode: LongRestSupplyShortageMode
  food: LongRestSupplyResourceRule
  drink: LongRestSupplyResourceRule
}

export const DEFAULT_LONG_REST_SUPPLY_SETTINGS: LongRestSupplySettings = {
  enabled: true,
  useRaceMultipliers: true,
  shortageMode: "partial",
  food: {
    enabled: true,
    portionsPerStandardRest: 1,
    amountPerPortion: 1,
    unit: "porção",
    label: "Comida",
  },
  drink: {
    enabled: false,
    portionsPerStandardRest: 1,
    amountPerPortion: 1,
    unit: "porção",
    label: "Água",
  },
}

export function normalizeLongRestSupplySettings(
  value: unknown,
): LongRestSupplySettings {
  if (!isRecord(value)) {
    return structuredClone(DEFAULT_LONG_REST_SUPPLY_SETTINGS)
  }

  return {
    enabled: value.enabled !== false,
    useRaceMultipliers: value.useRaceMultipliers !== false,
    shortageMode: value.shortageMode === "block" ? "block" : "partial",
    food: normalizeResourceRule(
      value.food,
      DEFAULT_LONG_REST_SUPPLY_SETTINGS.food,
    ),
    drink: normalizeResourceRule(
      value.drink,
      DEFAULT_LONG_REST_SUPPLY_SETTINGS.drink,
    ),
  }
}

export function isLongRestSupplySettings(
  value: unknown,
): value is LongRestSupplySettings {
  if (!isRecord(value)) return false
  if (typeof value.enabled !== "boolean") return false
  if (typeof value.useRaceMultipliers !== "boolean") return false
  if (value.shortageMode !== "partial" && value.shortageMode !== "block") {
    return false
  }
  return isResourceRule(value.food) && isResourceRule(value.drink)
}

export function formatSupplyPhysicalAmount(
  portions: number,
  rule: LongRestSupplyResourceRule,
): string {
  const amount = Math.max(0, portions) * Math.max(0, rule.amountPerPortion)
  const formatted = Number.isInteger(amount)
    ? amount.toLocaleString("pt-BR")
    : amount.toLocaleString("pt-BR", { maximumFractionDigits: 3 })
  return `${formatted} ${rule.unit}`.trim()
}

function normalizeResourceRule(
  value: unknown,
  fallback: LongRestSupplyResourceRule,
): LongRestSupplyResourceRule {
  if (!isRecord(value)) return { ...fallback }

  return {
    enabled:
      typeof value.enabled === "boolean" ? value.enabled : fallback.enabled,
    portionsPerStandardRest: nonNegativeNumber(
      value.portionsPerStandardRest,
      fallback.portionsPerStandardRest,
    ),
    amountPerPortion: nonNegativeNumber(
      value.amountPerPortion,
      fallback.amountPerPortion,
    ),
    unit: nonBlankString(value.unit, fallback.unit),
    label: nonBlankString(value.label, fallback.label),
  }
}

function isResourceRule(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.enabled === "boolean"
    && typeof value.portionsPerStandardRest === "number"
    && Number.isFinite(value.portionsPerStandardRest)
    && value.portionsPerStandardRest >= 0
    && typeof value.amountPerPortion === "number"
    && Number.isFinite(value.amountPerPortion)
    && value.amountPerPortion >= 0
    && typeof value.unit === "string"
    && typeof value.label === "string"
  )
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : fallback
}

function nonBlankString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

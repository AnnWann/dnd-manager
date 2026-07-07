import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { Itemmable } from "../items/item"
import {
  isSupplyItem,
  type SupplyItem,
} from "../items/SupplyItem"
import type {
  CharacterRace,
  RaceSupplyConsumption,
} from "../races/CharacterRace"
import type { Race } from "../races/Race"

export const STANDARD_PORTIONS_PER_RATION = 1
export const STANDARD_PORTIONS_PER_BARREL = 40
export const STANDARD_RATION_WEIGHT_KG = 0.9

export type SupplyPackageKind = "ration" | "barrel" | "custom"

export type PartySupplyConsumer = {
  characterId: string
  name: string
  race: Race
  supplyPerLongRest: number
}

export type PartySupplyCalculation = {
  consumers: PartySupplyConsumer[]
  supplyPortions: number
  supplyPerLongRest: number
  supplyLongRests: number
  supportedLongRests: number
  foodPortions: number
  drinkPortions: number
}

export type LongRestSupplySelection = {
  itemId: string
  portions: number
}

export type SupplySelectionTotals = {
  selectedPortions: number
}

export type SelectedSupplyConsumptionResult = {
  items: Itemmable[]
  valid: boolean
  selectedPortions: number
}

export function getDefaultRaceSupplyConsumption(
  race: Race,
  subrace = "",
): RaceSupplyConsumption {
  const normalizedSubrace = normalizeName(subrace)
  const isHalfGiant =
    race === "half-giant" ||
    normalizedSubrace.includes("half giant") ||
    normalizedSubrace.includes("meio gigante")

  if (race === "goliath" || isHalfGiant) {
    return { food: 2, drink: 1 }
  }

  if (
    race === "halfling" ||
    race === "gnome" ||
    race === "deep-gnome"
  ) {
    return { food: 0.5, drink: 1 }
  }

  return { food: 1, drink: 1 }
}

export function getEffectiveRaceSupplyConsumption(
  race: CharacterRace,
): RaceSupplyConsumption {
  if (race.supplyConsumptionCustomized && race.supplyConsumption) {
    return sanitizeConsumption(race.supplyConsumption)
  }

  return getDefaultRaceSupplyConsumption(race.race, race.subrace)
}

export function getRequiredSupplyForRace(race: CharacterRace): number {
  return getEffectiveRaceSupplyConsumption(race).food
}

export function getSupplyPackageDefaults(kind: SupplyPackageKind): {
  portions: number
  label: string
} {
  if (kind === "barrel") {
    return {
      portions: STANDARD_PORTIONS_PER_BARREL,
      label: "porções padrão",
    }
  }

  if (kind === "ration") {
    return {
      portions: STANDARD_PORTIONS_PER_RATION,
      label: "porção padrão",
    }
  }

  return {
    portions: 1,
    label: "porções padrão",
  }
}

export function calculatePartySupplies(
  items: Itemmable[],
  characters: CharacterTemplate[],
): PartySupplyCalculation {
  const supplies = items.filter(isConsumableSupply)
  const supplyPortions = supplies.reduce(
    (total, supply) =>
      roundPortions(total + getTotalSupplyPortions(supply)),
    0,
  )
  const foodPortions = supplies.reduce(
    (total, supply) =>
      supply.supplyCategory === "food" ||
      supply.supplyCategory === "mixed"
        ? roundPortions(total + getTotalSupplyPortions(supply))
        : total,
    0,
  )
  const drinkPortions = supplies.reduce(
    (total, supply) =>
      supply.supplyCategory === "drink" ||
      supply.supplyCategory === "mixed"
        ? roundPortions(total + getTotalSupplyPortions(supply))
        : total,
    0,
  )

  const consumers = characters
    .filter(isPartySupplyConsumer)
    .map((character): PartySupplyConsumer => ({
      characterId: character.get("id"),
      name: character.get("name"),
      race: character.get("sheet").race.race,
      supplyPerLongRest: getRequiredSupplyForRace(
        character.get("sheet").race,
      ),
    }))

  const supplyPerLongRest = consumers.reduce(
    (total, consumer) => total + consumer.supplyPerLongRest,
    0,
  )
  const supplyLongRests = divideSupply(
    supplyPortions,
    supplyPerLongRest,
  )

  return {
    consumers,
    supplyPortions,
    supplyPerLongRest,
    supplyLongRests,
    supportedLongRests: supplyLongRests,
    foodPortions,
    drinkPortions,
  }
}

export function getTotalSupplyPortions(item: SupplyItem): number {
  const remaining = Number(item.remainingSupplyUnits)

  if (item.remainingSupplyUnits !== undefined && Number.isFinite(remaining)) {
    return Math.max(0, remaining)
  }

  return (
    Math.max(0, Number(item.quantity) || 0) *
    Math.max(0, Number(item.supplyUnitsPerItem) || 0)
  )
}

export function getAvailableSupplyPortions(items: Itemmable[]): number {
  return items.reduce((total, item) => {
    if (!isConsumableSupply(item)) return total
    return roundPortions(total + getTotalSupplyPortions(item))
  }, 0)
}

export function getSupplySelectionTotals(
  items: Itemmable[],
  selection: LongRestSupplySelection[],
): SupplySelectionTotals {
  const selectedById = normalizeSelection(selection)
  let selectedPortions = 0

  for (const item of items) {
    if (!isConsumableSupply(item)) continue

    const requested = selectedById.get(item.id) ?? 0
    const selected = Math.min(
      getTotalSupplyPortions(item),
      Math.max(0, requested),
    )

    selectedPortions = roundPortions(selectedPortions + selected)
  }

  return { selectedPortions }
}

export function createAutomaticLongRestSelection(
  items: Itemmable[],
  requiredSupply: number,
): LongRestSupplySelection[] {
  let remaining = roundPortions(Math.max(0, requiredSupply))
  const supplies = items
    .filter(isConsumableSupply)
    .filter((item) => getTotalSupplyPortions(item) > 0)
    .sort(
      (left, right) =>
        getTotalSupplyPortions(left) - getTotalSupplyPortions(right),
    )
  const selection: LongRestSupplySelection[] = []

  for (const item of supplies) {
    if (remaining <= 0) break

    const available = getTotalSupplyPortions(item)
    const portions = roundPortions(Math.min(available, remaining))
    if (portions <= 0) continue

    selection.push({ itemId: item.id, portions })
    remaining = roundPortions(Math.max(0, remaining - portions))
  }

  return selection
}

export function consumeSelectedSupplies(
  items: Itemmable[],
  selection: LongRestSupplySelection[],
): SelectedSupplyConsumptionResult {
  const selectedById = normalizeSelection(selection)
  const totals = getSupplySelectionTotals(items, selection)
  const selectionIsValid = Array.from(selectedById.entries()).every(
    ([itemId, portions]) => {
      const item = items.find(
        (candidate) =>
          candidate.id === itemId && isConsumableSupply(candidate),
      )

      return Boolean(
        item &&
          portions >= 0 &&
          portions <= getTotalSupplyPortions(item as SupplyItem),
      )
    },
  )

  if (!selectionIsValid) {
    return {
      items,
      valid: false,
      selectedPortions: totals.selectedPortions,
    }
  }

  const nextItems: Itemmable[] = []

  for (const item of items) {
    if (!isConsumableSupply(item)) {
      nextItems.push(item)
      continue
    }

    const selectedPortions = selectedById.get(item.id) ?? 0
    if (selectedPortions <= 0) {
      nextItems.push(item)
      continue
    }

    const remaining = roundPortions(
      getTotalSupplyPortions(item) - selectedPortions,
    )

    if (remaining <= 0) continue

    const portionsPerItem = Math.max(
      0,
      Number(item.supplyUnitsPerItem) || 0,
    )
    const nextQuantity =
      portionsPerItem > 0
        ? Math.max(1, Math.ceil(remaining / portionsPerItem))
        : Math.max(1, item.quantity ?? 1)

    nextItems.push({
      ...item,
      quantity: nextQuantity,
      remainingSupplyUnits: remaining,
    })
  }

  return {
    items: nextItems,
    valid: true,
    selectedPortions: totals.selectedPortions,
  }
}

function isConsumableSupply(item: Itemmable): item is SupplyItem {
  return isSupplyItem(item) && item.supplyCategory !== "other"
}

function normalizeSelection(
  selection: LongRestSupplySelection[],
): Map<string, number> {
  const selectedById = new Map<string, number>()

  for (const entry of selection) {
    const amount = roundPortions(
      Math.max(0, Number(entry.portions) || 0),
    )
    selectedById.set(
      entry.itemId,
      roundPortions((selectedById.get(entry.itemId) ?? 0) + amount),
    )
  }

  return selectedById
}

function isPartySupplyConsumer(character: CharacterTemplate): boolean {
  const type = character.get("sheet").type

  if (type === "pc") return true

  return (
    character.get("visibility") === "party" &&
    (type === "npc" || type === "humanoide")
  )
}

function sanitizeConsumption(
  consumption: RaceSupplyConsumption,
): RaceSupplyConsumption {
  return {
    food: Math.max(0, Number(consumption.food) || 0),
    drink: Math.max(0, Number(consumption.drink) || 0),
  }
}

function divideSupply(portions: number, consumption: number): number {
  if (consumption <= 0) return Number.POSITIVE_INFINITY
  return portions / consumption
}

function roundPortions(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .toLowerCase()
}

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
  foodPerLongRest: number
  drinkPerLongRest: number
}

export type PartySupplyCalculation = {
  consumers: PartySupplyConsumer[]
  foodPortions: number
  drinkPortions: number
  foodPerLongRest: number
  drinkPerLongRest: number
  foodLongRests: number
  drinkLongRests: number
  supportedLongRests: number
}

export type LongRestSupplySelection = {
  itemId: string
  portions: number
}

export type SupplySelectionTotals = {
  selectedPortions: number
  food: number
  drink: number
}

export type SelectedSupplyConsumptionResult = {
  items: Itemmable[]
  valid: boolean
  selectedFood: number
  selectedDrink: number
  missingFood: number
  missingDrink: number
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
  const supplies = items.filter(isSupplyItem)

  const foodPortions = supplies.reduce((total, supply) => {
    if (
      supply.supplyCategory !== "food" &&
      supply.supplyCategory !== "mixed"
    ) {
      return total
    }

    return total + getTotalSupplyPortions(supply)
  }, 0)

  const drinkPortions = supplies.reduce((total, supply) => {
    if (
      supply.supplyCategory !== "drink" &&
      supply.supplyCategory !== "mixed"
    ) {
      return total
    }

    return total + getTotalSupplyPortions(supply)
  }, 0)

  const consumers = characters
    .filter(isPartySupplyConsumer)
    .map((character): PartySupplyConsumer => {
      const consumption = getEffectiveRaceSupplyConsumption(
        character.get("sheet").race,
      )

      return {
        characterId: character.get("id"),
        name: character.get("name"),
        race: character.get("sheet").race.race,
        foodPerLongRest: consumption.food,
        drinkPerLongRest: consumption.drink,
      }
    })

  const foodPerLongRest = consumers.reduce(
    (total, consumer) => total + consumer.foodPerLongRest,
    0,
  )
  const drinkPerLongRest = consumers.reduce(
    (total, consumer) => total + consumer.drinkPerLongRest,
    0,
  )

  const foodLongRests = divideSupply(foodPortions, foodPerLongRest)
  const drinkLongRests = divideSupply(drinkPortions, drinkPerLongRest)

  return {
    consumers,
    foodPortions,
    drinkPortions,
    foodPerLongRest,
    drinkPerLongRest,
    foodLongRests,
    drinkLongRests,
    supportedLongRests: Math.min(foodLongRests, drinkLongRests),
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

export function getAvailableFoodPortions(items: Itemmable[]): number {
  return getAvailableSupplyPortions(items, "food")
}

export function getAvailableDrinkPortions(items: Itemmable[]): number {
  return getAvailableSupplyPortions(items, "drink")
}

export function getSupplySelectionTotals(
  items: Itemmable[],
  selection: LongRestSupplySelection[],
): SupplySelectionTotals {
  const selectedById = normalizeSelection(selection)
  let selectedPortions = 0
  let food = 0
  let drink = 0

  for (const item of items) {
    if (!isSupplyItem(item)) continue

    const requested = selectedById.get(item.id) ?? 0
    const selected = Math.min(
      getTotalSupplyPortions(item),
      Math.max(0, requested),
    )

    if (selected <= 0) continue

    selectedPortions = roundPortions(selectedPortions + selected)

    if (item.supplyCategory === "food") {
      food = roundPortions(food + selected)
    } else if (item.supplyCategory === "drink") {
      drink = roundPortions(drink + selected)
    } else if (item.supplyCategory === "mixed") {
      food = roundPortions(food + selected)
      drink = roundPortions(drink + selected)
    }
  }

  return { selectedPortions, food, drink }
}

export function createAutomaticLongRestSelection(
  items: Itemmable[],
  requiredFood: number,
  requiredDrink: number,
): LongRestSupplySelection[] {
  const selected = new Map<string, number>()
  let foodMissing = roundPortions(Math.max(0, requiredFood))
  let drinkMissing = roundPortions(Math.max(0, requiredDrink))

  const supplies = items.filter(isSupplyItem)
  const mixed = supplies.filter(
    (item) =>
      item.supplyCategory === "mixed" &&
      getTotalSupplyPortions(item) > 0,
  )

  takeFromSupplies(
    mixed,
    Math.min(foodMissing, drinkMissing),
    selected,
    (amount) => {
      foodMissing = roundPortions(foodMissing - amount)
      drinkMissing = roundPortions(drinkMissing - amount)
    },
  )

  takeFromSupplies(
    supplies.filter((item) => item.supplyCategory === "food"),
    foodMissing,
    selected,
    (amount) => {
      foodMissing = roundPortions(foodMissing - amount)
    },
  )

  takeFromSupplies(
    supplies.filter((item) => item.supplyCategory === "drink"),
    drinkMissing,
    selected,
    (amount) => {
      drinkMissing = roundPortions(drinkMissing - amount)
    },
  )

  if (foodMissing > 0 || drinkMissing > 0) {
    takeFromSupplies(
      mixed,
      Math.max(foodMissing, drinkMissing),
      selected,
      (amount) => {
        foodMissing = roundPortions(Math.max(0, foodMissing - amount))
        drinkMissing = roundPortions(Math.max(0, drinkMissing - amount))
      },
    )
  }

  return Array.from(selected.entries())
    .filter(([, portions]) => portions > 0)
    .map(([itemId, portions]) => ({ itemId, portions }))
}

export function consumeSelectedSupplies(
  items: Itemmable[],
  selection: LongRestSupplySelection[],
  requiredFood: number,
  requiredDrink: number,
): SelectedSupplyConsumptionResult {
  const selectedById = normalizeSelection(selection)
  const totals = getSupplySelectionTotals(items, selection)
  const missingFood = roundPortions(
    Math.max(0, requiredFood - totals.food),
  )
  const missingDrink = roundPortions(
    Math.max(0, requiredDrink - totals.drink),
  )

  const selectionIsValid = Array.from(selectedById.entries()).every(
    ([itemId, portions]) => {
      const item = items.find(
        (candidate) => candidate.id === itemId && isSupplyItem(candidate),
      )

      return Boolean(
        item &&
          portions >= 0 &&
          portions <= getTotalSupplyPortions(item as SupplyItem),
      )
    },
  )
  const valid =
    selectionIsValid && missingFood <= 0 && missingDrink <= 0

  if (!valid) {
    return {
      items,
      valid: false,
      selectedFood: totals.food,
      selectedDrink: totals.drink,
      missingFood,
      missingDrink,
    }
  }

  const nextItems: Itemmable[] = []

  for (const item of items) {
    if (!isSupplyItem(item)) {
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
    selectedFood: totals.food,
    selectedDrink: totals.drink,
    missingFood: 0,
    missingDrink: 0,
  }
}

function getAvailableSupplyPortions(
  items: Itemmable[],
  resource: "food" | "drink",
): number {
  return items.reduce((total, item) => {
    if (!isSupplyItem(item)) return total

    const contributes =
      item.supplyCategory === resource ||
      item.supplyCategory === "mixed"

    return contributes
      ? roundPortions(total + getTotalSupplyPortions(item))
      : total
  }, 0)
}

function takeFromSupplies(
  supplies: SupplyItem[],
  requested: number,
  selected: Map<string, number>,
  onTake: (amount: number) => void,
) {
  let remaining = roundPortions(Math.max(0, requested))

  for (const item of supplies) {
    if (remaining <= 0) break

    const alreadySelected = selected.get(item.id) ?? 0
    const available = roundPortions(
      getTotalSupplyPortions(item) - alreadySelected,
    )
    if (available <= 0) continue

    const amount = Math.min(available, remaining)
    selected.set(item.id, roundPortions(alreadySelected + amount))
    onTake(amount)
    remaining = roundPortions(remaining - amount)
  }
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

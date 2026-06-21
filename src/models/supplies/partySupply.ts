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

export type SupplyConsumptionResult = {
  items: Itemmable[]
  requestedPortions: number
  consumedPortions: number
  missingPortions: number
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
    supportedLongRests: foodLongRests,
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
  return items.reduce((total, item) => {
    if (!isSupplyItem(item)) return total
    if (
      item.supplyCategory !== "food" &&
      item.supplyCategory !== "mixed"
    ) {
      return total
    }

    return total + getTotalSupplyPortions(item)
  }, 0)
}

export function consumeFoodPortions(
  items: Itemmable[],
  requestedPortions: number,
): SupplyConsumptionResult {
  const requested = roundPortions(
    Math.max(0, Number(requestedPortions) || 0),
  )

  if (requested <= 0) {
    return {
      items,
      requestedPortions: requested,
      consumedPortions: 0,
      missingPortions: 0,
    }
  }

  const nextItems = [...items]
  let remainingToConsume = requested

  for (const category of ["food", "mixed"] as const) {
    for (let index = 0; index < nextItems.length; index += 1) {
      if (remainingToConsume <= 0) break

      const item = nextItems[index]
      if (!isSupplyItem(item) || item.supplyCategory !== category) {
        continue
      }

      const available = getTotalSupplyPortions(item)
      if (available <= 0) continue

      const consumedFromItem = Math.min(available, remainingToConsume)
      const remainingInItem = roundPortions(available - consumedFromItem)

      nextItems[index] = {
        ...item,
        remainingSupplyUnits: remainingInItem,
      }
      remainingToConsume = roundPortions(
        remainingToConsume - consumedFromItem,
      )
    }
  }

  const consumed = roundPortions(requested - remainingToConsume)

  return {
    items: nextItems,
    requestedPortions: requested,
    consumedPortions: consumed,
    missingPortions: roundPortions(remainingToConsume),
  }
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

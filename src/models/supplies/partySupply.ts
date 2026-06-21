import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { Itemmable } from "../items/item"
import type { SupplyItem } from "../items/SupplyItem"
import type {
  CharacterRace,
  RaceSupplyConsumption,
} from "../races/CharacterRace"
import type { Race } from "../races/Race"

export const STANDARD_PORTIONS_PER_RATION = 1
export const STANDARD_PORTIONS_PER_BARREL = 40

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

export function getDefaultRaceSupplyConsumption(
  race: Race,
): RaceSupplyConsumption {
  if (race === "goliath" || race === "half-giant") {
    return { food: 2, drink: 2 }
  }

  if (
    race === "halfling" ||
    race === "gnome" ||
    race === "deep-gnome"
  ) {
    return { food: 0.5, drink: 0.5 }
  }

  return { food: 1, drink: 1 }
}

export function getEffectiveRaceSupplyConsumption(
  race: CharacterRace,
): RaceSupplyConsumption {
  if (race.supplyConsumptionCustomized && race.supplyConsumption) {
    return sanitizeConsumption(race.supplyConsumption)
  }

  return getDefaultRaceSupplyConsumption(race.race)
}

export function getSupplyPackageDefaults(kind: SupplyPackageKind): {
  portions: number
  label: string
} {
  if (kind === "barrel") {
    return {
      portions: STANDARD_PORTIONS_PER_BARREL,
      label: "barril",
    }
  }

  if (kind === "ration") {
    return {
      portions: STANDARD_PORTIONS_PER_RATION,
      label: "ração individual",
    }
  }

  return {
    portions: 1,
    label: "unidade personalizada",
  }
}

export function calculatePartySupplies(
  items: Itemmable[],
  characters: CharacterTemplate[],
): PartySupplyCalculation {
  const supplies = items.filter(
    (item): item is SupplyItem => item.kind === "supply",
  )

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
  const supportedLongRests = Math.min(foodLongRests, drinkLongRests)

  return {
    consumers,
    foodPortions,
    drinkPortions,
    foodPerLongRest,
    drinkPerLongRest,
    foodLongRests,
    drinkLongRests,
    supportedLongRests,
  }
}

export function getTotalSupplyPortions(item: SupplyItem): number {
  return (
    Math.max(0, Number(item.quantity) || 0) *
    Math.max(0, Number(item.supplyUnitsPerItem) || 0)
  )
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

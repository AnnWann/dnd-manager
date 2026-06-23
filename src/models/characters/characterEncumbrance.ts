import type { CharacterTemplate } from "./CharacterTemplate"

export const POUNDS_TO_KILOGRAMS = 0.45359237

export type EncumbranceState =
  | "normal"
  | "encumbered"
  | "heavily-encumbered"
  | "over-capacity"

export type EncumbranceInfo = {
  weight: number
  encumbranceLimit: number
  heavyEncumbranceLimit: number
  carryingCapacity: number
  state: EncumbranceState
  speedPenalty: number
}

function itemWeight(item: {
  weight?: number
  quantity?: number
} | undefined): number {
  if (!item) return 0
  return Math.max(0, item.weight ?? 0) * Math.max(0, item.quantity ?? 1)
}

export function getCarriedWeightKg(character: CharacterTemplate): number {
  const equipment = character.get("equipment")

  const equippedWeight =
    itemWeight(equipment.armor) +
    itemWeight(equipment.boots) +
    itemWeight(equipment.gloves) +
    itemWeight(equipment.helmet) +
    itemWeight(equipment.cape) +
    equipment.rings.reduce((total, item) => total + itemWeight(item), 0) +
    equipment.weapons.reduce((total, item) => total + itemWeight(item), 0) +
    equipment.pockets.reduce((total, item) => total + itemWeight(item), 0)

  const inventoryWeight = character
    .get("inventory")
    .reduce(
      (total, item) =>
        item.insideBagOfHolding ? total : total + itemWeight(item),
      0,
    )

  return equippedWeight + inventoryWeight
}

export function getEncumbranceLimitKg(
  character: CharacterTemplate,
): number {
  return Math.max(0, character.getEffectiveAttribute("str")) * 5 * POUNDS_TO_KILOGRAMS
}

export function getHeavyEncumbranceLimitKg(
  character: CharacterTemplate,
): number {
  return Math.max(0, character.getEffectiveAttribute("str")) * 10 * POUNDS_TO_KILOGRAMS
}

export function getCarryingCapacityKg(
  character: CharacterTemplate,
): number {
  return Math.max(0, character.getEffectiveAttribute("str")) * 15 * POUNDS_TO_KILOGRAMS
}

export function getEncumbranceInfo(
  character: CharacterTemplate,
): EncumbranceInfo {
  const weight = getCarriedWeightKg(character)
  const encumbranceLimit = getEncumbranceLimitKg(character)
  const heavyEncumbranceLimit = getHeavyEncumbranceLimitKg(character)
  const carryingCapacity = getCarryingCapacityKg(character)

  if (weight > carryingCapacity) {
    return {
      weight,
      encumbranceLimit,
      heavyEncumbranceLimit,
      carryingCapacity,
      state: "over-capacity",
      speedPenalty: 6,
    }
  }

  if (weight > heavyEncumbranceLimit) {
    return {
      weight,
      encumbranceLimit,
      heavyEncumbranceLimit,
      carryingCapacity,
      state: "heavily-encumbered",
      speedPenalty: 6,
    }
  }

  if (weight > encumbranceLimit) {
    return {
      weight,
      encumbranceLimit,
      heavyEncumbranceLimit,
      carryingCapacity,
      state: "encumbered",
      speedPenalty: 3,
    }
  }

  return {
    weight,
    encumbranceLimit,
    heavyEncumbranceLimit,
    carryingCapacity,
    state: "normal",
    speedPenalty: 0,
  }
}

export function getEncumbranceSpeedPenalty(
  character: CharacterTemplate,
): number {
  return getEncumbranceInfo(character).speedPenalty
}

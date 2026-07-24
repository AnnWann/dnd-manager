import type { CreatureSize } from "../races/CharacterRace"
import { getItemStackWeightKg } from "../items/itemWeight"
import type { CharacterTemplate } from "./CharacterTemplate"

export const POUNDS_TO_KILOGRAMS = 0.45359237

const CREATURE_SIZE_CAPACITY_MULTIPLIER: Record<CreatureSize, number> = {
  tiny: 0.5,
  small: 1,
  medium: 1,
  large: 2,
  huge: 4,
  gargantuan: 8,
}

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

export function getCreatureSizeCapacityMultiplier(
  size: CreatureSize | undefined,
): number {
  return CREATURE_SIZE_CAPACITY_MULTIPLIER[size ?? "medium"]
}

function getStrengthWeightLimitKg(
  character: CharacterTemplate,
  poundsPerStrengthPoint: number,
): number {
  const strength = Math.max(0, character.getEffectiveAttribute("str"))
  const size = character.get("sheet").race.size
  const sizeMultiplier = getCreatureSizeCapacityMultiplier(size)

  return strength * poundsPerStrengthPoint * sizeMultiplier * POUNDS_TO_KILOGRAMS
}

export function getCarriedWeightKg(character: CharacterTemplate): number {
  const equipment = character.get("equipment")

  const equippedWeight =
    getItemStackWeightKg(equipment.armor) +
    getItemStackWeightKg(equipment.shield) +
    getItemStackWeightKg(equipment.boots) +
    getItemStackWeightKg(equipment.gloves) +
    getItemStackWeightKg(equipment.helmet) +
    getItemStackWeightKg(equipment.cape) +
    equipment.rings.reduce((total, item) => total + getItemStackWeightKg(item), 0) +
    equipment.weapons.reduce((total, item) => total + getItemStackWeightKg(item), 0) +
    equipment.pockets.reduce((total, item) => total + getItemStackWeightKg(item), 0)

  const inventoryWeight = character
    .get("inventory")
    .reduce(
      (total, item) =>
        item.insideBagOfHolding ? total : total + getItemStackWeightKg(item),
      0,
    )

  return equippedWeight + inventoryWeight
}

export function getEncumbranceLimitKg(
  character: CharacterTemplate,
): number {
  return getStrengthWeightLimitKg(character, 5)
}

export function getHeavyEncumbranceLimitKg(
  character: CharacterTemplate,
): number {
  return getStrengthWeightLimitKg(character, 10)
}

export function getCarryingCapacityKg(
  character: CharacterTemplate,
): number {
  return getStrengthWeightLimitKg(character, 15)
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

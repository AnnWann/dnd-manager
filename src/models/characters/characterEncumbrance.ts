import { getItemStackWeightKg } from "../items/itemWeight"
import { getInventoryCarriedWeightKg } from "../items/itemCompartments"
import type { CharacterTemplate } from "./CharacterTemplate"

import { calculateEncumbrance, getStrengthWeightLimitKg as calculateWeightLimit } from "../../../packages/game-core/src/encumbrance"
import type { EncumbranceInfo } from "../../../packages/game-core/src/encumbrance"
export { POUNDS_TO_KILOGRAMS, getCreatureSizeCapacityMultiplier } from "../../../packages/game-core/src/encumbrance"
export type { EncumbranceInfo, EncumbranceState } from "../../../packages/game-core/src/encumbrance"

function getStrengthWeightLimitKg(
  character: CharacterTemplate,
  poundsPerStrengthPoint: number,
): number {
  const strength = Math.max(0, character.getEffectiveAttribute("str"))
  const size = character.get("sheet").race.size

  return calculateWeightLimit(strength, size, poundsPerStrengthPoint)
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
    (equipment.necklaces ?? []).reduce((total, item) => total + getItemStackWeightKg(item), 0) +
    (equipment.bodyParts ?? []).reduce((total, item) => total + getItemStackWeightKg(item), 0) +
    (equipment.heldItems ?? []).reduce((total, item) => total + getItemStackWeightKg(item), 0) +
    equipment.weapons.reduce((total, item) => total + getItemStackWeightKg(item), 0) +
    equipment.pockets.reduce((total, item) => total + getItemStackWeightKg(item), 0)

  const inventoryWeight = getInventoryCarriedWeightKg(character.get("inventory"))

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
  return calculateEncumbrance(weight, character.getEffectiveAttribute("str"), character.get("sheet").race.size)
}

export function getEncumbranceSpeedPenalty(
  character: CharacterTemplate,
): number {
  return getEncumbranceInfo(character).speedPenalty
}

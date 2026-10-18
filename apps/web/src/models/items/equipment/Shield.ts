import type { CharacterTemplate } from "../../characters/CharacterTemplate"
import { getCalculatedArmorClass } from "../../characters/characterStats"
import type { Equipment } from "./EquipmentSlot"
import type { Itemmable } from "../item"

export type ShieldItem = Equipment & {
  kind: "shield"
  equippable: true
  equipSlot: "shield"
}

export function withShieldDefaults(item: Itemmable): ShieldItem {
  const equipment = item as Equipment
  const armorClassBonuses = equipment.bonuses?.armorClass

  return {
    ...item,
    kind: "shield",
    equippable: true,
    equipSlot: "shield",
    pocketable: false,
    insideBagOfHolding: false,
    bonuses: {
      ...(equipment.bonuses ?? {}),
      armorClass:
        armorClassBonuses && armorClassBonuses.length > 0
          ? armorClassBonuses
          : [{ type: "add", value: 2 }],
    },
  }
}

export function getEquippedShieldArmorClassBonus(
  character: CharacterTemplate,
): number {
  const shield = character.get("equipment").shield
  if (!shield) return 0

  return (shield.bonuses?.armorClass ?? []).reduce((total, bonus) => {
    if (bonus.type === "add") return total + bonus.value
    if (bonus.type === "sub") return total - bonus.value
    return bonus.value
  }, 0)
}

export function getCalculatedArmorClassWithShield(
  character: CharacterTemplate,
): number {
  return (
    getCalculatedArmorClass(character) +
    getEquippedShieldArmorClassBonus(character)
  )
}

export function getEffectiveArmorClassWithShield(
  character: CharacterTemplate,
): number {
  return (
    character.getEffectiveArmorClass() +
    getEquippedShieldArmorClassBonus(character)
  )
}

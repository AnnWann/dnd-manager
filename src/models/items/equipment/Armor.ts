import type { Equipment } from "./EquipmentSlot"

export type Armor = Equipment & {
  armorType: 'light' | 'medium' | 'heavy'
}
import type { Armor } from "./equipment/Armor"
import type { Equipment } from "./equipment/EquipmentSlot"
import type { Weapon } from "./equipment/Weapon"

export type Item = {
  id: string
  name: string
  desc: string
  notes: string
  quantity: number
  pockatable: boolean
}

export type Itemmable = Item | Equipment | Weapon | Armor
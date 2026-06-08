import type { Itemmable } from "../item"
import type { Armor } from "./Armor"
import type { Equipment } from "./EquipmentSlot"
import type { Weapon } from "./Weapon"


export type CharacterEquipment = {
  armor?: Armor
  boots?: Equipment
  helmet?: Equipment
  gloves?: Equipment
  rings: Equipment[]
  weapons: Weapon[]
  pockets: Itemmable[]
}
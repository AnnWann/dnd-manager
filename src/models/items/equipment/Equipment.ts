import type { Armor } from "./Armor"
import type { Equipment } from "./EquipmentSlot"
import type { PocketItem } from "./PocketItem"
import type { Weapon } from "./Weapon"


export type CharacterEquipment = {
  armor?: Armor
  boots?: Equipment
  helmet?: Equipment
  gloves?: Equipment
  cape?: Equipment
  rings: Equipment[]

  // armas realmente empunhadas
  weapons: Weapon[]

  // itens carregados no bolso, mas sem bônus ativo
  pockets: PocketItem[]
}
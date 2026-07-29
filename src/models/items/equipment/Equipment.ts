import type { Itemmable } from "../item"
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
  shield?: Equipment
  rings: Equipment[]

  // Armas realmente empunhadas.
  weapons: Weapon[]

  // Itens não-arma segurados nas mãos. Opcional para JSONs antigos.
  heldItems?: Itemmable[]

  // Itens legados carregados no bolso, mas sem bônus ativo.
  pockets: PocketItem[]
}

import type { CharacterTemplate } from "./CharacterTemplate"
import type { Equipment } from "../items/equipment/EquipmentSlot"
import {
  getWeaponHandsUsed,
  isVersatileWeapon,
  type Weapon,
} from "../items/equipment/Weapon"
import type { Itemmable } from "../items/item"

export const OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID =
  "spellcasting-with-occupied-hands"
export const OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME =
  "Conjuração com mãos ocupadas"

export type HandOccupantReference =
  | { type: "weapon"; index: number }
  | { type: "shield" }
  | { type: "held-item"; index: number }

export type HandOccupant = {
  key: string
  reference: HandOccupantReference
  item: Itemmable
  name: string
  hands: number
  arcaneFocus: boolean
  canReduceToOneHand: boolean
}

export type SpellcastingHandState = {
  canCast: boolean
  hasOccupiedHandsProficiency: boolean
  blockingHands: number
  totalHands: number
  blockers: HandOccupant[]
}

export function getHandOccupants(
  character: CharacterTemplate,
): HandOccupant[] {
  const equipment = character.get("equipment")
  const occupants: HandOccupant[] = equipment.weapons.map((weapon, index) => ({
    key: `weapon:${index}:${weapon.id}`,
    reference: { type: "weapon", index },
    item: weapon,
    name: weapon.name || "Arma sem nome",
    hands: getWeaponHandsUsed(weapon),
    arcaneFocus: false,
    canReduceToOneHand:
      getWeaponHandsUsed(weapon) === 2 &&
      (weapon.twoHanded === true || isVersatileWeapon(weapon)),
  }))

  if (equipment.shield) {
    occupants.push({
      key: `shield:${equipment.shield.id}`,
      reference: { type: "shield" },
      item: equipment.shield,
      name: equipment.shield.name || "Escudo",
      hands: 1,
      arcaneFocus: false,
      canReduceToOneHand: false,
    })
  }

  for (const [index, item] of (equipment.heldItems ?? []).entries()) {
    occupants.push({
      key: `held:${index}:${item.id}`,
      reference: { type: "held-item", index },
      item,
      name: item.name || "Item sem nome",
      hands: 1,
      arcaneFocus: item.kind === "focus",
      canReduceToOneHand: false,
    })
  }

  return occupants
}

export function getUsedHands(character: CharacterTemplate): number {
  return getHandOccupants(character).reduce(
    (total, occupant) => total + occupant.hands,
    0,
  )
}

export function getFreeHands(character: CharacterTemplate): number {
  return Math.max(0, character.get("sheet").arms - getUsedHands(character))
}

export function hasOccupiedHandsSpellcastingProficiency(
  character: CharacterTemplate,
): boolean {
  const proficiencies = [
    ...(character.get("sheet").proficiencies ?? []),
    ...(character.get("sheet").race.proficiencies ?? []),
  ]
  const expectedName = normalizeName(
    OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME,
  )

  return proficiencies.some(
    (proficiency) =>
      proficiency.id === OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID ||
      (proficiency.category === "other" &&
        normalizeName(proficiency.name) === expectedName),
  )
}

export function getSpellcastingHandState(
  character: CharacterTemplate,
): SpellcastingHandState {
  const totalHands = Math.max(0, character.get("sheet").arms)
  const occupants = getHandOccupants(character)
  const blockers = occupants.filter((occupant) => !occupant.arcaneFocus)
  const blockingHands = blockers.reduce(
    (total, occupant) => total + occupant.hands,
    0,
  )
  const hasOccupiedHandsProficiency =
    hasOccupiedHandsSpellcastingProficiency(character)

  return {
    canCast:
      hasOccupiedHandsProficiency ||
      totalHands <= 0 ||
      blockingHands < totalHands,
    hasOccupiedHandsProficiency,
    blockingHands,
    totalHands,
    blockers,
  }
}

export function setWeaponGripWithRules(
  character: CharacterTemplate,
  index: number,
  wieldedTwoHanded: boolean,
): CharacterTemplate {
  const equipment = character.get("equipment")
  const weapon = equipment.weapons[index]
  if (!weapon) return character

  const supportsGripChoice =
    weapon.twoHanded === true || isVersatileWeapon(weapon)
  if (!supportsGripChoice) return character

  const nextWeapon: Weapon = {
    ...weapon,
    wieldedTwoHanded,
  }
  const nextHands =
    getUsedHands(character) -
    getWeaponHandsUsed(weapon) +
    getWeaponHandsUsed(nextWeapon)

  if (nextHands > character.get("sheet").arms) return character

  return character.updateWeapon(index, nextWeapon)
}

export function removeHandOccupant(
  character: CharacterTemplate,
  reference: HandOccupantReference,
): { character: CharacterTemplate; item?: Itemmable } {
  const equipment = character.get("equipment")

  if (reference.type === "weapon") {
    const item = equipment.weapons[reference.index]
    if (!item) return { character }

    return {
      character: character.with("equipment", {
        ...equipment,
        weapons: equipment.weapons.filter(
          (_, index) => index !== reference.index,
        ),
      }),
      item,
    }
  }

  if (reference.type === "shield") {
    if (!equipment.shield) return { character }

    return {
      character: character.with("equipment", {
        ...equipment,
        shield: undefined,
      }),
      item: equipment.shield,
    }
  }

  const item = (equipment.heldItems ?? [])[reference.index]
  if (!item) return { character }

  return {
    character: character.with("equipment", {
      ...equipment,
      heldItems: (equipment.heldItems ?? []).filter(
        (_, index) => index !== reference.index,
      ),
    }),
    item,
  }
}

export function stowHandOccupant(
  character: CharacterTemplate,
  reference: HandOccupantReference,
): CharacterTemplate {
  const removed = removeHandOccupant(character, reference)
  if (!removed.item) return character

  return removed.character.with("inventory", [
    ...removed.character.get("inventory"),
    {
      ...removed.item,
      insideBagOfHolding: false,
    },
  ])
}

export function isHeldItemActiveEquipment(item: Itemmable): item is Equipment {
  return item.kind === "focus"
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}

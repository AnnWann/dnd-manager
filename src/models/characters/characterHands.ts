import type { CharacterTemplate } from "./CharacterTemplate"
import type { Equipment } from "../items/equipment/EquipmentSlot"
import {
  getWeaponHandsUsed,
  type Weapon,
} from "../items/equipment/Weapon"
import type { Itemmable } from "../items/item"

export const OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID =
  "spellcasting-with-occupied-hands"
export const OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME =
  "Conjuração com mãos ocupadas"

export type HeldHands = 1 | 2

export type HandOccupantReference =
  | { type: "weapon"; index: number }
  | { type: "shield" }
  | { type: "held-item"; index: number }

export type HandOccupant = {
  key: string
  reference: HandOccupantReference
  item: Itemmable
  name: string
  hands: HeldHands
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

export function getItemHeldHands(item: Partial<Itemmable>): HeldHands {
  return item.heldHands === 2 ? 2 : 1
}

export function getHandOccupants(
  character: CharacterTemplate,
): HandOccupant[] {
  const equipment = character.get("equipment")
  const occupants: HandOccupant[] = equipment.weapons.map((weapon, index) => {
    const hands = getWeaponHandsUsed(weapon)
    return {
      key: `weapon:${index}:${weapon.id}`,
      reference: { type: "weapon", index },
      item: weapon,
      name: weapon.name || "Arma sem nome",
      hands,
      arcaneFocus: false,
      canReduceToOneHand: hands === 2,
    }
  })

  if (equipment.shield) {
    const hands = getItemHeldHands(equipment.shield)
    occupants.push({
      key: `shield:${equipment.shield.id}`,
      reference: { type: "shield" },
      item: equipment.shield,
      name: equipment.shield.name || "Escudo",
      hands,
      arcaneFocus: false,
      canReduceToOneHand: hands === 2,
    })
  }

  for (const [index, item] of (equipment.heldItems ?? []).entries()) {
    const hands = getItemHeldHands(item)
    occupants.push({
      key: `held:${index}:${item.id}`,
      reference: { type: "held-item", index },
      item,
      name: item.name || "Item sem nome",
      hands,
      arcaneFocus: item.kind === "focus",
      canReduceToOneHand: hands === 2,
    })
  }

  return occupants
}

export function findHandOccupantByItemId(
  character: CharacterTemplate,
  itemId: string,
): HandOccupant | undefined {
  return getHandOccupants(character).find(
    (occupant) => occupant.item.id === itemId,
  )
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

export function setHandOccupantHandsWithRules(
  character: CharacterTemplate,
  reference: HandOccupantReference,
  hands: HeldHands,
): CharacterTemplate {
  const equipment = character.get("equipment")
  const occupant = getHandOccupants(character).find((entry) =>
    sameReference(entry.reference, reference),
  )
  if (!occupant) return character

  const nextUsedHands = getUsedHands(character) - occupant.hands + hands
  if (nextUsedHands > character.get("sheet").arms) return character

  if (reference.type === "weapon") {
    const weapon = equipment.weapons[reference.index]
    if (!weapon) return character

    const nextWeapon: Weapon = {
      ...weapon,
      wieldedTwoHanded: hands === 2,
    }
    return character.updateWeapon(reference.index, nextWeapon)
  }

  if (reference.type === "shield") {
    if (!equipment.shield) return character
    return character.with("equipment", {
      ...equipment,
      shield: {
        ...equipment.shield,
        heldHands: hands,
      },
    })
  }

  const item = (equipment.heldItems ?? [])[reference.index]
  if (!item) return character

  return character.with("equipment", {
    ...equipment,
    heldItems: (equipment.heldItems ?? []).map((entry, index) =>
      index === reference.index
        ? {
            ...entry,
            heldHands: hands,
          }
        : entry,
    ),
  })
}

export function setWeaponGripWithRules(
  character: CharacterTemplate,
  index: number,
  wieldedTwoHanded: boolean,
): CharacterTemplate {
  return setHandOccupantHandsWithRules(
    character,
    { type: "weapon", index },
    wieldedTwoHanded ? 2 : 1,
  )
}

export function setHeldItemHandsWithRules(
  character: CharacterTemplate,
  index: number,
  hands: HeldHands,
): CharacterTemplate {
  return setHandOccupantHandsWithRules(
    character,
    { type: "held-item", index },
    hands,
  )
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
      heldHands: undefined,
      insideBagOfHolding: false,
    },
  ])
}

export function isHeldItemActiveEquipment(item: Itemmable): item is Equipment {
  return item.kind === "focus"
}

function sameReference(
  first: HandOccupantReference,
  second: HandOccupantReference,
): boolean {
  if (first.type !== second.type) return false
  if (first.type === "shield" && second.type === "shield") return true
  if (first.type === "weapon" && second.type === "weapon") {
    return first.index === second.index
  }
  if (first.type === "held-item" && second.type === "held-item") {
    return first.index === second.index
  }
  return false
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}

import type { Attribute, Character, CharacterEquipment, EquipmentSlot } from '../types'

export function defaultAbilities(): Record<Attribute, number> {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
}

function emptySlot(): EquipmentSlot {
  return {
    name: '',
    bonuses: {
      armorClass: 0,
      initiative: 0,
      initiativeBonus: 0,
      maxHp: 0,
      currentHp: 0,
      temporaryHp: 0,
      passivePerception: 0,
      attackBonus: 0,
      mobility: 0,
    },
    twoHanded: false,
    notes: '',
  }
}

export function weaponSlotsFromLimbCount(limbCount: number): number {
  return Math.max(0, Math.trunc(limbCount))
}

export function equipmentBonuses(character: Character): {
  armorClass: number
  initiative: number
  initiativeBonus: number
  maxHp: number
  currentHp: number
  temporaryHp: number
  passivePerception: number
  attackBonus: number
  mobility: number
} {
  const slots: EquipmentSlot[] = []
  const eq = character.equipment
  if (eq) {
    slots.push(eq.armor, eq.boots, eq.helmet, eq.gloves)
    slots.push(...(eq.rings ?? []))
    slots.push(...(eq.weaponSlots ?? []))
    slots.push(...(eq.pocket ?? []))
  }

  return slots.reduce(
    (acc, slot) => {
      const bonuses = slot?.bonuses
      if (!bonuses) return acc
      return {
        armorClass: acc.armorClass + (bonuses.armorClass ?? 0),
        initiative: acc.initiative + (bonuses.initiative ?? 0),
        initiativeBonus: acc.initiativeBonus + (bonuses.initiativeBonus ?? 0),
        maxHp: acc.maxHp + (bonuses.maxHp ?? 0),
        currentHp: acc.currentHp + (bonuses.currentHp ?? 0),
        temporaryHp: acc.temporaryHp + (bonuses.temporaryHp ?? 0),
        passivePerception: acc.passivePerception + (bonuses.passivePerception ?? 0),
        attackBonus: acc.attackBonus + (bonuses.attackBonus ?? 0),
        mobility: acc.mobility + (bonuses.mobility ?? 0),
      }
    },
    {
      armorClass: 0,
      initiative: 0,
      initiativeBonus: 0,
      maxHp: 0,
      currentHp: 0,
      temporaryHp: 0,
      passivePerception: 0,
      attackBonus: 0,
      mobility: 0,
    },
  )
}

export function defaultEquipment(limbCount = 2): CharacterEquipment {
  const normalizedLimbCount = Math.max(0, Math.trunc(limbCount))
  const weaponSlotsCount = weaponSlotsFromLimbCount(normalizedLimbCount)
  return {
    armor: emptySlot(),
    boots: emptySlot(),
    helmet: emptySlot(),
    gloves: emptySlot(),
    rings: [emptySlot(), emptySlot(), emptySlot()],
    limbCount: normalizedLimbCount,
    weaponSlots: Array.from({ length: weaponSlotsCount }, () => emptySlot()),
    pocket: Array.from({ length: 8 }, () => emptySlot()),
  }
}

export function newCharacter(name = 'Novo personagem'): Character {
  return {
    id: crypto.randomUUID(),
    name,
    type: 'pc',
    visibilityRole: 'player',
    ownerKey: '',
    maxHp: 0,
    currentHp: 0,
    temporaryHp: 0,
    mobility: 9,
    initiativeBonus: 0,
    hitDice: [{ dice: 0, diceValue: 1, max: 0, current: 0 }],
    armorClass: 10,
    attributes: defaultAbilities(),
    skills: {},
    classes: [],
    spells: [],
    proficiencyMode: 'totalLevel',
    slotUsage: { usedByLevel: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pactUsed: 0 },
    customAbilities: [],
    equipment: defaultEquipment(2),
    notes: '',
    initiativeMode: 'unique',
    personalInventory: [],
    deathSaves: { successes: 0, failures: 0 },
  }
}

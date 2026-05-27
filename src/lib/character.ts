import type { Attribute, Character } from '../types'

export function defaultAbilities(): Record<Attribute, number> {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
}

export function newCharacter(name = 'Novo personagem'): Character {
  return {
    id: crypto.randomUUID(),
    name,
    type: 'pc',
    maxHp: 0,
    currentHp: 0,
    temporaryHp: 0,
    initiativeBonus: 0,
    hitDice: [{ dice: 0, diceValue: 1, max: 0, current: 0 }],
    armorClass: 10,
    attributes: defaultAbilities(),
    skills: {},
    classes: [],
    spells: [],
    proficiencyMode: 'totalLevel',
    slotUsage: { usedByLevel: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], pactUsed: 0 },
  }
}

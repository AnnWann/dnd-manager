import type { Attribute } from "./Attribute"

export interface CharacterClass {
  id: string
  className: ClassName
  level: ClassLevel
  castingAbility?: Attribute

  /** Optional: override for multiclass spell slot progression (used for special cases like EK/AT). */
  spellcastingProgression?: 'auto' | 'third'
}

export class Barbarian implements CharacterClass {
  id: string
  className: ClassName
  level: ClassLevel

  constructor() {
    this.id = crypto.randomUUID()
    this.className = 'barbarian'
    this.level = 1
  }
}

export class Barbarian implements CharacterClass {
  id: string
  className: ClassName
  level: ClassLevel

  constructor() {
    this.id = crypto.randomUUID()
    this.className = 'barbarian'
    this.level = 1
  }
}

export type ClassName = 
  | 'barbarian'
  | 'bard'
  | 'cleric'
  | 'druid'  
  | 'fighter'
  | 'monk'
  | 'paladin'
  | 'ranger'
  | 'rogue'
  | 'sorcerer'
  | 'warlock'
  | 'wizard'
  | 'artificer'

export type ClassLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
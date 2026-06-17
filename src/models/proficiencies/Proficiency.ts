export type Proficiency = {
  id: string
  name: string
  category: ProficiencyCategory
}

export type ProficiencyCategory =
  | 'armor'
  | 'weapon'
  | 'tool'
  | 'language'
  | 'skill'
  | 'saving-throw'
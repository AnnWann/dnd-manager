export type Proficiency = {
  id: string
  name: string
  category: ProficiencyCategory
  notes?: string
}

export type ProficiencyCategory =
  | "armor"
  | "shield"
  | "weapon"
  | "tool"
  | "vehicle"
  | "mount"
  | "language"
  | "instrument"
  | "game"
  | "skill"
  | "saving-throw"
  | "other"
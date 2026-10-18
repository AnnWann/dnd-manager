export type Proficiency = {
  id: string
  name: string
  category: ProficiencyCategory
  notes?: string
  /** Doubles the proficiency bonus when this is a skill proficiency. */
  expertise?: boolean
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
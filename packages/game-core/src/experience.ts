const EXPERIENCE_BY_LEVEL: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
}

export type CharacterExperienceProgress = {
  experience: number
  level: number
  levelStartExperience: number
  nextLevelExperience?: number
  experienceIntoLevel: number
  experienceNeededForLevel: number
  experienceRemaining: number
  progressPercent: number
  canLevelUp: boolean
}


export function calculateExperienceProgress(experience: number, level: number): CharacterExperienceProgress {
  const levelStartExperience = EXPERIENCE_BY_LEVEL[level] ?? 0
  const nextLevelExperience =
    level < 20 ? EXPERIENCE_BY_LEVEL[level + 1] : undefined

  if (nextLevelExperience === undefined) {
    return {
      experience,
      level,
      levelStartExperience,
      nextLevelExperience,
      experienceIntoLevel: Math.max(0, experience - levelStartExperience),
      experienceNeededForLevel: 0,
      experienceRemaining: 0,
      progressPercent: 100,
      canLevelUp: false,
    }
  }
  const experienceNeededForLevel = Math.max(1, nextLevelExperience - levelStartExperience)
  const experienceIntoLevel = Math.max(0, experience - levelStartExperience)
  const experienceRemaining = Math.max(0, nextLevelExperience - experience)
  const progressPercent = Math.max(0, Math.min(100, (experienceIntoLevel / experienceNeededForLevel) * 100))
  return {
    experience,
    level,
    levelStartExperience,
    nextLevelExperience,
    experienceIntoLevel,
    experienceNeededForLevel,
    experienceRemaining,
    progressPercent,
    canLevelUp: experience >= nextLevelExperience,
  }
}

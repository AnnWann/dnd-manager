import { calculateExperienceProgress } from "../../../../../packages/game-core/src/experience"
import type { CharacterExperienceProgress } from "../../../../../packages/game-core/src/experience"
export type { CharacterExperienceProgress } from "../../../../../packages/game-core/src/experience"
import type { CharacterTemplate } from "./CharacterTemplate"

export function getCharacterExperience(
  character: CharacterTemplate,
): number {
  const value = Number(character.get("sheet").stats.experience)
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

export function getTotalCharacterLevel(
  character: CharacterTemplate,
): number {
  const total = (character.get("sheet").classes ?? []).reduce(
    (sum, classData) => {
      const level = Number(classData.level)
      return sum + (Number.isFinite(level) ? Math.max(0, Math.trunc(level)) : 0)
    },
    0,
  )

  return Math.max(1, Math.min(20, total || 1))
}

export function getExperienceProgress(character: CharacterTemplate): CharacterExperienceProgress {
  return calculateExperienceProgress(getCharacterExperience(character), getTotalCharacterLevel(character))
}

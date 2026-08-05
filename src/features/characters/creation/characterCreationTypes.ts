import type { CharacterRelationship } from "../../../models/characters/characterProfile"
import type { ClassName } from "../../../models/sheet/Class"

export type CharacterCreationProgressionPlan = {
  className: ClassName
  targetLevel: number
}

export type CharacterCreationIdentity = {
  name: string
  alignment:
    | "lawful-good"
    | "neutral-good"
    | "chaotic-good"
    | "lawful-neutral"
    | "true-neutral"
    | "chaotic-neutral"
    | "lawful-evil"
    | "neutral-evil"
    | "chaotic-evil"
    | "unaligned"
  backgroundDescription: string
  physicalAppearance: string
  personalityTraits: string
  relationships: CharacterRelationship[]
}

export function createEmptyCharacterCreationIdentity(): CharacterCreationIdentity {
  return {
    name: "",
    alignment: "true-neutral",
    backgroundDescription: "",
    physicalAppearance: "",
    personalityTraits: "",
    relationships: [],
  }
}

import type { CharacterBackground } from "./CharacterBackground"

export type CharacterRelationship = {
  id: string
  name: string
  relation: string
  description?: string
}

export type CharacterAlignment =
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

export type CharacterProfile = {
  traits: string
  alignment?: CharacterAlignment
  history: string
  physicalAppearance: string
  imageUrl?: string
  relationships: CharacterRelationship[]
  background?: CharacterBackground
}

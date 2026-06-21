export type CharacterRelationship = {
  id: string
  name: string
  relation: string
  description?: string
}

export type CharacterProfile = {
  traits: string
  history: string
  physicalAppearance: string
  imageUrl?: string
  relationships: CharacterRelationship[]
}
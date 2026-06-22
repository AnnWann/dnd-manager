import type { Itemmable } from "../items/item"
import type { Proficiency } from "../sheet/Proficiency"
import type { Skill } from "../sheet/Skills"

export type CharacterBackground = {
  id: string
  name: string
  description: string
  skillProficiencies: Skill[]
  proficiencies: Proficiency[]
  startingEquipment: Itemmable[]
  featureName?: string
  featureDescription?: string
  custom?: boolean
}

export function emptyCharacterBackground(): CharacterBackground {
  return {
    id: "custom",
    name: "Antecedente personalizado",
    description: "",
    skillProficiencies: [],
    proficiencies: [],
    startingEquipment: [],
    featureName: "",
    featureDescription: "",
    custom: true,
  }
}

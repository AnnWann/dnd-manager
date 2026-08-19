import type { Proficiency } from "../../models/sheet/Proficiency"

export type SessionProficiencyOperation =
  | { type: "character.proficiency.add"; characterId: string; proficiency: Proficiency }
  | { type: "character.proficiency.remove"; characterId: string; proficiencyId: string; proficiencyName?: string }

export type SessionProficiencyClientMessage = {
  type: "session.proficiency.operation"
  operation: SessionProficiencyOperation
}

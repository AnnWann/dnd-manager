/** Shared operation envelope; application model types are injected by consumers. */
export type SessionProficiencyOperation<TProficiency> =
  | { type: "character.proficiency.add"; characterId: string; proficiency: TProficiency }
  | { type: "character.proficiency.remove"; characterId: string; proficiencyId: string; proficiencyName?: string }

export type SessionProficiencyClientMessage<TProficiency> = {
  type: "session.proficiency.operation"
  operation: SessionProficiencyOperation<TProficiency>
}

/** Framework-neutral racial character operation contracts. */
export type SessionRaceOperation<TRace, TSkills, TSavingThrows> =
  | { type: "character.race.replace"; characterId: string; race: TRace; skills: TSkills; savingThrowProficiencies: TSavingThrows }
  | { type: "character.race.spells.replace"; characterId: string; racialSpells: Record<string, unknown>[] }

export type SessionRaceClientMessage<TRace, TSkills, TSavingThrows> = {
  type: "session.race.operation"
  operation: SessionRaceOperation<TRace, TSkills, TSavingThrows>
}

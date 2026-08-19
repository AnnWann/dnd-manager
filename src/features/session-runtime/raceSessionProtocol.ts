import type { CharacterRace } from "../../models/races/CharacterRace"
import type { CharacterSkills } from "../../models/sheet/CharacterSkills"
import type { SavingThrowProficiencies } from "../../models/sheet/SavingThrows"

export type SessionRaceOperation =
  | {
      type: "character.race.replace"
      characterId: string
      race: CharacterRace
      skills: CharacterSkills
      savingThrowProficiencies: SavingThrowProficiencies
    }
  | {
      type: "character.race.spells.replace"
      characterId: string
      racialSpells: Record<string, unknown>[]
    }

export type SessionRaceClientMessage = {
  type: "session.race.operation"
  operation: SessionRaceOperation
}

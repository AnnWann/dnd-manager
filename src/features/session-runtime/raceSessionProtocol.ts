import type { CharacterRace } from "../../models/races/CharacterRace"
import type { SkillProficiency } from "../../models/sheet/Skills"

export type SessionRaceOperation =
  | {
      type: "character.race.replace"
      characterId: string
      race: CharacterRace
      skills: Record<string, SkillProficiency>
      savingThrowProficiencies: Record<string, boolean>
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

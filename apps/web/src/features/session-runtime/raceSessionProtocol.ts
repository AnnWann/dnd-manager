import type { CharacterRace } from "../../models/races/CharacterRace"
import type { CharacterSkills } from "../../models/sheet/CharacterSkills"
import type { SavingThrowProficiencies } from "../../models/sheet/SavingThrows"
import type {
  SessionRaceOperation as SharedRaceOperation,
  SessionRaceClientMessage as SharedRaceClientMessage,
} from "../../../../../packages/session-protocol/src/raceOperations"

export type SessionRaceOperation = SharedRaceOperation<CharacterRace, CharacterSkills, SavingThrowProficiencies>
export type SessionRaceClientMessage = SharedRaceClientMessage<CharacterRace, CharacterSkills, SavingThrowProficiencies>

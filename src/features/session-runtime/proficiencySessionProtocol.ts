import type { Proficiency } from "../../models/sheet/Proficiency"

import type {
  SessionProficiencyOperation as SharedSessionProficiencyOperation,
  SessionProficiencyClientMessage as SharedSessionProficiencyClientMessage,
} from "../../../packages/session-protocol/src/proficiencyOperations"

export type SessionProficiencyOperation = SharedSessionProficiencyOperation<Proficiency>
export type SessionProficiencyClientMessage = SharedSessionProficiencyClientMessage<Proficiency>

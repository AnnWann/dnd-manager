import type { CharacterBackground } from "../../models/characters/CharacterBackground"
import type { CharacterProfile } from "../../models/characters/characterProfile"
import type {
  SessionProfileOperation as SharedProfileOperation,
  SessionProfileClientMessage as SharedProfileClientMessage,
} from "../../../packages/session-protocol/src/profileOperations"

export type SessionProfileOperation = SharedProfileOperation<CharacterProfile, CharacterBackground>
export type SessionProfileClientMessage = SharedProfileClientMessage<CharacterProfile, CharacterBackground>

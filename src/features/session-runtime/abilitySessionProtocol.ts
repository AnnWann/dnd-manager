import type { Ability, AbilityResourceSelection } from "../../models/abilities/Ability"
import type { BonusRollResolution } from "../../models/bonuses/Bonus"
import type { CharacterTemplateProps } from "../../models/characters/CharacterTemplate"
import type { DamageAffinity } from "../../models/combat/Damage"
import type { SessionCustomSystemOperation } from "./customSystemSessionProtocol"

import type {
  SessionAbilitySource,
  SessionAbilitySeed as SharedSeed,
  SessionAbilityState as SharedState,
  SessionAbilityOperation as SharedOperation,
  SessionAbilityClientMessage as SharedClientMessage,
  SessionAbilityServerMessage as SharedServerMessage,
} from "../../../packages/session-protocol/src/abilities"
export type { SessionAbilitySource } from "../../../packages/session-protocol/src/abilities"
export type SessionAbilitySeed = SharedSeed<CharacterTemplateProps>
export type SessionAbilityState = SharedState<CharacterTemplateProps>
export type SessionAbilityOperation = SharedOperation<AbilityResourceSelection, BonusRollResolution, DamageAffinity, Ability, SessionCustomSystemOperation>
export type SessionAbilityClientMessage = SharedClientMessage<CharacterTemplateProps, AbilityResourceSelection, BonusRollResolution, DamageAffinity, Ability, SessionCustomSystemOperation>
export type SessionAbilityServerMessage = SharedServerMessage<CharacterTemplateProps>

export function parseAbilityServerMessage(raw: string): SessionAbilityServerMessage | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!isRecord(parsed) || typeof parsed.type !== "string") return null

  if (parsed.type === "session.abilities.snapshot" && Array.isArray(parsed.characters)) {
    return {
      type: "session.abilities.snapshot",
      characters: parsed.characters.filter(isAbilityState),
    }
  }

  if (parsed.type === "session.abilities.updated" && isAbilityState(parsed.character)) {
    return {
      type: "session.abilities.updated",
      character: parsed.character,
    }
  }

  return null
}

function isAbilityState(value: unknown): value is SessionAbilityState {
  return (
    isRecord(value) &&
    typeof value.characterId === "string" &&
    isRecord(value.character) &&
    value.initialized === true &&
    typeof value.revision === "number"
  )
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

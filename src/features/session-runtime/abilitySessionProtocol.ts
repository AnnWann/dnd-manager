import type { Ability, AbilityResourceSelection } from "../../models/abilities/Ability"
import type { BonusRollResolution } from "../../models/bonuses/Bonus"
import type { CharacterTemplateProps } from "../../models/characters/CharacterTemplate"
import type { DamageAffinity } from "../../models/combat/Damage"
import type { SessionCustomSystemOperation } from "./customSystemSessionProtocol"

export type SessionAbilitySource =
  | { type: "character"; abilityId: string }
  | { type: "race"; abilityId: string }
  | { type: "equipment"; itemId: string; abilityId: string }
  | { type: "condition"; conditionId: string; abilityId: string }

export type SessionAbilitySeed = {
  characterId: string
  character: CharacterTemplateProps
}

export type SessionAbilityState = {
  characterId: string
  character: CharacterTemplateProps
  initialized: boolean
  revision: number
}

export type SessionAbilityOperation =
  | {
      type: "character.ability.use"
      characterId: string
      source: SessionAbilitySource
      abilityName?: string
      activationOptionId?: string
      resourceSelection?: AbilityResourceSelection
      /** Resultados dos dados informados pelo jogador para bônus em modo manual. */
      bonusRollValues?: Record<string, number>
      /** Preenchido pelo servidor para auditoria e exibição no log. */
      bonusRollResults?: BonusRollResolution[]
    }
  | {
      type: "character.ability.usage.spend"
      characterId: string
      source: SessionAbilitySource
      abilityName?: string
    }
  | {
      type: "character.ability.restore"
      characterId: string
      source: SessionAbilitySource
      abilityName?: string
    }
  | {
      type: "character.ability.deactivate"
      characterId: string
      source: SessionAbilitySource
      abilityName?: string
    }
  | {
      type: "character.ability.save"
      characterId: string
      ability: Ability
    }
  | {
      type: "character.ability.remove"
      characterId: string
      abilityId: string
      abilityName?: string
    }
  | {
      type: "character.damageAffinities.set"
      characterId: string
      damageAffinities: DamageAffinity[]
    }
  | SessionCustomSystemOperation

export type SessionAbilityClientMessage =
  | { type: "session.abilities.initialize"; characters: SessionAbilitySeed[] }
  | { type: "session.abilities.operation"; operation: SessionAbilityOperation }

export type SessionAbilityServerMessage =
  | { type: "session.abilities.snapshot"; characters: SessionAbilityState[] }
  | { type: "session.abilities.updated"; character: SessionAbilityState }

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

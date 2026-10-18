export type SessionAbilitySource =
  | { type: "character"; abilityId: string }
  | { type: "race"; abilityId: string }
  | { type: "equipment"; itemId: string; abilityId: string }
  | { type: "condition"; conditionId: string; abilityId: string }

export type SessionAbilitySeed<TCharacter> = {
  characterId: string
  character: TCharacter
}

export type SessionAbilityState<TCharacter> = {
  characterId: string
  character: TCharacter
  initialized: boolean
  revision: number
}

export type SessionAbilityOperation<TResourceSelection, TBonus, TAffinity, TAbility, TCustomOperation> =
  | {
      type: "character.ability.use"
      characterId: string
      source: SessionAbilitySource
      abilityName?: string
      activationOptionId?: string
      selectedWeaponId?: string
      resourceSelection?: TResourceSelection
      /** Resultados dos dados informados pelo jogador para bônus em modo manual. */
      bonusRollValues?: Record<string, number>
      /** Preenchido pelo servidor para auditoria e exibição no log. */
      bonusRollResults?: TBonus[]
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
      ability: TAbility
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
      damageAffinities: TAffinity[]
    }
  | TCustomOperation

export type SessionAbilityClientMessage<TCharacter, TResourceSelection, TBonus, TAffinity, TAbility, TCustomOperation> =
  | { type: "session.abilities.initialize"; characters: SessionAbilitySeed<TCharacter>[] }
  | { type: "session.abilities.operation"; operation: SessionAbilityOperation<TResourceSelection, TBonus, TAffinity, TAbility, TCustomOperation> }

export type SessionAbilityServerMessage<TCharacter> =
  | { type: "session.abilities.snapshot"; characters: SessionAbilityState<TCharacter>[] }
  | { type: "session.abilities.updated"; character: SessionAbilityState<TCharacter> }


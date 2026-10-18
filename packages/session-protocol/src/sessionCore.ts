export type SessionRuntimeRole = "MASTER" | "PLAYER"
export type SessionRuntimePresenceUser = { userId: string; userName?: string; clientId: string; role: SessionRuntimeRole }

export type SessionDieSides =
  | "d2" | "d3" | "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100"
export type SessionHitDicePool = { current: number; max: number }
export type SessionHitDiceState = Partial<Record<SessionDieSides, SessionHitDicePool>>

export type SessionAttribute = "str" | "dex" | "con" | "int" | "wis" | "cha"
export type SessionAttributesState = Record<SessionAttribute, number>
export type SessionSavingThrowsState = Record<SessionAttribute, boolean>
export type SessionSkill =
  | "acrobatics" | "arcana" | "athletics" | "animalHandling" | "performance"
  | "deception" | "stealth" | "history" | "intimidation" | "insight"
  | "investigation" | "medicine" | "nature" | "perception" | "persuasion"
  | "sleightOfHand" | "religion" | "survival"
export type SessionSkillProficiency = "none" | "proficient" | "expertise"
export type SessionSkillsState = Record<SessionSkill, SessionSkillProficiency>

export type SessionStatsState = {
  armorClassAdjustment: number
  initiativeAdjustment: number
  mobilityAdjustment: number
  passivePerceptionAdjustment: number
  exhaustion: number
  inspiration: boolean
  experience: number
}

export type SessionConditionDuration = {
  type:
    | "rounds" | "turns" | "minutes" | "hours" | "days"
    | "until-start-of-turn" | "until-end-of-turn" | "until-save"
    | "concentration" | "permanent" | "custom"
  total?: number
  remaining?: number
  tickOn?: "start-of-turn" | "end-of-turn" | "manual"
  tickOwner?: "affected" | "source"
  autoRemoveAtZero?: boolean
  customLabel?: string
  expiresAt?: string
}

export type SessionCondition = {
  id: string
  name: string
  description: string
  behavior: string
  source: string
  notes: string
  tags: string[]
  bonuses?: unknown
  grantedSpells?: unknown[]
  grantedProficiencies?: unknown[]
  grantedAbilities?: unknown[]
  duration: SessionConditionDuration
  createdAt: string
  sourceAbilityId?: string
  sourceAbilityLocation?: "character" | "race" | "equipment" | "condition"
  sourceItemId?: string
  sourceAbilityOptionId?: string
  sourceCharacterId?: string
  linkedCombatantId?: string
  initiativeEffectId?: string
}

export type SessionConditionsState = {
  characterId: string
  conditions: SessionCondition[]
  initialized: boolean
  revision: number
}

export type SessionConditionSeed = {
  characterId: string
  conditions: SessionCondition[]
}

export type SessionHpState = {
  characterId: string
  ownerUserId?: string
  current: number
  temporary: number
  max: number
  currentMax: number
  maxHpBonus: number
  hitDice: SessionHitDiceState
  stats: SessionStatsState
  statsInitialized: boolean
  attributes: SessionAttributesState
  attributesInitialized: boolean
  savingThrows: SessionSavingThrowsState
  savingThrowsInitialized: boolean
  skills: SessionSkillsState
  skillsInitialized: boolean
  revision: number
}
export type SessionHpSeed = Omit<SessionHpState, "revision" | "hitDice" | "stats" | "statsInitialized" | "attributes" | "attributesInitialized" | "savingThrows" | "savingThrowsInitialized" | "skills" | "skillsInitialized"> & {
  hitDice?: SessionHitDiceState
  stats?: SessionStatsState
  attributes?: SessionAttributesState
  savingThrows?: Partial<SessionSavingThrowsState>
  skills?: Partial<SessionSkillsState>
}

export type SessionHpOperation =
  | { type: "character.hp.set"; characterId: string; value: number }
  | { type: "character.hp.temporary.set"; characterId: string; value: number }
  | { type: "character.hp.temporary.add"; characterId: string; amount: number }
  | { type: "character.hp.damage"; characterId: string; amount: number; damageType?: string; source?: string; requiresConcentrationCheck?: boolean; concentrationDc?: number; concentrationSource?: string }
  | { type: "character.hp.heal"; characterId: string; amount: number; source?: string }
  | { type: "character.hp.max.set"; characterId: string; value: number }
  | { type: "character.hp.currentMax.adjust"; characterId: string; amount: number }
  | { type: "character.hp.currentMax.restore"; characterId: string }

export type SessionHitDiceOperation =
  | { type: "character.hitDice.use"; characterId: string; side: SessionDieSides; amount: number }
  | { type: "character.hitDice.recover"; characterId: string; side: SessionDieSides; amount: number }
  | { type: "character.hitDice.add"; characterId: string; side: SessionDieSides; amount: number }
  | { type: "character.hitDice.remove"; characterId: string; side: SessionDieSides }

export type SessionCalculatedStatOperation =
  | { type: "character.stat.armorClass.set"; characterId: string; value: number; calculatedValue: number }
  | { type: "character.stat.initiative.set"; characterId: string; value: number; calculatedValue: number }
  | { type: "character.stat.mobility.set"; characterId: string; value: number; calculatedValue: number }
  | { type: "character.stat.passivePerception.set"; characterId: string; value: number; calculatedValue: number }

export type SessionSimpleStatOperation =
  | { type: "character.stat.exhaustion.set"; characterId: string; value: number }
  | { type: "character.stat.inspiration.set"; characterId: string; value: boolean }
  | { type: "character.stat.experience.set"; characterId: string; value: number }

export type SessionStatOperation = SessionCalculatedStatOperation | SessionSimpleStatOperation
export type SessionAttributeOperation = { type: "character.attribute.set"; characterId: string; attribute: SessionAttribute; value: number }
export type SessionSavingThrowOperation = { type: "character.savingThrow.set"; characterId: string; attribute: SessionAttribute; proficient: boolean }
export type SessionSkillOperation = { type: "character.skill.set"; characterId: string; skill: SessionSkill; proficiency: SessionSkillProficiency }
export type SessionConditionOperation =
  | { type: "character.condition.add"; characterId: string; condition: SessionCondition }
  | { type: "character.condition.update"; characterId: string; condition: SessionCondition }
  | { type: "character.condition.remove"; characterId: string; conditionId: string }
export type SessionConcentrationOperation =
  | { type: "character.concentration.start"; characterId: string; spellIndex: string; spellName: string }
  | { type: "character.concentration.end"; characterId: string; reason?: "manual" | "failed-save" }

export type SessionLongRestSupplySelection = {
  itemId: string
  portions: number
}

export type SessionRestOperation =
  | { type: "character.rest.short"; characterId: string; healing: number; hitDiceConsumption: Partial<Record<SessionDieSides, number>> }
  | {
      type: "character.rest.long"
      characterId: string
      recovery: "partial" | "full"
      selection: SessionLongRestSupplySelection[]
      /** MASTER-only override: complete a full long rest without consuming supplies. */
      resourceFree?: boolean
    }

export type SessionAuthoritativeOperation = SessionHpOperation | SessionHitDiceOperation | SessionStatOperation | SessionAttributeOperation | SessionSavingThrowOperation | SessionSkillOperation | SessionRestOperation
export type SessionLoggedOperation = SessionAuthoritativeOperation | SessionConditionOperation | SessionConcentrationOperation

export type SessionHpLogRecord = {
  id: string
  actorId: string
  actorName?: string
  createdAt: string
  operation: SessionLoggedOperation | { type: "character.hp.undo"; characterId: string; sourceLogId: string }
  reverseOperation:
    | { type: "character.hp.restore"; characterId: string; hp: SessionHpState }
    | { type: "character.stat.armorClass.restore"; characterId: string; adjustment: number }
    | { type: "character.stat.initiative.restore"; characterId: string; adjustment: number }
    | { type: "character.stat.mobility.restore"; characterId: string; adjustment: number }
    | { type: "character.stat.passivePerception.restore"; characterId: string; adjustment: number }
    | { type: "character.stat.exhaustion.restore"; characterId: string; value: number }
    | { type: "character.stat.inspiration.restore"; characterId: string; value: boolean }
    | { type: "character.stat.experience.restore"; characterId: string; value: number }
    | { type: "character.attribute.restore"; characterId: string; attribute: SessionAttribute; value: number }
    | { type: "character.savingThrow.restore"; characterId: string; attribute: SessionAttribute; proficient: boolean }
    | { type: "character.skill.restore"; characterId: string; skill: SessionSkill; proficiency: SessionSkillProficiency }
    | { type: "character.condition.delete"; characterId: string; conditionId: string }
    | { type: "character.condition.restore"; characterId: string; condition: SessionCondition }
    | { type: "character.concentration.restore"; characterId: string; conditions: SessionCondition[] }
    | { type: "character.rest.restore"; characterId: string; snapshot: { hp: SessionHpState; stats: SessionStatsState } }
  undoneAt?: string
  undoneBy?: string
}


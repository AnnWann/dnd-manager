import type { Attribute } from "../../models/sheet/Attribute"
import type { Skill } from "../../models/sheet/Skills"

export type SessionDiceRollMode = "normal" | "advantage" | "disadvantage"

export type SessionDiceRollKind =
  | "ability"
  | "skill"
  | "save"
  | "initiative"
  | "attack"
  | "damage"
  | "spell-attack"

export type SessionDiceD20Source =
  | { type: "ability"; attribute: Attribute }
  | { type: "skill"; skill: Skill }
  | { type: "save"; attribute: Attribute }
  | { type: "initiative" }
  | { type: "weapon-attack"; weaponId: string }
  | { type: "unarmed-attack" }
  | { type: "spell-attack"; attribute: Attribute }

export type SessionDiceDamageSource =
  | { type: "weapon-damage"; weaponId: string }
  | { type: "unarmed-damage" }

export type SessionDiceRollSource = SessionDiceD20Source | SessionDiceDamageSource

export type SessionDiceRollRequest = {
  requestId: string
  characterId: string
  label: string
  mode: SessionDiceRollMode
  source: SessionDiceRollSource
}

export type SessionDiceRollGroupResult = {
  quantity: number
  sides: number
  rolls: number[]
  kept?: number
}

export type SessionDiceRollResult = {
  id: string
  requestId: string
  actorId: string
  characterId: string
  label: string
  kind: SessionDiceRollKind
  mode: SessionDiceRollMode
  groups: SessionDiceRollGroupResult[]
  modifier: number
  total: number
  natural?: number
  createdAt: string
}


export type SessionActionRollSource =
  | { type: "weapon"; weaponId: string }
  | { type: "unarmed" }
  | { type: "spell"; spellIndex: string; sourceId: string }
  | { type: "ability"; abilityId: string }

export type SessionActionRollRequest = {
  requestId: string
  characterId: string
  mode: SessionDiceRollMode
  source: SessionActionRollSource
}

export type SessionResolvedD20Roll = {
  mode: SessionDiceRollMode
  groups: SessionDiceRollGroupResult[]
  modifier: number
  total: number
  natural: number
}

export type SessionResolvedDamageRoll = {
  groups: SessionDiceRollGroupResult[]
  modifier: number
  total: number
  critical: boolean
}

export type SessionActionRollResult = {
  id: string
  requestId: string
  actorId: string
  characterId: string
  sourceType: "weapon" | "unarmed" | "spell" | "ability"
  title: string
  subtitle?: string
  description?: string
  details?: string[]
  attack?: SessionResolvedD20Roll
  save?: {
    attribute: Attribute
    dc: number
  }
  damage?: SessionResolvedDamageRoll
  critical: boolean
  createdAt: string
}

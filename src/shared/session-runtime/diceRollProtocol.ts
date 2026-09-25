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
  | "manual"

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

export type SessionDiceManualSource =
  | { type: "manual"; expression: string; initiativeEntryId?: string }

export type SessionDiceRollSource =
  | SessionDiceD20Source
  | SessionDiceDamageSource
  | SessionDiceManualSource

export type SessionDiceRollRequest = {
  requestId: string
  characterId?: string
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
  characterId?: string
  sourceName?: string
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
  | { type: "ability"; abilityId: string }
  | {
      type: "announcement"
      title: string
      subtitle?: string
      description?: string
    }

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
  label?: string
  damageType?: string
}

export type SessionActionInstanceResult = {
  label: string
  attack?: SessionResolvedD20Roll
  damages?: SessionResolvedDamageRoll[]
}

export type SessionActionRollResult = {
  id: string
  requestId: string
  actorId: string
  characterId: string
  sourceName?: string
  sourceType: "weapon" | "unarmed" | "spell" | "ability" | "creature" | "announcement"
  title: string
  subtitle?: string
  description?: string
  details?: string[]
  attack?: SessionResolvedD20Roll
  save?: {
    attribute: Attribute
    dc: number
    onSuccess?: "none" | "half" | "full"
  }
  /** Legacy/single damage block used by weapons and simple actions. */
  damage?: SessionResolvedDamageRoll
  /** Structured spell damage when one action can contain multiple components. */
  damages?: SessionResolvedDamageRoll[]
  /** Multi-attack/projectile spells expose one resolved instance per attack. */
  instances?: SessionActionInstanceResult[]
  castLevel?: number
  critical: boolean
  createdAt: string
}


export type SessionCreatureRollSource =
  | { type: "ability"; attribute: Attribute }
  | { type: "save"; attribute: Attribute }
  | { type: "skill"; skill: Skill }
  | { type: "initiative" }
  | { type: "feature"; featureId: string; intent?: "resolve" | "announce" }

export type SessionCreatureRollRequest = {
  requestId: string
  creatureId: string
  initiativeEntryId?: string
  mode: SessionDiceRollMode
  source: SessionCreatureRollSource
}

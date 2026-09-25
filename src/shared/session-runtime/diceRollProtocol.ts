export type SessionDiceRollMode = "normal" | "advantage" | "disadvantage"

export type SessionDiceRollKind =
  | "ability"
  | "skill"
  | "save"
  | "initiative"
  | "attack"
  | "damage"
  | "spell-attack"
  | "custom"

export type SessionDiceGroupRequest = {
  quantity: number
  sides: number
}

export type SessionDiceRollRequest = {
  requestId: string
  characterId: string
  label: string
  kind: SessionDiceRollKind
  mode: SessionDiceRollMode
  groups: SessionDiceGroupRequest[]
  modifier: number
}

export type SessionDiceRollGroupResult = SessionDiceGroupRequest & {
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

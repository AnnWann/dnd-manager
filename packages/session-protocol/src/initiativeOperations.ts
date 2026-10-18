import type { InitiativeHpApplicationResult } from "./initiativeHp"

/** Protocol-only wire shape; concrete damage types are supplied by each runtime. */
export type InitiativeDamagePart<TDamageType extends string = string> = {
  amount: number
  damageType?: TDamageType
  magical?: boolean
}

export type SessionInitiativeOperation<TDamageType extends string = string> =
  | { type: "initiative.entries.add"; characterId: "session"; entries: Record<string, unknown>[] }
  | { type: "initiative.entry.update"; characterId: "session"; entryId: string; patch: Record<string, unknown> }
  | { type: "initiative.entry.remove"; characterId: "session"; entryId: string }
  | { type: "initiative.sort"; characterId: "session" }
  | { type: "initiative.combat.start"; characterId: "session" }
  | { type: "initiative.combat.end"; characterId: "session" }
  | { type: "initiative.turn.next"; characterId: "session" }
  | { type: "initiative.turn.previous"; characterId: "session" }
  | { type: "initiative.allies.trade"; characterId: "session"; entryId: string; direction: 1 }
  | { type: "initiative.viewMode.set"; characterId: "session"; viewMode: "table" | "cards" }
  | { type: "initiative.settings.update"; characterId: "session"; patch: { deathSaveVisibility?: "masterOnly" | "owner" | "everyone"; deathSaveOwnerCanEdit?: boolean } }
  | { type: "initiative.deathSaves.set"; characterId: "session"; entryId: string; successes: number; failures: number }
  | { type: "initiative.conditions.bulk"; characterId: "session"; entryIds: string[]; mode: "add" | "remove"; condition?: Record<string, unknown>; conditionName?: string }
  | { type: "initiative.hp.apply"; characterId: "session"; entryIds: string[]; mode: "damage"; parts: InitiativeDamagePart<TDamageType>[]; results?: InitiativeHpApplicationResult[] }
  | { type: "initiative.hp.apply"; characterId: "session"; entryIds: string[]; mode: "heal" | "temporary"; amount: number; results?: InitiativeHpApplicationResult[] }
  | { type: "initiative.customAction.execute"; characterId: "session"; systemId: string; actionId: string; entryIds: string[] }
  | { type: "initiative.reset"; characterId: "session" }

/**
 * Session-owned sealed spell commitments. Private fields NEVER belong in a
 * session snapshot or a session log that can be sent to clients.
 */
export type HiddenSpellActor =
  | { kind: "character"; characterId: string }
  | { kind: "creature"; creatureId: string; initiativeEntryId?: string }

export type HiddenSpellRollMode = "normal" | "advantage" | "disadvantage"

export type HiddenSpellCommitment = {
  id: string
  ownerUserId: string
  actor: HiddenSpellActor
  actorLabel: string
  spellIndex: string
  spellName: string
  castLevel: number
  sourceId?: string
  payment?: Record<string, unknown>
  targetEntryId?: string
  selectedDamageType?: string
  selectedWeaponId?: string
  mode: HiddenSpellRollMode
  counterspellTargetId?: string
  createdAt: string
  round?: number
  resolvedAt?: string
  revealedAt?: string
  privateResult?: Record<string, unknown>
  privateRiders?: Array<Record<string, unknown>>
  counterspelled?: boolean
  counterspellCheck?: { die: number; modifier: number; total: number; dc: number; success: boolean }
}

export type HiddenSpellPublicEntry = {
  id: string
  actorLabel: string
  actor: HiddenSpellActor
  createdAt: string
  status: "hidden" | "resolved" | "revealed"
  spellName?: string
  castLevel?: number
  counterspelled?: boolean
  counterspellCheck?: HiddenSpellCommitment["counterspellCheck"]
}

export type HiddenSpellClientMessage =
  | {
      type: "session.hiddenSpell.commit"
      requestId: string
      actor: HiddenSpellActor
      spellIndex: string
      castLevel: number
      sourceId?: string
      payment?: Record<string, unknown>
      targetEntryId?: string
      selectedDamageType?: string
      selectedWeaponId?: string
      mode?: HiddenSpellRollMode
      counterspellTargetId?: string
    }
  | { type: "session.hiddenSpell.resolve"; id: string }
  | { type: "session.hiddenSpell.reveal"; id: string }

export type HiddenSpellServerMessage = {
  type: "session.hiddenSpell.snapshot"
  entries: HiddenSpellPublicEntry[]
}

export function projectHiddenSpell(entry: HiddenSpellCommitment): HiddenSpellPublicEntry {
  const base: HiddenSpellPublicEntry = {
    id: entry.id,
    actor: entry.actor,
    actorLabel: entry.actorLabel,
    createdAt: entry.createdAt,
    status: entry.revealedAt ? "revealed" : entry.resolvedAt ? "resolved" : "hidden",
  }
  if (!entry.revealedAt) return base
  return {
    ...base,
    spellName: entry.spellName,
    castLevel: entry.castLevel,
    counterspelled: entry.counterspelled,
    counterspellCheck: entry.counterspellCheck,
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v)
const validId = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{1,120}$/.test(v)
const bounded = (v: unknown, n = 200) =>
  v === undefined || (typeof v === "string" && v.trim().length > 0 && v.length <= n)

export function parseHiddenSpellClientMessage(raw: string): HiddenSpellClientMessage | null {
  if (raw.length > 12000) return null
  let value: unknown
  try { value = JSON.parse(raw) } catch { return null }
  if (!isRecord(value)) return null
  if (value.type === "session.hiddenSpell.reveal" || value.type === "session.hiddenSpell.resolve") {
    return validId(value.id) ? { type: value.type, id: value.id } : null
  }
  if (value.type !== "session.hiddenSpell.commit") return null
  if (!validId(value.requestId) || !validId(value.spellIndex)
      || !Number.isInteger(value.castLevel) || (value.castLevel as number) < 0 || (value.castLevel as number) > 9
      || !bounded(value.sourceId) || !bounded(value.targetEntryId)
      || !bounded(value.selectedDamageType, 32) || !bounded(value.selectedWeaponId, 160)
      || (value.mode !== undefined && !["normal", "advantage", "disadvantage"].includes(String(value.mode)))
      || (value.counterspellTargetId !== undefined && !validId(value.counterspellTargetId))) return null
  if (!isRecord(value.actor)) return null
  const a = value.actor
  let actor: HiddenSpellActor
  if (a.kind === "character" && validId(a.characterId)) {
    if (typeof value.sourceId !== "string" || !isRecord(value.payment)) return null
    actor = { kind: "character", characterId: a.characterId }
  } else if (a.kind === "creature" && validId(a.creatureId)
      && (a.initiativeEntryId === undefined || validId(a.initiativeEntryId))) {
    actor = { kind: "creature", creatureId: a.creatureId,
      ...(a.initiativeEntryId ? { initiativeEntryId: a.initiativeEntryId as string } : {}) }
  } else return null
  if (value.payment !== undefined && (!isRecord(value.payment) || JSON.stringify(value.payment).length > 2000)) return null
  return {
    type: "session.hiddenSpell.commit",
    requestId: value.requestId,
    actor,
    spellIndex: value.spellIndex,
    castLevel: value.castLevel as number,
    ...(typeof value.sourceId === "string" ? { sourceId: value.sourceId } : {}),
    ...(isRecord(value.payment) ? { payment: value.payment } : {}),
    ...(typeof value.targetEntryId === "string" ? { targetEntryId: value.targetEntryId } : {}),
    ...(typeof value.selectedDamageType === "string" ? { selectedDamageType: value.selectedDamageType } : {}),
    ...(typeof value.selectedWeaponId === "string" ? { selectedWeaponId: value.selectedWeaponId } : {}),
    mode: (value.mode as HiddenSpellRollMode | undefined) ?? "normal",
    ...(typeof value.counterspellTargetId === "string" ? { counterspellTargetId: value.counterspellTargetId } : {}),
  }
}

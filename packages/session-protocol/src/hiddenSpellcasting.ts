/**
 * Secret, server-owned spell declarations. Never serialize HiddenSpellCommitment
 * into public session snapshots. The public projection deliberately omits spell
 * identity, chosen level, and payment details even for MASTER connections.
 */
export type HiddenSpellActor =
  | { kind: "character"; characterId: string }
  | { kind: "creature"; creatureId: string; initiativeEntryId?: string }

export type HiddenSpellCommitment = {
  id: string
  ownerUserId: string
  actor: HiddenSpellActor
  actorLabel: string
  spellIndex: string
  spellName: string
  castLevel: number
  /** Generic serializable payment descriptor stored only on the server. */
  payment?: Record<string, unknown>
  createdAt: string
  revealedAt?: string
}

export type HiddenSpellPublicEntry = {
  id: string
  actorLabel: string
  actor: HiddenSpellActor
  createdAt: string
  status: "hidden" | "revealed"
  spellName?: string
  castLevel?: number
}

export type HiddenSpellClientMessage =
  | { type: "session.hiddenSpell.commit"; requestId: string; actor: HiddenSpellActor; spellIndex: string; spellName: string; castLevel: number; payment?: Record<string, unknown> }
  | { type: "session.hiddenSpell.reveal"; id: string }

export type HiddenSpellServerMessage = {
  type: "session.hiddenSpell.snapshot"
  entries: HiddenSpellPublicEntry[]
}

export function projectHiddenSpell(entry: HiddenSpellCommitment): HiddenSpellPublicEntry {
  const publicBase: HiddenSpellPublicEntry = {
    id: entry.id,
    actor: entry.actor,
    actorLabel: entry.actorLabel,
    createdAt: entry.createdAt,
    status: entry.revealedAt ? "revealed" : "hidden",
  }
  if (!entry.revealedAt) return publicBase
  return { ...publicBase, spellName: entry.spellName, castLevel: entry.castLevel }
}

export function parseHiddenSpellClientMessage(raw: string): HiddenSpellClientMessage | null {
  if (raw.length > 12000) return null
  let value: unknown
  try { value = JSON.parse(raw) } catch { return null }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (data.type === "session.hiddenSpell.reveal") {
    return typeof data.id === "string" && /^[\w-]{1,120}$/.test(data.id)
      ? { type: "session.hiddenSpell.reveal", id: data.id } : null
  }
  if (data.type !== "session.hiddenSpell.commit") return null
  if (typeof data.requestId !== "string" || !/^[\w-]{1,120}$/.test(data.requestId)
    || typeof data.spellIndex !== "string" || !/^[\w-]{1,120}$/.test(data.spellIndex)
    || typeof data.spellName !== "string" || !data.spellName.trim() || data.spellName.length > 150
    || !Number.isInteger(data.castLevel) || (data.castLevel as number) < 0 || (data.castLevel as number) > 9) return null
  const actor = data.actor
  if (!actor || typeof actor !== "object" || Array.isArray(actor)) return null
  const a = actor as Record<string, unknown>
  const validId = (id: unknown): id is string => typeof id === "string" && /^[\w-]{1,120}$/.test(id)
  let normalizedActor: HiddenSpellActor
  if (a.kind === "character" && validId(a.characterId)) {
    normalizedActor = { kind: "character", characterId: a.characterId }
  } else if (a.kind === "creature" && validId(a.creatureId) && (a.initiativeEntryId === undefined || validId(a.initiativeEntryId))) {
    normalizedActor = { kind: "creature", creatureId: a.creatureId, initiativeEntryId: a.initiativeEntryId as string | undefined }
  } else return null
  const payment = data.payment
  if (payment !== undefined && (!payment || typeof payment !== "object" || Array.isArray(payment) || JSON.stringify(payment).length > 2000)) return null
  return {
    type: "session.hiddenSpell.commit",
    requestId: data.requestId,
    actor: normalizedActor,
    spellIndex: data.spellIndex,
    spellName: data.spellName,
    castLevel: data.castLevel as number,
    ...(payment ? { payment: payment as Record<string, unknown> } : {}),
  }
}

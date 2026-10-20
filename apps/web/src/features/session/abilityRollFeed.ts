import type { BonusRollResolution } from "../../models/bonuses/Bonus"
import type { SessionLogRecord } from "../session-runtime/sessionLogProtocol"

/**
 * The session operation contains the exact dice resolution used to apply the
 * ability. Display that record, never independently roll a second result.
 */
export type AbilityRollFeedEntry = {
  type: "ability"
  id: string
  characterId: string
  title: string
  rolls: BonusRollResolution[]
  createdAt: string
}

/** One card per ability activation, including all of its bonus/HP dice. */
export function buildAbilityRollFeed(
  records: SessionLogRecord[],
  hiddenRecordIds: ReadonlySet<string>,
): AbilityRollFeedEntry[] {
  return records.flatMap((record): AbilityRollFeedEntry[] => {
    if (record.operation.type !== "character.ability.use" || hiddenRecordIds.has(record.id) || record.undoneAt) return []
    const rolls = record.operation.bonusRollResults
    if (!rolls?.length) return []
    return [{
      type: "ability",
      id: record.id,
      characterId: record.operation.characterId,
      title: record.operation.abilityName?.trim() || "Habilidade",
      rolls,
      createdAt: record.createdAt,
    }]
  }).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

/** The clear button hides historical cards locally without deleting the audit log. */
export function readHiddenAbilityRollIds(sessionId: string | undefined): string[] {
  if (!sessionId || typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(`dnd-manager:session-dice-hidden:${sessionId}`)
    if (!raw) return []
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []
  } catch { return [] }
}

export function saveHiddenAbilityRollIds(sessionId: string | undefined, ids: string[]): void {
  if (!sessionId || typeof window === "undefined") return
  try {
    window.localStorage.setItem(`dnd-manager:session-dice-hidden:${sessionId}`, JSON.stringify(ids))
  } catch { /* Browsers can deny localStorage; in-memory clear still works. */ }
}

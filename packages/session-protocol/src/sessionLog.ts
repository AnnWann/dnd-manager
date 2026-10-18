
export type SessionLogScopeRecord = {
  id: string
  undoneAt?: string
  operation: { type: string }
  reverseOperation: { characterId: string; affectedScopes?: string[]; type: string }
}

export function sessionLogScopes<T extends SessionLogScopeRecord>(record: T): string[] {
  const reverse = record.reverseOperation
  if (reverse.affectedScopes?.length) return [...new Set(reverse.affectedScopes)]

  const scopes = [`character:${reverse.characterId}`]
  const operation = record.operation as T["operation"] & {
    request?: {
      from?: { type?: string; characterId?: string }
      to?: { type?: string; characterId?: string }
    }
  }

  if (operation.type.startsWith("mission.")) scopes.push("missions:shared")
  if (operation.type.startsWith("initiative.")) scopes.push("initiative:shared")

  if (
    operation.type.startsWith("party.")
    || operation.type.startsWith("ground.")
    || operation.type === "character.equipment.move.ground"
  ) {
    scopes.push("inventory:shared")
  }

  if (operation.type === "inventory.item.transfer") {
    for (const location of [operation.request?.from, operation.request?.to]) {
      if (location?.type === "character" && location.characterId) {
        scopes.push(`character:${location.characterId}`)
      } else if (location?.type === "party" || location?.type === "ground") {
        scopes.push("inventory:shared")
      }
    }
  }

  return [...new Set(scopes)]
}

export function isLatestUndoableSessionLog<T extends SessionLogScopeRecord>(
  records: readonly T[],
  target: T,
): boolean {
  if (target.undoneAt || target.operation.type === "character.hp.undo") return false
  const targetIndex = records.findIndex((record) => record.id === target.id)
  if (targetIndex < 0) return false
  const scopes = new Set(sessionLogScopes(target))

  return !records.slice(targetIndex + 1).some((record) => {
    if (record.undoneAt || record.operation.type === "character.hp.undo") return false
    return sessionLogScopes(record).some((scope) => scopes.has(scope))
  })
}

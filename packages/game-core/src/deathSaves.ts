/** Pure death-save counter transitions. The character wrapper remains responsible for persistence. */
export type DeathSaveState = { successes: number; failures: number }

export function addDeathSaveSuccess<T extends DeathSaveState>(state: T): T {
  return { ...state, successes: Math.max(0, Math.min(3, state.successes + 1)) }
}

export function addDeathSaveFailure<T extends DeathSaveState>(state: T): T {
  return { ...state, failures: Math.max(0, Math.min(3, state.failures + 1)) }
}

export function resetDeathSaveState(): DeathSaveState {
  return { successes: 0, failures: 0 }
}

import {
  createInitiativeSession,
  normalizeInitiativeSession,
  type InitiativeSession,
} from "../models/initiative/Initiative"

export interface InitiativeRepository {
  load(): Promise<InitiativeSession>
  save(session: InitiativeSession): Promise<void>
  clear(): Promise<InitiativeSession>
}

const LOCAL_STORAGE_KEY = "dnd-manager:initiative:v1"

export class LocalInitiativeRepository implements InitiativeRepository {
  constructor(private readonly storageKey = LOCAL_STORAGE_KEY) {}

  async load(): Promise<InitiativeSession> {
    if (typeof window === "undefined") return createInitiativeSession()

    const serialized = window.localStorage.getItem(this.storageKey)
    if (!serialized) return createInitiativeSession()

    try {
      return normalizeInitiativeSession(JSON.parse(serialized))
    } catch {
      return createInitiativeSession()
    }
  }

  async save(session: InitiativeSession): Promise<void> {
    if (typeof window === "undefined") return
    window.localStorage.setItem(this.storageKey, JSON.stringify(session))
  }

  async clear(): Promise<InitiativeSession> {
    const session = createInitiativeSession()

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(this.storageKey)
    }

    return session
  }
}

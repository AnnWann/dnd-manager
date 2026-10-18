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
const SHARED_KEY_PREFIX = "initiative:"

type SharedPayload = {
  version: 1
  session: InitiativeSession
}

type SharedSnapshot = {
  state: SharedPayload | null
  revision: number
}

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

/**
 * Initiative state stored separately from the campaign document, but under a
 * deterministic key derived from the current sync key. Only the master is
 * allowed to write; players always operate as read-only replicas.
 */
export class SharedInitiativeRepository implements InitiativeRepository {
  private revision = 0
  private readonly sharedKey: string

  constructor(
    syncKey: string,
    private readonly writable: boolean,
  ) {
    this.sharedKey = `${SHARED_KEY_PREFIX}${syncKey.trim()}`
  }

  async load(): Promise<InitiativeSession> {
    if (typeof window === "undefined" || this.sharedKey.length < 12) {
      return createInitiativeSession()
    }

    const snapshot = await this.getSnapshot()
    this.revision = snapshot.revision
    return snapshot.state?.session
      ? normalizeInitiativeSession(snapshot.state.session)
      : createInitiativeSession()
  }

  async save(session: InitiativeSession): Promise<void> {
    if (!this.writable || typeof window === "undefined") return

    const state: SharedPayload = {
      version: 1,
      session: normalizeInitiativeSession(session),
    }

    let expectedRevision = this.revision
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(
        `/api/state?key=${encodeURIComponent(this.sharedKey)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state,
            expectedRevision,
            clientId: "initiative-master",
          }),
        },
      )

      const data = (await response.json().catch(() => ({}))) as {
        revision?: number
        error?: string
      }

      if (response.status === 409) {
        expectedRevision = Math.max(0, Math.trunc(Number(data.revision) || 0))
        this.revision = expectedRevision
        continue
      }

      if (!response.ok) {
        throw new Error(data.error || `Falha ao salvar iniciativa (HTTP ${response.status}).`)
      }

      this.revision = Math.max(0, Math.trunc(Number(data.revision) || expectedRevision + 1))
      return
    }

    throw new Error("A iniciativa mudou durante o salvamento. Tente novamente.")
  }

  async clear(): Promise<InitiativeSession> {
    if (!this.writable) return this.load()
    const session = createInitiativeSession()
    await this.save(session)
    return session
  }

  private async getSnapshot(): Promise<SharedSnapshot> {
    const response = await fetch(
      `/api/state?key=${encodeURIComponent(this.sharedKey)}`,
      { cache: "no-store" },
    )

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(text || `Falha ao carregar iniciativa (HTTP ${response.status}).`)
    }

    const data = (await response.json()) as {
      state?: SharedPayload | null
      revision?: number
    }

    return {
      state:
        data.state && data.state.version === 1 && data.state.session
          ? data.state
          : null,
      revision: Math.max(0, Math.trunc(Number(data.revision) || 0)),
    }
  }
}

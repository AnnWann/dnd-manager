import {
  createCreatureCompendiumState,
  normalizeCreatureCompendiumState,
  type CreatureCompendiumState,
} from "../models/creatures/CompendiumCreature"

export interface CreatureCompendiumRepository {
  load(): Promise<CreatureCompendiumState>
  save(state: CreatureCompendiumState): Promise<void>
  clear(): Promise<CreatureCompendiumState>
}

const LOCAL_STORAGE_KEY = "dnd-manager:creature-compendium:v1"

export class LocalCreatureCompendiumRepository
  implements CreatureCompendiumRepository
{
  constructor(private readonly storageKey = LOCAL_STORAGE_KEY) {}

  async load(): Promise<CreatureCompendiumState> {
    if (typeof window === "undefined") return createCreatureCompendiumState()

    const serialized = window.localStorage.getItem(this.storageKey)
    if (!serialized) return createCreatureCompendiumState()

    try {
      return normalizeCreatureCompendiumState(JSON.parse(serialized))
    } catch {
      return createCreatureCompendiumState()
    }
  }

  async save(state: CreatureCompendiumState): Promise<void> {
    if (typeof window === "undefined") return
    window.localStorage.setItem(this.storageKey, JSON.stringify(state))
  }

  async clear(): Promise<CreatureCompendiumState> {
    const state = createCreatureCompendiumState()

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(this.storageKey)
    }

    return state
  }
}

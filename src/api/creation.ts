import { LOCAL_AUTH_BYPASS } from "../auth/local-auth"
import type {
  CreationSnapshot,
  CreationState,
} from "../shared/creation/creation.types"
import { apiClient } from "./api-client"

type CreationSnapshotRequest = {
  promise: Promise<CreationSnapshot>
}

const creationSnapshotCache = new Map<string, CreationSnapshot>()
const creationSnapshotRequests = new Map<string, CreationSnapshotRequest>()

export function primeCreationSnapshot(
  campaignId: string,
  snapshot: CreationSnapshot,
): void {
  creationSnapshotCache.set(campaignId, structuredClone(snapshot))
}

export function invalidateCreationSnapshot(campaignId: string): void {
  creationSnapshotCache.delete(campaignId)
  creationSnapshotRequests.delete(campaignId)
}

export async function getCreationSnapshot(
  campaignId: string,
  options: { force?: boolean } = {},
): Promise<CreationSnapshot> {
  if (LOCAL_AUTH_BYPASS) {
    return {
      revision: 1,
      updatedAt: new Date(0).toISOString(),
      data: {
        version: 1,
        characters: [],
        spells: [],
        itemCompendium: [],
        creatureCompendium: [],
        customSystems: [],
      },
    }
  }

  if (!options.force) {
    const cached = creationSnapshotCache.get(campaignId)
    if (cached) return structuredClone(cached)

    const pending = creationSnapshotRequests.get(campaignId)
    if (pending) return pending.promise.then((snapshot) => structuredClone(snapshot))
  }

  const promise = apiClient
    .get<CreationSnapshot>(
      `/campaigns/${encodeURIComponent(campaignId)}/creation`,
    )
    .then((response) => {
      primeCreationSnapshot(campaignId, response.data)
      return structuredClone(response.data)
    })
    .finally(() => {
      creationSnapshotRequests.delete(campaignId)
    })

  creationSnapshotRequests.set(campaignId, { promise })
  return promise
}

export async function saveCreationSnapshot(
  campaignId: string,
  baseRevision: number,
  data: CreationState,
): Promise<CreationSnapshot> {
  if (LOCAL_AUTH_BYPASS) {
    const snapshot = {
      revision: Math.max(1, baseRevision + 1),
      updatedAt: new Date().toISOString(),
      data: structuredClone(data),
    }
    primeCreationSnapshot(campaignId, snapshot)
    return snapshot
  }

  const response = await apiClient.patch<CreationSnapshot>(
    `/campaigns/${encodeURIComponent(campaignId)}/creation`,
    {
      baseRevision,
      data,
    },
  )

  primeCreationSnapshot(campaignId, response.data)
  return response.data
}

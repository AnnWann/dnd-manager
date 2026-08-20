import { LOCAL_AUTH_BYPASS } from "../auth/local-auth"
import type { CreationSnapshot } from "../shared/creation/creation.types"
import { apiClient } from "./api-client"

export async function getCreationSnapshot(
  campaignId: string,
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

  const response = await apiClient.get<CreationSnapshot>(
    `/campaigns/${encodeURIComponent(campaignId)}/creation`,
  )

  return response.data
}

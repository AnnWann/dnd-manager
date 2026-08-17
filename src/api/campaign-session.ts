import { LOCAL_AUTH_BYPASS } from "../auth/local-auth"
import { apiClient } from "./api-client"
import { getMyCampaigns, type CampaignCharacterVisibility, type CampaignRole } from "./user-campaigns"

export type CampaignSessionCharacter = {
  id: string
  name: string
  visibility: CampaignCharacterVisibility
  owner: {
    id: string
    name: string
  }
  addedAt?: string
}

export type CampaignSessionCharacters = {
  campaign: {
    id: string
    name: string
    role: CampaignRole
    isMaster: boolean
  }
  characters: CampaignSessionCharacter[]
}

type CachedSessionRequest = {
  expiresAt: number
  promise: Promise<CampaignSessionCharacters>
}

const SESSION_REQUEST_CACHE_MS = 5_000
const sessionRequestCache = new Map<string, CachedSessionRequest>()

export async function getCampaignSessionCharacters(
  campaignId: string,
): Promise<CampaignSessionCharacters> {
  if (LOCAL_AUTH_BYPASS) {
    const campaigns = await getMyCampaigns()
    const campaign = campaigns.find((entry) => entry.id === campaignId)
    if (!campaign) throw new Error("Campanha local não encontrada.")

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        role: campaign.role,
        isMaster: campaign.isOwner || campaign.role === "MASTER",
      },
      characters: campaign.characters.map((character) => ({
        ...character,
        owner: campaign.owner,
      })),
    }
  }

  const now = Date.now()
  const cached = sessionRequestCache.get(campaignId)
  if (cached && cached.expiresAt > now) return cached.promise

  const promise = apiClient
    .get<CampaignSessionCharacters>(
      `/campaigns/${encodeURIComponent(campaignId)}/characters`,
    )
    .then((response) => response.data)
    .catch((error) => {
      sessionRequestCache.delete(campaignId)
      throw error
    })

  sessionRequestCache.set(campaignId, {
    expiresAt: now + SESSION_REQUEST_CACHE_MS,
    promise,
  })

  return promise
}

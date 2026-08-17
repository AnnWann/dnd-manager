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

  const response = await apiClient.get<CampaignSessionCharacters>(
    `/campaigns/${encodeURIComponent(campaignId)}/characters`,
  )
  return response.data
}

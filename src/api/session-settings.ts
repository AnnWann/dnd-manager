import { getMyCampaigns } from "./user-campaigns"
import { apiClient } from "./api-client"
import { LOCAL_AUTH_BYPASS } from "../auth/local-auth"

export type SessionSettingsMember = {
  id: string
  name: string
  email?: string | null
  role: "MASTER" | "PLAYER"
  status: "ACTIVE" | "INVITED" | "REMOVED"
}

export type SessionCreationSettings = {
  campaign: {
    id: string
    name: string
    inviteCode?: string
  }
  owner: SessionSettingsMember
  members: SessionSettingsMember[]
}

type SettingsResponse = {
  settings: SessionCreationSettings
}

export async function getSessionCreationSettings(
  campaignId: string,
): Promise<SessionCreationSettings> {
  if (LOCAL_AUTH_BYPASS) {
    const campaign = (await getMyCampaigns()).find((entry) => entry.id === campaignId)
    if (!campaign || !campaign.isOwner) {
      throw new Error("Somente o mestre pode acessar as configurações da sessão.")
    }

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        inviteCode: campaign.inviteCode,
      },
      owner: {
        id: campaign.owner.id,
        name: campaign.owner.name,
        role: "MASTER",
        status: "ACTIVE",
      },
      members: campaign.pendingMembers.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: "PLAYER",
        status: "INVITED",
      })),
    }
  }

  const response = await apiClient.get<SettingsResponse>(
    `/campaigns/${encodeURIComponent(campaignId)}/settings`,
  )
  return response.data.settings
}

export async function updateSessionMember(
  campaignId: string,
  userId: string,
  input: {
    status: "ACTIVE" | "REMOVED"
    role?: "MASTER" | "PLAYER"
  },
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    // Local auth only models pending membership requests. Keeping this a no-op
    // for role changes avoids fabricating relational users that do not exist.
    return
  }

  await apiClient.patch(
    `/me/campaigns/${encodeURIComponent(campaignId)}/members/${encodeURIComponent(userId)}`,
    input,
  )
}

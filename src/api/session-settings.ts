import { LOCAL_AUTH_BYPASS } from "../auth/local-auth"
import { apiClient } from "./api-client"
import { getMyCampaigns, reviewCampaignMember } from "./user-campaigns"

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

const settingsCache = new Map<string, SessionCreationSettings>()
const settingsRequests = new Map<string, Promise<SessionCreationSettings>>()

export function primeSessionCreationSettings(
  campaignId: string,
  settings: SessionCreationSettings,
): void {
  settingsCache.set(campaignId, structuredClone(settings))
}

export function invalidateSessionCreationSettings(campaignId: string): void {
  settingsCache.delete(campaignId)
  settingsRequests.delete(campaignId)
}

export async function getSessionCreationSettings(
  campaignId: string,
  options: { force?: boolean } = {},
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

  if (!options.force) {
    const cached = settingsCache.get(campaignId)
    if (cached) return structuredClone(cached)
    const pending = settingsRequests.get(campaignId)
    if (pending) return pending.then(structuredClone)
  }

  const request = apiClient
    .get<SettingsResponse>(
      `/campaigns/${encodeURIComponent(campaignId)}/settings`,
    )
    .then((response) => {
      primeSessionCreationSettings(campaignId, response.data.settings)
      return structuredClone(response.data.settings)
    })
    .finally(() => {
      settingsRequests.delete(campaignId)
    })

  settingsRequests.set(campaignId, request)
  return request
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
    await reviewCampaignMember(campaignId, userId, input.status)
    invalidateSessionCreationSettings(campaignId)
    return
  }

  await apiClient.patch(
    `/me/campaigns/${encodeURIComponent(campaignId)}/members/${encodeURIComponent(userId)}`,
    input,
  )
  invalidateSessionCreationSettings(campaignId)
}

import { LOCAL_AUTH_BYPASS } from "../auth/local-auth"
import {
  notifySessionContentChanged,
  notifySessionMemberKick,
} from "../lib/sessionEvents"
import type {
  CampaignCapability,
  CampaignCapabilityOverrides,
} from "../shared/campaign/campaignRoles"
import { apiClient } from "./api-client"
import {
  getMyCampaigns,
  reviewCampaignMember,
  type CampaignRole,
  type UserCampaign,
} from "./user-campaigns"

export type SessionSettingsMember = {
  id: string
  name: string
  email?: string | null
  role: CampaignRole
  status: "ACTIVE" | "INVITED" | "REMOVED"
  permissions: CampaignCapabilityOverrides
  capabilities: CampaignCapability[]
}

export type SessionCreationSettings = {
  campaign: {
    id: string
    name: string
    inviteCode?: string | null
  }
  owner: SessionSettingsMember
  members: SessionSettingsMember[]
  viewerCapabilities: CampaignCapability[]
  canManageMembers: boolean
}

type SettingsResponse = {
  settings: SessionCreationSettings
}

const LOCAL_CAMPAIGNS_KEY = "dnd-manager.local-campaigns.v2"
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
        permissions: {},
        capabilities: [],
      },
      members: campaign.pendingMembers.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: "PLAYER",
        status: "INVITED",
        permissions: {},
        capabilities: [],
      })),
      viewerCapabilities: [],
      canManageMembers: true,
    }
  }

  if (!options.force) {
    const cached = settingsCache.get(campaignId)
    if (cached) return structuredClone(cached)
    const pending = settingsRequests.get(campaignId)
    if (pending) return pending.then((settings) => structuredClone(settings))
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

export async function updateSessionName(
  campaignId: string,
  name: string,
): Promise<string> {
  const normalizedName = name.trim()
  if (!normalizedName) throw new Error("Informe um nome para a sessão.")
  if (normalizedName.length > 120) {
    throw new Error("O nome da sessão deve ter no máximo 120 caracteres.")
  }

  if (LOCAL_AUTH_BYPASS) {
    const campaigns = await getMyCampaigns()
    const campaign = campaigns.find((entry) => entry.id === campaignId)
    if (!campaign?.isOwner) {
      throw new Error("Somente o mestre principal pode alterar o nome da sessão.")
    }

    const next = campaigns.map((entry) =>
      entry.id === campaignId
        ? { ...entry, name: normalizedName, updatedAt: new Date().toISOString() }
        : entry,
    )
    window.localStorage.setItem(
      LOCAL_CAMPAIGNS_KEY,
      JSON.stringify(next satisfies UserCampaign[]),
    )
    invalidateSessionCreationSettings(campaignId)
    notifySessionContentChanged()
    return normalizedName
  }

  const response = await apiClient.patch<{
    campaign: { id: string; name: string }
  }>(
    `/me/campaigns/${encodeURIComponent(campaignId)}`,
    { name: normalizedName },
  )
  invalidateSessionCreationSettings(campaignId)
  notifySessionContentChanged()
  return response.data.campaign.name
}

export async function updateSessionMember(
  campaignId: string,
  userId: string,
  input: {
    status: "ACTIVE" | "REMOVED"
    role?: CampaignRole
    permissions?: CampaignCapabilityOverrides
  },
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    await reviewCampaignMember(campaignId, userId, input.status)
    invalidateSessionCreationSettings(campaignId)
    if (input.status === "REMOVED") {
      notifySessionMemberKick(campaignId, userId)
      notifySessionContentChanged()
    }
    return
  }

  await apiClient.patch(
    `/me/campaigns/${encodeURIComponent(campaignId)}/members/${encodeURIComponent(userId)}`,
    input,
  )
  invalidateSessionCreationSettings(campaignId)
  if (input.status === "REMOVED") {
    // The database membership is authoritative for future connections. Signal
    // the already-connected MASTER runtime as well so existing sockets are
    // closed and the member's active session characters are inactivated now.
    notifySessionMemberKick(campaignId, userId)
    notifySessionContentChanged()
  }
}

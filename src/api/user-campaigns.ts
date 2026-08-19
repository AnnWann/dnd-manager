import {
  getLocalCharacters,
  getLocalUser,
  LOCAL_AUTH_BYPASS,
  setLocalCharacters,
} from "../auth/local-auth"
import { apiClient } from "./api-client"

export type CampaignRole = "MASTER" | "PLAYER"
export type CampaignMemberStatus = "ACTIVE" | "INVITED" | "REMOVED"
export type CampaignCharacterVisibility = "PRIVATE" | "PARTY" | "MASTER"
export type CampaignSpellStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REVOKED"

export type UserCampaign = {
  id: string
  name: string
  description?: string | null
  inviteCode?: string
  owner: {
    id: string
    name: string
  }
  isOwner: boolean
  role: CampaignRole
  status: CampaignMemberStatus
  characters: Array<{
    id: string
    name: string
    visibility: CampaignCharacterVisibility
  }>
  pendingMembers: Array<{
    id: string
    name: string
    email?: string
  }>
  homebrew: {
    approved: number
    pending: number
    rejected: number
    revoked: number
  }
  homebrewSpells: Array<{
    linkId: string
    id: string
    index: string
    name: string
    status: CampaignSpellStatus
    note?: string | null
    author: {
      id: string
      name: string
    }
    submittedByCurrentUser: boolean
    submittedAt: string
    reviewedAt?: string | null
  }>
  createdAt: string
  updatedAt: string
}

type CampaignsResponse = {
  campaigns: UserCampaign[]
}

type CampaignResponse = {
  campaign: UserCampaign
}

const LOCAL_CAMPAIGNS_KEY = "dnd-manager.local-campaigns.v2"
let campaignsRequest: Promise<UserCampaign[]> | null = null

export async function getMyCampaigns(): Promise<UserCampaign[]> {
  if (LOCAL_AUTH_BYPASS) return readLocalCampaigns()
  if (campaignsRequest) return campaignsRequest

  const request = apiClient
    .get<CampaignsResponse>("/me/campaigns")
    .then((response) => response.data.campaigns ?? [])

  campaignsRequest = request
  try {
    return await request
  } finally {
    if (campaignsRequest === request) campaignsRequest = null
  }
}

export async function createMyCampaign(input: {
  name: string
  description?: string
}): Promise<UserCampaign> {
  if (LOCAL_AUTH_BYPASS) {
    const user = getLocalUser()
    const now = new Date().toISOString()
    const campaign: UserCampaign = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      inviteCode: createInviteCode(),
      owner: {
        id: user?.id ?? "local-development-user",
        name: user?.name ?? "Usuário local",
      },
      isOwner: true,
      role: "MASTER",
      status: "ACTIVE",
      characters: [],
      pendingMembers: [],
      homebrew: {
        approved: 0,
        pending: 0,
        rejected: 0,
        revoked: 0,
      },
      homebrewSpells: [],
      createdAt: now,
      updatedAt: now,
    }

    writeLocalCampaigns([campaign, ...readLocalCampaigns()])
    return campaign
  }

  const response = await apiClient.post<CampaignResponse>(
    "/me/campaigns",
    input,
  )

  return response.data.campaign
}

export async function requestCampaignJoin(inviteCode: string): Promise<UserCampaign> {
  if (LOCAL_AUTH_BYPASS) {
    const campaign = readLocalCampaigns().find(
      (entry) => entry.inviteCode === inviteCode.trim().toUpperCase(),
    )
    if (!campaign) throw new Error("Campanha não encontrada.")
    return campaign
  }

  const response = await apiClient.post<CampaignResponse>("/me/campaigns/join", {
    inviteCode,
  })
  return response.data.campaign
}

export async function leaveCampaign(campaignId: string): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    writeLocalCampaigns(readLocalCampaigns().filter((campaign) => campaign.id !== campaignId))
    return
  }

  await apiClient.delete(`/me/campaigns/${encodeURIComponent(campaignId)}/membership`)
}

export async function linkCharacterToCampaign(
  campaignId: string,
  characterId: string,
  visibility: CampaignCharacterVisibility,
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    const character = getLocalCharacters().find((entry) => entry.id === characterId)
    if (!character) throw new Error("Personagem não encontrado.")
    writeLocalCampaigns(
      readLocalCampaigns().map((campaign) =>
        campaign.id === campaignId
          ? {
              ...campaign,
              characters: [
                ...campaign.characters.filter((entry) => entry.id !== characterId),
                { id: characterId, name: character.name, visibility },
              ],
            }
          : campaign,
      ),
    )
    return
  }

  await apiClient.post(`/me/campaigns/${encodeURIComponent(campaignId)}/characters`, {
    characterId,
    visibility,
  })
}

export async function unlinkCharacterFromCampaign(
  campaignId: string,
  characterId: string,
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    writeLocalCampaigns(
      readLocalCampaigns().map((campaign) =>
        campaign.id === campaignId
          ? {
              ...campaign,
              characters: campaign.characters.filter((entry) => entry.id !== characterId),
            }
          : campaign,
      ),
    )
    return
  }

  await apiClient.delete(
    `/me/campaigns/${encodeURIComponent(campaignId)}/characters/${encodeURIComponent(characterId)}`,
  )
}

export async function updateCharacterCampaignVisibility(
  campaignId: string,
  characterId: string,
  visibility: CampaignCharacterVisibility,
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    writeLocalCampaigns(
      readLocalCampaigns().map((campaign) =>
        campaign.id === campaignId
          ? {
              ...campaign,
              characters: campaign.characters.map((entry) =>
                entry.id === characterId ? { ...entry, visibility } : entry,
              ),
            }
          : campaign,
      ),
    )
    return
  }

  await apiClient.patch(
    `/me/campaigns/${encodeURIComponent(campaignId)}/characters/${encodeURIComponent(characterId)}`,
    { visibility },
  )
}

export async function reviewCampaignMember(
  campaignId: string,
  userId: string,
  status: "ACTIVE" | "REMOVED",
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) return

  await apiClient.patch(
    `/me/campaigns/${encodeURIComponent(campaignId)}/members/${encodeURIComponent(userId)}`,
    { status },
  )
}

export async function reviewCampaignSpell(
  campaignId: string,
  spellId: string,
  status: Exclude<CampaignSpellStatus, "PENDING">,
  note?: string,
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) return

  await apiClient.patch(
    `/me/campaigns/${encodeURIComponent(campaignId)}/spells/${encodeURIComponent(spellId)}`,
    { status, note },
  )
}

function readLocalCampaigns(): UserCampaign[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_CAMPAIGNS_KEY) ?? "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalCampaigns(campaigns: UserCampaign[]): void {
  localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(campaigns))
}

function createInviteCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
}

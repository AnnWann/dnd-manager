import {
  getLocalCharacters,
  getLocalUser,
  LOCAL_AUTH_BYPASS,
  setLocalCharacters,
} from "../auth/local-auth"
import { apiClient } from "./api-client"

export type CampaignRole = "MASTER" | "ASSISTANT" | "MODERATOR" | "PLAYER"
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

export async function requestCampaignJoin(inviteCode: string): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    const normalized = inviteCode.trim().toUpperCase()
    const campaigns = readLocalCampaigns()
    if (!campaigns.some((campaign) => campaign.inviteCode === normalized)) {
      throw new Error("Nenhuma campanha local foi encontrada com esse código.")
    }
    return
  }

  await apiClient.post("/me/campaigns/join", { inviteCode })
}

export async function linkCharacterToCampaign(
  campaignId: string,
  characterId: string,
  visibility: CampaignCharacterVisibility = "PARTY",
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    const character = getLocalCharacters().find(
      (entry) => entry.id === characterId,
    )
    if (!character) throw new Error("Personagem local não encontrado.")

    const campaigns = readLocalCampaigns().map((campaign) =>
      campaign.id === campaignId
        ? {
            ...campaign,
            characters: campaign.characters.some(
              (entry) => entry.id === characterId,
            )
              ? campaign.characters.map((entry) =>
                  entry.id === characterId
                    ? { ...entry, visibility }
                    : entry,
                )
              : [
                  ...campaign.characters,
                  {
                    id: character.id,
                    name: character.name,
                    visibility,
                  },
                ],
            updatedAt: new Date().toISOString(),
          }
        : campaign,
    )
    writeLocalCampaigns(campaigns)
    syncLocalCharacterCampaigns(campaigns)
    return
  }

  await apiClient.post(
    `/me/campaigns/${encodeURIComponent(campaignId)}/characters/${encodeURIComponent(characterId)}`,
    { visibility },
  )
}

export async function updateCharacterCampaignVisibility(
  campaignId: string,
  characterId: string,
  visibility: CampaignCharacterVisibility,
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    await linkCharacterToCampaign(campaignId, characterId, visibility)
    return
  }

  await apiClient.patch(
    `/me/campaigns/${encodeURIComponent(campaignId)}/characters/${encodeURIComponent(characterId)}`,
    { visibility },
  )
}

export async function unlinkCharacterFromCampaign(
  campaignId: string,
  characterId: string,
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    const campaigns = readLocalCampaigns().map((campaign) =>
      campaign.id === campaignId
        ? {
            ...campaign,
            characters: campaign.characters.filter(
              (entry) => entry.id !== characterId,
            ),
            updatedAt: new Date().toISOString(),
          }
        : campaign,
    )
    writeLocalCampaigns(campaigns)
    syncLocalCharacterCampaigns(campaigns)
    return
  }

  await apiClient.delete(
    `/me/campaigns/${encodeURIComponent(campaignId)}/characters/${encodeURIComponent(characterId)}`,
  )
}

export async function leaveCampaign(campaignId: string): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    const campaigns = readLocalCampaigns().filter(
      (campaign) => campaign.id !== campaignId || campaign.isOwner,
    )
    writeLocalCampaigns(campaigns)
    syncLocalCharacterCampaigns(campaigns)
    return
  }

  await apiClient.delete(
    `/me/campaigns/${encodeURIComponent(campaignId)}/membership`,
  )
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    const campaigns = readLocalCampaigns().filter(
      (campaign) => campaign.id !== campaignId,
    )
    writeLocalCampaigns(campaigns)
    syncLocalCharacterCampaigns(campaigns)
    return
  }

  await apiClient.delete(
    `/me/campaigns/${encodeURIComponent(campaignId)}`,
  )
}

export async function reviewCampaignMember(
  campaignId: string,
  userId: string,
  status: "ACTIVE" | "REMOVED",
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    const campaigns = readLocalCampaigns().map((campaign) =>
      campaign.id === campaignId
        ? {
            ...campaign,
            pendingMembers: campaign.pendingMembers.filter(
              (member) => member.id !== userId,
            ),
          }
        : campaign,
    )
    writeLocalCampaigns(campaigns)
    return
  }

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
  if (LOCAL_AUTH_BYPASS) {
    const campaigns = readLocalCampaigns().map((campaign) => {
      if (campaign.id !== campaignId) return campaign

      const homebrewSpells = campaign.homebrewSpells.map((spell) =>
        spell.id === spellId
          ? {
              ...spell,
              status,
              note: note?.trim() || null,
              reviewedAt: new Date().toISOString(),
            }
          : spell,
      )

      return {
        ...campaign,
        homebrewSpells,
        homebrew: countSpellStatuses(homebrewSpells),
      }
    })
    writeLocalCampaigns(campaigns)
    return
  }

  await apiClient.patch(
    `/campaigns/${encodeURIComponent(campaignId)}/spells/${encodeURIComponent(spellId)}`,
    { status, note },
  )
}

function readLocalCampaigns(): UserCampaign[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(LOCAL_CAMPAIGNS_KEY) ?? "[]",
    ) as unknown

    if (!Array.isArray(parsed)) return []

    return (parsed as UserCampaign[]).map((campaign) => ({
      ...campaign,
      characters: (campaign.characters ?? []).map((character) => ({
        ...character,
        visibility: character.visibility ?? "PARTY",
      })),
      pendingMembers: campaign.pendingMembers ?? [],
      homebrew: campaign.homebrew ?? {
        approved: 0,
        pending: 0,
        rejected: 0,
        revoked: 0,
      },
      homebrewSpells: campaign.homebrewSpells ?? [],
    }))
  } catch {
    return []
  }
}

function writeLocalCampaigns(campaigns: UserCampaign[]): void {
  window.localStorage.setItem(
    LOCAL_CAMPAIGNS_KEY,
    JSON.stringify(campaigns),
  )
}

function syncLocalCharacterCampaigns(campaigns: UserCampaign[]): void {
  const linksByCharacter = new Map<string, Array<{ id: string; name: string }>>()

  for (const campaign of campaigns) {
    for (const character of campaign.characters) {
      const links = linksByCharacter.get(character.id) ?? []
      links.push({ id: campaign.id, name: campaign.name })
      linksByCharacter.set(character.id, links)
    }
  }

  setLocalCharacters(
    getLocalCharacters().map((character) => ({
      ...character,
      campaigns: linksByCharacter.get(character.id) ?? [],
    })),
  )
}

function countSpellStatuses(
  spells: UserCampaign["homebrewSpells"],
): UserCampaign["homebrew"] {
  return {
    approved: spells.filter((spell) => spell.status === "APPROVED").length,
    pending: spells.filter((spell) => spell.status === "PENDING").length,
    rejected: spells.filter((spell) => spell.status === "REJECTED").length,
    revoked: spells.filter((spell) => spell.status === "REVOKED").length,
  }
}

function createInviteCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()
}

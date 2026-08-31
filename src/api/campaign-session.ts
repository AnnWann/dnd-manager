import {
  getLocalCharacters,
  LOCAL_AUTH_BYPASS,
} from "../auth/local-auth"
import { applyCharacterDomains } from "../lib/characterDomains"
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../models/characters/CharacterTemplate"
import { preloadSessionRouteModules } from "../sessionRoutePreload"
import { apiClient } from "./api-client"
import {
  getMyCampaigns,
  type CampaignCharacterVisibility,
  type CampaignRole,
} from "./user-campaigns"
import type { UserCharacterDomain } from "./user-characters"

export type CampaignSessionMember = {
  id: string
  name: string
  role: CampaignRole
}

export type CampaignSessionCharacter = {
  id: string
  name: string
  data: Record<string, unknown>
  revision?: number
  domains?: UserCharacterDomain[]
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
  members: CampaignSessionMember[]
  characters: CampaignSessionCharacter[]
}

type CachedSessionRequest = {
  campaignId: string
  viewerId: string
  expiresAt: number
  promise: Promise<CampaignSessionCharacters>
}

// This cache is intentionally longer than a normal request-dedupe window.
// The response is permission-dependent (role, membership and visible
// characters), so entries MUST be partitioned by the authenticated viewer.
// Explicit session entry forces a revalidation because the viewer's campaign
// role can change without either the viewer id or campaign id changing.
const SESSION_REQUEST_CACHE_MS = 10 * 60_000
const sessionRequestCache = new Map<string, CachedSessionRequest>()

export function invalidateCampaignSessionCharacters(campaignId: string): void {
  for (const [key, entry] of sessionRequestCache) {
    if (entry.campaignId === campaignId) sessionRequestCache.delete(key)
  }
}

export async function getCampaignSessionCharacters(
  campaignId: string,
  viewerId: string,
  options: { force?: boolean } = {},
): Promise<CampaignSessionCharacters> {
  if (LOCAL_AUTH_BYPASS) {
    const campaigns = await getMyCampaigns()
    const campaign = campaigns.find((entry) => entry.id === campaignId)
    if (!campaign) throw new Error("Campanha local não encontrada.")

    const localCharacters = new Map(
      getLocalCharacters().map((character) => [character.id, character]),
    )

    const data: CampaignSessionCharacters = {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        role: campaign.role,
        isMaster: campaign.isOwner || campaign.role === "MASTER",
      },
      members: [
        {
          id: campaign.owner.id,
          name: campaign.owner.name,
          role: "MASTER",
        },
      ],
      characters: campaign.characters.flatMap((character) => {
        const source = localCharacters.get(character.id)
        if (!source) return []

        return [{
          id: character.id,
          name: source.name || character.name,
          data: source.data,
          visibility: character.visibility,
          owner: campaign.owner,
          addedAt: source.updatedAt,
          domains: (source as typeof source & { domains?: UserCharacterDomain[] }).domains,
        }]
      }),
    }

    await preloadSessionRouteModules(data.campaign.isMaster)
    return data
  }

  const normalizedViewerId = viewerId.trim()
  if (!normalizedViewerId) {
    throw new Error("Usuário autenticado não disponível para carregar a sessão.")
  }

  const now = Date.now()
  const cacheKey = `${normalizedViewerId}:${campaignId}`
  const cached = sessionRequestCache.get(cacheKey)
  if (!options.force && cached && cached.expiresAt > now) return cached.promise

  const promise = apiClient
    .get<CampaignSessionCharacters>(
      `/campaigns/${encodeURIComponent(campaignId)}/characters`,
    )
    .then(async (response) => {
      const data = response.data
      await preloadSessionRouteModules(data.campaign.isMaster)
      return data
    })
    .catch((error) => {
      if (sessionRequestCache.get(cacheKey)?.promise === promise) {
        sessionRequestCache.delete(cacheKey)
      }
      throw error
    })

  sessionRequestCache.set(cacheKey, {
    campaignId,
    viewerId: normalizedViewerId,
    expiresAt: now + SESSION_REQUEST_CACHE_MS,
    promise,
  })

  return promise
}

/**
 * Materializes the user/campaign character records into independent mutable
 * session copies. They are bootstrap seeds only. Once the session socket has
 * character snapshots, CharacterProvider projects from those authoritative
 * snapshots instead of from this relational copy.
 */
export function buildSessionCharacterSnapshots(
  data: CampaignSessionCharacters,
): CharacterTemplateProps[] {
  return data.characters.map((character) => {
    const visibility = character.visibility.toLowerCase() as
      | "private"
      | "party"
      | "master"

    const legacyBase = CharacterTemplate.fromJSON({
      ...(character.data as Partial<CharacterTemplateProps>),
      id: character.id,
      name: character.name,
      visibility,
      owner: {
        id: character.owner.id,
        name: character.owner.name,
        role: "player",
      },
    }).toJSON()

    return CharacterTemplate.fromJSON(
      applyCharacterDomains(legacyBase, character.domains ?? []),
    ).toJSON()
  })
}

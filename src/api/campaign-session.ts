import {
  getLocalCharacters,
  LOCAL_AUTH_BYPASS,
} from "../auth/local-auth"
import { applyCharacterDomains } from "../lib/characterDomains"
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../models/characters/CharacterTemplate"
import { apiClient } from "./api-client"
import {
  getMyCampaigns,
  type CampaignCharacterVisibility,
  type CampaignRole,
} from "./user-campaigns"
import type { UserCharacterDomain } from "./user-characters"

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

    const localCharacters = new Map(
      getLocalCharacters().map((character) => [character.id, character]),
    )

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        role: campaign.role,
        isMaster: campaign.isOwner || campaign.role === "MASTER",
      },
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

/**
 * Materializes the user/campaign character records into independent mutable
 * session copies. The returned objects are never persisted back through the
 * /me/characters APIs.
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

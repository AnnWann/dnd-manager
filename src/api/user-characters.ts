import {
  getLocalCharacters,
  LOCAL_AUTH_BYPASS,
  setLocalCharacters,
} from "../auth/local-auth"
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../models/characters/CharacterTemplate"
import type { CharacterDataDomain } from "../models/characters/characterDataDomains"
import {
  applyCharacterDomains,
  buildCharacterDomainPayloads,
} from "../models/characters/characterDataDomains"
import { apiClient } from "./api-client"

export type UserCharacterVisibility = "PRIVATE" | "PARTY" | "MASTER"

export type UserCharacterDomain = {
  domain: CharacterDataDomain
  data: unknown
  revision: number
  updatedAt?: string
}

export type UserCharacterSummary = {
  id: string
  name: string
  visibility: UserCharacterVisibility
  revision: number
  data: Record<string, unknown>
  domains?: UserCharacterDomain[]
  campaigns: Array<{
    id: string
    name: string
  }>
  createdAt: string
  updatedAt: string
}

type CharactersResponse = {
  characters: UserCharacterSummary[]
}

type CharacterResponse = {
  character: UserCharacterSummary
}

type DomainResponse = {
  domain: UserCharacterDomain
}

type DomainMutationResponse = DomainResponse & {
  mutation: {
    id: string
    previousRevision: number
    revision: number
    operation: string
    mutationId?: string | null
    clientId?: string | null
    createdAt: string
  }
}

export async function getMyCharacters(): Promise<UserCharacterSummary[]> {
  if (LOCAL_AUTH_BYPASS) {
    return getLocalCharacters().map((entry, index) => ({
      id: entry.id,
      name: entry.name,
      visibility: entry.visibility,
      revision: entry.revision ?? 1,
      data: entry.data,
      domains: entry.domains ?? [],
      campaigns: entry.campaigns ?? [],
      createdAt: entry.createdAt ?? new Date(index).toISOString(),
      updatedAt: entry.updatedAt ?? new Date(index).toISOString(),
    }))
  }

  const response = await apiClient.get<CharactersResponse>("/me/characters")
  return (response.data.characters ?? []).map(hydrateCharacterSummary)
}

export async function createMyCharacter(input: {
  name: string
  visibility?: UserCharacterVisibility
  data?: Record<string, unknown>
  character?: CharacterTemplate
}): Promise<UserCharacterSummary> {
  const character = input.character
  const data = character
    ? (character.toJSON() as unknown as Record<string, unknown>)
    : input.data ?? {}
  const domains = character ? buildCharacterDomainPayloads(character) : undefined

  if (LOCAL_AUTH_BYPASS) {
    const now = new Date().toISOString()
    const id = character?.get("id") ?? crypto.randomUUID()
    const summary: UserCharacterSummary = {
      id,
      name: input.name.trim() || character?.get("name") || "Personagem",
      visibility: input.visibility ?? "PRIVATE",
      revision: 1,
      data: {
        ...data,
        id,
      },
      domains: domains?.map((entry) => ({
        domain: entry.domain,
        data: entry.data,
        revision: 1,
        updatedAt: now,
      })),
      campaigns: [],
      createdAt: now,
      updatedAt: now,
    }
    setLocalCharacters([summary, ...getLocalCharacters()])
    return summary
  }

  const response = await apiClient.post<CharacterResponse>("/me/characters", {
    name: input.name,
    visibility: input.visibility,
    data,
    domains,
  })
  return hydrateCharacterSummary(response.data.character)
}

export async function getMyCharacter(
  characterId: string,
): Promise<UserCharacterSummary> {
  if (LOCAL_AUTH_BYPASS) {
    const character = getLocalCharacters().find((entry) => entry.id === characterId)
    if (!character) throw new Error("Personagem local não encontrado.")
    return character
  }

  const response = await apiClient.get<CharacterResponse>(
    `/me/characters/${encodeURIComponent(characterId)}`,
  )
  return hydrateCharacterSummary(response.data.character)
}

export async function updateMyCharacter(
  characterId: string,
  input: {
    name?: string
    visibility?: UserCharacterVisibility
    data?: Record<string, unknown>
    character?: CharacterTemplate
  },
): Promise<UserCharacterSummary> {
  const character = input.character
  const data = character
    ? (character.toJSON() as unknown as Record<string, unknown>)
    : input.data
  const domains = character ? buildCharacterDomainPayloads(character) : undefined

  if (LOCAL_AUTH_BYPASS) {
    const now = new Date().toISOString()
    let updated: UserCharacterSummary | undefined
    const characters = getLocalCharacters().map((entry) => {
      if (entry.id !== characterId) return entry

      const nextDomains = domains
        ? domains.map((domain) => {
            const previous = entry.domains?.find(
              (candidate) => candidate.domain === domain.domain,
            )
            return {
              domain: domain.domain,
              data: domain.data,
              revision: (previous?.revision ?? 0) + 1,
              updatedAt: now,
            }
          })
        : entry.domains

      updated = {
        ...entry,
        name: input.name ?? character?.get("name") ?? entry.name,
        visibility: input.visibility ?? entry.visibility,
        data: data ?? entry.data,
        domains: nextDomains,
        revision: (entry.revision ?? 1) + 1,
        updatedAt: now,
      }
      return updated
    })
    if (!updated) throw new Error("Personagem local não encontrado.")
    setLocalCharacters(characters)
    return updated
  }

  const response = await apiClient.patch<CharacterResponse>(
    `/me/characters/${encodeURIComponent(characterId)}`,
    {
      name: input.name ?? character?.get("name"),
      visibility: input.visibility,
      data,
      domains,
    },
  )
  return hydrateCharacterSummary(response.data.character)
}

export async function updateMyCharacterDomain(
  characterId: string,
  domain: CharacterDataDomain,
  data: unknown,
  expectedRevision?: number,
): Promise<UserCharacterDomain> {
  if (LOCAL_AUTH_BYPASS) {
    const now = new Date().toISOString()
    let updatedDomain: UserCharacterDomain | undefined
    const characters = getLocalCharacters().map((entry) => {
      if (entry.id !== characterId) return entry

      const current = entry.domains?.find((candidate) => candidate.domain === domain)
      const revision = (current?.revision ?? 0) + 1
      updatedDomain = { domain, data, revision, updatedAt: now }
      const domains = [
        ...(entry.domains ?? []).filter((candidate) => candidate.domain !== domain),
        updatedDomain,
      ]

      return {
        ...entry,
        domains,
        updatedAt: now,
      }
    })
    if (!updatedDomain) throw new Error("Personagem local não encontrado.")
    setLocalCharacters(characters)
    return updatedDomain
  }

  const response = await apiClient.put<DomainResponse>(
    `/me/characters/${encodeURIComponent(characterId)}/domains/${encodeURIComponent(domain)}`,
    { data, expectedRevision },
  )
  return response.data.domain
}

export async function mutateMyCharacterDomain(
  characterId: string,
  domain: CharacterDataDomain,
  input: {
    operation: string
    data: unknown
    expectedRevision?: number
    mutationId?: string
    clientId?: string
  },
): Promise<DomainMutationResponse> {
  if (LOCAL_AUTH_BYPASS) {
    const previous = getLocalCharacters()
      .find((entry) => entry.id === characterId)
      ?.domains?.find((entry) => entry.domain === domain)
    const updated = await updateMyCharacterDomain(
      characterId,
      domain,
      input.data,
      input.expectedRevision,
    )
    return {
      domain: updated,
      mutation: {
        id: crypto.randomUUID(),
        previousRevision: previous?.revision ?? 0,
        revision: updated.revision,
        operation: input.operation,
        mutationId: input.mutationId,
        clientId: input.clientId,
        createdAt: new Date().toISOString(),
      },
    }
  }

  try {
    const response = await apiClient.post<DomainMutationResponse>(
      `/me/characters/${encodeURIComponent(characterId)}/domains/${encodeURIComponent(domain)}/mutations`,
      input,
    )
    return response.data
  } catch (error) {
    if (isDomainConflictResponse(error) && error.response?.data.current) {
      return {
        domain: error.response.data.current,
        mutation: {
          id: "conflict",
          previousRevision: input.expectedRevision ?? 0,
          revision: error.response.data.current.revision,
          operation: input.operation,
          mutationId: input.mutationId,
          clientId: input.clientId,
          createdAt: new Date().toISOString(),
        },
      }
    }
    throw error
  }
}

export async function deleteMyCharacter(characterId: string): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    setLocalCharacters(
      getLocalCharacters().filter((entry) => entry.id !== characterId),
    )
    return
  }

  await apiClient.delete(`/me/characters/${encodeURIComponent(characterId)}`)
}

export function characterTemplateFromSummary(
  character: UserCharacterSummary,
): CharacterTemplate {
  const hydrated = hydrateCharacterSummary(character)
  return CharacterTemplate.fromJSON({
    ...(hydrated.data as unknown as CharacterTemplateProps),
    id: hydrated.id,
    name: hydrated.name,
    visibility: hydrated.visibility.toLowerCase() as CharacterTemplateProps["visibility"],
  })
}

function hydrateCharacterSummary(
  character: UserCharacterSummary,
): UserCharacterSummary {
  if (!character.domains?.length) return character

  const base = {
    ...(character.data as Record<string, unknown>),
    id: character.id,
    name: character.name,
    visibility: character.visibility.toLowerCase(),
  } as unknown as CharacterTemplateProps

  return {
    ...character,
    data: applyCharacterDomains(base, character.domains) as unknown as Record<
      string,
      unknown
    >,
  }
}

function isDomainConflictResponse(
  error: unknown,
): error is {
  response?: {
    data: {
      current?: UserCharacterDomain | null
    }
  }
} {
  return error !== null && typeof error === "object" && "response" in error
}

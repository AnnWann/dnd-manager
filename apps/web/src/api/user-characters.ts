import {
  getLocalCharacters,
  LOCAL_AUTH_BYPASS,
  setLocalCharacters,
  type LocalCharacter,
} from "../auth/local-auth"
import { applyCharacterDomains } from "../lib/characterDomains"
import type { CharacterDomainName } from "../lib/relationalApi"
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../models/characters/CharacterTemplate"
import { apiClient, getApiStatus } from "./api-client"

export type CharacterVisibility = "PRIVATE" | "PARTY" | "MASTER"
export type UserCharacterVisibility = CharacterVisibility

export type UserCharacterDomain = {
  domain: CharacterDomainName
  payload: Record<string, unknown>
  version: number
  updatedBy?: string | null
  updatedAt?: string | null
}

export type UserCharacterSummary = LocalCharacter & {
  visibility: CharacterVisibility
  revision?: number
  domains?: UserCharacterDomain[]
  campaigns?: Array<{
    id: string
    name: string
  }>
}

export type UserCharacterAccess = {
  campaigns: Array<{
    id: string
    name: string
    master: {
      id: string
      name: string
    }
    visibility: CharacterVisibility
    role: "MASTER" | "PLAYER"
    status: "ACTIVE" | "INVITED" | "REMOVED"
  }>
  homebrewSpells: Array<{
    id: string
    index: string
    name: string
    author: {
      id: string
      name: string
    }
    ownedByCurrentUser: boolean
    sourceCampaign?: {
      id: string
      name: string
    } | null
    approvedCampaigns: Array<{
      id: string
      name: string
      status: "APPROVED"
    }>
    grantedAt: string
  }>
}

type CharactersResponse = {
  characters: UserCharacterSummary[]
}

type CharacterResponse = {
  character: UserCharacterSummary
}

type CharacterAccessResponse = {
  access: UserCharacterAccess
}

type DomainResponse = {
  domain: UserCharacterDomain | null
  duplicate?: boolean
}

export class UserCharacterDomainConflictError extends Error {
  constructor(readonly current: UserCharacterDomain | null) {
    super("Conflito de versão no domínio do personagem.")
  }
}

export async function getMyCharacters(): Promise<UserCharacterSummary[]> {
  if (LOCAL_AUTH_BYPASS) {
    return getLocalCharacters() as UserCharacterSummary[]
  }

  const response = await apiClient.get<CharactersResponse>("/me/characters")
  return (response.data.characters ?? []).map(hydrateCharacterSummary)
}

export async function getMyCharacter(
  characterId: string,
): Promise<UserCharacterSummary> {
  if (LOCAL_AUTH_BYPASS) {
    const character = getLocalCharacters().find(
      (entry) => entry.id === characterId,
    ) as UserCharacterSummary | undefined

    if (!character) {
      throw new Error("Personagem local não encontrado.")
    }

    return character
  }

  const response = await apiClient.get<CharacterResponse>(
    `/me/characters/${encodeURIComponent(characterId)}`,
  )

  return hydrateCharacterSummary(response.data.character)
}

export async function getMyCharacterDomain(
  characterId: string,
  domain: CharacterDomainName,
): Promise<UserCharacterDomain | null> {
  if (LOCAL_AUTH_BYPASS) return null

  const response = await apiClient.get<DomainResponse>(
    `/me/characters/${encodeURIComponent(characterId)}/domains/${domain}`,
  )
  return response.data.domain
}

export async function replaceMyCharacterDomain(
  characterId: string,
  domain: CharacterDomainName,
  payload: Record<string, unknown>,
  expectedVersion: number,
  metadata: {
    mutationId?: string
    clientId?: string
  } = {},
): Promise<UserCharacterDomain> {
  if (LOCAL_AUTH_BYPASS) {
    throw new Error(
      "Domínios remotos não são usados no modo local de desenvolvimento.",
    )
  }

  try {
    const response = await apiClient.put<DomainResponse>(
      `/me/characters/${encodeURIComponent(characterId)}/domains/${domain}`,
      {
        payload,
        expectedVersion,
        ...metadata,
      },
    )

    if (!response.data.domain) {
      throw new Error("O servidor não retornou o domínio atualizado.")
    }
    return response.data.domain
  } catch (error) {
    if (getApiStatus(error) === 409) {
      const current = isDomainConflictResponse(error)
        ? error.response?.data.current ?? null
        : null
      throw new UserCharacterDomainConflictError(current)
    }
    throw error
  }
}

export async function getMyCharacterAccess(
  characterId: string,
): Promise<UserCharacterAccess> {
  if (LOCAL_AUTH_BYPASS) {
    const character = await getMyCharacter(characterId)
    return {
      campaigns: (character.campaigns ?? []).map((campaign) => ({
        ...campaign,
        master: {
          id: "local-development-user",
          name: "Usuário local",
        },
        visibility: "PARTY" as const,
        role: "MASTER" as const,
        status: "ACTIVE" as const,
      })),
      homebrewSpells: [],
    }
  }

  const response = await apiClient.get<CharacterAccessResponse>(
    `/me/characters/${encodeURIComponent(characterId)}/access`,
  )

  return response.data.access
}

export async function createMyCharacter(input: {
  name: string
  visibility?: CharacterVisibility
  data?: Record<string, unknown>
  character?: CharacterTemplate
}): Promise<UserCharacterSummary> {
  const data = input.character
    ? (input.character.toJSON() as unknown as Record<string, unknown>)
    : input.data ?? {}

  if (LOCAL_AUTH_BYPASS) {
    const now = new Date().toISOString()
    const id = input.character?.get("id") ?? crypto.randomUUID()

    const character: UserCharacterSummary = {
      id,
      name: input.name.trim() || input.character?.get("name") || "Personagem",
      visibility: input.visibility ?? "PRIVATE",
      data: {
        ...data,
        id,
      },
      createdAt: now,
      updatedAt: now,
      campaigns: [],
    }

    setLocalCharacters([
      character,
      ...getLocalCharacters(),
    ])

    return character
  }

  const response = await apiClient.post<CharacterResponse>(
    "/me/characters",
    {
      name: input.name,
      visibility: input.visibility,
      data,
    },
  )

  return hydrateCharacterSummary(response.data.character)
}

/**
 * Saves a complete user-owned character document in one request. The server
 * mirrors the document into the relational domain rows in the same transaction.
 */
export async function updateMyCharacter(
  characterId: string,
  data: Record<string, unknown>,
  options: {
    name?: string
    visibility?: CharacterVisibility
    expectedVersion?: number
  } = {},
): Promise<UserCharacterSummary> {
  const requestedName =
    options.name ??
    (typeof data.name === "string" ? data.name : undefined)

  if (LOCAL_AUTH_BYPASS) {
    const now = new Date().toISOString()
    let updatedCharacter: UserCharacterSummary | undefined

    const characters = getLocalCharacters().map((character) => {
      if (character.id !== characterId) return character

      updatedCharacter = {
        ...character,
        name: requestedName?.trim() || character.name,
        visibility:
          options.visibility ??
          (character.visibility as CharacterVisibility) ??
          "PRIVATE",
        revision: ((character as UserCharacterSummary).revision ?? 0) + 1,
        data,
        updatedAt: now,
      } as UserCharacterSummary

      return updatedCharacter
    })

    if (!updatedCharacter) {
      throw new Error("Personagem local não encontrado.")
    }

    setLocalCharacters(characters)
    return updatedCharacter
  }

  try {
    const response = await apiClient.patch<CharacterResponse>(
      `/me/characters/${encodeURIComponent(characterId)}`,
      {
        name: requestedName,
        visibility: options.visibility,
        expectedVersion: options.expectedVersion,
        data,
      },
    )

    return hydrateCharacterSummary(response.data.character)
  } catch (error) {
    if (getApiStatus(error) === 409) {
      throw new Error(
        "A ficha foi alterada em outro cliente. Recarregue antes de salvar.",
      )
    }
    throw error
  }
}

export async function updateMyCharacterRoot(
  characterId: string,
  expectedVersion: number,
  options: {
    name?: string
    visibility?: CharacterVisibility
  },
): Promise<UserCharacterSummary> {
  if (LOCAL_AUTH_BYPASS) {
    const current = await getMyCharacter(characterId)
    return updateMyCharacter(
      characterId,
      current.data as Record<string, unknown>,
      options,
    )
  }

  try {
    const response = await apiClient.patch<CharacterResponse>(
      `/me/characters/${encodeURIComponent(characterId)}`,
      {
        expectedVersion,
        name: options.name,
        visibility: options.visibility,
      },
    )
    return hydrateCharacterSummary(response.data.character)
  } catch (error) {
    if (getApiStatus(error) === 409) {
      throw new Error("A identidade do personagem foi alterada em outro cliente.")
    }
    throw error
  }
}

/** Compatibility alias for older callers. */
export async function updateMyCharacterDomain(
  characterId: string,
  domain: CharacterDomainName,
  payload: Record<string, unknown>,
  expectedVersion = 0,
): Promise<UserCharacterDomain> {
  return replaceMyCharacterDomain(
    characterId,
    domain,
    payload,
    expectedVersion,
  )
}

export async function deleteMyCharacter(
  characterId: string,
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    const current = getLocalCharacters()
    const remaining = current.filter(
      (character) => character.id !== characterId,
    )

    if (remaining.length === current.length) {
      throw new Error("Personagem local não encontrado.")
    }

    setLocalCharacters(remaining)
    return
  }

  await apiClient.delete(
    `/me/characters/${encodeURIComponent(characterId)}`,
  )
}

export function characterTemplateFromSummary(
  character: UserCharacterSummary,
): CharacterTemplate {
  const hydrated = hydrateCharacterSummary(character)
  return CharacterTemplate.fromJSON({
    ...(hydrated.data as unknown as CharacterTemplateProps),
    id: hydrated.id,
    name: hydrated.name,
    visibility:
      hydrated.visibility.toLowerCase() as CharacterTemplateProps["visibility"],
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

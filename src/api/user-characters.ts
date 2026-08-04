import {
  getLocalCharacters,
  LOCAL_AUTH_BYPASS,
  setLocalCharacters,
  type LocalCharacter,
} from "../auth/local-auth"
import { apiClient } from "./api-client"

export type CharacterVisibility = "PRIVATE" | "PARTY" | "MASTER"

export type UserCharacterSummary = LocalCharacter & {
  visibility: CharacterVisibility
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

export async function getMyCharacters(): Promise<UserCharacterSummary[]> {
  if (LOCAL_AUTH_BYPASS) {
    return getLocalCharacters() as UserCharacterSummary[]
  }

  const response = await apiClient.get<CharactersResponse>(
    "/me/characters",
  )

  return response.data.characters ?? []
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

  return response.data.character
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
  data: Record<string, unknown>
}): Promise<UserCharacterSummary> {
  if (LOCAL_AUTH_BYPASS) {
    const now = new Date().toISOString()

    const character: UserCharacterSummary = {
      id: crypto.randomUUID(),
      name: input.name,
      visibility: input.visibility ?? "PRIVATE",
      data: input.data,
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
    input,
  )

  return response.data.character
}

export async function updateMyCharacter(
  characterId: string,
  data: Record<string, unknown>,
  options: {
    name?: string
    visibility?: CharacterVisibility
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
        name:
          requestedName?.trim() ||
          character.name,
        visibility:
          options.visibility ??
          (character.visibility as CharacterVisibility) ??
          "PRIVATE",
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

  const response = await apiClient.patch<CharacterResponse>(
    `/me/characters/${encodeURIComponent(characterId)}`,
    {
      name: requestedName,
      visibility: options.visibility,
      data,
    },
  )

  return response.data.character
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

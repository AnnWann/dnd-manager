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

type CharactersResponse = {
  characters: UserCharacterSummary[]
}

type CharacterResponse = {
  character: UserCharacterSummary
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
    const remaining = getLocalCharacters().filter(
      (character) => character.id !== characterId,
    )

    if (remaining.length === getLocalCharacters().length) {
      throw new Error("Personagem local não encontrado.")
    }

    setLocalCharacters(remaining)
    return
  }

  await apiClient.delete(
    `/me/characters/${encodeURIComponent(characterId)}`,
  )
}

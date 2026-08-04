import {
  getLocalCharacters,
  LOCAL_AUTH_BYPASS,
  setLocalCharacters,
  type LocalCharacter,
} from "../auth/local-auth"
import { apiClient } from "./api-client"

export type UserCharacterSummary = LocalCharacter

type CharactersResponse = {
  characters: UserCharacterSummary[]
}

export async function getMyCharacters():
Promise<UserCharacterSummary[]> {
  if (LOCAL_AUTH_BYPASS) {
    return getLocalCharacters()
  }

  const response =
    await apiClient.get<CharactersResponse>(
      "/me/characters",
    )

  return response.data.characters ?? []
}

export async function createMyCharacter(input: {
  name: string
  visibility?: "PRIVATE" | "PARTY" | "MASTER"
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

  const response = await apiClient.post<{
    character: UserCharacterSummary
  }>("/me/characters", input)

  return response.data.character
}
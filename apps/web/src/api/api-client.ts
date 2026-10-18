import axios, {
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios"

import {
  readActiveUserCharacterCacheSnapshot,
  writeActiveUserCharacterCache,
} from "../features/user/userPersistentCache"

export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
})

const CHARACTER_DETAIL_DEDUPE_MS = 15_000

const inFlightCharacterReads = new Map<string, Promise<AxiosResponse>>()
const recentCharacterReads = new Map<
  string,
  { response: AxiosResponse; resolvedAt: number }
>()

apiClient.interceptors.request.use((config) => {
  const method = (config.method ?? "get").toLowerCase()

  if (method !== "get") {
    invalidateCharacterReadsForMutation(config)
    return config
  }

  const characterReadKey = getCharacterDetailReadKey(config)
  if (!characterReadKey) return config

  const originalAdapter = axios.getAdapter(config.adapter)

  config.adapter = createCharacterReadAdapter(
    characterReadKey,
    originalAdapter,
  )

  return config
})

function createCharacterReadAdapter(
  key: string,
  originalAdapter: AxiosAdapter,
): AxiosAdapter {
  return async (config) => {
    const persistent = readActiveUserCharacterCacheSnapshot<unknown>(key)
    if (persistent?.fresh) {
      return {
        data: { character: persistent.data },
        status: 200,
        statusText: "OK (persistent cache)",
        headers: {},
        config,
        request: undefined,
      }
    }

    const recent = recentCharacterReads.get(key)
    if (
      recent &&
      Date.now() - recent.resolvedAt < CHARACTER_DETAIL_DEDUPE_MS
    ) {
      return cloneResponseForRequest(recent.response, config)
    }

    const existing = inFlightCharacterReads.get(key)
    if (existing) {
      return cloneResponseForRequest(await existing, config)
    }

    const request = originalAdapter(config)
      .then((response) => {
        const character = readCharacterFromResponse(response)
        if (character) {
          writeActiveUserCharacterCache(key, character, { synced: true })
        }
        recentCharacterReads.set(key, {
          response,
          resolvedAt: Date.now(),
        })
        return response
      })
      .finally(() => {
        if (inFlightCharacterReads.get(key) === request) {
          inFlightCharacterReads.delete(key)
        }
      })

    inFlightCharacterReads.set(key, request)
    return cloneResponseForRequest(await request, config)
  }
}

function readCharacterFromResponse(response: AxiosResponse): unknown | undefined {
  const data = response.data
  if (!data || typeof data !== "object" || !("character" in data)) return undefined
  return (data as { character?: unknown }).character
}

function cloneResponseForRequest(
  response: AxiosResponse,
  config: InternalAxiosRequestConfig,
): AxiosResponse {
  return {
    ...response,
    config,
  }
}

function getCharacterDetailReadKey(
  config: InternalAxiosRequestConfig,
): string | null {
  const url = config.url ?? ""
  const match = url.match(/^\/me\/characters\/([^/?#]+)$/)
  if (!match) return null

  return decodeURIComponent(match[1])
}

function invalidateCharacterReadsForMutation(
  config: InternalAxiosRequestConfig,
): void {
  const url = config.url ?? ""
  const match = url.match(/^\/me\/characters\/([^/?#]+)/)

  if (match) {
    const characterId = decodeURIComponent(match[1])
    recentCharacterReads.delete(characterId)
    return
  }

  if (url === "/me/characters") {
    recentCharacterReads.clear()
  }
}

/**
 * Clears only the in-memory request-deduplication layer. Persistent user caches
 * intentionally survive F5 and normal navigation.
 */
export function clearApiReadCache(): void {
  recentCharacterReads.clear()
}

export function getApiStatus(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null
  return error.response?.status ?? null
}

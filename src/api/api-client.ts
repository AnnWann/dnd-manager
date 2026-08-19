import axios, {
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios"

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

  // Creating/deleting characters can change list/detail ownership relationships.
  if (url === "/me/characters") {
    recentCharacterReads.clear()
  }
}

/**
 * User-facing stale-while-revalidate caching lives in the user data providers.
 * This hook only clears the short request-deduplication window used to protect
 * full-character reads from React remount/request storms.
 */
export function clearApiReadCache(): void {
  recentCharacterReads.clear()
}

export function getApiStatus(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null
  return error.response?.status ?? null
}

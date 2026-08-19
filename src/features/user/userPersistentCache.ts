const USER_CACHE_PREFIX = "dnd-manager:user-cache:v1"
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type UserCacheKey = "characters" | "campaigns" | "spells"

type CacheEnvelope<T> = {
  savedAt: number
  data: T
}

export function readUserCache<T>(
  userId: string,
  key: UserCacheKey,
): T | undefined {
  if (!userId || typeof window === "undefined") return undefined

  try {
    const raw = window.localStorage.getItem(storageKey(userId, key))
    if (!raw) return undefined

    const parsed = JSON.parse(raw) as Partial<CacheEnvelope<T>>
    if (
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > MAX_CACHE_AGE_MS ||
      !("data" in parsed)
    ) {
      window.localStorage.removeItem(storageKey(userId, key))
      return undefined
    }

    return parsed.data as T
  } catch {
    return undefined
  }
}

export function writeUserCache<T>(
  userId: string,
  key: UserCacheKey,
  data: T,
): void {
  if (!userId || typeof window === "undefined") return

  try {
    const envelope: CacheEnvelope<T> = {
      savedAt: Date.now(),
      data,
    }
    window.localStorage.setItem(
      storageKey(userId, key),
      JSON.stringify(envelope),
    )
  } catch (error) {
    console.warn("[user-cache] Could not persist cached user data.", error)
  }
}

export function clearUserCache(userId: string): void {
  if (!userId || typeof window === "undefined") return

  for (const key of ["characters", "campaigns", "spells"] as const) {
    window.localStorage.removeItem(storageKey(userId, key))
  }
}

function storageKey(userId: string, key: UserCacheKey): string {
  return `${USER_CACHE_PREFIX}:${encodeURIComponent(userId)}:${key}`
}

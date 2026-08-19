const USER_CACHE_PREFIX = "dnd-manager:user-cache:v1"
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const USER_CACHE_FRESHNESS_MS = 30 * 60 * 1000

export type UserCacheKey = "characters" | "campaigns" | "spells"

type CacheEnvelope<T> = {
  savedAt: number
  syncedAt?: number
  data: T
}

export type UserCacheSnapshot<T> = {
  data: T
  savedAt: number
  syncedAt: number
  fresh: boolean
}

type CacheWriteOptions = {
  synced?: boolean
}

export function readUserCache<T>(
  userId: string,
  key: UserCacheKey,
): T | undefined {
  return readUserCacheSnapshot<T>(userId, key)?.data
}

export function readUserCacheSnapshot<T>(
  userId: string,
  key: UserCacheKey,
): UserCacheSnapshot<T> | undefined {
  return readCacheSnapshot<T>(userId, key)
}

export function writeUserCache<T>(
  userId: string,
  key: UserCacheKey,
  data: T,
  options: CacheWriteOptions = {},
): void {
  writeCacheEntry(userId, key, data, options)
}

export function readUserCharacterCache<T>(
  userId: string,
  characterId: string,
): T | undefined {
  return readUserCharacterCacheSnapshot<T>(userId, characterId)?.data
}

export function readUserCharacterCacheSnapshot<T>(
  userId: string,
  characterId: string,
): UserCacheSnapshot<T> | undefined {
  if (!characterId) return undefined
  return readCacheSnapshot<T>(userId, characterCacheKey(characterId))
}

export function writeUserCharacterCache<T>(
  userId: string,
  characterId: string,
  data: T,
  options: CacheWriteOptions = {},
): void {
  if (!characterId) return
  writeCacheEntry(userId, characterCacheKey(characterId), data, options)
}

export function removeUserCharacterCache(
  userId: string,
  characterId: string,
): void {
  if (!userId || !characterId || typeof window === "undefined") return
  window.localStorage.removeItem(
    storageKey(userId, characterCacheKey(characterId)),
  )
}

export function clearUserCache(userId: string): void {
  if (!userId || typeof window === "undefined") return

  const prefix = `${USER_CACHE_PREFIX}:${encodeURIComponent(userId)}:`
  const keysToRemove: string[] = []

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith(prefix)) keysToRemove.push(key)
  }

  for (const key of keysToRemove) {
    window.localStorage.removeItem(key)
  }
}

function readCacheSnapshot<T>(
  userId: string,
  key: string,
): UserCacheSnapshot<T> | undefined {
  if (!userId || typeof window === "undefined") return undefined

  try {
    const cacheKey = storageKey(userId, key)
    const raw = window.localStorage.getItem(cacheKey)
    if (!raw) return undefined

    const parsed = JSON.parse(raw) as Partial<CacheEnvelope<T>>
    if (
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > MAX_CACHE_AGE_MS ||
      !("data" in parsed)
    ) {
      window.localStorage.removeItem(cacheKey)
      return undefined
    }

    const syncedAt =
      typeof parsed.syncedAt === "number" ? parsed.syncedAt : parsed.savedAt

    return {
      data: parsed.data as T,
      savedAt: parsed.savedAt,
      syncedAt,
      fresh: Date.now() - syncedAt <= USER_CACHE_FRESHNESS_MS,
    }
  } catch {
    return undefined
  }
}

function writeCacheEntry<T>(
  userId: string,
  key: string,
  data: T,
  options: CacheWriteOptions,
): void {
  if (!userId || typeof window === "undefined") return

  try {
    const now = Date.now()
    const previous = readCacheSnapshot<T>(userId, key)
    const envelope: CacheEnvelope<T> = {
      savedAt: now,
      syncedAt: options.synced ? now : previous?.syncedAt ?? 0,
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

function characterCacheKey(characterId: string): string {
  return `character:${encodeURIComponent(characterId)}`
}

function storageKey(userId: string, key: string): string {
  return `${USER_CACHE_PREFIX}:${encodeURIComponent(userId)}:${key}`
}

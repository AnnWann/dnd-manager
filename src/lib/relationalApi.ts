export type VersionedEntity = {
  id: string
  version?: number
  rowVersion?: number
}

export type CharacterRow = VersionedEntity & {
  legacyId?: string
  name: string
  ownerKey?: string
  visibility: 'private' | 'party' | 'master'
  unique: boolean
  characterType: string
  updatedAt?: string
}

export type SpellRow = VersionedEntity & {
  stableKey: string
  name: string
  level: number
  school?: string
  description?: string
  isHomebrew?: boolean
  updatedAt?: string
}

export type SystemRow = VersionedEntity & {
  stableKey: string
  name: string
  description?: string
  icon?: string
  systemVersion: number
  rowVersion: number
  updatedAt?: string
}

type ApiErrorPayload = {
  error?: string
  current?: unknown
}

export class RelationalConflictError extends Error {
  constructor(readonly current: unknown) {
    super('Conflito de versão.')
  }
}

export function createRelationalRepositories(syncKey: string) {
  const request = createRequester(syncKey)

  return {
    characters: {
      list: async () => (await request<{ characters: CharacterRow[] }>('/api/v2/characters')).characters,
      get: async (id: string) => (await request<{ character: CharacterRow }>(`/api/v2/characters?id=${encodeURIComponent(id)}`)).character,
      create: async (payload: Record<string, unknown>) => (await request<{ character: CharacterRow }>('/api/v2/characters', { method: 'POST', body: payload })).character,
      update: async (id: string, payload: Record<string, unknown>) => (await request<{ character: CharacterRow }>(`/api/v2/characters?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })).character,
      remove: async (id: string) => request<{ ok: true; id: string }>(`/api/v2/characters?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    },
    spells: {
      list: async () => (await request<{ spells: SpellRow[] }>('/api/v2/spells')).spells,
      get: async (id: string) => (await request<{ spell: SpellRow }>(`/api/v2/spells?id=${encodeURIComponent(id)}`)).spell,
      create: async (payload: Record<string, unknown>) => (await request<{ spell: SpellRow }>('/api/v2/spells', { method: 'POST', body: payload })).spell,
      update: async (id: string, payload: Record<string, unknown>) => (await request<{ spell: SpellRow }>(`/api/v2/spells?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })).spell,
      remove: async (id: string) => request<{ ok: true; id: string }>(`/api/v2/spells?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    },
    systems: {
      list: async () => (await request<{ systems: SystemRow[] }>('/api/v2/systems')).systems,
      get: async (id: string) => request<{ system: SystemRow; fields: unknown[]; resources: unknown[]; abilityTypes: unknown[] }>(`/api/v2/systems?id=${encodeURIComponent(id)}`),
      create: async (payload: Record<string, unknown>) => (await request<{ system: SystemRow }>('/api/v2/systems', { method: 'POST', body: payload })).system,
      update: async (id: string, payload: Record<string, unknown>) => (await request<{ system: SystemRow }>(`/api/v2/systems?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })).system,
      remove: async (id: string) => request<{ ok: true; id: string }>(`/api/v2/systems?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    },
  }
}

function createRequester(syncKey: string) {
  return async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const separator = path.includes('?') ? '&' : '?'
    const response = await fetch(`${path}${separator}key=${encodeURIComponent(syncKey)}`, {
      method: options.method ?? 'GET',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({})) as T & ApiErrorPayload
    if (response.status === 409) throw new RelationalConflictError(data.current)
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
    return data
  }
}

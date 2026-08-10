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
  notes?: string
  updatedAt?: string
}

export const CHARACTER_DOMAIN_NAMES = [
  'sheet',
  'vitals',
  'profile',
  'abilities',
  'magic',
  'inventory',
  'equipment',
  'progression',
  'notes',
] as const

export type CharacterDomainName = (typeof CHARACTER_DOMAIN_NAMES)[number]

export type CharacterDomainRow = {
  domain: CharacterDomainName
  payload: Record<string, unknown>
  version: number
  updatedBy?: string | null
  updatedAt?: string | null
}

export type CharacterDomainWriteMetadata = {
  actorKey?: string
  clientId?: string
  mutationId?: string
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

  const domainRepository = (domain: CharacterDomainName) => ({
    get: async (characterReference: string) => {
      const result = await request<{
        characterId: string
        domain: CharacterDomainRow | null
      }>(
        `${characterDomainPath(domain)}?characterId=${encodeURIComponent(characterReference)}`,
      )
      return result.domain
    },
    replace: async (
      characterReference: string,
      payload: Record<string, unknown>,
      expectedVersion: number,
      metadata: CharacterDomainWriteMetadata = {},
    ) => {
      const result = await request<{
        characterId: string
        domain: CharacterDomainRow
        duplicate?: boolean
      }>(
        `${characterDomainPath(domain)}?characterId=${encodeURIComponent(characterReference)}`,
        {
          method: 'PUT',
          body: {
            payload,
            expectedVersion,
            ...metadata,
          },
        },
      )
      return result.domain
    },
  })

  const characterDomains = {
    sheet: domainRepository('sheet'),
    vitals: domainRepository('vitals'),
    profile: domainRepository('profile'),
    abilities: domainRepository('abilities'),
    magic: domainRepository('magic'),
    inventory: domainRepository('inventory'),
    equipment: domainRepository('equipment'),
    progression: domainRepository('progression'),
    notes: domainRepository('notes'),
    list: async (characterReference: string) => {
      const result = await request<{
        characterId: string
        domains: CharacterDomainRow[]
      }>(
        `/api/v2/character-domains?characterId=${encodeURIComponent(characterReference)}`,
      )
      return result.domains
    },
  }

  return {
    characters: {
      list: async () =>
        (await request<{ characters: CharacterRow[] }>('/api/v2/characters'))
          .characters,
      get: async (reference: string) =>
        (
          await request<{ character: CharacterRow }>(
            `/api/v2/characters?characterId=${encodeURIComponent(reference)}`,
          )
        ).character,
      create: async (payload: Record<string, unknown>) =>
        (
          await request<{ character: CharacterRow }>('/api/v2/characters', {
            method: 'POST',
            body: payload,
          })
        ).character,
      update: async (
        reference: string,
        payload: Record<string, unknown>,
      ) =>
        (
          await request<{ character: CharacterRow }>(
            `/api/v2/characters?characterId=${encodeURIComponent(reference)}`,
            { method: 'PATCH', body: payload },
          )
        ).character,
      remove: async (reference: string) =>
        request<{ ok: true; id: string }>(
          `/api/v2/characters?characterId=${encodeURIComponent(reference)}`,
          { method: 'DELETE' },
        ),
    },
    characterDomains,
    spells: {
      list: async () =>
        (await request<{ spells: SpellRow[] }>('/api/v2/spells')).spells,
      get: async (id: string) =>
        (
          await request<{ spell: SpellRow }>(
            `/api/v2/spells?id=${encodeURIComponent(id)}`,
          )
        ).spell,
      create: async (payload: Record<string, unknown>) =>
        (
          await request<{ spell: SpellRow }>('/api/v2/spells', {
            method: 'POST',
            body: payload,
          })
        ).spell,
      update: async (id: string, payload: Record<string, unknown>) =>
        (
          await request<{ spell: SpellRow }>(
            `/api/v2/spells?id=${encodeURIComponent(id)}`,
            { method: 'PATCH', body: payload },
          )
        ).spell,
      remove: async (id: string) =>
        request<{ ok: true; id: string }>(
          `/api/v2/spells?id=${encodeURIComponent(id)}`,
          { method: 'DELETE' },
        ),
    },
    systems: {
      list: async () =>
        (await request<{ systems: SystemRow[] }>('/api/v2/systems')).systems,
      get: async (id: string) =>
        request<{
          system: SystemRow
          fields: unknown[]
          resources: unknown[]
          abilityTypes: unknown[]
        }>(`/api/v2/systems?id=${encodeURIComponent(id)}`),
      create: async (payload: Record<string, unknown>) =>
        (
          await request<{ system: SystemRow }>('/api/v2/systems', {
            method: 'POST',
            body: payload,
          })
        ).system,
      update: async (id: string, payload: Record<string, unknown>) =>
        (
          await request<{ system: SystemRow }>(
            `/api/v2/systems?id=${encodeURIComponent(id)}`,
            { method: 'PATCH', body: payload },
          )
        ).system,
      remove: async (id: string) =>
        request<{ ok: true; id: string }>(
          `/api/v2/systems?id=${encodeURIComponent(id)}`,
          { method: 'DELETE' },
        ),
    },
  }
}

function characterDomainPath(domain: CharacterDomainName): string {
  return `/api/v2/character-${domain}`
}

function createRequester(syncKey: string) {
  return async function request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const separator = path.includes('?') ? '&' : '?'
    const response = await fetch(
      `${path}${separator}key=${encodeURIComponent(syncKey)}`,
      {
        method: options.method ?? 'GET',
        headers:
          options.body === undefined
            ? undefined
            : { 'Content-Type': 'application/json' },
        body:
          options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
        cache: 'no-store',
      },
    )

    const data = (await response.json().catch(() => ({}))) as T &
      ApiErrorPayload
    if (response.status === 409) {
      throw new RelationalConflictError(data.current)
    }
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`)
    }
    return data
  }
}

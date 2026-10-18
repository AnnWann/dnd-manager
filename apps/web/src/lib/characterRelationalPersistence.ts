import type {
  CharacterTemplateProps,
} from "../models/characters/CharacterTemplate"
import {
  characterRootPayload,
  getChangedCharacterDomains,
  splitCharacterIntoDomains,
} from "./characterDomains"
import {
  createRelationalRepositories,
  RelationalConflictError,
  type CharacterDomainName,
  type CharacterDomainRow,
  type CharacterDomainWriteMetadata,
  type CharacterRow,
} from "./relationalApi"

const CLIENT_ID_STORAGE = "dndmm.characterDomainClientId.v1"

export type CharacterPersistenceConflict = {
  characterId: string
  domain: CharacterDomainName | "root"
  current: unknown
}

/**
 * Serializes writes per character/domain and owns optimistic-concurrency
 * versions. The React AppState remains an optimistic UI cache while remote
 * character persistence is split by domain.
 */
export class CharacterRelationalPersistence {
  private readonly repositories: ReturnType<typeof createRelationalRepositories>
  private readonly rootVersions = new Map<string, number>()
  private readonly domainVersions = new Map<string, number>()
  private readonly queues = new Map<string, Promise<void>>()
  private readonly bootstrapped = new Set<string>()
  private readonly clientId = readClientId()

  constructor(
    syncKey: string,
    private readonly actorKey: string,
    private readonly onConflict?: (conflict: CharacterPersistenceConflict) => void,
  ) {
    this.repositories = createRelationalRepositories(syncKey)
  }

  async bootstrap(character: CharacterTemplateProps): Promise<void> {
    if (this.bootstrapped.has(character.id)) return

    await this.enqueue(`${character.id}:bootstrap`, async () => {
      if (this.bootstrapped.has(character.id)) return

      const root = await this.repositories.characters.create(
        characterRootPayload(character),
      )
      this.rootVersions.set(character.id, Number(root.version) || 1)

      const existingDomains = await this.repositories.characterDomains.list(
        character.id,
      )
      const existingByDomain = new Map(
        existingDomains.map((entry) => [entry.domain, entry]),
      )
      const localDomains = splitCharacterIntoDomains(character)

      for (const domain of Object.keys(localDomains) as CharacterDomainName[]) {
        const existing = existingByDomain.get(domain)
        if (existing) {
          this.domainVersions.set(domainKey(character.id, domain), existing.version)
          continue
        }

        const created = await this.domainRepository(domain).replace(
          character.id,
          localDomains[domain],
          0,
          this.createMutationMetadata(),
        )
        this.domainVersions.set(domainKey(character.id, domain), created.version)
      }

      this.bootstrapped.add(character.id)
    })
  }

  persistChange(
    previous: CharacterTemplateProps,
    next: CharacterTemplateProps,
  ): void {
    if (previous.id !== next.id) return

    void this.bootstrap(previous)
      .then(() => {
        if (!rootPayloadsEqual(previous, next)) {
          this.enqueueRootWrite(previous, next)
        }

        const changedDomains = getChangedCharacterDomains(previous, next)
        const previousDomains = splitCharacterIntoDomains(previous)
        const nextDomains = splitCharacterIntoDomains(next)

        for (const domain of changedDomains) {
          this.enqueueDomainWrite(
            next.id,
            domain,
            previousDomains[domain],
            nextDomains[domain],
          )
        }
      })
      .catch((error) => this.reportError(next.id, "root", error))
  }

  remove(characterId: string): void {
    void this.enqueue(`${characterId}:delete`, async () => {
      try {
        await this.repositories.characters.remove(characterId)
        this.rootVersions.delete(characterId)
        for (const key of this.domainVersions.keys()) {
          if (key.startsWith(`${characterId}:`)) this.domainVersions.delete(key)
        }
        this.bootstrapped.delete(characterId)
      } catch (error) {
        this.reportError(characterId, "root", error)
      }
    })
  }

  private enqueueRootWrite(
    previous: CharacterTemplateProps,
    next: CharacterTemplateProps,
  ) {
    void this.enqueue(`${next.id}:root`, async () => {
      try {
        let expectedVersion = this.rootVersions.get(next.id)
        if (!expectedVersion) {
          const current = await this.repositories.characters.get(next.id)
          if (!rootMatches(current, previous)) {
            this.reportConflict(next.id, "root", current)
            return
          }
          expectedVersion = Number(current.version) || 1
        }

        const changed = await this.repositories.characters.update(next.id, {
          ...characterRootPayload(next),
          expectedVersion,
        })
        this.rootVersions.set(
          next.id,
          Number(changed.version) || expectedVersion + 1,
        )
      } catch (error) {
        if (error instanceof RelationalConflictError) {
          this.reportConflict(next.id, "root", error.current)
          return
        }
        this.reportError(next.id, "root", error)
      }
    })
  }

  private enqueueDomainWrite(
    characterId: string,
    domain: CharacterDomainName,
    previousPayload: Record<string, unknown>,
    nextPayload: Record<string, unknown>,
  ) {
    const metadata = this.createMutationMetadata()

    void this.enqueue(domainKey(characterId, domain), async () => {
      try {
        let expectedVersion = this.domainVersions.get(
          domainKey(characterId, domain),
        )

        if (expectedVersion === undefined) {
          const current = await this.domainRepository(domain).get(characterId)
          if (current && !payloadsEqual(current.payload, previousPayload)) {
            this.reportConflict(characterId, domain, current)
            return
          }
          expectedVersion = current?.version ?? 0
        }

        const changed = await this.domainRepository(domain).replace(
          characterId,
          nextPayload,
          expectedVersion,
          metadata,
        )
        this.domainVersions.set(
          domainKey(characterId, domain),
          changed.version,
        )
      } catch (error) {
        if (error instanceof RelationalConflictError) {
          const current = asDomainRow(error.current)
          if (current && payloadsEqual(current.payload, previousPayload)) {
            try {
              const retried = await this.domainRepository(domain).replace(
                characterId,
                nextPayload,
                current.version,
                metadata,
              )
              this.domainVersions.set(
                domainKey(characterId, domain),
                retried.version,
              )
              return
            } catch (retryError) {
              if (retryError instanceof RelationalConflictError) {
                this.reportConflict(characterId, domain, retryError.current)
                return
              }
              this.reportError(characterId, domain, retryError)
              return
            }
          }

          this.reportConflict(characterId, domain, error.current)
          return
        }

        this.reportError(characterId, domain, error)
      }
    })
  }

  private domainRepository(domain: CharacterDomainName) {
    return this.repositories.characterDomains[domain]
  }

  private createMutationMetadata(): CharacterDomainWriteMetadata {
    return {
      actorKey: this.actorKey || undefined,
      clientId: this.clientId,
      mutationId: crypto.randomUUID(),
    }
  }

  private enqueue(key: string, task: () => Promise<void>): Promise<void> {
    const previous = this.queues.get(key) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(task)
    this.queues.set(key, next)
    void next.finally(() => {
      if (this.queues.get(key) === next) this.queues.delete(key)
    })
    return next
  }

  private reportConflict(
    characterId: string,
    domain: CharacterDomainName | "root",
    current: unknown,
  ) {
    this.onConflict?.({ characterId, domain, current })
    console.warn(
      `Conflito de persistência no personagem ${characterId}, domínio ${domain}.`,
      current,
    )
  }

  private reportError(
    characterId: string,
    domain: CharacterDomainName | "root",
    error: unknown,
  ) {
    console.error(
      `Falha ao persistir personagem ${characterId}, domínio ${domain}.`,
      error,
    )
  }
}

function rootPayloadsEqual(
  left: CharacterTemplateProps,
  right: CharacterTemplateProps,
): boolean {
  return payloadsEqual(characterRootPayload(left), characterRootPayload(right))
}

function rootMatches(
  current: CharacterRow,
  local: CharacterTemplateProps,
): boolean {
  const expected = characterRootPayload(local)
  return (
    current.name === expected.name &&
    (current.ownerKey ?? null) === expected.ownerKey &&
    current.visibility === expected.visibility &&
    current.unique === expected.unique &&
    current.characterType === expected.characterType
  )
}

function domainKey(characterId: string, domain: CharacterDomainName): string {
  return `${characterId}:${domain}`
}

function payloadsEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function asDomainRow(value: unknown): CharacterDomainRow | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const row = value as Partial<CharacterDomainRow>
  if (
    typeof row.domain !== "string" ||
    typeof row.version !== "number" ||
    !row.payload ||
    typeof row.payload !== "object" ||
    Array.isArray(row.payload)
  ) {
    return undefined
  }
  return row as CharacterDomainRow
}

function readClientId(): string {
  if (typeof window === "undefined") return "server-render"
  const existing = window.localStorage.getItem(CLIENT_ID_STORAGE)?.trim()
  if (existing) return existing
  const created = crypto.randomUUID()
  window.localStorage.setItem(CLIENT_ID_STORAGE, created)
  return created
}

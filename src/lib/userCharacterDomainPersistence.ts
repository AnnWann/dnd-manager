import {
  replaceMyCharacterDomain,
  updateMyCharacterRoot,
  UserCharacterDomainConflictError,
  type UserCharacterDomain,
} from "../api/user-characters"
import type { CharacterTemplateProps } from "../models/characters/CharacterTemplate"
import {
  getChangedCharacterDomains,
  splitCharacterIntoDomains,
} from "./characterDomains"
import type { CharacterDomainName } from "./relationalApi"

const CLIENT_ID_STORAGE = "dndmm.userCharacterDomainClientId.v1"

export type UserCharacterPersistenceConflict = {
  characterId: string
  domain: CharacterDomainName | "root"
  current: unknown
}

export type UserCharacterPersistenceVersion =
  | { domain: "root"; version: number }
  | { domain: CharacterDomainName; version: number }

export class UserCharacterDomainPersistence {
  private rootVersion: number
  private readonly domainVersions = new Map<CharacterDomainName, number>()
  private readonly queues = new Map<string, Promise<void>>()
  private readonly clientId = readClientId()

  constructor(
    private readonly characterId: string,
    rootVersion: number,
    domains: UserCharacterDomain[],
    private readonly onConflict?: (
      conflict: UserCharacterPersistenceConflict,
    ) => void,
    private readonly onError?: (error: unknown) => void,
    private readonly onVersionPersisted?: (
      version: UserCharacterPersistenceVersion,
    ) => void,
  ) {
    this.rootVersion = Math.max(1, Math.trunc(rootVersion || 1))
    for (const domain of domains) {
      this.domainVersions.set(domain.domain, domain.version)
    }
  }

  async bootstrapMissingDomains(
    character: CharacterTemplateProps,
  ): Promise<void> {
    const snapshot = splitCharacterIntoDomains(character)

    await Promise.all(
      (Object.keys(snapshot) as CharacterDomainName[]).map((domain) =>
        this.enqueue(domain, async () => {
          if (this.domainVersions.has(domain)) return

          try {
            const created = await replaceMyCharacterDomain(
              this.characterId,
              domain,
              snapshot[domain],
              0,
              this.createMutationMetadata(),
            )
            this.setDomainVersion(domain, created.version)
          } catch (error) {
            if (error instanceof UserCharacterDomainConflictError) {
              if (error.current) {
                this.setDomainVersion(domain, error.current.version)
                return
              }
              this.reportConflict(domain, error.current)
              return
            }
            this.reportError(error)
          }
        }),
      ),
    )
  }

  persistChange(
    previous: CharacterTemplateProps,
    next: CharacterTemplateProps,
  ): void {
    if (previous.id !== next.id || next.id !== this.characterId) return

    if (!rootEqual(previous, next)) {
      this.enqueueRoot(previous, next)
    }

    const changedDomains = getChangedCharacterDomains(previous, next)
    const previousDomains = splitCharacterIntoDomains(previous)
    const nextDomains = splitCharacterIntoDomains(next)

    for (const domain of changedDomains) {
      const metadata = this.createMutationMetadata()
      void this.enqueue(domain, async () => {
        try {
          const expectedVersion = this.domainVersions.get(domain) ?? 0
          const changed = await replaceMyCharacterDomain(
            this.characterId,
            domain,
            nextDomains[domain],
            expectedVersion,
            metadata,
          )
          this.setDomainVersion(domain, changed.version)
        } catch (error) {
          if (error instanceof UserCharacterDomainConflictError) {
            const current = error.current
            if (
              current &&
              payloadsEqual(current.payload, previousDomains[domain])
            ) {
              try {
                const retried = await replaceMyCharacterDomain(
                  this.characterId,
                  domain,
                  nextDomains[domain],
                  current.version,
                  metadata,
                )
                this.setDomainVersion(domain, retried.version)
                return
              } catch (retryError) {
                if (retryError instanceof UserCharacterDomainConflictError) {
                  this.reportConflict(domain, retryError.current)
                  return
                }
                this.reportError(retryError)
                return
              }
            }

            this.reportConflict(domain, current)
            return
          }

          this.reportError(error)
        }
      })
    }
  }

  private enqueueRoot(
    previous: CharacterTemplateProps,
    next: CharacterTemplateProps,
  ) {
    void this.enqueue("root", async () => {
      try {
        const changed = await updateMyCharacterRoot(
          this.characterId,
          this.rootVersion,
          {
            name: next.name,
            visibility: toApiVisibility(next.visibility),
          },
        )
        this.rootVersion = Math.max(
          this.rootVersion + 1,
          Number(changed.revision) || 0,
        )
        this.onVersionPersisted?.({ domain: "root", version: this.rootVersion })
      } catch (error) {
        this.reportConflict("root", {
          previous: {
            name: previous.name,
            visibility: previous.visibility,
          },
          error,
        })
      }
    })
  }

  private setDomainVersion(domain: CharacterDomainName, version: number) {
    this.domainVersions.set(domain, version)
    this.onVersionPersisted?.({ domain, version })
  }

  private createMutationMetadata() {
    return {
      mutationId: crypto.randomUUID(),
      clientId: this.clientId,
    }
  }

  private enqueue(
    domain: CharacterDomainName | "root",
    task: () => Promise<void>,
  ): Promise<void> {
    const previous = this.queues.get(domain) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(task)
    this.queues.set(domain, next)
    void next.finally(() => {
      if (this.queues.get(domain) === next) this.queues.delete(domain)
    })
    return next
  }

  private reportConflict(
    domain: CharacterDomainName | "root",
    current: unknown,
  ) {
    this.onConflict?.({
      characterId: this.characterId,
      domain,
      current,
    })
    console.warn(
      `Conflito ao persistir personagem ${this.characterId}, domínio ${domain}.`,
      current,
    )
  }

  private reportError(error: unknown) {
    this.onError?.(error)
    console.error(
      `Falha ao persistir personagem ${this.characterId}.`,
      error,
    )
  }
}

function rootEqual(
  left: CharacterTemplateProps,
  right: CharacterTemplateProps,
): boolean {
  return (
    left.name === right.name &&
    left.visibility === right.visibility
  )
}

function payloadsEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function toApiVisibility(
  visibility: "private" | "party" | "master",
): "PRIVATE" | "PARTY" | "MASTER" {
  return visibility.toUpperCase() as "PRIVATE" | "PARTY" | "MASTER"
}

function readClientId(): string {
  if (typeof window === "undefined") return "server-render"
  const existing = window.localStorage.getItem(CLIENT_ID_STORAGE)?.trim()
  if (existing) return existing
  const created = crypto.randomUUID()
  window.localStorage.setItem(CLIENT_ID_STORAGE, created)
  return created
}

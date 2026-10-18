import {
  applyCharacterDomains as applyRelationalCharacterDomains,
  splitCharacterIntoDomains,
} from "../../lib/characterDomains"
import type {
  CharacterDomainName,
  CharacterDomainRow,
} from "../../lib/relationalApi"
import type {
  CharacterTemplate,
  CharacterTemplateProps,
} from "./CharacterTemplate"

export type CharacterDataDomain = CharacterDomainName

export type CharacterDataDomainPayload = {
  domain: CharacterDataDomain
  data: Record<string, unknown>
}

export type CharacterDataDomainState = CharacterDataDomainPayload & {
  revision?: number
  updatedAt?: string
}

/**
 * Compatibility bridge for the authenticated character API.
 *
 * Character domain ownership is defined centrally in lib/characterDomains.
 * This module keeps the older API shape (`data`/`revision`) usable without
 * duplicating the actual split/hydration rules.
 */
export function buildCharacterDomainPayloads(
  character: CharacterTemplate,
): CharacterDataDomainPayload[] {
  const snapshot = splitCharacterIntoDomains(character.toJSON())

  return (Object.entries(snapshot) as Array<
    [CharacterDataDomain, Record<string, unknown>]
  >).map(([domain, data]) => ({ domain, data }))
}

export function applyCharacterDomains(
  base: CharacterTemplateProps,
  domains: Array<{
    domain: CharacterDataDomain
    data?: unknown
    payload?: unknown
    revision?: number
    version?: number
    updatedAt?: string | null
    updatedBy?: string | null
  }>,
): CharacterTemplateProps {
  const rows: CharacterDomainRow[] = domains.map((entry) => ({
    domain: entry.domain,
    payload: asPayload(entry.payload ?? entry.data),
    version: entry.version ?? entry.revision ?? 0,
    updatedBy: entry.updatedBy ?? null,
    updatedAt: entry.updatedAt ?? null,
  }))

  return applyRelationalCharacterDomains(base, rows)
}

function asPayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

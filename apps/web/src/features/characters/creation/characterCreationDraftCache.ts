const DRAFT_VERSION = 1
const STORAGE_PREFIX = "dnd-manager:character-creation-draft"

type DraftEnvelope = {
  version: number
  updatedAt: string
  sections: Record<string, unknown>
}

export function getCharacterCreationDraftId(ownerKey: string): string {
  const normalized = ownerKey.trim() || "local"
  return `${STORAGE_PREFIX}:v${DRAFT_VERSION}:${encodeURIComponent(normalized)}`
}

export function readCharacterCreationDraftSection<T>(
  draftId: string,
  section: string,
): T | undefined {
  const envelope = readEnvelope(draftId)
  if (!envelope || envelope.version !== DRAFT_VERSION) return undefined
  return envelope.sections[section] as T | undefined
}

export function writeCharacterCreationDraftSection(
  draftId: string,
  section: string,
  value: unknown,
): void {
  if (typeof window === "undefined") return

  try {
    const current = readEnvelope(draftId)
    const sections =
      current?.version === DRAFT_VERSION ? { ...current.sections } : {}
    sections[section] = value
    const envelope: DraftEnvelope = {
      version: DRAFT_VERSION,
      updatedAt: new Date().toISOString(),
      sections,
    }
    window.localStorage.setItem(draftId, JSON.stringify(envelope))
  } catch {
    // Draft persistence is best-effort and must never block character creation.
  }
}

export function clearCharacterCreationDraft(draftId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(draftId)
  } catch {
    // Ignore unavailable/private storage.
  }
}

function readEnvelope(draftId: string): DraftEnvelope | undefined {
  if (typeof window === "undefined") return undefined

  try {
    const raw = window.localStorage.getItem(draftId)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Partial<DraftEnvelope>
    if (
      parsed.version !== DRAFT_VERSION ||
      !parsed.sections ||
      typeof parsed.sections !== "object"
    ) {
      return undefined
    }
    return parsed as DraftEnvelope
  } catch {
    return undefined
  }
}

import type { ClassName } from "../sheet/Class"

export type CharacterAcquisitionSourceType =
  | "characterCreation"
  | "class"
  | "race"
  | "background"
  | "feat"
  | "ability"
  | "equipment"
  | "campaign"
  | "manual"
  | "import"

export type CharacterAcquisitionReason =
  | "character-creation"
  | "level-up"
  | "manual"
  | "import"
  | "campaign-grant"

export type CharacterAcquisitionMetadata = {
  /** Groups everything granted by the same creation or level-up operation. */
  eventId: string
  /** ISO timestamp recording when the entry was added to the character. */
  addedAt: string
  /** Total character level immediately after the grant. */
  characterLevel: number
  /** Class advanced by the operation, when applicable. */
  className?: ClassName
  /** Level reached in that class, when applicable. */
  classLevel?: number
  sourceType: CharacterAcquisitionSourceType
  sourceId?: string
  sourceName?: string
  reason: CharacterAcquisitionReason
  notes?: string
}

export type CharacterAcquisitionInput = Omit<
  CharacterAcquisitionMetadata,
  "eventId" | "addedAt"
> & {
  eventId?: string
  addedAt?: string
}

export function createCharacterAcquisition(
  input: CharacterAcquisitionInput,
): CharacterAcquisitionMetadata {
  return {
    ...input,
    eventId: input.eventId ?? crypto.randomUUID(),
    addedAt: input.addedAt ?? new Date().toISOString(),
    characterLevel: Math.max(0, Math.trunc(input.characterLevel || 0)),
    classLevel:
      input.classLevel === undefined
        ? undefined
        : Math.max(0, Math.trunc(input.classLevel || 0)),
  }
}

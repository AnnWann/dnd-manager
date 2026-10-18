import type {
  CharacterTemplateProps,
} from "../models/characters/CharacterTemplate"
import type {
  CharacterDomainName,
  CharacterDomainRow,
} from "./relationalApi"

export type CharacterDomainPayload = Record<string, unknown>

export type CharacterDomainSnapshot = Record<
  CharacterDomainName,
  CharacterDomainPayload
>

/**
 * Persistence ownership map for CharacterTemplate.
 *
 * Root identity (name/owner/visibility/type) belongs to the characters table.
 * Everything below is owned by exactly one independently versioned domain.
 */
export function splitCharacterIntoDomains(
  props: CharacterTemplateProps,
): CharacterDomainSnapshot {
  const { HP, conditions, ...sheet } = props.sheet

  return {
    sheet: cleanPayload({ sheet }),
    vitals: cleanPayload({
      HP,
      conditions: conditions ?? [],
      deathSaves: props.deathSaves,
      actionsPerTurn: props.actionsPerTurn,
    }),
    profile: cleanPayload({ profile: props.profile }),
    abilities: cleanPayload({ abilities: props.abilities ?? [] }),
    magic: cleanPayload({ magic: props.magic ?? null }),
    inventory: cleanPayload({ inventory: props.inventory ?? [] }),
    equipment: cleanPayload({ equipment: props.equipment }),
    progression: cleanPayload({
      asi: props.asi ?? [],
      classProgressionVersion: props.classProgressionVersion ?? 0,
    }),
    notes: cleanPayload({ notes: props.notes ?? [] }),
  }
}

export function getChangedCharacterDomains(
  previous: CharacterTemplateProps,
  next: CharacterTemplateProps,
): CharacterDomainName[] {
  const before = splitCharacterIntoDomains(previous)
  const after = splitCharacterIntoDomains(next)

  return (Object.keys(after) as CharacterDomainName[]).filter(
    (domain) => !domainPayloadsEqual(before[domain], after[domain]),
  )
}

export function characterRootPayload(props: CharacterTemplateProps) {
  return {
    legacyId: props.id,
    name: props.name,
    ownerKey: props.owner?.id || null,
    visibility: props.visibility,
    unique: props.unique,
    characterType: props.sheet.type,
  }
}

/**
 * Applies relational domain snapshots to an existing character document.
 * This is intentionally exported now so switching hydration from legacy state
 * to relational reads does not require another data-model rewrite.
 */
export function applyCharacterDomains(
  base: CharacterTemplateProps,
  rows: CharacterDomainRow[],
): CharacterTemplateProps {
  const byDomain = new Map(rows.map((row) => [row.domain, row.payload]))
  const sheetPayload = byDomain.get("sheet")?.sheet
  const vitals = byDomain.get("vitals")
  const profile = byDomain.get("profile")?.profile
  const abilities = byDomain.get("abilities")?.abilities
  const magic = byDomain.get("magic")?.magic
  const inventory = byDomain.get("inventory")?.inventory
  const equipment = byDomain.get("equipment")?.equipment
  const progression = byDomain.get("progression")
  const notes = byDomain.get("notes")?.notes

  const nextSheet = isRecord(sheetPayload)
    ? {
        ...base.sheet,
        ...sheetPayload,
        HP: isRecord(vitals?.HP) ? vitals!.HP as never : base.sheet.HP,
        conditions: Array.isArray(vitals?.conditions)
          ? vitals!.conditions as never
          : base.sheet.conditions,
      }
    : {
        ...base.sheet,
        HP: isRecord(vitals?.HP) ? vitals!.HP as never : base.sheet.HP,
        conditions: Array.isArray(vitals?.conditions)
          ? vitals!.conditions as never
          : base.sheet.conditions,
      }

  return {
    ...base,
    sheet: nextSheet as CharacterTemplateProps["sheet"],
    actionsPerTurn: isRecord(vitals?.actionsPerTurn)
      ? vitals!.actionsPerTurn as never
      : base.actionsPerTurn,
    deathSaves: isRecord(vitals?.deathSaves)
      ? vitals!.deathSaves as never
      : base.deathSaves,
    profile: isRecord(profile) ? profile as never : base.profile,
    abilities: Array.isArray(abilities) ? abilities as never : base.abilities,
    magic: isRecord(magic) ? magic as never : base.magic,
    inventory: Array.isArray(inventory) ? inventory as never : base.inventory,
    equipment: isRecord(equipment) ? equipment as never : base.equipment,
    asi: Array.isArray(progression?.asi)
      ? progression!.asi as never
      : base.asi,
    classProgressionVersion:
      typeof progression?.classProgressionVersion === "number"
        ? progression.classProgressionVersion
        : base.classProgressionVersion,
    notes: Array.isArray(notes) ? notes as string[] : base.notes,
  }
}

function cleanPayload(value: CharacterDomainPayload): CharacterDomainPayload {
  return JSON.parse(JSON.stringify(value)) as CharacterDomainPayload
}

function domainPayloadsEqual(
  left: CharacterDomainPayload,
  right: CharacterDomainPayload,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

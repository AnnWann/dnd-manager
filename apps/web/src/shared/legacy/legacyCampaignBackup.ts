import type { CharacterTemplateProps } from "../../models/characters/CharacterTemplate"
import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"
import type { Itemmable } from "../../models/items/item"
import type { Spell } from "../../models/magic/spells/Spell"

export const LEGACY_SESSION_BACKUP_SCHEMA = "dndmm-session-backup"
export const LEGACY_SESSION_BACKUP_VERSION = 1
export const LEGACY_SESSION_BOOTSTRAP_ASSET_TYPE = "OTHER"
export const LEGACY_SESSION_BOOTSTRAP_ASSET_SOURCE = "legacy-session-state:v1"

export type LegacyCampaignStateV1 = {
  version: 1
  characters: CharacterTemplateProps[]
  activeCharacterId: string
  partyInventory?: Itemmable[]
  groundInventory?: Itemmable[]
  partyCarryCapacity?: number
  partyAdditionalSupplyConsumption?: number
  spells?: Spell[]
  missions?: unknown[]
}

export type LegacyCampaignBackupV1 = {
  schema: typeof LEGACY_SESSION_BACKUP_SCHEMA
  version: 1
  exportedAt?: string
  /** Deliberately ignored by the importer. The old sync key is not a campaign credential. */
  syncKey?: string
  state: LegacyCampaignStateV1
  customSystems: CustomSystemDefinition[]
}

export type LegacySessionBootstrapV1 = {
  version: 1
  importedAt: string
  sourceExportedAt?: string
  activeCharacterId: string
  partyInventory: Itemmable[]
  groundInventory: Itemmable[]
  partyCarryCapacity: number
  partyAdditionalSupplyConsumption: number
  missions: unknown[]
}

export type LegacyCampaignBackupSummary = {
  characters: number
  partyItems: number
  groundItems: number
  spells: number
  customSystems: number
  missions: number
}

export function parseLegacyCampaignBackup(value: unknown): LegacyCampaignBackupV1 {
  if (!isRecord(value)) throw new Error("O arquivo de backup precisa conter um objeto JSON.")
  if (value.schema !== LEGACY_SESSION_BACKUP_SCHEMA) {
    throw new Error("Este arquivo não é um backup de sessão legacy do D&D Manager.")
  }
  if (value.version !== LEGACY_SESSION_BACKUP_VERSION) {
    throw new Error("A versão deste backup legacy não é suportada.")
  }
  if (!isRecord(value.state) || value.state.version !== 1) {
    throw new Error("O estado da sessão legacy é inválido.")
  }
  if (!Array.isArray(value.state.characters)) {
    throw new Error("O backup legacy não contém uma lista válida de personagens.")
  }

  const state = value.state as Record<string, unknown>
  return {
    schema: LEGACY_SESSION_BACKUP_SCHEMA,
    version: 1,
    exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : undefined,
    syncKey: typeof value.syncKey === "string" ? value.syncKey : undefined,
    state: {
      version: 1,
      characters: state.characters as CharacterTemplateProps[],
      activeCharacterId:
        typeof state.activeCharacterId === "string" ? state.activeCharacterId : "",
      partyInventory: arrayOrEmpty<Itemmable>(state.partyInventory),
      groundInventory: arrayOrEmpty<Itemmable>(state.groundInventory),
      partyCarryCapacity: nonNegativeNumber(state.partyCarryCapacity),
      partyAdditionalSupplyConsumption: nonNegativeNumber(
        state.partyAdditionalSupplyConsumption,
      ),
      spells: arrayOrEmpty<Spell>(state.spells),
      missions: arrayOrEmpty<unknown>(state.missions),
    },
    customSystems: arrayOrEmpty<CustomSystemDefinition>(value.customSystems),
  }
}

export function summarizeLegacyCampaignBackup(
  backup: LegacyCampaignBackupV1,
): LegacyCampaignBackupSummary {
  return {
    characters: backup.state.characters.length,
    partyItems: backup.state.partyInventory?.length ?? 0,
    groundItems: backup.state.groundInventory?.length ?? 0,
    spells: backup.state.spells?.length ?? 0,
    customSystems: backup.customSystems.length,
    missions: backup.state.missions?.length ?? 0,
  }
}

export function readLegacySessionBootstrap(
  value: unknown,
): LegacySessionBootstrapV1 | null {
  if (!isRecord(value) || value.version !== 1) return null
  return {
    version: 1,
    importedAt:
      typeof value.importedAt === "string" ? value.importedAt : new Date(0).toISOString(),
    sourceExportedAt:
      typeof value.sourceExportedAt === "string" ? value.sourceExportedAt : undefined,
    activeCharacterId:
      typeof value.activeCharacterId === "string" ? value.activeCharacterId : "",
    partyInventory: arrayOrEmpty<Itemmable>(value.partyInventory),
    groundInventory: arrayOrEmpty<Itemmable>(value.groundInventory),
    partyCarryCapacity: nonNegativeNumber(value.partyCarryCapacity),
    partyAdditionalSupplyConsumption: nonNegativeNumber(
      value.partyAdditionalSupplyConsumption,
    ),
    missions: arrayOrEmpty<unknown>(value.missions),
  }
}

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function nonNegativeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

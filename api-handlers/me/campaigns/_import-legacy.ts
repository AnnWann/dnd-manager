import {
  CampaignMemberStatus,
  CampaignRole,
  CharacterDataDomain,
  CharacterVisibility,
  Prisma,
} from "../../../generated/prisma/client.js"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../server/api.js"
import { sanitizeCharacterAcquisitionData } from "../../../server/character-acquisitions.js"
import { sanitizeCharacterItemData } from "../../../server/character-items.js"
import { prisma } from "../../../server/prisma.js"
import { requireSession } from "../../../server/session.js"
import { splitCharacterIntoDomains } from "../../../src/lib/characterDomains.js"
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../src/models/characters/CharacterTemplate.js"
import type { CustomSystemDefinition } from "../../../src/models/customSystems/CustomSystemDefinition.js"
import type { Spell } from "../../../src/models/magic/spells/Spell.js"
import {
  LEGACY_SESSION_BOOTSTRAP_ASSET_SOURCE,
  LEGACY_SESSION_BOOTSTRAP_ASSET_TYPE,
  parseLegacyCampaignBackup,
  type LegacyCampaignBackupV1,
  type LegacySessionBootstrapV1,
} from "../../../src/shared/legacy/legacyCampaignBackup.js"

const CREATION_META_TYPE = "CREATION_STATE"
const CREATION_META_SOURCE = "v1"
const MAX_CHARACTERS = 100
const MAX_SPELLS = 1_000
const MAX_CUSTOM_SYSTEMS = 200

type ImportedCharacter = {
  oldId: string
  newId: string
  character: CharacterTemplateProps
  visibility: CharacterVisibility
  legacyOwner?: CharacterTemplateProps["owner"]
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request)
    const body = await readJsonObject(request)
    const name = readCampaignName(body.name)
    const description = readDescription(body.description)

    let backup: LegacyCampaignBackupV1
    try {
      backup = parseLegacyCampaignBackup(body.backup)
    } catch (error) {
      throw new ApiError(
        400,
        "LEGACY_BACKUP_INVALID",
        error instanceof Error ? error.message : "Backup legacy inválido.",
      )
    }

    validateBackupSize(backup)

    const oldCharacterIds = backup.state.characters.map((character, index) => {
      const id = typeof character?.id === "string" ? character.id.trim() : ""
      if (!id) {
        throw new ApiError(
          400,
          "LEGACY_CHARACTER_ID_REQUIRED",
          `O personagem ${index + 1} do backup não possui um identificador válido.`,
        )
      }
      return id
    })
    ensureUnique(oldCharacterIds, "LEGACY_CHARACTER_ID_DUPLICATE", "O backup contém personagens com ids duplicados.")

    const idMap = new Map(oldCharacterIds.map((oldId) => [oldId, crypto.randomUUID()]))
    const importedCharacters = backup.state.characters.map((raw) =>
      prepareCharacter(raw, idMap, session.user.id, session.user.name),
    )
    const importedSpells = prepareSpells(backup.state.spells ?? [])
    const importedSystems = prepareCustomSystems(backup.customSystems)
    const bootstrap = prepareBootstrap(backup, idMap, importedCharacters)

    const campaign = await prisma.$transaction(async (tx) => {
      const createdCampaign = await tx.campaign.create({
        data: {
          name,
          description:
            description ||
            (backup.exportedAt
              ? `Importada de backup legacy exportado em ${backup.exportedAt}.`
              : "Importada de backup legacy."),
          inviteCode: createInviteCode(),
          ownerId: session.user.id,
        },
        select: {
          id: true,
          name: true,
          description: true,
          inviteCode: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      for (const entry of importedCharacters) {
        const itemSafeData = sanitizeCharacterItemData(
          entry.character as unknown as Prisma.InputJsonObject,
        )
        const data = sanitizeCharacterAcquisitionData(itemSafeData, {
          reason: "import",
          sourceType: "legacyImport",
          sourceName: "Importação de campanha legacy",
        })
        const domainPayloads = splitCharacterIntoDomains(
          data as unknown as CharacterTemplateProps,
        )

        await tx.character.create({
          data: {
            id: entry.newId,
            name: entry.character.name.slice(0, 120),
            data,
            visibility: entry.visibility,
            ownerId: session.user.id,
          },
        })

        const domainEntries = Object.entries(domainPayloads).map(
          ([domain, payload]) => ({
            characterId: entry.newId,
            domain: toPrismaDomain(domain),
            data: payload as Prisma.InputJsonObject,
            revision: 1,
            updatedById: session.user.id,
          }),
        )

        if (domainEntries.length) {
          await tx.characterDomainState.createMany({ data: domainEntries })
          await tx.characterDomainMutation.createMany({
            data: domainEntries.map((domain) => ({
              characterId: entry.newId,
              domain: domain.domain,
              previousRevision: 0,
              revision: 1,
              actorId: session.user.id,
              operation: "legacy-import",
            })),
          })
        }

        await tx.campaignCharacter.create({
          data: {
            campaignId: createdCampaign.id,
            characterId: entry.newId,
            visibility: entry.visibility,
          },
        })
      }

      const assets: Array<{
        id: string
        campaignId: string
        type: string
        sourceId: string
        name: string
        data: Prisma.InputJsonValue
        addedById: string
      }> = [
        ...importedSpells.map((spell) => ({
          id: crypto.randomUUID(),
          campaignId: createdCampaign.id,
          type: "SPELL",
          sourceId: spell.index,
          name: spell.name,
          data: spell as unknown as Prisma.InputJsonValue,
          addedById: session.user.id,
        })),
        ...importedSystems.map((system) => ({
          id: crypto.randomUUID(),
          campaignId: createdCampaign.id,
          type: "SYSTEM",
          sourceId: system.id,
          name: system.name,
          data: system as unknown as Prisma.InputJsonValue,
          addedById: session.user.id,
        })),
        {
          id: crypto.randomUUID(),
          campaignId: createdCampaign.id,
          type: LEGACY_SESSION_BOOTSTRAP_ASSET_TYPE,
          sourceId: LEGACY_SESSION_BOOTSTRAP_ASSET_SOURCE,
          name: "Legacy Session State v1",
          data: bootstrap as unknown as Prisma.InputJsonValue,
          addedById: session.user.id,
        },
        {
          id: crypto.randomUUID(),
          campaignId: createdCampaign.id,
          type: CREATION_META_TYPE,
          sourceId: CREATION_META_SOURCE,
          name: "Creation State v1",
          data: {
            spells: true,
            creatureCompendium: false,
            customSystems: true,
          },
          addedById: session.user.id,
        },
      ]

      if (assets.length) {
        await tx.campaignHomebrewAsset.createMany({ data: assets })
      }

      return createdCampaign
    })

    return jsonResponse(
      {
        campaign: {
          ...campaign,
          owner: { id: session.user.id, name: session.user.name },
          isOwner: true,
          role: CampaignRole.MASTER,
          status: CampaignMemberStatus.ACTIVE,
          characters: importedCharacters.map((entry) => ({
            id: entry.newId,
            name: entry.character.name,
            visibility: entry.visibility,
          })),
          pendingMembers: [],
          homebrew: {
            approved: 0,
            pending: 0,
            rejected: 0,
            revoked: 0,
          },
          homebrewSpells: [],
        },
        imported: {
          characters: importedCharacters.length,
          partyItems: bootstrap.partyInventory.length,
          groundItems: bootstrap.groundInventory.length,
          spells: importedSpells.length,
          customSystems: importedSystems.length,
          missions: bootstrap.missions.length,
          ownersReassignedToImporter: importedCharacters.filter(
            (entry) => entry.legacyOwner?.id && entry.legacyOwner.id !== session.user.id,
          ).length,
        },
      },
      201,
    )
  } catch (error) {
    return handleApiError(error)
  }
}

function prepareCharacter(
  raw: CharacterTemplateProps,
  idMap: ReadonlyMap<string, string>,
  ownerId: string,
  ownerName: string,
): ImportedCharacter {
  const oldId = raw.id.trim()
  const newId = idMap.get(oldId)
  if (!newId) {
    throw new ApiError(400, "LEGACY_CHARACTER_ID_INVALID", "Um personagem do backup possui id inválido.")
  }

  const remapped = remapExactStrings(raw, idMap) as CharacterTemplateProps
  remapped.id = newId
  remapped.owner = {
    id: ownerId,
    name: ownerName,
    role: "master",
  }

  let character: CharacterTemplate
  try {
    character = CharacterTemplate.fromJSON(remapped)
  } catch {
    throw new ApiError(
      400,
      "LEGACY_CHARACTER_INVALID",
      `O personagem “${typeof raw.name === "string" ? raw.name : oldId}” não pôde ser convertido.`,
    )
  }

  const normalized = character.toJSON()
  normalized.id = newId
  normalized.owner = remapped.owner

  return {
    oldId,
    newId,
    character: normalized,
    visibility: toDatabaseVisibility(normalized.visibility),
    legacyOwner: raw.owner,
  }
}

function prepareSpells(spells: Spell[]): Spell[] {
  const result = new Map<string, Spell>()
  for (const candidate of spells) {
    if (!candidate || typeof candidate !== "object") continue
    const index = typeof candidate.index === "string" ? candidate.index.trim() : ""
    const name =
      typeof candidate.name === "string"
        ? candidate.name.trim()
        : typeof candidate.displayName === "string"
          ? candidate.displayName.trim()
          : ""
    if (!index || !name) continue
    result.set(index, { ...candidate, index, name })
  }
  return [...result.values()]
}

function prepareCustomSystems(
  systems: CustomSystemDefinition[],
): CustomSystemDefinition[] {
  const result = new Map<string, CustomSystemDefinition>()
  for (const candidate of systems) {
    if (!candidate || typeof candidate !== "object") continue
    const id = typeof candidate.id === "string" ? candidate.id.trim() : ""
    const name = typeof candidate.name === "string" ? candidate.name.trim() : ""
    if (!id || !name) continue
    result.set(id, { ...candidate, id, name })
  }
  return [...result.values()]
}

function prepareBootstrap(
  backup: LegacyCampaignBackupV1,
  idMap: ReadonlyMap<string, string>,
  characters: ImportedCharacter[],
): LegacySessionBootstrapV1 {
  const remappedState = remapExactStrings(
    {
      partyInventory: backup.state.partyInventory ?? [],
      groundInventory: backup.state.groundInventory ?? [],
      missions: backup.state.missions ?? [],
    },
    idMap,
  ) as {
    partyInventory: LegacySessionBootstrapV1["partyInventory"]
    groundInventory: LegacySessionBootstrapV1["groundInventory"]
    missions: unknown[]
  }

  return {
    version: 1,
    importedAt: new Date().toISOString(),
    sourceExportedAt: backup.exportedAt,
    activeCharacterId:
      idMap.get(backup.state.activeCharacterId) ?? characters[0]?.newId ?? "",
    partyInventory: remappedState.partyInventory,
    groundInventory: remappedState.groundInventory,
    partyCarryCapacity: Math.max(0, Number(backup.state.partyCarryCapacity) || 0),
    partyAdditionalSupplyConsumption: Math.max(
      0,
      Number(backup.state.partyAdditionalSupplyConsumption) || 0,
    ),
    missions: remappedState.missions,
  }
}

function remapExactStrings(
  value: unknown,
  idMap: ReadonlyMap<string, string>,
): unknown {
  if (typeof value === "string") return idMap.get(value) ?? value
  if (Array.isArray(value)) return value.map((entry) => remapExactStrings(entry, idMap))
  if (!value || typeof value !== "object") return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      remapExactStrings(entry, idMap),
    ]),
  )
}

function validateBackupSize(backup: LegacyCampaignBackupV1): void {
  if (backup.state.characters.length > MAX_CHARACTERS) {
    throw new ApiError(400, "LEGACY_TOO_MANY_CHARACTERS", `O backup possui mais de ${MAX_CHARACTERS} personagens.`)
  }
  if ((backup.state.spells?.length ?? 0) > MAX_SPELLS) {
    throw new ApiError(400, "LEGACY_TOO_MANY_SPELLS", `O backup possui mais de ${MAX_SPELLS} magias.`)
  }
  if (backup.customSystems.length > MAX_CUSTOM_SYSTEMS) {
    throw new ApiError(400, "LEGACY_TOO_MANY_SYSTEMS", `O backup possui mais de ${MAX_CUSTOM_SYSTEMS} sistemas personalizados.`)
  }
}

function readCampaignName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : ""
  if (!name) throw new ApiError(400, "CAMPAIGN_NAME_REQUIRED", "Informe um nome para a campanha importada.")
  if (name.length > 120) throw new ApiError(400, "CAMPAIGN_NAME_TOO_LONG", "O nome da campanha pode ter no máximo 120 caracteres.")
  return name
}

function readDescription(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 2_000) : ""
}

function ensureUnique(values: string[], code: string, message: string): void {
  if (new Set(values).size !== values.length) throw new ApiError(400, code, message)
}

function toDatabaseVisibility(value: unknown): CharacterVisibility {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "PARTY"
  if (normalized === CharacterVisibility.PRIVATE) return CharacterVisibility.PRIVATE
  if (normalized === CharacterVisibility.MASTER) return CharacterVisibility.MASTER
  return CharacterVisibility.PARTY
}

function toPrismaDomain(value: string): CharacterDataDomain {
  const normalized = value.toUpperCase()
  if (Object.values(CharacterDataDomain).includes(normalized as CharacterDataDomain)) {
    return normalized as CharacterDataDomain
  }
  throw new Error(`Domínio de personagem desconhecido: ${value}`)
}

function createInviteCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()
}

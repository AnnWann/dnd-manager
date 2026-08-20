import {
  CampaignMemberStatus,
  CampaignRole,
  CampaignSpellApprovalStatus,
  CharacterVisibility,
  HomebrewSpellStatus,
} from "../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../server/api"
import { prisma } from "../../../server/prisma"
import { requireSession } from "../../../server/session"
import type {
  CreationCharacterConfiguration,
  CreationCharacterCustomSystemConfiguration,
  CreationItemCompendiumEntry,
  CreationState,
} from "../../../src/shared/creation/creation.types"
import type { CustomSystemDefinition } from "../../../src/models/customSystems/CustomSystemDefinition"
import type { Itemmable } from "../../../src/models/items/item"
import type { Spell } from "../../../src/models/magic/spells/Spell"

type RouteContext = {
  params?:
    | Promise<{ campaignId?: string }>
    | { campaignId?: string }
}

type JsonRecord = Record<string, unknown>

export async function GET(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const campaignId = await resolveCampaignId(request, context)
    await requireCreationMaster(campaignId, session.user.id)
    return jsonResponse(await buildCreationSnapshot(campaignId))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const campaignId = await resolveCampaignId(request, context)
    await requireCreationMaster(campaignId, session.user.id)

    const body = await readJsonObject(request)
    const baseRevision = readRevision(body.baseRevision)
    const data = readCreationState(body.data)

    await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.findUnique({
        where: { id: campaignId },
        select: {
          ownerId: true,
          creationRevision: true,
          members: {
            where: { status: CampaignMemberStatus.ACTIVE },
            select: { userId: true },
          },
          characters: {
            select: {
              characterId: true,
              character: {
                select: {
                  data: true,
                },
              },
            },
          },
        },
      })

      if (!campaign) {
        throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.")
      }

      if (campaign.creationRevision !== baseRevision) {
        throw new ApiError(
          409,
          "CREATION_REVISION_CONFLICT",
          "A Criação foi alterada desde que esta edição foi iniciada.",
        )
      }

      const incomingCharacters = data.characters
        .map(readCreationCharacterConfiguration)
        .sort((left, right) => left.characterId.localeCompare(right.characterId))
      const currentCharacterIds = campaign.characters
        .map((link) => link.characterId)
        .sort((left, right) => left.localeCompare(right))

      if (
        incomingCharacters.length !== currentCharacterIds.length ||
        incomingCharacters.some(
          (character, index) => character.characterId !== currentCharacterIds[index],
        )
      ) {
        throw new ApiError(
          400,
          "CREATION_CHARACTER_SET_CHANGED",
          "A lista de personagens mudou. Recarregue a Criação antes de salvar.",
        )
      }

      const allowedOwnerIds = new Set([
        campaign.ownerId,
        ...campaign.members.map((member) => member.userId),
      ])
      const characterDataById = new Map(
        campaign.characters.map((link) => [link.characterId, link.character.data]),
      )

      for (const configuration of incomingCharacters) {
        if (!allowedOwnerIds.has(configuration.ownerId)) {
          throw new ApiError(
            400,
            "CREATION_CHARACTER_OWNER_INVALID",
            "O jogador atribuído precisa ser membro ativo da campanha.",
          )
        }

        const currentData = characterDataById.get(configuration.characterId)
        if (currentData === undefined) {
          throw new ApiError(
            400,
            "CREATION_CHARACTER_NOT_FOUND",
            "Um personagem da Criação não pertence mais à campanha.",
          )
        }

        await tx.character.update({
          where: { id: configuration.characterId },
          data: {
            ownerId: configuration.ownerId,
            data: mergeCharacterCreationConfiguration(
              currentData,
              configuration,
            ) as never,
          },
        })

        await tx.campaignCharacter.update({
          where: {
            campaignId_characterId: {
              campaignId,
              characterId: configuration.characterId,
            },
          },
          data: {
            visibility: toDatabaseVisibility(configuration.visibility),
          },
        })
      }

      const itemEntries = data.itemCompendium.map(readCreationItemEntry)
      const templateIds = itemEntries.map((entry) => entry.templateId)
      if (new Set(templateIds).size !== templateIds.length) {
        throw new ApiError(
          400,
          "CREATION_ITEM_DUPLICATE",
          "O compêndio contém ids de item duplicados.",
        )
      }

      await tx.campaignItemCompendium.deleteMany({
        where: {
          campaignId,
          ...(templateIds.length
            ? { templateId: { notIn: templateIds } }
            : {}),
        },
      })

      for (const entry of itemEntries) {
        await tx.campaignItemCompendium.upsert({
          where: {
            campaignId_templateId: {
              campaignId,
              templateId: entry.templateId,
            },
          },
          create: {
            id: crypto.randomUUID(),
            campaignId,
            templateId: entry.templateId,
            item: entry.item as never,
            custom: entry.custom,
            visibility: entry.visibility,
            createdById: session.user.id,
          },
          update: {
            item: entry.item as never,
            custom: entry.custom,
            visibility: entry.visibility,
            createdById: session.user.id,
          },
        })
      }

      const revisionUpdate = await tx.campaign.updateMany({
        where: {
          id: campaignId,
          creationRevision: baseRevision,
        },
        data: {
          creationRevision: { increment: 1 },
        },
      })

      if (revisionUpdate.count !== 1) {
        throw new ApiError(
          409,
          "CREATION_REVISION_CONFLICT",
          "A Criação foi alterada desde que esta edição foi iniciada.",
        )
      }
    })

    return jsonResponse(await buildCreationSnapshot(campaignId))
  } catch (error) {
    return handleApiError(error)
  }
}

async function requireCreationMaster(
  campaignId: string,
  userId: string,
): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      ownerId: true,
      members: {
        where: {
          userId,
          status: CampaignMemberStatus.ACTIVE,
        },
        select: { role: true },
      },
    },
  })

  if (!campaign) {
    throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.")
  }

  const isMaster =
    campaign.ownerId === userId ||
    campaign.members.some((member) => member.role === CampaignRole.MASTER)

  if (!isMaster) {
    throw new ApiError(
      403,
      "CREATION_ACCESS_FORBIDDEN",
      "Somente o mestre pode acessar o estado de Criação da sessão.",
    )
  }
}

async function buildCreationSnapshot(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      creationRevision: true,
      updatedAt: true,
    },
  })

  if (!campaign) {
    throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.")
  }

  const [characterLinks, spellLinks, itemRows, systemRows] = await Promise.all([
    prisma.campaignCharacter.findMany({
      where: { campaignId },
      select: {
        visibility: true,
        character: {
          select: {
            id: true,
            data: true,
            ownerId: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { addedAt: "asc" },
    }),
    prisma.campaignHomebrewSpell.findMany({
      where: {
        campaignId,
        status: CampaignSpellApprovalStatus.APPROVED,
        spell: { status: HomebrewSpellStatus.ACTIVE },
      },
      select: {
        spell: {
          select: {
            data: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.campaignItemCompendium.findMany({
      where: { campaignId },
      select: {
        templateId: true,
        item: true,
        custom: true,
        visibility: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.campaignHomebrewAsset.findMany({
      where: {
        campaignId,
        type: "SYSTEM",
      },
      select: {
        data: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ])

  let updatedAt = campaign.updatedAt

  const characters = characterLinks.map((link) => {
    updatedAt = laterDate(updatedAt, link.character.updatedAt)
    return toCreationCharacter(
      link.character.id,
      link.character.ownerId,
      link.visibility,
      link.character.data,
    )
  })

  const spells = spellLinks.map((link) => {
    updatedAt = laterDate(updatedAt, link.spell.updatedAt)
    return link.spell.data as unknown as Spell
  })

  const itemCompendium: CreationItemCompendiumEntry[] = itemRows.map((entry) => {
    updatedAt = laterDate(updatedAt, entry.updatedAt)
    return {
      templateId: entry.templateId,
      item: entry.item as unknown as Itemmable,
      custom: entry.custom,
      visibility: entry.visibility === "MASTER" ? "MASTER" : "PUBLIC",
    }
  })

  const customSystems = systemRows.map((entry) => {
    updatedAt = laterDate(updatedAt, entry.updatedAt)
    return entry.data as unknown as CustomSystemDefinition
  })

  const data: CreationState = {
    version: 1,
    characters,
    spells,
    itemCompendium,
    // The creature compendium still uses its legacy local repository. It
    // joins this snapshot when that persistence is migrated.
    creatureCompendium: [],
    customSystems,
  }

  return {
    revision: Math.max(1, campaign.creationRevision),
    updatedAt: updatedAt.toISOString(),
    data,
  }
}

function readRevision(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new ApiError(
      400,
      "CREATION_REVISION_INVALID",
      "A revisão base da Criação é inválida.",
    )
  }
  return Number(value)
}

function readCreationState(value: unknown): CreationState {
  const state = asRecord(value)
  if (
    !state ||
    state.version !== 1 ||
    !Array.isArray(state.characters) ||
    !Array.isArray(state.spells) ||
    !Array.isArray(state.itemCompendium) ||
    !Array.isArray(state.creatureCompendium) ||
    !Array.isArray(state.customSystems)
  ) {
    throw new ApiError(
      400,
      "CREATION_STATE_INVALID",
      "O estado de Criação é inválido.",
    )
  }
  return state as unknown as CreationState
}

function readCreationCharacterConfiguration(
  value: unknown,
): CreationCharacterConfiguration {
  const configuration = asRecord(value)
  if (!configuration) {
    throw new ApiError(400, "CREATION_CHARACTER_INVALID", "Configuração de personagem inválida.")
  }

  const characterId = readRequiredString(configuration.characterId)
  const ownerId = readRequiredString(configuration.ownerId)
  const type = readRequiredString(configuration.type)
  const visibility = configuration.visibility
  if (
    visibility !== "private" &&
    visibility !== "party" &&
    visibility !== "master"
  ) {
    throw new ApiError(400, "CREATION_VISIBILITY_INVALID", "Visibilidade de personagem inválida.")
  }

  const customSystems = Array.isArray(configuration.customSystems)
    ? configuration.customSystems
        .map(toCustomSystemConfiguration)
        .filter(
          (entry): entry is CreationCharacterCustomSystemConfiguration => Boolean(entry),
        )
    : []

  return {
    characterId,
    ownerId,
    type: type as CreationCharacterConfiguration["type"],
    visibility,
    unique: configuration.unique === true,
    hiddenCharacterTabs: Array.isArray(configuration.hiddenCharacterTabs)
      ? configuration.hiddenCharacterTabs.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
    customSystems,
  }
}

function readCreationItemEntry(value: unknown): CreationItemCompendiumEntry {
  const entry = asRecord(value)
  if (!entry) {
    throw new ApiError(400, "CREATION_ITEM_INVALID", "Item do compêndio inválido.")
  }

  const templateId = readRequiredString(entry.templateId)
  const item = asRecord(entry.item)
  if (!item || readRequiredString(item.id) !== templateId) {
    throw new ApiError(
      400,
      "CREATION_ITEM_ID_INVALID",
      "O id do item precisa corresponder ao id do template.",
    )
  }
  readRequiredString(item.name)

  return {
    templateId,
    item: item as unknown as Itemmable,
    custom: entry.custom === true,
    visibility: entry.visibility === "MASTER" ? "MASTER" : "PUBLIC",
  }
}

function mergeCharacterCreationConfiguration(
  rawData: unknown,
  configuration: CreationCharacterConfiguration,
): JsonRecord {
  const data = asRecord(rawData) ?? {}
  const sheet = asRecord(data.sheet) ?? {}
  const owner = asRecord(data.owner) ?? {}
  const currentSystems = Array.isArray(sheet.customSystems)
    ? sheet.customSystems
    : []
  const configuredSystems = new Map(
    configuration.customSystems.map((state) => [state.systemId, state]),
  )

  const mergedSystems = currentSystems.map((value) => {
    const current = asRecord(value)
    if (!current || typeof current.systemId !== "string") return value
    const configured = configuredSystems.get(current.systemId)
    if (!configured) return value
    configuredSystems.delete(current.systemId)
    return {
      ...current,
      systemVersion: configured.systemVersion,
      enabled: configured.enabled,
      abilityAcquisitionExceptions: configured.abilityAcquisitionExceptions,
      installationSource: configured.installationSource,
    }
  })

  for (const configured of configuredSystems.values()) {
    mergedSystems.push(configured)
  }

  return {
    ...data,
    unique: configuration.unique,
    owner: {
      ...owner,
      id: configuration.ownerId,
    },
    sheet: {
      ...sheet,
      type: configuration.type,
      hiddenCharacterTabs: configuration.hiddenCharacterTabs,
      customSystems: mergedSystems,
    },
  }
}

function toCreationCharacter(
  characterId: string,
  ownerId: string,
  visibility: CharacterVisibility,
  rawData: unknown,
): CreationCharacterConfiguration {
  const data = asRecord(rawData) ?? {}
  const sheet = asRecord(data.sheet) ?? {}
  const customSystems = Array.isArray(sheet.customSystems)
    ? sheet.customSystems
        .map(toCustomSystemConfiguration)
        .filter(
          (
            entry,
          ): entry is CreationCharacterCustomSystemConfiguration => Boolean(entry),
        )
    : []

  return {
    characterId,
    type:
      typeof sheet.type === "string"
        ? sheet.type as CreationCharacterConfiguration["type"]
        : "pc",
    visibility: toCreationVisibility(visibility),
    unique: typeof data.unique === "boolean" ? data.unique : false,
    ownerId,
    hiddenCharacterTabs: Array.isArray(sheet.hiddenCharacterTabs)
      ? sheet.hiddenCharacterTabs.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
    customSystems,
  }
}

function toCustomSystemConfiguration(
  value: unknown,
): CreationCharacterCustomSystemConfiguration | null {
  const state = asRecord(value)
  if (!state || typeof state.systemId !== "string") return null

  const configuration: CreationCharacterCustomSystemConfiguration = {
    systemId: state.systemId,
    systemVersion:
      typeof state.systemVersion === "number" ? state.systemVersion : 1,
    enabled: state.enabled !== false,
  }

  if (
    state.abilityAcquisitionExceptions &&
    typeof state.abilityAcquisitionExceptions === "object" &&
    !Array.isArray(state.abilityAcquisitionExceptions)
  ) {
    configuration.abilityAcquisitionExceptions =
      state.abilityAcquisitionExceptions as CreationCharacterCustomSystemConfiguration["abilityAcquisitionExceptions"]
  }

  if (
    state.installationSource === "master" ||
    state.installationSource === "automatic"
  ) {
    configuration.installationSource = state.installationSource
  }

  return configuration
}

function toCreationVisibility(
  value: CharacterVisibility,
): CreationCharacterConfiguration["visibility"] {
  if (value === CharacterVisibility.PRIVATE) return "private"
  if (value === CharacterVisibility.MASTER) return "master"
  return "party"
}

function toDatabaseVisibility(
  value: CreationCharacterConfiguration["visibility"],
): CharacterVisibility {
  if (value === "private") return CharacterVisibility.PRIVATE
  if (value === "master") return CharacterVisibility.MASTER
  return CharacterVisibility.PARTY
}

function readRequiredString(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : ""
  if (!normalized) {
    throw new ApiError(400, "CREATION_FIELD_REQUIRED", "Um campo obrigatório da Criação está vazio.")
  }
  return normalized
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function laterDate(left: Date, right: Date): Date {
  return right > left ? right : left
}

async function resolveCampaignId(
  request: Request,
  context?: RouteContext,
): Promise<string> {
  const params = context?.params ? await context.params : undefined
  const fromContext = params?.campaignId?.trim()
  if (fromContext) return fromContext

  const match = new URL(request.url).pathname.match(/\/api\/campaigns\/([^/]+)/)
  if (match?.[1]) return decodeURIComponent(match[1])

  throw new ApiError(
    400,
    "CAMPAIGN_ID_REQUIRED",
    "O identificador da campanha não foi informado.",
  )
}

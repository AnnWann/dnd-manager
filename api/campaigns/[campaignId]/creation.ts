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

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        ownerId: true,
        creationRevision: true,
        updatedAt: true,
        members: {
          where: {
            userId: session.user.id,
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
      campaign.ownerId === session.user.id ||
      campaign.members.some((member) => member.role === CampaignRole.MASTER)

    if (!isMaster) {
      throw new ApiError(
        403,
        "CREATION_ACCESS_FORBIDDEN",
        "Somente o mestre pode acessar o estado de Criação da sessão.",
      )
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

    return jsonResponse({
      revision: Math.max(1, campaign.creationRevision),
      updatedAt: updatedAt.toISOString(),
      data,
    })
  } catch (error) {
    return handleApiError(error)
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

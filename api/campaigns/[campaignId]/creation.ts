import {
  CampaignMemberStatus,
  CampaignRole,
  CampaignSpellApprovalStatus,
  HomebrewSpellStatus,
} from "../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
} from "../../../server/api"
import { prisma } from "../../../server/prisma"
import { requireSession } from "../../../server/session"

type RouteContext = {
  params?:
    | Promise<{ campaignId?: string }>
    | { campaignId?: string }
}

type JsonRecord = Record<string, unknown>

type CreationRevisionRow = {
  creationRevision: number
}

type RawItemCompendiumEntry = {
  templateId: string
  item: unknown
  custom: boolean
  visibility: string
  updatedAt: Date
}

type RawSystemAsset = {
  data: unknown
  updatedAt: Date
}

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

    const [revisionRows, characterLinks, spellLinks, itemRows, systemRows] =
      await Promise.all([
        prisma.$queryRaw<CreationRevisionRow[]>`
          SELECT "creationRevision"
          FROM "campaign"
          WHERE "id" = ${campaignId}
        `,
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
        prisma.$queryRaw<RawItemCompendiumEntry[]>`
          SELECT
            "templateId",
            "item",
            "custom",
            "visibility",
            "updatedAt"
          FROM "campaign_item_compendium"
          WHERE "campaignId" = ${campaignId}
          ORDER BY "createdAt" ASC
        `,
        prisma.$queryRaw<RawSystemAsset[]>`
          SELECT "data", "updatedAt"
          FROM "campaign_homebrew_asset"
          WHERE "campaignId" = ${campaignId}
            AND "type" = 'SYSTEM'
          ORDER BY "createdAt" ASC
        `,
      ])

    const updatedAtCandidates: Date[] = [campaign.updatedAt]

    const characters = characterLinks.map((link) => {
      updatedAtCandidates.push(link.character.updatedAt)
      return toCreationCharacter(
        link.character.id,
        link.character.ownerId,
        link.visibility,
        link.character.data,
      )
    })

    const spells = spellLinks
      .map((link) => {
        updatedAtCandidates.push(link.spell.updatedAt)
        return asRecord(link.spell.data)
      })
      .filter((spell): spell is JsonRecord => Boolean(spell))

    const itemCompendium = itemRows.map((entry) => {
      updatedAtCandidates.push(entry.updatedAt)
      return {
        templateId: entry.templateId,
        item: entry.item ?? null,
        custom: entry.custom,
        visibility: entry.visibility === "MASTER" ? "MASTER" : "PUBLIC",
      }
    })

    const customSystems = systemRows
      .map((entry) => {
        updatedAtCandidates.push(entry.updatedAt)
        return asRecord(entry.data)
      })
      .filter((definition): definition is JsonRecord => Boolean(definition))

    const updatedAt = updatedAtCandidates.reduce(
      (latest, candidate) => candidate > latest ? candidate : latest,
      updatedAtCandidates[0],
    )

    return jsonResponse({
      revision: Math.max(1, Number(revisionRows[0]?.creationRevision) || 1),
      updatedAt: updatedAt.toISOString(),
      data: {
        version: 1,
        characters,
        spells,
        itemCompendium,
        // The creature compendium still uses its legacy local repository. It
        // joins this snapshot when that persistence is migrated.
        creatureCompendium: [],
        customSystems,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function toCreationCharacter(
  characterId: string,
  ownerId: string,
  visibility: string,
  rawData: unknown,
) {
  const data = asRecord(rawData) ?? {}
  const sheet = asRecord(data.sheet) ?? {}
  const customSystems = Array.isArray(sheet.customSystems)
    ? sheet.customSystems.map(toCustomSystemConfiguration).filter(Boolean)
    : []

  return {
    characterId,
    type: typeof sheet.type === "string" ? sheet.type : "pc",
    visibility: toCreationVisibility(visibility),
    unique: typeof data.unique === "boolean" ? data.unique : false,
    ownerId,
    hiddenCharacterTabs: Array.isArray(sheet.hiddenCharacterTabs)
      ? sheet.hiddenCharacterTabs.filter((entry): entry is string => typeof entry === "string")
      : [],
    customSystems,
  }
}

function toCustomSystemConfiguration(value: unknown) {
  const state = asRecord(value)
  if (!state || typeof state.systemId !== "string") return null

  const configuration: JsonRecord = {
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
    configuration.abilityAcquisitionExceptions = state.abilityAcquisitionExceptions
  }

  if (
    state.installationSource === "master" ||
    state.installationSource === "automatic"
  ) {
    configuration.installationSource = state.installationSource
  }

  return configuration
}

function toCreationVisibility(value: string): "private" | "party" | "master" {
  if (value === "PRIVATE") return "private"
  if (value === "MASTER") return "master"
  return "party"
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null
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

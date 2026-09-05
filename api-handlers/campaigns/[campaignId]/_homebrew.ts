import {
  CampaignSpellApprovalStatus,
  HomebrewSpellStatus,
} from "../../../generated/prisma/client.js"
import {
  ApiError,
  handleApiError,
  jsonResponse,
} from "../../../server/api.js"
import {
  accessCanManageCreationSection,
  getCampaignAccess,
} from "../../../server/campaign-capabilities.js"
import { prisma } from "../../../server/prisma.js"
import { requireSession } from "../../../server/session.js"

type RouteContext = {
  params?:
    | Promise<{
        campaignId?: string
      }>
    | {
        campaignId?: string
      }
}

type RawHomebrewAsset = {
  id: string
  type: "SYSTEM" | "CLASS" | "OTHER"
  sourceId: string
  name: string
  data: unknown
  addedById: string
  addedByName: string
  createdAt: Date
  updatedAt: Date
}

export async function GET(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const campaignId = await resolveCampaignId(request, context)
    const access = await getCampaignAccess(campaignId, session.user.id)

    if (!access) {
      throw new ApiError(
        403,
        "CAMPAIGN_ACCESS_DENIED",
        "Você precisa ser membro ativo desta sessão.",
      )
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, name: true },
    })
    if (!campaign) {
      throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.")
    }

    const canManageContent = accessCanManageCreationSection(
      access,
      "homebrew",
    )

    const [links, assets] = await Promise.all([
      prisma.campaignHomebrewSpell.findMany({
        where: {
          campaignId,
          spell: {
            status: HomebrewSpellStatus.ACTIVE,
          },
          ...(canManageContent
            ? {}
            : {
                OR: [
                  { status: CampaignSpellApprovalStatus.APPROVED },
                  { submittedById: session.user.id },
                ],
              }),
        },
        select: {
          id: true,
          status: true,
          note: true,
          submittedAt: true,
          reviewedAt: true,
          submittedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          spell: {
            select: {
              id: true,
              index: true,
              name: true,
              data: true,
              owner: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          submittedAt: "desc",
        },
      }),
      prisma.$queryRaw<RawHomebrewAsset[]>`
        SELECT
          asset."id",
          asset."type",
          asset."sourceId",
          asset."name",
          asset."data",
          asset."addedById",
          added_by."name" AS "addedByName",
          asset."createdAt",
          asset."updatedAt"
        FROM "campaign_homebrew_asset" AS asset
        JOIN "user" AS added_by ON added_by."id" = asset."addedById"
        WHERE asset."campaignId" = ${campaignId}
        ORDER BY asset."updatedAt" DESC
      `,
    ])

    return jsonResponse({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        isMaster: access.isOwner,
        canManageContent,
      },
      spells: links.map((link) => ({
        linkId: link.id,
        status: link.status,
        note: link.note,
        submittedAt: link.submittedAt,
        reviewedAt: link.reviewedAt,
        submittedBy: link.submittedBy,
        reviewedBy: link.reviewedBy,
        id: link.spell.id,
        index: link.spell.index,
        name: link.spell.name,
        data: link.spell.data,
        author: link.spell.owner,
      })),
      assets: assets.map((asset) => ({
        id: asset.id,
        type: asset.type,
        sourceId: asset.sourceId,
        name: asset.name,
        data: asset.data,
        addedBy: {
          id: asset.addedById,
          name: asset.addedByName,
        },
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
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

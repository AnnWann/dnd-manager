import {
  CampaignMemberStatus,
  CampaignRole,
  CampaignSpellApprovalStatus,
} from "../../../../generated/prisma/client.js"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../../server/api.js"
import { prisma } from "../../../../server/prisma.js"
import { requireSession } from "../../../../server/session.js"

type RouteContext = {
  params?:
    | Promise<{
        campaignId?: string
        spellId?: string
      }>
    | {
        campaignId?: string
        spellId?: string
      }
}

export async function PATCH(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId, spellId } = await resolveRouteParams(request, context)
    const body = await readJsonObject(request)
    const status = parseReviewStatus(body.status)
    const note =
      typeof body.note === "string"
        ? body.note.trim().slice(0, 1000) || null
        : null

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        OR: [
          { ownerId: session.user.id },
          {
            members: {
              some: {
                userId: session.user.id,
                role: CampaignRole.MASTER,
                status: CampaignMemberStatus.ACTIVE,
              },
            },
          },
        ],
      },
      select: { id: true },
    })

    if (!campaign) {
      throw new ApiError(
        403,
        "CAMPAIGN_SPELL_REVIEW_FORBIDDEN",
        "Somente um mestre ativo da campanha pode revisar magias homebrew.",
      )
    }

    const existing = await prisma.campaignHomebrewSpell.findUnique({
      where: {
        campaignId_spellId: {
          campaignId,
          spellId,
        },
      },
      select: { id: true },
    })

    if (!existing) {
      throw new ApiError(
        404,
        "CAMPAIGN_SPELL_SUBMISSION_NOT_FOUND",
        "Solicitação de magia homebrew não encontrada.",
      )
    }

    const link = await prisma.campaignHomebrewSpell.update({
      where: { id: existing.id },
      data: {
        status,
        note,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    })

    return jsonResponse({ link })
  } catch (error) {
    return handleApiError(error)
  }
}

function parseReviewStatus(
  value: unknown,
): CampaignSpellApprovalStatus {
  const normalized =
    typeof value === "string"
      ? value.trim().toUpperCase()
      : ""

  if (normalized === CampaignSpellApprovalStatus.APPROVED) {
    return CampaignSpellApprovalStatus.APPROVED
  }

  if (normalized === CampaignSpellApprovalStatus.REJECTED) {
    return CampaignSpellApprovalStatus.REJECTED
  }

  if (normalized === CampaignSpellApprovalStatus.REVOKED) {
    return CampaignSpellApprovalStatus.REVOKED
  }

  throw new ApiError(
    400,
    "INVALID_CAMPAIGN_SPELL_STATUS",
    "O status precisa ser APPROVED, REJECTED ou REVOKED.",
  )
}

async function resolveRouteParams(
  request: Request,
  context?: RouteContext,
): Promise<{ campaignId: string; spellId: string }> {
  const params = context?.params ? await context.params : undefined
  const fromContextCampaignId = params?.campaignId?.trim()
  const fromContextSpellId = params?.spellId?.trim()
  if (fromContextCampaignId && fromContextSpellId) {
    return {
      campaignId: fromContextCampaignId,
      spellId: fromContextSpellId,
    }
  }

  const match = new URL(request.url).pathname.match(
    /\/api\/campaigns\/([^/]+)\/spells\/([^/]+)/,
  )
  if (match?.[1] && match?.[2]) {
    return {
      campaignId: decodeURIComponent(match[1]),
      spellId: decodeURIComponent(match[2]),
    }
  }

  throw new ApiError(
    400,
    "SPELL_ROUTE_PARAMS_REQUIRED",
    "Os identificadores da campanha e da magia não foram informados.",
  )
}

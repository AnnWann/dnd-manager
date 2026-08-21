import {
  CampaignMemberStatus,
} from "../../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
} from "../../../../server/api"
import { prisma } from "../../../../server/prisma"
import { requireSession } from "../../../../server/session"

type RouteContext = {
  params?:
    | Promise<{
        campaignId?: string
      }>
    | {
        campaignId?: string
      }
}

export async function DELETE(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const campaignId = await resolveCampaignId(request, context)

    const campaign = await prisma.campaign.findUnique({
      where: {
        id: campaignId,
      },
      select: {
        ownerId: true,
      },
    })

    if (!campaign) {
      throw new ApiError(
        404,
        "CAMPAIGN_NOT_FOUND",
        "Campanha não encontrada.",
      )
    }

    if (campaign.ownerId === session.user.id) {
      throw new ApiError(
        409,
        "OWNER_CANNOT_LEAVE",
        "O mestre não pode sair da própria campanha.",
      )
    }

    await prisma.$transaction([
      prisma.campaignCharacter.deleteMany({
        where: {
          campaignId,
          character: {
            ownerId: session.user.id,
          },
        },
      }),
      prisma.campaignMember.updateMany({
        where: {
          campaignId,
          userId: session.user.id,
        },
        data: {
          status: CampaignMemberStatus.REMOVED,
        },
      }),
    ])

    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}

async function resolveCampaignId(
  request: Request,
  context?: RouteContext,
): Promise<string> {
  const params = context?.params ? await context.params : undefined
  const campaignId = params?.campaignId?.trim()
  if (campaignId) return campaignId

  const match = new URL(request.url).pathname.match(
    /\/api\/me\/campaigns\/([^/]+)\/membership/,
  )
  if (match?.[1]) return decodeURIComponent(match[1])

  throw new ApiError(
    400,
    "CAMPAIGN_ID_REQUIRED",
    "O identificador da campanha não foi informado.",
  )
}

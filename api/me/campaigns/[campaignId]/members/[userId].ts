import {
  CampaignMemberStatus,
  CampaignRole,
} from "../../../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../../../server/api"
import { prisma } from "../../../../../server/prisma"
import { requireSession } from "../../../../../server/session"

type RouteContext = {
  params: Promise<{
    campaignId: string
    userId: string
  }>
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId, userId } = await context.params
    const body = await readJsonObject(request)

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        ownerId: session.user.id,
      },
      select: {
        id: true,
      },
    })

    if (!campaign) {
      throw new ApiError(
        403,
        "MASTER_REQUIRED",
        "Somente o mestre da campanha pode revisar membros.",
      )
    }

    const status = parseStatus(body.status)
    const role = parseRole(body.role)

    const updated = await prisma.campaignMember.updateMany({
      where: {
        campaignId,
        userId,
      },
      data: {
        status,
        ...(role ? { role } : {}),
      },
    })

    if (!updated.count) {
      throw new ApiError(
        404,
        "MEMBERSHIP_NOT_FOUND",
        "Solicitação de participação não encontrada.",
      )
    }

    if (status === CampaignMemberStatus.REMOVED) {
      await prisma.campaignCharacter.deleteMany({
        where: {
          campaignId,
          character: {
            ownerId: userId,
          },
        },
      })
    }

    return jsonResponse({
      member: {
        userId,
        status,
        role: role ?? CampaignRole.PLAYER,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function parseStatus(value: unknown): CampaignMemberStatus {
  if (value === CampaignMemberStatus.ACTIVE) {
    return CampaignMemberStatus.ACTIVE
  }
  if (value === CampaignMemberStatus.REMOVED) {
    return CampaignMemberStatus.REMOVED
  }

  throw new ApiError(
    400,
    "INVALID_MEMBER_STATUS",
    "O status precisa ser ACTIVE ou REMOVED.",
  )
}

function parseRole(value: unknown): CampaignRole | undefined {
  if (value === undefined) return undefined
  if (value === CampaignRole.PLAYER) return CampaignRole.PLAYER
  if (value === CampaignRole.MASTER) return CampaignRole.MASTER

  throw new ApiError(
    400,
    "INVALID_MEMBER_ROLE",
    "O papel precisa ser PLAYER ou MASTER.",
  )
}

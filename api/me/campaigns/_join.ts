import {
  CampaignMemberStatus,
  CampaignRole,
} from "../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../server/api"
import { prisma } from "../../../server/prisma"
import { requireSession } from "../../../server/session"

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request)
    const body = await readJsonObject(request)
    const inviteCode =
      typeof body.inviteCode === "string"
        ? body.inviteCode.trim().toUpperCase()
        : ""

    if (!inviteCode) {
      throw new ApiError(
        400,
        "INVITE_CODE_REQUIRED",
        "Informe o código de convite.",
      )
    }

    const campaign = await prisma.campaign.findUnique({
      where: {
        inviteCode,
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
      },
    })

    if (!campaign) {
      throw new ApiError(
        404,
        "CAMPAIGN_NOT_FOUND",
        "Nenhuma campanha foi encontrada com esse código.",
      )
    }

    if (campaign.ownerId === session.user.id) {
      throw new ApiError(
        409,
        "CAMPAIGN_ALREADY_OWNED",
        "Você já é o mestre desta campanha.",
      )
    }

    const membership = await prisma.campaignMember.upsert({
      where: {
        campaignId_userId: {
          campaignId: campaign.id,
          userId: session.user.id,
        },
      },
      update: {
        status: CampaignMemberStatus.INVITED,
        role: CampaignRole.PLAYER,
      },
      create: {
        campaignId: campaign.id,
        userId: session.user.id,
        status: CampaignMemberStatus.INVITED,
        role: CampaignRole.PLAYER,
      },
      select: {
        status: true,
        role: true,
      },
    })

    return jsonResponse({
      request: {
        campaignId: campaign.id,
        campaignName: campaign.name,
        status: membership.status,
        role: membership.role,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

import {
  CampaignMemberStatus,
  CampaignRole,
  CampaignSpellApprovalStatus,
  HomebrewSpellStatus,
} from "../../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../../server/api"
import { prisma } from "../../../../server/prisma"
import { requireSession } from "../../../../server/session"

type RouteContext = {
  params: Promise<{
    spellId: string
  }>
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { spellId } = await context.params
    const body = await readJsonObject(request)
    const campaignId =
      typeof body.campaignId === "string"
        ? body.campaignId.trim()
        : ""

    if (!campaignId) {
      throw new ApiError(
        400,
        "CAMPAIGN_ID_REQUIRED",
        "A campanha é obrigatória.",
      )
    }

    const spell = await prisma.homebrewSpell.findFirst({
      where: {
        id: spellId,
        ownerId: session.user.id,
        status: HomebrewSpellStatus.ACTIVE,
      },
      select: { id: true },
    })

    if (!spell) {
      throw new ApiError(
        404,
        "SPELL_NOT_FOUND",
        "Magia não encontrada ou não pertence ao usuário.",
      )
    }

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        OR: [
          { ownerId: session.user.id },
          {
            members: {
              some: {
                userId: session.user.id,
                status: CampaignMemberStatus.ACTIVE,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        ownerId: true,
        members: {
          where: {
            userId: session.user.id,
            status: CampaignMemberStatus.ACTIVE,
          },
          select: {
            role: true,
          },
        },
      },
    })

    if (!campaign) {
      throw new ApiError(
        404,
        "CAMPAIGN_NOT_FOUND",
        "Campanha não encontrada ou usuário sem acesso.",
      )
    }

    const isMaster =
      campaign.ownerId === session.user.id ||
      campaign.members.some(
        (membership) => membership.role === CampaignRole.MASTER,
      )
    const status = isMaster
      ? CampaignSpellApprovalStatus.APPROVED
      : CampaignSpellApprovalStatus.PENDING
    const reviewedAt = isMaster ? new Date() : null
    const reviewedById = isMaster ? session.user.id : null

    const link = await prisma.campaignHomebrewSpell.upsert({
      where: {
        campaignId_spellId: {
          campaignId,
          spellId,
        },
      },
      create: {
        campaignId,
        spellId,
        submittedById: session.user.id,
        status,
        reviewedAt,
        reviewedById,
      },
      update: {
        submittedById: session.user.id,
        submittedAt: new Date(),
        status,
        note: null,
        reviewedAt,
        reviewedById,
      },
    })

    return jsonResponse({ link }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

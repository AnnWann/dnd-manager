import {
  CampaignMemberStatus,
  CampaignRole,
} from "../../../../../generated/prisma/client.js"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../../../server/api.js"
import { prisma } from "../../../../../server/prisma.js"
import { requireSession } from "../../../../../server/session.js"
import {
  normalizeCampaignCapabilityOverrides,
  resolveEffectiveCampaignCapabilities,
  type CampaignCapabilityOverrides,
} from "../../../../../src/shared/campaign/campaignRoles.js"

type RouteContext = {
  params?:
    | Promise<{
        campaignId?: string
        userId?: string
      }>
    | {
        campaignId?: string
        userId?: string
      }
}

export async function PATCH(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId, userId } = await resolveRouteParams(request, context)
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
        "Somente o mestre da campanha pode revisar membros e delegar permissões.",
      )
    }

    const status = parseStatus(body.status)
    const role = parseRole(body.role)
    const permissions = parsePermissions(body.permissions)

    const existing = await prisma.campaignMember.findUnique({
      where: {
        campaignId_userId: {
          campaignId,
          userId,
        },
      },
      select: {
        id: true,
        role: true,
        permissions: true,
      },
    })

    if (!existing) {
      throw new ApiError(
        404,
        "MEMBERSHIP_NOT_FOUND",
        "Solicitação de participação não encontrada.",
      )
    }

    const updated = await prisma.campaignMember.update({
      where: { id: existing.id },
      data: {
        status,
        ...(role ? { role } : {}),
        ...(permissions !== undefined ? { permissions } : {}),
      },
      select: {
        role: true,
        status: true,
        permissions: true,
      },
    })

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

    const normalizedPermissions = normalizeCampaignCapabilityOverrides(updated.permissions)
    return jsonResponse({
      member: {
        userId,
        status: updated.status,
        role: updated.role,
        permissions: normalizedPermissions,
        capabilities: resolveEffectiveCampaignCapabilities(
          updated.role,
          normalizedPermissions,
        ),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

async function resolveRouteParams(
  request: Request,
  context?: RouteContext,
): Promise<{ campaignId: string; userId: string }> {
  const params = context?.params ? await context.params : undefined
  const campaignId = params?.campaignId?.trim()
  const userId = params?.userId?.trim()
  if (campaignId && userId) return { campaignId, userId }

  const match = new URL(request.url).pathname.match(
    /\/api\/me\/campaigns\/([^/]+)\/members\/([^/]+)/,
  )
  if (match?.[1] && match?.[2]) {
    return {
      campaignId: decodeURIComponent(match[1]),
      userId: decodeURIComponent(match[2]),
    }
  }

  throw new ApiError(
    400,
    "MEMBER_ROUTE_PARAMS_REQUIRED",
    "Os identificadores da campanha e do membro não foram informados.",
  )
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
  if (value === CampaignRole.ASSISTANT) return CampaignRole.ASSISTANT
  if (value === CampaignRole.MODERATOR) return CampaignRole.MODERATOR
  if (value === CampaignRole.MASTER) return CampaignRole.MASTER

  throw new ApiError(
    400,
    "INVALID_MEMBER_ROLE",
    "O papel precisa ser PLAYER, ASSISTANT, MODERATOR ou MASTER.",
  )
}

function parsePermissions(value: unknown): CampaignCapabilityOverrides | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(
      400,
      "INVALID_MEMBER_PERMISSIONS",
      "As permissões personalizadas precisam ser um objeto de capacidades booleanas.",
    )
  }
  return normalizeCampaignCapabilityOverrides(value)
}

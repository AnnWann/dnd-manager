import { hashPassword } from "better-auth/crypto"

import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../../../server/api.js"
import { prisma } from "../../../../../server/prisma.js"
import { requireSession } from "../../../../../server/session.js"

type RouteContext = {
  params?:
    | Promise<{ campaignId?: string; userId?: string }>
    | { campaignId?: string; userId?: string }
}

export async function POST(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId, userId } = await resolveRouteParams(request, context)
    const body = await readJsonObject(request)
    const password = typeof body.password === "string" ? body.password : ""

    if (password.length < 8) {
      throw new ApiError(
        400,
        "PASSWORD_TOO_SHORT",
        "A nova senha deve ter pelo menos 8 caracteres.",
      )
    }
    if (password.length > 128) {
      throw new ApiError(
        400,
        "PASSWORD_TOO_LONG",
        "A nova senha deve ter no máximo 128 caracteres.",
      )
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, ownerId: session.user.id },
      select: {
        members: {
          where: { userId },
          select: { userId: true },
          take: 1,
        },
      },
    })

    if (!campaign) {
      throw new ApiError(
        403,
        "MASTER_REQUIRED",
        "Somente o mestre principal da campanha pode redefinir senhas.",
      )
    }
    if (!campaign.members.length) {
      throw new ApiError(
        404,
        "MEMBERSHIP_NOT_FOUND",
        "Este usuário não pertence à campanha.",
      )
    }
    if (userId === session.user.id) {
      throw new ApiError(
        400,
        "SELF_PASSWORD_RESET_NOT_ALLOWED",
        "Use a alteração de senha da própria conta para redefinir sua senha.",
      )
    }

    const account = await prisma.account.findFirst({
      where: { userId, providerId: "credential" },
      select: { id: true },
    })
    if (!account) {
      throw new ApiError(
        400,
        "PASSWORD_ACCOUNT_NOT_FOUND",
        "Este usuário não possui uma conta com senha local.",
      )
    }

    const passwordHash = await hashPassword(password)

    await prisma.$transaction([
      prisma.account.update({
        where: { id: account.id },
        data: { password: passwordHash },
      }),
      prisma.session.deleteMany({
        where: { userId },
      }),
    ])

    return jsonResponse({ success: true })
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
    /\/api\/me\/campaigns\/([^/]+)\/members\/([^/]+)\/reset-password/,
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

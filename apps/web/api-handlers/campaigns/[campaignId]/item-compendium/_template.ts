import {
  ApiError,
  handleApiError,
  jsonResponse,
} from "../../../../server/api.js"
import {
  accessCanManageCreationSection,
  getCampaignAccess,
} from "../../../../server/campaign-capabilities.js"
import { prisma } from "../../../../server/prisma.js"
import { requireSession } from "../../../../server/session.js"

type RouteContext = {
  params?:
    | Promise<{
        campaignId?: string
        templateId?: string
      }>
    | {
        campaignId?: string
        templateId?: string
      }
}

export async function DELETE(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { campaignId, templateId } = await resolveRouteParams(request, context)
    const access = await getCampaignAccess(campaignId, session.user.id)

    if (!access || !accessCanManageCreationSection(access, "items")) {
      throw new ApiError(
        403,
        "CAMPAIGN_ITEM_MANAGER_REQUIRED",
        "Sua função na sessão não permite alterar o compêndio de itens.",
      )
    }

    await prisma.$executeRaw`
      DELETE FROM "campaign_item_compendium"
      WHERE "campaignId" = ${campaignId}
        AND "templateId" = ${templateId}
    `

    return jsonResponse({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}

async function resolveRouteParams(
  request: Request,
  context?: RouteContext,
): Promise<{ campaignId: string; templateId: string }> {
  const params = context?.params ? await context.params : undefined
  const fromContextCampaignId = params?.campaignId?.trim()
  const fromContextTemplateId = params?.templateId?.trim()
  if (fromContextCampaignId && fromContextTemplateId) {
    return {
      campaignId: fromContextCampaignId,
      templateId: fromContextTemplateId,
    }
  }

  const match = new URL(request.url).pathname.match(
    /\/api\/campaigns\/([^/]+)\/item-compendium\/([^/]+)/,
  )
  if (match?.[1] && match?.[2]) {
    return {
      campaignId: decodeURIComponent(match[1]),
      templateId: decodeURIComponent(match[2]),
    }
  }

  throw new ApiError(
    400,
    "ITEM_ROUTE_PARAMS_REQUIRED",
    "Os identificadores da campanha e do item não foram informados.",
  )
}

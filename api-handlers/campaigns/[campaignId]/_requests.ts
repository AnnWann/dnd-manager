import {
  CampaignMemberStatus,
  CampaignRole,
  CharacterVisibility,
} from "../../../generated/prisma/client.js"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../server/api.js"
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

export type CampaignContentRequestType =
  | "CHARACTER"
  | "SYSTEM"
  | "CLASS"
  | "OTHER"

export type CampaignContentRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REVOKED"

type RawRequestRow = {
  id: string
  campaignId: string
  type: CampaignContentRequestType
  status: CampaignContentRequestStatus
  title: string
  sourceId: string
  data: unknown
  note: string | null
  submittedById: string
  submittedByName: string
  reviewedById: string | null
  reviewedByName: string | null
  submittedAt: Date
  reviewedAt: Date | null
  updatedAt: Date
}

type CharacterPreviewRow = {
  id: string
  name: string
  data: unknown
  revision: number
  ownerId: string
  owner: {
    id: string
    name: string
  }
  domains: Array<{
    domain: string
    data: unknown
    revision: number
    updatedById: string | null
    updatedAt: Date
  }>
}

export async function GET(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const campaignId = await resolveCampaignId(request, context)
    const access = await requireCampaignAccess(campaignId, session.user.id)

    if (!access.canManageContent) {
      throw new ApiError(
        403,
        "CAMPAIGN_CONTENT_MANAGER_REQUIRED",
        "Somente mestres e assistentes podem visualizar as solicitações da sessão.",
      )
    }

    const url = new URL(request.url)
    const status = parseOptionalStatus(url.searchParams.get("status"))
    const rows = status
      ? await prisma.$queryRaw<RawRequestRow[]>`
          SELECT
            request."id",
            request."campaignId",
            request."type",
            request."status",
            request."title",
            request."sourceId",
            request."data",
            request."note",
            request."submittedById",
            submitter."name" AS "submittedByName",
            request."reviewedById",
            reviewer."name" AS "reviewedByName",
            request."submittedAt",
            request."reviewedAt",
            request."updatedAt"
          FROM "campaign_content_request" AS request
          JOIN "user" AS submitter ON submitter."id" = request."submittedById"
          LEFT JOIN "user" AS reviewer ON reviewer."id" = request."reviewedById"
          WHERE request."campaignId" = ${campaignId}
            AND request."status" = ${status}
          ORDER BY request."submittedAt" DESC
        `
      : await prisma.$queryRaw<RawRequestRow[]>`
          SELECT
            request."id",
            request."campaignId",
            request."type",
            request."status",
            request."title",
            request."sourceId",
            request."data",
            request."note",
            request."submittedById",
            submitter."name" AS "submittedByName",
            request."reviewedById",
            reviewer."name" AS "reviewedByName",
            request."submittedAt",
            request."reviewedAt",
            request."updatedAt"
          FROM "campaign_content_request" AS request
          JOIN "user" AS submitter ON submitter."id" = request."submittedById"
          LEFT JOIN "user" AS reviewer ON reviewer."id" = request."reviewedById"
          WHERE request."campaignId" = ${campaignId}
          ORDER BY request."submittedAt" DESC
        `

    const characterRequestIds = Array.from(
      new Set(
        rows
          .filter((row) => row.type === "CHARACTER")
          .map((row) => row.sourceId),
      ),
    )
    const characterRows: CharacterPreviewRow[] = characterRequestIds.length
      ? await prisma.character.findMany({
          where: { id: { in: characterRequestIds } },
          select: {
            id: true,
            name: true,
            data: true,
            revision: true,
            ownerId: true,
            owner: {
              select: {
                id: true,
                name: true,
              },
            },
            domains: {
              select: {
                domain: true,
                data: true,
                revision: true,
                updatedById: true,
                updatedAt: true,
              },
              orderBy: { domain: "asc" },
            },
          },
        })
      : []
    const characterById = new Map(
      characterRows.map((character) => [character.id, character]),
    )

    return jsonResponse({
      requests: rows.map((row) =>
        serializeRequest(row, characterById.get(row.sourceId)),
      ),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(
  request: Request,
  context?: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const campaignId = await resolveCampaignId(request, context)
    const access = await requireCampaignAccess(campaignId, session.user.id, {
      allowInvited: true,
    })
    const body = await readJsonObject(request)
    const type = parseRequestType(body.type)
    const sourceId = readRequiredString(body.sourceId, "sourceId", 200)
    let title = readRequiredString(body.title, "title", 180)
    const data = isRecord(body.data) ? body.data : {}

    if (JSON.stringify(data).length > 2_000_000) {
      throw new ApiError(
        413,
        "REQUEST_PAYLOAD_TOO_LARGE",
        "O conteúdo enviado ultrapassa o limite de 2 MB.",
      )
    }

    if (type === "CHARACTER") {
      const character = await prisma.character.findFirst({
        where: {
          id: sourceId,
          ownerId: session.user.id,
        },
        select: {
          id: true,
          name: true,
        },
      })
      if (!character) {
        throw new ApiError(
          404,
          "CHARACTER_NOT_FOUND",
          "O personagem não existe ou não pertence ao usuário.",
        )
      }
      title = character.name
    }

    if (access.canManageContent) {
      await applyApprovedContent({
        campaignId,
        type,
        sourceId,
        title,
        data,
        actorId: session.user.id,
        submittedById: session.user.id,
      })

      return jsonResponse(
        {
          request: null,
          status: "APPROVED",
          applied: true,
        },
        201,
      )
    }

    const requestId = crypto.randomUUID()
    const dataJson = JSON.stringify(data)

    await prisma.$executeRaw`
      INSERT INTO "campaign_content_request" (
        "id",
        "campaignId",
        "type",
        "status",
        "title",
        "sourceId",
        "data",
        "submittedById",
        "submittedAt",
        "updatedAt"
      ) VALUES (
        ${requestId},
        ${campaignId},
        ${type},
        'PENDING',
        ${title},
        ${sourceId},
        ${dataJson}::jsonb,
        ${session.user.id},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("campaignId", "type", "sourceId") DO UPDATE SET
        "status" = 'PENDING',
        "title" = EXCLUDED."title",
        "data" = EXCLUDED."data",
        "note" = NULL,
        "submittedById" = EXCLUDED."submittedById",
        "submittedAt" = CURRENT_TIMESTAMP,
        "reviewedById" = NULL,
        "reviewedAt" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
    `

    return jsonResponse(
      {
        status: "PENDING",
        applied: false,
      },
      201,
    )
  } catch (error) {
    return handleApiError(error)
  }
}

export async function applyApprovedContent(input: {
  campaignId: string
  type: CampaignContentRequestType
  sourceId: string
  title: string
  data: Record<string, unknown>
  actorId: string
  submittedById: string
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (input.type === "CHARACTER") {
      const character = await tx.character.findFirst({
        where: {
          id: input.sourceId,
          ownerId: input.submittedById,
        },
        select: { id: true },
      })
      if (!character) {
        throw new ApiError(
          404,
          "CHARACTER_NOT_FOUND",
          "O personagem solicitado não está mais disponível.",
        )
      }

      await tx.campaignCharacter.upsert({
        where: {
          campaignId_characterId: {
            campaignId: input.campaignId,
            characterId: input.sourceId,
          },
        },
        update: {
          visibility: parseVisibility(input.data.visibility),
        },
        create: {
          campaignId: input.campaignId,
          characterId: input.sourceId,
          visibility: parseVisibility(input.data.visibility),
        },
      })
    } else {
      const assetId = crypto.randomUUID()
      const dataJson = JSON.stringify(input.data)

      await tx.$executeRaw`
        INSERT INTO "campaign_homebrew_asset" (
          "id",
          "campaignId",
          "type",
          "sourceId",
          "name",
          "data",
          "addedById",
          "createdAt",
          "updatedAt"
        ) VALUES (
          ${assetId},
          ${input.campaignId},
          ${input.type},
          ${input.sourceId},
          ${input.title},
          ${dataJson}::jsonb,
          ${input.actorId},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("campaignId", "type", "sourceId") DO UPDATE SET
          "name" = EXCLUDED."name",
          "data" = EXCLUDED."data",
          "addedById" = EXCLUDED."addedById",
          "updatedAt" = CURRENT_TIMESTAMP
      `
    }

    await tx.campaign.update({
      where: { id: input.campaignId },
      data: { creationRevision: { increment: 1 } },
    })
  })
}

export async function requireCampaignAccess(
  campaignId: string,
  userId: string,
  options: { allowInvited?: boolean } = {},
): Promise<{
  isMaster: boolean
  canManageContent: boolean
  status: CampaignMemberStatus
}> {
  const allowedStatuses = options.allowInvited
    ? [CampaignMemberStatus.ACTIVE, CampaignMemberStatus.INVITED]
    : [CampaignMemberStatus.ACTIVE]

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      OR: [
        { ownerId: userId },
        {
          members: {
            some: {
              userId,
              status: { in: allowedStatuses },
            },
          },
        },
      ],
    },
    select: {
      ownerId: true,
      members: {
        where: {
          userId,
          status: { in: allowedStatuses },
        },
        select: {
          role: true,
          status: true,
        },
        take: 1,
      },
    },
  })

  if (!campaign) {
    throw new ApiError(
      403,
      "CAMPAIGN_ACCESS_DENIED",
      options.allowInvited
        ? "Você precisa ter solicitado entrada ou ser membro ativo desta sessão."
        : "Você precisa ser membro ativo desta sessão.",
    )
  }

  if (campaign.ownerId === userId) {
    return {
      isMaster: true,
      canManageContent: true,
      status: CampaignMemberStatus.ACTIVE,
    }
  }

  const membership = campaign.members[0]
  if (!membership) {
    throw new ApiError(403, "CAMPAIGN_ACCESS_DENIED", "Acesso à sessão não encontrado.")
  }

  const active = membership.status === CampaignMemberStatus.ACTIVE
  const isMaster = active && membership.role === CampaignRole.MASTER
  const canManageContent =
    active &&
    (membership.role === CampaignRole.MASTER ||
      membership.role === CampaignRole.ASSISTANT)

  return {
    isMaster,
    canManageContent,
    status: membership.status,
  }
}

function serializeRequest(
  row: RawRequestRow,
  character?: CharacterPreviewRow,
) {
  const characterPreview =
    row.type === "CHARACTER" && character?.ownerId === row.submittedById
      ? {
          id: character.id,
          name: character.name,
          data: character.data,
          revision: character.revision,
          owner: character.owner,
          domains: character.domains.map((domain) => ({
            domain: domain.domain.toLowerCase(),
            payload: domain.data,
            version: domain.revision,
            updatedBy: domain.updatedById,
            updatedAt: domain.updatedAt,
          })),
        }
      : null

  return {
    id: row.id,
    campaignId: row.campaignId,
    type: row.type,
    status: row.status,
    title: row.title,
    sourceId: row.sourceId,
    data: row.data,
    characterPreview,
    note: row.note,
    submittedBy: {
      id: row.submittedById,
      name: row.submittedByName,
    },
    reviewedBy: row.reviewedById
      ? {
          id: row.reviewedById,
          name: row.reviewedByName ?? "Mestre",
        }
      : null,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    updatedAt: row.updatedAt,
  }
}

function parseRequestType(value: unknown): CampaignContentRequestType {
  if (
    value === "CHARACTER" ||
    value === "SYSTEM" ||
    value === "CLASS" ||
    value === "OTHER"
  ) {
    return value
  }

  throw new ApiError(
    400,
    "INVALID_REQUEST_TYPE",
    "O tipo da solicitação precisa ser CHARACTER, SYSTEM, CLASS ou OTHER.",
  )
}

function parseOptionalStatus(
  value: string | null,
): CampaignContentRequestStatus | null {
  if (!value) return null
  if (
    value === "PENDING" ||
    value === "APPROVED" ||
    value === "REJECTED" ||
    value === "REVOKED"
  ) {
    return value
  }
  throw new ApiError(400, "INVALID_REQUEST_STATUS", "Status de solicitação inválido.")
}

function parseVisibility(value: unknown): CharacterVisibility {
  if (value === CharacterVisibility.PRIVATE) return CharacterVisibility.PRIVATE
  if (value === CharacterVisibility.MASTER) return CharacterVisibility.MASTER
  return CharacterVisibility.PARTY
}

function readRequiredString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  const normalized = typeof value === "string" ? value.trim() : ""
  if (!normalized) {
    throw new ApiError(400, "REQUEST_FIELD_REQUIRED", `${field} é obrigatório.`)
  }
  return normalized.slice(0, maxLength)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
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

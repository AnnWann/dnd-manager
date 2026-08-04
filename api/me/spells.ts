import {
  CampaignMemberStatus,
  CampaignSpellApprovalStatus,
  HomebrewSpellStatus,
  Prisma,
} from "../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../server/api"
import { prisma } from "../../server/prisma"
import { requireSession } from "../../server/session"

type CreateSpellBody = {
  name: string
  data: Prisma.InputJsonObject
}

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request)
    const userId = session.user.id

    const spells = await prisma.homebrewSpell.findMany({
      where: {
        status: HomebrewSpellStatus.ACTIVE,
        OR: [
          { ownerId: userId },
          {
            campaignLinks: {
              some: {
                status: CampaignSpellApprovalStatus.APPROVED,
                campaign: {
                  OR: [
                    { ownerId: userId },
                    {
                      members: {
                        some: {
                          userId,
                          status: CampaignMemberStatus.ACTIVE,
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        index: true,
        name: true,
        data: true,
        status: true,
        revision: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        campaignLinks: {
          where: {
            campaign: {
              OR: [
                { ownerId: userId },
                {
                  members: {
                    some: {
                      userId,
                      status: CampaignMemberStatus.ACTIVE,
                    },
                  },
                },
              ],
            },
          },
          select: {
            id: true,
            status: true,
            note: true,
            submittedAt: true,
            reviewedAt: true,
            campaign: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { updatedAt: "desc" },
        { name: "asc" },
      ],
    })

    return jsonResponse({
      spells: spells.map((spell) => ({
        ...spell,
        ownedByCurrentUser: spell.ownerId === userId,
        campaigns: spell.campaignLinks.map((link) => ({
          linkId: link.id,
          status: link.status,
          note: link.note,
          submittedAt: link.submittedAt,
          reviewedAt: link.reviewedAt,
          ...link.campaign,
        })),
        campaignLinks: undefined,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request)
    const rawBody = await readJsonObject(request)
    const body = parseCreateSpellBody(rawBody)
    const index = createSpellIndex(session.user.id, body.name)
    const data = normalizeSpellData(body.data, index, body.name)

    const spell = await prisma.homebrewSpell.create({
      data: {
        index,
        name: body.name,
        data,
        ownerId: session.user.id,
      },
      select: {
        id: true,
        index: true,
        name: true,
        data: true,
        status: true,
        revision: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return jsonResponse(
      {
        spell: {
          ...spell,
          ownedByCurrentUser: true,
          campaigns: [],
        },
      },
      201,
    )
  } catch (error) {
    return handleApiError(error)
  }
}

function parseCreateSpellBody(
  body: Record<string, unknown>,
): CreateSpellBody {
  const name = typeof body.name === "string" ? body.name.trim() : ""

  if (!name) {
    throw new ApiError(
      400,
      "SPELL_NAME_REQUIRED",
      "A magia precisa ter um nome.",
    )
  }

  if (name.length > 160) {
    throw new ApiError(
      400,
      "SPELL_NAME_TOO_LONG",
      "O nome da magia pode ter no máximo 160 caracteres.",
    )
  }

  if (!isJsonObject(body.data)) {
    throw new ApiError(
      400,
      "INVALID_SPELL_DATA",
      "Os dados da magia precisam ser um objeto JSON.",
    )
  }

  return {
    name,
    data: body.data as Prisma.InputJsonObject,
  }
}

function normalizeSpellData(
  data: Prisma.InputJsonObject,
  index: string,
  name: string,
): Prisma.InputJsonObject {
  return {
    ...data,
    index,
    name,
    homebrew: true,
  }
}

function createSpellIndex(userId: string, name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "spell"

  return `homebrew-${userId.slice(0, 8)}-${slug}-${crypto.randomUUID().slice(0, 8)}`
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

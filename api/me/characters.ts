import {
  CharacterVisibility,
  Prisma,
} from "../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../server/api"
import { sanitizeCharacterAcquisitionData } from "../../server/character-acquisitions"
import { sanitizeCharacterItemData } from "../../server/character-items"
import { prisma } from "../../server/prisma"
import { requireSession } from "../../server/session"

type CreateCharacterBody = {
  name: string
  data: Prisma.InputJsonObject
  visibility: CharacterVisibility
}

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request)

    const characters = await prisma.character.findMany({
      where: {
        ownerId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        visibility: true,
        revision: true,
        createdAt: true,
        updatedAt: true,
        data: true,
        campaignLinks: {
          select: {
            campaign: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    return jsonResponse({
      characters: characters.map((character) => ({
        ...character,
        campaigns: character.campaignLinks.map(
          (link) => link.campaign,
        ),
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
    const body = parseCreateCharacterBody(rawBody)
    const itemSafeData = sanitizeCharacterItemData(body.data)
    const data = sanitizeCharacterAcquisitionData(itemSafeData, {
      reason: "character-creation",
      sourceType: "characterCreation",
      sourceName: "Criação de personagem",
    })

    const character = await prisma.character.create({
      data: {
        name: body.name,
        data,
        visibility: body.visibility,
        ownerId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        data: true,
        visibility: true,
        revision: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return jsonResponse(
      {
        character,
      },
      201,
    )
  } catch (error) {
    return handleApiError(error)
  }
}

function parseCreateCharacterBody(
  body: Record<string, unknown>,
): CreateCharacterBody {
  const name =
    typeof body.name === "string" ? body.name.trim() : ""

  if (!name) {
    throw new ApiError(
      400,
      "CHARACTER_NAME_REQUIRED",
      "O personagem precisa ter um nome.",
    )
  }

  if (name.length > 120) {
    throw new ApiError(
      400,
      "CHARACTER_NAME_TOO_LONG",
      "O nome do personagem pode ter no máximo 120 caracteres.",
    )
  }

  if (
    !body.data ||
    typeof body.data !== "object" ||
    Array.isArray(body.data)
  ) {
    throw new ApiError(
      400,
      "INVALID_CHARACTER_DATA",
      "Os dados do personagem precisam ser um objeto JSON.",
    )
  }

  return {
    name,
    data: body.data as Prisma.InputJsonObject,
    visibility: parseVisibility(body.visibility),
  }
}

function parseVisibility(
  value: unknown,
): CharacterVisibility {
  if (typeof value !== "string") {
    return CharacterVisibility.PRIVATE
  }

  const normalized = value.trim().toUpperCase()

  if (normalized === CharacterVisibility.PARTY) {
    return CharacterVisibility.PARTY
  }

  if (normalized === CharacterVisibility.MASTER) {
    return CharacterVisibility.MASTER
  }

  return CharacterVisibility.PRIVATE
}

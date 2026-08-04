import { Prisma } from "../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../server/api"
import { prisma } from "../../../server/prisma"
import { requireSession } from "../../../server/session"

type RouteContext = {
  params: Promise<{
    characterId: string
  }>
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { characterId } = await context.params

    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        ownerId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        data: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!character) {
      throw new ApiError(
        404,
        "CHARACTER_NOT_FOUND",
        "Personagem não encontrado.",
      )
    }

    return jsonResponse({ character })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { characterId } = await context.params
    const body = await readJsonObject(request)

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

    const existing = await prisma.character.findFirst({
      where: {
        id: characterId,
        ownerId: session.user.id,
      },
      select: {
        id: true,
      },
    })

    if (!existing) {
      throw new ApiError(
        404,
        "CHARACTER_NOT_FOUND",
        "Personagem não encontrado.",
      )
    }

    const requestedName =
      typeof body.name === "string" ? body.name.trim() : ""

    const character = await prisma.character.update({
      where: {
        id: existing.id,
      },
      data: {
        data: body.data as Prisma.InputJsonObject,
        ...(requestedName ? { name: requestedName.slice(0, 120) } : {}),
      },
      select: {
        id: true,
        name: true,
        data: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return jsonResponse({ character })
  } catch (error) {
    return handleApiError(error)
  }
}

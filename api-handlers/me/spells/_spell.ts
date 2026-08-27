import {
  HomebrewSpellStatus,
  Prisma,
} from "../../../generated/prisma/client"
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
    spellId: string
  }>
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { spellId } = await context.params

    const spell = await prisma.homebrewSpell.findFirst({
      where: {
        id: spellId,
        ownerId: session.user.id,
        status: HomebrewSpellStatus.ACTIVE,
      },
    })

    if (!spell) {
      throw new ApiError(
        404,
        "SPELL_NOT_FOUND",
        "Magia não encontrada.",
      )
    }

    return jsonResponse({ spell })
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
    const { spellId } = await context.params
    const body = await readJsonObject(request)

    const current = await prisma.homebrewSpell.findFirst({
      where: {
        id: spellId,
        ownerId: session.user.id,
        status: HomebrewSpellStatus.ACTIVE,
      },
      select: {
        id: true,
        index: true,
        name: true,
        revision: true,
      },
    })

    if (!current) {
      throw new ApiError(
        404,
        "SPELL_NOT_FOUND",
        "Magia não encontrada.",
      )
    }

    const expectedRevision = Number(body.expectedRevision)
    if (
      Number.isFinite(expectedRevision) &&
      expectedRevision !== current.revision
    ) {
      throw new ApiError(
        409,
        "SPELL_REVISION_CONFLICT",
        "A magia foi alterada em outro lugar. Recarregue antes de salvar.",
      )
    }

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : current.name

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

    const data: Prisma.InputJsonObject = {
      ...(body.data as Prisma.InputJsonObject),
      index: current.index,
      name,
      homebrew: true,
    }

    const spell = await prisma.homebrewSpell.update({
      where: { id: current.id },
      data: {
        name,
        data,
        revision: {
          increment: 1,
        },
      },
    })

    return jsonResponse({ spell })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { spellId } = await context.params

    const result = await prisma.homebrewSpell.updateMany({
      where: {
        id: spellId,
        ownerId: session.user.id,
        status: HomebrewSpellStatus.ACTIVE,
      },
      data: {
        status: HomebrewSpellStatus.ARCHIVED,
        revision: {
          increment: 1,
        },
      },
    })

    if (result.count === 0) {
      throw new ApiError(
        404,
        "SPELL_NOT_FOUND",
        "Magia não encontrada.",
      )
    }

    return jsonResponse({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

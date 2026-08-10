import {
  CharacterDataDomain,
  Prisma,
} from "../../../../../generated/prisma/client"
import {
  ApiError,
  handleApiError,
  jsonResponse,
  readJsonObject,
} from "../../../../../server/api"
import { sanitizeCharacterAcquisitionData } from "../../../../../server/character-acquisitions"
import { sanitizeCharacterItemData } from "../../../../../server/character-items"
import { prisma } from "../../../../../server/prisma"
import { requireSession } from "../../../../../server/session"

type RouteContext = {
  params: Promise<{
    characterId: string
    domain: string
  }>
}

type DomainResult = {
  domain: string
  payload: unknown
  version: number
  updatedBy: string | null
  updatedAt: Date
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { characterId, domain: rawDomain } = await context.params
    const domain = parseDomain(rawDomain)

    await requireOwnedCharacter(characterId, session.user.id)

    const state = await prisma.characterDomainState.findUnique({
      where: {
        characterId_domain: {
          characterId,
          domain,
        },
      },
      select: {
        domain: true,
        data: true,
        revision: true,
        updatedById: true,
        updatedAt: true,
      },
    })

    return jsonResponse({
      domain: state ? serializeDomain(state) : null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return writeDomain(request, context)
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return writeDomain(request, context)
}

async function writeDomain(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const session = await requireSession(request)
    const { characterId, domain: rawDomain } = await context.params
    const domain = parseDomain(rawDomain)
    const body = await readJsonObject(request)
    const expectedVersion = readExpectedVersion(body.expectedVersion)

    if (!isJsonObject(body.payload)) {
      throw new ApiError(
        400,
        "INVALID_CHARACTER_DOMAIN_PAYLOAD",
        "O payload do domínio precisa ser um objeto JSON.",
      )
    }

    await requireOwnedCharacter(characterId, session.user.id)

    const mutationId = optionalId(body.mutationId)
    const clientId = optionalId(body.clientId)
    const sanitizedPayload = sanitizeDomainPayload(
      body.payload as Prisma.InputJsonObject,
      domain,
    )

    const result = await prisma.$transaction(async (transaction) => {
      if (mutationId) {
        const duplicate = await transaction.characterDomainMutation.findFirst({
          where: {
            characterId,
            domain,
            mutationId,
          },
          select: { id: true },
        })

        if (duplicate) {
          const current = await transaction.characterDomainState.findUnique({
            where: {
              characterId_domain: { characterId, domain },
            },
            select: {
              domain: true,
              data: true,
              revision: true,
              updatedById: true,
              updatedAt: true,
            },
          })
          return { current, duplicate: true, conflict: false }
        }
      }

      if (expectedVersion === 0) {
        const existing = await transaction.characterDomainState.findUnique({
          where: {
            characterId_domain: { characterId, domain },
          },
          select: {
            domain: true,
            data: true,
            revision: true,
            updatedById: true,
            updatedAt: true,
          },
        })

        if (existing) {
          return { current: existing, duplicate: false, conflict: true }
        }

        const created = await transaction.characterDomainState.create({
          data: {
            characterId,
            domain,
            data: sanitizedPayload,
            revision: 1,
            updatedById: session.user.id,
          },
          select: {
            domain: true,
            data: true,
            revision: true,
            updatedById: true,
            updatedAt: true,
          },
        })

        await transaction.characterDomainMutation.create({
          data: {
            characterId,
            domain,
            previousRevision: 0,
            revision: 1,
            mutationId,
            clientId,
            actorId: session.user.id,
          },
        })

        return { current: created, duplicate: false, conflict: false }
      }

      const updated = await transaction.characterDomainState.updateMany({
        where: {
          characterId,
          domain,
          revision: expectedVersion,
        },
        data: {
          data: sanitizedPayload,
          revision: { increment: 1 },
          updatedById: session.user.id,
        },
      })

      if (updated.count !== 1) {
        const current = await transaction.characterDomainState.findUnique({
          where: {
            characterId_domain: { characterId, domain },
          },
          select: {
            domain: true,
            data: true,
            revision: true,
            updatedById: true,
            updatedAt: true,
          },
        })
        return { current, duplicate: false, conflict: true }
      }

      const current = await transaction.characterDomainState.findUniqueOrThrow({
        where: {
          characterId_domain: { characterId, domain },
        },
        select: {
          domain: true,
          data: true,
          revision: true,
          updatedById: true,
          updatedAt: true,
        },
      })

      await transaction.characterDomainMutation.create({
        data: {
          characterId,
          domain,
          previousRevision: expectedVersion,
          revision: current.revision,
          mutationId,
          clientId,
          actorId: session.user.id,
        },
      })

      return { current, duplicate: false, conflict: false }
    })

    if (result.conflict) {
      return jsonResponse(
        {
          error: {
            code: "CHARACTER_DOMAIN_VERSION_CONFLICT",
            message: "O domínio foi alterado por outro cliente.",
          },
          current: result.current ? serializeDomain(result.current) : null,
        },
        409,
      )
    }

    return jsonResponse({
      domain: result.current ? serializeDomain(result.current) : null,
      duplicate: result.duplicate,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

async function requireOwnedCharacter(
  characterId: string,
  userId: string,
): Promise<void> {
  const character = await prisma.character.findFirst({
    where: {
      id: characterId,
      ownerId: userId,
    },
    select: { id: true },
  })

  if (!character) {
    throw new ApiError(
      404,
      "CHARACTER_NOT_FOUND",
      "Personagem não encontrado.",
    )
  }
}

function sanitizeDomainPayload(
  payload: Prisma.InputJsonObject,
  domain: CharacterDataDomain,
): Prisma.InputJsonObject {
  const itemSafe =
    domain === CharacterDataDomain.INVENTORY ||
    domain === CharacterDataDomain.EQUIPMENT
      ? sanitizeCharacterItemData(payload)
      : payload

  return sanitizeCharacterAcquisitionData(itemSafe, {
    reason: "manual",
    sourceType: "manual",
    sourceName: `Edição do domínio ${domain.toLowerCase()}`,
  })
}

function parseDomain(value: string): CharacterDataDomain {
  const normalized = value.trim().toUpperCase()
  if (
    Object.values(CharacterDataDomain).includes(
      normalized as CharacterDataDomain,
    )
  ) {
    return normalized as CharacterDataDomain
  }

  throw new ApiError(
    400,
    "INVALID_CHARACTER_DOMAIN",
    "O domínio informado é inválido.",
  )
}

function readExpectedVersion(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ApiError(
      428,
      "CHARACTER_DOMAIN_VERSION_REQUIRED",
      "expectedVersion é obrigatório para alterar o domínio.",
    )
  }
  return parsed
}

function optionalId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 200)
    : undefined
}

function serializeDomain(value: {
  domain: CharacterDataDomain
  data: unknown
  revision: number
  updatedById: string | null
  updatedAt: Date
}): DomainResult {
  return {
    domain: value.domain.toLowerCase(),
    payload: value.data,
    version: value.revision,
    updatedBy: value.updatedById,
    updatedAt: value.updatedAt,
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

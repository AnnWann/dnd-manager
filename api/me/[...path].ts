import * as campaignsRoute from "./_campaigns"
import * as campaignJoinRoute from "./campaigns/_join"
import * as campaignCharacterRoute from "./campaigns/[campaignId]/characters/_character"
import * as campaignMemberRoute from "./campaigns/[campaignId]/members/_member"
import * as campaignMembershipRoute from "./campaigns/[campaignId]/_membership"
import * as charactersRoute from "./_characters"
import * as characterRoute from "./characters/_character"
import * as characterAccessRoute from "./characters/[characterId]/_access"
import * as characterDomainRoute from "./characters/[characterId]/domains/_domain"
import * as spellsRoute from "./_spells"
import * as spellRoute from "./spells/_spell"
import * as spellCampaignsRoute from "./spells/[spellId]/_campaigns"

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const

type Method = (typeof METHODS)[number]
type RouteParams = Record<string, string>
type RouteContext = { params: Promise<RouteParams> }
type RouteHandler = (
  request: Request,
  context?: RouteContext,
) => Response | Promise<Response>
type RouteModule = Partial<Record<Method, RouteHandler>>

type MatchedRoute = {
  module: RouteModule
  params: RouteParams
}

async function route(request: Request): Promise<Response> {
  const match = matchRoute(request)
  if (!match) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "Rota do usuário não encontrada." } },
      { status: 404 },
    )
  }

  const method = request.method.toUpperCase() as Method
  const handler = match.module[method]
  if (!handler) {
    const allow = METHODS.filter((candidate) => Boolean(match.module[candidate]))
    return Response.json(
      {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Método não permitido para esta rota.",
        },
      },
      {
        status: 405,
        headers: allow.length ? { Allow: allow.join(", ") } : undefined,
      },
    )
  }

  return handler(request, { params: Promise.resolve(match.params) })
}

function matchRoute(request: Request): MatchedRoute | null {
  const segments = getSegments(request)

  if (segments.length === 1 && segments[0] === "campaigns") {
    return { module: campaignsRoute as RouteModule, params: {} }
  }
  if (segments.length === 2 && segments[0] === "campaigns" && segments[1] === "join") {
    return { module: campaignJoinRoute as RouteModule, params: {} }
  }
  if (
    segments.length === 4 &&
    segments[0] === "campaigns" &&
    segments[2] === "characters"
  ) {
    return {
      module: campaignCharacterRoute as RouteModule,
      params: { campaignId: segments[1], characterId: segments[3] },
    }
  }
  if (
    segments.length === 4 &&
    segments[0] === "campaigns" &&
    segments[2] === "members"
  ) {
    return {
      module: campaignMemberRoute as RouteModule,
      params: { campaignId: segments[1], userId: segments[3] },
    }
  }
  if (
    segments.length === 3 &&
    segments[0] === "campaigns" &&
    segments[2] === "membership"
  ) {
    return {
      module: campaignMembershipRoute as RouteModule,
      params: { campaignId: segments[1] },
    }
  }
  if (segments.length === 1 && segments[0] === "characters") {
    return { module: charactersRoute as RouteModule, params: {} }
  }
  if (segments.length === 2 && segments[0] === "characters") {
    return {
      module: characterRoute as RouteModule,
      params: { characterId: segments[1] },
    }
  }
  if (
    segments.length === 3 &&
    segments[0] === "characters" &&
    segments[2] === "access"
  ) {
    return {
      module: characterAccessRoute as RouteModule,
      params: { characterId: segments[1] },
    }
  }
  if (
    segments.length === 4 &&
    segments[0] === "characters" &&
    segments[2] === "domains"
  ) {
    return {
      module: characterDomainRoute as RouteModule,
      params: { characterId: segments[1], domain: segments[3] },
    }
  }
  if (segments.length === 1 && segments[0] === "spells") {
    return { module: spellsRoute as RouteModule, params: {} }
  }
  if (segments.length === 2 && segments[0] === "spells") {
    return {
      module: spellRoute as RouteModule,
      params: { spellId: segments[1] },
    }
  }
  if (
    segments.length === 3 &&
    segments[0] === "spells" &&
    segments[2] === "campaigns"
  ) {
    return {
      module: spellCampaignsRoute as RouteModule,
      params: { spellId: segments[1] },
    }
  }

  return null
}

function getSegments(request: Request): string[] {
  const segments = new URL(request.url).pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))

  const meIndex = segments.findIndex(
    (segment, index) => segment === "me" && segments[index - 1] === "api",
  )

  return meIndex >= 0 ? segments.slice(meIndex + 1) : []
}

export function GET(request: Request): Promise<Response> {
  return route(request)
}

export function POST(request: Request): Promise<Response> {
  return route(request)
}

export function PUT(request: Request): Promise<Response> {
  return route(request)
}

export function PATCH(request: Request): Promise<Response> {
  return route(request)
}

export function DELETE(request: Request): Promise<Response> {
  return route(request)
}

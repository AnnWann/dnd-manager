import * as charactersRoute from "./[campaignId]/_characters"
import * as creationRoute from "./[campaignId]/_creation"
import * as homebrewRoute from "./[campaignId]/_homebrew"
import * as itemCompendiumRoute from "./[campaignId]/_item-compendium"
import * as itemCompendiumEntryRoute from "./[campaignId]/item-compendium/_template"
import * as requestsRoute from "./[campaignId]/_requests"
import * as requestRoute from "./[campaignId]/requests/_request"
import * as settingsRoute from "./[campaignId]/_settings"
import * as spellRoute from "./[campaignId]/spells/_spell"

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
      { error: { code: "NOT_FOUND", message: "Rota de campanha não encontrada." } },
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
  const campaignId = segments[0]
  if (!campaignId) return null

  const params: RouteParams = { campaignId }

  if (segments.length === 2 && segments[1] === "characters") {
    return { module: charactersRoute as RouteModule, params }
  }
  if (segments.length === 2 && segments[1] === "creation") {
    return { module: creationRoute as RouteModule, params }
  }
  if (segments.length === 2 && segments[1] === "homebrew") {
    return { module: homebrewRoute as RouteModule, params }
  }
  if (segments.length === 2 && segments[1] === "item-compendium") {
    return { module: itemCompendiumRoute as RouteModule, params }
  }
  if (segments.length === 3 && segments[1] === "item-compendium") {
    return {
      module: itemCompendiumEntryRoute as RouteModule,
      params: { ...params, templateId: segments[2] },
    }
  }
  if (segments.length === 2 && segments[1] === "requests") {
    return { module: requestsRoute as RouteModule, params }
  }
  if (segments.length === 3 && segments[1] === "requests") {
    return {
      module: requestRoute as RouteModule,
      params: { ...params, requestId: segments[2] },
    }
  }
  if (segments.length === 2 && segments[1] === "settings") {
    return { module: settingsRoute as RouteModule, params }
  }
  if (segments.length === 3 && segments[1] === "spells") {
    return {
      module: spellRoute as RouteModule,
      params: { ...params, spellId: segments[2] },
    }
  }

  return null
}

function getSegments(request: Request): string[] {
  const segments = new URL(request.url).pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))

  const campaignsIndex = segments.findIndex(
    (segment, index) => segment === "campaigns" && segments[index - 1] === "api",
  )

  return campaignsIndex >= 0 ? segments.slice(campaignsIndex + 1) : []
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

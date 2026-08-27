const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const

type Method = (typeof METHODS)[number]
type RouteParams = Record<string, string>
type RouteContext = { params: Promise<RouteParams> }
type RouteHandler = (
  request: Request,
  context?: RouteContext,
) => Response | Promise<Response>
type RouteModule = Partial<Record<Method, RouteHandler>>
type RouteLoader = () => Promise<RouteModule>

type MatchedRoute = {
  load: RouteLoader
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

  const module = await match.load()
  const method = request.method.toUpperCase() as Method
  const handler = module[method]

  if (!handler) {
    const allow = METHODS.filter((candidate) => Boolean(module[candidate]))
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
    return {
      load: async () =>
        (await import("../api-handlers/campaigns/[campaignId]/_characters.js")) as RouteModule,
      params,
    }
  }
  if (segments.length === 2 && segments[1] === "creation") {
    return {
      load: async () =>
        (await import("../api-handlers/campaigns/[campaignId]/_creation.js")) as RouteModule,
      params,
    }
  }
  if (segments.length === 2 && segments[1] === "homebrew") {
    return {
      load: async () =>
        (await import("../api-handlers/campaigns/[campaignId]/_homebrew.js")) as RouteModule,
      params,
    }
  }
  if (segments.length === 2 && segments[1] === "item-compendium") {
    return {
      load: async () =>
        (await import("../api-handlers/campaigns/[campaignId]/_item-compendium.js")) as RouteModule,
      params,
    }
  }
  if (segments.length === 3 && segments[1] === "item-compendium") {
    return {
      load: async () =>
        (await import("../api-handlers/campaigns/[campaignId]/item-compendium/_template.js")) as RouteModule,
      params: { ...params, templateId: segments[2] },
    }
  }
  if (segments.length === 2 && segments[1] === "requests") {
    return {
      load: async () =>
        (await import("../api-handlers/campaigns/[campaignId]/_requests.js")) as RouteModule,
      params,
    }
  }
  if (segments.length === 3 && segments[1] === "requests") {
    return {
      load: async () =>
        (await import("../api-handlers/campaigns/[campaignId]/requests/_request.js")) as RouteModule,
      params: { ...params, requestId: segments[2] },
    }
  }
  if (segments.length === 2 && segments[1] === "settings") {
    return {
      load: async () =>
        (await import("../api-handlers/campaigns/[campaignId]/_settings.js")) as RouteModule,
      params,
    }
  }
  if (segments.length === 3 && segments[1] === "spells") {
    return {
      load: async () =>
        (await import("../api-handlers/campaigns/[campaignId]/spells/_spell.js")) as RouteModule,
      params: { ...params, spellId: segments[2] },
    }
  }

  return null
}

function getSegments(request: Request): string[] {
  const url = new URL(request.url)
  const rewrittenPath = url.searchParams.get("__campaignPath")?.trim()

  if (rewrittenPath) {
    return rewrittenPath
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
  }

  const segments = url.pathname
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

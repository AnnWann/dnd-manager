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
      { error: { code: "NOT_FOUND", message: "Rota do usuário não encontrada." } },
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

  if (segments.length === 1 && segments[0] === "campaigns") {
    return {
      load: async () => (await import("../../api-handlers/me/_campaigns.js")) as RouteModule,
      params: {},
    }
  }
  if (segments.length === 2 && segments[0] === "campaigns" && segments[1] === "join") {
    return {
      load: async () => (await import("../../api-handlers/me/campaigns/_join.js")) as RouteModule,
      params: {},
    }
  }
  if (
    segments.length === 4 &&
    segments[0] === "campaigns" &&
    segments[2] === "characters"
  ) {
    return {
      load: async () =>
        (await import("../../api-handlers/me/campaigns/[campaignId]/characters/_character.js")) as RouteModule,
      params: { campaignId: segments[1], characterId: segments[3] },
    }
  }
  if (
    segments.length === 4 &&
    segments[0] === "campaigns" &&
    segments[2] === "members"
  ) {
    return {
      load: async () =>
        (await import("../../api-handlers/me/campaigns/[campaignId]/members/_member.js")) as RouteModule,
      params: { campaignId: segments[1], userId: segments[3] },
    }
  }
  if (
    segments.length === 3 &&
    segments[0] === "campaigns" &&
    segments[2] === "membership"
  ) {
    return {
      load: async () =>
        (await import("../../api-handlers/me/campaigns/[campaignId]/_membership.js")) as RouteModule,
      params: { campaignId: segments[1] },
    }
  }
  if (segments.length === 1 && segments[0] === "characters") {
    return {
      load: async () => (await import("../../api-handlers/me/_characters.js")) as RouteModule,
      params: {},
    }
  }
  if (segments.length === 2 && segments[0] === "characters") {
    return {
      load: async () =>
        (await import("../../api-handlers/me/characters/_character.js")) as RouteModule,
      params: { characterId: segments[1] },
    }
  }
  if (
    segments.length === 3 &&
    segments[0] === "characters" &&
    segments[2] === "access"
  ) {
    return {
      load: async () =>
        (await import("../../api-handlers/me/characters/[characterId]/_access.js")) as RouteModule,
      params: { characterId: segments[1] },
    }
  }
  if (
    segments.length === 4 &&
    segments[0] === "characters" &&
    segments[2] === "domains"
  ) {
    return {
      load: async () =>
        (await import("../../api-handlers/me/characters/[characterId]/domains/_domain.js")) as RouteModule,
      params: { characterId: segments[1], domain: segments[3] },
    }
  }
  if (segments.length === 1 && segments[0] === "spells") {
    return {
      load: async () => (await import("../../api-handlers/me/_spells.js")) as RouteModule,
      params: {},
    }
  }
  if (segments.length === 2 && segments[0] === "spells") {
    return {
      load: async () =>
        (await import("../../api-handlers/me/spells/_spell.js")) as RouteModule,
      params: { spellId: segments[1] },
    }
  }
  if (
    segments.length === 3 &&
    segments[0] === "spells" &&
    segments[2] === "campaigns"
  ) {
    return {
      load: async () =>
        (await import("../../api-handlers/me/spells/[spellId]/_campaigns.js")) as RouteModule,
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

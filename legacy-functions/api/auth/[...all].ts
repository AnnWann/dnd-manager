import { auth } from "../../server/auth"

export function GET(request: Request): Promise<Response> {
  return auth.handler(normalizeBetterAuthRequest(request))
}

export function POST(request: Request): Promise<Response> {
  return auth.handler(normalizeBetterAuthRequest(request))
}

function normalizeBetterAuthRequest(request: Request): Request {
  const url = new URL(request.url)
  const rewrittenPath = url.searchParams.get("__betterAuthPath")?.trim()

  if (!rewrittenPath) return request

  url.pathname = `/api/auth/${rewrittenPath.replace(/^\/+/, "")}`
  url.searchParams.delete("__betterAuthPath")

  return new Request(url, request)
}

import { auth } from "../server/auth"

function restoreBetterAuthRequest(request: Request): Request {
  const url = new URL(request.url)
  const authPath = url.searchParams.get("__betterAuthPath")?.trim()

  if (!authPath) {
    return new Request(new URL("/api/auth", url), request)
  }

  url.pathname = `/api/auth/${authPath.replace(/^\/+/, "")}`
  url.searchParams.delete("__betterAuthPath")

  return new Request(url, request)
}

export default {
  async fetch(request: Request): Promise<Response> {
    return auth.handler(restoreBetterAuthRequest(request))
  },
}

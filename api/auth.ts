import { auth } from "../server/auth.js"

export default {
  async fetch(request: Request): Promise<Response> {
    const incomingUrl = new URL(request.url)
    const authPath = incomingUrl.searchParams.get("__betterAuthPath")?.trim()

    incomingUrl.searchParams.delete("__betterAuthPath")
    incomingUrl.pathname = authPath
      ? `/api/auth/${authPath.replace(/^\/+/, "")}`
      : "/api/auth"

    const forwardedRequest = new Request(incomingUrl, request)
    return auth.handler(forwardedRequest)
  },
}

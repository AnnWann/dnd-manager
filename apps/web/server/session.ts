import { auth } from "./auth.js"
import { ApiError } from "./api.js"

export async function requireSession(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "É necessário estar autenticado.",
    )
  }

  return session
}

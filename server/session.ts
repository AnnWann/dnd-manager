import { auth } from "./auth"
import { ApiError } from "./api"

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
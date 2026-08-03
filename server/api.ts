export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function jsonResponse(
  data: unknown,
  status = 200,
): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  })
}

export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return jsonResponse(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      error.status,
    )
  }

  console.error(error)

  return jsonResponse(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Ocorreu um erro interno.",
      },
    },
    500,
  )
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    throw new ApiError(
      400,
      "INVALID_JSON",
      "O corpo da requisição não contém um JSON válido.",
    )
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(
      400,
      "INVALID_BODY",
      "O corpo da requisição precisa ser um objeto JSON.",
    )
  }

  return body as Record<string, unknown>
}
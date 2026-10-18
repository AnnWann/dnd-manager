import { put } from "@vercel/blob"

export const config = {
  api: {
    bodyParser: false,
  },
}

type Req = {
  method?: string
  query?: Record<string, string | string[] | undefined>
  headers: Record<string, string | string[] | undefined>
  on: (event: string, callback: (...args: any[]) => void) => void
}

type Res = {
  status: (code: number) => Res
  setHeader: (name: string, value: string) => void
  send: (body: string) => void
}

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024

function firstQueryValue(value: string | string[] | undefined): string {
  if (!value) return ""
  if (Array.isArray(value)) return value[0] ?? ""
  return value
}

function ok(res: Res, body: unknown, status = 200): void {
  res.status(status)
  res.setHeader("Content-Type", "application/json")
  res.send(JSON.stringify(body))
}

async function readRequestBody(req: Req): Promise<Buffer> {
  const chunks: Buffer[] = []

  return new Promise((resolve, reject) => {
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk)
    })

    req.on("end", () => {
      resolve(Buffer.concat(chunks))
    })

    req.on("error", reject)
  })
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    return ok(res, { error: "Method not allowed" }, 405)
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN

  if (!blobToken) {
    return ok(
      res,
      {
        error:
          "Blob storage não configurado. Defina BLOB_READ_WRITE_TOKEN nas variáveis de ambiente.",
      },
      500,
    )
  }

  const contentType = firstQueryValue(req.headers["content-type"])

  if (!contentType.startsWith("image/")) {
    return ok(res, { error: "Only image uploads are allowed" }, 400)
  }

  const contentLength = Number(
    firstQueryValue(req.headers["content-length"]) || 0,
  )

  if (contentLength > MAX_IMAGE_SIZE_BYTES) {
    return ok(res, { error: "Image too large" }, 413)
  }

  const body = await readRequestBody(req)

  if (body.length === 0) {
    return ok(res, { error: "Missing request body" }, 400)
  }

  if (body.length > MAX_IMAGE_SIZE_BYTES) {
    return ok(res, { error: "Image too large" }, 413)
  }

  const filename =
    firstQueryValue(req.query?.filename) || "character-portrait"

  const safeFilename = filename.replace(/[^\w.\-]/g, "_")

  try {
    const blob = await put(
      `character-images/${crypto.randomUUID()}-${safeFilename}`,
      body,
      {
        access: "public",
        addRandomSuffix: true,
        token: blobToken,
      },
    )

    return ok(res, {
      url: blob.url,
      pathname: blob.pathname,
    })
  } catch (error) {
    console.error("Failed to upload character image:", error)

    return ok(
      res,
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload image.",
      },
      500,
    )
  }
}
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024

export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.")
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("A imagem deve ter no máximo 2 MB.")
  }

  const response = await fetch(
    `/api/images/upload?filename=${encodeURIComponent(file.name)}`,
    {
      method: "POST",
      headers: {
        "content-type": file.type,
      },
      body: file,
    },
  )

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.error ?? "Falha ao enviar imagem.")
  }

  const result = (await response.json()) as { url?: string }
  if (!result.url) throw new Error("O servidor não retornou a imagem.")

  return result.url
}

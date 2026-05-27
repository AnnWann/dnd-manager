export async function translateTexts(args: {
  texts: string[]
  source?: string
  target?: string
}): Promise<string[]> {
  const payload = {
    texts: args.texts,
    source: args.source ?? 'en',
    target: args.target ?? 'pt',
  }

  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'API /api/translate não encontrada (HTTP 404). Em desenvolvimento local, rode com "vercel dev" (Vite não executa a pasta /api). Em produção, confirme que a função /api/translate foi deployada na Vercel.',
      )
    }
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }

  const data = (await res.json()) as { translations?: unknown }
  if (!Array.isArray(data.translations) || data.translations.some((t) => typeof t !== 'string')) {
    throw new Error('Resposta inválida da API de tradução.')
  }

  return data.translations as string[]
}

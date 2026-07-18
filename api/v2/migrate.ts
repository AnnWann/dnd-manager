type ApiRequest = {
  method?: string
}

type ApiResponse = {
  status: (code: number) => ApiResponse
  setHeader: (name: string, value: string) => void
  send: (body: string) => void
}

export default function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).send(JSON.stringify({ error: 'Método não permitido.' }))
    return
  }

  res.status(200).send(JSON.stringify({
    ok: true,
    disabled: true,
    message: 'A migração automática foi desativada. Use os endpoints modulares v2.',
  }))
}

import { createHash } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

export type ApiRequest = {
  method?: string
  query?: Record<string, string | string[] | undefined>
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

export type ApiResponse = {
  status: (code: number) => ApiResponse
  setHeader: (name: string, value: string) => void
  send: (body: string) => void
}

export type Sql = NeonQueryFunction<false, false>

export function getSql(): Sql {
  const url = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL
  if (!url) throw new Error('Banco não configurado. Defina POSTGRES_URL ou DATABASE_URL.')
  return neon(url)
}

export function firstQueryValue(value: string | string[] | undefined): string {
  if (!value) return ''
  return Array.isArray(value) ? value[0] ?? '' : value
}

export function readCampaignKey(req: ApiRequest): string {
  return (firstQueryValue(req.query?.key) || firstQueryValue(req.query?.k)).trim()
}

export function readId(req: ApiRequest): string {
  return firstQueryValue(req.query?.id).trim()
}

export function parseJsonBody(req: ApiRequest): Record<string, unknown> | undefined {
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body) as unknown
    } catch {
      return undefined
    }
  }
  return body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : undefined
}

export function sendJson(res: ApiResponse, status: number, body: Json): void {
  res.status(status)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.send(JSON.stringify(body))
}

export function sendMethodNotAllowed(res: ApiResponse, methods: string[]): void {
  res.setHeader('Allow', methods.join(', '))
  sendJson(res, 405, { error: 'Método não permitido.' })
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha interna no servidor.'
}

export function stableCampaignHash(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export async function resolveCampaignId(sql: Sql, key: string, create = false): Promise<string | undefined> {
  if (key.length < 12) throw new Error('Chave de campanha inválida.')
  const hash = stableCampaignHash(key)

  if (create) {
    const rows = await sql`
      INSERT INTO campaigns (sync_key_hash)
      VALUES (decode(${hash}, 'hex'))
      ON CONFLICT (sync_key_hash)
      DO UPDATE SET updated_at = NOW()
      RETURNING id::text AS id
    ` as unknown as Array<{ id: string }>
    return rows[0]?.id
  }

  const rows = await sql`
    SELECT id::text AS id
    FROM campaigns
    WHERE sync_key_hash = decode(${hash}, 'hex')
  ` as unknown as Array<{ id: string }>
  return rows[0]?.id
}

export function requiredString(value: unknown, name: string, maxLength = 500): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} é obrigatório.`)
  return value.trim().slice(0, maxLength)
}

export function optionalString(value: unknown, maxLength = 10_000): string | undefined {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) || undefined : undefined
}

export function integer(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

export function boolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

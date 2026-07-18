import { neon } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

type Req = {
  method?: string
  query?: Record<string, string | string[] | undefined>
  body?: unknown
}

type Res = {
  status: (code: number) => Res
  setHeader: (name: string, value: string) => void
  send: (body: string) => void
}

function firstQueryValue(value: string | string[] | undefined): string {
  if (!value) return ''
  return Array.isArray(value) ? value[0] ?? '' : value
}

function getKey(req: Req): string {
  return firstQueryValue(req.query?.key) || firstQueryValue(req.query?.k)
}

function getPostgresUrl(): string | undefined {
  return process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL
}

async function ensureTable<ArrayMode extends boolean, FullResults extends boolean>(
  sql: NeonQueryFunction<ArrayMode, FullResults>,
): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS dndmm_custom_systems (
      key TEXT PRIMARY KEY,
      definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
      revision BIGINT NOT NULL DEFAULT 0,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
}

function ok(res: Res, body: Json, status = 200): void {
  res.status(status)
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.send(JSON.stringify(body))
}

function parseBody(req: Req): Record<string, unknown> | undefined {
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

export default async function handler(req: Req, res: Res) {
  try {
    const key = getKey(req).trim()
    if (key.length < 12) return ok(res, { error: 'Chave inválida.' }, 400)

    const postgresUrl = getPostgresUrl()
    if (!postgresUrl) return ok(res, { error: 'Banco não configurado.' }, 500)

    const sql = neon(postgresUrl)
    await ensureTable(sql)

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT definitions, revision, updated_at, updated_by
        FROM dndmm_custom_systems
        WHERE key = ${key}
      ` as unknown as Array<{
        definitions: Json[]
        revision: string | number
        updated_at: string
        updated_by: string | null
      }>

      if (!rows.length) {
        return ok(res, { definitions: [], revision: 0, updatedAt: null, updatedBy: null })
      }

      return ok(res, {
        definitions: rows[0].definitions,
        revision: Number(rows[0].revision) || 0,
        updatedAt: rows[0].updated_at,
        updatedBy: rows[0].updated_by,
      })
    }

    if (req.method === 'PUT') {
      const body = parseBody(req)
      if (!body || !Array.isArray(body.definitions)) return ok(res, { error: 'Payload inválido.' }, 400)

      const expectedRevision = Number(body.expectedRevision)
      if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
        return ok(res, { error: 'Revisão esperada inválida.' }, 428)
      }

      const clientId = typeof body.clientId === 'string'
        ? body.clientId.trim().slice(0, 200) || 'unknown-client'
        : 'unknown-client'
      const definitions = body.definitions as Json[]
      const serializedDefinitions = JSON.stringify(definitions)

      if (expectedRevision === 0) {
        const inserted = await sql`
          INSERT INTO dndmm_custom_systems (key, definitions, revision, updated_by, updated_at)
          VALUES (${key}, ${serializedDefinitions}::jsonb, 1, ${clientId}, NOW())
          ON CONFLICT (key) DO NOTHING
          RETURNING revision, updated_at
        ` as unknown as Array<{ revision: string | number; updated_at: string }>

        if (inserted.length) {
          return ok(res, { ok: true, revision: Number(inserted[0].revision), updatedAt: inserted[0].updated_at })
        }
      }

      const updated = await sql`
        UPDATE dndmm_custom_systems
        SET definitions = ${serializedDefinitions}::jsonb,
            revision = revision + 1,
            updated_by = ${clientId},
            updated_at = NOW()
        WHERE key = ${key} AND revision = ${expectedRevision}
        RETURNING revision, updated_at
      ` as unknown as Array<{ revision: string | number; updated_at: string }>

      if (!updated.length) {
        const current = await sql`
          SELECT definitions, revision, updated_at, updated_by
          FROM dndmm_custom_systems
          WHERE key = ${key}
        ` as unknown as Array<{
          definitions: Json[]
          revision: string | number
          updated_at: string
          updated_by: string | null
        }>

        return ok(res, {
          error: 'Conflito de revisão.',
          definitions: current[0]?.definitions ?? [],
          revision: Number(current[0]?.revision) || 0,
          updatedAt: current[0]?.updated_at ?? null,
          updatedBy: current[0]?.updated_by ?? null,
        }, 409)
      }

      return ok(res, { ok: true, revision: Number(updated[0].revision), updatedAt: updated[0].updated_at })
    }

    res.setHeader('Allow', 'GET, PUT')
    return ok(res, { error: 'Método não permitido.' }, 405)
  } catch (error) {
    console.error('custom-systems API failed', error)
    return ok(res, {
      error: error instanceof Error ? error.message : 'Falha interna ao sincronizar sistemas.',
    }, 500)
  }
}

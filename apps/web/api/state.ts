import { neon } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

type AppState = {
  version: 1
  [key: string]: Json
}

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
  if (Array.isArray(value)) return value[0] ?? ''
  return value
}

function getKeyFromReq(req: Req): string {
  return firstQueryValue(req.query?.key) || firstQueryValue(req.query?.k)
}

function isValidKey(key: string): boolean {
  return key.trim().length >= 12
}

function getPostgresUrl(): string | undefined {
  return (
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL
  )
}

async function ensureTables<
  ArrayMode extends boolean,
  FullResults extends boolean,
>(sql: NeonQueryFunction<ArrayMode, FullResults>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS dndmm_state (
      key TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      revision BIGINT NOT NULL DEFAULT 0,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `

  await sql`
    ALTER TABLE dndmm_state
    ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0;
  `

  await sql`
    ALTER TABLE dndmm_state
    ADD COLUMN IF NOT EXISTS updated_by TEXT;
  `

  await sql`
    CREATE TABLE IF NOT EXISTS dndmm_state_history (
      key TEXT NOT NULL,
      revision BIGINT NOT NULL,
      state JSONB NOT NULL,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL,
      archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (key, revision)
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
  let body: unknown = req.body

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body) as unknown
    } catch {
      return undefined
    }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined
  }

  return body as Record<string, unknown>
}

export default async function handler(req: Req, res: Res) {
  const key = getKeyFromReq(req)
  if (!isValidKey(key)) {
    return ok(res, { error: 'Chave inválida (mínimo 12 caracteres).' }, 400)
  }

  const postgresUrl = getPostgresUrl()
  if (!postgresUrl) {
    return ok(
      res,
      {
        error:
          'Banco não configurado. Defina POSTGRES_URL (ou DATABASE_URL) nas variáveis de ambiente.',
      },
      500,
    )
  }

  const sql = neon(postgresUrl)
  await ensureTables(sql)

  if (req.method === 'GET') {
    const rows =
      (await sql`
        SELECT state, revision, updated_at, updated_by
        FROM dndmm_state
        WHERE key = ${key}
      `) as unknown as Array<{
        state: AppState
        revision: string | number
        updated_at: string
        updated_by: string | null
      }>

    if (!rows.length) {
      return ok(res, {
        state: null,
        revision: 0,
        updatedAt: null,
        updatedBy: null,
      })
    }

    return ok(res, {
      state: rows[0].state,
      revision: Number(rows[0].revision) || 0,
      updatedAt: rows[0].updated_at,
      updatedBy: rows[0].updated_by,
    })
  }

  if (req.method === 'PUT') {
    const body = parseBody(req)
    if (!body) return ok(res, { error: 'JSON inválido.' }, 400)

    const state = body.state as AppState | undefined
    const expectedRevision = Number(body.expectedRevision)
    const clientId =
      typeof body.clientId === 'string' && body.clientId.trim()
        ? body.clientId.trim().slice(0, 200)
        : 'unknown-client'

    if (!state || state.version !== 1) {
      return ok(res, { error: 'Payload inválido.' }, 400)
    }

    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
      return ok(
        res,
        {
          error:
            'Revisão esperada ausente. Recarregue o aplicativo antes de salvar novamente.',
        },
        428,
      )
    }

    if (expectedRevision === 0) {
      const inserted =
        (await sql`
          INSERT INTO dndmm_state (
            key,
            state,
            revision,
            updated_by,
            updated_at
          )
          VALUES (
            ${key},
            ${state}::jsonb,
            1,
            ${clientId},
            NOW()
          )
          ON CONFLICT (key) DO NOTHING
          RETURNING revision, updated_at
        `) as unknown as Array<{
          revision: string | number
          updated_at: string
        }>

      if (inserted.length) {
        return ok(res, {
          ok: true,
          revision: Number(inserted[0].revision),
          updatedAt: inserted[0].updated_at,
        })
      }
    }

    const updated =
      (await sql`
        WITH previous AS (
          SELECT state, revision, updated_at, updated_by
          FROM dndmm_state
          WHERE key = ${key}
            AND revision = ${expectedRevision}
        ),
        archived AS (
          INSERT INTO dndmm_state_history (
            key,
            revision,
            state,
            updated_by,
            updated_at
          )
          SELECT
            ${key},
            revision,
            state,
            updated_by,
            updated_at
          FROM previous
          ON CONFLICT (key, revision) DO NOTHING
          RETURNING revision
        ),
        changed AS (
          UPDATE dndmm_state
          SET
            state = ${state}::jsonb,
            revision = revision + 1,
            updated_by = ${clientId},
            updated_at = NOW()
          WHERE key = ${key}
            AND revision = ${expectedRevision}
          RETURNING revision, updated_at
        )
        SELECT revision, updated_at
        FROM changed
      `) as unknown as Array<{
        revision: string | number
        updated_at: string
      }>

    if (!updated.length) {
      const current =
        (await sql`
          SELECT state, revision, updated_at, updated_by
          FROM dndmm_state
          WHERE key = ${key}
        `) as unknown as Array<{
          state: AppState
          revision: string | number
          updated_at: string
          updated_by: string | null
        }>

      if (!current.length) {
        return ok(res, {
          error: 'Estado remoto desapareceu durante a gravação.',
          state: null,
          revision: 0,
        }, 409)
      }

      return ok(
        res,
        {
          error: 'Conflito de revisão.',
          state: current[0].state,
          revision: Number(current[0].revision) || 0,
          updatedAt: current[0].updated_at,
          updatedBy: current[0].updated_by,
        },
        409,
      )
    }

    await sql`
      DELETE FROM dndmm_state_history
      WHERE key = ${key}
        AND revision NOT IN (
          SELECT revision
          FROM dndmm_state_history
          WHERE key = ${key}
          ORDER BY revision DESC
          LIMIT 25
        )
    `

    return ok(res, {
      ok: true,
      revision: Number(updated[0].revision),
      updatedAt: updated[0].updated_at,
    })
  }

  res.setHeader('Allow', 'GET, PUT')
  return ok(res, { error: 'Método não permitido.' }, 405)
}

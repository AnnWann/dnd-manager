import {
  errorMessage,
  getSql,
  integer,
  optionalString,
  parseJsonBody,
  readCampaignKey,
  resolveCampaignId,
  sendJson,
  sendMethodNotAllowed,
  type ApiRequest,
  type ApiResponse,
  type Json,
  type Sql,
} from './relationalDb'

export const CHARACTER_DOMAINS = [
  'sheet',
  'vitals',
  'profile',
  'abilities',
  'magic',
  'inventory',
  'equipment',
  'progression',
  'notes',
] as const

export type CharacterDomain = (typeof CHARACTER_DOMAINS)[number]

type CharacterRef = {
  id: string
  campaignId: string
}

type DomainRow = {
  domain: CharacterDomain
  payload: Json
  version: number | string
  updatedBy: string | null
  updatedAt: string
}

export async function handleCharacterDomain(
  req: ApiRequest,
  res: ApiResponse,
  fixedDomain?: CharacterDomain,
) {
  try {
    const sql = getSql()
    const key = readCampaignKey(req)
    const campaignId = await resolveCampaignId(sql, key)
    if (!campaignId) {
      return sendJson(res, 404, { error: 'Campanha não encontrada.' })
    }

    const characterReference = readCharacterReference(req)
    if (!characterReference) {
      return sendJson(res, 400, {
        error: 'characterId ou legacyId é obrigatório.',
      })
    }

    const character = await resolveCharacter(
      sql,
      campaignId,
      characterReference,
    )
    if (!character) {
      return sendJson(res, 404, { error: 'Personagem não encontrado.' })
    }

    const requestedDomain = fixedDomain ?? readDomain(req)

    if (req.method === 'GET') {
      if (requestedDomain) {
        const row = await readDomainRow(sql, character.id, requestedDomain)
        return sendJson(res, 200, {
          characterId: character.id,
          domain: row ? serializeDomainRow(row) : null,
        })
      }

      const rows = await sql`
        SELECT
          domain,
          payload,
          version,
          updated_by AS "updatedBy",
          updated_at AS "updatedAt"
        FROM character_domain_state
        WHERE character_id = ${character.id}::uuid
        ORDER BY domain
      ` as unknown as DomainRow[]

      return sendJson(res, 200, {
        characterId: character.id,
        domains: rows.map(serializeDomainRow),
      })
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      if (!requestedDomain) {
        return sendJson(res, 400, { error: 'Domínio é obrigatório.' })
      }

      const body = parseJsonBody(req)
      if (!body) return sendJson(res, 400, { error: 'JSON inválido.' })
      if (!isJsonObject(body.payload)) {
        return sendJson(res, 400, {
          error: 'payload deve ser um objeto JSON.',
        })
      }

      const expectedVersion = integer(body.expectedVersion, -1)
      if (expectedVersion < 0) {
        return sendJson(res, 428, {
          error: 'expectedVersion é obrigatório.',
        })
      }

      const actorKey = optionalString(body.actorKey, 500)
      const clientId = optionalString(body.clientId, 200)
      const mutationId = optionalString(body.mutationId, 200)

      if (mutationId) {
        const duplicate = await readMutationResult(
          sql,
          character.id,
          requestedDomain,
          mutationId,
        )
        if (duplicate) {
          return sendJson(res, 200, {
            characterId: character.id,
            domain: serializeDomainRow(duplicate),
            duplicate: true,
          })
        }
      }

      const changed = expectedVersion === 0
        ? await insertDomain(
            sql,
            character,
            requestedDomain,
            body.payload as Record<string, Json>,
            actorKey,
            clientId,
            mutationId,
          )
        : await updateDomain(
            sql,
            character,
            requestedDomain,
            body.payload as Record<string, Json>,
            expectedVersion,
            actorKey,
            clientId,
            mutationId,
          )

      if (changed) {
        return sendJson(res, 200, {
          characterId: character.id,
          domain: serializeDomainRow(changed),
        })
      }

      const current = await readDomainRow(
        sql,
        character.id,
        requestedDomain,
      )
      return sendJson(res, 409, {
        error: 'Conflito de versão no domínio do personagem.',
        current: current ? serializeDomainRow(current) : null,
      })
    }

    return sendMethodNotAllowed(res, ['GET', 'PUT', 'PATCH'])
  } catch (error) {
    console.error('character domain API failed', error)
    return sendJson(res, 500, { error: errorMessage(error) })
  }
}

function readCharacterReference(req: ApiRequest): string {
  const raw = req.query?.characterId ?? req.query?.legacyId ?? req.query?.id
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' ? value.trim().slice(0, 500) : ''
}

function readDomain(req: ApiRequest): CharacterDomain | undefined {
  const raw = req.query?.domain
  const value = Array.isArray(raw) ? raw[0] : raw
  return isCharacterDomain(value) ? value : undefined
}

function isCharacterDomain(value: unknown): value is CharacterDomain {
  return typeof value === 'string' &&
    CHARACTER_DOMAINS.includes(value as CharacterDomain)
}

async function resolveCharacter(
  sql: Sql,
  campaignId: string,
  reference: string,
): Promise<CharacterRef | undefined> {
  const rows = await sql`
    SELECT id::text AS id, campaign_id::text AS "campaignId"
    FROM characters
    WHERE campaign_id = ${campaignId}::uuid
      AND (id::text = ${reference} OR legacy_id = ${reference})
    LIMIT 1
  ` as unknown as CharacterRef[]
  return rows[0]
}

async function readDomainRow(
  sql: Sql,
  characterId: string,
  domain: CharacterDomain,
): Promise<DomainRow | undefined> {
  const rows = await sql`
    SELECT
      domain,
      payload,
      version,
      updated_by AS "updatedBy",
      updated_at AS "updatedAt"
    FROM character_domain_state
    WHERE character_id = ${characterId}::uuid
      AND domain = ${domain}
  ` as unknown as DomainRow[]
  return rows[0]
}

async function readMutationResult(
  sql: Sql,
  characterId: string,
  domain: CharacterDomain,
  mutationId: string,
): Promise<DomainRow | undefined> {
  const rows = await sql`
    SELECT
      state.domain,
      state.payload,
      state.version,
      state.updated_by AS "updatedBy",
      state.updated_at AS "updatedAt"
    FROM character_domain_change_log log
    JOIN character_domain_state state
      ON state.character_id = log.character_id
     AND state.domain = log.domain
    WHERE log.character_id = ${characterId}::uuid
      AND log.domain = ${domain}
      AND log.mutation_id = ${mutationId}
    LIMIT 1
  ` as unknown as DomainRow[]
  return rows[0]
}

async function insertDomain(
  sql: Sql,
  character: CharacterRef,
  domain: CharacterDomain,
  payload: Record<string, Json>,
  actorKey?: string,
  clientId?: string,
  mutationId?: string,
): Promise<DomainRow | undefined> {
  const rows = await sql`
    WITH changed AS (
      INSERT INTO character_domain_state (
        character_id, domain, payload, version, updated_by, updated_at
      )
      VALUES (
        ${character.id}::uuid,
        ${domain},
        ${payload}::jsonb,
        1,
        ${actorKey ?? null},
        NOW()
      )
      ON CONFLICT (character_id, domain) DO NOTHING
      RETURNING
        character_id,
        domain,
        payload,
        version,
        updated_by AS "updatedBy",
        updated_at AS "updatedAt"
    ), logged AS (
      INSERT INTO character_domain_change_log (
        campaign_id,
        character_id,
        domain,
        previous_version,
        version,
        operation,
        mutation_id,
        actor_key,
        client_id
      )
      SELECT
        ${character.campaignId}::uuid,
        character_id,
        domain,
        0,
        version,
        'replace',
        ${mutationId ?? null},
        ${actorKey ?? null},
        ${clientId ?? null}
      FROM changed
      ON CONFLICT DO NOTHING
    )
    SELECT
      domain,
      payload,
      version,
      "updatedBy",
      "updatedAt"
    FROM changed
  ` as unknown as DomainRow[]
  return rows[0]
}

async function updateDomain(
  sql: Sql,
  character: CharacterRef,
  domain: CharacterDomain,
  payload: Record<string, Json>,
  expectedVersion: number,
  actorKey?: string,
  clientId?: string,
  mutationId?: string,
): Promise<DomainRow | undefined> {
  const rows = await sql`
    WITH changed AS (
      UPDATE character_domain_state
      SET
        payload = ${payload}::jsonb,
        version = version + 1,
        updated_by = ${actorKey ?? null},
        updated_at = NOW()
      WHERE character_id = ${character.id}::uuid
        AND domain = ${domain}
        AND version = ${expectedVersion}
      RETURNING
        character_id,
        domain,
        payload,
        version,
        updated_by AS "updatedBy",
        updated_at AS "updatedAt"
    ), logged AS (
      INSERT INTO character_domain_change_log (
        campaign_id,
        character_id,
        domain,
        previous_version,
        version,
        operation,
        mutation_id,
        actor_key,
        client_id
      )
      SELECT
        ${character.campaignId}::uuid,
        character_id,
        domain,
        ${expectedVersion},
        version,
        'replace',
        ${mutationId ?? null},
        ${actorKey ?? null},
        ${clientId ?? null}
      FROM changed
      ON CONFLICT DO NOTHING
    )
    SELECT
      domain,
      payload,
      version,
      "updatedBy",
      "updatedAt"
    FROM changed
  ` as unknown as DomainRow[]
  return rows[0]
}

function serializeDomainRow(row: DomainRow) {
  return {
    domain: row.domain,
    payload: row.payload,
    version: Number(row.version) || 0,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  }
}

function isJsonObject(value: unknown): value is Record<string, Json> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

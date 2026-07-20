import {
  boolean,
  errorMessage,
  getSql,
  integer,
  optionalString,
  parseJsonBody,
  readCampaignKey,
  readId,
  requiredString,
  resolveCampaignId,
  sendJson,
  sendMethodNotAllowed,
  type ApiRequest,
  type ApiResponse,
} from '../_lib/relationalDb'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const sql = getSql()
    const key = readCampaignKey(req)

    if (req.method === 'GET') {
      const campaignId = await resolveCampaignId(sql, key)
      if (!campaignId) return sendJson(res, 200, { characters: [] })
      const id = readId(req)

      if (id) {
        const rows = await sql`
          SELECT
            c.id::text,
            c.legacy_id AS "legacyId",
            c.name,
            c.owner_key AS "ownerKey",
            c.visibility,
            c.unique_character AS "unique",
            c.character_type AS "characterType",
            c.notes,
            c.version,
            c.created_at AS "createdAt",
            c.updated_at AS "updatedAt"
          FROM characters c
          WHERE c.campaign_id = ${campaignId}::uuid
            AND c.id = ${id}::uuid
        ` as unknown as Array<Record<string, unknown>>
        return rows[0]
          ? sendJson(res, 200, { character: rows[0] as never })
          : sendJson(res, 404, { error: 'Personagem não encontrado.' })
      }

      const rows = await sql`
        SELECT
          id::text,
          legacy_id AS "legacyId",
          name,
          owner_key AS "ownerKey",
          visibility,
          unique_character AS "unique",
          character_type AS "characterType",
          version,
          updated_at AS "updatedAt"
        FROM characters
        WHERE campaign_id = ${campaignId}::uuid
        ORDER BY name, id
      ` as unknown as Array<Record<string, unknown>>
      return sendJson(res, 200, { characters: rows as never })
    }

    if (req.method === 'POST') {
      const body = parseJsonBody(req)
      if (!body) return sendJson(res, 400, { error: 'JSON inválido.' })
      const campaignId = await resolveCampaignId(sql, key, true)
      if (!campaignId) throw new Error('Não foi possível criar a campanha.')

      const name = requiredString(body.name, 'Nome', 200)
      const legacyId = optionalString(body.legacyId, 500)
      const ownerKey = optionalString(body.ownerKey, 500)
      const visibility = normalizeVisibility(body.visibility)
      const characterType = optionalString(body.characterType, 100) ?? 'player'
      const notes = optionalString(body.notes, 50_000)
      const uniqueCharacter = boolean(body.unique, false)

      const rows = await sql`
        INSERT INTO characters (
          campaign_id, legacy_id, name, owner_key, visibility,
          unique_character, character_type, notes
        ) VALUES (
          ${campaignId}::uuid, ${legacyId ?? null}, ${name}, ${ownerKey ?? null}, ${visibility},
          ${uniqueCharacter}, ${characterType}, ${notes ?? null}
        )
        RETURNING
          id::text,
          legacy_id AS "legacyId",
          name,
          owner_key AS "ownerKey",
          visibility,
          unique_character AS "unique",
          character_type AS "characterType",
          notes,
          version,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      ` as unknown as Array<Record<string, unknown>>
      return sendJson(res, 201, { character: rows[0] as never })
    }

    if (req.method === 'PATCH') {
      const id = readId(req)
      const body = parseJsonBody(req)
      if (!id || !body) return sendJson(res, 400, { error: 'ID e JSON são obrigatórios.' })
      const campaignId = await resolveCampaignId(sql, key)
      if (!campaignId) return sendJson(res, 404, { error: 'Campanha não encontrada.' })

      const expectedVersion = integer(body.expectedVersion, -1)
      if (expectedVersion < 1) return sendJson(res, 428, { error: 'expectedVersion é obrigatório.' })

      const rows = await sql`
        UPDATE characters
        SET
          name = COALESCE(${optionalString(body.name, 200) ?? null}, name),
          owner_key = CASE WHEN ${body.ownerKey === null} THEN NULL ELSE COALESCE(${optionalString(body.ownerKey, 500) ?? null}, owner_key) END,
          visibility = COALESCE(${body.visibility === undefined ? null : normalizeVisibility(body.visibility)}, visibility),
          unique_character = COALESCE(${typeof body.unique === 'boolean' ? body.unique : null}, unique_character),
          character_type = COALESCE(${optionalString(body.characterType, 100) ?? null}, character_type),
          notes = CASE WHEN ${body.notes === null} THEN NULL ELSE COALESCE(${optionalString(body.notes, 50_000) ?? null}, notes) END,
          version = version + 1,
          updated_at = NOW()
        WHERE campaign_id = ${campaignId}::uuid
          AND id = ${id}::uuid
          AND version = ${expectedVersion}
        RETURNING id::text, name, version, updated_at AS "updatedAt"
      ` as unknown as Array<Record<string, unknown>>

      if (rows[0]) return sendJson(res, 200, { character: rows[0] as never })

      const current = await sql`
        SELECT id::text, version, updated_at AS "updatedAt"
        FROM characters
        WHERE campaign_id = ${campaignId}::uuid AND id = ${id}::uuid
      ` as unknown as Array<Record<string, unknown>>
      return current[0]
        ? sendJson(res, 409, { error: 'Conflito de versão.', current: current[0] as never })
        : sendJson(res, 404, { error: 'Personagem não encontrado.' })
    }

    if (req.method === 'DELETE') {
      const id = readId(req)
      const campaignId = await resolveCampaignId(sql, key)
      if (!id || !campaignId) return sendJson(res, 404, { error: 'Personagem não encontrado.' })
      const rows = await sql`
        DELETE FROM characters
        WHERE campaign_id = ${campaignId}::uuid AND id = ${id}::uuid
        RETURNING id::text
      ` as unknown as Array<{ id: string }>
      return rows[0]
        ? sendJson(res, 200, { ok: true, id: rows[0].id })
        : sendJson(res, 404, { error: 'Personagem não encontrado.' })
    }

    return sendMethodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
  } catch (error) {
    console.error('v2 characters API failed', error)
    return sendJson(res, 500, { error: errorMessage(error) })
  }
}

function normalizeVisibility(value: unknown): 'private' | 'party' | 'master' {
  return value === 'party' || value === 'master' ? value : 'private'
}

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
      const id = readId(req)

      if (id) {
        const rows = await sql`
          SELECT
            id::text,
            stable_key AS "stableKey",
            name,
            level,
            school,
            casting_time AS "castingTime",
            range_text AS "range",
            duration,
            components_text AS "components",
            description,
            source,
            is_homebrew AS "isHomebrew",
            version,
            updated_at AS "updatedAt"
          FROM spell_definitions
          WHERE id = ${id}::uuid
            AND (campaign_id IS NULL OR campaign_id = ${campaignId ?? null}::uuid)
        ` as unknown as Array<Record<string, unknown>>
        return rows[0]
          ? sendJson(res, 200, { spell: rows[0] as never })
          : sendJson(res, 404, { error: 'Magia não encontrada.' })
      }

      const rows = await sql`
        SELECT
          id::text,
          stable_key AS "stableKey",
          name,
          level,
          school,
          source,
          is_homebrew AS "isHomebrew",
          version,
          updated_at AS "updatedAt"
        FROM spell_definitions
        WHERE campaign_id IS NULL OR campaign_id = ${campaignId ?? null}::uuid
        ORDER BY level, name, id
      ` as unknown as Array<Record<string, unknown>>
      return sendJson(res, 200, { spells: rows as never })
    }

    if (req.method === 'POST') {
      const body = parseJsonBody(req)
      if (!body) return sendJson(res, 400, { error: 'JSON inválido.' })
      const campaignId = await resolveCampaignId(sql, key, true)
      if (!campaignId) throw new Error('Não foi possível criar a campanha.')

      const stableKey = requiredString(body.stableKey, 'stableKey', 300)
      const name = requiredString(body.name, 'Nome', 300)
      const level = Math.max(0, Math.min(9, integer(body.level, 0)))
      const rows = await sql`
        INSERT INTO spell_definitions (
          campaign_id, stable_key, name, level, school, casting_time,
          range_text, duration, components_text, description, source, is_homebrew
        ) VALUES (
          ${campaignId}::uuid,
          ${stableKey},
          ${name},
          ${level},
          ${optionalString(body.school, 100) ?? null},
          ${optionalString(body.castingTime, 500) ?? null},
          ${optionalString(body.range, 500) ?? null},
          ${optionalString(body.duration, 500) ?? null},
          ${optionalString(body.components, 2_000) ?? null},
          ${optionalString(body.description, 100_000) ?? ''},
          ${optionalString(body.source, 300) ?? null},
          ${boolean(body.isHomebrew, true)}
        )
        ON CONFLICT (campaign_id, stable_key) WHERE campaign_id IS NOT NULL
        DO UPDATE SET
          name = EXCLUDED.name,
          level = EXCLUDED.level,
          school = EXCLUDED.school,
          casting_time = EXCLUDED.casting_time,
          range_text = EXCLUDED.range_text,
          duration = EXCLUDED.duration,
          components_text = EXCLUDED.components_text,
          description = EXCLUDED.description,
          source = EXCLUDED.source,
          is_homebrew = EXCLUDED.is_homebrew,
          version = spell_definitions.version + 1,
          updated_at = NOW()
        RETURNING id::text, stable_key AS "stableKey", name, level, version, updated_at AS "updatedAt"
      ` as unknown as Array<Record<string, unknown>>
      return sendJson(res, 201, { spell: rows[0] as never })
    }

    if (req.method === 'PATCH') {
      const id = readId(req)
      const body = parseJsonBody(req)
      const campaignId = await resolveCampaignId(sql, key)
      if (!id || !body || !campaignId) return sendJson(res, 400, { error: 'ID, campanha e JSON são obrigatórios.' })
      const expectedVersion = integer(body.expectedVersion, -1)
      if (expectedVersion < 1) return sendJson(res, 428, { error: 'expectedVersion é obrigatório.' })

      const level = body.level === undefined ? null : Math.max(0, Math.min(9, integer(body.level, 0)))
      const rows = await sql`
        UPDATE spell_definitions
        SET
          name = COALESCE(${optionalString(body.name, 300) ?? null}, name),
          level = COALESCE(${level}, level),
          school = CASE WHEN ${body.school === null} THEN NULL ELSE COALESCE(${optionalString(body.school, 100) ?? null}, school) END,
          casting_time = CASE WHEN ${body.castingTime === null} THEN NULL ELSE COALESCE(${optionalString(body.castingTime, 500) ?? null}, casting_time) END,
          range_text = CASE WHEN ${body.range === null} THEN NULL ELSE COALESCE(${optionalString(body.range, 500) ?? null}, range_text) END,
          duration = CASE WHEN ${body.duration === null} THEN NULL ELSE COALESCE(${optionalString(body.duration, 500) ?? null}, duration) END,
          components_text = CASE WHEN ${body.components === null} THEN NULL ELSE COALESCE(${optionalString(body.components, 2_000) ?? null}, components_text) END,
          description = COALESCE(${optionalString(body.description, 100_000) ?? null}, description),
          source = CASE WHEN ${body.source === null} THEN NULL ELSE COALESCE(${optionalString(body.source, 300) ?? null}, source) END,
          version = version + 1,
          updated_at = NOW()
        WHERE id = ${id}::uuid
          AND campaign_id = ${campaignId}::uuid
          AND version = ${expectedVersion}
        RETURNING id::text, name, level, version, updated_at AS "updatedAt"
      ` as unknown as Array<Record<string, unknown>>

      if (rows[0]) return sendJson(res, 200, { spell: rows[0] as never })
      const current = await sql`
        SELECT id::text, version, updated_at AS "updatedAt"
        FROM spell_definitions
        WHERE id = ${id}::uuid AND campaign_id = ${campaignId}::uuid
      ` as unknown as Array<Record<string, unknown>>
      return current[0]
        ? sendJson(res, 409, { error: 'Conflito de versão.', current: current[0] as never })
        : sendJson(res, 404, { error: 'Magia não encontrada.' })
    }

    if (req.method === 'DELETE') {
      const id = readId(req)
      const campaignId = await resolveCampaignId(sql, key)
      if (!id || !campaignId) return sendJson(res, 404, { error: 'Magia não encontrada.' })
      const rows = await sql`
        DELETE FROM spell_definitions
        WHERE id = ${id}::uuid AND campaign_id = ${campaignId}::uuid
        RETURNING id::text
      ` as unknown as Array<{ id: string }>
      return rows[0]
        ? sendJson(res, 200, { ok: true, id: rows[0].id })
        : sendJson(res, 404, { error: 'Magia não encontrada.' })
    }

    return sendMethodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
  } catch (error) {
    console.error('v2 spells API failed', error)
    return sendJson(res, 500, { error: errorMessage(error) })
  }
}

import {
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
      if (!campaignId) return sendJson(res, 200, { systems: [] })
      const id = readId(req)

      if (id) {
        const rows = await sql`
          SELECT
            id::text,
            stable_key AS "stableKey",
            name,
            description,
            icon,
            system_version AS "systemVersion",
            row_version AS "rowVersion",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM custom_systems
          WHERE campaign_id = ${campaignId}::uuid
            AND id = ${id}::uuid
        ` as unknown as Array<Record<string, unknown>>
        if (!rows[0]) return sendJson(res, 404, { error: 'Sistema não encontrado.' })

        const fields = await sql`
          SELECT
            id::text,
            stable_key AS "stableKey",
            name,
            field_type AS "fieldType",
            result_type AS "resultType",
            formula,
            edit_permission AS "editPermission",
            minimum,
            maximum,
            step,
            placeholder,
            description,
            sort_order AS "sortOrder",
            hidden_for_player AS "hiddenForPlayer",
            hidden_for_master AS "hiddenForMaster"
          FROM custom_system_fields
          WHERE system_id = ${id}::uuid
          ORDER BY sort_order, id
        ` as unknown as Array<Record<string, unknown>>

        const resources = await sql`
          SELECT
            id::text,
            stable_key AS "stableKey",
            name,
            resource_type AS "resourceType",
            minimum,
            fixed_maximum AS "fixedMaximum",
            maximum_mode AS "maximumMode",
            maximum_formula AS "maximumFormula",
            initial_value AS "initialValue",
            edit_permission AS "editPermission",
            maximum_edit_permission AS "maximumEditPermission",
            allow_manual_adjustment AS "allowManualAdjustment",
            allow_temporary_value AS "allowTemporaryValue",
            sort_order AS "sortOrder",
            hidden_for_player AS "hiddenForPlayer",
            hidden_for_master AS "hiddenForMaster"
          FROM custom_system_resources
          WHERE system_id = ${id}::uuid
          ORDER BY sort_order, id
        ` as unknown as Array<Record<string, unknown>>

        const abilityTypes = await sql`
          SELECT
            id::text,
            stable_key AS "stableKey",
            name,
            description,
            icon,
            acquisition_mode AS "acquisitionMode",
            learned_limit_formula AS "learnedLimitFormula",
            prepared_limit_formula AS "preparedLimitFormula",
            usage_mode AS "usageMode",
            usage_maximum AS "usageMaximum",
            usage_maximum_formula AS "usageMaximumFormula",
            usage_reset AS "usageReset",
            sort_order AS "sortOrder",
            hidden_for_player AS "hiddenForPlayer",
            hidden_for_master AS "hiddenForMaster"
          FROM custom_ability_types
          WHERE system_id = ${id}::uuid
          ORDER BY sort_order, id
        ` as unknown as Array<Record<string, unknown>>

        return sendJson(res, 200, {
          system: rows[0] as never,
          fields: fields as never,
          resources: resources as never,
          abilityTypes: abilityTypes as never,
        })
      }

      const rows = await sql`
        SELECT
          id::text,
          stable_key AS "stableKey",
          name,
          description,
          icon,
          system_version AS "systemVersion",
          row_version AS "rowVersion",
          updated_at AS "updatedAt"
        FROM custom_systems
        WHERE campaign_id = ${campaignId}::uuid
        ORDER BY name, id
      ` as unknown as Array<Record<string, unknown>>
      return sendJson(res, 200, { systems: rows as never })
    }

    if (req.method === 'POST') {
      const body = parseJsonBody(req)
      if (!body) return sendJson(res, 400, { error: 'JSON inválido.' })
      const campaignId = await resolveCampaignId(sql, key, true)
      if (!campaignId) throw new Error('Não foi possível criar a campanha.')

      const stableKey = requiredString(body.stableKey, 'stableKey', 300)
      const name = requiredString(body.name, 'Nome', 300)
      const systemVersion = Math.max(1, integer(body.systemVersion, 1))
      const rows = await sql`
        INSERT INTO custom_systems (
          campaign_id, stable_key, name, description, icon, system_version
        ) VALUES (
          ${campaignId}::uuid,
          ${stableKey},
          ${name},
          ${optionalString(body.description, 100_000) ?? null},
          ${optionalString(body.icon, 200) ?? null},
          ${systemVersion}
        )
        ON CONFLICT (campaign_id, stable_key)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          icon = EXCLUDED.icon,
          system_version = EXCLUDED.system_version,
          row_version = custom_systems.row_version + 1,
          updated_at = NOW()
        RETURNING
          id::text,
          stable_key AS "stableKey",
          name,
          description,
          icon,
          system_version AS "systemVersion",
          row_version AS "rowVersion",
          updated_at AS "updatedAt"
      ` as unknown as Array<Record<string, unknown>>
      return sendJson(res, 201, { system: rows[0] as never })
    }

    if (req.method === 'PATCH') {
      const id = readId(req)
      const body = parseJsonBody(req)
      const campaignId = await resolveCampaignId(sql, key)
      if (!id || !body || !campaignId) return sendJson(res, 400, { error: 'ID, campanha e JSON são obrigatórios.' })
      const expectedVersion = integer(body.expectedVersion, -1)
      if (expectedVersion < 1) return sendJson(res, 428, { error: 'expectedVersion é obrigatório.' })

      const rows = await sql`
        UPDATE custom_systems
        SET
          name = COALESCE(${optionalString(body.name, 300) ?? null}, name),
          description = CASE WHEN ${body.description === null} THEN NULL ELSE COALESCE(${optionalString(body.description, 100_000) ?? null}, description) END,
          icon = CASE WHEN ${body.icon === null} THEN NULL ELSE COALESCE(${optionalString(body.icon, 200) ?? null}, icon) END,
          system_version = COALESCE(${body.systemVersion === undefined ? null : Math.max(1, integer(body.systemVersion, 1))}, system_version),
          row_version = row_version + 1,
          updated_at = NOW()
        WHERE campaign_id = ${campaignId}::uuid
          AND id = ${id}::uuid
          AND row_version = ${expectedVersion}
        RETURNING id::text, name, system_version AS "systemVersion", row_version AS "rowVersion", updated_at AS "updatedAt"
      ` as unknown as Array<Record<string, unknown>>

      if (rows[0]) return sendJson(res, 200, { system: rows[0] as never })
      const current = await sql`
        SELECT id::text, row_version AS "rowVersion", updated_at AS "updatedAt"
        FROM custom_systems
        WHERE campaign_id = ${campaignId}::uuid AND id = ${id}::uuid
      ` as unknown as Array<Record<string, unknown>>
      return current[0]
        ? sendJson(res, 409, { error: 'Conflito de versão.', current: current[0] as never })
        : sendJson(res, 404, { error: 'Sistema não encontrado.' })
    }

    if (req.method === 'DELETE') {
      const id = readId(req)
      const campaignId = await resolveCampaignId(sql, key)
      if (!id || !campaignId) return sendJson(res, 404, { error: 'Sistema não encontrado.' })
      const rows = await sql`
        DELETE FROM custom_systems
        WHERE campaign_id = ${campaignId}::uuid AND id = ${id}::uuid
        RETURNING id::text
      ` as unknown as Array<{ id: string }>
      return rows[0]
        ? sendJson(res, 200, { ok: true, id: rows[0].id })
        : sendJson(res, 404, { error: 'Sistema não encontrado.' })
    }

    return sendMethodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
  } catch (error) {
    console.error('v2 systems API failed', error)
    return sendJson(res, 500, { error: errorMessage(error) })
  }
}

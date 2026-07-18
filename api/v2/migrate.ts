// @ts-nocheck
import { createHash } from 'node:crypto'
import {
  errorMessage,
  getSql,
  parseJsonBody,
  readCampaignKey,
  resolveCampaignId,
  sendJson,
  sendMethodNotAllowed,
  type ApiRequest,
  type ApiResponse,
} from '../_lib/relationalDb'

const ATTRIBUTES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res, ['POST'])

  try {
    const body = parseJsonBody(req)
    if (!body) return sendJson(res, 400, { error: 'JSON inválido.' })

    const sql = getSql()
    const campaignId = await resolveCampaignId(sql, readCampaignKey(req), true)
    if (!campaignId) throw new Error('Não foi possível criar ou localizar a campanha.')

    const snapshot = {
      characters: list(body.characters),
      spells: list(body.spells),
      systems: list(body.systems),
    }
    const chunkMode = body.mode === 'chunk'
    let payloadHash: string | undefined

    if (!chunkMode) {
      payloadHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
      const checkpoint = await sql`
        SELECT payload_hash AS hash
        FROM relational_sync_checkpoints
        WHERE campaign_id = ${campaignId}::uuid
      ` as unknown as Array<{ hash: string }>

      if (checkpoint[0]?.hash === payloadHash) {
        return sendJson(res, 200, { ok: true, skipped: true, payloadHash })
      }
    }

    const characters = await migrateCharacters(sql, campaignId, snapshot.characters)
    const spells = await migrateSpells(sql, campaignId, snapshot.spells)
    const systems = await migrateSystems(sql, campaignId, snapshot.systems)

    if (!chunkMode && payloadHash) {
      await sql`
        INSERT INTO relational_sync_checkpoints (campaign_id, payload_hash, migrated_at, migrated_by)
        VALUES (${campaignId}::uuid, ${payloadHash}, NOW(), ${text(body.userKey, 200) ?? null})
        ON CONFLICT (campaign_id)
        DO UPDATE SET payload_hash = EXCLUDED.payload_hash,
                      migrated_at = NOW(),
                      migrated_by = EXCLUDED.migrated_by
      `
    }

    return sendJson(res, 200, {
      ok: true,
      skipped: false,
      ...(payloadHash ? { payloadHash } : {}),
      migrated: { characters, spells, systems },
    })
  } catch (error) {
    console.error('v2 migration failed', error)
    return sendJson(res, 500, { error: errorMessage(error) })
  }
}

async function migrateCharacters(sql: ReturnType<typeof getSql>, campaignId: string, values: unknown[]) {
  let count = 0
  for (const raw of values) {
    const character = object(raw)
    const legacyId = text(character.id, 500)
    const name = text(character.name, 200)
    if (!legacyId || !name) continue

    const sheet = object(character.sheet)
    const owner = object(character.owner)
    const rows = await sql`
      INSERT INTO characters (
        campaign_id, legacy_id, name, owner_key, visibility,
        unique_character, character_type, updated_at
      ) VALUES (
        ${campaignId}::uuid,
        ${legacyId},
        ${name},
        ${text(owner.id ?? owner.key ?? owner.name, 500) ?? null},
        ${normalizeVisibility(character.visibility)},
        ${character.unique === true},
        ${text(object(sheet.type).id ?? sheet.type, 100) ?? 'player'},
        NOW()
      )
      ON CONFLICT (campaign_id, legacy_id)
      DO UPDATE SET name = EXCLUDED.name,
                    owner_key = EXCLUDED.owner_key,
                    visibility = EXCLUDED.visibility,
                    unique_character = EXCLUDED.unique_character,
                    character_type = EXCLUDED.character_type,
                    version = characters.version + 1,
                    updated_at = NOW()
      RETURNING id::text AS id
    ` as unknown as Array<{ id: string }>
    const id = rows[0]?.id
    if (!id) continue

    const attributes = object(sheet.attributes)
    const saves = object(sheet.savingThrowProficiencies)
    for (const attribute of ATTRIBUTES) {
      await sql`
        INSERT INTO character_attributes (character_id, attribute, score, save_proficient)
        VALUES (${id}::uuid, ${attribute}, ${whole(attributes[attribute], 10)}, ${saves[attribute] === true})
        ON CONFLICT (character_id, attribute)
        DO UPDATE SET score = EXCLUDED.score,
                      save_proficient = EXCLUDED.save_proficient
      `
    }

    const hp = object(sheet.HP)
    const deathSaves = object(character.deathSaves)
    await sql`
      INSERT INTO character_hit_points (
        character_id, current_hp, maximum_hp, temporary_hp,
        death_save_successes, death_save_failures
      ) VALUES (
        ${id}::uuid,
        ${whole(hp.current, 0)},
        ${whole(hp.max, 0)},
        ${whole(hp.temporary, 0)},
        ${limit(whole(deathSaves.successes, 0), 0, 3)},
        ${limit(whole(deathSaves.failures, 0), 0, 3)}
      )
      ON CONFLICT (character_id)
      DO UPDATE SET current_hp = EXCLUDED.current_hp,
                    maximum_hp = EXCLUDED.maximum_hp,
                    temporary_hp = EXCLUDED.temporary_hp,
                    death_save_successes = EXCLUDED.death_save_successes,
                    death_save_failures = EXCLUDED.death_save_failures
    `

    await sql`DELETE FROM character_classes WHERE character_id = ${id}::uuid`
    const classes = list(sheet.classes)
    for (let index = 0; index < classes.length; index += 1) {
      const value = object(classes[index])
      const className = text(value.name ?? value.className ?? value.class, 200)
      if (!className) continue
      await sql`
        INSERT INTO character_classes (
          character_id, class_id, class_name, subclass_name, level, hit_die, sort_order
        ) VALUES (
          ${id}::uuid,
          ${text(value.id ?? value.classId, 200) ?? slug(className)},
          ${className},
          ${text(value.subclassName ?? value.subclass, 200) ?? null},
          ${Math.max(0, whole(value.level, 0))},
          ${finite(value.hitDie ?? value.hit_die)},
          ${index}
        )
      `
    }
    count += 1
  }
  return count
}

async function migrateSpells(sql: ReturnType<typeof getSql>, campaignId: string, values: unknown[]) {
  let count = 0
  for (const raw of values) {
    const spell = object(raw)
    const name = text(spell.name, 300)
    if (!name) continue
    const stableKey = text(spell.index ?? spell.id, 300) ?? slug(name)
    await sql`
      INSERT INTO spell_definitions (
        campaign_id, stable_key, name, level, school, description,
        source, is_homebrew, updated_at
      ) VALUES (
        ${campaignId}::uuid,
        ${stableKey},
        ${name},
        ${limit(whole(spell.level ?? spell.circle, 0), 0, 9)},
        ${text(object(spell.school).name ?? spell.school, 200) ?? null},
        ${description(spell.desc ?? spell.description)},
        ${text(spell.source, 300) ?? null},
        TRUE,
        NOW()
      )
      ON CONFLICT (campaign_id, stable_key) WHERE campaign_id IS NOT NULL
      DO UPDATE SET name = EXCLUDED.name,
                    level = EXCLUDED.level,
                    school = EXCLUDED.school,
                    description = EXCLUDED.description,
                    source = EXCLUDED.source,
                    version = spell_definitions.version + 1,
                    updated_at = NOW()
    `
    count += 1
  }
  return count
}

async function migrateSystems(sql: ReturnType<typeof getSql>, campaignId: string, values: unknown[]) {
  let count = 0
  for (const raw of values) {
    const system = object(raw)
    const stableKey = text(system.id ?? system.stableKey, 300)
    const name = text(system.name, 300)
    if (!stableKey || !name) continue
    await sql`
      INSERT INTO custom_systems (
        campaign_id, stable_key, name, description, icon,
        system_version, updated_at
      ) VALUES (
        ${campaignId}::uuid,
        ${stableKey},
        ${name},
        ${text(system.description, 100000) ?? null},
        ${text(system.icon, 200) ?? null},
        ${Math.max(1, whole(system.version ?? system.systemVersion, 1))},
        NOW()
      )
      ON CONFLICT (campaign_id, stable_key)
      DO UPDATE SET name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    icon = EXCLUDED.icon,
                    system_version = EXCLUDED.system_version,
                    row_version = custom_systems.row_version + 1,
                    updated_at = NOW()
    `
    count += 1
  }
  return count
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function text(value: unknown, maximum: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized ? normalized.slice(0, maximum) : undefined
}

function whole(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

function finite(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function limit(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function slug(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'
}

function normalizeVisibility(value: unknown): 'private' | 'party' | 'master' {
  return value === 'party' || value === 'master' ? value : 'private'
}

function description(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join('\n\n').slice(0, 100000)
  return text(value, 100000) ?? ''
}

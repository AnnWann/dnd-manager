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
  type Json,
  type Sql,
} from '../_lib/relationalDb'

type RecordValue = Record<string, unknown>
const ATTRIBUTES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res, ['POST'])

  try {
    const body = parseJsonBody(req)
    if (!body) return sendJson(res, 400, { error: 'JSON inválido.' })

    const key = readCampaignKey(req)
    const sql = getSql()
    const campaignId = await resolveCampaignId(sql, key, true)
    if (!campaignId) throw new Error('Não foi possível resolver a campanha.')

    const snapshot = {
      characters: array(body.characters),
      spells: array(body.spells),
      systems: array(body.systems),
    }
    const payloadHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
    const checkpoint = await sql`
      SELECT payload_hash AS "payloadHash"
      FROM relational_sync_checkpoints
      WHERE campaign_id = ${campaignId}::uuid
    ` as unknown as Array<{ payloadHash: string }>

    if (checkpoint[0]?.payloadHash === payloadHash) {
      return sendJson(res, 200, { ok: true, skipped: true, payloadHash })
    }

    const characterCount = await migrateCharacters(sql, campaignId, snapshot.characters)
    const spellCount = await migrateSpells(sql, campaignId, snapshot.spells)
    const systemCount = await migrateSystems(sql, campaignId, snapshot.systems)
    const migratedBy = string(body.userKey, 200)

    await sql`
      INSERT INTO relational_sync_checkpoints (campaign_id, payload_hash, migrated_at, migrated_by)
      VALUES (${campaignId}::uuid, ${payloadHash}, NOW(), ${migratedBy ?? null})
      ON CONFLICT (campaign_id)
      DO UPDATE SET
        payload_hash = EXCLUDED.payload_hash,
        migrated_at = NOW(),
        migrated_by = EXCLUDED.migrated_by
    `

    return sendJson(res, 200, {
      ok: true,
      skipped: false,
      payloadHash,
      migrated: {
        characters: characterCount,
        spells: spellCount,
        systems: systemCount,
      },
    })
  } catch (error) {
    console.error('v2 relational migration failed', error)
    return sendJson(res, 500, { error: errorMessage(error) })
  }
}

async function migrateCharacters(sql: Sql, campaignId: string, characters: unknown[]): Promise<number> {
  let migrated = 0
  for (const raw of characters) {
    const character = record(raw)
    const legacyId = string(character.id, 500)
    const name = string(character.name, 200)
    if (!legacyId || !name) continue

    const sheet = record(character.sheet)
    const owner = record(character.owner)
    const profile = record(character.profile)
    const rows = await sql`
      INSERT INTO characters (
        campaign_id, legacy_id, name, owner_key, visibility,
        unique_character, character_type, notes, updated_at
      ) VALUES (
        ${campaignId}::uuid,
        ${legacyId},
        ${name},
        ${string(owner.id ?? owner.key ?? owner.name, 500) ?? null},
        ${visibility(character.visibility)},
        ${character.unique === true},
        ${string(record(sheet.type).id ?? sheet.type, 100) ?? 'player'},
        ${string(profile.description, 50_000) ?? null},
        NOW()
      )
      ON CONFLICT (campaign_id, legacy_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        owner_key = EXCLUDED.owner_key,
        visibility = EXCLUDED.visibility,
        unique_character = EXCLUDED.unique_character,
        character_type = EXCLUDED.character_type,
        notes = EXCLUDED.notes,
        version = characters.version + 1,
        updated_at = NOW()
      RETURNING id::text AS id
    ` as unknown as Array<{ id: string }>
    const characterId = rows[0]?.id
    if (!characterId) continue

    await replaceCharacterAttributes(sql, characterId, sheet)
    await replaceCharacterClasses(sql, characterId, sheet)
    await replaceCharacterHp(sql, characterId, sheet, character)
    await replaceCharacterNotes(sql, characterId, character.notes)
    migrated += 1
  }
  return migrated
}

async function replaceCharacterAttributes(sql: Sql, characterId: string, sheet: RecordValue) {
  const attributes = record(sheet.attributes)
  const saves = record(sheet.savingThrowProficiencies)
  for (const attribute of ATTRIBUTES) {
    await sql`
      INSERT INTO character_attributes (character_id, attribute, score, save_proficient)
      VALUES (
        ${characterId}::uuid,
        ${attribute},
        ${integer(attributes[attribute], 10)},
        ${saves[attribute] === true}
      )
      ON CONFLICT (character_id, attribute)
      DO UPDATE SET score = EXCLUDED.score, save_proficient = EXCLUDED.save_proficient
    `
  }
}

async function replaceCharacterClasses(sql: Sql, characterId: string, sheet: RecordValue) {
  await sql`DELETE FROM character_classes WHERE character_id = ${characterId}::uuid`
  const classes = array(sheet.classes)
  for (let index = 0; index < classes.length; index += 1) {
    const value = record(classes[index])
    const className = string(value.name ?? value.className ?? value.class, 200)
    if (!className) continue
    const classId = string(value.id ?? value.classId, 200) ?? slug(className)
    await sql`
      INSERT INTO character_classes (
        character_id, class_id, class_name, subclass_name, level, hit_die, sort_order
      ) VALUES (
        ${characterId}::uuid,
        ${classId},
        ${className},
        ${string(value.subclassName ?? value.subclass, 200) ?? null},
        ${Math.max(0, integer(value.level, 0))},
        ${nullableInteger(value.hitDie ?? value.hit_die)},
        ${index}
      )
    `
  }
}

async function replaceCharacterHp(sql: Sql, characterId: string, sheet: RecordValue, character: RecordValue) {
  const hp = record(sheet.HP)
  const deathSaves = record(character.deathSaves)
  await sql`
    INSERT INTO character_hit_points (
      character_id, current_hp, maximum_hp, temporary_hp,
      death_save_successes, death_save_failures
    ) VALUES (
      ${characterId}::uuid,
      ${integer(hp.current, 0)},
      ${integer(hp.max, 0)},
      ${integer(hp.temporary, 0)},
      ${clamp(integer(deathSaves.successes, 0), 0, 3)},
      ${clamp(integer(deathSaves.failures, 0), 0, 3)}
    )
    ON CONFLICT (character_id)
    DO UPDATE SET
      current_hp = EXCLUDED.current_hp,
      maximum_hp = EXCLUDED.maximum_hp,
      temporary_hp = EXCLUDED.temporary_hp,
      death_save_successes = EXCLUDED.death_save_successes,
      death_save_failures = EXCLUDED.death_save_failures
  `
}

async function replaceCharacterNotes(sql: Sql, characterId: string, notesValue: unknown) {
  await sql`DELETE FROM character_notes WHERE character_id = ${characterId}::uuid`
  const notes = array(notesValue)
  for (let index = 0; index < notes.length; index += 1) {
    const body = string(notes[index], 50_000)
    if (!body) continue
    await sql`
      INSERT INTO character_notes (character_id, body, sort_order)
      VALUES (${characterId}::uuid, ${body}, ${index})
    `
  }
}

async function migrateSpells(sql: Sql, campaignId: string, spells: unknown[]): Promise<number> {
  let migrated = 0
  for (const raw of spells) {
    const spell = record(raw)
    const name = string(spell.name, 300)
    if (!name) continue
    const stableKey = string(spell.index ?? spell.id, 300) ?? slug(name)
    const level = clamp(integer(spell.level ?? spell.circle, 0), 0, 9)
    await sql`
      INSERT INTO spell_definitions (
        campaign_id, stable_key, name, level, school, casting_time,
        range_text, duration, components_text, description, source,
        is_homebrew, updated_at
      ) VALUES (
        ${campaignId}::uuid,
        ${stableKey},
        ${name},
        ${level},
        ${string(record(spell.school).name ?? spell.school, 200) ?? null},
        ${string(spell.casting_time ?? spell.castingTime, 500) ?? null},
        ${string(spell.range ?? spell.rangeText, 500) ?? null},
        ${string(spell.duration, 500) ?? null},
        ${componentsText(spell.components)},
        ${descriptionText(spell.desc ?? spell.description)},
        ${string(spell.source, 300) ?? null},
        TRUE,
        NOW()
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
        version = spell_definitions.version + 1,
        updated_at = NOW()
    `
    migrated += 1
  }
  return migrated
}

async function migrateSystems(sql: Sql, campaignId: string, systems: unknown[]): Promise<number> {
  let migrated = 0
  for (const raw of systems) {
    const system = record(raw)
    const stableKey = string(system.id ?? system.stableKey, 300)
    const name = string(system.name, 300)
    if (!stableKey || !name) continue

    const rows = await sql`
      INSERT INTO custom_systems (
        campaign_id, stable_key, name, description, icon, system_version, updated_at
      ) VALUES (
        ${campaignId}::uuid,
        ${stableKey},
        ${name},
        ${string(system.description, 100_000) ?? null},
        ${string(system.icon, 200) ?? null},
        ${Math.max(1, integer(system.version ?? system.systemVersion, 1))},
        NOW()
      )
      ON CONFLICT (campaign_id, stable_key)
      DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        system_version = EXCLUDED.system_version,
        row_version = custom_systems.row_version + 1,
        updated_at = NOW()
      RETURNING id::text AS id
    ` as unknown as Array<{ id: string }>
    const systemId = rows[0]?.id
    if (!systemId) continue

    await replaceSystemFields(sql, systemId, array(system.fields))
    await replaceSystemResources(sql, systemId, array(system.resources))
    await replaceAbilityTypes(sql, systemId, array(system.abilityTypes))
    migrated += 1
  }
  return migrated
}

async function replaceSystemFields(sql: Sql, systemId: string, fields: unknown[]) {
  await sql`DELETE FROM custom_system_fields WHERE system_id = ${systemId}::uuid`
  for (let index = 0; index < fields.length; index += 1) {
    const field = record(fields[index])
    const stableKey = string(field.id ?? field.stableKey, 300)
    const name = string(field.name, 300)
    const type = string(field.type ?? field.fieldType, 100)
    if (!stableKey || !name || !type) continue
    const rows = await sql`
      INSERT INTO custom_system_fields (
        system_id, stable_key, name, field_type, result_type, formula,
        edit_permission, minimum, maximum, step, placeholder, description, sort_order
      ) VALUES (
        ${systemId}::uuid, ${stableKey}, ${name}, ${type},
        ${string(field.resultType, 100) ?? null}, ${string(field.formula, 50_000) ?? null},
        ${string(field.editPermission, 100) ?? 'ownerAndMaster'},
        ${nullableNumber(field.minimum)}, ${nullableNumber(field.maximum)}, ${nullableNumber(field.step)},
        ${string(field.placeholder, 2_000) ?? null}, ${string(field.description, 20_000) ?? null}, ${index}
      ) RETURNING id::text AS id
    ` as unknown as Array<{ id: string }>
    const fieldId = rows[0]?.id
    if (!fieldId) continue
    const options = array(field.options)
    for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
      const option = record(options[optionIndex])
      const value = string(option.value, 500)
      const label = string(option.label, 500)
      if (!value || !label) continue
      await sql`
        INSERT INTO custom_field_options (field_id, value, label, sort_order)
        VALUES (${fieldId}::uuid, ${value}, ${label}, ${optionIndex})
      `
    }
  }
}

async function replaceSystemResources(sql: Sql, systemId: string, resources: unknown[]) {
  await sql`DELETE FROM custom_system_resources WHERE system_id = ${systemId}::uuid`
  for (let index = 0; index < resources.length; index += 1) {
    const resource = record(resources[index])
    const stableKey = string(resource.id ?? resource.stableKey, 300)
    const name = string(resource.name, 300)
    const type = string(resource.type ?? resource.resourceType, 100)
    if (!stableKey || !name || !type) continue
    const rows = await sql`
      INSERT INTO custom_system_resources (
        system_id, stable_key, name, resource_type, minimum, fixed_maximum,
        maximum_mode, maximum_formula, initial_value, edit_permission,
        maximum_edit_permission, allow_manual_adjustment,
        allow_temporary_value, sort_order
      ) VALUES (
        ${systemId}::uuid, ${stableKey}, ${name}, ${type},
        ${nullableNumber(resource.minimum)}, ${nullableNumber(resource.maximum ?? resource.fixedMaximum)},
        ${string(resource.maximumMode, 100) ?? (resource.maximumFormula ? 'formula' : 'fixed')},
        ${string(resource.maximumFormula, 50_000) ?? null},
        ${number(resource.initialValue, 0)},
        ${string(resource.editPermission, 100) ?? 'ownerAndMaster'},
        ${string(resource.maximumEditPermission, 100) ?? null},
        ${resource.allowManualAdjustment !== false},
        ${resource.allowTemporaryValue === true},
        ${index}
      ) RETURNING id::text AS id
    ` as unknown as Array<{ id: string }>
    const resourceId = rows[0]?.id
    if (!resourceId) continue
    const rules = array(resource.recoveryRules)
    for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
      const rule = record(rules[ruleIndex])
      await sql`
        INSERT INTO custom_resource_recovery_rules (
          resource_id, event_type, target, operation, fixed_value,
          formula, enabled, scale_with_rest_fraction, sort_order
        ) VALUES (
          ${resourceId}::uuid,
          ${string(rule.event ?? rule.eventType, 100) ?? 'manual'},
          ${string(rule.target, 100) ?? 'current'},
          ${string(rule.operation, 100) ?? 'add'},
          ${nullableNumber(rule.value ?? rule.fixedValue)},
          ${string(rule.formula, 50_000) ?? null},
          ${rule.enabled !== false},
          ${rule.scaleWithRestFraction !== false},
          ${ruleIndex}
        )
      `
    }
  }
}

async function replaceAbilityTypes(sql: Sql, systemId: string, types: unknown[]) {
  await sql`DELETE FROM custom_ability_types WHERE system_id = ${systemId}::uuid`
  for (let index = 0; index < types.length; index += 1) {
    const type = record(types[index])
    const acquisition = record(type.acquisition)
    const activation = record(type.activation)
    const usage = record(activation.usage)
    const stableKey = string(type.id ?? type.stableKey, 300)
    const name = string(type.name, 300)
    if (!stableKey || !name) continue
    const rows = await sql`
      INSERT INTO custom_ability_types (
        system_id, stable_key, name, description, icon, acquisition_mode,
        learned_limit_formula, prepared_limit_formula, usage_mode,
        usage_maximum, usage_maximum_formula, usage_reset, sort_order
      ) VALUES (
        ${systemId}::uuid, ${stableKey}, ${name},
        ${string(type.description, 20_000) ?? null}, ${string(type.icon, 200) ?? null},
        ${string(acquisition.mode, 100) ?? 'free'},
        ${string(acquisition.learnedLimitFormula, 50_000) ?? null},
        ${string(acquisition.preparedLimitFormula, 50_000) ?? null},
        ${string(usage.mode, 100) ?? 'unlimited'},
        ${nullableNumber(usage.maximum)},
        ${string(usage.maximumFormula, 50_000) ?? null},
        ${string(usage.reset, 100) ?? null},
        ${index}
      ) RETURNING id::text AS id
    ` as unknown as Array<{ id: string }>
    const typeId = rows[0]?.id
    if (!typeId) continue
    const fields = array(type.fields)
    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
      const field = record(fields[fieldIndex])
      const fieldKey = string(field.id ?? field.stableKey, 300)
      const fieldName = string(field.name, 300)
      const fieldType = string(field.type ?? field.fieldType, 100)
      if (!fieldKey || !fieldName || !fieldType) continue
      await sql`
        INSERT INTO custom_ability_fields (
          ability_type_id, stable_key, name, field_type, required,
          edit_permission, sort_order
        ) VALUES (
          ${typeId}::uuid, ${fieldKey}, ${fieldName}, ${fieldType},
          ${field.required === true},
          ${string(field.editPermission, 100) ?? 'ownerAndMaster'},
          ${fieldIndex}
        )
      `
    }
  }
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function record(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
}

function string(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized ? normalized.slice(0, maxLength) : undefined
}

function integer(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

function number(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function nullableInteger(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

function nullableNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function slug(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'
}

function visibility(value: unknown): 'private' | 'party' | 'master' {
  return value === 'party' || value === 'master' ? value : 'private'
}

function componentsText(value: unknown): string | null {
  if (Array.isArray(value)) return value.map(String).join(', ')
  return string(value, 2_000) ?? null
}

function descriptionText(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join('\n\n').slice(0, 100_000)
  return string(value, 100_000) ?? ''
}

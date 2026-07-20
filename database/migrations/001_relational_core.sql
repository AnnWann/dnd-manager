CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_key_hash BYTEA NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_members (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_key TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('master', 'player')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, user_key)
);

CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  legacy_id TEXT,
  name TEXT NOT NULL,
  owner_key TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'party', 'master')),
  unique_character BOOLEAN NOT NULL DEFAULT FALSE,
  character_type TEXT NOT NULL DEFAULT 'player',
  notes TEXT,
  version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, legacy_id)
);

CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id);

CREATE TABLE IF NOT EXISTS character_attributes (
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  attribute TEXT NOT NULL CHECK (attribute IN ('str', 'dex', 'con', 'int', 'wis', 'cha')),
  score INTEGER NOT NULL DEFAULT 10,
  save_proficient BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (character_id, attribute)
);

CREATE TABLE IF NOT EXISTS character_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL,
  class_name TEXT NOT NULL,
  subclass_name TEXT,
  level INTEGER NOT NULL CHECK (level >= 0),
  hit_die SMALLINT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (character_id, class_id)
);

CREATE TABLE IF NOT EXISTS character_hit_points (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  current_hp INTEGER NOT NULL DEFAULT 0,
  maximum_hp INTEGER NOT NULL DEFAULT 0,
  temporary_hp INTEGER NOT NULL DEFAULT 0,
  death_save_successes SMALLINT NOT NULL DEFAULT 0,
  death_save_failures SMALLINT NOT NULL DEFAULT 0,
  CHECK (death_save_successes BETWEEN 0 AND 3),
  CHECK (death_save_failures BETWEEN 0 AND 3)
);

CREATE TABLE IF NOT EXISTS character_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spell_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  stable_key TEXT NOT NULL,
  name TEXT NOT NULL,
  level SMALLINT NOT NULL CHECK (level BETWEEN 0 AND 9),
  school TEXT,
  casting_time TEXT,
  range_text TEXT,
  duration TEXT,
  components_text TEXT,
  description TEXT NOT NULL DEFAULT '',
  source TEXT,
  is_homebrew BOOLEAN NOT NULL DEFAULT FALSE,
  version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_spell_global_key
  ON spell_definitions(stable_key) WHERE campaign_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_spell_campaign_key
  ON spell_definitions(campaign_id, stable_key) WHERE campaign_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS spell_classes (
  spell_id UUID NOT NULL REFERENCES spell_definitions(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL,
  PRIMARY KEY (spell_id, class_id)
);

CREATE TABLE IF NOT EXISTS character_spells (
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  spell_id UUID NOT NULL REFERENCES spell_definitions(id) ON DELETE CASCADE,
  source_class_id TEXT,
  prepared BOOLEAN NOT NULL DEFAULT FALSE,
  always_prepared BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (character_id, spell_id, source_class_id)
);

CREATE TABLE IF NOT EXISTS custom_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  stable_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  system_version INTEGER NOT NULL DEFAULT 1,
  row_version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, stable_key)
);

CREATE TABLE IF NOT EXISTS custom_system_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES custom_systems(id) ON DELETE CASCADE,
  stable_key TEXT NOT NULL,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  result_type TEXT,
  formula TEXT,
  edit_permission TEXT NOT NULL DEFAULT 'ownerAndMaster',
  minimum NUMERIC,
  maximum NUMERIC,
  step NUMERIC,
  placeholder TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden_for_player BOOLEAN NOT NULL DEFAULT FALSE,
  hidden_for_master BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (system_id, stable_key)
);

CREATE TABLE IF NOT EXISTS custom_field_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES custom_system_fields(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (field_id, value)
);

CREATE TABLE IF NOT EXISTS custom_system_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES custom_systems(id) ON DELETE CASCADE,
  stable_key TEXT NOT NULL,
  name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  minimum NUMERIC,
  fixed_maximum NUMERIC,
  maximum_mode TEXT NOT NULL DEFAULT 'fixed',
  maximum_formula TEXT,
  initial_value NUMERIC NOT NULL DEFAULT 0,
  edit_permission TEXT NOT NULL DEFAULT 'ownerAndMaster',
  maximum_edit_permission TEXT,
  allow_manual_adjustment BOOLEAN NOT NULL DEFAULT TRUE,
  allow_temporary_value BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden_for_player BOOLEAN NOT NULL DEFAULT FALSE,
  hidden_for_master BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (system_id, stable_key)
);

CREATE TABLE IF NOT EXISTS custom_resource_recovery_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES custom_system_resources(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'current',
  operation TEXT NOT NULL,
  fixed_value NUMERIC,
  formula TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  scale_with_rest_fraction BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS custom_ability_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES custom_systems(id) ON DELETE CASCADE,
  stable_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  acquisition_mode TEXT NOT NULL DEFAULT 'free',
  learned_limit_formula TEXT,
  prepared_limit_formula TEXT,
  usage_mode TEXT NOT NULL DEFAULT 'unlimited',
  usage_maximum NUMERIC,
  usage_maximum_formula TEXT,
  usage_reset TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden_for_player BOOLEAN NOT NULL DEFAULT FALSE,
  hidden_for_master BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (system_id, stable_key)
);

CREATE TABLE IF NOT EXISTS custom_ability_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ability_type_id UUID NOT NULL REFERENCES custom_ability_types(id) ON DELETE CASCADE,
  stable_key TEXT NOT NULL,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  edit_permission TEXT NOT NULL DEFAULT 'ownerAndMaster',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (ability_type_id, stable_key)
);

CREATE TABLE IF NOT EXISTS predefined_custom_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ability_type_id UUID NOT NULL REFERENCES custom_ability_types(id) ON DELETE CASCADE,
  stable_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (ability_type_id, stable_key)
);

CREATE TABLE IF NOT EXISTS predefined_custom_ability_values (
  ability_id UUID NOT NULL REFERENCES predefined_custom_abilities(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES custom_ability_fields(id) ON DELETE CASCADE,
  text_value TEXT,
  numeric_value NUMERIC,
  boolean_value BOOLEAN,
  PRIMARY KEY (ability_id, field_id),
  CHECK (num_nonnulls(text_value, numeric_value, boolean_value) <= 1)
);

CREATE TABLE IF NOT EXISTS character_custom_systems (
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  system_id UUID NOT NULL REFERENCES custom_systems(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  installation_source TEXT,
  installed_version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (character_id, system_id)
);

CREATE TABLE IF NOT EXISTS character_custom_field_values (
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES custom_system_fields(id) ON DELETE CASCADE,
  text_value TEXT,
  numeric_value NUMERIC,
  boolean_value BOOLEAN,
  PRIMARY KEY (character_id, field_id),
  CHECK (num_nonnulls(text_value, numeric_value, boolean_value) <= 1)
);

CREATE TABLE IF NOT EXISTS character_custom_resource_values (
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES custom_system_resources(id) ON DELETE CASCADE,
  current_value NUMERIC NOT NULL DEFAULT 0,
  maximum_override NUMERIC,
  temporary_value NUMERIC,
  version BIGINT NOT NULL DEFAULT 1,
  PRIMARY KEY (character_id, resource_id)
);

CREATE TABLE IF NOT EXISTS character_custom_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  ability_type_id UUID NOT NULL REFERENCES custom_ability_types(id) ON DELETE CASCADE,
  predefined_ability_id UUID REFERENCES predefined_custom_abilities(id) ON DELETE SET NULL,
  learned BOOLEAN NOT NULL DEFAULT TRUE,
  prepared BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  uses_spent NUMERIC NOT NULL DEFAULT 0,
  version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS character_custom_ability_values (
  character_ability_id UUID NOT NULL REFERENCES character_custom_abilities(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES custom_ability_fields(id) ON DELETE CASCADE,
  text_value TEXT,
  numeric_value NUMERIC,
  boolean_value BOOLEAN,
  PRIMARY KEY (character_ability_id, field_id),
  CHECK (num_nonnulls(text_value, numeric_value, boolean_value) <= 1)
);

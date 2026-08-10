-- Character persistence is split into independently versioned domains so that
-- collaborative writes do not contend on one monolithic character document.

CREATE TABLE IF NOT EXISTS character_domain_state (
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  domain TEXT NOT NULL CHECK (
    domain IN (
      'sheet',
      'vitals',
      'profile',
      'abilities',
      'magic',
      'inventory',
      'equipment',
      'progression',
      'notes'
    )
  ),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  version BIGINT NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_character_domain_state_character
  ON character_domain_state(character_id);

CREATE TABLE IF NOT EXISTS character_domain_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  previous_version BIGINT NOT NULL DEFAULT 0,
  version BIGINT NOT NULL,
  operation TEXT NOT NULL DEFAULT 'replace',
  actor_key TEXT,
  client_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (version > previous_version)
);

CREATE INDEX IF NOT EXISTS idx_character_domain_change_log_character
  ON character_domain_change_log(character_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_character_domain_change_log_campaign
  ON character_domain_change_log(campaign_id, created_at DESC);

-- Existing relational character rows remain useful for indexed/queryable data.
-- The domain table is the ownership boundary for portions of CharacterTemplate
-- that are still document-shaped and are expected to evolve frequently.
COMMENT ON TABLE character_domain_state IS
  'Independently versioned CharacterTemplate domains. Each UI subsystem owns one domain and writes it without replacing unrelated character state.';

COMMENT ON COLUMN character_domain_state.version IS
  'Optimistic-concurrency version scoped to one character/domain pair.';

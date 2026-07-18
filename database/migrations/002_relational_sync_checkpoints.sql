CREATE TABLE IF NOT EXISTS relational_sync_checkpoints (
  campaign_id UUID PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  payload_hash TEXT NOT NULL,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  migrated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_relational_sync_checkpoints_hash
  ON relational_sync_checkpoints(payload_hash);

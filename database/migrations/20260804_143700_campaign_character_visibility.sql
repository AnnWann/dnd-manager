ALTER TABLE "campaign_character"
  ADD COLUMN IF NOT EXISTS "visibility" "CharacterVisibility" NOT NULL DEFAULT 'PARTY';

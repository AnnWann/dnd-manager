CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE "HomebrewSpellStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CampaignSpellApprovalStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'REVOKED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "homebrew_spell" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "index" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "status" "HomebrewSpellStatus" NOT NULL DEFAULT 'ACTIVE',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "homebrew_spell_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "homebrew_spell_ownerId_status_idx"
  ON "homebrew_spell"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "homebrew_spell_name_idx"
  ON "homebrew_spell"("name");

CREATE TABLE IF NOT EXISTS "campaign_homebrew_spell" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "status" "CampaignSpellApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "campaignId" TEXT NOT NULL,
  "spellId" TEXT NOT NULL,
  "submittedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "reviewedAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "campaign_homebrew_spell_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "campaign"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_homebrew_spell_spellId_fkey"
    FOREIGN KEY ("spellId") REFERENCES "homebrew_spell"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_homebrew_spell_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_homebrew_spell_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "campaign_homebrew_spell_campaignId_spellId_key"
    UNIQUE ("campaignId", "spellId")
);

CREATE INDEX IF NOT EXISTS "campaign_homebrew_spell_campaignId_status_idx"
  ON "campaign_homebrew_spell"("campaignId", "status");
CREATE INDEX IF NOT EXISTS "campaign_homebrew_spell_spellId_idx"
  ON "campaign_homebrew_spell"("spellId");
CREATE INDEX IF NOT EXISTS "campaign_homebrew_spell_submittedById_idx"
  ON "campaign_homebrew_spell"("submittedById");

CREATE TABLE IF NOT EXISTS "character_homebrew_spell" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "characterId" TEXT NOT NULL,
  "spellId" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "sourceCampaignId" TEXT,
  "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "character_homebrew_spell_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "character"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "character_homebrew_spell_spellId_fkey"
    FOREIGN KEY ("spellId") REFERENCES "homebrew_spell"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "character_homebrew_spell_grantedById_fkey"
    FOREIGN KEY ("grantedById") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "character_homebrew_spell_sourceCampaignId_fkey"
    FOREIGN KEY ("sourceCampaignId") REFERENCES "campaign"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "character_homebrew_spell_characterId_spellId_key"
    UNIQUE ("characterId", "spellId")
);

CREATE INDEX IF NOT EXISTS "character_homebrew_spell_spellId_idx"
  ON "character_homebrew_spell"("spellId");
CREATE INDEX IF NOT EXISTS "character_homebrew_spell_grantedById_idx"
  ON "character_homebrew_spell"("grantedById");
CREATE INDEX IF NOT EXISTS "character_homebrew_spell_sourceCampaignId_idx"
  ON "character_homebrew_spell"("sourceCampaignId");

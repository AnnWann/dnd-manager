-- The Prisma schema has referenced these models since the authenticated
-- homebrew-spell API was introduced, but no migration created their backing
-- tables. Keep this migration additive so existing development databases can
-- safely catch up.

DO $$
BEGIN
  CREATE TYPE "HomebrewSpellStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CampaignSpellApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CampaignCharacter.visibility is present in schema.prisma but was also absent
-- from the original campaigns migration.
ALTER TABLE "campaign_character"
  ADD COLUMN IF NOT EXISTS "visibility" "CharacterVisibility" NOT NULL DEFAULT 'PARTY';

CREATE TABLE IF NOT EXISTS "homebrew_spell" (
  "id" TEXT NOT NULL,
  "index" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "status" "HomebrewSpellStatus" NOT NULL DEFAULT 'ACTIVE',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "homebrew_spell_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "homebrew_spell_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "homebrew_spell_index_key"
  ON "homebrew_spell"("index");
CREATE INDEX IF NOT EXISTS "homebrew_spell_ownerId_status_idx"
  ON "homebrew_spell"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "homebrew_spell_name_idx"
  ON "homebrew_spell"("name");

CREATE TABLE IF NOT EXISTS "campaign_homebrew_spell" (
  "id" TEXT NOT NULL,
  "status" "CampaignSpellApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "campaignId" TEXT NOT NULL,
  "spellId" TEXT NOT NULL,
  "submittedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "campaign_homebrew_spell_pkey" PRIMARY KEY ("id"),
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
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_homebrew_spell_campaignId_spellId_key"
  ON "campaign_homebrew_spell"("campaignId", "spellId");
CREATE INDEX IF NOT EXISTS "campaign_homebrew_spell_campaignId_status_idx"
  ON "campaign_homebrew_spell"("campaignId", "status");
CREATE INDEX IF NOT EXISTS "campaign_homebrew_spell_spellId_idx"
  ON "campaign_homebrew_spell"("spellId");
CREATE INDEX IF NOT EXISTS "campaign_homebrew_spell_submittedById_idx"
  ON "campaign_homebrew_spell"("submittedById");

CREATE TABLE IF NOT EXISTS "character_homebrew_spell" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "spellId" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "sourceCampaignId" TEXT,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "character_homebrew_spell_pkey" PRIMARY KEY ("id"),
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
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "character_homebrew_spell_characterId_spellId_key"
  ON "character_homebrew_spell"("characterId", "spellId");
CREATE INDEX IF NOT EXISTS "character_homebrew_spell_spellId_idx"
  ON "character_homebrew_spell"("spellId");
CREATE INDEX IF NOT EXISTS "character_homebrew_spell_grantedById_idx"
  ON "character_homebrew_spell"("grantedById");
CREATE INDEX IF NOT EXISTS "character_homebrew_spell_sourceCampaignId_idx"
  ON "character_homebrew_spell"("sourceCampaignId");

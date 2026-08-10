DO $$
BEGIN
  CREATE TYPE "CharacterDataDomain" AS ENUM (
    'SHEET',
    'VITALS',
    'PROFILE',
    'ABILITIES',
    'MAGIC',
    'INVENTORY',
    'EQUIPMENT',
    'PROGRESSION',
    'NOTES'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "character"
  ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "user_character_domain_state" (
  "id" TEXT NOT NULL,
  "domain" "CharacterDataDomain" NOT NULL,
  "data" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "characterId" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_character_domain_state_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_character_domain_state_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "character"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_character_domain_state_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_character_domain_state_characterId_domain_key"
  ON "user_character_domain_state"("characterId", "domain");
CREATE INDEX IF NOT EXISTS "user_character_domain_state_characterId_idx"
  ON "user_character_domain_state"("characterId");
CREATE INDEX IF NOT EXISTS "user_character_domain_state_updatedById_idx"
  ON "user_character_domain_state"("updatedById");

CREATE TABLE IF NOT EXISTS "user_character_domain_mutation" (
  "id" TEXT NOT NULL,
  "domain" "CharacterDataDomain" NOT NULL,
  "previousRevision" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL,
  "operation" TEXT NOT NULL DEFAULT 'replace',
  "mutationId" TEXT,
  "clientId" TEXT,
  "characterId" TEXT NOT NULL,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_character_domain_mutation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_character_domain_mutation_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "character"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_character_domain_mutation_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_character_domain_mutation_characterId_domain_mutationId_key"
  ON "user_character_domain_mutation"("characterId", "domain", "mutationId");
CREATE INDEX IF NOT EXISTS "user_character_domain_mutation_characterId_createdAt_idx"
  ON "user_character_domain_mutation"("characterId", "createdAt");
CREATE INDEX IF NOT EXISTS "user_character_domain_mutation_actorId_idx"
  ON "user_character_domain_mutation"("actorId");

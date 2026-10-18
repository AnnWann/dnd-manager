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

-- Existing authenticated characters are decomposed immediately. Character.data
-- remains untouched as a rollback/bootstrap snapshot, but domain rows become the
-- source used by current reads and writes.
WITH domains("domain") AS (
  VALUES
    ('SHEET'::"CharacterDataDomain"),
    ('VITALS'::"CharacterDataDomain"),
    ('PROFILE'::"CharacterDataDomain"),
    ('ABILITIES'::"CharacterDataDomain"),
    ('MAGIC'::"CharacterDataDomain"),
    ('INVENTORY'::"CharacterDataDomain"),
    ('EQUIPMENT'::"CharacterDataDomain"),
    ('PROGRESSION'::"CharacterDataDomain"),
    ('NOTES'::"CharacterDataDomain")
)
INSERT INTO "user_character_domain_state" (
  "id",
  "domain",
  "data",
  "revision",
  "characterId",
  "updatedById",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  domains."domain",
  CASE domains."domain"
    WHEN 'SHEET' THEN
      jsonb_build_object(
        'sheet',
        COALESCE(character."data"->'sheet', '{}'::jsonb) - 'HP' - 'conditions'
      )
    WHEN 'VITALS' THEN
      jsonb_strip_nulls(
        jsonb_build_object(
          'HP', character."data"->'sheet'->'HP',
          'conditions', COALESCE(character."data"->'sheet'->'conditions', '[]'::jsonb),
          'deathSaves', character."data"->'deathSaves',
          'actionsPerTurn', character."data"->'actionsPerTurn'
        )
      )
    WHEN 'PROFILE' THEN
      jsonb_strip_nulls(jsonb_build_object('profile', character."data"->'profile'))
    WHEN 'ABILITIES' THEN
      jsonb_build_object(
        'abilities',
        COALESCE(character."data"->'abilities', '[]'::jsonb)
      )
    WHEN 'MAGIC' THEN
      jsonb_build_object('magic', character."data"->'magic')
    WHEN 'INVENTORY' THEN
      jsonb_build_object(
        'inventory',
        COALESCE(character."data"->'inventory', '[]'::jsonb)
      )
    WHEN 'EQUIPMENT' THEN
      jsonb_strip_nulls(jsonb_build_object('equipment', character."data"->'equipment'))
    WHEN 'PROGRESSION' THEN
      jsonb_build_object(
        'asi', COALESCE(character."data"->'asi', '[]'::jsonb),
        'classProgressionVersion', COALESCE(character."data"->'classProgressionVersion', '0'::jsonb)
      )
    WHEN 'NOTES' THEN
      jsonb_build_object(
        'notes',
        COALESCE(character."data"->'notes', '[]'::jsonb)
      )
  END,
  1,
  character."id",
  character."ownerId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "character" AS character
CROSS JOIN domains
ON CONFLICT ("characterId", "domain") DO NOTHING;

INSERT INTO "user_character_domain_mutation" (
  "id",
  "domain",
  "previousRevision",
  "revision",
  "operation",
  "mutationId",
  "characterId",
  "actorId",
  "createdAt"
)
SELECT
  gen_random_uuid()::text,
  state."domain",
  0,
  state."revision",
  'migration',
  'migration:' || state."characterId" || ':' || state."domain"::text,
  state."characterId",
  character."ownerId",
  CURRENT_TIMESTAMP
FROM "user_character_domain_state" AS state
JOIN "character" AS character
  ON character."id" = state."characterId"
ON CONFLICT ("characterId", "domain", "mutationId") DO NOTHING;

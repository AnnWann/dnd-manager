-- Session character ownership/configuration belongs to the campaign link, not to
-- the user's personal Character record. Backfill the current assignment so
-- existing campaigns keep their present behavior while future transfers are
-- isolated to the session.
ALTER TABLE "campaign_character"
  ADD COLUMN "assignedUserId" TEXT,
  ADD COLUMN "configuration" JSONB;

UPDATE "campaign_character" AS cc
SET "assignedUserId" = c."ownerId"
FROM "character" AS c
WHERE c."id" = cc."characterId"
  AND cc."assignedUserId" IS NULL;

CREATE INDEX "campaign_character_assignedUserId_idx"
  ON "campaign_character"("assignedUserId");

ALTER TABLE "campaign_character"
  ADD CONSTRAINT "campaign_character_assignedUserId_fkey"
  FOREIGN KEY ("assignedUserId") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

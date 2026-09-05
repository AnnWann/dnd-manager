ALTER TABLE "campaign_member"
ADD COLUMN "permissions" JSONB NOT NULL DEFAULT '{}'::jsonb;

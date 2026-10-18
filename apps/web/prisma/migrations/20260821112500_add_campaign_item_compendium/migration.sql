CREATE TABLE IF NOT EXISTS "campaign_item_compendium" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "item" JSONB NOT NULL,
  "custom" BOOLEAN NOT NULL DEFAULT false,
  "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "campaign_item_compendium_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_item_compendium_campaign_template_key"
  ON "campaign_item_compendium"("campaignId", "templateId");

CREATE INDEX IF NOT EXISTS "campaign_item_compendium_campaign_visibility_idx"
  ON "campaign_item_compendium"("campaignId", "visibility");

CREATE INDEX IF NOT EXISTS "campaign_item_compendium_created_by_idx"
  ON "campaign_item_compendium"("createdById");

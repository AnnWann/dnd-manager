CREATE TABLE IF NOT EXISTS "campaign_content_request" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "title" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "note" TEXT,
  "submittedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "campaign_content_request_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_content_request_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "campaign"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_content_request_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_content_request_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_content_request_campaign_type_source_key"
  ON "campaign_content_request"("campaignId", "type", "sourceId");
CREATE INDEX IF NOT EXISTS "campaign_content_request_campaign_status_idx"
  ON "campaign_content_request"("campaignId", "status");
CREATE INDEX IF NOT EXISTS "campaign_content_request_submitter_idx"
  ON "campaign_content_request"("submittedById");

CREATE TABLE IF NOT EXISTS "campaign_homebrew_asset" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "addedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "campaign_homebrew_asset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_homebrew_asset_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "campaign"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_homebrew_asset_addedById_fkey"
    FOREIGN KEY ("addedById") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_homebrew_asset_campaign_type_source_key"
  ON "campaign_homebrew_asset"("campaignId", "type", "sourceId");
CREATE INDEX IF NOT EXISTS "campaign_homebrew_asset_campaign_type_idx"
  ON "campaign_homebrew_asset"("campaignId", "type");

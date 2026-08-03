-- CreateEnum
CREATE TYPE "CampaignRole" AS ENUM ('MASTER', 'PLAYER');

-- CreateEnum
CREATE TYPE "CampaignMemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'REMOVED');

-- CreateTable
CREATE TABLE "campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "inviteCode" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_member" (
    "id" TEXT NOT NULL,
    "role" "CampaignRole" NOT NULL DEFAULT 'PLAYER',
    "status" "CampaignMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_character" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_character_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaign_inviteCode_key" ON "campaign"("inviteCode");

-- CreateIndex
CREATE INDEX "campaign_ownerId_idx" ON "campaign"("ownerId");

-- CreateIndex
CREATE INDEX "campaign_member_userId_idx" ON "campaign_member"("userId");

-- CreateIndex
CREATE INDEX "campaign_member_campaignId_idx" ON "campaign_member"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_member_campaignId_userId_key" ON "campaign_member"("campaignId", "userId");

-- CreateIndex
CREATE INDEX "campaign_character_campaignId_idx" ON "campaign_character"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_character_characterId_idx" ON "campaign_character"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_character_campaignId_characterId_key" ON "campaign_character"("campaignId", "characterId");

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_member" ADD CONSTRAINT "campaign_member_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_member" ADD CONSTRAINT "campaign_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_character" ADD CONSTRAINT "campaign_character_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_character" ADD CONSTRAINT "campaign_character_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

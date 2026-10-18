-- CreateEnum
CREATE TYPE "CharacterVisibility" AS ENUM ('PRIVATE', 'PARTY', 'MASTER');

-- CreateTable
CREATE TABLE "character" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "visibility" "CharacterVisibility" NOT NULL DEFAULT 'PRIVATE',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "character_ownerId_idx" ON "character"("ownerId");

-- AddForeignKey
ALTER TABLE "character" ADD CONSTRAINT "character_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

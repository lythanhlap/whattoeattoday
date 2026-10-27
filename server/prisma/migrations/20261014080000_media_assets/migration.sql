CREATE TYPE "MediaAssetStatus" AS ENUM ('UPLOADED', 'ATTACHED', 'CLEANING', 'DELETED');

CREATE TABLE "media_assets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "provider" VARCHAR(30) NOT NULL DEFAULT 'CLOUDINARY',
  "providerPublicId" VARCHAR(255) NOT NULL,
  "secureUrl" VARCHAR(2048),
  "format" VARCHAR(20),
  "bytes" INTEGER NOT NULL DEFAULT 0,
  "status" "MediaAssetStatus" NOT NULL DEFAULT 'UPLOADED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attachedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "media_assets_providerPublicId_key" ON "media_assets"("providerPublicId");
CREATE INDEX "media_assets_ownerId_status_createdAt_idx" ON "media_assets"("ownerId", "status", "createdAt");
CREATE INDEX "media_assets_status_createdAt_idx" ON "media_assets"("status", "createdAt");
ALTER TABLE "cooksnaps" ADD COLUMN "mediaAssetId" UUID;
CREATE UNIQUE INDEX "cooksnaps_mediaAssetId_key" ON "cooksnaps"("mediaAssetId");

ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cooksnaps" ADD CONSTRAINT "cooksnaps_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

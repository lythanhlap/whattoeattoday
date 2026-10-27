-- Recipe cover image relation and editorial review metadata.

ALTER TABLE "recipes"
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewNote" VARCHAR(1000);

-- Existing databases may contain coverImageId values that were never linked to a
-- media asset. Clear them before enforcing the foreign key.
UPDATE "recipes"
SET "coverImageId" = NULL
WHERE "coverImageId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "media_assets" WHERE "media_assets"."id" = "recipes"."coverImageId"
  );

CREATE INDEX "recipes_coverImageId_idx" ON "recipes"("coverImageId");

ALTER TABLE "recipes"
ADD CONSTRAINT "recipes_coverImageId_fkey"
FOREIGN KEY ("coverImageId") REFERENCES "media_assets"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

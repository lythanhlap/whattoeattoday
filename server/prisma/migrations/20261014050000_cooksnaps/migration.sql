CREATE TYPE "CooksnapStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'DELETED');

CREATE TABLE "cooksnaps" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "recipeId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "imageUrl" VARCHAR(2048) NOT NULL,
  "caption" VARCHAR(1000),
  "status" "CooksnapStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "cooksnaps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cooksnaps_recipeId_status_createdAt_idx" ON "cooksnaps"("recipeId", "status", "createdAt");
CREATE INDEX "cooksnaps_authorId_status_createdAt_idx" ON "cooksnaps"("authorId", "status", "createdAt");

ALTER TABLE "cooksnaps" ADD CONSTRAINT "cooksnaps_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cooksnaps" ADD CONSTRAINT "cooksnaps_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

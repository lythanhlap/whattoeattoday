CREATE TABLE "comments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "recipeId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "content" VARCHAR(2000) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "comments_recipeId_status_createdAt_idx" ON "comments"("recipeId", "status", "createdAt");
CREATE INDEX "comments_authorId_status_createdAt_idx" ON "comments"("authorId", "status", "createdAt");
ALTER TABLE "comments" ADD CONSTRAINT "comments_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

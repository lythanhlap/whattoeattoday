ALTER TABLE "recipes" ADD COLUMN "featuredAt" TIMESTAMP(3);
CREATE INDEX "recipes_featuredAt_idx" ON "recipes"("featuredAt");

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'UPCOMING', 'ACTIVE', 'ENDED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "challenges" (
    "id" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" VARCHAR(2000),
    "bannerUrl" VARCHAR(2048),
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_entries" (
    "id" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "submittedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedById" UUID,

    CONSTRAINT "challenge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_views" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "viewerKey" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "challenges_status_startsAt_idx" ON "challenges"("status", "startsAt");

-- CreateIndex
CREATE INDEX "challenges_endsAt_idx" ON "challenges"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_entries_challengeId_recipeId_key" ON "challenge_entries"("challengeId", "recipeId");

-- CreateIndex
CREATE INDEX "challenge_entries_challengeId_removedAt_createdAt_idx" ON "challenge_entries"("challengeId", "removedAt", "createdAt");

-- CreateIndex
CREATE INDEX "challenge_entries_recipeId_idx" ON "challenge_entries"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_views_recipeId_viewerKey_key" ON "recipe_views"("recipeId", "viewerKey");

-- CreateIndex
CREATE INDEX "recipe_views_recipeId_createdAt_idx" ON "recipe_views"("recipeId", "createdAt");

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_entries" ADD CONSTRAINT "challenge_entries_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_entries" ADD CONSTRAINT "challenge_entries_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_entries" ADD CONSTRAINT "challenge_entries_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_entries" ADD CONSTRAINT "challenge_entries_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_views" ADD CONSTRAINT "recipe_views_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

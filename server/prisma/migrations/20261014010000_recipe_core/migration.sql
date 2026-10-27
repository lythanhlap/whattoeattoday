-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RecipeVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "authorId" UUID NOT NULL,
    "categoryId" UUID,
    "title" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" VARCHAR(2000),
    "coverImageId" UUID,
    "prepTimeMinutes" INTEGER,
    "cookTimeMinutes" INTEGER,
    "totalTimeMinutes" INTEGER,
    "servings" INTEGER,
    "difficulty" "RecipeDifficulty",
    "tips" VARCHAR(3000),
    "substitutions" VARCHAR(3000),
    "storageInstructions" VARCHAR(2000),
    "status" "RecipeStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "RecipeVisibility" NOT NULL DEFAULT 'PRIVATE',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "cookSnapCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_ingredients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipeId" UUID NOT NULL,
    "ingredientId" UUID,
    "displayName" VARCHAR(150) NOT NULL,
    "quantity" VARCHAR(50),
    "unit" VARCHAR(50),
    "note" VARCHAR(300),
    "sortOrder" INTEGER NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipeId" UUID NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "instruction" VARCHAR(3000) NOT NULL,
    "imageId" UUID,
    "durationMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recipe_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_tags" (
    "recipeId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    CONSTRAINT "recipe_tags_pkey" PRIMARY KEY ("recipeId", "tagId")
);

CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_name_idx" ON "categories"("name");
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");
CREATE INDEX "tags_name_idx" ON "tags"("name");
CREATE UNIQUE INDEX "recipes_slug_key" ON "recipes"("slug");
CREATE INDEX "recipes_authorId_idx" ON "recipes"("authorId");
CREATE INDEX "recipes_categoryId_idx" ON "recipes"("categoryId");
CREATE INDEX "recipes_status_visibility_idx" ON "recipes"("status", "visibility");
CREATE INDEX "recipes_publishedAt_idx" ON "recipes"("publishedAt");
CREATE INDEX "recipes_createdAt_idx" ON "recipes"("createdAt");
CREATE INDEX "recipes_deletedAt_idx" ON "recipes"("deletedAt");
CREATE INDEX "recipe_ingredients_recipeId_sortOrder_idx" ON "recipe_ingredients"("recipeId", "sortOrder");
CREATE UNIQUE INDEX "recipe_steps_recipeId_stepNumber_key" ON "recipe_steps"("recipeId", "stepNumber");
CREATE INDEX "recipe_steps_recipeId_stepNumber_idx" ON "recipe_steps"("recipeId", "stepNumber");
CREATE INDEX "recipe_tags_tagId_idx" ON "recipe_tags"("tagId");

ALTER TABLE "recipes" ADD CONSTRAINT "recipes_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

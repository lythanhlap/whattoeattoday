-- CreateTable
CREATE TABLE "recipe_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipeId" UUID NOT NULL,
    "mediaAssetId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipe_images_mediaAssetId_key" ON "recipe_images"("mediaAssetId");

-- CreateIndex
CREATE INDEX "recipe_images_recipeId_sortOrder_idx" ON "recipe_images"("recipeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_images_recipeId_mediaAssetId_key" ON "recipe_images"("recipeId", "mediaAssetId");

-- AddForeignKey
ALTER TABLE "recipe_images" ADD CONSTRAINT "recipe_images_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_images" ADD CONSTRAINT "recipe_images_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

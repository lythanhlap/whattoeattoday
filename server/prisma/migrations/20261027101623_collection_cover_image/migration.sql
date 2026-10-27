-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "coverImageId" UUID;

-- CreateIndex
CREATE INDEX "collections_coverImageId_idx" ON "collections"("coverImageId");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

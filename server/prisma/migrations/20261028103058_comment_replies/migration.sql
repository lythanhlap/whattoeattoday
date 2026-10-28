-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "parentId" UUID;

-- CreateIndex
CREATE INDEX "comments_parentId_status_createdAt_idx" ON "comments"("parentId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

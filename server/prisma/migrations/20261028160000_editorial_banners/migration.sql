-- Editorial banners shown on the home page, managed by editors and admins.
CREATE TABLE "banners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(120) NOT NULL,
    "subtitle" VARCHAR(240),
    "linkUrl" VARCHAR(500),
    "imageId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "banners_isActive_sortOrder_idx" ON "banners"("isActive", "sortOrder");
CREATE INDEX "banners_startsAt_endsAt_idx" ON "banners"("startsAt", "endsAt");

ALTER TABLE "banners" ADD CONSTRAINT "banners_imageId_fkey"
  FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "banners" ADD CONSTRAINT "banners_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

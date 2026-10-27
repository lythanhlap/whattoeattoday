-- Add temporary suspension metadata for moderator account actions.
ALTER TABLE "users" ADD COLUMN "suspendedUntil" TIMESTAMP(3),
ADD COLUMN "suspensionReason" VARCHAR(500);

CREATE INDEX "users_suspendedUntil_idx" ON "users"("suspendedUntil");

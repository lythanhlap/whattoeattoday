-- Add an optional in-app destination so notifications can link to their subject.
ALTER TABLE "notifications" ADD COLUMN "actionUrl" VARCHAR(500);

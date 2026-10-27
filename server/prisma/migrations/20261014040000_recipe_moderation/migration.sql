CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'COPIED_CONTENT', 'IRRELEVANT_IMAGE', 'DANGEROUS_OR_MISLEADING', 'HARASSMENT', 'COPYRIGHT', 'OFF_TOPIC', 'OTHER');
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'DISMISSED', 'RESOLVED');

ALTER TABLE "recipes"
  ADD COLUMN "hiddenAt" TIMESTAMP(3),
  ADD COLUMN "hiddenReason" VARCHAR(500);

CREATE TABLE "reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reporterId" UUID NOT NULL,
  "recipeId" UUID NOT NULL,
  "reason" "ReportReason" NOT NULL,
  "description" VARCHAR(1000),
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedBy" UUID,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actorId" UUID NOT NULL,
  "action" VARCHAR(100) NOT NULL,
  "targetType" VARCHAR(50) NOT NULL,
  "targetId" UUID NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reports_status_createdAt_idx" ON "reports"("status", "createdAt");
CREATE INDEX "reports_recipeId_status_idx" ON "reports"("recipeId", "status");
CREATE INDEX "reports_reporterId_createdAt_idx" ON "reports"("reporterId", "createdAt");
CREATE INDEX "audit_logs_targetType_targetId_createdAt_idx" ON "audit_logs"("targetType", "targetId", "createdAt");
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolvedBy_fkey"
  FOREIGN KEY ("resolvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_recipeId_fkey"
  FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

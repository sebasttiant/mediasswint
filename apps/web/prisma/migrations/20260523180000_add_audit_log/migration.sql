-- Create AuditAction enum
CREATE TYPE "AuditAction" AS ENUM (
  'CREATE',
  'UPDATE',
  'DELETE'
);

-- Create AuditLog table.
-- userId is nullable so system-level mutations (seeds, migrations, future
-- scheduled jobs) can still write rows without a logged-in actor.
-- On user delete the audit history MUST be preserved (compliance), so the
-- relation uses ON DELETE SET NULL — never CASCADE.
CREATE TABLE "AuditLog" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "userId"     TEXT,
  "action"     "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT NOT NULL,
  "diff"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Lookup by entity (per-record history) is the most common query.
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx"
  ON "AuditLog" ("entityType", "entityId", "createdAt" DESC);

-- Lookup by user (who-did-what) for accountability reviews.
CREATE INDEX "AuditLog_userId_createdAt_idx"
  ON "AuditLog" ("userId", "createdAt" DESC);

-- Plain time-range scans for the admin endpoint.
CREATE INDEX "AuditLog_createdAt_idx"
  ON "AuditLog" ("createdAt" DESC);

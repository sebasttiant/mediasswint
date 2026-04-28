CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');

ALTER TABLE "User"
  ADD COLUMN "fullName" TEXT,
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'STAFF';

UPDATE "User"
SET "role" = 'ADMIN'
WHERE "email" = 'admin@ilasesorias.com';

CREATE INDEX "User_role_idx" ON "User"("role");

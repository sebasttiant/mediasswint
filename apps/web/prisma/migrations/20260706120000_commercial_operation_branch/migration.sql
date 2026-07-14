-- Client improvement: Sucursal (branch) on CommercialOperation. Additive and
-- nullable — legacy rows stay NULL, so this is safe to apply on production data.
-- Controlled vocabulary defined by the client. ITAGUI stored ASCII; the display
-- label carries the accent.

-- CreateEnum
CREATE TYPE "OperationBranch" AS ENUM ('CENTRO', 'HSVP', 'ITAGUI', 'TERMINAL');

-- AlterTable
ALTER TABLE "CommercialOperation" ADD COLUMN     "branch" "OperationBranch";

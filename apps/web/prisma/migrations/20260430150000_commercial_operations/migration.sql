-- Create CommercialOperationStatus enum
CREATE TYPE "CommercialOperationStatus" AS ENUM (
  'PRESUPUESTO',
  'CONFIRMADO',
  'EN_PRODUCCION',
  'ENTREGADO',
  'CANCELADO'
);

-- Create CommercialOperation table
CREATE TABLE "CommercialOperation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "patientId" TEXT NOT NULL,
  "status" "CommercialOperationStatus" NOT NULL DEFAULT 'PRESUPUESTO',
  "totalAmount" DECIMAL(10,2),
  "depositPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "garmentType" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialOperation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create index for patient operations listing
CREATE INDEX "CommercialOperation_patientId_createdAt_idx" ON "CommercialOperation" ("patientId", "createdAt" DESC);

-- Add operations relation to Patient (handled by Prisma, but column exists via FK)

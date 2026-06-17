-- Etapa F: Caja y Finanzas — payment ledger, expenses, daily cash count.
--
-- Fully additive. No existing table is altered destructively: CommercialOperation
-- keeps depositPaid as the cached running total. The new PaymentMovement table is
-- the source of truth for the daily cashbox going forward. Legacy deposits are NOT
-- backfilled (no trustworthy date/method), so they never appear in the cashbox.

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'BOLD', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'OTRO');

-- CreateEnum
CREATE TYPE "PaymentBank" AS ENUM ('BANCOLOMBIA', 'NEQUI', 'DAVIPLATA', 'OTRO_BANCO', 'OTRO');

-- CreateEnum
CREATE TYPE "PaymentIncomeType" AS ENUM ('PRIMERA_VEZ', 'R', 'MEFE', 'RECLAMADO_PRIMERA_VEZ', 'RECLAMADO_R');

-- CreateTable
CREATE TABLE "PaymentMovement" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "bank" "PaymentBank",
    "incomeType" "PaymentIncomeType" NOT NULL DEFAULT 'PRIMERA_VEZ',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "concept" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCashCount" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "countedAmount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCashCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentMovement_paidAt_idx" ON "PaymentMovement"("paidAt");

-- CreateIndex
CREATE INDEX "PaymentMovement_operationId_idx" ON "PaymentMovement"("operationId");

-- CreateIndex
CREATE INDEX "PaymentMovement_patientId_idx" ON "PaymentMovement"("patientId");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCashCount_date_key" ON "DailyCashCount"("date");

-- AddForeignKey
ALTER TABLE "PaymentMovement" ADD CONSTRAINT "PaymentMovement_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "CommercialOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMovement" ADD CONSTRAINT "PaymentMovement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

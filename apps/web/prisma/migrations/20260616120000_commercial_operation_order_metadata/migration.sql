-- Etapa E: Commercial Operation order metadata v1 (additive, all nullable).
-- No payment-method, cashbox, claim or delivery semantics yet.
ALTER TABLE "CommercialOperation"
  ADD COLUMN "orderNumber" TEXT,
  ADD COLUMN "orderedAt" TIMESTAMP(3),
  ADD COLUMN "productCode" TEXT,
  ADD COLUMN "productType" TEXT,
  ADD COLUMN "quantity" INTEGER DEFAULT 1,
  ADD COLUMN "invoiceNumber" TEXT,
  ADD COLUMN "invoiceDate" TIMESTAMP(3),
  ADD COLUMN "discount" DECIMAL(10,2),
  ADD COLUMN "exitDate" TIMESTAMP(3);

-- Non-unique index for order-number lookups. Intentionally NOT unique: the
-- legacy Excel data contains duplicate/cancelled/repair/historical order rows.
-- Promotion to a unique constraint is deferred until after data profiling.
CREATE INDEX "CommercialOperation_orderNumber_idx" ON "CommercialOperation" ("orderNumber");

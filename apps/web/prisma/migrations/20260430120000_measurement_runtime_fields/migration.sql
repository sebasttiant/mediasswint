ALTER TABLE "TemplateField"
  ADD COLUMN "minValue" DECIMAL(10,2),
  ADD COLUMN "maxValue" DECIMAL(10,2),
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "MeasurementSession"
  ADD COLUMN "diagnosis" TEXT,
  ADD COLUMN "garmentType" TEXT,
  ADD COLUMN "compressionClass" TEXT,
  ADD COLUMN "templateSnapshot" JSONB,
  ADD COLUMN "productFlags" JSONB,
  ADD COLUMN "metadata" JSONB;

-- Additive only: both columns default to true, so every existing row backfills
-- as part of the current definition, which is what it is today. Reversible by
-- dropping the two columns and their indexes. No data is transformed.
--
-- NOTE: `prisma migrate dev` also wanted to emit
--   ALTER TABLE "CommercialOperation" ALTER COLUMN "updatedAt" DROP DEFAULT;
-- That is pre-existing drift between the schema and the migration history,
-- unrelated to template retirement, and was deliberately left out of this
-- migration rather than smuggled in.

-- AlterTable
ALTER TABLE "TemplateField" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "TemplateSection" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "TemplateField_sectionId_isActive_idx" ON "TemplateField"("sectionId", "isActive");

-- CreateIndex
CREATE INDEX "TemplateSection_templateId_isActive_idx" ON "TemplateSection"("templateId", "isActive");

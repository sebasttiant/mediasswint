-- CreateEnum
CREATE TYPE "TemplateFieldType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT');

-- CreateEnum
CREATE TYPE "MeasurementSessionStatus" AS ENUM ('DRAFT', 'COMPLETED', 'VOID');

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "fullName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeasurementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateField" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "TemplateFieldType" NOT NULL,
    "unit" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementSession" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "templateId" TEXT,
    "status" "MeasurementSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeasurementSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementValue" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(10,2),
    "valueBoolean" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeasurementValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Patient_fullName_idx" ON "Patient"("fullName");

-- CreateIndex
CREATE INDEX "Patient_documentNumber_idx" ON "Patient"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_documentType_documentNumber_key" ON "Patient"("documentType", "documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementTemplate_code_key" ON "MeasurementTemplate"("code");

-- CreateIndex
CREATE INDEX "MeasurementTemplate_isActive_idx" ON "MeasurementTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementTemplate_name_version_key" ON "MeasurementTemplate"("name", "version");

-- CreateIndex
CREATE INDEX "TemplateSection_templateId_sortOrder_idx" ON "TemplateSection"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateSection_templateId_title_key" ON "TemplateSection"("templateId", "title");

-- CreateIndex
CREATE INDEX "TemplateField_sectionId_sortOrder_idx" ON "TemplateField"("sectionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateField_sectionId_key_key" ON "TemplateField"("sectionId", "key");

-- CreateIndex
CREATE INDEX "MeasurementSession_patientId_measuredAt_idx" ON "MeasurementSession"("patientId", "measuredAt");

-- CreateIndex
CREATE INDEX "MeasurementSession_templateId_idx" ON "MeasurementSession"("templateId");

-- CreateIndex
CREATE INDEX "MeasurementSession_status_idx" ON "MeasurementSession"("status");

-- CreateIndex
CREATE INDEX "MeasurementValue_fieldId_idx" ON "MeasurementValue"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementValue_sessionId_fieldId_key" ON "MeasurementValue"("sessionId", "fieldId");

-- AddForeignKey
ALTER TABLE "TemplateSection" ADD CONSTRAINT "TemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MeasurementTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateField" ADD CONSTRAINT "TemplateField_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TemplateSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementSession" ADD CONSTRAINT "MeasurementSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementSession" ADD CONSTRAINT "MeasurementSession_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MeasurementTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementValue" ADD CONSTRAINT "MeasurementValue_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeasurementSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementValue" ADD CONSTRAINT "MeasurementValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "TemplateField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

import { Prisma } from "@prisma/client";

import {
  buildCompressionTemplate,
  type CompressionTemplate,
} from "./compression-template";
import { getPrisma } from "./prisma";

export type UpsertTemplateInput = {
  code: string;
  name: string;
  version: number;
  description: string;
};

export type UpsertSectionInput = {
  templateId: string;
  title: string;
  sortOrder: number;
};

export type UpsertFieldInput = {
  sectionId: string;
  key: string;
  label: string;
  fieldType: "NUMBER";
  unit: string;
  isRequired: boolean;
  sortOrder: number;
  minValue: number;
  maxValue: number;
  metadata: Record<string, unknown>;
};

export type MeasurementTemplatesRepository = {
  upsertTemplate(input: UpsertTemplateInput): Promise<{ id: string }>;
  upsertSection(input: UpsertSectionInput): Promise<{ id: string }>;
  upsertField(input: UpsertFieldInput): Promise<{ id: string }>;
};

export type SyncTemplateResult = {
  templateId: string;
  sectionsCount: number;
  fieldsCount: number;
};

export async function syncMeasurementTemplate(
  template: CompressionTemplate,
  repository: MeasurementTemplatesRepository,
): Promise<SyncTemplateResult> {
  const tpl = await repository.upsertTemplate({
    code: template.code,
    name: template.name,
    version: template.version,
    description: template.description,
  });

  let fieldsCount = 0;

  for (const section of template.sections) {
    const sec = await repository.upsertSection({
      templateId: tpl.id,
      title: section.title,
      sortOrder: section.sortOrder,
    });

    for (const field of section.fields) {
      await repository.upsertField({
        sectionId: sec.id,
        key: field.key,
        label: field.label,
        fieldType: field.fieldType,
        unit: field.unit,
        isRequired: field.isRequired,
        sortOrder: field.sortOrder,
        minValue: field.minValue,
        maxValue: field.maxValue,
        metadata: field.metadata,
      });
      fieldsCount += 1;
    }
  }

  return {
    templateId: tpl.id,
    sectionsCount: template.sections.length,
    fieldsCount,
  };
}

const defaultRepository: MeasurementTemplatesRepository = {
  async upsertTemplate(input) {
    const prisma = getPrisma();
    const record = await prisma.measurementTemplate.upsert({
      where: { code: input.code },
      update: {
        name: input.name,
        version: input.version,
        description: input.description,
        isActive: true,
      },
      create: {
        code: input.code,
        name: input.name,
        version: input.version,
        description: input.description,
        isActive: true,
      },
      select: { id: true },
    });
    return record;
  },

  async upsertSection(input) {
    const prisma = getPrisma();
    const record = await prisma.templateSection.upsert({
      where: {
        templateId_title: {
          templateId: input.templateId,
          title: input.title,
        },
      },
      update: { sortOrder: input.sortOrder },
      create: {
        templateId: input.templateId,
        title: input.title,
        sortOrder: input.sortOrder,
      },
      select: { id: true },
    });
    return record;
  },

  async upsertField(input) {
    const prisma = getPrisma();
    const metadata = input.metadata as Prisma.InputJsonValue;
    const record = await prisma.templateField.upsert({
      where: {
        sectionId_key: {
          sectionId: input.sectionId,
          key: input.key,
        },
      },
      update: {
        label: input.label,
        fieldType: input.fieldType,
        unit: input.unit,
        isRequired: input.isRequired,
        sortOrder: input.sortOrder,
        minValue: new Prisma.Decimal(input.minValue),
        maxValue: new Prisma.Decimal(input.maxValue),
        metadata,
      },
      create: {
        sectionId: input.sectionId,
        key: input.key,
        label: input.label,
        fieldType: input.fieldType,
        unit: input.unit,
        isRequired: input.isRequired,
        sortOrder: input.sortOrder,
        minValue: new Prisma.Decimal(input.minValue),
        maxValue: new Prisma.Decimal(input.maxValue),
        metadata,
      },
      select: { id: true },
    });
    return record;
  },
};

export function getDefaultMeasurementTemplatesRepository(): MeasurementTemplatesRepository {
  return defaultRepository;
}

export async function syncCompressionTemplate(
  repository: MeasurementTemplatesRepository = defaultRepository,
): Promise<SyncTemplateResult> {
  return syncMeasurementTemplate(buildCompressionTemplate(), repository);
}

import { Prisma } from "@prisma/client";

import { buildCompressionTemplate } from "./compression-template";
import { buildMascaraTemplate } from "./mascara-template";
import { buildMentoneraTemplate } from "./mentonera-template";
import { getPrisma } from "./prisma";

/**
 * Structural shape accepted by `syncMeasurementTemplate`. Any concrete
 * template type (e.g. `CompressionTemplate`, `MentoneraTemplate`) whose
 * field metadata is a plain record stays assignable here — this is what
 * lets the sync pipeline stay additive across garment-specific templates
 * without narrowing to a single shape.
 */
import { buildMpBermudaTemplate } from "./mp-bermuda-template";

export type MeasurementTemplateFieldInput = {
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

export type MeasurementTemplateSectionInput = {
  title: string;
  sortOrder: number;
  fields: ReadonlyArray<MeasurementTemplateFieldInput>;
};

export type MeasurementTemplateInput = {
  code: string;
  name: string;
  version: number;
  description: string;
  sections: ReadonlyArray<MeasurementTemplateSectionInput>;
};

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

export type DeactivateFieldsNotInInput = {
  sectionId: string;
  keys: ReadonlyArray<string>;
};

export type DeactivateSectionsNotInInput = {
  templateId: string;
  titles: ReadonlyArray<string>;
};

export type DeactivateResult = {
  deactivated: number;
};

export type MeasurementTemplatesRepository = {
  upsertTemplate(input: UpsertTemplateInput): Promise<{ id: string }>;
  upsertSection(input: UpsertSectionInput): Promise<{ id: string }>;
  upsertField(input: UpsertFieldInput): Promise<{ id: string }>;
  /**
   * Retire the fields of a section that the current definition no longer
   * declares. Deactivates; never deletes. Deleting is not an option here:
   * MeasurementValue.field is onDelete: Restrict, so removing a field that was
   * ever measured is refused by Postgres, and a field referenced only by a
   * draft's persisted snapshot would be deleted out from under a live draft.
   */
  deactivateFieldsNotIn(input: DeactivateFieldsNotInInput): Promise<DeactivateResult>;
  deactivateSectionsNotIn(input: DeactivateSectionsNotInInput): Promise<DeactivateResult>;
};

export type SyncTemplateResult = {
  templateId: string;
  sectionsCount: number;
  fieldsCount: number;
  /** Rows retired by this run because the definition no longer declares them. */
  deactivatedFieldsCount: number;
  deactivatedSectionsCount: number;
};

export async function syncMeasurementTemplate(
  template: MeasurementTemplateInput,
  repository: MeasurementTemplatesRepository,
): Promise<SyncTemplateResult> {
  const tpl = await repository.upsertTemplate({
    code: template.code,
    name: template.name,
    version: template.version,
    description: template.description,
  });

  let fieldsCount = 0;
  let deactivatedFieldsCount = 0;

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

    // Retire what this section no longer declares. Upserts run first so a key
    // that moved WITHIN the section is revived before this pass sees it.
    const retiredFields = await repository.deactivateFieldsNotIn({
      sectionId: sec.id,
      keys: section.fields.map((field) => field.key),
    });
    deactivatedFieldsCount += retiredFields.deactivated;
  }

  const retiredSections = await repository.deactivateSectionsNotIn({
    templateId: tpl.id,
    titles: template.sections.map((section) => section.title),
  });

  if (deactivatedFieldsCount > 0 || retiredSections.deactivated > 0) {
    console.warn("[templates:sync] retired rows no longer in the definition", {
      templateCode: template.code,
      templateId: tpl.id,
      deactivatedFields: deactivatedFieldsCount,
      deactivatedSections: retiredSections.deactivated,
    });
  }

  return {
    templateId: tpl.id,
    sectionsCount: template.sections.length,
    fieldsCount,
    deactivatedFieldsCount,
    deactivatedSectionsCount: retiredSections.deactivated,
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
      // isActive: true on update revives a section that a previous definition
      // had retired, instead of leaving it invisible to new snapshots.
      update: { sortOrder: input.sortOrder, isActive: true },
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
        // Revive a field the definition brings back.
        isActive: true,
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

  async deactivateFieldsNotIn(input) {
    const prisma = getPrisma();
    const result = await prisma.templateField.updateMany({
      where: {
        sectionId: input.sectionId,
        key: { notIn: [...input.keys] },
        isActive: true,
      },
      data: { isActive: false },
    });
    return { deactivated: result.count };
  },

  async deactivateSectionsNotIn(input) {
    const prisma = getPrisma();
    const obsolete = {
      templateId: input.templateId,
      title: { notIn: [...input.titles] },
    };

    // Retire the section's fields first: a field must never stay active under
    // an inactive section, or it would still be projected into new snapshots.
    await prisma.templateField.updateMany({
      where: { section: obsolete, isActive: true },
      data: { isActive: false },
    });

    const result = await prisma.templateSection.updateMany({
      where: { ...obsolete, isActive: true },
      data: { isActive: false },
    });
    return { deactivated: result.count };
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

export async function syncMentoneraTemplate(
  repository: MeasurementTemplatesRepository = defaultRepository,
): Promise<SyncTemplateResult> {
  return syncMeasurementTemplate(buildMentoneraTemplate(), repository);
}

export async function syncMascaraTemplate(
  repository: MeasurementTemplatesRepository = defaultRepository,
): Promise<SyncTemplateResult> {
  return syncMeasurementTemplate(buildMascaraTemplate(), repository);
}

export async function syncMpBermudaTemplate(
  repository: MeasurementTemplatesRepository = defaultRepository,
): Promise<SyncTemplateResult> {
  return syncMeasurementTemplate(buildMpBermudaTemplate(), repository);
}

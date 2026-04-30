import {
  COMPRESSION_MEASUREMENTS,
  type CompressionMeasurementDefinition,
} from "./compression-measurements";

export const COMPRESSION_TEMPLATE_CODE = "compression-v1";
export const COMPRESSION_TEMPLATE_NAME = "Compresión v1";
export const COMPRESSION_TEMPLATE_VERSION = 1;
export const COMPRESSION_TEMPLATE_DESCRIPTION =
  "Plantilla base de medición de compresión: piernas y brazos por punto y lado";

export type CompressionTemplateFieldMetadata = {
  anatomyZone: string;
  group: "legs" | "arms";
  side: "right" | "left";
  point: number;
};

export type CompressionTemplateField = {
  key: string;
  label: string;
  fieldType: "NUMBER";
  unit: "cm";
  isRequired: false;
  sortOrder: number;
  minValue: number;
  maxValue: number;
  metadata: CompressionTemplateFieldMetadata;
};

export type CompressionTemplateSection = {
  title: string;
  sortOrder: number;
  fields: ReadonlyArray<CompressionTemplateField>;
};

export type CompressionTemplate = {
  code: string;
  name: string;
  version: number;
  description: string;
  sections: ReadonlyArray<CompressionTemplateSection>;
};

const SECTION_TITLES: Record<"legs" | "arms", Record<"right" | "left", string>> = {
  legs: { right: "Pierna derecha", left: "Pierna izquierda" },
  arms: { right: "Brazo derecho", left: "Brazo izquierdo" },
};

const SECTION_ORDER: ReadonlyArray<{ group: "legs" | "arms"; side: "right" | "left" }> = [
  { group: "legs", side: "right" },
  { group: "legs", side: "left" },
  { group: "arms", side: "right" },
  { group: "arms", side: "left" },
];

function toField(definition: CompressionMeasurementDefinition): CompressionTemplateField {
  return {
    key: definition.key,
    label: definition.label,
    fieldType: "NUMBER",
    unit: definition.unit,
    isRequired: false,
    sortOrder: definition.point,
    minValue: definition.min,
    maxValue: definition.max,
    metadata: {
      anatomyZone: definition.anatomyZone,
      group: definition.group,
      side: definition.side,
      point: definition.point,
    },
  };
}

export function buildCompressionTemplate(
  catalog: ReadonlyArray<CompressionMeasurementDefinition> = COMPRESSION_MEASUREMENTS,
): CompressionTemplate {
  const sections = SECTION_ORDER.map(({ group, side }, index) => ({
    title: SECTION_TITLES[group][side],
    sortOrder: index,
    fields: catalog
      .filter((definition) => definition.group === group && definition.side === side)
      .map(toField),
  }));

  return {
    code: COMPRESSION_TEMPLATE_CODE,
    name: COMPRESSION_TEMPLATE_NAME,
    version: COMPRESSION_TEMPLATE_VERSION,
    description: COMPRESSION_TEMPLATE_DESCRIPTION,
    sections,
  };
}

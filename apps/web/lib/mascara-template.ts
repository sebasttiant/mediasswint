export const MASCARA_TEMPLATE_CODE = "mascara-v1";
export const MASCARA_TEMPLATE_NAME = "Máscara v1";
export const MASCARA_TEMPLATE_VERSION = 1;
export const MASCARA_TEMPLATE_DESCRIPTION =
  "Plantilla de medición de máscara: contorno de frente y circunferencia de cuello";

export type MascaraFieldKind = "circumference";

export type MascaraTemplateFieldMetadata = {
  anatomyZone: string;
  kind: MascaraFieldKind;
};

export type MascaraTemplateField = {
  key: string;
  label: string;
  fieldType: "NUMBER";
  unit: "cm";
  isRequired: false;
  sortOrder: number;
  minValue: number;
  maxValue: number;
  metadata: MascaraTemplateFieldMetadata;
};

export type MascaraTemplateSection = {
  title: string;
  sortOrder: number;
  fields: ReadonlyArray<MascaraTemplateField>;
};

export type MascaraTemplate = {
  code: string;
  name: string;
  version: number;
  description: string;
  sections: ReadonlyArray<MascaraTemplateSection>;
};

const MASCARA_RANGE_CM = { min: 0.1, max: 200 } as const;

type MascaraFieldDefinition = {
  key: string;
  label: string;
  anatomyZone: string;
};

// The client form's MÁSCARA panel fixes these two front-view circumferences.
const MASCARA_FIELD_DEFINITIONS: ReadonlyArray<MascaraFieldDefinition> = [
  {
    key: "mascaraForehead",
    label: "Contorno de la cabeza alrededor de la frente",
    anatomyZone: "head.forehead",
  },
  {
    key: "mascaraNeck",
    label: "Circunferencia del cuello",
    anatomyZone: "head.neck",
  },
];

function toField(definition: MascaraFieldDefinition, sortOrder: number): MascaraTemplateField {
  return {
    key: definition.key,
    label: definition.label,
    fieldType: "NUMBER",
    unit: "cm",
    isRequired: false,
    sortOrder,
    minValue: MASCARA_RANGE_CM.min,
    maxValue: MASCARA_RANGE_CM.max,
    metadata: {
      anatomyZone: definition.anatomyZone,
      kind: "circumference",
    },
  };
}

export function buildMascaraTemplate(): MascaraTemplate {
  return {
    code: MASCARA_TEMPLATE_CODE,
    name: MASCARA_TEMPLATE_NAME,
    version: MASCARA_TEMPLATE_VERSION,
    description: MASCARA_TEMPLATE_DESCRIPTION,
    sections: [
      {
        title: "Máscara",
        sortOrder: 0,
        fields: MASCARA_FIELD_DEFINITIONS.map(toField),
      },
    ],
  };
}

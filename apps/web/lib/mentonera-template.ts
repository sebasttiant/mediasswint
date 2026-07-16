export const MENTONERA_TEMPLATE_CODE = "mentonera-v1";
export const MENTONERA_TEMPLATE_NAME = "Mentonera v1";
export const MENTONERA_TEMPLATE_VERSION = 1;
export const MENTONERA_TEMPLATE_DESCRIPTION =
  "Plantilla de medición de mentonera: contorno, largo de cara y contorno de cuello";

export type MentoneraFieldKind = "circumference" | "length";

export type MentoneraTemplateFieldMetadata = {
  anatomyZone: string;
  kind: MentoneraFieldKind;
};

export type MentoneraTemplateField = {
  key: string;
  label: string;
  fieldType: "NUMBER";
  unit: "cm";
  isRequired: false;
  sortOrder: number;
  minValue: number;
  maxValue: number;
  metadata: MentoneraTemplateFieldMetadata;
};

export type MentoneraTemplateSection = {
  title: string;
  sortOrder: number;
  fields: ReadonlyArray<MentoneraTemplateField>;
};

export type MentoneraTemplate = {
  code: string;
  name: string;
  version: number;
  description: string;
  sections: ReadonlyArray<MentoneraTemplateSection>;
};

const MENTONERA_RANGE_CM = { min: 0.1, max: 200 } as const;

type MentoneraFieldDefinition = {
  key: string;
  label: string;
  anatomyZone: string;
  kind: MentoneraFieldKind;
};

// Fixed order: crown-to-chin circumference, face length, neck circumference.
const MENTONERA_FIELD_DEFINITIONS: ReadonlyArray<MentoneraFieldDefinition> = [
  {
    key: "mentoneraCrownChin",
    label: "Contorno mentón–coronilla",
    anatomyZone: "head.crownChin",
    kind: "circumference",
  },
  {
    key: "mentoneraFaceLength",
    label: "Largo de cara (frente–mentón)",
    anatomyZone: "head.faceLength",
    kind: "length",
  },
  {
    key: "mentoneraNeck",
    label: "Contorno de cuello",
    anatomyZone: "head.neck",
    kind: "circumference",
  },
];

function toField(definition: MentoneraFieldDefinition, sortOrder: number): MentoneraTemplateField {
  return {
    key: definition.key,
    label: definition.label,
    fieldType: "NUMBER",
    unit: "cm",
    isRequired: false,
    sortOrder,
    minValue: MENTONERA_RANGE_CM.min,
    maxValue: MENTONERA_RANGE_CM.max,
    metadata: {
      anatomyZone: definition.anatomyZone,
      kind: definition.kind,
    },
  };
}

export function buildMentoneraTemplate(): MentoneraTemplate {
  return {
    code: MENTONERA_TEMPLATE_CODE,
    name: MENTONERA_TEMPLATE_NAME,
    version: MENTONERA_TEMPLATE_VERSION,
    description: MENTONERA_TEMPLATE_DESCRIPTION,
    sections: [
      {
        title: "Mentonera",
        sortOrder: 0,
        fields: MENTONERA_FIELD_DEFINITIONS.map(toField),
      },
    ],
  };
}

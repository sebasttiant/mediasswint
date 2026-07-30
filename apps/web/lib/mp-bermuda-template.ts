export const MP_BERMUDA_TEMPLATE_CODE = "mp-bermuda-v1";
export const MP_BERMUDA_TEMPLATE_NAME = "Media pantalón y bermuda v1";
export const MP_BERMUDA_TEMPLATE_VERSION = 1;
export const MP_BERMUDA_TEMPLATE_DESCRIPTION =
  "Plantilla de medición bilateral para media pantalón y bermuda con peso y estatura";

const MP_BERMUDA_SIDE = {
  RIGHT: "right",
  LEFT: "left",
  SHARED: "shared",
} as const;

const MP_BERMUDA_FIELD_KIND = {
  BODY: "body",
  LENGTH: "length",
  CIRCUMFERENCE: "circumference",
  DISTANCE: "distance",
} as const;

type MpBermudaSide = (typeof MP_BERMUDA_SIDE)[keyof typeof MP_BERMUDA_SIDE];
type MpBermudaFieldKind = (typeof MP_BERMUDA_FIELD_KIND)[keyof typeof MP_BERMUDA_FIELD_KIND];

export type MpBermudaTemplateFieldMetadata = {
  layout: "mp-bermuda";
  kind: MpBermudaFieldKind;
  side: MpBermudaSide;
  anatomyZone: string;
  markerId: string;
  stationId?: string;
  fromStationId?: string;
  toStationId?: string;
};

export type MpBermudaTemplateField = {
  key: string;
  label: string;
  fieldType: "NUMBER";
  unit: "cm" | "kg" | "size";
  isRequired: true;
  sortOrder: number;
  minValue: number;
  maxValue: number;
  metadata: MpBermudaTemplateFieldMetadata;
};

export type MpBermudaTemplateSection = {
  title: string;
  sortOrder: number;
  fields: ReadonlyArray<MpBermudaTemplateField>;
};

export type MpBermudaTemplate = {
  code: typeof MP_BERMUDA_TEMPLATE_CODE;
  name: typeof MP_BERMUDA_TEMPLATE_NAME;
  version: typeof MP_BERMUDA_TEMPLATE_VERSION;
  description: typeof MP_BERMUDA_TEMPLATE_DESCRIPTION;
  sections: ReadonlyArray<MpBermudaTemplateSection>;
};

const BODY_RANGE_CM = { min: 0.1, max: 300 } as const;
const HEIGHT_RANGE_CM = { min: 50, max: 250 } as const;
const WEIGHT_RANGE_KG = { min: 1, max: 500 } as const;
const SHOE_SIZE_RANGE = { min: 1, max: 60 } as const;

const STATIONS = [
  { id: "waist", label: "Cintura" },
  { id: "hip", label: "Cadera" },
  { id: "groin", label: "Ingle" },
  { id: "belowGroin10", label: "10 cm debajo de la Ingle" },
  { id: "midThigh", label: "Mitad de muslo" },
  { id: "knee", label: "Rodilla" },
  { id: "belowKnee", label: "Debajo de rodilla" },
  { id: "calfMax", label: "Pantorrilla (Parte más gruesa)" },
  { id: "calfStart", label: "Inicio de pantorrilla" },
  { id: "aboveAnkle", label: "Encima del tobillo" },
  { id: "heelAnkle", label: "Talón y tobillo" },
  { id: "toeRoot", label: "Raíz de los dedos" },
  { id: "footDorsum", label: "Dorso del pie" },
] as const;

const SIDE_DEFINITIONS = [
  { side: MP_BERMUDA_SIDE.RIGHT, name: "Right", label: "derecha" },
  { side: MP_BERMUDA_SIDE.LEFT, name: "Left", label: "izquierda" },
] as const;

/**
 * Human name for every endpoint a field's metadata may reference: the ordered
 * leg stations plus the two landmarks used only by the shared bracketed
 * lengths. Exported so the textual fallback names endpoints from THIS catalog
 * instead of keeping a second, drift-prone copy of the same labels.
 */
export const MP_BERMUDA_ENDPOINT_LABELS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(STATIONS.map((station) => [station.id, station.label])),
  glutealFold: "Pliegue de la nalga",
  floor: "Piso",
};

function metadata(
  kind: MpBermudaFieldKind,
  side: MpBermudaSide,
  markerId: string,
  anatomyZone: string,
  stationOrEndpoints: Pick<
    MpBermudaTemplateFieldMetadata,
    "stationId" | "fromStationId" | "toStationId"
  > = {},
): MpBermudaTemplateFieldMetadata {
  return {
    layout: "mp-bermuda",
    kind,
    side,
    markerId,
    anatomyZone,
    ...stationOrEndpoints,
  };
}

function sharedField(
  key: string,
  label: string,
  unit: MpBermudaTemplateField["unit"],
  sortOrder: number,
  range: { min: number; max: number },
  kind: MpBermudaFieldKind,
  endpoints: Pick<MpBermudaTemplateFieldMetadata, "fromStationId" | "toStationId"> = {},
): MpBermudaTemplateField {
  return {
    key,
    label,
    fieldType: "NUMBER",
    unit,
    isRequired: true,
    sortOrder,
    minValue: range.min,
    maxValue: range.max,
    metadata: metadata(kind, MP_BERMUDA_SIDE.SHARED, `shared-${key}`, `mp-bermuda.shared.${key}`, endpoints),
  };
}

function capitalize(value: string): string {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function buildLegFields(
  side: (typeof SIDE_DEFINITIONS)[number],
): ReadonlyArray<MpBermudaTemplateField> {
  const circumferences = STATIONS.map((station, index) => ({
    key: `mp${side.name}${capitalize(station.id)}Circumference`,
    label: `Contorno ${station.label} ${side.label}`,
    fieldType: "NUMBER" as const,
    unit: "cm" as const,
    isRequired: true as const,
    sortOrder: index,
    minValue: BODY_RANGE_CM.min,
    maxValue: BODY_RANGE_CM.max,
    metadata: metadata(
      MP_BERMUDA_FIELD_KIND.CIRCUMFERENCE,
      side.side,
      `${side.side}-${station.id}-circumference`,
      `mp-bermuda.${side.side}.${station.id}`,
      { stationId: station.id },
    ),
  }));
  const distances = STATIONS.slice(0, -1).map((fromStation, index) => {
    const toStation = STATIONS[index + 1];
    return {
      key: `mp${side.name}${capitalize(fromStation.id)}To${capitalize(toStation.id)}Distance`,
      label: `Distancia ${fromStation.label} a ${toStation.label} ${side.label}`,
      fieldType: "NUMBER" as const,
      unit: "cm" as const,
      isRequired: true as const,
      sortOrder: STATIONS.length + index,
      minValue: BODY_RANGE_CM.min,
      maxValue: BODY_RANGE_CM.max,
      metadata: metadata(
        MP_BERMUDA_FIELD_KIND.DISTANCE,
        side.side,
        `${side.side}-${fromStation.id}-to-${toStation.id}-distance`,
        `mp-bermuda.${side.side}.${fromStation.id}-to-${toStation.id}`,
        { fromStationId: fromStation.id, toStationId: toStation.id },
      ),
    };
  });

  return [...circumferences, ...distances];
}

export function buildMpBermudaTemplate(): MpBermudaTemplate {
  return {
    code: MP_BERMUDA_TEMPLATE_CODE,
    name: MP_BERMUDA_TEMPLATE_NAME,
    version: MP_BERMUDA_TEMPLATE_VERSION,
    description: MP_BERMUDA_TEMPLATE_DESCRIPTION,
    sections: [
      {
        title: "Datos generales",
        sortOrder: 0,
        fields: [
          sharedField("mpHeight", "Estatura", "cm", 0, HEIGHT_RANGE_CM, MP_BERMUDA_FIELD_KIND.BODY),
          sharedField("mpWeight", "Peso", "kg", 1, WEIGHT_RANGE_KG, MP_BERMUDA_FIELD_KIND.BODY),
          sharedField("mpShoeSize", "Talla calzado", "size", 2, SHOE_SIZE_RANGE, MP_BERMUDA_FIELD_KIND.BODY),
        ],
      },
      {
        title: "Largos",
        sortOrder: 1,
        fields: [
          sharedField("mpWaistToGlutealFoldLength", "Largo de la cintura al pliegue de la nalga", "cm", 0, BODY_RANGE_CM, MP_BERMUDA_FIELD_KIND.LENGTH, { fromStationId: "waist", toStationId: "glutealFold" }),
          sharedField("mpGlutealFoldToFloorLength", "Largo del pliegue de la nalga al piso", "cm", 1, BODY_RANGE_CM, MP_BERMUDA_FIELD_KIND.LENGTH, { fromStationId: "glutealFold", toStationId: "floor" }),
        ],
      },
      ...SIDE_DEFINITIONS.map((side, index) => ({
        title: `Pierna ${side.label}`,
        sortOrder: index + 2,
        fields: buildLegFields(side),
      })),
    ],
  };
}

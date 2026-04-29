const LEG_POINTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
] as const;

const ARM_POINTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] as const;

type LegPoint = (typeof LEG_POINTS)[number];
type ArmPoint = (typeof ARM_POINTS)[number];

export type CompressionMeasurementKey =
  | `legRight${LegPoint}`
  | `legLeft${LegPoint}`
  | `armRight${ArmPoint}`
  | `armLeft${ArmPoint}`;

export type AnatomyZoneId = `${"legs" | "arms"}.${"right" | "left"}.${number}`;

export type CompressionMeasurementDefinition = {
  key: CompressionMeasurementKey;
  group: "legs" | "arms";
  side: "right" | "left";
  point: number;
  label: string;
  unit: "cm";
  min: number;
  max: number;
  anatomyZone: AnatomyZoneId;
};

const BODY_MEASUREMENT_RANGE_CM = { min: 0.1, max: 300 } as const;

function buildAnatomyZoneId(
  group: "legs" | "arms",
  side: "right" | "left",
  point: number,
): AnatomyZoneId {
  return `${group}.${side}.${point}`;
}

function createLegDefinition(side: "right" | "left", point: LegPoint): CompressionMeasurementDefinition {
  const sideLabel = side === "right" ? "derecha" : "izquierda";
  return {
    key: `leg${side === "right" ? "Right" : "Left"}${point}` as CompressionMeasurementKey,
    group: "legs",
    side,
    point,
    label: `Pierna ${sideLabel} punto ${point}`,
    unit: "cm",
    min: BODY_MEASUREMENT_RANGE_CM.min,
    max: BODY_MEASUREMENT_RANGE_CM.max,
    anatomyZone: buildAnatomyZoneId("legs", side, point),
  };
}

function createArmDefinition(side: "right" | "left", point: ArmPoint): CompressionMeasurementDefinition {
  const sideLabel = side === "right" ? "derecho" : "izquierdo";
  return {
    key: `arm${side === "right" ? "Right" : "Left"}${point}` as CompressionMeasurementKey,
    group: "arms",
    side,
    point,
    label: `Brazo ${sideLabel} punto ${point}`,
    unit: "cm",
    min: BODY_MEASUREMENT_RANGE_CM.min,
    max: BODY_MEASUREMENT_RANGE_CM.max,
    anatomyZone: buildAnatomyZoneId("arms", side, point),
  };
}

export const COMPRESSION_MEASUREMENTS: ReadonlyArray<CompressionMeasurementDefinition> = [
  ...LEG_POINTS.map((point) => createLegDefinition("right", point)),
  ...LEG_POINTS.map((point) => createLegDefinition("left", point)),
  ...ARM_POINTS.map((point) => createArmDefinition("right", point)),
  ...ARM_POINTS.map((point) => createArmDefinition("left", point)),
];

export function findCompressionMeasurement(key: string): CompressionMeasurementDefinition | null {
  return COMPRESSION_MEASUREMENTS.find((measurement) => measurement.key === key) ?? null;
}

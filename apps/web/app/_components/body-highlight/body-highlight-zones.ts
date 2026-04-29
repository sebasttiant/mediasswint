import {
  COMPRESSION_MEASUREMENTS,
  type AnatomyZoneId,
  type CompressionMeasurementDefinition,
} from "@/lib/compression-measurements";

export type BodyView = "legs" | "arms";

export type BodyZoneShape = {
  zoneId: AnatomyZoneId;
  view: BodyView;
  d: string;
};

const VIEW_WIDTH = 200;
const VIEW_HEIGHT = 400;
const LIMB_TOP = 30;
const LIMB_BOTTOM = 370;
const LIMB_WIDTH = 50;
const LIMB_X_RIGHT = 30;
const LIMB_X_LEFT = 120;

const MAX_POINT_BY_GROUP: Record<"legs" | "arms", number> = COMPRESSION_MEASUREMENTS.reduce(
  (acc, definition) => {
    if (definition.point > acc[definition.group]) {
      acc[definition.group] = definition.point;
    }
    return acc;
  },
  { legs: 0, arms: 0 } as Record<"legs" | "arms", number>,
);

function buildBandPath(definition: CompressionMeasurementDefinition): string {
  const totalPoints = MAX_POINT_BY_GROUP[definition.group];
  const limbHeight = LIMB_BOTTOM - LIMB_TOP;
  const bandHeight = limbHeight / totalPoints;
  const x = definition.side === "right" ? LIMB_X_RIGHT : LIMB_X_LEFT;
  const y = LIMB_TOP + (definition.point - 1) * bandHeight;
  const right = x + LIMB_WIDTH;
  const bottom = y + bandHeight;
  return `M ${x} ${y} L ${right} ${y} L ${right} ${bottom} L ${x} ${bottom} Z`;
}

function buildShape(definition: CompressionMeasurementDefinition): BodyZoneShape {
  return {
    zoneId: definition.anatomyZone,
    view: definition.group,
    d: buildBandPath(definition),
  };
}

export const BODY_HIGHLIGHT_ZONES: ReadonlyArray<BodyZoneShape> =
  COMPRESSION_MEASUREMENTS.map(buildShape);

export const BODY_HIGHLIGHT_VIEWBOX = {
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
} as const;

export const BODY_HIGHLIGHT_OUTLINES: Readonly<Record<BodyView, ReadonlyArray<string>>> = {
  legs: [
    `M ${LIMB_X_RIGHT} ${LIMB_TOP} L ${LIMB_X_RIGHT + LIMB_WIDTH} ${LIMB_TOP} L ${LIMB_X_RIGHT + LIMB_WIDTH} ${LIMB_BOTTOM} L ${LIMB_X_RIGHT} ${LIMB_BOTTOM} Z`,
    `M ${LIMB_X_LEFT} ${LIMB_TOP} L ${LIMB_X_LEFT + LIMB_WIDTH} ${LIMB_TOP} L ${LIMB_X_LEFT + LIMB_WIDTH} ${LIMB_BOTTOM} L ${LIMB_X_LEFT} ${LIMB_BOTTOM} Z`,
  ],
  arms: [
    `M ${LIMB_X_RIGHT} ${LIMB_TOP} L ${LIMB_X_RIGHT + LIMB_WIDTH} ${LIMB_TOP} L ${LIMB_X_RIGHT + LIMB_WIDTH} ${LIMB_BOTTOM} L ${LIMB_X_RIGHT} ${LIMB_BOTTOM} Z`,
    `M ${LIMB_X_LEFT} ${LIMB_TOP} L ${LIMB_X_LEFT + LIMB_WIDTH} ${LIMB_TOP} L ${LIMB_X_LEFT + LIMB_WIDTH} ${LIMB_BOTTOM} L ${LIMB_X_LEFT} ${LIMB_BOTTOM} Z`,
  ],
};

export function getZonesForView(view: BodyView): ReadonlyArray<BodyZoneShape> {
  return BODY_HIGHLIGHT_ZONES.filter((zone) => zone.view === view);
}

export function hasZone(zoneId: string): boolean {
  return BODY_HIGHLIGHT_ZONES.some((zone) => zone.zoneId === zoneId);
}

export function findViewForZone(zoneId: string): BodyView | null {
  return BODY_HIGHLIGHT_ZONES.find((zone) => zone.zoneId === zoneId)?.view ?? null;
}

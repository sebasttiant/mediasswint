import {
  COMPRESSION_MEASUREMENTS,
  type AnatomyZoneId,
  type CompressionMeasurementDefinition,
} from "@/lib/compression-measurements";

import {
  getFullBodyCalibration,
  MALE_FULL_BODY,
  getMarkerRect,
  markerRectToPath,
  type FigureCalibration,
  type FullBodySex,
} from "./body-highlight-calibration";
import { getFemaleZonePath } from "./zones-female";
import { getMaleZonePath } from "./zones-male";

export type BodyView = "full" | "legs" | "arms";
export type IsolatedBodyView = Exclude<BodyView, "full">;
export type BodySide = "right" | "left";

export type BodyZoneShape = {
  zoneId: AnatomyZoneId;
  view: IsolatedBodyView;
  side: BodySide;
  point: number;
  label: string;
  d: string;
  fullD: string;
  labelX: number;
  labelY: number;
  fullLabelX: number;
  fullLabelY: number;
};

// ---------------------------------------------------------------------------
// This module owns MEASUREMENT zone geometry for the legs/arms isolated
// sheets and the per-point marker paths for the full body view. Marker
// coordinates are derived from body-highlight-calibration.ts so all
// scattered magic constants live in one typed place.
//
// Coordinate system: 240 × 720 viewBox for the isolated sheets,
// 240 × 545 for the full body (matches MALE_FULL_BODY.viewBox).
// ---------------------------------------------------------------------------

const VIEW_WIDTH = 240;
const VIEW_HEIGHT = 720;

const ISO_VIEW_WIDTH = 240;
const ISO_VIEW_HEIGHT = 480;

// Isolated view (legs sheet) — band columns
const ISO_LEG_TOP = 50;
const ISO_LEG_BOTTOM = 430;
const ISO_LEG_WIDTH = 70;
const ISO_LEG_X_RIGHT = 26;
const ISO_LEG_X_LEFT = 144;

// Isolated view (arms sheet) — band columns
const ISO_ARM_TOP = 50;
const ISO_ARM_BOTTOM = 450;
const ISO_ARM_WIDTH = 70;
const ISO_ARM_X_RIGHT = 20;
const ISO_ARM_X_LEFT = 150;

const MAX_POINT_BY_GROUP: Record<"legs" | "arms", number> = COMPRESSION_MEASUREMENTS.reduce(
  (acc, definition) => {
    if (definition.point > acc[definition.group]) {
      acc[definition.group] = definition.point;
    }
    return acc;
  },
  { legs: 0, arms: 0 } as Record<"legs" | "arms", number>,
);

// Isolated bands are still rendered ~2× their slot height for visual
// emphasis (compact 240×480 sheet). Full body markers are sized via
// MALE_FULL_BODY.markerHeightRange in the calibration module.
const ISO_BAND_VISIBLE_SCALE = 2;

function buildIsolatedBandPath(definition: CompressionMeasurementDefinition): string {
  const isLeg = definition.group === "legs";
  const totalPoints = MAX_POINT_BY_GROUP[definition.group];
  const top = isLeg ? ISO_LEG_TOP : ISO_ARM_TOP;
  const bottom = isLeg ? ISO_LEG_BOTTOM : ISO_ARM_BOTTOM;
  const width = isLeg ? ISO_LEG_WIDTH : ISO_ARM_WIDTH;
  const x = isLeg
    ? definition.side === "right"
      ? ISO_LEG_X_RIGHT
      : ISO_LEG_X_LEFT
    : definition.side === "right"
      ? ISO_ARM_X_RIGHT
      : ISO_ARM_X_LEFT;

  const slotHeight = (bottom - top) / totalPoints;
  const centerY = top + (definition.point - 0.5) * slotHeight;
  const h = slotHeight * ISO_BAND_VISIBLE_SCALE;
  const y = centerY - h / 2;
  const pad = 0.5;
  const r = Math.min(5, (h - pad * 2) / 2);

  return `M ${x + pad + r} ${y + pad} L ${x + width - pad - r} ${y + pad} Q ${x + width - pad} ${y + pad}, ${x + width - pad} ${y + pad + r} L ${x + width - pad} ${y + h - pad - r} Q ${x + width - pad} ${y + h - pad}, ${x + width - pad - r} ${y + h - pad} L ${x + pad + r} ${y + h - pad} Q ${x + pad} ${y + h - pad}, ${x + pad} ${y + h - pad - r} L ${x + pad} ${y + pad + r} Q ${x + pad} ${y + pad}, ${x + pad + r} ${y + pad} Z`;
}

function buildShape(definition: CompressionMeasurementDefinition): BodyZoneShape {
  const isLeg = definition.group === "legs";
  const totalPoints = MAX_POINT_BY_GROUP[definition.group];

  // Isolated sheet coords (legs/arms-only views)
  const isoTop = isLeg ? ISO_LEG_TOP : ISO_ARM_TOP;
  const isoBottom = isLeg ? ISO_LEG_BOTTOM : ISO_ARM_BOTTOM;
  const isoWidth = isLeg ? ISO_LEG_WIDTH : ISO_ARM_WIDTH;
  const isoX = isLeg
    ? definition.side === "right"
      ? ISO_LEG_X_RIGHT
      : ISO_LEG_X_LEFT
    : definition.side === "right"
      ? ISO_ARM_X_RIGHT
      : ISO_ARM_X_LEFT;
  const isoBandHeight = (isoBottom - isoTop) / totalPoints;
  const isoY = isoTop + (definition.point - 1) * isoBandHeight;

  const markerRect = getMarkerRect(MALE_FULL_BODY, definition, totalPoints);

  return {
    zoneId: definition.anatomyZone,
    view: definition.group,
    side: definition.side,
    point: definition.point,
    label: definition.label,
    d: buildIsolatedBandPath(definition),
    fullD: markerRectToPath(markerRect),
    labelX: isoX + isoWidth / 2,
    labelY: isoY + isoBandHeight / 2,
    fullLabelX: markerRect.x + markerRect.width / 2,
    fullLabelY: markerRect.y + markerRect.height / 2,
  };
}

export const BODY_HIGHLIGHT_ZONES: ReadonlyArray<BodyZoneShape> =
  COMPRESSION_MEASUREMENTS.map(buildShape);

export const BODY_HIGHLIGHT_VIEWBOX = {
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
} as const;

export const ISO_VIEW = {
  legs: { x: 0, y: 0, width: ISO_VIEW_WIDTH, height: ISO_VIEW_HEIGHT },
  arms: { x: 0, y: 0, width: ISO_VIEW_WIDTH, height: ISO_VIEW_HEIGHT },
} as const;

// ---------------------------------------------------------------------------
// Clip path rectangles. Only the isolated sheets still rely on a per-side
// rectangular clip; the full-body markers are positioned via the
// calibration module and need no external clipping.
// ---------------------------------------------------------------------------

const ARM_RIGHT_CLIP_ISO = "M 16 46 L 92 46 L 92 470 L 16 470 Z";
const ARM_LEFT_CLIP_ISO = "M 148 46 L 224 46 L 224 470 L 148 470 Z";
const LEG_RIGHT_CLIP_ISO = "M 22 46 L 98 46 L 98 470 L 22 470 Z";
const LEG_LEFT_CLIP_ISO = "M 142 46 L 218 46 L 218 470 L 142 470 Z";

export const BODY_CLIP_PATHS: Readonly<Record<IsolatedBodyView, Record<BodySide, string>>> = {
  legs: { right: LEG_RIGHT_CLIP_ISO, left: LEG_LEFT_CLIP_ISO },
  arms: { right: ARM_RIGHT_CLIP_ISO, left: ARM_LEFT_CLIP_ISO },
};

// ---------------------------------------------------------------------------
// Isolated-view silhouettes — paired figure sheets used by the read-only
// measurement detail page (view="legs" / view="arms"). The full-body view
// does NOT use these: it renders dedicated FullBodyFemale / FullBodyMale
// components from silhouettes/.
// ---------------------------------------------------------------------------

const ISO_LEGS_OUTLINE = [
  "M 22 50",
  "C 36 30, 70 16, 120 16",
  "C 170 16, 204 30, 218 50",
  "C 220 120, 218 240, 214 360",
  "C 212 400, 210 430, 210 450",
  "C 212 462, 208 470, 200 470",
  "L 144 470",
  "C 138 466, 138 458, 140 448",
  "L 140 60",
  "C 134 64, 128 66, 120 66",
  "C 112 66, 106 64, 100 60",
  "L 100 448",
  "C 102 458, 102 466, 96 470",
  "L 40 470",
  "C 32 470, 28 462, 30 450",
  "C 30 430, 28 400, 26 360",
  "C 22 240, 20 120, 22 50",
  "Z",
].join(" ");

const ISO_ARMS_OUTLINE = [
  "M 18 50",
  "C 36 28, 70 14, 120 14",
  "C 170 14, 204 28, 222 50",
  "C 224 140, 222 260, 220 380",
  "C 218 410, 216 430, 214 446",
  "C 214 458, 204 466, 188 466",
  "C 172 466, 156 460, 150 446",
  "C 152 380, 150 200, 152 60",
  "C 144 64, 134 66, 124 66",
  "L 120 68",
  "L 116 66",
  "C 106 66, 96 64, 88 60",
  "C 90 200, 88 380, 90 446",
  "C 84 460, 68 466, 52 466",
  "C 36 466, 26 458, 26 446",
  "C 24 430, 22 410, 20 380",
  "C 18 260, 16 140, 18 50",
  "Z",
].join(" ");

const ARTICULATIONS_LEGS_ISO: ReadonlyArray<string> = [
  "M 26 58 Q 60 70, 100 60 M 140 60 Q 180 70, 214 58",
  "M 30 170 Q 60 178, 96 170 M 144 170 Q 180 178, 210 170",
  "M 32 250 Q 62 258, 96 250 M 144 250 Q 178 258, 208 250",
  "M 32 340 Q 62 346, 96 340 M 144 340 Q 178 346, 208 340",
  "M 34 430 Q 62 438, 94 430 M 146 430 Q 178 438, 206 430",
];

const ARTICULATIONS_ARMS_ISO: ReadonlyArray<string> = [
  "M 24 60 Q 56 70, 88 60 M 152 60 Q 184 70, 216 60",
  "M 24 160 Q 56 168, 88 160 M 152 160 Q 184 168, 216 160",
  "M 22 240 Q 56 248, 90 240 M 150 240 Q 184 248, 218 240",
  "M 22 330 Q 56 338, 90 330 M 150 330 Q 184 338, 218 330",
  "M 24 430 Q 56 438, 88 430 M 152 430 Q 184 438, 216 430",
];

export const BODY_HIGHLIGHT_OUTLINES: Readonly<Record<IsolatedBodyView, ReadonlyArray<string>>> = {
  legs: [ISO_LEGS_OUTLINE],
  arms: [ISO_ARMS_OUTLINE],
};

export const BODY_HIGHLIGHT_ARTICULATIONS: Readonly<Record<IsolatedBodyView, ReadonlyArray<string>>> = {
  legs: ARTICULATIONS_LEGS_ISO,
  arms: ARTICULATIONS_ARMS_ISO,
};

// ---------------------------------------------------------------------------
// Side-label (D / I) positions per view. Full-body labels are read from
// the calibration so all full-body coordinates live in one place.
// ---------------------------------------------------------------------------

export const SIDE_LABEL_POSITIONS: Record<BodyView, Record<BodySide, { x: number; y: number; label: string }>> = {
  full: {
    right: {
      x: MALE_FULL_BODY.sideLabels.right.x,
      y: MALE_FULL_BODY.sideLabels.right.y,
      label: MALE_FULL_BODY.sideLabels.right.text,
    },
    left: {
      x: MALE_FULL_BODY.sideLabels.left.x,
      y: MALE_FULL_BODY.sideLabels.left.y,
      label: MALE_FULL_BODY.sideLabels.left.text,
    },
  },
  legs: {
    right: { x: 58, y: 16, label: "D" },
    left: { x: 178, y: 16, label: "I" },
  },
  arms: {
    right: { x: 35, y: 16, label: "D" },
    left: { x: 205, y: 16, label: "I" },
  },
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getZonesForView(view: BodyView): ReadonlyArray<BodyZoneShape> {
  if (view === "full") return BODY_HIGHLIGHT_ZONES;
  return BODY_HIGHLIGHT_ZONES.filter((zone) => zone.view === view);
}

export function getZonesForSide(view: BodyView, side: BodySide): ReadonlyArray<BodyZoneShape> {
  if (view === "full") return BODY_HIGHLIGHT_ZONES.filter((zone) => zone.side === side);
  return BODY_HIGHLIGHT_ZONES.filter((zone) => zone.view === view && zone.side === side);
}

export function findZoneShape(zoneId: AnatomyZoneId): BodyZoneShape | null {
  return BODY_HIGHLIGHT_ZONES.find((zone) => zone.zoneId === zoneId) ?? null;
}

export function hasZone(zoneId: string): boolean {
  return BODY_HIGHLIGHT_ZONES.some((zone) => zone.zoneId === zoneId);
}

export function findViewForZone(zoneId: string): IsolatedBodyView | null {
  return BODY_HIGHLIGHT_ZONES.find((zone) => zone.zoneId === zoneId)?.view ?? null;
}

export function getZoneLabel(zoneId: AnatomyZoneId): string {
  return COMPRESSION_MEASUREMENTS.find((m) => m.anatomyZone === zoneId)?.label ?? "";
}

export function getZoneSide(zoneId: AnatomyZoneId): BodySide | null {
  return findZoneShape(zoneId)?.side ?? null;
}

export function getZonePoint(zoneId: AnatomyZoneId): number | null {
  return findZoneShape(zoneId)?.point ?? null;
}

export function getZoneA11yLabel(
  zoneId: AnatomyZoneId,
  state: { active: boolean; filled: boolean },
): string {
  const label = getZoneLabel(zoneId) || zoneId;
  const states: string[] = [];
  if (state.active) states.push("zona activa");
  if (state.filled) states.push("medida cargada");
  return states.length > 0 ? `${label}, ${states.join(", ")}` : label;
}

export function getSideSummaryForView(
  view: BodyView,
): Array<{ side: BodySide; label: string; points: number }> {
  if (view === "full") {
    return [
      { side: "right", label: "Lado derecho", points: MAX_POINT_BY_GROUP.legs + MAX_POINT_BY_GROUP.arms },
      { side: "left", label: "Lado izquierdo", points: MAX_POINT_BY_GROUP.legs + MAX_POINT_BY_GROUP.arms },
    ];
  }

  const groupLabel = view === "legs" ? "Pierna" : "Brazo";
  return (["right", "left"] as const).map((side) => ({
    side,
    label: `${groupLabel} ${view === "legs" ? (side === "right" ? "derecha" : "izquierda") : side === "right" ? "derecho" : "izquierdo"}`,
    points: MAX_POINT_BY_GROUP[view],
  }));
}

export function findMeasurementKeyForZone(zoneId: AnatomyZoneId): string | null {
  return COMPRESSION_MEASUREMENTS.find((m) => m.anatomyZone === zoneId)?.key ?? null;
}

// Re-compute a full-body marker (path + center) against a specific
// figure calibration so the renderer can swap male/female geometry
// without baking sex-specific paths into BodyZoneShape. The baked
// `fullD` field on BodyZoneShape stays male-default for back-compat.
export function getFullMarkerForSex(
  calibration: FigureCalibration,
  zone: { view: IsolatedBodyView; side: BodySide; point: number },
): { path: string; centerX: number; centerY: number } {
  const totalPoints = MAX_POINT_BY_GROUP[zone.view];
  const rect = getMarkerRect(
    calibration,
    { group: zone.view, side: zone.side, point: zone.point },
    totalPoints,
  );
  return {
    path: markerRectToPath(rect),
    centerX: rect.x + rect.width / 2,
    centerY: rect.y + rect.height / 2,
  };
}

export function getFullZonePathForSex(sex: FullBodySex, zone: BodyZoneShape): string {
  const tracedPath =
    sex === "female"
      ? getFemaleZonePath(zone.zoneId)
      : zone.view === "legs"
        ? getMaleZonePath(zone.zoneId)
        : undefined;

  return tracedPath ?? getFullMarkerForSex(getFullBodyCalibration(sex), zone).path;
}

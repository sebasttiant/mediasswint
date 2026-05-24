import {
  COMPRESSION_MEASUREMENTS,
  type AnatomyZoneId,
  type CompressionMeasurementDefinition,
} from "@/lib/compression-measurements";

export type BodyView = "full" | "legs" | "arms";
export type BodySide = "right" | "left";

export type BodyZoneShape = {
  zoneId: AnatomyZoneId;
  view: BodyView;
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
// Unified coordinate system: 240 × 720 viewBox, centerline x=120
// All three views (full / legs / arms) share these constants. Isolated views
// are viewBox crops — no duplicated paths.
// ---------------------------------------------------------------------------

const VIEW_WIDTH = 240;
const VIEW_HEIGHT = 720;

// Isolated view dimensions for legs / arms sheets (246×480 canvas each)
const ISO_VIEW_WIDTH = 240;
const ISO_VIEW_HEIGHT = 480;

// ---------------------------------------------------------------------------
// Isolated view (legs sheet): limb columns
// Right leg occupies x 26–96,  left leg x 144–214
// Y: top 50, bottom 430 → 380 px tall
// ---------------------------------------------------------------------------
const ISO_LEG_TOP = 50;
const ISO_LEG_BOTTOM = 430;
const ISO_LEG_WIDTH = 70;
const ISO_LEG_X_RIGHT = 26;
const ISO_LEG_X_LEFT = 144;

// Isolated view (arms sheet): arm columns
// Right arm x 20–90, left arm x 150–220
// Y: top 50, bottom 450 → 400 px tall
const ISO_ARM_TOP = 50;
const ISO_ARM_BOTTOM = 450;
const ISO_ARM_WIDTH = 70;
const ISO_ARM_X_RIGHT = 20;
const ISO_ARM_X_LEFT = 150;

// ---------------------------------------------------------------------------
// Full-figure positions inside the 240×720 canvas
// ---------------------------------------------------------------------------

// Legs in the full figure: y 400–700
const FULL_LEG_TOP = 400;
const FULL_LEG_BOTTOM = 700;
// Leg column widths & positions (sex-aware, female wider hips)
// For band math we use the female values as defaults; clip-paths handle sex
// Band math uses female column positions for both sexes; the visual sex
// difference is handled by sex-specific clip-paths on the silhouette.
const FULL_LEG_WIDTH_F = 32;
const FULL_LEG_X_RIGHT_F = 84;
const FULL_LEG_X_LEFT_F = 124;

// Arms in the full figure: y 135–470
const FULL_ARM_TOP = 135;
const FULL_ARM_BOTTOM = 470;
const FULL_ARM_WIDTH_F = 28;
const FULL_ARM_X_RIGHT_F = 38;
const FULL_ARM_X_LEFT_F = 174;

// ---------------------------------------------------------------------------
// Zone math helpers
// ---------------------------------------------------------------------------

const MAX_POINT_BY_GROUP: Record<"legs" | "arms", number> = COMPRESSION_MEASUREMENTS.reduce(
  (acc, definition) => {
    if (definition.point > acc[definition.group]) {
      acc[definition.group] = definition.point;
    }
    return acc;
  },
  { legs: 0, arms: 0 } as Record<"legs" | "arms", number>,
);

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

  const limbHeight = bottom - top;
  const bandHeight = limbHeight / totalPoints;
  const y = top + (definition.point - 1) * bandHeight;
  const pad = 1.5;
  const r = Math.min(4, (bandHeight - pad * 2) / 2);

  return `M ${x + pad + r} ${y + pad} L ${x + width - pad - r} ${y + pad} Q ${x + width - pad} ${y + pad}, ${x + width - pad} ${y + pad + r} L ${x + width - pad} ${y + bandHeight - pad - r} Q ${x + width - pad} ${y + bandHeight - pad}, ${x + width - pad - r} ${y + bandHeight - pad} L ${x + pad + r} ${y + bandHeight - pad} Q ${x + pad} ${y + bandHeight - pad}, ${x + pad} ${y + bandHeight - pad - r} L ${x + pad} ${y + pad + r} Q ${x + pad} ${y + pad}, ${x + pad + r} ${y + pad} Z`;
}

function buildFullBodyBandPath(definition: CompressionMeasurementDefinition): string {
  const isLeg = definition.group === "legs";
  const totalPoints = MAX_POINT_BY_GROUP[definition.group];
  const top = isLeg ? FULL_LEG_TOP : FULL_ARM_TOP;
  const bottom = isLeg ? FULL_LEG_BOTTOM : FULL_ARM_BOTTOM;
  // Use female coords for band placement (clip-paths handle sex difference)
  const width = isLeg ? FULL_LEG_WIDTH_F : FULL_ARM_WIDTH_F;
  const x = isLeg
    ? definition.side === "right"
      ? FULL_LEG_X_RIGHT_F
      : FULL_LEG_X_LEFT_F
    : definition.side === "right"
      ? FULL_ARM_X_RIGHT_F
      : FULL_ARM_X_LEFT_F;

  const bandHeight = (bottom - top) / totalPoints;
  const y = top + (definition.point - 1) * bandHeight;
  const pad = 1.0;
  const r = Math.min(3, (bandHeight - pad * 2) / 2);

  // Rounded rectangle path for clinical-looking bands with visible separation.
  return `M ${x + pad + r} ${y + pad} L ${x + width - pad - r} ${y + pad} Q ${x + width - pad} ${y + pad}, ${x + width - pad} ${y + pad + r} L ${x + width - pad} ${y + bandHeight - pad - r} Q ${x + width - pad} ${y + bandHeight - pad}, ${x + width - pad - r} ${y + bandHeight - pad} L ${x + pad + r} ${y + bandHeight - pad} Q ${x + pad} ${y + bandHeight - pad}, ${x + pad} ${y + bandHeight - pad - r} L ${x + pad} ${y + pad + r} Q ${x + pad} ${y + pad}, ${x + pad + r} ${y + pad} Z`;
}

function buildShape(definition: CompressionMeasurementDefinition): BodyZoneShape {
  const isLeg = definition.group === "legs";
  const totalPoints = MAX_POINT_BY_GROUP[definition.group];

  // Isolated view label coords
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

  // Full figure label coords
  const fullTop = isLeg ? FULL_LEG_TOP : FULL_ARM_TOP;
  const fullBottom = isLeg ? FULL_LEG_BOTTOM : FULL_ARM_BOTTOM;
  const fullWidth = isLeg ? FULL_LEG_WIDTH_F : FULL_ARM_WIDTH_F;
  const fullX = isLeg
    ? definition.side === "right"
      ? FULL_LEG_X_RIGHT_F
      : FULL_LEG_X_LEFT_F
    : definition.side === "right"
      ? FULL_ARM_X_RIGHT_F
      : FULL_ARM_X_LEFT_F;
  const fullBandHeight = (fullBottom - fullTop) / totalPoints;
  const fullY = fullTop + (definition.point - 1) * fullBandHeight;

  return {
    zoneId: definition.anatomyZone,
    view: definition.group,
    side: definition.side,
    point: definition.point,
    label: definition.label,
    d: buildIsolatedBandPath(definition),
    fullD: buildFullBodyBandPath(definition),
    labelX: isoX + isoWidth / 2,
    labelY: isoY + isoBandHeight / 2,
    fullLabelX: fullX + fullWidth / 2,
    fullLabelY: fullY + fullBandHeight / 2,
  };
}

export const BODY_HIGHLIGHT_ZONES: ReadonlyArray<BodyZoneShape> =
  COMPRESSION_MEASUREMENTS.map(buildShape);

export const BODY_HIGHLIGHT_VIEWBOX = {
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
} as const;

// Isolated view constants (used by the renderer to set viewBox for legs/arms)
export const ISO_VIEW = {
  legs: { x: 0, y: 0, width: ISO_VIEW_WIDTH, height: ISO_VIEW_HEIGHT },
  arms: { x: 0, y: 0, width: ISO_VIEW_WIDTH, height: ISO_VIEW_HEIGHT },
} as const;

// ---------------------------------------------------------------------------
// CLINICAL SILHOUETTE — single continuous outline per sex.
//
// Designed to read as a clinical paper-form figure (compression-stocking
// measurement chart). Hard rules:
//   - ONE closed path per sex → no internal seams between body parts.
//   - 8-head proportions, sober posture (anatomical position).
//   - Bands x-ranges fit fully inside the silhouette interior:
//       arms.right  x 38–66  (silhouette outer ≤ 36, inner ≥ 68)
//       arms.left   x 174–202 (silhouette outer ≥ 204, inner ≤ 172)
//       legs.right  x 84–116 (silhouette outer ≤ 82, inner ≥ 118)
//       legs.left   x 124–156 (silhouette outer ≥ 158, inner ≤ 122)
//   - Trace order is clockwise from head apex; arms are drawn as
//     “down-around-up” detours from the torso so the armpit reads naturally.
// Coordinate system: 240 × 720, centerline x = 120.
// ---------------------------------------------------------------------------

const FULL_OUTLINE_FEMALE = [
  // Head — narrower oval, distinct from neck
  "M 120 16",
  "C 140 16, 148 34, 148 58",
  "C 148 80, 140 92, 132 94",
  // Visible neck column body-left (tapered)
  "C 132 102, 131 112, 132 120",
  // Clavicle → shoulder slope → deltoid body-left
  "C 152 124, 184 130, 208 138",
  // Bicep bulge then taper to elbow → forearm → wrist body-left outer
  "C 214 200, 210 280, 204 340",
  "C 200 380, 198 420, 196 470",
  // Hand body-left (compact paddle)
  "C 198 492, 192 510, 184 514",
  "C 176 516, 172 510, 172 502",
  "C 172 492, 172 482, 170 470",
  // Inner forearm → bicep → shoulder-cap inner body-left
  "C 168 420, 166 360, 168 280",
  "C 168 220, 168 180, 170 140",
  // Inner-arm top → armpit notch body-left
  "C 168 146, 162 150, 158 158",
  // Torso side: rib → waist (narrowest at ~y=290)
  "C 158 200, 152 250, 146 290",
  // Waist → hip flare body-left (wider female hip)
  "C 150 340, 162 380, 166 408",
  // Outer thigh → knee narrowing body-left
  "C 166 460, 160 510, 152 558",
  // Calf bulge body-left (lateral gastrocnemius)
  "C 156 590, 162 615, 158 640",
  // Shin taper → ankle body-left
  "C 156 660, 152 682, 150 692",
  // Foot body-left: short clinical footprint
  "C 156 702, 164 714, 162 720",
  "C 158 724, 148 724, 138 722",
  "L 126 722",
  "C 122 716, 122 706, 122 692",
  // Inner shin → calf (slight medial bulge) body-left
  "C 122 660, 122 620, 122 590",
  // Inner knee → inner thigh body-left
  "C 124 555, 124 510, 124 470",
  "L 124 432",
  // Crotch (smooth shallow V)
  "C 123 444, 121 460, 120 466",
  "C 119 460, 117 444, 116 432",
  // Inner thigh → inner knee body-right
  "L 116 470",
  "C 116 510, 116 555, 118 590",
  // Inner calf body-right
  "C 118 620, 118 660, 118 692",
  // Inner ankle → foot bottom body-right
  "C 118 706, 118 716, 114 722",
  "L 102 722",
  "C 92 724, 82 724, 78 720",
  "C 76 714, 84 702, 90 692",
  // Body-right ankle → shin → calf
  "C 88 682, 84 660, 82 640",
  "C 78 615, 84 590, 88 558",
  // Knee → outer thigh body-right
  "C 80 510, 74 460, 74 408",
  // Hip → waist body-right
  "C 78 380, 90 340, 94 290",
  "C 88 250, 82 200, 82 158",
  // Armpit notch → inner-arm top body-right
  "C 78 150, 72 146, 70 140",
  // Inner arm body-right (down)
  "C 72 180, 72 220, 72 280",
  "C 74 360, 72 420, 70 470",
  "C 68 482, 68 492, 68 502",
  // Hand body-right
  "C 68 510, 64 516, 56 514",
  "C 46 510, 42 492, 44 470",
  // Outer forearm → elbow → bicep body-right
  "C 42 420, 40 380, 36 340",
  "C 30 280, 26 200, 32 138",
  // Deltoid → clavicle body-right
  "C 56 130, 88 124, 108 120",
  // Body-right neck column
  "C 109 112, 108 102, 108 94",
  // Jaw → temple body-right
  "C 100 92, 92 80, 92 58",
  "C 92 34, 100 16, 120 16",
  "Z",
].join(" ");

const FULL_OUTLINE_MALE = [
  // Head — slightly wider oval (squarer jaw)
  "M 120 16",
  "C 142 16, 152 34, 152 58",
  "C 152 80, 144 92, 136 94",
  // Wider, shorter-looking neck column
  "C 136 102, 136 112, 136 120",
  // Wider shoulder slope to deltoid body-left
  "C 156 124, 192 130, 218 138",
  // Bicep + outer arm body-left (more muscle)
  "C 222 200, 220 280, 212 340",
  "C 208 380, 206 420, 204 470",
  // Larger hand body-left
  "C 206 494, 200 516, 190 520",
  "C 180 522, 172 516, 172 506",
  "C 172 494, 172 482, 170 470",
  // Inner forearm → bicep body-left
  "C 168 420, 166 360, 168 280",
  "C 168 220, 168 180, 170 140",
  "C 168 146, 162 150, 156 158",
  // Less torso taper (straighter sides)
  "C 156 200, 152 250, 150 290",
  // Narrow male hip flare
  "C 152 340, 158 380, 160 408",
  // Straighter outer thigh, less calf curve
  "C 162 460, 158 510, 152 558",
  "C 154 588, 158 614, 156 640",
  "C 154 660, 150 682, 150 692",
  // Larger male foot
  "C 156 702, 166 714, 164 722",
  "C 160 726, 148 726, 136 724",
  "L 126 724",
  "C 122 716, 122 706, 122 692",
  "C 122 660, 122 620, 122 590",
  "C 124 555, 124 510, 124 470",
  "L 124 432",
  "C 123 444, 121 460, 120 466",
  "C 119 460, 117 444, 116 432",
  "L 116 470",
  "C 116 510, 116 555, 118 590",
  "C 118 620, 118 660, 118 692",
  "C 118 706, 118 716, 114 724",
  "L 104 724",
  "C 92 726, 80 726, 76 722",
  "C 74 714, 84 702, 90 692",
  "C 88 682, 84 660, 84 640",
  "C 80 614, 84 588, 86 558",
  "C 80 510, 76 460, 78 408",
  "C 80 380, 86 340, 88 290",
  "C 86 250, 82 200, 82 158",
  "C 76 150, 70 146, 68 140",
  "C 70 180, 70 220, 70 280",
  "C 72 360, 70 420, 68 470",
  "C 66 482, 66 494, 66 506",
  "C 66 516, 58 522, 48 520",
  "C 38 516, 32 494, 34 470",
  "C 32 420, 30 380, 26 340",
  "C 18 280, 16 200, 20 138",
  "C 46 130, 82 124, 102 120",
  "C 102 112, 102 102, 102 94",
  "C 94 92, 86 80, 86 58",
  "C 86 34, 96 16, 120 16",
  "Z",
].join(" ");

// ---------------------------------------------------------------------------
// Clip paths — simple bounding rectangles around each band column.
// They only constrain the band overlays so they don’t bleed into adjacent
// anatomical regions; the silhouette itself contains the band x-ranges, so
// rectangular clipping is sufficient and keeps the SVG cheap to render.
// ---------------------------------------------------------------------------

const ARM_RIGHT_CLIP_FULL = "M 30 128 L 72 128 L 72 528 L 30 528 Z";
const ARM_LEFT_CLIP_FULL = "M 168 128 L 210 128 L 210 528 L 168 528 Z";
const LEG_RIGHT_CLIP_FULL = "M 74 395 L 122 395 L 122 720 L 74 720 Z";
const LEG_LEFT_CLIP_FULL = "M 118 395 L 166 395 L 166 720 L 118 720 Z";

// ---------------------------------------------------------------------------
// Isolated view silhouettes (240×480 canvas).
// One combined path per view, same single-outline philosophy.
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

const ARM_RIGHT_CLIP_ISO = "M 16 46 L 92 46 L 92 470 L 16 470 Z";
const ARM_LEFT_CLIP_ISO = "M 148 46 L 224 46 L 224 470 L 148 470 Z";
const LEG_RIGHT_CLIP_ISO = "M 22 46 L 98 46 L 98 470 L 22 470 Z";
const LEG_LEFT_CLIP_ISO = "M 142 46 L 218 46 L 218 470 L 142 470 Z";

// ---------------------------------------------------------------------------
// Exports matching original API surface
// ---------------------------------------------------------------------------

export const BODY_FIGURE_OUTLINES = {
  female: [FULL_OUTLINE_FEMALE],
  male: [FULL_OUTLINE_MALE],
} as const;

export const BODY_FIGURE_CLIP_PATHS = {
  female: {
    legs: { right: LEG_RIGHT_CLIP_FULL, left: LEG_LEFT_CLIP_FULL },
    arms: { right: ARM_RIGHT_CLIP_FULL, left: ARM_LEFT_CLIP_FULL },
  },
  male: {
    legs: { right: LEG_RIGHT_CLIP_FULL, left: LEG_LEFT_CLIP_FULL },
    arms: { right: ARM_RIGHT_CLIP_FULL, left: ARM_LEFT_CLIP_FULL },
  },
} as const;

export const BODY_HIGHLIGHT_OUTLINES: Readonly<Record<BodyView, ReadonlyArray<string>>> = {
  full: BODY_FIGURE_OUTLINES.female,
  legs: [ISO_LEGS_OUTLINE],
  arms: [ISO_ARMS_OUTLINE],
};

export const BODY_CLIP_PATHS: Readonly<Record<BodyView, Record<BodySide, string>>> = {
  full: {
    right: LEG_RIGHT_CLIP_FULL,
    left: LEG_LEFT_CLIP_FULL,
  },
  legs: {
    right: LEG_RIGHT_CLIP_ISO,
    left: LEG_LEFT_CLIP_ISO,
  },
  arms: {
    right: ARM_RIGHT_CLIP_ISO,
    left: ARM_LEFT_CLIP_ISO,
  },
};

// ---------------------------------------------------------------------------
// Side-label positions calibrated to each view's silhouette
// ---------------------------------------------------------------------------

export const SIDE_LABEL_POSITIONS: Record<BodyView, Record<string, { x: number; label: string }>> = {
  full: {
    right: { x: 30, label: "D" },
    left: { x: 210, label: "I" },
  },
  legs: {
    right: { x: 58, label: "D" },
    left: { x: 178, label: "I" },
  },
  arms: {
    right: { x: 35, label: "D" },
    left: { x: 205, label: "I" },
  },
};

// ---------------------------------------------------------------------------
// Lookup and utility functions (unchanged API)
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

export function findViewForZone(zoneId: string): BodyView | null {
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

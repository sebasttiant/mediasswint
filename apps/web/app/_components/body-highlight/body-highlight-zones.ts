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
  const pad = 0.75;

  return `M ${x + pad} ${y + pad} L ${x + width - pad} ${y + pad} L ${x + width - pad} ${y + bandHeight - pad} L ${x + pad} ${y + bandHeight - pad} Z`;
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
  const pad = 0.5;

  return `M ${x + pad} ${y + pad} L ${x + width - pad} ${y + pad} L ${x + width - pad} ${y + bandHeight - pad} L ${x + pad} ${y + bandHeight - pad} Z`;
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
// Anatomical silhouette paths — 240×720 unified coordinate system
//
// Anatomical landmarks encoded as inflection points in bezier curves:
//   - Neck visibly narrower than head
//   - Clavicle indentation at shoulder
//   - Bicep bulge mid-arm
//   - Elbow inflection
//   - Wrist narrowing
//   - Knee inflection
//   - Calf bulge
//   - Ankle narrowing
//   - Foot suggestion (rounded end)
// ---------------------------------------------------------------------------

// HEAD (shared male/female, centered 90-150 x, 0-88 y)
const FULL_HEAD = `M 105 0 C 105 0, 90 8, 90 44 C 90 72, 100 88, 120 88 C 140 88, 150 72, 150 44 C 150 8, 135 0, 105 0 Z`;

// NECK
const FULL_NECK_FEMALE = `M 109 88 L 131 88 C 128 106, 126 116, 122 120 L 118 120 C 114 116, 112 106, 109 88 Z`;
const FULL_NECK_MALE = `M 107 88 L 133 88 C 130 106, 128 116, 124 120 L 116 120 C 112 116, 110 106, 107 88 Z`;

// TORSO female: narrower shoulders, wider hips
// Shoulder line y~120-135, hip flare y~340-400
const FULL_TORSO_FEMALE = `M 68 120 C 88 120, 102 118, 120 118 C 138 118, 152 120, 172 120 C 178 130, 180 148, 177 165 C 174 178, 160 188, 155 200 C 148 215, 146 240, 146 260 C 146 290, 148 320, 152 340 L 88 340 C 92 320, 94 290, 94 260 C 94 240, 92 215, 85 200 C 80 188, 66 178, 63 165 C 60 148, 62 130, 68 120 Z`;

// TORSO male: broader shoulders, narrower hips
const FULL_TORSO_MALE = `M 58 120 C 76 120, 100 116, 120 116 C 140 116, 164 120, 182 120 C 186 132, 186 152, 182 168 C 178 180, 165 190, 160 205 C 154 222, 152 248, 152 268 C 152 296, 152 320, 156 340 L 84 340 C 88 320, 88 296, 88 268 C 88 248, 86 222, 80 205 C 75 190, 62 180, 58 168 C 54 152, 54 132, 58 120 Z`;

// PELVIS female: wider, more flared
const FULL_PELVIS_FEMALE = `M 88 340 L 152 340 C 160 352, 165 368, 162 385 C 159 395, 150 400, 140 402 L 100 402 C 90 400, 81 395, 78 385 C 75 368, 80 352, 88 340 Z`;

// PELVIS male: narrower, boxier
const FULL_PELVIS_MALE = `M 84 340 L 156 340 C 163 350, 167 365, 164 380 C 162 390, 154 395, 144 398 L 96 398 C 86 395, 78 390, 76 380 C 73 365, 77 350, 84 340 Z`;

// ARMS (right/left mirror): anatomical landmarks
// Right arm: outer side x~38-66, inner side x~66-80
// Shoulder top y=135, wrist y=470, hand y=520
// Landmarks: bicep bulge ~y200-230, elbow inflection y~295, wrist narrowing y~450

const FULL_ARM_RIGHT_FEMALE = `M 68 122 C 54 128, 42 148, 38 175 C 34 200, 37 225, 42 252 C 46 272, 44 288, 40 302 C 37 316, 35 336, 38 360 C 41 385, 46 415, 50 445 C 52 458, 54 468, 56 475 L 72 475 C 70 465, 69 452, 68 440 C 66 410, 68 382, 70 358 C 72 334, 72 316, 70 302 C 68 288, 68 272, 70 252 C 73 226, 74 200, 72 175 C 70 148, 70 128, 68 122 Z`;

const FULL_ARM_LEFT_FEMALE = `M 172 122 C 170 128, 170 148, 168 175 C 166 200, 167 226, 170 252 C 172 272, 172 288, 170 302 C 168 316, 168 334, 170 358 C 172 382, 174 410, 172 440 C 171 452, 170 465, 168 475 L 184 475 C 186 468, 188 458, 190 445 C 194 415, 199 385, 202 360 C 205 336, 203 316, 200 302 C 196 288, 194 272, 198 252 C 203 225, 206 200, 202 175 C 198 148, 186 128, 172 122 Z`;

const FULL_ARM_RIGHT_MALE = `M 62 122 C 46 128, 34 148, 30 178 C 26 205, 30 232, 36 258 C 40 278, 38 295, 34 310 C 31 324, 30 345, 33 370 C 36 395, 41 425, 44 455 C 46 468, 48 475, 50 480 L 68 480 C 66 472, 65 460, 64 448 C 62 418, 64 390, 66 365 C 68 340, 68 322, 66 308 C 64 294, 64 278, 66 258 C 68 232, 68 205, 66 178 C 64 148, 64 128, 62 122 Z`;

const FULL_ARM_LEFT_MALE = `M 178 122 C 176 128, 176 148, 174 178 C 172 205, 172 232, 174 258 C 176 278, 176 294, 174 308 C 172 322, 172 340, 174 365 C 176 390, 178 418, 176 448 C 175 460, 174 472, 172 480 L 190 480 C 192 475, 194 468, 196 455 C 199 425, 204 395, 207 370 C 210 345, 209 324, 206 310 C 202 295, 200 278, 204 258 C 210 232, 214 205, 210 178 C 206 148, 194 128, 178 122 Z`;

// HANDS
const FULL_HAND_RIGHT_FEMALE = `M 54 475 C 50 488, 49 500, 50 510 C 51 518, 54 522, 58 522 C 62 522, 65 518, 66 510 C 67 500, 66 488, 62 475 Z`;
const FULL_HAND_LEFT_FEMALE = `M 178 475 C 174 488, 173 500, 174 510 C 175 518, 178 522, 182 522 C 186 522, 189 518, 190 510 C 191 500, 190 488, 186 475 Z`;
const FULL_HAND_RIGHT_MALE = `M 48 480 C 44 493, 43 505, 44 515 C 45 524, 48 528, 52 528 C 56 528, 59 524, 60 515 C 61 505, 60 493, 56 480 Z`;
const FULL_HAND_LEFT_MALE = `M 184 480 C 180 493, 179 505, 180 515 C 181 524, 184 528, 188 528 C 192 528, 195 524, 196 515 C 197 505, 196 493, 192 480 Z`;

// LEGS: anatomical landmarks
// y 402-700 female, 398-700 male
// Landmarks: inner thigh curve, knee inflection y~540, calf bulge y~580-620, ankle narrowing y~670
const FULL_LEG_RIGHT_FEMALE = `M 82 402 C 80 420, 79 445, 80 470 C 81 495, 84 510, 84 525 C 84 540, 82 554, 80 568 C 78 585, 82 612, 86 635 C 89 655, 90 670, 88 688 C 87 696, 86 702, 86 710 L 116 710 C 116 702, 115 696, 114 688 C 112 670, 113 655, 116 635 C 120 612, 124 585, 122 568 C 120 554, 118 540, 118 525 C 118 510, 121 495, 122 470 C 123 445, 122 420, 120 402 Z`;

const FULL_LEG_LEFT_FEMALE = `M 120 402 C 118 420, 117 445, 118 470 C 119 495, 122 510, 122 525 C 122 540, 120 554, 118 568 C 116 585, 120 612, 124 635 C 127 655, 128 670, 126 688 C 125 696, 124 702, 124 710 L 154 710 C 154 702, 153 696, 152 688 C 150 670, 151 655, 154 635 C 158 612, 162 585, 160 568 C 158 554, 156 540, 156 525 C 156 510, 159 495, 160 470 C 161 445, 160 420, 158 402 Z`;

const FULL_LEG_RIGHT_MALE = `M 78 398 C 76 418, 75 445, 76 472 C 77 497, 80 514, 80 528 C 80 544, 78 556, 76 570 C 74 588, 78 616, 82 638 C 85 658, 86 672, 84 690 C 83 698, 82 704, 82 712 L 114 712 C 114 704, 113 698, 112 690 C 110 672, 111 658, 114 638 C 118 616, 122 588, 120 570 C 118 556, 116 544, 116 528 C 116 514, 119 497, 120 472 C 121 445, 120 418, 118 398 Z`;

const FULL_LEG_LEFT_MALE = `M 122 398 C 120 418, 119 445, 120 472 C 121 497, 124 514, 124 528 C 124 544, 122 556, 120 570 C 118 588, 122 616, 126 638 C 129 658, 130 672, 128 690 C 127 698, 126 704, 126 712 L 158 712 C 158 704, 157 698, 156 690 C 154 672, 155 658, 158 638 C 162 616, 166 588, 164 570 C 162 556, 160 544, 160 528 C 160 514, 163 497, 164 472 C 165 445, 164 418, 162 398 Z`;

// FEET
const FULL_FOOT_RIGHT_FEMALE = `M 84 710 C 80 716, 76 720, 72 720 C 64 720, 60 716, 60 710 L 60 706 C 70 706, 82 706, 88 708 C 89 710, 86 712, 84 710 Z`;
const FULL_FOOT_LEFT_FEMALE = `M 122 710 C 120 712, 117 714, 116 710 C 122 706, 134 706, 144 706 L 144 710 C 144 716, 140 720, 132 720 C 128 720, 124 716, 122 710 Z`;
const FULL_FOOT_RIGHT_MALE = `M 80 712 C 76 718, 72 722, 68 722 C 60 722, 56 718, 56 712 L 56 708 C 66 708, 78 708, 84 710 C 85 712, 82 714, 80 712 Z`;
const FULL_FOOT_LEFT_MALE = `M 126 712 C 124 714, 121 716, 120 712 C 126 708, 138 708, 148 708 L 148 712 C 148 718, 144 722, 136 722 C 132 722, 128 718, 126 712 Z`;

// ---------------------------------------------------------------------------
// Isolated view silhouette paths (240×480 canvas each)
// ---------------------------------------------------------------------------

// Legs isolated view: right leg x 26-96, left leg x 144-214, y 20-460
const ISO_PELVIS_LEGS = `M 20 22 C 52 14, 80 12, 120 12 C 160 12, 188 14, 220 22 L 214 52 L 144 52 C 136 58, 128 62, 120 62 C 112 62, 104 58, 96 52 L 26 52 Z`;
const ISO_LEG_RIGHT = `M 26 52 C 24 100, 22 180, 24 260 C 26 310, 28 355, 30 392 C 32 420, 34 440, 36 455 L 90 455 C 88 440, 88 420, 88 392 C 90 355, 92 310, 94 260 C 96 180, 94 100, 92 52 C 80 48, 38 48, 26 52 Z`;
const ISO_LEG_LEFT = `M 144 52 C 146 100, 148 180, 150 260 C 152 310, 154 355, 156 392 C 158 420, 160 440, 162 455 L 214 455 C 216 440, 208 420, 210 392 C 212 355, 214 310, 214 260 C 216 180, 214 100, 214 52 C 202 48, 162 48, 144 52 Z`;

// Arms isolated view: right arm x 20-90, left arm x 150-220, y 20-460
const ISO_SHOULDER_TORSO = `M 20 30 C 52 18, 80 14, 120 14 C 160 14, 188 18, 220 30 L 218 80 C 200 90, 168 96, 150 96 L 90 96 C 72 96, 40 90, 22 80 Z`;
const ISO_ARM_RIGHT = `M 20 32 C 10 80, 8 160, 12 240 C 14 280, 12 310, 10 340 C 8 368, 10 400, 14 430 C 16 444, 18 456, 20 462 L 52 462 C 50 454, 49 440, 48 426 C 46 398, 48 370, 52 344 C 56 320, 58 292, 56 264 C 54 230, 56 170, 60 96 C 45 84, 26 56, 20 32 Z`;
const ISO_ARM_LEFT = `M 220 32 C 214 56, 195 84, 180 96 C 184 170, 186 230, 184 264 C 182 292, 184 320, 188 344 C 192 370, 194 398, 192 426 C 191 440, 190 454, 188 462 L 220 462 C 222 456, 224 444, 226 430 C 230 400, 232 368, 230 340 C 228 310, 226 280, 228 240 C 232 160, 230 80, 220 32 Z`;

// ---------------------------------------------------------------------------
// Exports matching original API surface
// ---------------------------------------------------------------------------

export const BODY_FIGURE_OUTLINES = {
  female: [
    FULL_HEAD,
    FULL_NECK_FEMALE,
    FULL_TORSO_FEMALE,
    FULL_PELVIS_FEMALE,
    FULL_ARM_RIGHT_FEMALE,
    FULL_ARM_LEFT_FEMALE,
    FULL_HAND_RIGHT_FEMALE,
    FULL_HAND_LEFT_FEMALE,
    FULL_LEG_RIGHT_FEMALE,
    FULL_LEG_LEFT_FEMALE,
    FULL_FOOT_RIGHT_FEMALE,
    FULL_FOOT_LEFT_FEMALE,
  ],
  male: [
    FULL_HEAD,
    FULL_NECK_MALE,
    FULL_TORSO_MALE,
    FULL_PELVIS_MALE,
    FULL_ARM_RIGHT_MALE,
    FULL_ARM_LEFT_MALE,
    FULL_HAND_RIGHT_MALE,
    FULL_HAND_LEFT_MALE,
    FULL_LEG_RIGHT_MALE,
    FULL_LEG_LEFT_MALE,
    FULL_FOOT_RIGHT_MALE,
    FULL_FOOT_LEFT_MALE,
  ],
} as const;

export const BODY_FIGURE_CLIP_PATHS = {
  female: {
    legs: { right: FULL_LEG_RIGHT_FEMALE, left: FULL_LEG_LEFT_FEMALE },
    arms: { right: FULL_ARM_RIGHT_FEMALE, left: FULL_ARM_LEFT_FEMALE },
  },
  male: {
    legs: { right: FULL_LEG_RIGHT_MALE, left: FULL_LEG_LEFT_MALE },
    arms: { right: FULL_ARM_RIGHT_MALE, left: FULL_ARM_LEFT_MALE },
  },
} as const;

export const BODY_HIGHLIGHT_OUTLINES: Readonly<Record<BodyView, ReadonlyArray<string>>> = {
  full: BODY_FIGURE_OUTLINES.female,
  legs: [ISO_PELVIS_LEGS, ISO_LEG_RIGHT, ISO_LEG_LEFT],
  arms: [ISO_SHOULDER_TORSO, ISO_ARM_RIGHT, ISO_ARM_LEFT],
};

export const BODY_CLIP_PATHS: Readonly<Record<BodyView, Record<BodySide, string>>> = {
  full: {
    right: FULL_LEG_RIGHT_FEMALE,
    left: FULL_LEG_LEFT_FEMALE,
  },
  legs: {
    right: ISO_LEG_RIGHT,
    left: ISO_LEG_LEFT,
  },
  arms: {
    right: ISO_ARM_RIGHT,
    left: ISO_ARM_LEFT,
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

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

const VIEW_WIDTH = 240;
const VIEW_HEIGHT = 400;
const LIMB_TOP = 50;
const LIMB_BOTTOM = 375;
const LIMB_WIDTH = 46;
const LIMB_X_RIGHT = 28;
const LIMB_X_LEFT = 147;

const FULL_LEG_TOP = 185;
const FULL_LEG_BOTTOM = 379;
const FULL_LEG_WIDTH = 33;
const FULL_LEG_X_RIGHT = 82;
const FULL_LEG_X_LEFT = 125;
const FULL_ARM_TOP = 96;
const FULL_ARM_BOTTOM = 270;
const FULL_ARM_WIDTH = 29;
const FULL_ARM_X_RIGHT = 37;
const FULL_ARM_X_LEFT = 174;

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
  const pad = 1;
  return `M ${x + pad} ${y + pad} L ${right - pad} ${y + pad} L ${right - pad} ${bottom - pad} L ${x + pad} ${bottom - pad} Z`;
}

function buildFullBodyBandPath(definition: CompressionMeasurementDefinition): string {
  const totalPoints = MAX_POINT_BY_GROUP[definition.group];
  const top = definition.group === "legs" ? FULL_LEG_TOP : FULL_ARM_TOP;
  const bottom = definition.group === "legs" ? FULL_LEG_BOTTOM : FULL_ARM_BOTTOM;
  const width = definition.group === "legs" ? FULL_LEG_WIDTH : FULL_ARM_WIDTH;
  const x = definition.group === "legs"
    ? definition.side === "right"
      ? FULL_LEG_X_RIGHT
      : FULL_LEG_X_LEFT
    : definition.side === "right"
      ? FULL_ARM_X_RIGHT
      : FULL_ARM_X_LEFT;
  const bandHeight = (bottom - top) / totalPoints;
  const y = top + (definition.point - 1) * bandHeight;
  const pad = 0.75;

  return `M ${x + pad} ${y + pad} L ${x + width - pad} ${y + pad} L ${x + width - pad} ${y + bandHeight - pad} L ${x + pad} ${y + bandHeight - pad} Z`;
}

function buildShape(definition: CompressionMeasurementDefinition): BodyZoneShape {
  const totalPoints = MAX_POINT_BY_GROUP[definition.group];
  const limbHeight = LIMB_BOTTOM - LIMB_TOP;
  const bandHeight = limbHeight / totalPoints;
  const x = definition.side === "right" ? LIMB_X_RIGHT : LIMB_X_LEFT;
  const y = LIMB_TOP + (definition.point - 1) * bandHeight;
  const fullTop = definition.group === "legs" ? FULL_LEG_TOP : FULL_ARM_TOP;
  const fullBottom = definition.group === "legs" ? FULL_LEG_BOTTOM : FULL_ARM_BOTTOM;
  const fullWidth = definition.group === "legs" ? FULL_LEG_WIDTH : FULL_ARM_WIDTH;
  const fullX = definition.group === "legs"
    ? definition.side === "right"
      ? FULL_LEG_X_RIGHT
      : FULL_LEG_X_LEFT
    : definition.side === "right"
      ? FULL_ARM_X_RIGHT
      : FULL_ARM_X_LEFT;
  const fullBandHeight = (fullBottom - fullTop) / totalPoints;
  const fullY = fullTop + (definition.point - 1) * fullBandHeight;

  return {
    zoneId: definition.anatomyZone,
    view: definition.group,
    side: definition.side,
    point: definition.point,
    label: definition.label,
    d: buildBandPath(definition),
    fullD: buildFullBodyBandPath(definition),
    labelX: x + LIMB_WIDTH / 2,
    labelY: y + bandHeight / 2,
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

const LEG_OUTER_R = `M 26 48 C 18 120, 16 200, 18 280 C 20 330, 22 365, 26 380 L 72 380 C 70 365, 68 330, 66 280 C 64 200, 62 120, 58 48 Z`;
const LEG_INNER_R = `M 150 48 C 148 120, 146 200, 148 280 C 150 330, 152 365, 156 380 L 202 380 C 206 365, 208 330, 210 280 C 212 200, 210 120, 208 48 Z`;
const PELVIS = `M 24 18 Q 120 8, 216 18 L 210 48 L 148 48 Q 120 52, 92 48 L 30 48 Z`;

const TORSO = `M 62 48 C 50 100, 45 170, 44 240 C 43 280, 45 320, 52 355 L 188 355 C 195 320, 197 280, 196 240 C 195 170, 190 100, 178 48 Z`;
const HEAD = `M 106 10 C 106 2, 134 2, 134 10 C 134 24, 106 24, 106 10 Z`;
const NECK = `M 109 24 L 131 24 L 128 48 L 112 48 Z`;

const ARM_OUTER_R = `M 66 48 C 50 120, 42 200, 46 280 C 48 320, 50 350, 55 375 L 90 375 C 86 350, 84 320, 82 280 C 78 200, 72 120, 76 48 Z`;
const ARM_INNER_R = `M 174 48 C 178 120, 182 200, 178 280 C 176 320, 174 350, 170 375 L 205 375 C 210 350, 212 320, 214 280 C 218 200, 210 120, 204 48 Z`;

const FULL_HEAD = `M 105 18 C 105 4, 135 4, 135 18 C 135 38, 105 38, 105 18 Z`;
const FULL_NECK = `M 111 40 L 129 40 L 132 58 L 108 58 Z`;
const FULL_TORSO_FEMALE = `M 85 60 C 94 70, 102 77, 120 77 C 138 77, 146 70, 155 60 C 166 86, 160 135, 151 170 C 141 181, 99 181, 89 170 C 80 135, 74 86, 85 60 Z`;
const FULL_TORSO_MALE = `M 78 60 C 90 70, 101 76, 120 76 C 139 76, 150 70, 162 60 C 172 95, 166 139, 152 174 C 136 180, 104 180, 88 174 C 74 139, 68 95, 78 60 Z`;
const FULL_PELVIS_FEMALE = `M 86 168 C 102 184, 138 184, 154 168 L 163 197 C 148 207, 92 207, 77 197 Z`;
const FULL_PELVIS_MALE = `M 88 168 C 104 181, 136 181, 152 168 L 158 194 C 143 202, 97 202, 82 194 Z`;
const FULL_ARM_RIGHT_FEMALE = `M 82 62 C 56 89, 44 145, 37 270 L 65 270 C 69 192, 75 124, 93 78 Z`;
const FULL_ARM_LEFT_FEMALE = `M 158 62 C 184 89, 196 145, 203 270 L 175 270 C 171 192, 165 124, 147 78 Z`;
const FULL_ARM_RIGHT_MALE = `M 75 61 C 52 85, 41 145, 35 270 L 66 270 C 70 190, 78 122, 95 76 Z`;
const FULL_ARM_LEFT_MALE = `M 165 61 C 188 85, 199 145, 205 270 L 174 270 C 170 190, 162 122, 145 76 Z`;
const FULL_LEG_RIGHT_FEMALE = `M 82 197 C 78 247, 78 316, 84 380 L 115 380 C 113 317, 113 247, 110 197 Z`;
const FULL_LEG_LEFT_FEMALE = `M 130 197 C 127 247, 127 317, 125 380 L 156 380 C 162 316, 162 247, 158 197 Z`;
const FULL_LEG_RIGHT_MALE = `M 80 194 C 76 250, 77 318, 83 380 L 116 380 C 114 318, 113 250, 111 194 Z`;
const FULL_LEG_LEFT_MALE = `M 129 194 C 127 250, 126 318, 124 380 L 157 380 C 163 318, 164 250, 160 194 Z`;

export const BODY_FIGURE_OUTLINES = {
  female: [
    FULL_HEAD,
    FULL_NECK,
    FULL_TORSO_FEMALE,
    FULL_PELVIS_FEMALE,
    FULL_ARM_RIGHT_FEMALE,
    FULL_ARM_LEFT_FEMALE,
    FULL_LEG_RIGHT_FEMALE,
    FULL_LEG_LEFT_FEMALE,
  ],
  male: [
    FULL_HEAD,
    FULL_NECK,
    FULL_TORSO_MALE,
    FULL_PELVIS_MALE,
    FULL_ARM_RIGHT_MALE,
    FULL_ARM_LEFT_MALE,
    FULL_LEG_RIGHT_MALE,
    FULL_LEG_LEFT_MALE,
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
  legs: [PELVIS, LEG_OUTER_R, LEG_INNER_R],
  arms: [HEAD, NECK, TORSO, ARM_OUTER_R, ARM_INNER_R],
};

export const BODY_CLIP_PATHS: Readonly<Record<BodyView, Record<BodySide, string>>> = {
  full: {
    right: FULL_LEG_RIGHT_FEMALE,
    left: FULL_LEG_LEFT_FEMALE,
  },
  legs: {
    right: LEG_OUTER_R,
    left: LEG_INNER_R,
  },
  arms: {
    right: ARM_OUTER_R,
    left: ARM_INNER_R,
  },
};

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

// Centralized calibration for the BodyHighlight full-body view.
//
// All coordinates that map a measurement point to a position inside the
// rendered figure live here. No magic constants scattered across the
// renderer, the zones builder, or the silhouette assets. Sex-specific
// figures expose their own FigureCalibration entry.
//
// PRINCIPLES
//   - Markers stay bounded INSIDE the figure. A marker is a small,
//     translucent rounded rect anchored at an interpolated limb-centerline
//     position. Until per-section anatomical clipping exists, a contained
//     marker is the safe visual.
//   - Coordinates are tightened so extreme points (leg 28, arm 19) stay
//     above the foot/palm — they never appear to fall into hand or foot.
//   - If a sex does not have a properly calibrated figure yet, its
//     calibration uses defensive centered coordinates and an explicit
//     `precision: "approximate"` flag so callers can warn or downgrade UX.

export type FullBodySex = "male" | "female";

export type LimbCenterline = {
  readonly top: number;
  readonly bottom: number;
  readonly centerlineX: { readonly atTop: number; readonly atBottom: number };
  readonly width: { readonly atTop: number; readonly atBottom: number };
};

export type LimbCalibration = {
  readonly right: LimbCenterline;
  readonly left: LimbCenterline;
};

export type HotspotRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type CalibrationPrecision = "traced" | "approximate";

export type FigureCalibration = {
  readonly viewBox: { readonly width: number; readonly height: number };
  // Asset-related fields only apply to figures rendered from an external
  // SVG asset (currently only the male auto-traced figure). Hand-authored
  // silhouettes leave these undefined.
  readonly assetHref?: string;
  readonly assetHeightInViewBox?: number;
  readonly precision: CalibrationPrecision;
  readonly markerHeightRange: { readonly min: number; readonly max: number };
  readonly markerHeightFactor: number;
  readonly legs: LimbCalibration;
  readonly arms: LimbCalibration;
  readonly headHotspot: HotspotRect;
  readonly handHotspots: ReadonlyArray<HotspotRect & { readonly side: "right" | "left" }>;
  readonly sideLabels: {
    readonly right: { readonly x: number; readonly y: number; readonly text: string };
    readonly left: { readonly x: number; readonly y: number; readonly text: string };
  };
};

function lerp(start: number, end: number, ratio: number): number {
  return start + (end - start) * ratio;
}

// Auto-traced male full body — public/anatomy/full-body-male.svg
// Image native dimensions: 567.21 × 1288.86 (potrace --tight output).
// Landmarks measured from front_male_bw.png (bitmap 670 × 1460) via
// /tmp/anatomy-trace/measure_landmarks.py. Top/bottom limb bounds pulled
// IN from the absolute anatomy edges so markers never bleed into foot
// or palm.
export const MALE_FULL_BODY: FigureCalibration = {
  viewBox: { width: 240, height: 545 },
  assetHref: "/anatomy/full-body-male.svg",
  assetHeightInViewBox: 545,
  precision: "traced",
  markerHeightRange: { min: 7, max: 13 },
  markerHeightFactor: 1.35,
  // Synced to the zone generator y_range (see /tmp/anatomy-trace/generate_zones.py):
  //   legs bitmap y 685..1180 → viewBox 283..492
  //   arms bitmap y 285..660  → viewBox 113..272
  // Marker centers stay aligned with the rendered zone band so the active
  // point number sits inside its highlight.
  legs: {
    right: {
      top: 283,
      bottom: 492,
      centerlineX: { atTop: 91, atBottom: 92 },
      width: { atTop: 36, atBottom: 22 },
    },
    left: {
      top: 283,
      bottom: 492,
      centerlineX: { atTop: 149, atBottom: 148 },
      width: { atTop: 36, atBottom: 22 },
    },
  },
  arms: {
    right: {
      top: 113,
      bottom: 272,
      centerlineX: { atTop: 56, atBottom: 47 },
      width: { atTop: 26, atBottom: 18 },
    },
    left: {
      top: 113,
      bottom: 272,
      centerlineX: { atTop: 184, atBottom: 193 },
      width: { atTop: 26, atBottom: 18 },
    },
  },
  headHotspot: { x: 90, y: 0, width: 60, height: 76 },
  handHotspots: [
    { side: "right", x: 0, y: 256, width: 70, height: 64 },
    { side: "left", x: 170, y: 256, width: 70, height: 64 },
  ],
  sideLabels: {
    right: { x: 18, y: 14, text: "D" },
    left: { x: 222, y: 14, text: "I" },
  },
};

// Hand-drawn female silhouette — silhouettes/full-body-female.tsx.
// Native viewBox 240 × 720 (legacy mannequin proportions). Until the
// female reference PNG is auto-traced, this calibration uses defensive,
// conservatively-centered coordinates so markers stay clearly inside the
// drawn limb at every point. Marker positions are intentionally NOT
// claimed to be clinically precise — `precision: "approximate"` flags
// that downstream UX can surface a "calibración pendiente" hint.
//
// Landmarks (from silhouettes/full-body-female.tsx OUTLINE):
//   crown y≈16, shoulder cap y≈144, chest y≈218, waist y≈318,
//   hip y≈416, crotch y≈470, knee y≈566, ankle y≈696, foot y≈712.
// Limb interior x ranges (rough):
//   arms.right outer x≈44, inner x≈80;  arms.left outer x≈196, inner x≈164
//   legs.right outer x≈80, inner x≈116; legs.left outer x≈164, inner x≈124
export const FEMALE_FULL_BODY: FigureCalibration = {
  viewBox: { width: 240, height: 720 },
  precision: "approximate",
  markerHeightRange: { min: 8, max: 14 },
  markerHeightFactor: 1.4,
  legs: {
    right: {
      top: 440,
      bottom: 670,
      centerlineX: { atTop: 100, atBottom: 102 },
      width: { atTop: 28, atBottom: 18 },
    },
    left: {
      top: 440,
      bottom: 670,
      centerlineX: { atTop: 140, atBottom: 138 },
      width: { atTop: 28, atBottom: 18 },
    },
  },
  arms: {
    right: {
      top: 170,
      bottom: 432,
      centerlineX: { atTop: 60, atBottom: 54 },
      width: { atTop: 22, atBottom: 16 },
    },
    left: {
      top: 170,
      bottom: 432,
      centerlineX: { atTop: 180, atBottom: 186 },
      width: { atTop: 22, atBottom: 16 },
    },
  },
  headHotspot: { x: 84, y: 8, width: 72, height: 102 },
  handHotspots: [
    { side: "right", x: 24, y: 442, width: 56, height: 64 },
    { side: "left", x: 160, y: 442, width: 56, height: 64 },
  ],
  sideLabels: {
    right: { x: 16, y: 18, text: "D" },
    left: { x: 224, y: 18, text: "I" },
  },
};

export function getFullBodyCalibration(sex: FullBodySex): FigureCalibration {
  return sex === "male" ? MALE_FULL_BODY : FEMALE_FULL_BODY;
}

// Marker geometry derived from the calibration for one measurement point.
// `ratio` is (point - 1) / (totalPoints - 1) so it walks evenly from the
// limb top (0) to the bottom (1).
export type MarkerRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type MarkerInput = {
  readonly group: "legs" | "arms";
  readonly side: "right" | "left";
  readonly point: number;
};

export function getMarkerRect(
  figure: FigureCalibration,
  zone: MarkerInput,
  totalPoints: number,
): MarkerRect {
  const limb = zone.group === "legs" ? figure.legs : figure.arms;
  const side = zone.side === "right" ? limb.right : limb.left;

  const ratio = totalPoints > 1 ? (zone.point - 1) / (totalPoints - 1) : 0;
  const slot = (side.bottom - side.top) / totalPoints;
  const centerY = side.top + (zone.point - 0.5) * slot;
  const centerX = lerp(side.centerlineX.atTop, side.centerlineX.atBottom, ratio);
  const width = lerp(side.width.atTop, side.width.atBottom, ratio);
  const height = Math.min(
    figure.markerHeightRange.max,
    Math.max(figure.markerHeightRange.min, slot * figure.markerHeightFactor),
  );

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

export function markerRectToPath(rect: MarkerRect): string {
  const pad = 0.5;
  const r = Math.min(4, (rect.height - pad * 2) / 2, (rect.width - pad * 2) / 2);
  const x0 = rect.x + pad;
  const y0 = rect.y + pad;
  const x1 = rect.x + rect.width - pad;
  const y1 = rect.y + rect.height - pad;
  return `M ${x0 + r} ${y0} L ${x1 - r} ${y0} Q ${x1} ${y0}, ${x1} ${y0 + r} L ${x1} ${y1 - r} Q ${x1} ${y1}, ${x1 - r} ${y1} L ${x0 + r} ${y1} Q ${x0} ${y1}, ${x0} ${y1 - r} L ${x0} ${y0 + r} Q ${x0} ${y0}, ${x0 + r} ${y0} Z`;
}

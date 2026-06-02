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
  // Arm band/centerline calibration matches the contour-fitted male arm
  // bands (see MALE_ARM_CONTOUR). The 19 arm points span the drawn
  // shoulder→wrist run (y 115..234), NOT shoulder→fingertips, so the active
  // point number sits on the centerline of the highlighted band instead of
  // drifting into the hand. centerlineX follows the arm as it angles inward
  // toward the wrist (centres measured from full-body-male.svg @240×545).
  arms: {
    right: {
      top: 115,
      bottom: 234,
      centerlineX: { atTop: 57, atBottom: 35 },
      width: { atTop: 24, atBottom: 18 },
    },
    left: {
      top: 115,
      bottom: 234,
      centerlineX: { atTop: 183, atBottom: 205 },
      width: { atTop: 24, atBottom: 18 },
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

// Auto-traced female full body — public/anatomy/full-body-female.svg
// Image native dimensions: 522.84 × 1226.85 (potrace --tight output from
// the FIGURA FEMENINA.png front-body crop). Landmarks measured from
// silhouette_female_eroded.png (bitmap 523 × 1228) via
// /tmp/anatomy-trace-female/refine_calibration.py.
//
//   arms bitmap y 320..555 → viewBox 147..255 (above palm spread)
//   legs bitmap y 660..1170 → viewBox 303..537 (above ankle widening)
//
// Zone polygons live in zones-female.ts (FULL_BODY_FEMALE_ZONES). Marker
// centers are aligned so the active point number sits inside the band.
export const FEMALE_FULL_BODY: FigureCalibration = {
  viewBox: { width: 240, height: 564 },
  assetHref: "/anatomy/full-body-female.svg",
  assetHeightInViewBox: 564,
  precision: "traced",
  markerHeightRange: { min: 7, max: 13 },
  markerHeightFactor: 1.35,
  legs: {
    right: {
      top: 303,
      bottom: 537,
      centerlineX: { atTop: 90, atBottom: 86 },
      width: { atTop: 46, atBottom: 19 },
    },
    left: {
      top: 303,
      bottom: 537,
      centerlineX: { atTop: 150, atBottom: 154 },
      width: { atTop: 46, atBottom: 19 },
    },
  },
  // Arm marker calibration matches the contour-fitted female arm bands (see
  // FEMALE_ARM_CONTOUR). 19 points span the drawn upper-arm→wrist run
  // (y 130..242), so the active point number sits on the band centerline.
  arms: {
    right: {
      top: 130,
      bottom: 242,
      centerlineX: { atTop: 61, atBottom: 35 },
      width: { atTop: 18, atBottom: 16 },
    },
    left: {
      top: 130,
      bottom: 242,
      centerlineX: { atTop: 179, atBottom: 205 },
      width: { atTop: 18, atBottom: 16 },
    },
  },
  headHotspot: { x: 90, y: 0, width: 60, height: 92 },
  handHotspots: [
    { side: "right", x: 0, y: 260, width: 70, height: 60 },
    { side: "left", x: 170, y: 260, width: 70, height: 60 },
  ],
  sideLabels: {
    right: { x: 18, y: 14, text: "D" },
    left: { x: 222, y: 14, text: "I" },
  },
};

export function getFullBodyCalibration(sex: FullBodySex): FigureCalibration {
  return sex === "male" ? MALE_FULL_BODY : FEMALE_FULL_BODY;
}

// Male arm highlights are NOT the auto-traced arm polygons: those were traced
// from a different source bitmap than the rendered full-body-male.svg, so they
// sit ~6–9px outboard of the drawn arm and run ~15% longer, spilling outside
// the limb and into the hand. Instead the arm bands are generated directly
// from the rendered arm's measured contour so they always stay inside it and
// follow its taper (see buildContourArmBand in body-highlight-zones.ts).
//
// Edges are sampled from full-body-male.svg rasterised at viewBox 240×545 for
// the figure's RIGHT arm (viewer's left). The LEFT arm is the mirror about
// `mirrorX`. `outer` is the limb's outboard edge, `inner` the torso-side edge.
// Bands span [top..bottom] = shoulder..wrist; the hand is measured separately.
export const MALE_ARM_CONTOUR = {
  top: 115,
  bottom: 234,
  mirrorX: 120,
  outer: [
    [113, 45],
    [140, 42],
    [160, 39],
    [175, 37],
    [192, 31],
    [208, 29],
    [224, 27],
    [234, 25],
  ],
  inner: [
    [113, 70],
    [140, 70],
    [160, 66],
    [175, 62],
    [192, 59],
    [208, 54],
    [224, 49],
    [234, 45],
  ],
} as const;

// Female arm highlights, like the male ones, are NOT the auto-traced arm
// polygons: those were traced from a different source than the rendered
// full-body-female.svg, so they sit outboard of the drawn arm and overflow the
// limb near the wrist (a Y-only lift/scale can't fix a horizontal mismatch).
// Instead the female arm bands are generated from the rendered arm's measured
// contour so they stay inside it and follow its taper (see buildContourArmBand
// in body-highlight-zones.ts).
//
// Edges sampled from full-body-female.svg rasterised at viewBox 240×564 for the
// figure's RIGHT arm (viewer's left); the LEFT arm is the mirror about
// `mirrorX`. Bands span [top..bottom] = upper-arm..wrist; the hand (which
// begins ~y246) is measured separately.
export const FEMALE_ARM_CONTOUR = {
  top: 130,
  bottom: 242,
  mirrorX: 120,
  outer: [
    [118, 54],
    [135, 50],
    [160, 47],
    [178, 44],
    [195, 38],
    [210, 34],
    [226, 31],
    [238, 28],
    [244, 26],
  ],
  inner: [
    [118, 72],
    [135, 70],
    [160, 71],
    [178, 66],
    [195, 64],
    [210, 58],
    [226, 52],
    [238, 46],
    [244, 44],
  ],
} as const;

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

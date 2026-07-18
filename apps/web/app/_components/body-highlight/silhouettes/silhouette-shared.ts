// Shared viewBox and styling defaults so every silhouette asset uses the
// same coordinate system. Band geometry in body-highlight-zones.ts is
// calibrated to FULL_BODY_VIEWBOX (240 × 545) — tight to the auto-traced
// male asset's native aspect ratio (567×1289) so it fills the card without
// vertical letterbox.

export const FULL_BODY_VIEWBOX = { width: 240, height: 545 } as const;

// GENERIC head detail (full-body head-hotspot flow) — matches the native
// pixel dimensions of the sex-specific clinical reference PNGs in
// /public/anatomy (head-female.png / head-male.png) so an <image> drops in
// 1:1. This is NOT the Mentonera figure; do not point garment-specific figures
// at it.
export const HEAD_DETAIL_VIEWBOX = { width: 1122, height: 1402 } as const;

// MENTONERA-ONLY figure. A clean vector trace of the client's "Máscara y
// mentonera" PDF (front + left-facing profile), inlined by HeadFigure and
// rendered exclusively in the dedicated Mentonera view="head" path. Its
// coordinate space is the PDF page units of those two heads, normalized to the
// origin with the inter-figure gap tightened; every Mentonera measurement
// landmark in body-highlight-zones.ts is expressed in this same space. It is
// deliberately separate from HEAD_DETAIL_VIEWBOX so the two render paths never
// share a coordinate space.
export const HEAD_FIGURE_VIEWBOX = { width: 331, height: 247 } as const;

// Hand detail still matches the native pixel dimensions of the clinical
// reference PNG in /public/anatomy so an <image> element drops in 1:1.
export const HAND_DETAIL_VIEWBOX = { width: 1122, height: 1402 } as const;

export type SilhouetteStyleProps = {
  outlineStroke?: string;
  outlineWidth?: number;
  articulationStroke?: string;
  articulationWidth?: number;
};

export const DEFAULT_OUTLINE_STROKE = "#1f2937";
export const DEFAULT_OUTLINE_WIDTH = 1.4;
export const DEFAULT_ARTICULATION_STROKE = "#64748b";
export const DEFAULT_ARTICULATION_WIDTH = 1;

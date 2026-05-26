// Shared viewBox and styling defaults so every silhouette asset uses the
// same coordinate system. Band geometry in body-highlight-zones.ts is
// calibrated to FULL_BODY_VIEWBOX (240 × 545) — tight to the auto-traced
// male asset's native aspect ratio (567×1289) so it fills the card without
// vertical letterbox.

export const FULL_BODY_VIEWBOX = { width: 240, height: 545 } as const;

// Head and hand detail viewBoxes match the native pixel dimensions of the
// clinical reference PNGs in /public/anatomy so an <image> element can be
// dropped in 1:1.
export const HEAD_DETAIL_VIEWBOX = { width: 1122, height: 1402 } as const;

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

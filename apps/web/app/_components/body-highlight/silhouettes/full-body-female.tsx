import { FEMALE_FULL_BODY } from "../body-highlight-calibration";

// Renders the auto-traced female full-body line art as a vector <image>
// inside the parent BodyHighlight SVG. Mirrors the male asset pipeline —
// all coordinates (viewBox dims, asset path, asset height) come from
// body-highlight-calibration.ts so future re-calibration or asset swap
// touches a single source of truth.
export function FullBodyFemale() {
  return (
    <g aria-hidden="true">
      <image
        href={FEMALE_FULL_BODY.assetHref}
        x={0}
        y={0}
        width={FEMALE_FULL_BODY.viewBox.width}
        height={FEMALE_FULL_BODY.assetHeightInViewBox}
        preserveAspectRatio="xMidYMid meet"
        pointerEvents="none"
      />
    </g>
  );
}

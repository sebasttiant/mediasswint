import { MALE_FULL_BODY } from "../body-highlight-calibration";

// Renders the auto-traced male full-body line art as a vector <image>
// inside the parent BodyHighlight SVG. All coordinates (viewBox dims,
// asset path, asset height) come from body-highlight-calibration.ts so
// any future re-calibration or asset swap touches a single source of
// truth.
export function FullBodyMale() {
  return (
    <g aria-hidden="true">
      <image
        href={MALE_FULL_BODY.assetHref}
        x={0}
        y={0}
        width={MALE_FULL_BODY.viewBox.width}
        height={MALE_FULL_BODY.assetHeightInViewBox}
        preserveAspectRatio="xMidYMid meet"
        pointerEvents="none"
      />
    </g>
  );
}

import { HAND_DETAIL_VIEWBOX, type SilhouetteStyleProps } from "./silhouette-shared";

// Male hand reference — embeds the clinical PNG from /public/anatomy.
// The 2×2 layout (palms top, backs bottom) lives inside the PNG itself,
// so this component only renders the raster at the SVG's native viewBox.
const HAND_MALE_HREF = "/anatomy/hand-male.png";

export function HandDetailMale(_props: SilhouetteStyleProps) {
  return (
    <image
      aria-hidden="true"
      href={HAND_MALE_HREF}
      x={0}
      y={0}
      width={HAND_DETAIL_VIEWBOX.width}
      height={HAND_DETAIL_VIEWBOX.height}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

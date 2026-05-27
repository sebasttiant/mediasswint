import { HAND_DETAIL_VIEWBOX, type SilhouetteStyleProps } from "./silhouette-shared";

// Female hand reference — embeds the clinical PNG from /public/anatomy.
const HAND_FEMALE_HREF = "/anatomy/hand-female.png";

export function HandDetailFemale(_props: SilhouetteStyleProps) {
  return (
    <image
      aria-hidden="true"
      href={HAND_FEMALE_HREF}
      x={0}
      y={0}
      width={HAND_DETAIL_VIEWBOX.width}
      height={HAND_DETAIL_VIEWBOX.height}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

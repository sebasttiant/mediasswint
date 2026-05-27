import { HEAD_DETAIL_VIEWBOX, type SilhouetteStyleProps } from "./silhouette-shared";

// Female head reference — embeds the clinical PNG from /public/anatomy.
const HEAD_FEMALE_HREF = "/anatomy/head-female.png";

export function HeadDetailFemale(_props: SilhouetteStyleProps) {
  return (
    <image
      aria-hidden="true"
      href={HEAD_FEMALE_HREF}
      x={0}
      y={0}
      width={HEAD_DETAIL_VIEWBOX.width}
      height={HEAD_DETAIL_VIEWBOX.height}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

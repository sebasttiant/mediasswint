import { HEAD_DETAIL_VIEWBOX, type SilhouetteStyleProps } from "./silhouette-shared";

// Male head reference — embeds the clinical PNG from /public/anatomy.
// The front / profile / back layout lives inside the PNG itself, so this
// component only renders the raster at the SVG's native viewBox.
const HEAD_MALE_HREF = "/anatomy/head-male.png";

export function HeadDetailMale(_props: SilhouetteStyleProps) {
  return (
    <image
      aria-hidden="true"
      href={HEAD_MALE_HREF}
      x={0}
      y={0}
      width={HEAD_DETAIL_VIEWBOX.width}
      height={HEAD_DETAIL_VIEWBOX.height}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

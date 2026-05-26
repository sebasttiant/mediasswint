import {
  DEFAULT_ARTICULATION_STROKE,
  DEFAULT_ARTICULATION_WIDTH,
  DEFAULT_OUTLINE_STROKE,
  DEFAULT_OUTLINE_WIDTH,
  type SilhouetteStyleProps,
} from "./silhouette-shared";

// Female head reference — viewBox 360×200, three views in a row:
//   front (cx 60), profile (cx 180), back (cx 300).
// Each head is roughly 80 wide × 160 tall to match the clinical PDF
// reference. Soft curves, narrower jaw than the male variant.

const FRONT_OUTLINE = [
  "M 60 24",
  "C 82 24, 96 44, 96 78",
  "C 96 102, 88 122, 76 134",
  "C 72 144, 66 162, 60 170",
  "C 54 162, 48 144, 44 134",
  "C 32 122, 24 102, 24 78",
  "C 24 44, 38 24, 60 24",
  "Z",
].join(" ");

const PROFILE_OUTLINE = [
  // Profile faces SVG-right (subject's right). Crown is up, chin down,
  // nape on the left, nose pushing right.
  "M 180 24",
  "C 202 24, 218 42, 218 74",
  "C 218 92, 214 108, 208 120",
  "C 212 126, 214 132, 212 138",
  "C 210 142, 206 142, 202 140",
  "C 200 144, 198 150, 196 156",
  "C 192 162, 184 168, 174 170",
  "C 168 168, 162 162, 160 154",
  "L 156 142",
  "L 152 140",
  "C 146 138, 142 130, 144 120",
  "C 142 108, 142 92, 144 78",
  "C 146 46, 160 24, 180 24",
  "Z",
].join(" ");

const BACK_OUTLINE = [
  "M 300 24",
  "C 322 24, 336 44, 336 76",
  "C 336 104, 330 124, 318 134",
  "L 316 152",
  "C 314 162, 308 168, 300 168",
  "C 292 168, 286 162, 284 152",
  "L 282 134",
  "C 270 124, 264 104, 264 76",
  "C 264 44, 278 24, 300 24",
  "Z",
].join(" ");

const ARTICULATIONS: ReadonlyArray<string> = [
  // FRONT — eyes, brows, nose, lips, jaw, ears
  "M 40 88 Q 47 84 54 88",
  "M 66 88 Q 73 84 80 88",
  "M 44 98 a 3 2 0 1 0 6 0 a 3 2 0 1 0 -6 0",
  "M 70 98 a 3 2 0 1 0 6 0 a 3 2 0 1 0 -6 0",
  "M 60 102 L 60 118",
  "M 58 122 Q 60 124 62 122",
  "M 54 138 Q 60 142 66 138",
  "M 28 100 Q 24 110 30 116",
  "M 92 100 Q 96 110 90 116",
  "M 36 130 Q 60 158 84 130",
  // PROFILE — nose, lip, chin profile, ear, hairline
  "M 212 96 Q 220 100 218 106",
  "M 210 116 L 210 122",
  "M 210 128 L 206 132",
  "M 178 88 a 5 7 0 1 0 0 14 a 5 7 0 1 0 0 -14",
  "M 152 60 Q 168 70 184 64",
  "M 152 130 L 160 136",
  // BACK — nape, hair part hint, ears profile
  "M 268 96 Q 270 104 276 108",
  "M 332 96 Q 330 104 324 108",
  "M 300 38 L 300 124",
  "M 286 152 Q 300 158 314 152",
];

export function HeadDetailFemale({
  outlineStroke = DEFAULT_OUTLINE_STROKE,
  outlineWidth = DEFAULT_OUTLINE_WIDTH,
  articulationStroke = DEFAULT_ARTICULATION_STROKE,
  articulationWidth = DEFAULT_ARTICULATION_WIDTH,
}: SilhouetteStyleProps) {
  return (
    <g aria-hidden="true">
      <g
        fill="none"
        stroke={outlineStroke}
        strokeWidth={outlineWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      >
        <path d={FRONT_OUTLINE} />
        <path d={PROFILE_OUTLINE} />
        <path d={BACK_OUTLINE} />
      </g>
      <g
        fill="none"
        stroke={articulationStroke}
        strokeWidth={articulationWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.65}
        vectorEffect="non-scaling-stroke"
      >
        {ARTICULATIONS.map((d, index) => (
          <path key={`hf-art-${index}`} d={d} />
        ))}
      </g>
    </g>
  );
}

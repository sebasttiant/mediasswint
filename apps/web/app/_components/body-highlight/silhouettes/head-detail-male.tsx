import {
  DEFAULT_ARTICULATION_STROKE,
  DEFAULT_ARTICULATION_WIDTH,
  DEFAULT_OUTLINE_STROKE,
  DEFAULT_OUTLINE_WIDTH,
  type SilhouetteStyleProps,
} from "./silhouette-shared";

// Male head reference — viewBox 360×200. Same layout as the female sheet
// (front / profile / back) but squarer jaw, broader temples, slightly
// larger overall envelope.

const FRONT_OUTLINE = [
  "M 60 22",
  "C 84 22, 100 42, 100 76",
  "C 100 100, 92 122, 80 134",
  "C 78 146, 70 164, 60 172",
  "C 50 164, 42 146, 40 134",
  "C 28 122, 20 100, 20 76",
  "C 20 42, 36 22, 60 22",
  "Z",
].join(" ");

const PROFILE_OUTLINE = [
  "M 178 22",
  "C 204 22, 222 42, 222 74",
  "C 222 92, 218 110, 212 122",
  "C 216 128, 218 134, 216 140",
  "C 214 144, 210 144, 206 142",
  "C 204 146, 202 152, 200 158",
  "C 196 166, 186 172, 176 172",
  "C 168 170, 162 162, 160 152",
  "L 156 140",
  "L 152 138",
  "C 146 136, 142 128, 144 118",
  "C 142 106, 142 90, 144 76",
  "C 146 44, 158 22, 178 22",
  "Z",
].join(" ");

const BACK_OUTLINE = [
  "M 300 22",
  "C 324 22, 340 42, 340 74",
  "C 340 102, 332 124, 320 134",
  "L 318 154",
  "C 316 164, 310 170, 300 170",
  "C 290 170, 284 164, 282 154",
  "L 280 134",
  "C 268 124, 260 102, 260 74",
  "C 260 42, 276 22, 300 22",
  "Z",
].join(" ");

const ARTICULATIONS: ReadonlyArray<string> = [
  // FRONT — eyes, brows (heavier), nose, lips, jaw
  "M 36 88 Q 46 82 56 88",
  "M 64 88 Q 74 82 84 88",
  "M 42 100 a 3 2 0 1 0 6 0 a 3 2 0 1 0 -6 0",
  "M 72 100 a 3 2 0 1 0 6 0 a 3 2 0 1 0 -6 0",
  "M 60 104 L 60 122",
  "M 56 126 Q 60 130 64 126",
  "M 52 142 Q 60 146 68 142",
  "M 22 100 Q 18 112 24 118",
  "M 98 100 Q 102 112 96 118",
  "M 30 134 Q 60 168 90 134",
  // PROFILE — nose, lip, chin, ear
  "M 216 96 Q 224 102 222 108",
  "M 214 118 L 214 124",
  "M 214 130 L 210 134",
  "M 176 88 a 5 8 0 1 0 0 16 a 5 8 0 1 0 0 -16",
  "M 152 56 Q 170 66 188 60",
  "M 152 132 L 162 140",
  // BACK — nape, ears edges, vertical centerline
  "M 264 96 Q 268 104 274 108",
  "M 336 96 Q 332 104 326 108",
  "M 300 36 L 300 126",
  "M 284 154 Q 300 160 316 154",
];

export function HeadDetailMale({
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
          <path key={`hm-art-${index}`} d={d} />
        ))}
      </g>
    </g>
  );
}

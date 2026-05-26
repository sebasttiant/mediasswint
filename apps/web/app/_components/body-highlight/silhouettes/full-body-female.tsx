import {
  DEFAULT_ARTICULATION_STROKE,
  DEFAULT_ARTICULATION_WIDTH,
  DEFAULT_OUTLINE_STROKE,
  DEFAULT_OUTLINE_WIDTH,
  type SilhouetteStyleProps,
} from "./silhouette-shared";

// Clinical female silhouette — viewBox 240×720, centerline x=120.
// Continuous outer hull traced clockwise from the crown so that band
// geometry (arms x 44..196 / legs x 76..168) sits fully inside the limb
// interior. Soft hourglass torso, narrow waist, defined hip, hanging arms
// with paddle hands, tapered legs and small feet.
const OUTLINE = [
  "M 120 16",
  "C 142 16, 154 32, 152 60",
  "C 150 80, 142 98, 132 104",
  "L 132 118",
  "C 132 126, 136 134, 142 142",
  "C 158 144, 174 150, 186 162",
  "C 192 180, 196 198, 196 220",
  "C 198 252, 198 284, 196 316",
  "C 194 348, 192 378, 190 408",
  "C 192 430, 192 448, 192 460",
  "C 196 472, 198 486, 192 494",
  "C 184 502, 172 504, 166 496",
  "C 162 488, 162 478, 164 468",
  "C 166 458, 168 450, 168 442",
  "L 168 430",
  "C 170 402, 172 372, 172 342",
  "C 172 312, 170 280, 168 252",
  "C 166 228, 162 210, 156 198",
  "C 152 192, 148 192, 146 198",
  "C 152 230, 156 262, 158 292",
  "C 160 318, 160 344, 156 368",
  "C 152 388, 152 408, 158 426",
  "C 162 460, 164 510, 160 558",
  "C 158 584, 158 614, 154 654",
  "C 152 678, 150 696, 150 706",
  "C 152 712, 162 714, 168 714",
  "L 124 714",
  "C 122 712, 122 706, 122 696",
  "C 122 660, 122 622, 122 582",
  "C 124 552, 124 510, 124 470",
  "L 124 458",
  "L 120 470",
  "L 116 458",
  "L 116 470",
  "C 116 510, 116 552, 118 582",
  "C 118 622, 118 660, 118 696",
  "C 118 706, 118 712, 116 714",
  "L 72 714",
  "C 78 714, 88 712, 90 706",
  "C 90 696, 88 678, 86 654",
  "C 82 614, 82 584, 80 558",
  "C 76 510, 78 460, 82 426",
  "C 88 408, 88 388, 84 368",
  "C 80 344, 80 318, 82 292",
  "C 84 262, 88 230, 94 198",
  "C 92 192, 88 192, 84 198",
  "C 78 210, 74 228, 72 252",
  "C 70 280, 68 312, 68 342",
  "C 68 372, 70 402, 72 430",
  "L 72 442",
  "C 72 450, 74 458, 76 468",
  "C 78 478, 78 488, 74 496",
  "C 68 504, 56 502, 48 494",
  "C 42 486, 44 472, 48 460",
  "C 48 448, 48 430, 50 408",
  "C 48 378, 46 348, 44 316",
  "C 42 284, 42 252, 44 220",
  "C 44 198, 48 180, 54 162",
  "C 66 150, 82 144, 98 142",
  "C 104 134, 108 126, 108 118",
  "L 108 104",
  "C 98 98, 90 80, 90 60",
  "C 88 32, 100 16, 120 16",
  "Z",
].join(" ");

// Articulation strokes — clinical joint detail drawn on top of the
// silhouette. Coordinates calibrated to OUTLINE landmarks above.
const ARTICULATIONS: ReadonlyArray<string> = [
  // Shoulder yoke (clavicle level)
  "M 90 154 Q 120 162 150 154",
  // Bust line (subtle, single curve under chest)
  "M 92 218 Q 120 228 148 218",
  // Sternum hint
  "M 120 168 L 120 210",
  // Waist line
  "M 92 318 Q 120 328 148 318",
  // Hip / underwear line
  "M 80 416 Q 120 432 160 416",
  // Right elbow crease (subject right = svg-left side)
  "M 40 312 Q 56 320 70 312",
  // Left elbow crease
  "M 170 312 Q 184 320 200 312",
  // Right wrist
  "M 46 440 Q 60 446 74 440",
  // Left wrist
  "M 166 440 Q 180 446 194 440",
  // Knee creases
  "M 84 558 Q 102 566 120 558",
  "M 120 558 Q 138 566 156 558",
  // Patella ovals (very small, subtle)
  "M 96 568 a 6 4 0 1 0 12 0 a 6 4 0 1 0 -12 0",
  "M 132 568 a 6 4 0 1 0 12 0 a 6 4 0 1 0 -12 0",
  // Ankle lines
  "M 84 690 Q 102 696 118 690",
  "M 122 690 Q 138 696 156 690",
];

export function FullBodyFemale({
  outlineStroke = DEFAULT_OUTLINE_STROKE,
  outlineWidth = DEFAULT_OUTLINE_WIDTH,
  articulationStroke = DEFAULT_ARTICULATION_STROKE,
  articulationWidth = DEFAULT_ARTICULATION_WIDTH,
}: SilhouetteStyleProps) {
  return (
    <g aria-hidden="true">
      <path
        d={OUTLINE}
        fill="none"
        stroke={outlineStroke}
        strokeWidth={outlineWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g
        fill="none"
        stroke={articulationStroke}
        strokeWidth={articulationWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.7}
        vectorEffect="non-scaling-stroke"
      >
        {ARTICULATIONS.map((d, index) => (
          <path key={`f-art-${index}`} d={d} />
        ))}
      </g>
    </g>
  );
}

export const FULL_BODY_FEMALE_OUTLINE = OUTLINE;
export const FULL_BODY_FEMALE_ARTICULATIONS = ARTICULATIONS;

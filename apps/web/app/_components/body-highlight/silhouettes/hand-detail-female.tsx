import {
  DEFAULT_ARTICULATION_STROKE,
  DEFAULT_ARTICULATION_WIDTH,
  DEFAULT_OUTLINE_STROKE,
  DEFAULT_OUTLINE_WIDTH,
  type SilhouetteStyleProps,
} from "./silhouette-shared";

// Female hand reference — viewBox 320×360. 2×2 grid:
//   row 1: palms (right, left), row 2: backs (right, left).
// Each hand silhouette is ~96 wide × 180 tall, centered in its quadrant.
// A single "generic right-hand" path is drawn at the origin then translated
// (and mirrored for left-hand cells) so the asset stays compact.

// Hand template, local origin = wrist center, fingers pointing up.
// Slim female proportions: thinner fingers, smaller palm, slimmer wrist.
const HAND_OUTLINE = [
  "M -22 8",
  "L -22 -16",
  "C -28 -40, -34 -64, -32 -92",
  "C -30 -110, -26 -124, -22 -136",
  "C -18 -148, -10 -150, -6 -140",
  "L -4 -132",
  "L -4 -150",
  "C -2 -160, 4 -160, 6 -150",
  "L 6 -134",
  "L 8 -148",
  "C 10 -156, 16 -156, 18 -148",
  "L 18 -130",
  "L 22 -140",
  "C 24 -150, 30 -150, 30 -138",
  "L 30 -120",
  "C 36 -114, 40 -100, 40 -80",
  "C 40 -56, 36 -34, 30 -16",
  "L 30 8",
  "Z",
].join(" ");

const HAND_DETAILS = [
  // Wrist line
  "M -22 -8 L 30 -8",
  // Palm lines (only used on palm view but harmless as light strokes)
  "M -16 -30 Q 6 -38 24 -36",
  "M -18 -50 Q 4 -58 24 -52",
  "M -14 -76 Q 8 -72 22 -68",
  // Finger creases (knuckle/PIP markers)
  "M -28 -80 L -22 -82",
  "M -10 -90 L -2 -92",
  "M 2 -94 L 10 -96",
  "M 14 -92 L 22 -94",
  // Finger tips suggestion
  "M -28 -118 L -22 -122",
  "M -8 -130 L -2 -134",
  "M 2 -132 L 10 -136",
  "M 14 -126 L 22 -130",
];

type CellLabel = {
  text: string;
  cx: number;
  cy: number;
};

const LABELS: ReadonlyArray<CellLabel> = [
  { text: "Palma D", cx: 80, cy: 348 },
  { text: "Palma I", cx: 240, cy: 348 },
];

const BACK_LABELS: ReadonlyArray<CellLabel> = [
  { text: "Dorso D", cx: 80, cy: 348 },
  { text: "Dorso I", cx: 240, cy: 348 },
];

type HandCellProps = {
  cx: number;
  cy: number;
  mirror: boolean;
  outlineStroke: string;
  outlineWidth: number;
  articulationStroke: string;
  articulationWidth: number;
};

function HandCell({
  cx,
  cy,
  mirror,
  outlineStroke,
  outlineWidth,
  articulationStroke,
  articulationWidth,
}: HandCellProps) {
  const scaleX = mirror ? -1 : 1;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scaleX} 1)`}>
      <path
        d={HAND_OUTLINE}
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
        strokeOpacity={0.6}
        vectorEffect="non-scaling-stroke"
      >
        {HAND_DETAILS.map((d, index) => (
          <path key={`hand-art-${index}`} d={d} />
        ))}
      </g>
    </g>
  );
}

export function HandDetailFemale({
  outlineStroke = DEFAULT_OUTLINE_STROKE,
  outlineWidth = DEFAULT_OUTLINE_WIDTH,
  articulationStroke = DEFAULT_ARTICULATION_STROKE,
  articulationWidth = DEFAULT_ARTICULATION_WIDTH,
}: SilhouetteStyleProps) {
  return (
    <g aria-hidden="true">
      {/* Top row — palms */}
      <HandCell
        cx={80}
        cy={170}
        mirror={false}
        outlineStroke={outlineStroke}
        outlineWidth={outlineWidth}
        articulationStroke={articulationStroke}
        articulationWidth={articulationWidth}
      />
      <HandCell
        cx={240}
        cy={170}
        mirror
        outlineStroke={outlineStroke}
        outlineWidth={outlineWidth}
        articulationStroke={articulationStroke}
        articulationWidth={articulationWidth}
      />
      {/* Bottom row — backs (same geometry, no palm-line emphasis) */}
      <HandCell
        cx={80}
        cy={330}
        mirror={false}
        outlineStroke={outlineStroke}
        outlineWidth={outlineWidth}
        articulationStroke={articulationStroke}
        articulationWidth={articulationWidth}
      />
      <HandCell
        cx={240}
        cy={330}
        mirror
        outlineStroke={outlineStroke}
        outlineWidth={outlineWidth}
        articulationStroke={articulationStroke}
        articulationWidth={articulationWidth}
      />
      <g
        fill="#475569"
        fontSize="11"
        fontFamily="Inter Tight, Inter, system-ui, sans-serif"
        fontWeight={600}
        textAnchor="middle"
      >
        {LABELS.map((label) => (
          <text key={`palm-${label.text}`} x={label.cx} y={170 + 24}>
            {label.text}
          </text>
        ))}
        {BACK_LABELS.map((label) => (
          <text key={`back-${label.text}`} x={label.cx} y={330 + 24}>
            {label.text}
          </text>
        ))}
      </g>
    </g>
  );
}

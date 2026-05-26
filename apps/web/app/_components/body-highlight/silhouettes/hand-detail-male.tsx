import {
  DEFAULT_ARTICULATION_STROKE,
  DEFAULT_ARTICULATION_WIDTH,
  DEFAULT_OUTLINE_STROKE,
  DEFAULT_OUTLINE_WIDTH,
  type SilhouetteStyleProps,
} from "./silhouette-shared";

// Male hand reference — viewBox 320×360. Same 2×2 layout as the female
// sheet (palms top, backs bottom) but broader palms, wider fingers, and
// a thicker wrist envelope.

const HAND_OUTLINE = [
  "M -26 10",
  "L -26 -16",
  "C -32 -42, -38 -68, -36 -94",
  "C -34 -114, -28 -128, -24 -140",
  "C -20 -152, -10 -152, -6 -142",
  "L -4 -132",
  "L -4 -154",
  "C -2 -164, 6 -164, 8 -154",
  "L 8 -132",
  "L 10 -150",
  "C 12 -160, 20 -160, 22 -150",
  "L 22 -130",
  "L 26 -142",
  "C 28 -152, 34 -152, 34 -140",
  "L 34 -120",
  "C 40 -114, 44 -98, 44 -78",
  "C 44 -52, 38 -28, 32 -16",
  "L 32 10",
  "Z",
].join(" ");

const HAND_DETAILS = [
  // Wrist line
  "M -26 -8 L 32 -8",
  // Palm lines (broader male palm)
  "M -18 -32 Q 8 -42 28 -38",
  "M -20 -54 Q 6 -62 28 -54",
  "M -16 -78 Q 10 -74 26 -68",
  // Knuckles
  "M -32 -82 L -24 -84",
  "M -10 -94 L -2 -96",
  "M 2 -96 L 12 -98",
  "M 16 -94 L 26 -96",
  // Finger tips
  "M -32 -120 L -24 -124",
  "M -8 -134 L -2 -138",
  "M 2 -136 L 12 -140",
  "M 16 -128 L 26 -132",
];

type CellLabel = { text: string; cx: number; cy: number };

const PALM_LABELS: ReadonlyArray<CellLabel> = [
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

export function HandDetailMale({
  outlineStroke = DEFAULT_OUTLINE_STROKE,
  outlineWidth = DEFAULT_OUTLINE_WIDTH,
  articulationStroke = DEFAULT_ARTICULATION_STROKE,
  articulationWidth = DEFAULT_ARTICULATION_WIDTH,
}: SilhouetteStyleProps) {
  return (
    <g aria-hidden="true">
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
        {PALM_LABELS.map((label) => (
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

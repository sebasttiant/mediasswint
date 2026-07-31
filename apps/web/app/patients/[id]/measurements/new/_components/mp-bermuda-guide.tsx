"use client";

import { Fragment } from "react";

import { buildMpBermudaTemplate, type MpBermudaTemplateField } from "@/lib/mp-bermuda-template";

const MP_BERMUDA_MARKER_SHAPE = {
  STATION: "station",
  DISTANCE: "distance",
  SHARED: "shared",
} as const;

type MpBermudaMarkerShape = (typeof MP_BERMUDA_MARKER_SHAPE)[keyof typeof MP_BERMUDA_MARKER_SHAPE];

type MpBermudaGuideField = Pick<MpBermudaTemplateField, "key" | "label"> & { metadata: unknown };

export type MpBermudaMarker = {
  key: string;
  markerId: string;
  label: string;
  side: "right" | "left" | "shared";
  shape: MpBermudaMarkerShape;
  stationId?: string;
  fromStationId?: string;
  toStationId?: string;
  x: number;
  y: number;
  y2?: number;
};

const STATION_Y = {
  waist: 38,
  hip: 53,
  groin: 70,
  belowGroin10: 85,
  midThigh: 103,
  knee: 127,
  belowKnee: 142,
  calfMax: 160,
  calfStart: 178,
  aboveAnkle: 197,
  heelAnkle: 212,
  toeRoot: 230,
  footDorsum: 242,
} as const;

type StationId = keyof typeof STATION_Y;

/**
 * Half-silhouette geometry, mirroring the paper form: for each station, where
 * the outline sits on the RIGHT leg (the viewer's left). `outer` is the away-
 * from-centre edge, `inner` the one facing the other leg. The left leg is this
 * table mirrored about `BODY_CENTRE_X`, so a band can never drift off the
 * outline — both are derived from the same numbers.
 *
 * Above the split (waist, hip) the body is a single shape, so `inner` reaches
 * the centre line and the two per-side bands meet into one continuous band, the
 * way "Cintura" and "Cadera" are drawn on the form.
 */
const BODY_CENTRE_X = 128;
const FLOOR_Y = 252;

const LEG_EDGES: Readonly<Record<StationId, { outer: number; inner: number }>> = {
  waist: { outer: 98, inner: BODY_CENTRE_X },
  hip: { outer: 92, inner: BODY_CENTRE_X },
  groin: { outer: 94, inner: 126 },
  belowGroin10: { outer: 96, inner: 125 },
  midThigh: { outer: 98, inner: 124 },
  knee: { outer: 102, inner: 123 },
  belowKnee: { outer: 104, inner: 122 },
  calfMax: { outer: 103, inner: 122 },
  calfStart: { outer: 106, inner: 121 },
  aboveAnkle: { outer: 109, inner: 120 },
  heelAnkle: { outer: 110, inner: 120 },
  toeRoot: { outer: 107, inner: 119 },
  footDorsum: { outer: 105, inner: 118 },
};

const STATION_LABELS: ReadonlyArray<{ id: StationId; lines: ReadonlyArray<string> }> = [
  { id: "waist", lines: ["Cintura"] },
  { id: "hip", lines: ["Cadera"] },
  { id: "groin", lines: ["Ingle"] },
  { id: "belowGroin10", lines: ["10 cm debajo", "de la Ingle"] },
  { id: "midThigh", lines: ["Mitad de muslo"] },
  { id: "knee", lines: ["Rodilla"] },
  { id: "belowKnee", lines: ["Debajo de rodilla"] },
  { id: "calfMax", lines: ["Pantorrilla", "(Parte más gruesa)"] },
  { id: "calfStart", lines: ["Inicio de pantorrilla"] },
  { id: "aboveAnkle", lines: ["Encima del tobillo"] },
  { id: "heelAnkle", lines: ["Talón y tobillo"] },
  { id: "toeRoot", lines: ["Raíz de los dedos"] },
  { id: "footDorsum", lines: ["Dorso del pie"] },
];

const ORDERED_STATIONS = Object.keys(STATION_Y) as StationId[];

const LABEL_LEADER_X = 196;
const LABEL_TEXT_X = 200;

// The two bracketed lengths run down the left margin, nested like the form's.
const BRACKET_X = { waistToGlutealFold: 78, glutealFoldToFloor: 64 } as const;
const GLUTEAL_FOLD_Y = STATION_Y.groin;

// Height, weight and shoe size are not places on the body; the form keeps them
// off the drawing, so they sit under the feet rather than floating over it.
const BODY_MARKER_X = { mpHeight: 96, mpWeight: 128, mpShoeSize: 160 } as const;
const BODY_MARKER_Y = 266;

function mirrored(x: number): number {
  return BODY_CENTRE_X * 2 - x;
}

function edgesFor(stationId: StationId, side: "right" | "left"): { outer: number; inner: number } {
  const edges = LEG_EDGES[stationId];
  return side === "right" ? edges : { outer: mirrored(edges.outer), inner: mirrored(edges.inner) };
}

/** Outline traced from `LEG_EDGES`: down one leg, around the foot, up the inside, across the crotch, and back. */
function buildSilhouettePath(): string {
  const downOuter = ORDERED_STATIONS.map((id) => `L ${LEG_EDGES[id].outer} ${STATION_Y[id]}`);
  const upInner = [...ORDERED_STATIONS].reverse().map((id) => `L ${LEG_EDGES[id].inner} ${STATION_Y[id]}`);
  const rightFoot = [
    `L ${LEG_EDGES.footDorsum.outer - 8} ${FLOOR_Y}`,
    `L ${LEG_EDGES.footDorsum.inner} ${FLOOR_Y}`,
  ];
  const leftFoot = [
    `L ${mirrored(LEG_EDGES.footDorsum.inner)} ${FLOOR_Y}`,
    `L ${mirrored(LEG_EDGES.footDorsum.outer - 8)} ${FLOOR_Y}`,
  ];
  const downInnerLeft = ORDERED_STATIONS.map((id) => `L ${mirrored(LEG_EDGES[id].inner)} ${STATION_Y[id]}`);
  const upOuterLeft = [...ORDERED_STATIONS].reverse().map((id) => `L ${mirrored(LEG_EDGES[id].outer)} ${STATION_Y[id]}`);

  return [
    `M ${LEG_EDGES.waist.outer} 28`,
    ...downOuter,
    ...rightFoot,
    ...upInner,
    `L ${BODY_CENTRE_X} ${STATION_Y.groin + 6}`,
    ...downInnerLeft,
    ...leftFoot,
    ...upOuterLeft,
    `L ${mirrored(LEG_EDGES.waist.outer)} 28`,
    "Z",
  ].join(" ");
}

const SILHOUETTE_PATH = buildSilhouettePath();
const CANONICAL_FIELDS = buildMpBermudaTemplate().sections.flatMap((section) => section.fields);

export type MpBermudaGuideProps = {
  fields?: ReadonlyArray<MpBermudaGuideField>;
  activeMarkerId?: string | null;
  filledMarkerIds?: ReadonlySet<string>;
  /** Pointer shortcut to a field, by FIELD KEY. Markers stay out of the tab order on purpose: the strip already gives all 55 fields a native keyboard stop, so focusable markers would only double the tab order. */
  onMarkerActivate?: (key: string) => void;
};

function isStationId(value: unknown): value is StationId {
  return typeof value === "string" && value in STATION_Y;
}

function isSide(value: unknown): value is MpBermudaMarker["side"] {
  return value === "right" || value === "left" || value === "shared";
}

type MpBermudaRuntimeMetadata = Record<string, unknown>;

function isMetadata(value: unknown): value is MpBermudaRuntimeMetadata {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function markerShape(metadata: MpBermudaRuntimeMetadata): MpBermudaMarkerShape | null {
  if (metadata.layout !== "mp-bermuda" || typeof metadata.markerId !== "string" || metadata.markerId.length === 0) return null;
  if (metadata.side === "shared") {
    return metadata.kind === "body" || metadata.kind === "length" ? MP_BERMUDA_MARKER_SHAPE.SHARED : null;
  }
  if (metadata.side !== "right" && metadata.side !== "left") return null;
  if (metadata.kind === "circumference") return MP_BERMUDA_MARKER_SHAPE.STATION;
  return metadata.kind === "distance" ? MP_BERMUDA_MARKER_SHAPE.DISTANCE : null;
}

function hasSharedLengthEndpoints(metadata: MpBermudaRuntimeMetadata): boolean {
  return (metadata.fromStationId === "waist" && metadata.toStationId === "glutealFold")
    || (metadata.fromStationId === "glutealFold" && metadata.toStationId === "floor");
}

export function resolveMpBermudaMarkers(fields: ReadonlyArray<MpBermudaGuideField>): MpBermudaMarker[] | null {
  const markers: MpBermudaMarker[] = [];

  for (const field of fields) {
    const { metadata } = field;
    if (!isMetadata(metadata)) return null;
    const shape = markerShape(metadata);
    if (!shape) return null;
    const markerId = metadata.markerId;
    const side = metadata.side;
    if (typeof markerId !== "string" || !isSide(side)) return null;

    if (shape === MP_BERMUDA_MARKER_SHAPE.STATION) {
      if (!isStationId(metadata.stationId) || side === "shared") return null;
      const edges = edgesFor(metadata.stationId, side);
      markers.push({
        key: field.key,
        markerId,
        label: field.label,
        side,
        shape,
        stationId: metadata.stationId,
        x: (edges.outer + edges.inner) / 2,
        y: STATION_Y[metadata.stationId],
      });
      continue;
    }

    if (shape === MP_BERMUDA_MARKER_SHAPE.DISTANCE) {
      if (!isStationId(metadata.fromStationId) || !isStationId(metadata.toStationId) || side === "shared") return null;
      // Distances sit on the inner face, between the two bands they span —
      // the form's intermediate boxes, where "from A to B" needs no reading.
      const from = edgesFor(metadata.fromStationId, side);
      const to = edgesFor(metadata.toStationId, side);
      markers.push({
        key: field.key,
        markerId,
        label: field.label,
        side,
        shape,
        fromStationId: metadata.fromStationId,
        toStationId: metadata.toStationId,
        x: (from.inner + to.inner) / 2,
        y: STATION_Y[metadata.fromStationId],
        y2: STATION_Y[metadata.toStationId],
      });
      continue;
    }

    if (metadata.kind === "length" && !hasSharedLengthEndpoints(metadata)) return null;

    const isLength = metadata.kind === "length";
    const isWaistLength = metadata.fromStationId === "waist";
    const bodyX = BODY_MARKER_X[field.key as keyof typeof BODY_MARKER_X] ?? BODY_CENTRE_X;

    markers.push({
      key: field.key,
      markerId,
      label: field.label,
      side: "shared",
      shape,
      fromStationId: typeof metadata.fromStationId === "string" ? metadata.fromStationId : undefined,
      toStationId: typeof metadata.toStationId === "string" ? metadata.toStationId : undefined,
      x: isLength ? (isWaistLength ? BRACKET_X.waistToGlutealFold : BRACKET_X.glutealFoldToFloor) : bodyX,
      y: isLength ? (isWaistLength ? STATION_Y.waist : GLUTEAL_FOLD_Y) : BODY_MARKER_Y,
      y2: isLength ? (isWaistLength ? GLUTEAL_FOLD_Y : FLOOR_Y) : undefined,
    });
  }

  return markers.length === 55 ? markers : null;
}

function markerDescription(marker: MpBermudaMarker): string {
  if (marker.shape === MP_BERMUDA_MARKER_SHAPE.DISTANCE) {
    return `${marker.label}; ${marker.fromStationId} a ${marker.toStationId}; ${marker.side}`;
  }
  return `${marker.label}; ${marker.side}`;
}

// State must read without colour: pending is a hairline, filled thickens, and
// active thickens further and goes dashed. Colour only reinforces it.
function strokeWidthFor(state: string): number {
  if (state === "active") return 3.4;
  return state === "filled" ? 2.6 : 1.4;
}

export function MpBermudaGuide({
  fields = CANONICAL_FIELDS,
  activeMarkerId = null,
  filledMarkerIds = new Set<string>(),
  onMarkerActivate,
}: MpBermudaGuideProps) {
  const markers = resolveMpBermudaMarkers(fields);
  if (!markers) return null;

  return (
    <svg
      role="img"
      aria-label="Guía bilateral de medidas para media pantalón y bermuda"
      viewBox="0 0 320 280"
      className="w-full text-slate-700"
      data-mp-bermuda-guide="true"
    >
      <title>Guía bilateral de medidas para media pantalón y bermuda</title>
      <desc>Marcadores clínicos independientes para pierna derecha, izquierda y medidas compartidas.</desc>

      <path d={SILHOUETTE_PATH} fill="#f8fafc" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />

      {/* Station names, on the right of the figure as on the printed form.
          Decoration is grouped with fragments, never <g>: every <g> in this
          drawing is a marker, and the layout contract counts on that. */}
      {STATION_LABELS.map(({ id, lines }) => {
        const y = STATION_Y[id];
        const outerLeft = mirrored(LEG_EDGES[id].outer);
        return (
          <Fragment key={id}>
            <line
              aria-hidden="true"
              x1={outerLeft + 3}
              x2={LABEL_LEADER_X}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeWidth="0.6"
              strokeDasharray="2 2"
              className="text-slate-400"
            />
            {lines.map((line, index) => (
              <text
                aria-hidden="true"
                key={line}
                x={LABEL_TEXT_X}
                y={y + 2.6 + index * 8 - (lines.length - 1) * 4}
                fontSize="7.6"
                fill="currentColor"
                className="text-slate-500"
              >
                {line}
              </text>
            ))}
          </Fragment>
        );
      })}

      {markers.map((marker) => {
        const isActive = marker.markerId === activeMarkerId;
        const isFilled = filledMarkerIds.has(marker.markerId);
        const state = isActive ? "active" : isFilled ? "filled" : "pending";
        const activate = onMarkerActivate ? () => onMarkerActivate(marker.key) : undefined;
        const width = strokeWidthFor(state);
        const common = {
          "data-mp-marker-id": marker.markerId,
          "data-mp-marker-side": marker.side,
          "data-mp-marker-state": state,
          "data-filled": isFilled ? "true" : undefined,
          "aria-current": isActive ? ("true" as const) : undefined,
          "aria-label": markerDescription(marker),
          // One activation path for pointer and keyboard, so the two can never drift.
          role: activate && "button",
          tabIndex: activate && 0,
          onClick: activate,
          onKeyDown: activate && ((event: { key: string; preventDefault: () => void }) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            if (event.key === " ") event.preventDefault(); // Space would scroll the page.
            activate();
          }),
          className: activate ? "cursor-pointer" : undefined,
        };

        if (marker.shape === MP_BERMUDA_MARKER_SHAPE.STATION && marker.stationId) {
          const edges = edgesFor(marker.stationId as StationId, marker.side === "left" ? "left" : "right");
          const from = Math.min(edges.outer, edges.inner);
          const to = Math.max(edges.outer, edges.inner);
          return (
            <g key={marker.key} {...common}>
              {/* Invisible hit area: a 1.4px hairline is not a pointer target. */}
              <rect x={from} y={marker.y - 5} width={to - from} height={10} fill="transparent" />
              <line x1={from} x2={to} y1={marker.y} y2={marker.y} stroke="currentColor" strokeWidth={width} strokeLinecap="round" />
            </g>
          );
        }

        if (marker.shape === MP_BERMUDA_MARKER_SHAPE.DISTANCE) {
          const y2 = marker.y2 ?? marker.y;
          return (
            <g key={marker.key} {...common}>
              <rect x={marker.x - 5} y={Math.min(marker.y, y2)} width={10} height={Math.abs(y2 - marker.y)} fill="transparent" />
              <line
                x1={marker.x}
                x2={marker.x}
                y1={marker.y}
                y2={y2}
                stroke="currentColor"
                strokeWidth={width}
                strokeDasharray={state === "active" ? "3 2" : undefined}
              />
              <path
                d={`M ${marker.x - 3} ${marker.y} L ${marker.x + 3} ${marker.y} M ${marker.x - 3} ${y2} L ${marker.x + 3} ${y2}`}
                stroke="currentColor"
                strokeWidth={width * 0.7}
              />
            </g>
          );
        }

        // Shared: the two bracketed lengths down the margin, and the three
        // whole-body figures parked under the feet.
        if (marker.y2 !== undefined) {
          return (
            <g key={marker.key} {...common}>
              <rect x={marker.x - 6} y={marker.y} width={12} height={marker.y2 - marker.y} fill="transparent" />
              <path
                d={`M ${marker.x + 5} ${marker.y} L ${marker.x} ${marker.y} L ${marker.x} ${marker.y2} L ${marker.x + 5} ${marker.y2}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={width}
                strokeDasharray={state === "active" ? "4 2" : undefined}
              />
            </g>
          );
        }

        return (
          <g key={marker.key} {...common}>
            <rect x={marker.x - 16} y={marker.y - 9} width={32} height={18} rx="4" fill="transparent" />
            <rect
              x={marker.x - 16}
              y={marker.y - 9}
              width={32}
              height={18}
              rx="4"
              fill="none"
              stroke="currentColor"
              strokeWidth={width}
              strokeDasharray={state === "active" ? "4 2" : undefined}
            />
          </g>
        );
      })}

      {/* Names for the three whole-body figures, which have no place on the body. */}
      {[
        { x: BODY_MARKER_X.mpHeight, label: "Estatura" },
        { x: BODY_MARKER_X.mpWeight, label: "Peso" },
        { x: BODY_MARKER_X.mpShoeSize, label: "Talla calzado" },
      ].map(({ x, label }) => (
        <text
          aria-hidden="true"
          key={label}
          x={x}
          y={BODY_MARKER_Y + 19}
          fontSize="7.2"
          fill="currentColor"
          textAnchor="middle"
          className="text-slate-500"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

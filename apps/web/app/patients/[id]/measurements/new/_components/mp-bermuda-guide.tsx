"use client";

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

export type MpBermudaGuideProps = {
  fields?: ReadonlyArray<MpBermudaGuideField>;
  activeMarkerId?: string | null;
  filledMarkerIds?: ReadonlySet<string>;
  /** Pointer shortcut to a field, by FIELD KEY. Markers stay out of the tab order on purpose: the strip already gives all 55 fields a native keyboard stop, so focusable markers would only double the tab order. */
  onMarkerActivate?: (key: string) => void;
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

const SIDE_X = { right: 82, left: 238, shared: 160 } as const;
const CANONICAL_FIELDS = buildMpBermudaTemplate().sections.flatMap((section) => section.fields);

function isStationId(value: unknown): value is keyof typeof STATION_Y {
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
      if (!isStationId(metadata.stationId)) return null;
      markers.push({
        key: field.key,
        markerId,
        label: field.label,
        side,
        shape,
        stationId: metadata.stationId,
        x: SIDE_X[side],
        y: STATION_Y[metadata.stationId],
      });
      continue;
    }

    if (shape === MP_BERMUDA_MARKER_SHAPE.DISTANCE) {
      if (!isStationId(metadata.fromStationId) || !isStationId(metadata.toStationId)) return null;
      markers.push({
        key: field.key,
        markerId,
        label: field.label,
        side,
        shape,
        fromStationId: metadata.fromStationId,
        toStationId: metadata.toStationId,
        x: SIDE_X[side],
        y: STATION_Y[metadata.fromStationId],
        y2: STATION_Y[metadata.toStationId],
      });
      continue;
    }

    if (metadata.kind === "length" && !hasSharedLengthEndpoints(metadata)) return null;

    markers.push({
      key: field.key,
      markerId,
      label: field.label,
      side: "shared",
      shape,
      fromStationId: typeof metadata.fromStationId === "string" ? metadata.fromStationId : undefined,
      toStationId: typeof metadata.toStationId === "string" ? metadata.toStationId : undefined,
      x: SIDE_X.shared,
      y: metadata.kind === "length" ? 60 : 18,
      y2: metadata.kind === "length" ? 242 : undefined,
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
      viewBox="0 0 320 260"
      data-mp-bermuda-guide="true"
    >
      <title>Guía bilateral de medidas para media pantalón y bermuda</title>
      <desc>Marcadores clínicos independientes para pierna derecha, izquierda y medidas compartidas.</desc>
      <path d="M 64 30 C 48 78 58 182 66 232 L 96 248 L 110 238 L 100 30 Z" fill="none" stroke="currentColor" />
      <path d="M 220 30 C 210 78 220 182 210 238 L 224 248 L 254 232 C 262 182 272 78 256 30 Z" fill="none" stroke="currentColor" />
      {markers.map((marker) => {
        const isActive = marker.markerId === activeMarkerId;
        const isFilled = filledMarkerIds.has(marker.markerId);
        const state = isActive ? "active" : isFilled ? "filled" : "pending";
        const activate = onMarkerActivate ? () => onMarkerActivate(marker.key) : undefined;
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
          className: activate && "cursor-pointer",
        };

        return (
          <g key={marker.key} {...common}>
            {marker.shape === MP_BERMUDA_MARKER_SHAPE.STATION ? (
              <><line x1={marker.x - 22} x2={marker.x + 22} y1={marker.y} y2={marker.y} stroke="currentColor" /><circle cx={marker.x} cy={marker.y} r="3" fill="currentColor" /></>
            ) : (
              <><line x1={marker.x} x2={marker.x} y1={marker.y} y2={marker.y2} stroke="currentColor" strokeDasharray={state === "active" ? "3 2" : undefined} /><path d={`M ${marker.x - 4} ${marker.y} L ${marker.x + 4} ${marker.y} M ${marker.x - 4} ${marker.y2 ?? marker.y} L ${marker.x + 4} ${marker.y2 ?? marker.y}`} stroke="currentColor" /></>
            )}
          </g>
        );
      })}
    </svg>
  );
}

import type { AnatomyZoneId } from "@/lib/compression-measurements";
import type { TemplateSnapshot, TemplateSnapshotField } from "@/lib/measurements";

export type MeasurementUiGroup = "legs" | "arms";
export type MeasurementUiSide = "right" | "left";

export type MeasurementUiField = {
  key: string;
  label: string;
  unit: string;
  minValue: number;
  maxValue: number;
  metadata: Record<string, unknown>;
  value: number | null;
};

export type MeasurementTableRow = {
  point: number;
  right: MeasurementUiField | null;
  left: MeasurementUiField | null;
};

type MeasurementValue = string | number | null | undefined;

function getStringMetadata(field: TemplateSnapshotField | MeasurementUiField, key: string): string | null {
  const value = field.metadata[key];
  return typeof value === "string" ? value : null;
}

function getNumberMetadata(field: TemplateSnapshotField, key: string): number | null {
  const value = field.metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toUiField(field: TemplateSnapshotField, valuesByKey: Record<string, number | null>): MeasurementUiField {
  return {
    key: field.key,
    label: field.label,
    unit: field.unit,
    minValue: field.minValue,
    maxValue: field.maxValue,
    metadata: field.metadata,
    value: valuesByKey[field.key] ?? null,
  };
}

function isFilledMeasurementValue(value: MeasurementValue): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return false;
}

export function getActiveZoneIdForField(field: MeasurementUiField | null): AnatomyZoneId | null {
  if (!field) return null;
  const anatomyZone = getStringMetadata(field, "anatomyZone");
  return anatomyZone as AnatomyZoneId | null;
}

export function getActiveZoneLabel(field: MeasurementUiField | null): string | null {
  if (!field) return null;
  const anatomyZone = getActiveZoneIdForField(field);
  if (!anatomyZone) return field.label;
  const group = getStringMetadata(field, "group");
  const side = getStringMetadata(field, "side");
  const point = field.metadata.point;
  if (!group || !side || typeof point !== "number") return field.label;
  const sideLabel = side === "right" ? "Derecho/a" : "Izquierdo/a";
  const groupLabel = group === "legs" ? "Pierna" : "Brazo";
  return `${groupLabel} ${sideLabel} · Punto ${point}`;
}

export function getFilledZoneIdsFromValues(
  snapshot: TemplateSnapshot,
  valuesByKey: Record<string, MeasurementValue>,
): ReadonlySet<AnatomyZoneId> {
  const zoneIds = new Set<AnatomyZoneId>();

  for (const section of snapshot.sections) {
    for (const field of section.fields) {
      if (!isFilledMeasurementValue(valuesByKey[field.key])) continue;

      const anatomyZone = getStringMetadata(field, "anatomyZone");
      if (anatomyZone) zoneIds.add(anatomyZone as AnatomyZoneId);
    }
  }

  return zoneIds;
}

export function buildMeasurementTableRows(
  snapshot: TemplateSnapshot,
  group: MeasurementUiGroup,
  valuesByKey: Record<string, number | null>,
): MeasurementTableRow[] {
  const rows = new Map<number, MeasurementTableRow>();

  for (const section of snapshot.sections) {
    for (const field of section.fields) {
      if (getStringMetadata(field, "group") !== group) continue;

      const point = getNumberMetadata(field, "point");
      const side = getStringMetadata(field, "side");
      if (!point || (side !== "right" && side !== "left")) continue;

      const row = rows.get(point) ?? { point, right: null, left: null };
      row[side] = toUiField(field, valuesByKey);
      rows.set(point, row);
    }
  }

  return [...rows.values()].sort((a, b) => a.point - b.point);
}

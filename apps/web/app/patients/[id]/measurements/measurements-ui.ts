import type { AnatomyZoneId } from "@/lib/compression-measurements";
import {
  classifyHeadSnapshot,
  getHeadSnapshotCompletionBlock,
  parseHeadZoneKey,
  type HeadViewComposition,
} from "@/lib/head-measurement-layout";
import { MASCARA_TEMPLATE_CODE } from "@/lib/mascara-template";
import { MENTONERA_TEMPLATE_CODE } from "@/lib/mentonera-template";
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

// The standalone FaceGuide is an explicit template opt-in. Dedicated head
// measurement figures contain ordinary face/head words but must not render a
// second, unrelated guide because of their copy or anatomy-zone identifiers.
const REQUIRES_FACE_GUIDE_METADATA_KEY = "requiresFaceGuide";

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

function fieldRequiresFaceGuide(field: TemplateSnapshotField): boolean {
  return field.metadata[REQUIRES_FACE_GUIDE_METADATA_KEY] === true;
}

export function measurementSnapshotRequiresFaceGuide(snapshot: TemplateSnapshot): boolean {
  return snapshot.sections.some((section) => section.fields.some(fieldRequiresFaceGuide));
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

// ---------------------------------------------------------------------------
// Mentonera pilot (PR-B). Mentonera fields carry {anatomyZone, kind} — no
// {group, side, point} — so they are NOT reachable through
// buildMeasurementTableRows (which requires group+side+point) and need this
// sibling projection instead. Filtering on the "head." anatomyZone prefix
// keeps this generic to any future head.* template, not just mentonera-v1.
// ---------------------------------------------------------------------------

export function buildHeadMeasurementFields(snapshot: TemplateSnapshot): MeasurementUiField[] {
  const entries: Array<{ sortOrder: number; field: MeasurementUiField }> = [];

  for (const section of snapshot.sections) {
    for (const field of section.fields) {
      const anatomyZone = getStringMetadata(field, "anatomyZone");
      if (!anatomyZone || !anatomyZone.startsWith("head.")) continue;

      entries.push({ sortOrder: field.sortOrder, field: toUiField(field, {}) });
    }
  }

  return entries.sort((a, b) => a.sortOrder - b.sortOrder).map((entry) => entry.field);
}

// ---------------------------------------------------------------------------
// Head layout resolution.
//
// The first version of this guard was all-or-nothing: a head snapshot that did
// not match its expected field list EXACTLY fell through to the generic
// compression layout. That was wrong, and worse than it looked — head fields
// carry {anatomyZone, kind} and no {group, side, point}, so the compression
// layout cannot project them at all. A head session that was merely PARTIAL
// (one field dropped, or one extra field left behind by a template edit)
// rendered a form with ZERO inputs, and the footer would still happily
// finalize it.
//
// Resolution is now graded:
//   complete  -> snapshot matches the composition exactly; full figure.
//   degraded  -> it is a head template with at least one usable head field,
//                but not the expected set. Render the surviving fields and
//                the markers that match them, warn, and block finalize.
//   empty     -> head template, zero usable head fields. Render an explicit
//                empty state; never a silent blank form, never finalizable.
//   none      -> not a head template; the generic layout owns it.
// ---------------------------------------------------------------------------

export type HeadLayoutResolution =
  | { kind: "none" }
  | {
      kind: "complete" | "degraded" | "empty";
      composition: HeadViewComposition;
      fields: MeasurementUiField[];
      /** `${zoneId}.${panel}` keys to paint — narrowed to surviving fields when degraded. */
      zoneKeys: ReadonlyArray<string>;
      /** Operator-facing explanation. Null when complete. */
      warning: string | null;
      /** True when the session must not be completed from this layout. */
      blocksCompletion: boolean;
    };

/**
 * Narrow a composition's zone keys to those whose zone is actually present in
 * the surviving fields, so a degraded layout never paints a measurement line
 * that has no input behind it.
 */
function zoneKeysForFields(
  composition: HeadViewComposition,
  fields: ReadonlyArray<MeasurementUiField>,
): ReadonlyArray<string> {
  const presentZoneIds = new Set(
    fields
      .map((field) => field.metadata.anatomyZone)
      .filter((zone): zone is string => typeof zone === "string"),
  );

  return composition.zoneKeys.filter((zoneKey) => {
    const parsed = parseHeadZoneKey(zoneKey);
    return parsed !== null && presentZoneIds.has(parsed.zoneId);
  });
}

/**
 * UI projection of the DOMAIN classification. The complete/degraded/empty rules
 * and the operator-facing reason text both come from `classifyHeadSnapshot` in
 * lib/head-measurement-layout.ts — the same function the measurement service
 * uses to refuse completion on the server. This layer only adds what the domain
 * has no business knowing: the editable field objects and which markers to
 * paint.
 */
export function resolveHeadMeasurementLayout(snapshot: TemplateSnapshot): HeadLayoutResolution {
  const classification = classifyHeadSnapshot(snapshot);
  if (classification.kind === "none") return { kind: "none" };

  const { composition, blockReason } = classification;
  const fields = buildHeadMeasurementFields(snapshot);

  if (classification.kind === "empty") {
    return {
      kind: "empty",
      composition,
      fields: [],
      zoneKeys: [],
      warning: blockReason,
      blocksCompletion: true,
    };
  }

  if (classification.kind === "complete") {
    return {
      kind: "complete",
      composition,
      fields,
      zoneKeys: composition.zoneKeys,
      warning: null,
      blocksCompletion: false,
    };
  }

  return {
    kind: "degraded",
    composition,
    fields,
    zoneKeys: zoneKeysForFields(composition, fields),
    warning: blockReason,
    blocksCompletion: true,
  };
}

/** True when the snapshot renders through the head layout in any state. */
export function usesHeadMeasurementLayout(snapshot: TemplateSnapshot): boolean {
  return classifyHeadSnapshot(snapshot).kind !== "none";
}

/**
 * Reason the session must not be completed, or null when it may be.
 * Delegates to the same domain guard the server enforces, so the disabled
 * finalize button and the API's refusal can never disagree.
 */
export function getHeadLayoutCompletionBlock(snapshot: TemplateSnapshot): string | null {
  return getHeadSnapshotCompletionBlock(snapshot);
}

// Retained as the narrow "is this the fully-valid layout" predicate.
export function shouldRenderMentoneraLayout(snapshot: TemplateSnapshot): boolean {
  const resolution = resolveHeadMeasurementLayout(snapshot);
  return (
    resolution.kind === "complete" &&
    resolution.composition.templateCode === MENTONERA_TEMPLATE_CODE
  );
}

export function shouldRenderMascaraLayout(snapshot: TemplateSnapshot): boolean {
  const resolution = resolveHeadMeasurementLayout(snapshot);
  return (
    resolution.kind === "complete" && resolution.composition.templateCode === MASCARA_TEMPLATE_CODE
  );
}

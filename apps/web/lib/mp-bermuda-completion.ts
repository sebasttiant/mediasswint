import { buildMpBermudaTemplate, MP_BERMUDA_TEMPLATE_CODE } from "./mp-bermuda-template";
import type { TemplateSnapshot, TemplateSnapshotField } from "./measurements";

export type MpCompletionError = { field: string; message: string };

export type MpCompletionValidation =
  | { ok: true }
  | { ok: false; errors: MpCompletionError[] };

const canonicalFields = buildMpBermudaTemplate().sections.flatMap((section) => section.fields);

function sameClinicalMetadata(
  field: TemplateSnapshotField,
  canonical: (typeof canonicalFields)[number],
): boolean {
  const keys = ["kind", "side", "stationId", "fromStationId", "toStationId"] as const;
  return (
    field.isRequired === true &&
    keys.every((key) => field.metadata[key] === canonical.metadata[key])
  );
}

export function classifyMpCompletionSnapshot(snapshot: TemplateSnapshot): MpCompletionValidation {
  if (snapshot.code !== MP_BERMUDA_TEMPLATE_CODE) {
    return { ok: false, errors: [{ field: "templateSnapshot.code", message: "MP/Bermuda template is required" }] };
  }

  const fields = snapshot.sections.flatMap((section) => section.fields);
  const byKey = new Map<string, TemplateSnapshotField[]>();
  for (const field of fields) byKey.set(field.key, [...(byKey.get(field.key) ?? []), field]);

  const errors: MpCompletionError[] = [];
  for (const canonical of canonicalFields) {
    const matches = byKey.get(canonical.key) ?? [];
    if (matches.length === 0) {
      errors.push({ field: `templateSnapshot.fields.${canonical.key}`, message: "required MP/Bermuda field is missing" });
    } else if (matches.length > 1) {
      errors.push({ field: `templateSnapshot.fields.${canonical.key}`, message: "MP/Bermuda field is duplicated" });
    } else if (!sameClinicalMetadata(matches[0], canonical)) {
      errors.push({ field: `templateSnapshot.fields.${canonical.key}`, message: "MP/Bermuda field ownership metadata is invalid" });
    }
  }
  for (const field of fields) {
    if (!canonicalFields.some((canonical) => canonical.key === field.key)) {
      errors.push({ field: `templateSnapshot.fields.${field.key}`, message: "unexpected MP/Bermuda field" });
    }
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function mergeAndValidateMpCompletionValues(
  persisted: Record<string, number | null>,
  submitted: Record<string, number | null>,
): MpCompletionValidation {
  const merged = { ...persisted, ...submitted };
  const errors = canonicalFields.flatMap((field) => {
    const value = merged[field.key];
    return typeof value === "number" && Number.isFinite(value) && value >= field.minValue && value <= field.maxValue
      ? []
      : [{ field: `valuesByKey.${field.key}`, message: "a finite value is required" }];
  });
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

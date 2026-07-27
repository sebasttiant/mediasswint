import type {
  TemplateSnapshot,
  TemplateSnapshotField,
  TemplateSnapshotSection,
} from "./measurements";

/**
 * Runtime validation for the `MeasurementSession.templateSnapshot` JSON column.
 *
 * The column is `Json?`, so TypeScript knows nothing about what is actually in
 * it. Casting it to `TemplateSnapshot` is a lie the compiler cannot catch, and
 * the database really does hold rows that do not match: the demo seeder wrote
 * `{ templateCode, templateName, version, marker }` with no `sections` key at
 * all. Every consumer that iterated `snapshot.sections` threw a TypeError on
 * those rows.
 *
 * This parser is the single boundary where persisted JSON becomes a typed
 * snapshot. It returns `null` for anything it cannot vouch for, so callers must
 * decide explicitly what a missing snapshot means instead of crashing.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseField(value: unknown): TemplateSnapshotField | null {
  if (!isRecord(value)) return null;

  const id = asNonEmptyString(value.id);
  const key = asNonEmptyString(value.key);
  const label = asNonEmptyString(value.label);
  const unit = asNonEmptyString(value.unit);
  const minValue = asFiniteNumber(value.minValue);
  const maxValue = asFiniteNumber(value.maxValue);
  const sortOrder = asFiniteNumber(value.sortOrder);

  if (id === null || key === null || label === null || unit === null) return null;
  if (minValue === null || maxValue === null || sortOrder === null) return null;

  return {
    id,
    key,
    label,
    // The column has only ever held NUMBER fields; anything else is not a
    // snapshot this application can render or validate values against.
    fieldType: "NUMBER",
    unit,
    isRequired: value.isRequired === true,
    sortOrder,
    minValue,
    maxValue,
    // Metadata is optional by design: historical rows predate several keys.
    metadata: isRecord(value.metadata) ? value.metadata : {},
  };
}

function parseSection(value: unknown): TemplateSnapshotSection | null {
  if (!isRecord(value)) return null;

  const title = asNonEmptyString(value.title);
  const sortOrder = asFiniteNumber(value.sortOrder);
  if (title === null || sortOrder === null) return null;
  if (!Array.isArray(value.fields)) return null;

  const fields: TemplateSnapshotField[] = [];
  for (const rawField of value.fields) {
    const field = parseField(rawField);
    // One malformed field invalidates the whole snapshot rather than silently
    // shrinking it: a partially parsed snapshot would look "complete" to the
    // head-garment classifier and to range validation, which is worse than an
    // explicit refusal.
    if (!field) return null;
    fields.push(field);
  }

  return { title, sortOrder, fields };
}

export function parseTemplateSnapshot(value: unknown): TemplateSnapshot | null {
  if (!isRecord(value)) return null;

  const templateId = asNonEmptyString(value.templateId);
  const code = asNonEmptyString(value.code);
  const name = asNonEmptyString(value.name);
  const version = asFiniteNumber(value.version);

  if (templateId === null || code === null || name === null || version === null) return null;
  if (!Array.isArray(value.sections)) return null;

  const sections: TemplateSnapshotSection[] = [];
  for (const rawSection of value.sections) {
    const section = parseSection(rawSection);
    if (!section) return null;
    sections.push(section);
  }

  return {
    templateId,
    code,
    name,
    version,
    description: typeof value.description === "string" ? value.description : null,
    sections,
  };
}

/**
 * True when the persisted JSON is a snapshot this application can work with.
 * Useful at read boundaries that only need the yes/no answer.
 */
export function isValidTemplateSnapshot(value: unknown): boolean {
  return parseTemplateSnapshot(value) !== null;
}

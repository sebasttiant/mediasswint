import {
  COMPRESSION_MEASUREMENTS,
  type CompressionMeasurementKey,
} from "./compression-measurements";

type ValidationError = {
  field: string;
  message: string;
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };

export type ProductFlags = Record<string, boolean>;

export type CreateMeasurementInput = {
  measuredAt: Date;
  notes: string | null;
  garmentType: string | null;
  compressionClass: string | null;
  diagnosis: string | null;
  productFlags: ProductFlags | null;
};

export type UpdateMeasurementValuesInput = {
  valuesByKey: Partial<Record<CompressionMeasurementKey, number | null>>;
  complete: boolean;
};

export type ListMeasurementsQuery = {
  limit: number;
};

const MAX_NOTES_LENGTH = 1000;
const MAX_SHORT_TEXT_LENGTH = 100;
const MAX_DIAGNOSIS_LENGTH = 500;
const MAX_PRODUCT_FLAG_KEY_LENGTH = 80;
const MAX_PRODUCT_FLAG_KEYS = 64;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const ISO_INSTANT_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const KNOWN_KEYS = new Set<string>(COMPRESSION_MEASUREMENTS.map((m) => m.key));
const KEY_RANGES = new Map(
  COMPRESSION_MEASUREMENTS.map((m) => [m.key, { min: m.min, max: m.max }] as const),
);

function parseStrictIsoInstant(value: unknown, errors: ValidationError[]): Date | null {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push({ field: "measuredAt", message: "is required" });
    return null;
  }

  const match = ISO_INSTANT_REGEX.exec(value);
  if (!match) {
    errors.push({ field: "measuredAt", message: "must be an ISO 8601 instant (YYYY-MM-DDTHH:mm:ssZ)" });
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors.push({ field: "measuredAt", message: "is not a valid date" });
    return null;
  }

  const expectedIso = parsed.toISOString();
  const expectedYmd = expectedIso.slice(0, 10);
  const inputYmd = `${match[1]}-${match[2]}-${match[3]}`;
  if (expectedYmd !== inputYmd && match[7] === "Z") {
    errors.push({ field: "measuredAt", message: "is not a valid calendar date" });
    return null;
  }

  if (parsed.getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
    errors.push({ field: "measuredAt", message: "cannot be more than 5 minutes in the future" });
    return null;
  }

  return parsed;
}

function parseNullableText(
  value: unknown,
  field: string,
  maxLength: number,
  errors: ValidationError[],
): string | null {
  if (value === undefined || value === null) return null;

  if (typeof value !== "string") {
    errors.push({ field, message: "must be a string" });
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.length > maxLength) {
    errors.push({ field, message: `must be at most ${maxLength} characters` });
    return null;
  }

  return trimmed;
}

function parseProductFlags(value: unknown, errors: ValidationError[]): ProductFlags | null {
  if (value === undefined || value === null) return null;

  if (typeof value !== "object" || Array.isArray(value)) {
    errors.push({ field: "productFlags", message: "must be an object" });
    return null;
  }

  const source = value as Record<string, unknown>;
  const entries = Object.entries(source);
  if (entries.length > MAX_PRODUCT_FLAG_KEYS) {
    errors.push({ field: "productFlags", message: `must have at most ${MAX_PRODUCT_FLAG_KEYS} keys` });
    return null;
  }

  const result: ProductFlags = {};
  for (const [key, raw] of entries) {
    if (key.length === 0 || key.length > MAX_PRODUCT_FLAG_KEY_LENGTH) {
      errors.push({ field: `productFlags.${key}`, message: "key length out of range" });
      return null;
    }
    if (typeof raw !== "boolean") {
      errors.push({ field: `productFlags.${key}`, message: "must be a boolean" });
      return null;
    }
    result[key] = raw;
  }
  return result;
}

export function parseCreateMeasurementInput(body: unknown): ValidationResult<CreateMeasurementInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: "body", message: "must be a JSON object" }] };
  }

  const source = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  const measuredAt = parseStrictIsoInstant(source.measuredAt, errors);
  const notes = parseNullableText(source.notes, "notes", MAX_NOTES_LENGTH, errors);
  const garmentType = parseNullableText(source.garmentType, "garmentType", MAX_SHORT_TEXT_LENGTH, errors);
  const compressionClass = parseNullableText(source.compressionClass, "compressionClass", MAX_SHORT_TEXT_LENGTH, errors);
  const diagnosis = parseNullableText(source.diagnosis, "diagnosis", MAX_DIAGNOSIS_LENGTH, errors);
  const productFlags = parseProductFlags(source.productFlags, errors);

  if (errors.length > 0 || !measuredAt) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      measuredAt,
      notes,
      garmentType,
      compressionClass,
      diagnosis,
      productFlags,
    },
  };
}

export function parseUpdateMeasurementValuesInput(
  body: unknown,
): ValidationResult<UpdateMeasurementValuesInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: "body", message: "must be a JSON object" }] };
  }

  const source = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  const rawValues = source.valuesByKey;
  if (rawValues === undefined || rawValues === null) {
    errors.push({ field: "valuesByKey", message: "is required" });
  } else if (typeof rawValues !== "object" || Array.isArray(rawValues)) {
    errors.push({ field: "valuesByKey", message: "must be an object" });
  }

  const complete = source.complete;
  if (complete !== undefined && typeof complete !== "boolean") {
    errors.push({ field: "complete", message: "must be a boolean" });
  }

  const result: Partial<Record<CompressionMeasurementKey, number | null>> = {};

  if (rawValues && typeof rawValues === "object" && !Array.isArray(rawValues)) {
    for (const [key, raw] of Object.entries(rawValues as Record<string, unknown>)) {
      if (!KNOWN_KEYS.has(key)) {
        errors.push({ field: `valuesByKey.${key}`, message: "unknown measurement key" });
        continue;
      }
      if (raw === null) {
        result[key as CompressionMeasurementKey] = null;
        continue;
      }
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        errors.push({ field: `valuesByKey.${key}`, message: "must be a finite number or null" });
        continue;
      }
      const range = KEY_RANGES.get(key as CompressionMeasurementKey);
      if (range && (raw < range.min || raw > range.max)) {
        errors.push({
          field: `valuesByKey.${key}`,
          message: `must be between ${range.min} and ${range.max}`,
        });
        continue;
      }
      result[key as CompressionMeasurementKey] = raw;
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      valuesByKey: result,
      complete: complete === true,
    },
  };
}

export function parseListMeasurementsQuery(
  searchParams: URLSearchParams,
): ValidationResult<ListMeasurementsQuery> {
  const rawLimit = searchParams.get("limit");

  if (rawLimit === null || rawLimit.trim() === "") {
    return { ok: true, value: { limit: DEFAULT_LIMIT } };
  }

  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed)) {
    return { ok: false, errors: [{ field: "limit", message: "must be an integer" }] };
  }

  if (parsed < 1 || parsed > MAX_LIMIT) {
    return {
      ok: false,
      errors: [{ field: "limit", message: `must be between 1 and ${MAX_LIMIT}` }],
    };
  }

  return { ok: true, value: { limit: parsed } };
}

export type { ValidationError, ValidationResult };

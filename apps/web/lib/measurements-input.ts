import {
  COMPRESSION_MEASUREMENTS,
  type CompressionMeasurementKey,
} from "./compression-measurements";

type ValidationError = {
  field: string;
  message: string;
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };

export type CompressionMeasurementsInput = Record<CompressionMeasurementKey, number | null>;

export type CreateMeasurementInput = {
  measuredAt: Date;
  notes: string | null;
  garmentType: string | null;
  compressionClass: string | null;
  measurements: CompressionMeasurementsInput;
};

export type ListMeasurementsQuery = {
  limit: number;
};

const MAX_NOTES_LENGTH = 1000;
const MAX_SHORT_TEXT_LENGTH = 100;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const ISO_INSTANT_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const MEASUREMENT_KEYS = COMPRESSION_MEASUREMENTS.map((measurement) => measurement.key);
const MEASUREMENT_RANGES = new Map(
  COMPRESSION_MEASUREMENTS.map((measurement) => [measurement.key, { min: measurement.min, max: measurement.max }]),
);

function createEmptyMeasurements(): CompressionMeasurementsInput {
  return Object.fromEntries(MEASUREMENT_KEYS.map((key) => [key, null])) as CompressionMeasurementsInput;
}

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

function parseMeasurementNumber(
  raw: unknown,
  key: CompressionMeasurementKey,
  errors: ValidationError[],
): number | null {
  if (raw === undefined || raw === null) return null;

  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    errors.push({ field: `measurements.${key}`, message: "must be a finite number" });
    return null;
  }

  const range = MEASUREMENT_RANGES.get(key);
  if (range && (raw < range.min || raw > range.max)) {
    errors.push({
      field: `measurements.${key}`,
      message: `must be between ${range.min} and ${range.max}`,
    });
    return null;
  }

  return raw;
}

function parseMeasurements(value: unknown, errors: ValidationError[]): CompressionMeasurementsInput {
  const empty = createEmptyMeasurements();

  if (value === undefined || value === null) return empty;

  if (typeof value !== "object" || Array.isArray(value)) {
    errors.push({ field: "measurements", message: "must be an object" });
    return empty;
  }

  const source = value as Record<string, unknown>;
  const result = { ...empty };

  for (const key of MEASUREMENT_KEYS) {
    result[key] = parseMeasurementNumber(source[key], key, errors);
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
  const measurements = parseMeasurements(source.measurements, errors);

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
      measurements,
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

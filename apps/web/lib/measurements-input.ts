import { z } from "zod";

import {
  COMPRESSION_MEASUREMENTS,
  type CompressionMeasurementKey,
} from "./compression-measurements";
import { parseWithZod, type ValidationError, type ValidationResult } from "./zod-validation";

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
const ISO_INSTANT_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const KNOWN_KEYS = new Set<string>(COMPRESSION_MEASUREMENTS.map((m) => m.key));
const KEY_RANGES = new Map(
  COMPRESSION_MEASUREMENTS.map((m) => [m.key, { min: m.min, max: m.max }] as const),
);

function nullableText(maxLength: number) {
  return z.preprocess(
    (v) => {
      if (v === undefined || v === null) return null;
      if (typeof v === "string") {
        const trimmed = v.trim();
        return trimmed.length === 0 ? null : trimmed;
      }
      return v;
    },
    z.string().max(maxLength, { error: `must be at most ${maxLength} characters` }).nullable(),
  );
}

const MeasuredAtSchema = z
  .string()
  .refine((v) => v.trim() !== "", { error: "is required" })
  .refine((v) => ISO_INSTANT_REGEX.test(v), {
    error: "must be an ISO 8601 instant (YYYY-MM-DDTHH:mm:ssZ)",
  })
  .transform((v) => {
    const match = ISO_INSTANT_REGEX.exec(v)!;
    const parsed = new Date(v);
    return { parsed, match, raw: v };
  })
  .refine(({ parsed }) => !Number.isNaN(parsed.getTime()), {
    error: "is not a valid date",
  })
  .refine(
    ({ parsed, match }) => {
      const expectedIso = parsed.toISOString();
      const expectedYmd = expectedIso.slice(0, 10);
      const inputYmd = `${match[1]}-${match[2]}-${match[3]}`;
      if (match[7] === "Z" && expectedYmd !== inputYmd) return false;
      return true;
    },
    { error: "is not a valid calendar date" },
  )
  .refine(({ parsed }) => parsed.getTime() <= Date.now() + FUTURE_TOLERANCE_MS, {
    error: "cannot be more than 5 minutes in the future",
  })
  .transform(({ parsed }) => parsed);

const ProductFlagsSchema = z.preprocess(
  (v) => (v === undefined || v === null ? null : v),
  z
    .record(z.string(), z.boolean({ error: "must be a boolean" }))
    .superRefine((obj, ctx) => {
      const keys = Object.keys(obj);
      if (keys.length > MAX_PRODUCT_FLAG_KEYS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `must have at most ${MAX_PRODUCT_FLAG_KEYS} keys`,
          path: [],
        });
        return;
      }
      for (const key of keys) {
        if (key.length === 0 || key.length > MAX_PRODUCT_FLAG_KEY_LENGTH) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "key length out of range",
            path: [key],
          });
        }
      }
    })
    .nullable(),
);

export const MeasurementCreateSchema = z.object({
  measuredAt: MeasuredAtSchema,
  notes: nullableText(MAX_NOTES_LENGTH).optional().transform((v) => v ?? null),
  garmentType: nullableText(MAX_SHORT_TEXT_LENGTH).optional().transform((v) => v ?? null),
  compressionClass: nullableText(MAX_SHORT_TEXT_LENGTH).optional().transform((v) => v ?? null),
  diagnosis: nullableText(MAX_DIAGNOSIS_LENGTH).optional().transform((v) => v ?? null),
  productFlags: ProductFlagsSchema.optional().transform((v) => v ?? null),
});

const ValuesByKeySchema = z
  .record(z.string(), z.union([z.number(), z.null()]))
  .superRefine((obj, ctx) => {
    for (const [key, raw] of Object.entries(obj)) {
      if (!KNOWN_KEYS.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "unknown measurement key",
          path: [key],
        });
        continue;
      }
      if (raw === null) continue;
      if (!Number.isFinite(raw)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "must be a finite number or null",
          path: [key],
        });
        continue;
      }
      const range = KEY_RANGES.get(key as CompressionMeasurementKey);
      if (range && (raw < range.min || raw > range.max)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `must be between ${range.min} and ${range.max}`,
          path: [key],
        });
      }
    }
  });

export const MeasurementUpdateSchema = z.object({
  valuesByKey: ValuesByKeySchema,
  complete: z.boolean({ error: "must be a boolean" }).optional().transform((v) => v ?? false),
});

export function parseCreateMeasurementInput(body: unknown): ValidationResult<CreateMeasurementInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: "body", message: "must be a JSON object" }] };
  }
  return parseWithZod(MeasurementCreateSchema, body) as ValidationResult<CreateMeasurementInput>;
}

export function parseUpdateMeasurementValuesInput(
  body: unknown,
): ValidationResult<UpdateMeasurementValuesInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: "body", message: "must be a JSON object" }] };
  }
  return parseWithZod(
    MeasurementUpdateSchema,
    body,
  ) as ValidationResult<UpdateMeasurementValuesInput>;
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

import { z } from "zod";

import { parseWithZod, type ValidationError, type ValidationResult } from "./zod-validation";

export const PATIENT_SEX = {
  FEMALE: "FEMALE",
  MALE: "MALE",
} as const;

export type PatientSex = (typeof PATIENT_SEX)[keyof typeof PATIENT_SEX];

export type CreatePatientInput = {
  fullName: string;
  sex: PatientSex | null;
  documentType: string | null;
  documentNumber: string | null;
  birthDate: Date | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export type UpdatePatientInput = CreatePatientInput;

export type ListPatientsQuery = {
  q: string | null;
  limit: number;
};

const MAX_FULL_NAME_LENGTH = 120;
const MAX_SHORT_TEXT = 60;
const MAX_NOTES_LENGTH = 1000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const EDITABLE_PATIENT_FIELDS = new Set([
  "fullName",
  "sex",
  "documentType",
  "documentNumber",
  "birthDate",
  "phone",
  "email",
  "notes",
]);

function nullableString(maxLength: number) {
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

const BirthDateSchema = z.preprocess(
  (v) => (v === undefined || v === null || v === "" ? null : v),
  z
    .string()
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v.trim()), {
      error: "must use YYYY-MM-DD format",
    })
    .transform((v) => new Date(`${v.trim()}T00:00:00.000Z`))
    .refine((d) => !Number.isNaN(d.getTime()), {
      error: "is not a valid date",
    })
    .nullable(),
);

const SexSchema = z.preprocess(
  (v) => (v === undefined || v === null || v === "" ? null : v),
  z.enum(["FEMALE", "MALE"], { error: "must be FEMALE or MALE" }).nullable(),
);

export const PatientCreateSchema = z.object({
  fullName: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string({ error: "is required" })
      .min(1, { error: "is required" })
      .max(MAX_FULL_NAME_LENGTH, { error: `must be at most ${MAX_FULL_NAME_LENGTH} characters` }),
  ),
  sex: SexSchema.optional().transform((v) => v ?? null),
  documentType: nullableString(MAX_SHORT_TEXT),
  documentNumber: nullableString(MAX_SHORT_TEXT),
  birthDate: BirthDateSchema.optional().transform((v) => v ?? null),
  phone: nullableString(MAX_SHORT_TEXT),
  email: nullableString(MAX_SHORT_TEXT),
  notes: nullableString(MAX_NOTES_LENGTH),
});

export const PatientPatchSchema = PatientCreateSchema;

export function parseCreatePatientInput(body: unknown): ValidationResult<CreatePatientInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: "body", message: "must be a JSON object" }] };
  }
  return parseWithZod(PatientCreateSchema, body) as ValidationResult<CreatePatientInput>;
}

export function parseUpdatePatientInput(body: unknown): ValidationResult<UpdatePatientInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: "body", message: "must be a JSON object" }] };
  }

  const unknownErrors: ValidationError[] = [];
  for (const field of Object.keys(body as Record<string, unknown>)) {
    if (!EDITABLE_PATIENT_FIELDS.has(field)) {
      unknownErrors.push({ field, message: "is not allowed" });
    }
  }
  if (unknownErrors.length > 0) {
    return { ok: false, errors: unknownErrors };
  }

  return parseWithZod(PatientPatchSchema, body) as ValidationResult<UpdatePatientInput>;
}

export function parseListPatientsQuery(
  searchParams: URLSearchParams,
): ValidationResult<ListPatientsQuery> {
  const rawLimit = searchParams.get("limit");

  if (rawLimit === null || rawLimit.trim() === "") {
    const q = trimOrNull(searchParams.get("q"));
    if (q !== null && q.length > MAX_FULL_NAME_LENGTH) {
      return {
        ok: false,
        errors: [{ field: "q", message: `must be at most ${MAX_FULL_NAME_LENGTH} characters` }],
      };
    }
    return { ok: true, value: { q, limit: DEFAULT_LIMIT } };
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

  const q = trimOrNull(searchParams.get("q"));
  if (q !== null && q.length > MAX_FULL_NAME_LENGTH) {
    return {
      ok: false,
      errors: [{ field: "q", message: `must be at most ${MAX_FULL_NAME_LENGTH} characters` }],
    };
  }

  return { ok: true, value: { q, limit: parsed } };
}

function trimOrNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type { ValidationError, ValidationResult };

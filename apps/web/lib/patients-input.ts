type ValidationError = {
  field: string;
  message: string;
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };

export type CreatePatientInput = {
  fullName: string;
  documentType: string | null;
  documentNumber: string | null;
  birthDate: Date | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export type ListPatientsQuery = {
  q: string | null;
  limit: number;
};

const MAX_FULL_NAME_LENGTH = 120;
const MAX_SHORT_TEXT = 60;
const MAX_NOTES_LENGTH = 1000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseNullableString(
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

function parseBirthDate(value: unknown, errors: ValidationError[]): Date | null {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value !== "string") {
    errors.push({ field: "birthDate", message: "must be a date string (YYYY-MM-DD)" });
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    errors.push({ field: "birthDate", message: "must use YYYY-MM-DD format" });
    return null;
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    errors.push({ field: "birthDate", message: "is not a valid date" });
    return null;
  }

  return parsed;
}

function parseLimit(rawLimit: string | null): ValidationResult<number> {
  if (rawLimit === null || rawLimit.trim() === "") {
    return { ok: true, value: DEFAULT_LIMIT };
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

  return { ok: true, value: parsed };
}

export function parseCreatePatientInput(body: unknown): ValidationResult<CreatePatientInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: "body", message: "must be a JSON object" }] };
  }

  const source = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  const fullName = asTrimmedString(source.fullName);
  if (!fullName) {
    errors.push({ field: "fullName", message: "is required" });
  } else if (fullName.length > MAX_FULL_NAME_LENGTH) {
    errors.push({
      field: "fullName",
      message: `must be at most ${MAX_FULL_NAME_LENGTH} characters`,
    });
  }

  const documentType = parseNullableString(
    source.documentType,
    "documentType",
    MAX_SHORT_TEXT,
    errors,
  );
  const documentNumber = parseNullableString(
    source.documentNumber,
    "documentNumber",
    MAX_SHORT_TEXT,
    errors,
  );
  const birthDate = parseBirthDate(source.birthDate, errors);
  const phone = parseNullableString(source.phone, "phone", MAX_SHORT_TEXT, errors);
  const email = parseNullableString(source.email, "email", MAX_SHORT_TEXT, errors);
  const notes = parseNullableString(source.notes, "notes", MAX_NOTES_LENGTH, errors);

  if (errors.length > 0 || !fullName) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      fullName,
      documentType,
      documentNumber,
      birthDate,
      phone,
      email,
      notes,
    },
  };
}

export function parseListPatientsQuery(searchParams: URLSearchParams): ValidationResult<ListPatientsQuery> {
  const parsedLimit = parseLimit(searchParams.get("limit"));
  if (!parsedLimit.ok) {
    return parsedLimit;
  }

  const q = asTrimmedString(searchParams.get("q"));
  if (q !== null && q.length > MAX_FULL_NAME_LENGTH) {
    return {
      ok: false,
      errors: [
        {
          field: "q",
          message: `must be at most ${MAX_FULL_NAME_LENGTH} characters`,
        },
      ],
    };
  }

  return {
    ok: true,
    value: {
      q,
      limit: parsedLimit.value,
    },
  };
}

export type { ValidationError, ValidationResult };

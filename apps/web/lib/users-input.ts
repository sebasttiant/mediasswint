import type { UserRole } from "@/lib/auth-edge";

// ---------------------------------------------------------------------------
// Shared validation primitives (mirroring patients-input.ts)
// ---------------------------------------------------------------------------

type ValidationError = {
  field: string;
  message: string;
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };

export type { ValidationError, ValidationResult };

// ---------------------------------------------------------------------------
// UserRole const-type (sourced from auth-edge; re-exported for convenience)
// ---------------------------------------------------------------------------

const USER_ROLE = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
} as const;

type UserRoleValue = (typeof USER_ROLE)[keyof typeof USER_ROLE];

const ALLOWED_USER_ROLES: ReadonlySet<string> = new Set(Object.values(USER_ROLE));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateUserInput = {
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
};

export type UpdateUserPatchInput = {
  role?: UserRole;
  isActive?: boolean;
};

export type UpdateUserFullNameInput = {
  fullName: string;
};

export type UpdateUserPasswordInput = {
  password: string;
};

export type ListUsersQuery = {
  q: string | null;
  limit: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_FULL_NAME_LENGTH = 120;
export const MIN_PASSWORD_LENGTH = 8;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const ALLOWED_PATCH_FIELDS: ReadonlySet<string> = new Set(["role", "isActive"]);

// Simple email regex — RFC-loosely-compliant, matching existing project style
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

// ---------------------------------------------------------------------------
// parseCreateUserInput
// ---------------------------------------------------------------------------

export function parseCreateUserInput(body: unknown): ValidationResult<CreateUserInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: "body", message: "must be a JSON object" }] };
  }

  const source = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  // email
  const email = asTrimmedString(source.email);
  if (!email) {
    errors.push({ field: "email", message: "is required" });
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push({ field: "email", message: "must be a valid email address" });
  }

  // fullName
  const fullName = asTrimmedString(source.fullName);
  if (!fullName) {
    errors.push({ field: "fullName", message: "is required" });
  } else if (fullName.length > MAX_FULL_NAME_LENGTH) {
    errors.push({ field: "fullName", message: `must be at most ${MAX_FULL_NAME_LENGTH} characters` });
  }

  // role
  const rawRole = source.role;
  if (typeof rawRole !== "string" || !ALLOWED_USER_ROLES.has(rawRole)) {
    errors.push({ field: "role", message: `must be one of ${Object.values(USER_ROLE).join(", ")}` });
  }

  // password
  const password = source.password;
  if (typeof password !== "string" || password.length === 0) {
    errors.push({ field: "password", message: "is required" });
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push({
      field: "password",
      message: `must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  }

  if (errors.length > 0 || !email || !fullName || typeof rawRole !== "string" || !ALLOWED_USER_ROLES.has(rawRole) || typeof password !== "string") {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      email,
      fullName,
      role: rawRole as UserRoleValue,
      password: password as string,
    },
  };
}

// ---------------------------------------------------------------------------
// parseUpdateUserPatchInput
// ---------------------------------------------------------------------------

export function parseUpdateUserPatchInput(body: unknown): ValidationResult<UpdateUserPatchInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: "body", message: "must be a JSON object" }] };
  }

  const source = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  // Reject unknown fields
  for (const field of Object.keys(source)) {
    if (!ALLOWED_PATCH_FIELDS.has(field)) {
      errors.push({ field, message: "is not allowed" });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const result: UpdateUserPatchInput = {};

  // role
  if ("role" in source) {
    const rawRole = source.role;
    if (typeof rawRole !== "string" || !ALLOWED_USER_ROLES.has(rawRole)) {
      errors.push({ field: "role", message: `must be one of ${Object.values(USER_ROLE).join(", ")}` });
    } else {
      result.role = rawRole as UserRoleValue;
    }
  }

  // isActive
  if ("isActive" in source) {
    const rawIsActive = source.isActive;
    if (typeof rawIsActive !== "boolean") {
      errors.push({ field: "isActive", message: "must be a boolean" });
    } else {
      result.isActive = rawIsActive;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // At least one field must be provided
  if (!("role" in result) && !("isActive" in result)) {
    return {
      ok: false,
      errors: [{ field: "body", message: "must include at least one of: role, isActive" }],
    };
  }

  return { ok: true, value: result };
}

// ---------------------------------------------------------------------------
// parseUpdateUserFullNameInput
// ---------------------------------------------------------------------------

export function parseUpdateUserFullNameInput(body: unknown): ValidationResult<UpdateUserFullNameInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: "body", message: "must be a JSON object" }] };
  }

  const source = body as Record<string, unknown>;
  const fullName = asTrimmedString(source.fullName);
  if (!fullName) {
    return { ok: false, errors: [{ field: "fullName", message: "is required" }] };
  }

  if (fullName.length > MAX_FULL_NAME_LENGTH) {
    return {
      ok: false,
      errors: [{ field: "fullName", message: `must be at most ${MAX_FULL_NAME_LENGTH} characters` }],
    };
  }

  return { ok: true, value: { fullName } };
}

// ---------------------------------------------------------------------------
// parseUpdateUserPasswordInput
// ---------------------------------------------------------------------------

export function parseUpdateUserPasswordInput(body: unknown): ValidationResult<UpdateUserPasswordInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: "body", message: "must be a JSON object" }] };
  }

  const source = body as Record<string, unknown>;
  const password = source.password;
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, errors: [{ field: "password", message: "is required" }] };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      errors: [{ field: "password", message: `must be at least ${MIN_PASSWORD_LENGTH} characters` }],
    };
  }

  return { ok: true, value: { password } };
}

// ---------------------------------------------------------------------------
// parseListUsersQuery
// ---------------------------------------------------------------------------

export function parseListUsersQuery(searchParams: URLSearchParams): ValidationResult<ListUsersQuery> {
  const parsedLimit = parseLimit(searchParams.get("limit"));
  if (!parsedLimit.ok) {
    return parsedLimit;
  }

  const q = asTrimmedString(searchParams.get("q"));

  return {
    ok: true,
    value: {
      q,
      limit: parsedLimit.value,
    },
  };
}

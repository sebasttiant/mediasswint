import type { SafeUser } from "@/lib/users";
import {
  parseCreateUserInput,
  type CreateUserInput,
  type ValidationError,
} from "@/lib/users-input";

import { resolveAdminAccess, type AdminAccessUser } from "../../admin-access";

export type CreateUserFormState = {
  status: "idle" | "error" | "success";
  errors: ValidationError[];
};

export const INITIAL_CREATE_USER_STATE: CreateUserFormState = {
  status: "idle",
  errors: [],
};

export type CreateUserResult =
  | { ok: true; value: SafeUser }
  | { ok: false; error: "CONFLICT" | "NOT_FOUND" | "UNKNOWN" };

export type CreateUserFn = (input: CreateUserInput) => Promise<CreateUserResult>;

function formField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Pure submit pipeline: parse FormData → validate → call createUser → map the
 * service result to a form state. No redirect happens here so it stays testable.
 */
export async function submitCreateUser(
  formData: FormData,
  createUserFn: CreateUserFn,
): Promise<CreateUserFormState> {
  const parsed = parseCreateUserInput({
    email: formField(formData, "email"),
    fullName: formField(formData, "fullName"),
    role: formField(formData, "role"),
    password: formField(formData, "password"),
  });

  if (!parsed.ok) {
    return { status: "error", errors: parsed.errors };
  }

  const result = await createUserFn(parsed.value);

  if (!result.ok) {
    if (result.error === "CONFLICT") {
      return {
        status: "error",
        errors: [{ field: "email", message: "Ya existe un usuario con ese email." }],
      };
    }
    return {
      status: "error",
      errors: [{ field: "form", message: "No se pudo crear el usuario." }],
    };
  }

  return { status: "success", errors: [] };
}

export type AuthorizeAndCreateUserDeps = {
  readUser: () => Promise<AdminAccessUser | null>;
  createUserFn: CreateUserFn;
};

/**
 * Security boundary for the Server Action. A Server Action is its own POST
 * endpoint, so the page-level guard does NOT protect it — authorization must be
 * re-checked here before any mutation. Non-admin/unauthenticated callers never
 * reach createUser().
 */
export async function authorizeAndCreateUser(
  formData: FormData,
  deps: AuthorizeAndCreateUserDeps,
): Promise<CreateUserFormState> {
  const user = await deps.readUser();
  const access = resolveAdminAccess(user);

  if (!access.allowed) {
    return {
      status: "error",
      errors: [{ field: "form", message: "No tenés permisos para crear usuarios." }],
    };
  }

  return submitCreateUser(formData, deps.createUserFn);
}

export function errorFor(state: CreateUserFormState, field: string): string | undefined {
  return state.errors.find((error) => error.field === field)?.message;
}

export function resolveCreateUserRedirect(state: CreateUserFormState): string | null {
  return state.status === "success" ? "/admin/users" : null;
}

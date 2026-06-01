import type { UserRole } from "@/lib/auth-edge";
import type { SafeUser } from "@/lib/users";

import { resolveAdminAccess } from "../admin-access";

export type UserActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export const INITIAL_USER_ACTION_STATE: UserActionState = { status: "idle" };

export type ActionActor = { id: string; role: UserRole } | null;

export type MutationResult =
  | { ok: true; value: SafeUser }
  | { ok: false; error: "CONFLICT" | "NOT_FOUND" | "UNKNOWN" };

export type UpdateRoleFn = (
  id: string,
  role: UserRole,
  actorUserId: string,
) => Promise<MutationResult>;

export type SetActiveFn = (
  id: string,
  isActive: boolean,
  actorUserId: string,
) => Promise<MutationResult>;

function isUserRole(value: string): value is UserRole {
  return value === "ADMIN" || value === "STAFF";
}

function mapMutationError(error: "CONFLICT" | "NOT_FOUND" | "UNKNOWN"): string {
  if (error === "CONFLICT") {
    return "No podés dejar al sistema sin un administrador activo.";
  }
  if (error === "NOT_FOUND") {
    return "El usuario ya no existe.";
  }
  return "No se pudo completar la acción. Intentá de nuevo.";
}

/**
 * Security boundary for the role-change Server Action. A Server Action is its
 * own POST endpoint, so authorization is re-checked here before any mutation —
 * non-admin/anonymous callers never reach updateRole.
 */
export async function authorizeAndUpdateRole(
  formData: FormData,
  deps: { readUser: () => Promise<ActionActor>; updateRoleFn: UpdateRoleFn },
): Promise<UserActionState> {
  const actor = await deps.readUser();
  if (!resolveAdminAccess(actor).allowed || !actor) {
    return { status: "error", message: "No tenés permisos para esta acción." };
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  if (!userId || !isUserRole(role)) {
    return { status: "error", message: "Datos inválidos." };
  }

  const result = await deps.updateRoleFn(userId, role, actor.id);
  if (!result.ok) {
    return { status: "error", message: mapMutationError(result.error) };
  }

  return { status: "success", message: "Rol actualizado." };
}

/**
 * Security boundary for the activate/deactivate Server Action. Same contract as
 * authorizeAndUpdateRole: authorize first, mutate only for active ADMIN actors.
 */
export async function authorizeAndSetActive(
  formData: FormData,
  deps: { readUser: () => Promise<ActionActor>; setActiveFn: SetActiveFn },
): Promise<UserActionState> {
  const actor = await deps.readUser();
  if (!resolveAdminAccess(actor).allowed || !actor) {
    return { status: "error", message: "No tenés permisos para esta acción." };
  }

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) {
    return { status: "error", message: "Datos inválidos." };
  }
  const isActive = String(formData.get("isActive") ?? "") === "true";

  const result = await deps.setActiveFn(userId, isActive, actor.id);
  if (!result.ok) {
    return { status: "error", message: mapMutationError(result.error) };
  }

  return {
    status: "success",
    message: isActive ? "Usuario activado." : "Usuario desactivado.",
  };
}

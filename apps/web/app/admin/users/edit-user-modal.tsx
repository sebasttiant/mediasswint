"use client";

import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, Lock, ShieldCheck, User } from "lucide-react";

import { Modal } from "../../_components/ui/modal";
import { Badge } from "../../_components/ui/badge";

import {
  setUserActiveAction,
  updateUserFullNameAction,
  updateUserPasswordAction,
  updateUserRoleAction,
} from "./actions";
import { INITIAL_USER_ACTION_STATE, type UserActionState } from "./user-actions-core";
import { roleBadgeVariant, statusBadgeVariant, type UsersRow } from "./users-view";

function Feedback({ state }: { state: UserActionState }) {
  if (state.status === "idle" || !state.message) return null;
  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
        isError ? "text-red-600" : "text-emerald-600"
      }`}
    >
      {isError ? <AlertTriangle size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
      <span>{state.message}</span>
    </p>
  );
}

const LABEL_CLASS = "block text-xs font-semibold uppercase tracking-wide text-slate-600";
const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-brand/40 focus:ring-2 focus:ring-brand/10 disabled:opacity-60";
const SUBMIT_CLASS =
  "inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Single edit module for a user. Name, password (optional), role, and status
 * each map to their existing Server Action — relocated here from the table so
 * the list row stays clean. Every action re-checks ADMIN authorization server
 * side, so moving the UI changes presentation only, not the security boundary.
 * Existing passwords are never prefilled; a blank password form is simply not
 * submitted, which keeps the password change optional.
 */
export function EditUserModal({
  user,
  isCurrentUser,
  onClose,
}: {
  user: UsersRow | null;
  isCurrentUser: boolean;
  onClose: () => void;
}) {
  const [nameState, nameAction, namePending] = useActionState(
    updateUserFullNameAction,
    INITIAL_USER_ACTION_STATE,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    updateUserPasswordAction,
    INITIAL_USER_ACTION_STATE,
  );
  const [roleState, roleAction, rolePending] = useActionState(
    updateUserRoleAction,
    INITIAL_USER_ACTION_STATE,
  );
  const [activeState, activeAction, activePending] = useActionState(
    setUserActiveAction,
    INITIAL_USER_ACTION_STATE,
  );

  const displayName = user?.fullName ?? user?.email ?? "";

  return (
    <Modal
      open={user !== null}
      onClose={onClose}
      title="Editar usuario"
      eyebrow={isCurrentUser ? "Tu cuenta" : "Gestión de acceso"}
      description={user?.email}
    >
      {user ? (
        <div className="space-y-6">
          {/* Current role/status at a glance */}
          <div className="flex items-center gap-2">
            <Badge variant={roleBadgeVariant(user.role)}>
              {user.role === "ADMIN" ? "Administrador" : "Staff"}
            </Badge>
            <Badge variant={statusBadgeVariant(user.isActive)}>{user.statusLabel}</Badge>
          </div>

          {/* Full name */}
          <form action={nameAction} aria-label={`Editar nombre de ${displayName}`} className="space-y-1.5">
            <input type="hidden" name="userId" value={user.id} />
            <label htmlFor="edit-user-fullName" className={LABEL_CLASS}>
              Nombre completo
            </label>
            <div className="relative">
              <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="edit-user-fullName"
                name="fullName"
                type="text"
                required
                maxLength={120}
                autoComplete="name"
                defaultValue={user.fullName ?? ""}
                className={INPUT_CLASS}
              />
            </div>
            <div className="pt-1">
              <button type="submit" disabled={namePending} className={SUBMIT_CLASS}>
                {namePending ? "Guardando…" : "Guardar nombre"}
              </button>
            </div>
            <Feedback state={nameState} />
          </form>

          <div className="border-t border-slate-100" />

          {/* Password — optional: only submitted when a value is typed */}
          <form action={passwordAction} aria-label={`Cambiar contraseña de ${displayName}`} className="space-y-1.5">
            <input type="hidden" name="userId" value={user.id} />
            <label htmlFor="edit-user-password" className={LABEL_CLASS}>
              Nueva contraseña <span className="font-normal normal-case text-slate-400">(opcional)</span>
            </label>
            <div className="relative">
              <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="edit-user-password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                className={INPUT_CLASS}
              />
            </div>
            <div className="pt-1">
              <button type="submit" disabled={passwordPending} className={SUBMIT_CLASS}>
                {passwordPending ? "Actualizando…" : "Cambiar contraseña"}
              </button>
            </div>
            <Feedback state={passwordState} />
          </form>

          <div className="border-t border-slate-100" />

          {/* Role */}
          <form action={roleAction} aria-label={`Cambiar rol de ${displayName}`} className="space-y-1.5">
            <input type="hidden" name="userId" value={user.id} />
            <label htmlFor="edit-user-role" className={LABEL_CLASS}>
              Rol de acceso
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <ShieldCheck size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <select
                  id="edit-user-role"
                  name="role"
                  defaultValue={user.role}
                  disabled={rolePending}
                  className={INPUT_CLASS}
                >
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <button type="submit" disabled={rolePending} className={SUBMIT_CLASS}>
                {rolePending ? "Guardando…" : "Guardar rol"}
              </button>
            </div>
            <Feedback state={roleState} />
          </form>

          <div className="border-t border-slate-100" />

          {/* Status */}
          <form action={activeAction} aria-label={`Cambiar estado de ${displayName}`} className="space-y-1.5">
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="isActive" value={String(!user.isActive)} />
            <span className={LABEL_CLASS}>Estado de la cuenta</span>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                {user.isActive
                  ? "La cuenta puede iniciar sesión."
                  : "La cuenta está deshabilitada."}
              </p>
              <button
                type="submit"
                disabled={activePending}
                className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  user.isActive
                    ? "border-red-200 text-red-600 hover:bg-red-50"
                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                {user.isActive ? "Desactivar" : "Activar"}
              </button>
            </div>
            <Feedback state={activeState} />
          </form>
        </div>
      ) : null}
    </Modal>
  );
}

export default EditUserModal;

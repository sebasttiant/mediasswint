"use client";

import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Lock, Mail, ShieldCheck, User } from "lucide-react";

import { errorFor, type CreateUserFormState } from "./create-user-state";

const ROLE_OPTIONS = [
  { value: "STAFF", label: "Staff" },
  { value: "ADMIN", label: "Administrador" },
] as const;

const FIELD_BASE =
  "h-11 w-full rounded-xl border bg-white pl-11 pr-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:ring-2 disabled:opacity-60";

function fieldClasses(hasError: boolean): string {
  return hasError
    ? `${FIELD_BASE} border-red-300 focus:border-red-400 focus:ring-red-100`
    : `${FIELD_BASE} border-slate-200 focus:border-brand/40 focus:ring-brand/10`;
}

type IconedFieldProps = {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  error?: string;
  children: (props: { id: string; className: string; "aria-invalid": boolean }) => ReactNode;
};

function IconedField({ id, label, icon: Icon, error, children }: IconedFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </label>
      <div className="relative">
        <Icon
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden={true}
        />
        {children({ id, className: fieldClasses(Boolean(error)), "aria-invalid": Boolean(error) })}
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Shared presentational fields for the create-user flow. Reused by the in-list
 * modal and the standalone /admin/users/new page so both look identical and
 * keep the same labels, icons, and validation hints. The owning form supplies
 * the action state + pending flag from its own useActionState.
 */
export function CreateUserFields({
  state,
  isPending,
}: {
  state: CreateUserFormState;
  isPending: boolean;
}) {
  const formError = errorFor(state, "form");

  return (
    <div className="space-y-4">
      {formError ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{formError}</span>
        </div>
      ) : null}

      <IconedField id="create-user-fullName" label="Nombre completo" icon={User} error={errorFor(state, "fullName")}>
        {(props) => (
          <input
            {...props}
            name="fullName"
            type="text"
            required
            maxLength={120}
            autoComplete="name"
            placeholder="Ej: Ada Lovelace"
            defaultValue=""
          />
        )}
      </IconedField>

      <IconedField id="create-user-email" label="Correo electrónico" icon={Mail} error={errorFor(state, "email")}>
        {(props) => (
          <input
            {...props}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="nombre@ilasesorias.com"
            defaultValue=""
          />
        )}
      </IconedField>

      <IconedField id="create-user-password" label="Contraseña" icon={Lock} error={errorFor(state, "password")}>
        {(props) => (
          <input
            {...props}
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            defaultValue=""
          />
        )}
      </IconedField>

      <IconedField id="create-user-role" label="Rol de acceso" icon={ShieldCheck} error={errorFor(state, "role")}>
        {(props) => (
          <select {...props} name="role" defaultValue="STAFF" className={`${props.className} pr-3`}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </IconedField>

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Registrando…" : "Registrar usuario"}
      </button>
    </div>
  );
}

export default CreateUserFields;

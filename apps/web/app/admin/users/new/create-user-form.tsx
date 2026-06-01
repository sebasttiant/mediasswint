"use client";

import { useActionState } from "react";

import { createUserAction } from "./actions";
import { errorFor, INITIAL_CREATE_USER_STATE } from "./create-user-state";

const ROLE_OPTIONS = [
  { value: "STAFF", label: "Staff" },
  { value: "ADMIN", label: "Administrador" },
] as const;

export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(
    createUserAction,
    INITIAL_CREATE_USER_STATE,
  );

  const formError = errorFor(state, "form");

  return (
    <form action={formAction} aria-label="Crear usuario">
      {formError ? <p role="alert">{formError}</p> : null}

      <label>
        Email
        <input type="email" name="email" required defaultValue="" />
      </label>
      {errorFor(state, "email") ? <p role="alert">{errorFor(state, "email")}</p> : null}

      <label>
        Nombre completo
        <input type="text" name="fullName" required defaultValue="" />
      </label>
      {errorFor(state, "fullName") ? <p role="alert">{errorFor(state, "fullName")}</p> : null}

      <label>
        Rol
        <select name="role" defaultValue="STAFF">
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {errorFor(state, "role") ? <p role="alert">{errorFor(state, "role")}</p> : null}

      <label>
        Contraseña
        <input type="password" name="password" required defaultValue="" />
      </label>
      {errorFor(state, "password") ? <p role="alert">{errorFor(state, "password")}</p> : null}

      <button type="submit" disabled={isPending}>
        {isPending ? "Creando…" : "Crear usuario"}
      </button>
    </form>
  );
}

export default CreateUserForm;

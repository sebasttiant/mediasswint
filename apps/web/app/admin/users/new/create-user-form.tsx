"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";

import { createUserAction } from "./actions";
import { CreateUserFields } from "./create-user-fields";
import { INITIAL_CREATE_USER_STATE } from "./create-user-state";

/**
 * Standalone create-user screen for deep links to /admin/users/new. Mirrors the
 * in-list modal: a centered card with the same iconed fields, so the route and
 * the overlay are visually equivalent. The "Nuevo usuario" button on the list
 * opens the modal; this page is the no-JS / direct-navigation fallback.
 */
export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(createUserAction, INITIAL_CREATE_USER_STATE);

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-100 px-6 pb-5 pt-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <UserPlus size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand">
              Acceso al panel administrativo
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Nuevo Usuario</h2>
          </div>
        </div>

        <form action={formAction} aria-label="Crear usuario" className="px-6 pb-6 pt-5">
          <CreateUserFields state={state} isPending={isPending} />
        </form>
      </div>
    </div>
  );
}

export default CreateUserForm;

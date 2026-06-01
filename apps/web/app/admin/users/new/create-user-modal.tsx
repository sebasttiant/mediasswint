"use client";

import { useActionState } from "react";

import { Modal } from "../../../_components/ui/modal";
import { createUserAction } from "./actions";
import { CreateUserFields } from "./create-user-fields";
import { INITIAL_CREATE_USER_STATE } from "./create-user-state";

/**
 * Create-user overlay opened from the users list. On success the Server Action
 * redirects to /admin/users, which unmounts this modal and refreshes the table —
 * no manual close needed. Validation errors keep the dialog open with messages.
 */
export function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(createUserAction, INITIAL_CREATE_USER_STATE);

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Usuario" eyebrow="Acceso al panel administrativo">
      <form action={formAction} aria-label="Crear usuario">
        <CreateUserFields state={state} isPending={isPending} />
      </form>
    </Modal>
  );
}

export default CreateUserModal;

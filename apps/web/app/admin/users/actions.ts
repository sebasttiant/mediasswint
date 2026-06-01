"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { setUserActive, updateUserFullName, updateUserPassword, updateUserRole } from "@/lib/users";

import {
  authorizeAndSetActive,
  authorizeAndUpdateFullName,
  authorizeAndUpdatePassword,
  authorizeAndUpdateRole,
  type ActionActor,
  type UserActionState,
} from "./user-actions-core";

async function readActiveUser(): Promise<ActionActor> {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request("http://localhost/admin/users", {
    headers: sessionCookie
      ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` }
      : undefined,
  });
  return requireActiveUserFromRequest(request);
}

export async function updateUserRoleAction(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const state = await authorizeAndUpdateRole(formData, {
    readUser: readActiveUser,
    updateRoleFn: updateUserRole,
  });
  if (state.status === "success") {
    revalidatePath("/admin/users");
  }
  return state;
}

export async function setUserActiveAction(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const state = await authorizeAndSetActive(formData, {
    readUser: readActiveUser,
    setActiveFn: setUserActive,
  });
  if (state.status === "success") {
    revalidatePath("/admin/users");
  }
  return state;
}

export async function updateUserFullNameAction(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const state = await authorizeAndUpdateFullName(formData, {
    readUser: readActiveUser,
    updateFullNameFn: (id, input) => updateUserFullName(id, input),
  });
  if (state.status === "success") {
    revalidatePath("/admin/users");
  }
  return state;
}

export async function updateUserPasswordAction(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const state = await authorizeAndUpdatePassword(formData, {
    readUser: readActiveUser,
    updatePasswordFn: (id, input) => updateUserPassword(id, input),
  });
  if (state.status === "success") {
    revalidatePath("/admin/users");
  }
  return state;
}

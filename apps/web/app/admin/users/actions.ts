"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { setUserActive, updateUserRole } from "@/lib/users";

import {
  authorizeAndSetActive,
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

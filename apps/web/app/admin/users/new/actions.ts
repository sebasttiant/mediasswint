"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { createUser } from "@/lib/users";

import {
  authorizeAndCreateUser,
  resolveCreateUserRedirect,
  type CreateUserFormState,
} from "./create-user-state";

async function readActiveUser() {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request("http://localhost/admin/users/new", {
    headers: sessionCookie
      ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` }
      : undefined,
  });
  return requireActiveUserFromRequest(request);
}

export async function createUserAction(
  _prevState: CreateUserFormState,
  formData: FormData,
): Promise<CreateUserFormState> {
  const state = await authorizeAndCreateUser(formData, {
    readUser: readActiveUser,
    createUserFn: createUser,
  });

  if (resolveCreateUserRedirect(state)) {
    revalidatePath("/admin/users");
    redirect("/admin/users");
  }

  return state;
}

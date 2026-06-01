import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ComponentType, ReactElement } from "react";

import { getSessionCookieName, requireActiveUserFromRequest, type UserRole } from "@/lib/auth";

import { LogoutButton } from "../../../_components/logout-button";
import { resolveAdminAccess } from "../../admin-access";

import { renderNewUserView, type NewUserViewUser } from "./new-user-view";

type NewUserAuthUser = {
  id: string;
  role: UserRole;
  fullName: string | null;
};

export type NewUserPageDeps = {
  readUser?: () => Promise<NewUserAuthUser | null>;
  loadForm?: () => Promise<{ default: ComponentType }>;
};

async function defaultReadUser(): Promise<NewUserAuthUser | null> {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request("http://localhost/admin/users/new", {
    headers: sessionCookie
      ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` }
      : undefined,
  });
  return requireActiveUserFromRequest(request);
}

const defaultLoadForm: NonNullable<NewUserPageDeps["loadForm"]> = () => import("./create-user-form");

export async function NewUserPage(deps: NewUserPageDeps = {}): Promise<ReactElement> {
  const readUser = deps.readUser ?? defaultReadUser;
  const user = await readUser();
  const access = resolveAdminAccess(user);

  if (!access.allowed) {
    redirect(access.redirectTo);
  }

  const loadForm = deps.loadForm ?? defaultLoadForm;
  const { default: CreateUserFormComponent } = await loadForm();

  const viewUser: NewUserViewUser = { fullName: user?.fullName ?? null };

  return renderNewUserView({
    user: viewUser,
    CreateUserFormComponent,
    actions: <LogoutButton />,
  });
}

export default NewUserPage;

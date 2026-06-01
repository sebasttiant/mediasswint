import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import { getSessionCookieName, requireActiveUserFromRequest, type UserRole } from "@/lib/auth";

import { LogoutButton } from "../_components/logout-button";

import { resolveAdminAccess } from "./admin-access";
import { renderAdminView, type AdminViewUser } from "./admin-view";

export type AdminAuthUser = {
  id: string;
  role: UserRole;
  fullName: string | null;
};

export type AdminPageDeps = {
  readUser?: () => Promise<AdminAuthUser | null>;
};

function requestFromSessionCookie(sessionCookie: string | undefined) {
  return new Request("http://localhost/admin", {
    headers: sessionCookie
      ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` }
      : undefined,
  });
}

async function defaultReadUser(): Promise<AdminAuthUser | null> {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  return requireActiveUserFromRequest(requestFromSessionCookie(sessionCookie));
}

export async function AdminPage(deps: AdminPageDeps = {}): Promise<ReactElement> {
  const readUser = deps.readUser ?? defaultReadUser;
  const user = await readUser();
  const access = resolveAdminAccess(user);

  if (!access.allowed) {
    redirect(access.redirectTo);
  }

  const viewUser: AdminViewUser = { fullName: user?.fullName ?? null };

  return renderAdminView({ user: viewUser, role: user?.role, actions: <LogoutButton /> });
}

export default AdminPage;

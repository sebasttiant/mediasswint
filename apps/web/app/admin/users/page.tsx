import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import { getSessionCookieName, requireActiveUserFromRequest, type UserRole } from "@/lib/auth";
import { listUsers, type SafeUser } from "@/lib/users";
import { parseListUsersQuery, type ListUsersQuery } from "@/lib/users-input";

import { LogoutButton } from "../../_components/logout-button";
import { resolveAdminAccess } from "../admin-access";

import { renderUsersView, type UsersViewUser } from "./users-view";

type UsersAuthUser = {
  id: string;
  role: UserRole;
  fullName: string | null;
};

type ListUsersResult =
  | { ok: true; value: SafeUser[] }
  | { ok: false; error: "CONFLICT" | "NOT_FOUND" | "UNKNOWN" };

type SearchParamValue = string | string[] | undefined;

type UsersPageProps = {
  searchParams?: Promise<{ q?: SearchParamValue; limit?: SearchParamValue }>;
};

export type UsersPageDeps = {
  readUser?: () => Promise<UsersAuthUser | null>;
  listUsersFn?: (query: ListUsersQuery) => Promise<ListUsersResult>;
};

function firstParam(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value.find((entry) => entry.trim().length > 0);
  }
  return typeof value === "string" ? value : undefined;
}

function toListUsersQuery(params: { q?: SearchParamValue; limit?: SearchParamValue }): ListUsersQuery {
  const searchParams = new URLSearchParams();
  const q = firstParam(params.q);
  if (q !== undefined) searchParams.set("q", q);
  const limit = firstParam(params.limit);
  if (limit !== undefined) searchParams.set("limit", limit);

  const parsed = parseListUsersQuery(searchParams);
  return parsed.ok ? parsed.value : { q: q ?? null, limit: 20 };
}

async function defaultReadUser(): Promise<UsersAuthUser | null> {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request("http://localhost/admin/users", {
    headers: sessionCookie
      ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` }
      : undefined,
  });
  return requireActiveUserFromRequest(request);
}

export async function UsersPage(
  { searchParams }: UsersPageProps,
  deps: UsersPageDeps = {},
): Promise<ReactElement> {
  const readUser = deps.readUser ?? defaultReadUser;
  const user = await readUser();
  const access = resolveAdminAccess(user);

  if (!access.allowed) {
    redirect(access.redirectTo);
  }

  const resolvedParams = (await searchParams) ?? {};
  const query = toListUsersQuery(resolvedParams);

  const listUsersFn = deps.listUsersFn ?? listUsers;
  const result = await listUsersFn(query);

  if (!result.ok) {
    throw new Error(`Failed to load users: ${result.error}`);
  }

  const viewUser: UsersViewUser = { fullName: user?.fullName ?? null };

  return renderUsersView({
    user: viewUser,
    users: result.value,
    query: query.q ?? "",
    actions: <LogoutButton />,
  });
}

export default UsersPage;

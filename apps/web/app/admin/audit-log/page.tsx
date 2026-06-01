import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import { getSessionCookieName, requireActiveUserFromRequest, type UserRole } from "@/lib/auth";
import { listAuditLog, type AuditLogPage as AuditLogPageData, type ListAuditFilters } from "@/lib/audit-log";

import { LogoutButton } from "../../_components/logout-button";
import { resolveAdminAccess } from "../admin-access";

import {
  buildAuditPagination,
  renderAuditLogView,
  resolveAuditQuery,
  type AuditLogViewUser,
  type RawAuditParams,
} from "./audit-log-view";

const PAGE_SIZE = 20;

type AuditAuthUser = {
  id: string;
  role: UserRole;
  fullName: string | null;
};

type SearchParamValue = string | string[] | undefined;

type AuditLogPageProps = {
  searchParams?: Promise<Record<string, SearchParamValue>>;
};

export type AuditLogPageDeps = {
  readUser?: () => Promise<AuditAuthUser | null>;
  listAuditLogFn?: (filters: ListAuditFilters) => Promise<AuditLogPageData>;
};

function firstParam(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value.find((entry) => entry.trim().length > 0);
  }
  return typeof value === "string" ? value : undefined;
}

function toRawAuditParams(params: Record<string, SearchParamValue>): RawAuditParams {
  return {
    page: firstParam(params.page),
    entityType: firstParam(params.entityType),
    userId: firstParam(params.userId),
    action: firstParam(params.action),
    from: firstParam(params.from),
    to: firstParam(params.to),
  };
}

async function defaultReadUser(): Promise<AuditAuthUser | null> {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request("http://localhost/admin/audit-log", {
    headers: sessionCookie
      ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` }
      : undefined,
  });
  return requireActiveUserFromRequest(request);
}

export async function AuditLogPage(
  { searchParams }: AuditLogPageProps,
  deps: AuditLogPageDeps = {},
): Promise<ReactElement> {
  const readUser = deps.readUser ?? defaultReadUser;
  const user = await readUser();
  const access = resolveAdminAccess(user);

  if (!access.allowed) {
    redirect(access.redirectTo);
  }

  const resolvedParams = (await searchParams) ?? {};
  const query = resolveAuditQuery(toRawAuditParams(resolvedParams), PAGE_SIZE);

  const listAuditLogFn = deps.listAuditLogFn ?? listAuditLog;
  const { rows, total } = await listAuditLogFn(query.filters);

  const pagination = buildAuditPagination({
    page: query.page,
    limit: PAGE_SIZE,
    total,
    rowCount: rows.length,
  });

  const viewUser: AuditLogViewUser = { fullName: user?.fullName ?? null };

  return renderAuditLogView({
    user: viewUser,
    rows,
    formValues: query.formValues,
    pagination,
    actions: <LogoutButton />,
  });
}

export default AuditLogPage;

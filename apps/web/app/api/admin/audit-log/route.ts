import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { AuditAction } from "@prisma/client";

import { listAuditLog, type ListAuditFilters } from "@/lib/audit-log";
import type { AuditLogRow } from "@/lib/audit-log";
import { withAdminAuth } from "@/lib/with-auth";
import type { AuthUser } from "@/lib/auth";

export type AuditLogWithUser = {
  id: string;
  userId: string | null;
  user: { id: string; email: string; fullName: string | null } | null;
  action: "CREATE" | "UPDATE" | "DELETE";
  entityType: string;
  entityId: string;
  diff: Prisma.JsonValue;
  createdAt: Date;
};

export type GetAuditLogsResponse = {
  auditLogs: AuditLogWithUser[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DELETE"] as const;

function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && (AUDIT_ACTIONS as readonly string[]).includes(value);
}

export type AuditLogRouteDeps = {
  list(filters: ListAuditFilters): Promise<AuditLogRow[]>;
};

const defaultDeps: AuditLogRouteDeps = {
  list: listAuditLog,
};

export async function handleGetAuditLogRequest(
  request: Request,
  _user: AuthUser,
  deps: AuditLogRouteDeps = defaultDeps,
): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const errors: Array<{ field: string; message: string }> = [];

  // Parse page / limit
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));

  // Parse from
  let from: Date | undefined;
  const rawFrom = searchParams.get("from");
  if (rawFrom !== null) {
    const parsed = new Date(rawFrom);
    if (Number.isNaN(parsed.getTime())) {
      errors.push({ field: "from", message: "must be a valid ISO 8601 date string" });
    } else {
      from = parsed;
    }
  }

  // Parse to
  let to: Date | undefined;
  const rawTo = searchParams.get("to");
  if (rawTo !== null) {
    const parsed = new Date(rawTo);
    if (Number.isNaN(parsed.getTime())) {
      errors.push({ field: "to", message: "must be a valid ISO 8601 date string" });
    } else {
      to = parsed;
    }
  }

  // Parse action — guarded (spec: invalid → 400)
  let action: AuditAction | undefined;
  const rawAction = searchParams.get("action");
  if (rawAction !== null) {
    if (isAuditAction(rawAction)) {
      action = rawAction;
    } else {
      errors.push({ field: "action", message: `must be one of ${AUDIT_ACTIONS.join(", ")}` });
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const entityType = searchParams.get("entityType") ?? undefined;
  const entityId = searchParams.get("entityId") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;

  try {
    const filters: ListAuditFilters = {
      entityType: entityType as ListAuditFilters["entityType"],
      entityId,
      userId,
      action,
      from,
      to,
      limit,
    };

    const rows = await deps.list(filters);
    const skip = (page - 1) * limit;

    const auditLogs: AuditLogWithUser[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      user: null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      diff: row.diff as Prisma.JsonValue,
      createdAt: row.createdAt,
    }));

    const response: GetAuditLogsResponse = {
      auditLogs,
      total: rows.length,
      page,
      limit,
      hasMore: skip + limit < rows.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[audit-log:get]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withAdminAuth(async (request, _ctx, { user }) =>
  handleGetAuditLogRequest(request, user),
);

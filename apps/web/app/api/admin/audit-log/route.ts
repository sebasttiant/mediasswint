import { NextResponse } from "next/server";
import type { Prisma } from '@prisma/client';

import { getPrisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/with-auth";

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

async function handleGetAuditLogsRequest(
  request: Request,
  user: { id: string; email: string; fullName: string | null }
): Promise<Response> {
  // User is available for auditing who accessed the audit logs (if needed in future)
  // For now we ensure the parameter is used to avoid lint warnings
  if (!user.email) {
    // This is a guard clause - admin users should always have email
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403 }
    );
  }
  const { searchParams } = new URL(request.url);
  
  // Parse query parameters
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));
  const entityType = searchParams.get("entityType") ?? undefined;
  const entityId = searchParams.get("entityId") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const action = searchParams.get("action") as "CREATE" | "UPDATE" | "DELETE" | undefined;
  
  const skip = (page - 1) * limit;
  
  const prisma = getPrisma();
  
  // Build where clause
  const where: Prisma.AuditLogWhereInput = {};
  
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (userId) where.userId = userId;
  if (action) where.action = action;
  
  try {
    // Get total count
    const total = await prisma.auditLog.count({ where });
    
    // Get paginated results
    const auditLogs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      skip,
      take: limit,
    });
    
    // Transform to response format
    const formattedLogs: AuditLogWithUser[] = auditLogs.map(log => ({
      id: log.id,
      userId: log.userId,
      user: log.user ? {
        id: log.user.id,
        email: log.user.email,
        fullName: log.user.fullName
      } : null,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      diff: log.diff,
      createdAt: log.createdAt
    }));
    
    const response: GetAuditLogsResponse = {
      auditLogs: formattedLogs,
      total,
      page,
      limit,
      hasMore: skip + limit < total
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("[audit-log:get]", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(async (request, _ctx, { user }) => {
  return handleGetAuditLogsRequest(request, {
    id: user.id,
    email: user.email,
    fullName: user.fullName
  });
});
import { Prisma, type AuditAction } from "@prisma/client";

import { getAuditUserId } from "@/lib/audit-context";
import { getPrisma } from "@/lib/prisma";

export type AuditEntityType = "Patient" | "MeasurementSession" | "CommercialOperation";

export type AuditDiff = {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export type AuditEntry = {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  diff: AuditDiff;
};

export type AuditLogRow = {
  id: string;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  diff: AuditDiff;
  createdAt: Date;
};

export type ListAuditFilters = {
  entityType?: AuditEntityType;
  entityId?: string;
  userId?: string;
  action?: AuditAction;
  from?: Date;
  to?: Date;
  limit: number;
};

export type AuditRepository = {
  record(entry: AuditEntry & { userId: string | null }): Promise<void>;
  list(filters: ListAuditFilters): Promise<AuditLogRow[]>;
};

/**
 * Convert a domain object into a JSON-safe shape suitable for the `diff` column.
 * Dates serialize to ISO strings and Decimals to their canonical string form so
 * the audit row faithfully reflects the value at write time without depending
 * on the consumer's deserialization choices.
 */
export function toAuditPayload(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  return JSON.parse(
    JSON.stringify(value, (_key, raw) => {
      if (raw instanceof Date) return raw.toISOString();
      if (raw instanceof Prisma.Decimal) return raw.toString();
      return raw;
    }),
  ) as Record<string, unknown>;
}

const defaultRepository: AuditRepository = {
  async record({ userId, action, entityType, entityId, diff }) {
    const prisma = getPrisma();
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        diff: diff as Prisma.InputJsonValue,
      },
    });
  },

  async list(filters) {
    const prisma = getPrisma();
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }

    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.limit,
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      diff: (row.diff as AuditDiff) ?? {},
      createdAt: row.createdAt,
    }));
  },
};

export function getDefaultAuditRepository(): AuditRepository {
  return defaultRepository;
}

/**
 * Persist an audit record. Audit failures NEVER throw out of this function —
 * a missed audit row is far less damaging than aborting the user's mutation
 * because of a logging-layer issue. The error is logged for ops to follow up.
 */
export async function recordAudit(
  entry: AuditEntry,
  repository: AuditRepository = defaultRepository,
): Promise<void> {
  const userId = getAuditUserId();
  try {
    await repository.record({ ...entry, userId });
  } catch (error) {
    console.error("[audit:record] failed", { entry, userId, error });
  }
}

export async function listAuditLog(
  filters: ListAuditFilters,
  repository: AuditRepository = defaultRepository,
): Promise<AuditLogRow[]> {
  return repository.list(filters);
}

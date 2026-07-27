import { Prisma, type AuditAction } from "@prisma/client";

import { getAuditUserId } from "@/lib/audit-context";
import { getPrisma } from "@/lib/prisma";

export type AuditEntityType = "Patient" | "MeasurementSession" | "CommercialOperation" | "User";

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
  user: { id: string; email: string; fullName: string | null } | null;
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
  skip?: number;
};

export type AuditLogPage = {
  rows: AuditLogRow[];
  total: number;
};

export type AuditRepository = {
  record(entry: AuditEntry & { userId: string | null }): Promise<void>;
  list(filters: ListAuditFilters): Promise<AuditLogPage>;
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

    const [total, rawRows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, fullName: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: filters.skip ?? 0,
        take: filters.limit,
      }),
    ]);

    const rows: AuditLogRow[] = rawRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      user: row.user ?? null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      diff: (row.diff as AuditDiff) ?? {},
      createdAt: row.createdAt,
    }));

    return { rows, total };
  },
};

export function getDefaultAuditRepository(): AuditRepository {
  return defaultRepository;
}

/**
 * A short, non-free-text error identifier safe to log.
 *
 * Prisma and pg attach machine codes such as `P2002` / `23505`. The message is
 * deliberately never used: driver messages embed the failing statement and its
 * bound parameters, which for a measurement audit means clinical values.
 */
function extractSafeErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  // Codes are short identifiers; anything longer is not a code and may be prose.
  if (typeof code === "string" && code.length > 0 && code.length <= 16) return code;
  if (typeof code === "number") return String(code);
  return null;
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
    // NEVER log `entry` here. A measurement entry's `diff` carries measurement
    // values, diagnosis, notes, productFlags and arbitrary metadata, and an
    // audit write failing is precisely when logs get read, shipped and
    // retained. Only operational identifiers leave this function.
    //
    // The raw error is excluded too: driver messages routinely embed the failing
    // statement and its parameters, which would put the same clinical payload
    // back in the log through the side door.
    console.error("[audit:record] failed", {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      userId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorCode: extractSafeErrorCode(error),
    });
  }
}

export async function listAuditLog(
  filters: ListAuditFilters,
  repository: AuditRepository = defaultRepository,
): Promise<AuditLogPage> {
  return repository.list(filters);
}

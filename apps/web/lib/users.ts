import { Prisma } from "@prisma/client";
import type { UserRole } from "@prisma/client";

import { recordAudit, toAuditPayload, type AuditEntry } from "@/lib/audit-log";
import { hashPassword } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import type { CreateUserInput, ListUsersQuery, UpdateUserFullNameInput, UpdateUserPasswordInput } from "@/lib/users-input";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ServiceErrorCode = "CONFLICT" | "NOT_FOUND" | "UNKNOWN";

type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: ServiceErrorCode };

/**
 * User shape safe to return to callers — passwordHash is never included.
 */
export type SafeUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type FullUser = SafeUser & { passwordHash: string };

// A minimal transaction-like interface for the serializable operations.
// In tests the same repo object is re-used as the tx handle.
type TxHandle = {
  countActiveAdmins(): Promise<number>;
  updateRole(tx: TxHandle, id: string, role: UserRole): Promise<FullUser>;
  setActive(tx: TxHandle, id: string, isActive: boolean): Promise<FullUser>;
};

// ---------------------------------------------------------------------------
// Repository contract
// ---------------------------------------------------------------------------

export type UsersRepository = {
  list(query: ListUsersQuery): Promise<SafeUser[]>;
  getById(id: string): Promise<FullUser | null>;
  create(input: { email: string; fullName: string | null; role: UserRole; passwordHash: string }): Promise<FullUser>;
  countActiveAdmins(tx?: TxHandle): Promise<number>;
  updateRole(tx: TxHandle, id: string, role: UserRole): Promise<FullUser>;
  setActive(tx: TxHandle, id: string, isActive: boolean): Promise<FullUser>;
  updateFullName(id: string, fullName: string): Promise<FullUser>;
  updatePasswordHash(id: string, passwordHash: string): Promise<FullUser>;
};

// ---------------------------------------------------------------------------
// Default Prisma repository
// ---------------------------------------------------------------------------

const defaultRepository: UsersRepository = {
  async list(query) {
    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      where: query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: "insensitive" } },
              { fullName: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return users;
  },

  async getById(id) {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id } });
    return user ?? null;
  },

  async create(input) {
    const prisma = getPrisma();
    return prisma.user.create({ data: input });
  },

  async countActiveAdmins() {
    const prisma = getPrisma();
    return prisma.user.count({ where: { role: "ADMIN", isActive: true } });
  },

  async updateRole(_tx, id, role) {
    const prisma = getPrisma();
    return prisma.user.update({ where: { id }, data: { role } });
  },

  async setActive(_tx, id, isActive) {
    const prisma = getPrisma();
    return prisma.user.update({ where: { id }, data: { isActive } });
  },

  async updateFullName(id, fullName) {
    const prisma = getPrisma();
    return prisma.user.update({ where: { id }, data: { fullName } });
  },

  async updatePasswordHash(id, passwordHash) {
    const prisma = getPrisma();
    return prisma.user.update({ where: { id }, data: { passwordHash } });
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return (error as { code?: unknown }).code === "P2002";
}

/**
 * Strip passwordHash before passing to recordAudit — the field must never
 * appear in before/after diffs persisted to the audit log.
 */
function redactUser(user: FullUser | SafeUser): Record<string, unknown> {
  const plain = toAuditPayload(user) ?? {};
  delete plain["passwordHash"];
  return plain;
}

type AuditFn = (entry: AuditEntry) => Promise<void>;

// ---------------------------------------------------------------------------
// listUsers
// ---------------------------------------------------------------------------

export async function listUsers(
  query: ListUsersQuery,
  repository: UsersRepository = defaultRepository,
): Promise<ServiceResult<SafeUser[]>> {
  try {
    const users = await repository.list(query);
    return { ok: true, value: users };
  } catch (error) {
    console.error("[users:list]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

// ---------------------------------------------------------------------------
// createUser
// ---------------------------------------------------------------------------

export async function createUser(
  input: CreateUserInput,
  repository: UsersRepository = defaultRepository,
  hashFn: (password: string) => Promise<string> = hashPassword,
  auditFn: AuditFn = recordAudit,
): Promise<ServiceResult<SafeUser>> {
  try {
    const passwordHash = await hashFn(input.password);
    const created = await repository.create({
      email: input.email,
      fullName: input.fullName,
      role: input.role as UserRole,
      passwordHash,
    });

    const { passwordHash: _ph, ...safe } = created;

    await auditFn({
      action: "CREATE",
      entityType: "User",
      entityId: created.id,
      diff: { after: redactUser(created) },
    });

    return { ok: true, value: safe };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "CONFLICT" };
    }
    console.error("[users:create]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

// ---------------------------------------------------------------------------
// updateUserRole — Serializable tx + self-lockout
// ---------------------------------------------------------------------------

export async function updateUserRole(
  id: string,
  newRole: UserRole,
  actorUserId: string,
  repository: UsersRepository = defaultRepository,
  auditFn: AuditFn = recordAudit,
): Promise<ServiceResult<SafeUser>> {
  try {
    const existing = await repository.getById(id);
    if (!existing) {
      return { ok: false, error: "NOT_FOUND" };
    }

    // Self-lockout: run count + mutate inside one Serializable transaction.
    // The repository's updateRole/countActiveAdmins accept a tx handle.
    // For Prisma: we use $transaction(fn, { isolationLevel: Serializable }).
    // For tests: the repo IS the tx handle (no Prisma involved).
    type TxResult =
      | { ok: false; error: "CONFLICT" }
      | { ok: true; after: FullUser };

    let txResult: TxResult;

    // Detect if we are in a test environment by checking if the repository
    // is not the defaultRepository (injection). For the default repo we use
    // a real Prisma Serializable transaction; for injected repos we call
    // methods directly (the test controls the tx handle).
    if (repository === defaultRepository) {
      const prisma = getPrisma();
      txResult = await prisma.$transaction(
        async (tx) => {
          const txRepo: TxHandle = {
            countActiveAdmins: () =>
              (tx as typeof prisma).user.count({ where: { role: "ADMIN", isActive: true } }),
            updateRole: (_txHandle, _id, role) =>
              (tx as typeof prisma).user.update({ where: { id: _id }, data: { role } }),
            setActive: (_txHandle, _id, isActive) =>
              (tx as typeof prisma).user.update({ where: { id: _id }, data: { isActive } }),
          };

          // Self-lockout check
          if (actorUserId === id && newRole !== "ADMIN" && existing.role === "ADMIN") {
            const count = await txRepo.countActiveAdmins();
            if (count === 1) {
              return { ok: false as const, error: "CONFLICT" as const };
            }
          }

          const after = await txRepo.updateRole(txRepo, id, newRole);
          return { ok: true as const, after };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } else {
      // Injected repository (tests): call directly, treating repo as tx handle
      const txHandle: TxHandle = {
        countActiveAdmins: () => repository.countActiveAdmins(txHandle),
        updateRole: (tx, rid, role) => repository.updateRole(tx, rid, role),
        setActive: (tx, rid, isActive) => repository.setActive(tx, rid, isActive),
      };

      if (actorUserId === id && newRole !== "ADMIN" && existing.role === "ADMIN") {
        const count = await txHandle.countActiveAdmins();
        if (count === 1) {
          txResult = { ok: false, error: "CONFLICT" };
        } else {
          const after = await txHandle.updateRole(txHandle, id, newRole);
          txResult = { ok: true, after };
        }
      } else {
        const after = await txHandle.updateRole(txHandle, id, newRole);
        txResult = { ok: true, after };
      }
    }

    if (!txResult.ok) {
      return { ok: false, error: txResult.error };
    }

    const { passwordHash: _ph, ...safe } = txResult.after;

    await auditFn({
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      diff: {
        before: redactUser(existing),
        after: redactUser(txResult.after),
      },
    });

    return { ok: true, value: safe };
  } catch (error) {
    console.error("[users:updateRole]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

// ---------------------------------------------------------------------------
// setUserActive — Serializable tx + self-lockout
// ---------------------------------------------------------------------------

export async function setUserActive(
  id: string,
  isActive: boolean,
  actorUserId: string,
  repository: UsersRepository = defaultRepository,
  auditFn: AuditFn = recordAudit,
): Promise<ServiceResult<SafeUser>> {
  try {
    const existing = await repository.getById(id);
    if (!existing) {
      return { ok: false, error: "NOT_FOUND" };
    }

    type TxResult =
      | { ok: false; error: "CONFLICT" }
      | { ok: true; after: FullUser };

    let txResult: TxResult;

    if (repository === defaultRepository) {
      const prisma = getPrisma();
      txResult = await prisma.$transaction(
        async (tx) => {
          const txRepo: TxHandle = {
            countActiveAdmins: () =>
              (tx as typeof prisma).user.count({ where: { role: "ADMIN", isActive: true } }),
            updateRole: (_txHandle, _id, role) =>
              (tx as typeof prisma).user.update({ where: { id: _id }, data: { role } }),
            setActive: (_txHandle, _id, ia) =>
              (tx as typeof prisma).user.update({ where: { id: _id }, data: { isActive: ia } }),
          };

          // Self-lockout: only applies when deactivating an ADMIN that is the actor themselves
          if (actorUserId === id && !isActive && existing.role === "ADMIN") {
            const count = await txRepo.countActiveAdmins();
            if (count === 1) {
              return { ok: false as const, error: "CONFLICT" as const };
            }
          }

          const after = await txRepo.setActive(txRepo, id, isActive);
          return { ok: true as const, after };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } else {
      const txHandle: TxHandle = {
        countActiveAdmins: () => repository.countActiveAdmins(txHandle),
        updateRole: (tx, rid, role) => repository.updateRole(tx, rid, role),
        setActive: (tx, rid, ia) => repository.setActive(tx, rid, ia),
      };

      if (actorUserId === id && !isActive && existing.role === "ADMIN") {
        const count = await txHandle.countActiveAdmins();
        if (count === 1) {
          txResult = { ok: false, error: "CONFLICT" };
        } else {
          const after = await txHandle.setActive(txHandle, id, isActive);
          txResult = { ok: true, after };
        }
      } else {
        const after = await txHandle.setActive(txHandle, id, isActive);
        txResult = { ok: true, after };
      }
    }

    if (!txResult.ok) {
      return { ok: false, error: txResult.error };
    }

    const { passwordHash: _ph, ...safe } = txResult.after;

    await auditFn({
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      diff: {
        before: redactUser(existing),
        after: redactUser(txResult.after),
      },
    });

    return { ok: true, value: safe };
  } catch (error) {
    console.error("[users:setActive]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

// ---------------------------------------------------------------------------
// updateUserFullName
// ---------------------------------------------------------------------------

export async function updateUserFullName(
  id: string,
  input: UpdateUserFullNameInput,
  repository: UsersRepository = defaultRepository,
  auditFn: AuditFn = recordAudit,
): Promise<ServiceResult<SafeUser>> {
  try {
    const existing = await repository.getById(id);
    if (!existing) {
      return { ok: false, error: "NOT_FOUND" };
    }

    const updated = await repository.updateFullName(id, input.fullName);
    const { passwordHash: _ph, ...safe } = updated;

    await auditFn({
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      diff: {
        before: { fullName: existing.fullName },
        after: { fullName: updated.fullName },
      },
    });

    return { ok: true, value: safe };
  } catch (error) {
    console.error("[users:updateFullName]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

// ---------------------------------------------------------------------------
// updateUserPassword
// ---------------------------------------------------------------------------

export async function updateUserPassword(
  id: string,
  input: UpdateUserPasswordInput,
  repository: UsersRepository = defaultRepository,
  hashFn: (password: string) => Promise<string> = hashPassword,
  auditFn: AuditFn = recordAudit,
): Promise<ServiceResult<SafeUser>> {
  try {
    const existing = await repository.getById(id);
    if (!existing) {
      return { ok: false, error: "NOT_FOUND" };
    }

    const passwordHash = await hashFn(input.password);
    const updated = await repository.updatePasswordHash(id, passwordHash);
    const { passwordHash: _ph, ...safe } = updated;

    await auditFn({
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      diff: { after: { passwordChanged: true } },
    });

    return { ok: true, value: safe };
  } catch (error) {
    console.error("[users:updatePassword]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

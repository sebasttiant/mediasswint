import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  listUsers,
  createUser,
  updateUserRole,
  setUserActive,
  type UsersRepository,
  type SafeUser,
} from "@/lib/users";
import type { CreateUserInput } from "@/lib/users-input";
import type { AuditEntry } from "@/lib/audit-log";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-01-01T10:00:00.000Z");

type FullUser = SafeUser & { passwordHash: string };

function makeFullUser(overrides: Partial<FullUser> = {}): FullUser {
  return {
    id: "user-1",
    email: "alice@example.com",
    fullName: "Alice Doe",
    role: "STAFF",
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    passwordHash: "hashed-secret",
    ...overrides,
  };
}

function makeSafeUser(overrides: Partial<SafeUser> = {}): SafeUser {
  const { passwordHash: _ph, ...safe } = makeFullUser(overrides as Partial<FullUser>);
  return safe;
}

// ---------------------------------------------------------------------------
// Repository stub factory
// ---------------------------------------------------------------------------

function createRepo(overrides: Partial<UsersRepository> = {}): UsersRepository {
  return {
    list: async () => [makeSafeUser()],
    getById: async () => makeFullUser(),
    create: async () => makeFullUser(),
    countActiveAdmins: async () => 2,
    updateRole: async (_tx, _id, role) => makeFullUser({ role }),
    setActive: async (_tx, _id, isActive) => makeFullUser({ isActive }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Audit spy
// ---------------------------------------------------------------------------

type CapturedAudit = AuditEntry;

function makeAuditSpy(): { calls: CapturedAudit[]; fn: (entry: CapturedAudit) => Promise<void> } {
  const calls: CapturedAudit[] = [];
  return {
    calls,
    fn: async (entry) => {
      calls.push(entry);
    },
  };
}

// ---------------------------------------------------------------------------
// createInput fixture
// ---------------------------------------------------------------------------

const validCreateInput: CreateUserInput = {
  email: "new@test.com",
  fullName: "New User",
  role: "STAFF",
  password: "secure123",
};

// ---------------------------------------------------------------------------
// listUsers
// ---------------------------------------------------------------------------

describe("listUsers", () => {
  it("Scenario 4.1: returns users from stub with no passwordHash", async () => {
    const repo = createRepo({
      list: async () => [makeSafeUser()],
    });

    const result = await listUsers({ q: null, limit: 20 }, repo);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.length, 1);
    assert.equal("passwordHash" in (result.value[0] as object), false);
  });

  it("Scenario 4.2: passes q to repository", async () => {
    let capturedQuery: Parameters<UsersRepository["list"]>[0] | undefined;
    const repo = createRepo({
      list: async (q) => {
        capturedQuery = q;
        return [];
      },
    });

    await listUsers({ q: "alice", limit: 20 }, repo);
    assert.equal(capturedQuery?.q, "alice");
  });

  it("Scenario 4.3: no UserListItem contains passwordHash at runtime", async () => {
    const repo = createRepo({
      list: async () => [makeSafeUser()],
    });

    const result = await listUsers({ q: null, limit: 20 }, repo);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    for (const item of result.value) {
      assert.equal("passwordHash" in item, false, "passwordHash should not be present");
    }
  });
});

// ---------------------------------------------------------------------------
// createUser
// ---------------------------------------------------------------------------

describe("createUser", () => {
  it("Scenario 5.1: success — hashFn called, recordAudit called with CREATE+User, no passwordHash in after", async () => {
    const audit = makeAuditSpy();
    let capturedPasswordHash: string | undefined;

    const repo = createRepo({
      create: async (input) => {
        capturedPasswordHash = input.passwordHash;
        return makeFullUser({ email: input.email, role: input.role, fullName: input.fullName });
      },
    });

    const result = await createUser(
      validCreateInput,
      repo,
      async () => "hash-abc",
      audit.fn,
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(capturedPasswordHash, "hash-abc", "repository should receive hashed password");
    assert.equal(audit.calls.length, 1);
    assert.equal(audit.calls[0]!.action, "CREATE");
    assert.equal(audit.calls[0]!.entityType, "User");
    assert.equal(
      "passwordHash" in (audit.calls[0]!.diff.after ?? {}),
      false,
      "after diff must not contain passwordHash",
    );
  });

  it("Scenario 5.2: P2002 from repository → CONFLICT; recordAudit NOT called", async () => {
    const audit = makeAuditSpy();
    const repo = createRepo({
      create: async () => {
        throw { code: "P2002" };
      },
    });

    const result = await createUser(validCreateInput, repo, async () => "hash-abc", audit.fn);

    assert.deepEqual(result, { ok: false, error: "CONFLICT" });
    assert.equal(audit.calls.length, 0, "recordAudit must not be called on conflict");
  });
});

// ---------------------------------------------------------------------------
// updateUserRole
// ---------------------------------------------------------------------------

describe("updateUserRole", () => {
  it("Scenario 6.1: success — recordAudit called with before.role/after.role, no passwordHash", async () => {
    const audit = makeAuditSpy();
    const repo = createRepo({
      getById: async () => makeFullUser({ role: "STAFF", id: "user-1" }),
      countActiveAdmins: async () => 2,
      updateRole: async (_tx, _id, role) => makeFullUser({ role, id: "user-1" }),
    });

    const result = await updateUserRole("user-1", "ADMIN", "actor-1", repo, audit.fn);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.role, "ADMIN");
    assert.equal(audit.calls.length, 1);
    assert.equal(audit.calls[0]!.action, "UPDATE");
    assert.equal(audit.calls[0]!.entityType, "User");

    const before = audit.calls[0]!.diff.before as Record<string, unknown>;
    const after = audit.calls[0]!.diff.after as Record<string, unknown>;
    assert.equal("passwordHash" in before, false, "before must not contain passwordHash");
    assert.equal("passwordHash" in after, false, "after must not contain passwordHash");
  });

  it("Scenario 6.2: repository returns null → NOT_FOUND; recordAudit NOT called", async () => {
    const audit = makeAuditSpy();
    const repo = createRepo({
      getById: async () => null,
    });

    const result = await updateUserRole("ghost-id", "STAFF", "actor-1", repo, audit.fn);

    assert.deepEqual(result, { ok: false, error: "NOT_FOUND" });
    assert.equal(audit.calls.length, 0);
  });

  it("Scenario 6.3: passwordHash absent from before/after in recordAudit call", async () => {
    const audit = makeAuditSpy();
    const repo = createRepo({
      getById: async () => makeFullUser({ passwordHash: "real-hash-value" }),
      countActiveAdmins: async () => 2,
      updateRole: async (_tx, _id, role) => makeFullUser({ role, passwordHash: "real-hash-value" }),
    });

    await updateUserRole("user-1", "ADMIN", "actor-1", repo, audit.fn);

    const before = audit.calls[0]!.diff.before as Record<string, unknown>;
    const after = audit.calls[0]!.diff.after as Record<string, unknown>;
    assert.equal("passwordHash" in before, false);
    assert.equal("passwordHash" in after, false);
  });
});

// ---------------------------------------------------------------------------
// setUserActive
// ---------------------------------------------------------------------------

describe("setUserActive", () => {
  it("Scenario 7.1: deactivation — recordAudit with before.isActive=true, after.isActive=false", async () => {
    const audit = makeAuditSpy();
    const repo = createRepo({
      getById: async () => makeFullUser({ isActive: true }),
      countActiveAdmins: async () => 2,
      setActive: async (_tx, _id, isActive) => makeFullUser({ isActive }),
    });

    const result = await setUserActive("user-1", false, "actor-1", repo, audit.fn);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.isActive, false);
    assert.equal(audit.calls.length, 1);

    const before = audit.calls[0]!.diff.before as Record<string, unknown>;
    const after = audit.calls[0]!.diff.after as Record<string, unknown>;
    assert.equal(before.isActive, true);
    assert.equal(after.isActive, false);
  });

  it("Scenario 7.2: activation — recordAudit called accordingly", async () => {
    const audit = makeAuditSpy();
    const repo = createRepo({
      getById: async () => makeFullUser({ isActive: false }),
      countActiveAdmins: async () => 2,
      setActive: async (_tx, _id, isActive) => makeFullUser({ isActive }),
    });

    const result = await setUserActive("user-1", true, "actor-1", repo, audit.fn);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.isActive, true);
    assert.equal(audit.calls.length, 1);
  });

  it("Scenario 7.3: passwordHash absent from audit diff", async () => {
    const audit = makeAuditSpy();
    const repo = createRepo({
      getById: async () => makeFullUser({ passwordHash: "real-hash" }),
      countActiveAdmins: async () => 2,
      setActive: async (_tx, _id, isActive) => makeFullUser({ isActive, passwordHash: "real-hash" }),
    });

    await setUserActive("user-1", false, "actor-1", repo, audit.fn);

    const before = audit.calls[0]!.diff.before as Record<string, unknown>;
    const after = audit.calls[0]!.diff.after as Record<string, unknown>;
    assert.equal("passwordHash" in before, false);
    assert.equal("passwordHash" in after, false);
  });
});

// ---------------------------------------------------------------------------
// Self-lockout guard — updateUserRole
// ---------------------------------------------------------------------------

describe("self-lockout via updateUserRole", () => {
  it("Scenario 8.1: last active ADMIN demotes self → CONFLICT; no DB write; no audit", async () => {
    const audit = makeAuditSpy();
    let updateCalled = false;
    const repo = createRepo({
      getById: async () => makeFullUser({ id: "admin-1", role: "ADMIN" }),
      countActiveAdmins: async () => 1,
      updateRole: async () => {
        updateCalled = true;
        return makeFullUser({ role: "STAFF" });
      },
    });

    const result = await updateUserRole("admin-1", "STAFF", "admin-1", repo, audit.fn);

    assert.deepEqual(result, { ok: false, error: "CONFLICT" });
    assert.equal(updateCalled, false, "DB write must not happen");
    assert.equal(audit.calls.length, 0, "recordAudit must not be called");
  });

  it("Scenario 8.3: two active ADMINs — first admin can demote self; mutation committed; audit called", async () => {
    const audit = makeAuditSpy();
    const repo = createRepo({
      getById: async () => makeFullUser({ id: "admin-1", role: "ADMIN" }),
      countActiveAdmins: async () => 2,
      updateRole: async (_tx, _id, role) => makeFullUser({ id: "admin-1", role }),
    });

    const result = await updateUserRole("admin-1", "STAFF", "admin-1", repo, audit.fn);

    assert.equal(result.ok, true);
    assert.equal(audit.calls.length, 1);
  });
});

// ---------------------------------------------------------------------------
// Self-lockout guard — setUserActive
// ---------------------------------------------------------------------------

describe("self-lockout via setUserActive", () => {
  it("Scenario 8.2: last active ADMIN deactivates self → CONFLICT; no DB write; no audit", async () => {
    const audit = makeAuditSpy();
    let activateCalled = false;
    const repo = createRepo({
      getById: async () => makeFullUser({ id: "admin-1", role: "ADMIN", isActive: true }),
      countActiveAdmins: async () => 1,
      setActive: async () => {
        activateCalled = true;
        return makeFullUser({ isActive: false });
      },
    });

    const result = await setUserActive("admin-1", false, "admin-1", repo, audit.fn);

    assert.deepEqual(result, { ok: false, error: "CONFLICT" });
    assert.equal(activateCalled, false, "DB write must not happen");
    assert.equal(audit.calls.length, 0);
  });

  it("Scenario 8.4: admin deactivates a STAFF user — no lockout error; success", async () => {
    const audit = makeAuditSpy();
    const repo = createRepo({
      getById: async () => makeFullUser({ id: "staff-1", role: "STAFF", isActive: true }),
      countActiveAdmins: async () => 1,
      setActive: async (_tx, _id, isActive) => makeFullUser({ id: "staff-1", isActive }),
    });

    const result = await setUserActive("staff-1", false, "admin-1", repo, audit.fn);

    assert.equal(result.ok, true);
    assert.equal(audit.calls.length, 1);
  });
});

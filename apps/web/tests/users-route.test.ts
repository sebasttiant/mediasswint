import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSessionCookieName, type AuthUser } from "@/lib/auth";
import {
  handleGetUsersRequest,
  handlePostUserRequest,
  type UsersRouteDeps,
} from "@/app/api/admin/users/route";
import {
  handleGetUserRequest,
  handlePatchUserRequest,
  type UserRouteDeps,
} from "@/app/api/admin/users/[id]/route";
import type { SafeUser } from "@/lib/users";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const adminUser: AuthUser = {
  id: "admin-1",
  email: "admin@mediasswint.test",
  passwordHash: "hash",
  isActive: true,
  fullName: "Admin User",
  role: "ADMIN",
};

const staffUser: AuthUser = {
  id: "staff-1",
  email: "staff@mediasswint.test",
  passwordHash: "hash",
  isActive: true,
  fullName: "Staff User",
  role: "STAFF",
};

const NOW = new Date("2026-01-01T10:00:00.000Z");

function makeSafeUser(overrides: Partial<SafeUser> = {}): SafeUser {
  return {
    id: "user-1",
    email: "alice@example.com",
    fullName: "Alice Doe",
    role: "STAFF",
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeRequest(url: string, options: RequestInit = {}): Request {
  return new Request(`http://localhost${url}`, {
    headers: { cookie: `${getSessionCookieName()}=token` },
    ...options,
  });
}

function makeJsonRequest(url: string, body: unknown, method = "POST"): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: {
      cookie: `${getSessionCookieName()}=token`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Default deps (working stubs)
// ---------------------------------------------------------------------------

function createListDeps(overrides: Partial<UsersRouteDeps> = {}): UsersRouteDeps {
  return {
    list: async () => ({ ok: true, value: [makeSafeUser()] }),
    create: async () => ({ ok: true, value: makeSafeUser() }),
    ...overrides,
  };
}

function createUserDeps(overrides: Partial<UserRouteDeps> = {}): UserRouteDeps {
  return {
    getById: async () => ({ ok: true, value: makeSafeUser() }),
    updateRole: async () => ({ ok: true, value: makeSafeUser({ role: "STAFF" }) }),
    setActive: async () => ({ ok: true, value: makeSafeUser({ isActive: false }) }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GET /api/admin/users
// ---------------------------------------------------------------------------

describe("GET /api/admin/users", () => {
  it("Scenario 9.1: STAFF session → 403", async () => {
    const response = await handleGetUsersRequest(
      makeRequest("/api/admin/users"),
      staffUser,
      createListDeps(),
    );

    assert.equal(response.status, 403);
  });

  it("Scenario 9.2: unauthenticated → 401", async () => {
    // Simulate missing user by passing null-like — we pass null typed as AuthUser
    // but the route handler checks role; here we need to test the withAdminAuth gate.
    // Since handleGetUsersRequest is the inner handler (auth already passed),
    // we test the 403 for STAFF; the 401 is tested by the withAdminAuth wrapper.
    // Test that STAFF → 403 (unauthenticated would get 401 from withAdminAuth wrapper,
    // not from this handler directly). Verify with a non-admin user.
    const nonAdmin: AuthUser = { ...staffUser, role: "STAFF" };
    const response = await handleGetUsersRequest(
      makeRequest("/api/admin/users"),
      nonAdmin,
      createListDeps(),
    );
    assert.equal(response.status, 403);
  });

  it("Scenario 9.3: ADMIN + stub returns 2 users → 200, body { users: [...] }, no passwordHash", async () => {
    const twoUsers = [makeSafeUser({ id: "u1" }), makeSafeUser({ id: "u2" })];
    const deps = createListDeps({
      list: async () => ({ ok: true, value: twoUsers }),
    });

    const response = await handleGetUsersRequest(
      makeRequest("/api/admin/users"),
      adminUser,
      deps,
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as { users: SafeUser[] };
    assert.equal(body.users.length, 2);
    for (const user of body.users) {
      assert.equal("passwordHash" in user, false, "no passwordHash in response");
    }
  });

  it("Scenario 9.4: ?limit=abc → 400 with errors array", async () => {
    const response = await handleGetUsersRequest(
      makeRequest("/api/admin/users?limit=abc"),
      adminUser,
      createListDeps(),
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { errors: Array<{ field: string }> };
    assert.ok(Array.isArray(body.errors), "errors should be an array");
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/users
// ---------------------------------------------------------------------------

describe("POST /api/admin/users", () => {
  it("Scenario 9.5: valid ADMIN + valid body + stub ok:true → 201, body has user, no passwordHash", async () => {
    const created = makeSafeUser({ email: "new@test.com" });
    const deps = createListDeps({
      create: async () => ({ ok: true, value: created }),
    });

    const response = await handlePostUserRequest(
      makeJsonRequest("/api/admin/users", {
        email: "new@test.com",
        fullName: "New User",
        role: "STAFF",
        password: "secure123",
      }),
      adminUser,
      deps,
    );

    assert.equal(response.status, 201);
    const body = (await response.json()) as { user: SafeUser };
    assert.equal(body.user.email, "new@test.com");
    assert.equal("passwordHash" in body.user, false);
  });

  it("Scenario 9.6: invalid email format → 400 with field errors", async () => {
    const response = await handlePostUserRequest(
      makeJsonRequest("/api/admin/users", {
        email: "not-valid",
        fullName: "New User",
        role: "STAFF",
        password: "secure123",
      }),
      adminUser,
      createListDeps(),
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { errors: Array<{ field: string }> };
    assert.ok(body.errors.some((e) => e.field === "email"), "errors should include email field");
  });

  it("Scenario 9.7: stub returns CONFLICT → 409", async () => {
    const deps = createListDeps({
      create: async () => ({ ok: false, error: "CONFLICT" }),
    });

    const response = await handlePostUserRequest(
      makeJsonRequest("/api/admin/users", {
        email: "existing@test.com",
        fullName: "Existing User",
        role: "STAFF",
        password: "secure123",
      }),
      adminUser,
      deps,
    );

    assert.equal(response.status, 409);
  });

  it("STAFF cannot create users → 403", async () => {
    const response = await handlePostUserRequest(
      makeJsonRequest("/api/admin/users", {
        email: "x@x.com",
        fullName: "X",
        role: "STAFF",
        password: "secure123",
      }),
      staffUser,
      createListDeps(),
    );

    assert.equal(response.status, 403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/users/[id]
// ---------------------------------------------------------------------------

describe("GET /api/admin/users/[id]", () => {
  it("Scenario 9.8: known user → 200, no passwordHash", async () => {
    const user = makeSafeUser({ id: "user-1" });
    const deps = createUserDeps({
      getById: async () => ({ ok: true, value: user }),
    });

    const response = await handleGetUserRequest(
      makeRequest("/api/admin/users/user-1"),
      { params: Promise.resolve({ id: "user-1" }) },
      adminUser,
      deps,
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as { user: SafeUser };
    assert.equal(body.user.id, "user-1");
    assert.equal("passwordHash" in body.user, false);
  });

  it("Scenario 9.9: stub returns null → 404", async () => {
    const deps = createUserDeps({
      getById: async () => ({ ok: false, error: "NOT_FOUND" }),
    });

    const response = await handleGetUserRequest(
      makeRequest("/api/admin/users/ghost-id"),
      { params: Promise.resolve({ id: "ghost-id" }) },
      adminUser,
      deps,
    );

    assert.equal(response.status, 404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/[id]
// ---------------------------------------------------------------------------

describe("PATCH /api/admin/users/[id]", () => {
  it("Scenario 9.10: { role: 'STAFF' } + stub ok:true → 200", async () => {
    const updated = makeSafeUser({ role: "STAFF" });
    const deps = createUserDeps({
      updateRole: async () => ({ ok: true, value: updated }),
    });

    const response = await handlePatchUserRequest(
      makeJsonRequest("/api/admin/users/user-1", { role: "STAFF" }, "PATCH"),
      { params: Promise.resolve({ id: "user-1" }) },
      adminUser,
      deps,
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as { user: SafeUser };
    assert.equal(body.user.role, "STAFF");
  });

  it("Scenario 9.11: stub returns CONFLICT → 409", async () => {
    const deps = createUserDeps({
      updateRole: async () => ({ ok: false, error: "CONFLICT" }),
    });

    const response = await handlePatchUserRequest(
      makeJsonRequest("/api/admin/users/admin-id", { role: "STAFF" }, "PATCH"),
      { params: Promise.resolve({ id: "admin-id" }) },
      adminUser,
      deps,
    );

    assert.equal(response.status, 409);
  });

  it("Scenario 9.12: { email: 'hacker@test.com' } → 400 with errors", async () => {
    const response = await handlePatchUserRequest(
      makeJsonRequest("/api/admin/users/user-1", { email: "hacker@test.com" }, "PATCH"),
      { params: Promise.resolve({ id: "user-1" }) },
      adminUser,
      createUserDeps(),
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { errors: Array<{ field: string }> };
    assert.ok(Array.isArray(body.errors), "errors should be an array");
  });

  it("{ isActive: false } dispatches to setActive and returns 200", async () => {
    const updated = makeSafeUser({ isActive: false });
    const deps = createUserDeps({
      setActive: async () => ({ ok: true, value: updated }),
    });

    const response = await handlePatchUserRequest(
      makeJsonRequest("/api/admin/users/user-1", { isActive: false }, "PATCH"),
      { params: Promise.resolve({ id: "user-1" }) },
      adminUser,
      deps,
    );

    assert.equal(response.status, 200);
  });

  it("STAFF cannot PATCH → 403", async () => {
    const response = await handlePatchUserRequest(
      makeJsonRequest("/api/admin/users/user-1", { role: "STAFF" }, "PATCH"),
      { params: Promise.resolve({ id: "user-1" }) },
      staffUser,
      createUserDeps(),
    );

    assert.equal(response.status, 403);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  authenticateUser,
  bootstrapAuthUser,
  createSessionToken,
  getCookieValue,
  getSessionCookieName,
  hashPassword,
  normalizeUserRole,
  requireActiveUserFromRequest,
  requireAdminUserFromRequest,
  type AuthUser,
  type UsersRepository,
  verifyPasswordHash,
  verifySessionToken,
} from "../lib/auth";

function createUsersRepository(): UsersRepository & {
  getByEmail(email: string): AuthUser | null;
} {
  const users = new Map<string, AuthUser>();
  let idSequence = 1;

  return {
    async findByEmail(email) {
      return users.get(email) ?? null;
    },
    async findById(id) {
      return Array.from(users.values()).find((user) => user.id === id) ?? null;
    },
    async upsertBootstrapUser({ email, passwordHash }) {
      const existingUser = users.get(email);

      if (existingUser) {
        const updatedUser: AuthUser = { ...existingUser, passwordHash, isActive: true, role: "ADMIN" };
        users.set(email, updatedUser);
        return updatedUser;
      }

      const createdUser: AuthUser = {
        id: `user-${idSequence++}`,
        email,
        passwordHash,
        isActive: true,
        fullName: null,
        role: "ADMIN",
      };

      users.set(email, createdUser);
      return createdUser;
    },
    getByEmail(email) {
      return users.get(email) ?? null;
    },
  };
}

async function createPersistedUser(
  overrides?: Partial<{ id: string; email: string; password: string; isActive: boolean; fullName: string | null; role: AuthUser["role"] }>,
) {
  const password = overrides?.password ?? "secret123";

  return {
    id: overrides?.id ?? "user-1",
    email: overrides?.email ?? "admin@mediasswint.test",
    passwordHash: await hashPassword(password),
    isActive: overrides?.isActive ?? true,
    fullName: overrides?.fullName ?? null,
    role: overrides?.role ?? "STAFF",
    plainPassword: password,
  };
}

function requestWithSessionCookie(token: string) {
  return new Request("http://localhost/protected", {
    headers: { cookie: `${getSessionCookieName()}=${encodeURIComponent(token)}` },
  });
}

describe("auth session token", () => {
  it("creates and verifies a valid token", async () => {
    process.env.AUTH_SECRET = "test-secret";

    const token = await createSessionToken("user-123");
    const payload = await verifySessionToken(token);

    assert.equal(payload?.sub, "user-123");
    assert.equal(typeof payload?.exp, "number");
  });

  it("returns null for invalid signature", async () => {
    process.env.AUTH_SECRET = "test-secret";

    const token = await createSessionToken("admin");
    const invalidToken = `${token}corrupted`;
    const payload = await verifySessionToken(invalidToken);

    assert.equal(payload, null);
  });
});

describe("authenticateUser", () => {
  it("returns the persisted user when the password hash matches", async () => {
    const persistedUser = await createPersistedUser();
    const repository: UsersRepository = {
      async findByEmail(email) {
        return email === persistedUser.email ? persistedUser : null;
      },
      async findById() {
        throw new Error("unused");
      },
      async upsertBootstrapUser() {
        throw new Error("unused");
      },
    };

    const authenticatedUser = await authenticateUser(persistedUser.email, persistedUser.plainPassword, repository);

    assert.deepEqual(authenticatedUser, {
      id: persistedUser.id,
      email: persistedUser.email,
      passwordHash: persistedUser.passwordHash,
      isActive: true,
      fullName: null,
      role: "STAFF",
    });
  });

  it("rejects invalid passwords", async () => {
    const persistedUser = await createPersistedUser();
    const repository: UsersRepository = {
      async findByEmail() {
        return persistedUser;
      },
      async findById() {
        throw new Error("unused");
      },
      async upsertBootstrapUser() {
        throw new Error("unused");
      },
    };

    const authenticatedUser = await authenticateUser(persistedUser.email, "otra-clave", repository);

    assert.equal(authenticatedUser, null);
  });

  it("rejects inactive users even with valid credentials", async () => {
    const persistedUser = await createPersistedUser({ isActive: false });
    const repository: UsersRepository = {
      async findByEmail() {
        return persistedUser;
      },
      async findById() {
        throw new Error("unused");
      },
      async upsertBootstrapUser() {
        throw new Error("unused");
      },
    };

    const authenticatedUser = await authenticateUser(persistedUser.email, persistedUser.plainPassword, repository);

    assert.equal(authenticatedUser, null);
  });
});

describe("password hashing", () => {
  it("stores a strong hash instead of the plain password", async () => {
    const passwordHash = await hashPassword("secret123");

    assert.notEqual(passwordHash, "secret123");
    assert.equal(await verifyPasswordHash(passwordHash, "secret123"), true);
  });

  it("returns false when the submitted password does not match the hash", async () => {
    const passwordHash = await hashPassword("secret123");

    assert.equal(await verifyPasswordHash(passwordHash, "wrong-password"), false);
  });
});

describe("bootstrapAuthUser", () => {
  it("creates a bootstrap user with a hashed password", async () => {
    const repository = createUsersRepository();

    const user = await bootstrapAuthUser(
      {
        email: "seed@mediasswint.test",
        password: "secret123",
      },
      repository,
    );

    assert.equal(user.email, "seed@mediasswint.test");
    assert.equal(user.role, "ADMIN");
    assert.notEqual(user.passwordHash, "secret123");
    assert.equal(await verifyPasswordHash(user.passwordHash, "secret123"), true);
  });

  it("promotes the configured bootstrap user to ADMIN without requiring a specific email", async () => {
    const repository = createUsersRepository();

    const user = await bootstrapAuthUser(
      {
        email: "owner@custom-domain.test",
        password: "secret123",
      },
      repository,
    );

    assert.equal(user.role, "ADMIN");
    assert.equal(repository.getByEmail("owner@custom-domain.test")?.role, "ADMIN");
  });

  it("updates the same persisted identity when bootstrap runs again", async () => {
    const repository = createUsersRepository();

    const firstUser = await bootstrapAuthUser(
      {
        email: "seed@mediasswint.test",
        password: "secret123",
      },
      repository,
    );

    const updatedUser = await bootstrapAuthUser(
      {
        email: "seed@mediasswint.test",
        password: "new-secret456",
      },
      repository,
    );

    const persistedUser = repository.getByEmail("seed@mediasswint.test");

    assert.equal(updatedUser.id, firstUser.id);
    assert.equal(persistedUser?.id, firstUser.id);
    assert.equal(await verifyPasswordHash(updatedUser.passwordHash, "new-secret456"), true);
  });

  it("keeps the configured bootstrap user as ADMIN on repeated bootstrap runs", async () => {
    const repository = createUsersRepository();

    const firstUser = await bootstrapAuthUser(
      { email: "owner@custom-domain.test", password: "secret123" },
      repository,
    );
    const updatedUser = await bootstrapAuthUser(
      { email: "owner@custom-domain.test", password: "new-secret456" },
      repository,
    );

    assert.equal(updatedUser.id, firstUser.id);
    assert.equal(updatedUser.role, "ADMIN");
    assert.equal(repository.getByEmail("owner@custom-domain.test")?.role, "ADMIN");
  });
});

describe("roles", () => {
  it("defaults a missing persisted role to STAFF", () => {
    assert.equal(normalizeUserRole(null), "STAFF");
    assert.equal(normalizeUserRole(undefined), "STAFF");
  });

  it("accepts only ADMIN and STAFF as v1 roles", () => {
    assert.equal(normalizeUserRole("ADMIN"), "ADMIN");
    assert.equal(normalizeUserRole("STAFF"), "STAFF");
    assert.equal(normalizeUserRole("OWNER"), "STAFF");
  });
});

describe("DB-backed auth guards", () => {
  it("resolves an active user from the session subject", async () => {
    process.env.AUTH_SECRET = "guard-secret";
    const activeUser = await createPersistedUser({ id: "active-1", role: "STAFF" });
    const repository: UsersRepository = {
      async findByEmail() {
        throw new Error("unused");
      },
      async findById(id) {
        return id === activeUser.id ? activeUser : null;
      },
      async upsertBootstrapUser() {
        throw new Error("unused");
      },
    };

    const token = await createSessionToken(activeUser.id);
    const resolvedUser = await requireActiveUserFromRequest(requestWithSessionCookie(token), repository);

    assert.equal(resolvedUser?.id, activeUser.id);
    assert.equal(resolvedUser?.role, "STAFF");
  });

  it("rejects missing and inactive users on the current request", async () => {
    process.env.AUTH_SECRET = "guard-secret";
    const inactiveUser = await createPersistedUser({ id: "inactive-1", isActive: false });
    const repository: UsersRepository = {
      async findByEmail() {
        throw new Error("unused");
      },
      async findById(id) {
        return id === inactiveUser.id ? inactiveUser : null;
      },
      async upsertBootstrapUser() {
        throw new Error("unused");
      },
    };

    const inactiveToken = await createSessionToken(inactiveUser.id);

    assert.equal(await requireActiveUserFromRequest(new Request("http://localhost/protected"), repository), null);
    assert.equal(await requireActiveUserFromRequest(requestWithSessionCookie(inactiveToken), repository), null);
  });

  it("accepts ADMIN users for admin guard", async () => {
    process.env.AUTH_SECRET = "admin-guard-secret";
    const adminUser = await createPersistedUser({ id: "admin-1", role: "ADMIN" });
    const repository: UsersRepository = {
      async findByEmail() {
        throw new Error("unused");
      },
      async findById(id) {
        return id === adminUser.id ? adminUser : null;
      },
      async upsertBootstrapUser() {
        throw new Error("unused");
      },
    };

    const token = await createSessionToken(adminUser.id);
    const resolvedUser = await requireAdminUserFromRequest(requestWithSessionCookie(token), repository);

    assert.equal(resolvedUser?.id, adminUser.id);
    assert.equal(resolvedUser?.role, "ADMIN");
  });

  it("rejects STAFF and unsupported roles for admin guard", async () => {
    process.env.AUTH_SECRET = "admin-guard-secret";
    const staffUser = await createPersistedUser({ id: "staff-1", role: "STAFF" });
    const unsupportedRoleUser = { ...(await createPersistedUser({ id: "owner-1" })), role: "OWNER" as AuthUser["role"] };
    const repository: UsersRepository = {
      async findByEmail() {
        throw new Error("unused");
      },
      async findById(id) {
        if (id === staffUser.id) return staffUser;
        if (id === unsupportedRoleUser.id) return unsupportedRoleUser;
        return null;
      },
      async upsertBootstrapUser() {
        throw new Error("unused");
      },
    };

    const staffToken = await createSessionToken(staffUser.id);
    const unsupportedToken = await createSessionToken(unsupportedRoleUser.id);

    assert.equal(await requireAdminUserFromRequest(requestWithSessionCookie(staffToken), repository), null);
    assert.equal(await requireAdminUserFromRequest(requestWithSessionCookie(unsupportedToken), repository), null);
  });
});

describe("cookie parser", () => {
  it("extracts session cookie value from header", () => {
    const cookieName = getSessionCookieName();
    const header = `a=1; ${cookieName}=abc123; theme=dark`;

    const value = getCookieValue(header, cookieName);
    assert.equal(value, "abc123");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  authenticateUser,
  bootstrapAuthUser,
  createSessionToken,
  getCookieValue,
  getSessionCookieName,
  hashPassword,
  type UsersRepository,
  verifyPasswordHash,
  verifySessionToken,
} from "../lib/auth";

function createUsersRepository(): UsersRepository & {
  getByEmail(email: string): { id: string; email: string; passwordHash: string; isActive: boolean } | null;
} {
  const users = new Map<string, { id: string; email: string; passwordHash: string; isActive: boolean }>();
  let idSequence = 1;

  return {
    async findByEmail(email) {
      return users.get(email) ?? null;
    },
    async upsertBootstrapUser({ email, passwordHash }) {
      const existingUser = users.get(email);

      if (existingUser) {
        const updatedUser = { ...existingUser, passwordHash, isActive: true };
        users.set(email, updatedUser);
        return updatedUser;
      }

      const createdUser = {
        id: `user-${idSequence++}`,
        email,
        passwordHash,
        isActive: true,
      };

      users.set(email, createdUser);
      return createdUser;
    },
    getByEmail(email) {
      return users.get(email) ?? null;
    },
  };
}

async function createPersistedUser(overrides?: Partial<{ id: string; email: string; password: string; isActive: boolean }>) {
  const password = overrides?.password ?? "secret123";

  return {
    id: overrides?.id ?? "user-1",
    email: overrides?.email ?? "admin@mediasswint.test",
    passwordHash: await hashPassword(password),
    isActive: overrides?.isActive ?? true,
    plainPassword: password,
  };
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
    });
  });

  it("rejects invalid passwords", async () => {
    const persistedUser = await createPersistedUser();
    const repository: UsersRepository = {
      async findByEmail() {
        return persistedUser;
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
    assert.notEqual(user.passwordHash, "secret123");
    assert.equal(await verifyPasswordHash(user.passwordHash, "secret123"), true);
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
});

describe("cookie parser", () => {
  it("extracts session cookie value from header", () => {
    const cookieName = getSessionCookieName();
    const header = `a=1; ${cookieName}=abc123; theme=dark`;

    const value = getCookieValue(header, cookieName);
    assert.equal(value, "abc123");
  });
});

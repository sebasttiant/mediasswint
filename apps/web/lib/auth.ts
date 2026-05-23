import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

import { getPrisma } from "@/lib/prisma";

import {
  getCookieValue,
  getSessionCookieName,
  normalizeUserRole,
  verifySessionToken,
  type UserRole,
} from "@/lib/auth-edge";

export {
  createSessionToken,
  getAuthSecret,
  getCookieValue,
  getSessionCookieName,
  getSessionDurationSeconds,
  normalizeUserRole,
  verifySessionToken,
} from "@/lib/auth-edge";

export type { SessionPayload, UserRole } from "@/lib/auth-edge";

export type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  fullName: string | null;
  role: UserRole;
};

export type UsersRepository = {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  upsertBootstrapUser(input: { email: string; passwordHash: string }): Promise<AuthUser>;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toAuthUser(user: AuthUser | (Omit<AuthUser, "fullName" | "role"> & { fullName?: string | null; role?: unknown })): AuthUser {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    isActive: user.isActive,
    fullName: user.fullName ?? null,
    role: normalizeUserRole(user.role),
  };
}

export async function hashPassword(password: string) {
  return argon2Hash(password);
}

export async function verifyPasswordHash(passwordHash: string, password: string) {
  try {
    return await argon2Verify(passwordHash, password);
  } catch {
    return false;
  }
}

const defaultUsersRepository: UsersRepository = {
  async findByEmail(email) {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    return user ? toAuthUser(user) : null;
  },
  async findById(id) {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? toAuthUser(user) : null;
  },
  async upsertBootstrapUser({ email, passwordHash }) {
    const prisma = getPrisma();
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true, role: "ADMIN" },
      create: { email, passwordHash, role: "ADMIN" },
    });
    return toAuthUser(user);
  },
};

export function getDefaultUsersRepository(): UsersRepository {
  return defaultUsersRepository;
}

export async function authenticateUser(
  user: string,
  password: string,
  repository: UsersRepository = defaultUsersRepository,
): Promise<AuthUser | null> {
  const email = normalizeEmail(user);
  if (!email || !password) return null;

  let persisted: AuthUser | null;
  try {
    persisted = await repository.findByEmail(email);
  } catch (error) {
    console.error("[auth:findByEmail]", error);
    return null;
  }

  if (!persisted || !persisted.isActive) return null;

  let isValid: boolean;
  try {
    isValid = await verifyPasswordHash(persisted.passwordHash, password);
  } catch (error) {
    console.error("[auth:verify]", error);
    return null;
  }

  if (!isValid) return null;

  return toAuthUser(persisted);
}

export async function bootstrapAuthUser(
  input: { email: string; password: string },
  repository: UsersRepository = defaultUsersRepository,
): Promise<AuthUser> {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error("bootstrap requires a non-empty email");
  }
  if (!input.password) {
    throw new Error("bootstrap requires a non-empty password");
  }

  const passwordHash = await hashPassword(input.password);
  const persisted = await repository.upsertBootstrapUser({ email, passwordHash });
  return toAuthUser(persisted);
}

export async function requireActiveUserFromRequest(
  request: Request,
  repository: UsersRepository = defaultUsersRepository,
): Promise<AuthUser | null> {
  const sessionCookie = getCookieValue(request.headers.get("cookie"), getSessionCookieName());
  const session = await verifySessionToken(sessionCookie);

  if (!session) return null;

  try {
    const user = await repository.findById(session.sub);
    if (!user?.isActive) return null;

    return toAuthUser(user);
  } catch (error) {
    console.error("[auth:findById]", error);
    return null;
  }
}

export async function requireAdminUserFromRequest(
  request: Request,
  repository: UsersRepository = defaultUsersRepository,
): Promise<AuthUser | null> {
  const user = await requireActiveUserFromRequest(request, repository);

  return user?.role === "ADMIN" ? user : null;
}

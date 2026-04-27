import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

import { getPrisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "mediasswint_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  sub: string;
  exp: number;
};

export type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
};

export type UsersRepository = {
  findByEmail(email: string): Promise<AuthUser | null>;
  upsertBootstrapUser(input: { email: string; passwordHash: string }): Promise<AuthUser>;
};

function getAuthSecret() {
  return process.env.AUTH_SECRET?.trim() || "mediasswint-dev-secret";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toAuthUser(user: AuthUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    isActive: user.isActive,
  };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toBase64Url(value: Uint8Array) {
  return bytesToBase64(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  return base64ToBytes(base64 + padding);
}

async function sign(value: string) {
  const keyData = new TextEncoder().encode(getAuthSecret());
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(subject: string) {
  const payload: SessionPayload = {
    sub: subject,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };

  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string | null | undefined) {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await sign(encodedPayload);
  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload))) as SessionPayload;

    if (!payload.sub || typeof payload.exp !== "number") {
      return null;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
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
  async upsertBootstrapUser({ email, passwordHash }) {
    const prisma = getPrisma();
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true },
      create: { email, passwordHash },
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

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getSessionDurationSeconds() {
  return SESSION_DURATION_SECONDS;
}

export function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey !== name) continue;
    return decodeURIComponent(rawValue.join("="));
  }

  return null;
}

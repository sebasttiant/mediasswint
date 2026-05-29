import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import { withAdminAuth } from "@/lib/with-auth";
import type { AuthUser } from "@/lib/auth";
import { parseUpdateUserPatchInput } from "@/lib/users-input";
import { updateUserRole, setUserActive } from "@/lib/users";
import type { SafeUser, UsersRepository } from "@/lib/users";
import { getPrisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

export type UserRouteDeps = {
  getById(id: string): Promise<{ ok: true; value: SafeUser } | { ok: false; error: string }>;
  updateRole(id: string, role: UserRole, actorUserId: string): ReturnType<typeof updateUserRole>;
  setActive(id: string, isActive: boolean, actorUserId: string): ReturnType<typeof setUserActive>;
};

// ---------------------------------------------------------------------------
// Default Prisma-backed repository for getById
// ---------------------------------------------------------------------------

type FullUser = SafeUser & { passwordHash: string };

const defaultPrismaGetById: UsersRepository["getById"] = async (id) => {
  const prisma = getPrisma();
  return prisma.user.findUnique({ where: { id } });
};

const defaultDeps: UserRouteDeps = {
  async getById(id) {
    const user = await defaultPrismaGetById(id);
    if (!user) return { ok: false, error: "NOT_FOUND" };
    const { passwordHash: _ph, ...safe } = user as FullUser;
    return { ok: true, value: safe };
  },
  updateRole: updateUserRole,
  setActive: setUserActive,
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleGetUserRequest(
  request: Request,
  { params }: Params,
  user: AuthUser,
  deps: UserRouteDeps = defaultDeps,
): Promise<Response> {
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const result = await deps.getById(id);
  if (!result.ok) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: result.value }, { status: 200 });
}

export async function handlePatchUserRequest(
  request: Request,
  { params }: Params,
  user: AuthUser,
  deps: UserRouteDeps = defaultDeps,
): Promise<Response> {
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      { errors: [{ field: "body", message: "invalid JSON body" }] },
      { status: 400 },
    );
  }

  const parsed = parseUpdateUserPatchInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  const patch = parsed.value;

  // Dispatch to the appropriate service function
  if (patch.role !== undefined) {
    const result = await deps.updateRole(id, patch.role as UserRole, user.id);
    return mapServiceResult(result);
  }

  if (patch.isActive !== undefined) {
    const result = await deps.setActive(id, patch.isActive, user.id);
    return mapServiceResult(result);
  }

  // Should not reach here — parseUpdateUserPatchInput guarantees at least one field
  return NextResponse.json(
    { errors: [{ field: "body", message: "must include at least one of: role, isActive" }] },
    { status: 400 },
  );
}

function mapServiceResult(
  result: { ok: true; value: SafeUser } | { ok: false; error: string },
): Response {
  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (result.error === "CONFLICT") {
      return NextResponse.json({ error: "Self-lockout: cannot remove last admin" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ user: result.value }, { status: 200 });
}

// ---------------------------------------------------------------------------
// Route exports (wrapped with withAdminAuth for 401/403 gating)
// ---------------------------------------------------------------------------

export const GET = withAdminAuth<Params>(async (request, ctx, { user }) =>
  handleGetUserRequest(request, ctx, user),
);

export const PATCH = withAdminAuth<Params>(async (request, ctx, { user }) =>
  handlePatchUserRequest(request, ctx, user),
);

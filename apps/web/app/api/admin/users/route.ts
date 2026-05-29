import { NextResponse } from "next/server";

import { withAdminAuth } from "@/lib/with-auth";
import type { AuthUser } from "@/lib/auth";
import { parseCreateUserInput, parseListUsersQuery } from "@/lib/users-input";
import { listUsers, createUser } from "@/lib/users";
import type { SafeUser } from "@/lib/users";

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

export type UsersRouteDeps = {
  list: typeof listUsers;
  create: typeof createUser;
};

const defaultDeps: UsersRouteDeps = {
  list: listUsers,
  create: createUser,
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleGetUsersRequest(
  request: Request,
  user: AuthUser,
  deps: UsersRouteDeps = defaultDeps,
): Promise<Response> {
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const parsedQuery = parseListUsersQuery(searchParams);
  if (!parsedQuery.ok) {
    return NextResponse.json({ errors: parsedQuery.errors }, { status: 400 });
  }

  const result = await deps.list(parsedQuery.value);
  if (!result.ok) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const users: SafeUser[] = result.value;
  return NextResponse.json({ users }, { status: 200 });
}

export async function handlePostUserRequest(
  request: Request,
  user: AuthUser,
  deps: UsersRouteDeps = defaultDeps,
): Promise<Response> {
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      { errors: [{ field: "body", message: "invalid JSON body" }] },
      { status: 400 },
    );
  }

  const parsed = parseCreateUserInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  const result = await deps.create(parsed.value);
  if (!result.ok) {
    if (result.error === "CONFLICT") {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ user: result.value }, { status: 201 });
}

// ---------------------------------------------------------------------------
// Route exports (wrapped with withAdminAuth for 401/403 gating)
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (request, _ctx, { user }) =>
  handleGetUsersRequest(request, user),
);

export const POST = withAdminAuth(async (request, _ctx, { user }) =>
  handlePostUserRequest(request, user),
);

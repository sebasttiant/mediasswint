import { NextResponse } from "next/server";

import { requireActiveUserFromRequest, type AuthUser } from "@/lib/auth";

export type EmptyRouteCtx = { params: Promise<Record<string, never>> };

export type AuthedHandler<Ctx = EmptyRouteCtx> = (
  request: Request,
  context: Ctx,
  deps: { user: AuthUser },
) => Promise<Response> | Response;

export type WithAuthOptions = {
  requireUser?: (request: Request) => Promise<AuthUser | null>;
};

export function withAuth<Ctx = EmptyRouteCtx>(
  handler: AuthedHandler<Ctx>,
  options: WithAuthOptions = {},
): (request: Request, context: Ctx) => Promise<Response> {
  const requireUser = options.requireUser ?? requireActiveUserFromRequest;

  return async (request, context) => {
    const user = await requireUser(request);

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    return handler(request, context, { user });
  };
}

export function withAdminAuth<Ctx = EmptyRouteCtx>(
  handler: AuthedHandler<Ctx>,
  options: WithAuthOptions = {},
): (request: Request, context: Ctx) => Promise<Response> {
  return withAuth<Ctx>(
    async (request, context, { user }) => {
      if (user.role !== "ADMIN") {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }

      return handler(request, context, { user });
    },
    options,
  );
}

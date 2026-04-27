import { NextResponse } from "next/server";

import {
  type AuthUser,
  authenticateUser as defaultAuthenticateUser,
  createSessionToken as defaultCreateSessionToken,
  getSessionCookieName,
  getSessionDurationSeconds,
} from "@/lib/auth";

type LoginBody = {
  user?: string;
  password?: string;
};

export type LoginDeps = {
  authenticate: (user: string, password: string) => Promise<AuthUser | null>;
  createToken: (subject: string) => Promise<string>;
};

const defaultDeps: LoginDeps = {
  authenticate: defaultAuthenticateUser,
  createToken: defaultCreateSessionToken,
};

export async function handleLoginRequest(request: Request, deps: LoginDeps = defaultDeps) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const user = body.user?.trim() ?? "";
  const password = body.password?.trim() ?? "";

  if (!user || !password) {
    return NextResponse.json({ error: "Usuario y contraseña son requeridos" }, { status: 400 });
  }

  let authenticated: AuthUser | null;
  try {
    authenticated = await deps.authenticate(user, password);
  } catch {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  if (!authenticated) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const token = await deps.createToken(authenticated.id);

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set({
    name: getSessionCookieName(),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionDurationSeconds(),
  });

  return response;
}

export async function POST(request: Request) {
  return handleLoginRequest(request);
}

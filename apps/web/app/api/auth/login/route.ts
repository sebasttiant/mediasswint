import { NextResponse } from "next/server";

import { createSessionToken, getSessionCookieName, isValidLogin } from "@/lib/auth";

type LoginBody = {
  user?: string;
  password?: string;
};

export async function POST(request: Request) {
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

  if (!isValidLogin(user, password)) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const token = await createSessionToken(user);

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set({
    name: getSessionCookieName(),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}

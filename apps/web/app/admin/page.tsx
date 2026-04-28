import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";

import { resolveAdminAccess } from "./admin-access";

function requestFromSessionCookie(sessionCookie: string | undefined) {
  return new Request("http://localhost/admin", {
    headers: sessionCookie ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` } : undefined,
  });
}

export default async function AdminPage() {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const user = await requireActiveUserFromRequest(requestFromSessionCookie(sessionCookie));
  const access = resolveAdminAccess(user);

  if (!access.allowed) {
    redirect(access.redirectTo);
  }

  return (
    <main>
      <h1>Administración</h1>
      <p>Panel administrativo disponible para usuarios ADMIN.</p>
    </main>
  );
}

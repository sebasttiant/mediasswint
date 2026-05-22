import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";

import { AppShell } from "../_components/app-shell/app-shell";
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
    <AppShell
      currentPath="/admin"
      description="Panel administrativo disponible para usuarios ADMIN."
      kicker="MEDIASSWINT · Administración"
      title="Administración"
      userLabel={user?.fullName ?? undefined}
    >
      <p>Panel administrativo disponible para usuarios ADMIN.</p>
    </AppShell>
  );
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";

import { AppShell } from "../_components/app-shell/app-shell";
import { LogoutButton } from "../_components/logout-button";
import PatientsClient from "./patients-client";

export default async function PatientsPage() {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request("http://localhost/patients", {
    headers: sessionCookie ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` } : undefined,
  });
  const user = await requireActiveUserFromRequest(request);

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell
      actions={<LogoutButton />}
      currentPath="/patients"
      description="Alta, búsqueda y ficha clínica con retorno permanente al dashboard."
      kicker="MEDIASSWINT · Gestión Clínica"
      title="Pacientes"
      userLabel={user.fullName ?? undefined}
    >
      <PatientsClient />
    </AppShell>
  );
}

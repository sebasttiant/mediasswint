import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { fetchDailyCashbox, toCashboxDateKeyForForm } from "@/lib/finance";

import { AppShell } from "../_components/app-shell/app-shell";
import { FinanceClient } from "./finance-client";

export default async function FinanceDailyCashboxPage() {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request("http://localhost/finance", {
    headers: sessionCookie
      ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` }
      : undefined,
  });
  const user = await requireActiveUserFromRequest(request);

  if (!user) {
    redirect("/login");
  }

  const rows = await fetchDailyCashbox();
  const today = toCashboxDateKeyForForm(new Date());

  return (
    <AppShell
      currentPath="/finance"
      description="Caja diaria derivada de los abonos: ingresos por método, egresos y conciliación de efectivo."
      kicker="MEDIASSWINT · Caja y Finanzas"
      title="Caja diaria"
      role={user.role}
      userLabel={user.fullName ?? undefined}
    >
      <FinanceClient rows={rows} today={today} />
    </AppShell>
  );
}

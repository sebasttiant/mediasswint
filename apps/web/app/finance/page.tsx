import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { resolveCashboxRange } from "@/lib/cashbox";
import { fetchDailyCashbox, toCashboxDateKeyForForm } from "@/lib/finance";

import { AppShell } from "../_components/app-shell/app-shell";
import { FinanceClient } from "./finance-client";

type FinanceSearchParams = { from?: string; to?: string };

export default async function FinanceDailyCashboxPage({
  searchParams,
}: {
  searchParams: Promise<FinanceSearchParams>;
}) {
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

  const today = toCashboxDateKeyForForm(new Date());
  // Default to "Hoy" instead of the full ledger: the range drives both the DB query
  // and the in-memory day filter, so the screen never loads all history by default.
  const range = resolveCashboxRange(await searchParams, today);
  const rows = await fetchDailyCashbox({ from: range.from, to: range.to });

  return (
    <AppShell
      currentPath="/finance"
      description="Caja diaria derivada de los abonos: ingresos por método, egresos y conciliación de efectivo."
      kicker="MEDIASSWINT · Caja y Finanzas"
      title="Caja diaria"
      role={user.role}
      userLabel={user.fullName ?? undefined}
    >
      <FinanceClient rows={rows} today={today} range={range} />
    </AppShell>
  );
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { isPaymentMethod, resolveCashboxRange } from "@/lib/cashbox";
import { fetchDailyCashbox, fetchPaymentMovements, toCashboxDateKeyForForm } from "@/lib/finance";

import { AppShell } from "../_components/app-shell/app-shell";
import { FinanceClient } from "./finance-client";

type FinanceSearchParams = { from?: string; to?: string; method?: string; search?: string };

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
  const params = await searchParams;
  // Default to "Hoy" instead of the full ledger: the range drives both the DB query
  // and the in-memory day filter, so the screen never loads all history by default.
  const range = resolveCashboxRange(params, today);
  // The range narrows BOTH datasets; method/search narrow the movement detail only,
  // so the daily reconciliation stays whole. Invalid method is dropped server-side.
  const method = isPaymentMethod(params.method) ? params.method : undefined;
  const search = params.search?.trim() || undefined;

  const [rows, movements] = await Promise.all([
    fetchDailyCashbox({ from: range.from, to: range.to }),
    fetchPaymentMovements({ from: range.from, to: range.to, method, search }),
  ]);

  return (
    <AppShell
      currentPath="/finance"
      description="Caja diaria derivada de los abonos: ingresos por método, egresos y conciliación de efectivo."
      kicker="MEDIASSWINT · Caja y Finanzas"
      title="Caja diaria"
      role={user.role}
      userLabel={user.fullName ?? undefined}
    >
      <FinanceClient
        rows={rows}
        today={today}
        range={range}
        movements={movements}
        movementFilters={{ method: method ?? "", search: search ?? "" }}
      />
    </AppShell>
  );
}

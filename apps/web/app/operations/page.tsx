import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { fetchOperationalPendingQueue, type OperationalQueueItem } from "@/lib/operations";
import { formatClinicDate } from "@/lib/datetime";

import { AppShell } from "../_components/app-shell/app-shell";
import { StatusBadge } from "../_components/dashboard/status-badge";

function formatCurrency(value: string | number | null): string {
  if (value === null) return "-";
  const numberValue = typeof value === "string" ? Number(value) : value;
  return `$${numberValue.toLocaleString("es-AR")}`;
}

function QueueTable({ emptyMessage, items }: { emptyMessage: string; items: OperationalQueueItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50">
            {["Paciente", "Prenda", "Estado", "Total", "Seña", "Saldo", "Actualizada", "Acción"].map((h) => (
              <th
                key={h}
                className="border-b border-slate-200 px-4 py-2.5 text-left text-xs font-bold uppercase tracking-widest text-slate-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr
              key={item.id}
              className={`transition-colors hover:bg-slate-50 ${idx !== items.length - 1 ? "border-b border-slate-100" : ""}`}
            >
              <td className="px-4 py-3">
                {item.patientId ? (
                  <Link className="font-medium text-brand hover:underline" href={item.actionHref}>
                    {item.patientName ?? "Paciente sin nombre"}
                  </Link>
                ) : (
                  <span className="text-slate-400">{item.patientName ?? "Paciente sin nombre"}</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-400">{item.garmentType ?? "-"}</td>
              <td className="px-4 py-3">
                <StatusBadge status={item.status} variant="operation" />
              </td>
              <td className="px-4 py-3 font-medium text-slate-700">{formatCurrency(item.totalAmount)}</td>
              <td className="px-4 py-3 text-slate-400">{formatCurrency(item.depositPaid)}</td>
              <td className="px-4 py-3 font-medium text-slate-700">{formatCurrency(item.pendingBalance)}</td>
              <td className="px-4 py-3 text-slate-400">{formatClinicDate(item.updatedAt)}</td>
              <td className="px-4 py-3">
                <Link className="font-semibold text-brand hover:underline" href={item.actionHref}>
                  Abrir paciente
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function OperationsQueuePage() {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request("http://localhost/operations", {
    headers: sessionCookie ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` } : undefined,
  });
  const user = await requireActiveUserFromRequest(request);

  if (!user) {
    redirect("/login");
  }

  const queue = await fetchOperationalPendingQueue();

  return (
    <AppShell
      currentPath="/operations"
      description="Saldos, producción y entrega para trabajar desde la ficha del paciente."
      kicker="MEDIASSWINT · Operación"
      title="Cola de operaciones pendientes"
      role={user.role}
      userLabel={user.fullName ?? undefined}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Summary counters */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Saldos por cobrar</p>
            <strong className="font-display text-3xl font-bold text-brand">{queue.paymentCount}</strong>
          </div>
          <div className="rounded-lg border border-slate-100 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Producción / entrega</p>
            <strong className="font-display text-3xl font-bold text-brand">{queue.productionCount}</strong>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-700">Saldos pendientes</h2>
          </div>
          <div className="p-5">
            <QueueTable emptyMessage="No hay operaciones con saldo pendiente." items={queue.paymentItems} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-700">Producción y entrega</h2>
          </div>
          <div className="p-5">
            <QueueTable emptyMessage="No hay operaciones confirmadas o en producción." items={queue.productionItems} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { fetchOperationalPendingQueue, type OperationalQueueItem } from "@/lib/operations";

import styles from "../dashboard.module.css";

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  PRESUPUESTO: { bg: "#fef5ec", color: "#b8733f", label: "Presupuesto" },
  CONFIRMADO: { bg: "#ecfdf5", color: "#10b981", label: "Confirmado" },
  EN_PRODUCCION: { bg: "#eff6ff", color: "#3b82f6", label: "En producción" },
  ENTREGADO: { bg: "#f5f3ff", color: "#8b5cf6", label: "Entregado" },
  CANCELADO: { bg: "#fef2f2", color: "#ef4444", label: "Cancelado" },
};

function formatCurrency(value: string | number | null): string {
  if (value === null) return "-";
  const numberValue = typeof value === "string" ? Number(value) : value;
  return `$${numberValue.toLocaleString("es-AR")}`;
}

function QueueTable({ emptyMessage, items }: { emptyMessage: string; items: OperationalQueueItem[] }) {
  if (items.length === 0) {
    return <p className={styles.muted}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.tableResponsive}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Prenda</th>
            <th>Estado</th>
            <th>Total</th>
            <th>Seña</th>
            <th>Saldo</th>
            <th>Actualizada</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const statusStyle = STATUS_STYLES[item.status] ?? {
              bg: "#f3f4f6",
              color: "#6b7280",
              label: item.status,
            };

            return (
              <tr key={item.id}>
                <td>
                  {item.patientId ? (
                    <Link className={styles.link} href={item.actionHref}>
                      {item.patientName ?? "Paciente sin nombre"}
                    </Link>
                  ) : (
                    <span className={styles.muted}>{item.patientName ?? "Paciente sin nombre"}</span>
                  )}
                </td>
                <td className={styles.muted}>{item.garmentType ?? "-"}</td>
                <td>
                  <span className={styles.statusBadge} style={{ background: statusStyle.bg, color: statusStyle.color }}>
                    {statusStyle.label}
                  </span>
                </td>
                <td>{formatCurrency(item.totalAmount)}</td>
                <td className={styles.muted}>{formatCurrency(item.depositPaid)}</td>
                <td>{formatCurrency(item.pendingBalance)}</td>
                <td className={styles.muted}>{item.updatedAt.toLocaleDateString("es-AR")}</td>
                <td>
                  <Link className={styles.link} href={item.actionHref}>
                    Abrir paciente
                  </Link>
                </td>
              </tr>
            );
          })}
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
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <p className={styles.kicker}>MEDIASSWINT · Operación</p>
          <h1 className={styles.title}>Cola de operaciones pendientes</h1>
          <p className={styles.subtitle}>Saldos, producción y entrega para trabajar desde la ficha del paciente.</p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.logoutBtn} href="/">
            Volver al panel
          </Link>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.pendingSummary}>
          <div className={styles.pendingSummaryItem}>
            <span className={styles.metricLabel}>Saldos por cobrar</span>
            <strong className={styles.pendingSummaryValue}>{queue.paymentCount}</strong>
          </div>
          <div className={styles.pendingSummaryItem}>
            <span className={styles.metricLabel}>Producción / entrega</span>
            <strong className={styles.pendingSummaryValue}>{queue.productionCount}</strong>
          </div>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Saldos pendientes</h2>
          </div>
          <div className={styles.sectionBody}>
            <QueueTable emptyMessage="No hay operaciones con saldo pendiente." items={queue.paymentItems} />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Producción y entrega</h2>
          </div>
          <div className={styles.sectionBody}>
            <QueueTable emptyMessage="No hay operaciones confirmadas o en producción." items={queue.productionItems} />
          </div>
        </section>
      </div>
    </main>
  );
}

import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { fetchDashboardData } from "@/lib/dashboard";

import { LogoutButton } from "./_components/logout-button";
import styles from "./dashboard.module.css";

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  PRESUPUESTO: { bg: "#fef5ec", color: "#b8733f", label: "Presupuesto" },
  CONFIRMADO: { bg: "#ecfdf5", color: "#10b981", label: "Confirmado" },
  EN_PRODUCCION: { bg: "#eff6ff", color: "#3b82f6", label: "En producción" },
  ENTREGADO: { bg: "#f5f3ff", color: "#8b5cf6", label: "Entregado" },
  CANCELADO: { bg: "#fef2f2", color: "#ef4444", label: "Cancelado" },
};

const MEASUREMENT_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: "#fef5ec", color: "#b8733f", label: "Borrador" },
  COMPLETED: { bg: "#ecfdf5", color: "#10b981", label: "Completada" },
  VOID: { bg: "#fef2f2", color: "#ef4444", label: "Anulada" },
};

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? Number(value) : value;
  return `$${num.toLocaleString("es-AR")}`;
}

export default async function DashboardPage() {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request("http://localhost/", {
    headers: sessionCookie ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie ?? "")}` } : undefined,
  });
  const user = await requireActiveUserFromRequest(request);

  if (!user) {
    redirect("/login");
  }

  const data = await fetchDashboardData();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <p className={styles.kicker}>MEDIASSWINT · Gestión Interna</p>
          <h1 className={styles.title}>Panel de gestión</h1>
          <p className={styles.subtitle}>
            Bienvenido{user.fullName ? `, ${user.fullName}` : ""}. Resumen operativo del día.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LogoutButton />
        </div>
      </header>

      <div className={styles.content}>
        {/* KPI metrics */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Pacientes totales</span>
            <strong className={styles.metricValue}>{data.totalPatients}</strong>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Creados hoy</span>
            <strong className={`${styles.metricValue} ${styles.metricValueBrand}`}>{data.patientsCreatedTodayCount}</strong>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Operaciones activas</span>
            <strong className={`${styles.metricValue} ${styles.metricValueWarning}`}>{data.activeOperationsCount}</strong>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Mediciones abiertas</span>
            <strong className={`${styles.metricValue} ${styles.metricValueWarning}`}>{data.openMeasurementDraftsCount}</strong>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Mediciones finalizadas hoy</span>
            <strong className={`${styles.metricValue} ${styles.metricValuePositive}`}>{data.completedMeasurementsTodayCount}</strong>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Total señado</span>
            <strong className={`${styles.metricValue} ${styles.metricValuePositive}`}>{formatCurrency(data.totalDeposits)}</strong>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Saldo pendiente</span>
            <strong className={`${styles.metricValue} ${styles.metricValueWarning}`}>{formatCurrency(data.totalPendingBalance)}</strong>
          </div>
        </div>

        {/* Quick actions */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Acciones rápidas</h2>
          </div>
          <div className={styles.ctaGrid}>
            <Link href="/patients" className={styles.ctaCard}>
              <span className={styles.ctaIcon}>➕</span>
              <span className={styles.ctaLabel}>Nuevo paciente / Buscar</span>
              <span className={styles.ctaDesc}>Dar de alta o buscar pacientes existentes</span>
            </Link>
            <Link href="/patients" className={styles.ctaCard}>
              <span className={styles.ctaIcon}>📏</span>
              <span className={styles.ctaLabel}>Buscar paciente para medir</span>
              <span className={styles.ctaDesc}>Elegir paciente antes de iniciar la toma de medidas</span>
            </Link>
            <Link href="/patients" className={styles.ctaCard}>
              <span className={styles.ctaIcon}>📋</span>
              <span className={styles.ctaLabel}>Buscar paciente para operación</span>
              <span className={styles.ctaDesc}>Elegir paciente antes de crear presupuesto o pedido</span>
            </Link>
            <Link
              href="/operations"
              className={styles.ctaCard}
            >
              <span className={styles.ctaIcon}>⚙️</span>
              <span className={styles.ctaLabel}>Operaciones activas</span>
              <span className={styles.ctaDesc}>Gestionar presupuestos, producción y entregas</span>
            </Link>
          </div>
        </div>

        {/* Pending work */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Trabajo pendiente</h2>
            <div className={styles.sectionActions}>
              <Link href="/operations" className={styles.link}>Ver cola operativa</Link>
            </div>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.pendingSummary}>
              <div className={styles.pendingSummaryItem}>
                <span className={styles.metricLabel}>Saldos por cobrar</span>
                <strong className={styles.pendingSummaryValue}>{data.pendingWork.paymentFollowUpsCount}</strong>
              </div>
              <div className={styles.pendingSummaryItem}>
                <span className={styles.metricLabel}>Producción / entrega</span>
                <strong className={styles.pendingSummaryValue}>{data.pendingWork.productionFollowUpsCount}</strong>
              </div>
              <div className={styles.pendingSummaryItem}>
                <span className={styles.metricLabel}>Mediciones a continuar</span>
                <strong className={styles.pendingSummaryValue}>{data.pendingWork.draftMeasurementsCount}</strong>
              </div>
            </div>

            {data.pendingWork.items.length > 0 ? (
              <div className={styles.pendingList}>
                {data.pendingWork.items.map((item) => (
                  <article key={item.id} className={styles.pendingItem}>
                    <div>
                      <p className={styles.pendingTitle}>{item.title}</p>
                      <p className={styles.pendingDescription}>{item.description}</p>
                    </div>
                    <Link className={styles.link} href={item.href}>
                      {item.actionLabel}
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.muted}>No hay trabajo pendiente con las señales disponibles.</p>
            )}
          </div>
        </div>

        {/* Latest measurements */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Mediciones recientes</h2>
            <div className={styles.sectionActions}>
              <Link href="/patients" className={styles.link}>Buscar paciente</Link>
            </div>
          </div>
          <div className={styles.sectionBody}>
            {data.latestMeasurements.length > 0 ? (
              <div className={styles.tableResponsive}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th>Prenda</th>
                      <th>Clase</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latestMeasurements.map((measurement) => {
                      const statusStyle = MEASUREMENT_STATUS_STYLES[measurement.status] ?? {
                        bg: "#f3f4f6",
                        color: "#6b7280",
                        label: measurement.status,
                      };
                      const measurementHref = measurement.patientId
                        ? `/patients/${measurement.patientId}/measurements/${measurement.id}`
                        : null;

                      return (
                        <tr key={measurement.id}>
                          <td>
                            {measurement.patientId ? (
                              <Link className={styles.link} href={`/patients/${measurement.patientId}`}>
                                {measurement.patientName ?? "—"}
                              </Link>
                            ) : (
                              <span className={styles.muted}>{measurement.patientName ?? "—"}</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={styles.statusBadge}
                              style={{ background: statusStyle.bg, color: statusStyle.color }}
                            >
                              {statusStyle.label}
                            </span>
                          </td>
                          <td className={styles.muted}>{measurement.measuredAt.toLocaleDateString("es-AR")}</td>
                          <td className={styles.muted}>{measurement.garmentType ?? "—"}</td>
                          <td className={styles.muted}>{measurement.compressionClass ?? "—"}</td>
                          <td>
                            {measurementHref ? (
                              <Link className={styles.link} href={measurementHref}>
                                {measurement.status === "DRAFT" ? "Continuar" : "Ver detalle"}
                              </Link>
                            ) : (
                              <span className={styles.muted}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.muted}>Todavía no hay mediciones registradas.</p>
            )}
          </div>
        </div>

        {/* Latest patients */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Últimos pacientes</h2>
            <div className={styles.sectionActions}>
              <Link href="/patients" className={styles.link}>Ver todos</Link>
            </div>
          </div>
          <div className={styles.sectionBody}>
            {data.latestPatients.length > 0 ? (
              <div className={styles.tableResponsive}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Documento</th>
                      <th>Alta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latestPatients.map((patient) => (
                      <tr key={patient.id}>
                        <td>
                          <Link className={styles.link} href={`/patients/${patient.id}`}>
                            {patient.fullName}
                          </Link>
                        </td>
                        <td className={styles.muted}>
                          {[patient.documentType, patient.documentNumber].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className={styles.muted}>
                          {patient.createdAt.toLocaleDateString("es-AR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.muted}>Todavía no hay pacientes registrados.</p>
            )}
          </div>
        </div>

        {/* Latest active operations */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Operaciones recientes</h2>
          </div>
          <div className={styles.sectionBody}>
            {data.latestOperations.length > 0 ? (
              <div className={styles.tableResponsive}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>Prenda</th>
                      <th>Estado</th>
                      <th>Total</th>
                      <th>Seña</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latestOperations.map((op) => {
                      const statusStyle = STATUS_STYLES[op.status] ?? { bg: "#f3f4f6", color: "#6b7280", label: op.status };
                      return (
                        <tr key={op.id}>
                          <td>
                            {op.patientId ? (
                              <Link className={styles.link} href={`/patients/${op.patientId}`}>
                                {op.patientName ?? "—"}
                              </Link>
                            ) : (
                              <span className={styles.muted}>{op.patientName ?? "—"}</span>
                            )}
                          </td>
                          <td className={styles.muted}>{op.garmentType ?? "—"}</td>
                          <td>
                            <span
                              className={styles.statusBadge}
                              style={{ background: statusStyle.bg, color: statusStyle.color }}
                            >
                              {statusStyle.label}
                            </span>
                          </td>
                          <td>{formatCurrency(op.totalAmount)}</td>
                          <td className={styles.muted}>{formatCurrency(op.depositPaid)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.muted}>Todavía no hay operaciones activas.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

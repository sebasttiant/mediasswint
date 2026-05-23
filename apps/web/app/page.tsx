import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertCircle,
  Briefcase,
  Calendar,
  DollarSign,
  Stethoscope,
  TrendingUp,
  Users,
} from "lucide-react";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { fetchDashboardData } from "@/lib/dashboard";

import { AppShell } from "./_components/app-shell/app-shell";
import { LogoutButton } from "./_components/logout-button";
import { Avatar } from "./_components/dashboard/avatar";
import { DataTable, type DataTableColumn } from "./_components/dashboard/data-table";
import { KpiCard } from "./_components/dashboard/kpi-card";
import { PendingTimeline } from "./_components/dashboard/pending-timeline";
import { QuickActionCard } from "./_components/dashboard/quick-action-card";
import { StatusBadge } from "./_components/dashboard/status-badge";
import type { DashboardMeasurement, DashboardOperation, DashboardPatient } from "@/lib/dashboard";

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? Number(value) : value;
  return `$${num.toLocaleString("es-AR")}`;
}

const MEASUREMENT_COLUMNS: DataTableColumn<DashboardMeasurement>[] = [
  {
    key: "patient",
    header: "Paciente",
    render: (row) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={row.patientName ?? "?"} />
        {row.patientId ? (
          <Link className="font-medium text-brand hover:underline" href={`/patients/${row.patientId}`}>
            {row.patientName ?? "—"}
          </Link>
        ) : (
          <span className="text-slate-400">{row.patientName ?? "—"}</span>
        )}
      </div>
    ),
  },
  {
    key: "status",
    header: "Estado",
    render: (row) => <StatusBadge status={row.status} variant="measurement" />,
  },
  {
    key: "date",
    header: "Fecha",
    render: (row) => (
      <span className="text-slate-400">{row.measuredAt.toLocaleDateString("es-AR")}</span>
    ),
  },
  {
    key: "garment",
    header: "Prenda",
    render: (row) => <span className="text-slate-400">{row.garmentType ?? "—"}</span>,
  },
  {
    key: "class",
    header: "Clase",
    render: (row) => <span className="text-slate-400">{row.compressionClass ?? "—"}</span>,
  },
  {
    key: "action",
    header: "Acción",
    render: (row) => {
      const href = row.patientId
        ? `/patients/${row.patientId}/measurements/${row.id}`
        : null;
      return href ? (
        <Link className="font-semibold text-brand hover:underline" href={href}>
          {row.status === "DRAFT" ? "Continuar" : "Ver detalle"}
        </Link>
      ) : (
        <span className="text-slate-300">—</span>
      );
    },
  },
];

const PATIENT_COLUMNS: DataTableColumn<DashboardPatient>[] = [
  {
    key: "name",
    header: "Nombre",
    render: (row) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={row.fullName} />
        <Link className="font-medium text-brand hover:underline" href={`/patients/${row.id}`}>
          {row.fullName}
        </Link>
      </div>
    ),
  },
  {
    key: "document",
    header: "Documento",
    render: (row) => (
      <span className="text-slate-400">
        {[row.documentType, row.documentNumber].filter(Boolean).join(" ") || "—"}
      </span>
    ),
  },
  {
    key: "since",
    header: "Alta",
    render: (row) => (
      <span className="text-slate-400">{row.createdAt.toLocaleDateString("es-AR")}</span>
    ),
  },
];

const OPERATION_COLUMNS: DataTableColumn<DashboardOperation>[] = [
  {
    key: "patient",
    header: "Paciente",
    render: (row) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={row.patientName ?? "?"} />
        {row.patientId ? (
          <Link className="font-medium text-brand hover:underline" href={`/patients/${row.patientId}`}>
            {row.patientName ?? "—"}
          </Link>
        ) : (
          <span className="text-slate-400">{row.patientName ?? "—"}</span>
        )}
      </div>
    ),
  },
  {
    key: "garment",
    header: "Prenda",
    render: (row) => <span className="text-slate-400">{row.garmentType ?? "—"}</span>,
  },
  {
    key: "status",
    header: "Estado",
    render: (row) => <StatusBadge status={row.status} variant="operation" />,
  },
  {
    key: "total",
    header: "Total",
    render: (row) => <span className="font-medium">{formatCurrency(row.totalAmount)}</span>,
  },
  {
    key: "deposit",
    header: "Seña",
    render: (row) => <span className="text-slate-400">{formatCurrency(row.depositPaid)}</span>,
  },
];

export default async function DashboardPage() {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request("http://localhost/", {
    headers: sessionCookie
      ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie ?? "")}` }
      : undefined,
  });
  const user = await requireActiveUserFromRequest(request);

  if (!user) {
    redirect("/login");
  }

  const data = await fetchDashboardData();

  return (
    <AppShell
      actions={<LogoutButton />}
      currentPath="/"
      description="Resumen operativo del día."
      kicker="MEDIASSWINT · Gestión Interna"
      title="Panel de gestión"
      userLabel={user.fullName ? `Bienvenido, ${user.fullName}` : "Bienvenido"}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* KPI grid */}
        <section aria-label="Indicadores clave">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <KpiCard
              icon={Users}
              iconClassName="bg-clinical-50 text-clinical-600"
              label="Pacientes totales"
              value={data.totalPatients}
              sparklineSeed={data.totalPatients}
              trendDirection="up"
            />
            <KpiCard
              icon={Calendar}
              iconClassName="bg-brand/10 text-brand"
              label="Creados hoy"
              value={data.patientsCreatedTodayCount}
              sparklineSeed={data.patientsCreatedTodayCount + 7}
              trendDirection={data.patientsCreatedTodayCount > 0 ? "up" : "neutral"}
            />
            <KpiCard
              icon={Briefcase}
              iconClassName="bg-amber-50 text-amber-600"
              label="Operaciones activas"
              value={data.activeOperationsCount}
              sparklineSeed={data.activeOperationsCount + 13}
              trendDirection="neutral"
            />
            <KpiCard
              icon={AlertCircle}
              iconClassName="bg-orange-50 text-orange-500"
              label="Mediciones abiertas"
              value={data.openMeasurementDraftsCount}
              sparklineSeed={data.openMeasurementDraftsCount + 31}
              trendDirection={data.openMeasurementDraftsCount > 0 ? "down" : "neutral"}
            />
            <KpiCard
              icon={Activity}
              iconClassName="bg-emerald-50 text-emerald-600"
              label="Finalizadas hoy"
              value={data.completedMeasurementsTodayCount}
              sparklineSeed={data.completedMeasurementsTodayCount + 17}
              trendDirection={data.completedMeasurementsTodayCount > 0 ? "up" : "neutral"}
            />
            <KpiCard
              icon={DollarSign}
              iconClassName="bg-mint-50 text-mint-600"
              label="Total señado"
              value={formatCurrency(data.totalDeposits)}
              sparklineSeed={Number(data.totalDeposits) % 10000 + 3}
              trendDirection="up"
            />
            <KpiCard
              icon={TrendingUp}
              iconClassName="bg-violet-50 text-violet-600"
              label="Saldo pendiente"
              value={formatCurrency(data.totalPendingBalance)}
              sparklineSeed={Number(data.totalPendingBalance) % 10000 + 5}
              trendDirection={Number(data.totalPendingBalance) > 0 ? "down" : "neutral"}
            />
          </div>
        </section>

        {/* Quick actions */}
        <section aria-label="Acciones rápidas">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-700">Acciones rápidas</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto p-4 md:grid md:grid-cols-4">
              <QuickActionCard
                href="/patients"
                icon={Users}
                label="Nuevo paciente / Buscar"
                description="Dar de alta o buscar pacientes existentes"
              />
              <QuickActionCard
                href="/patients"
                icon={Stethoscope}
                label="Buscar paciente para medir"
                description="Elegir paciente antes de iniciar la toma de medidas"
              />
              <QuickActionCard
                href="/patients"
                icon={Activity}
                label="Buscar para operación"
                description="Elegir paciente antes de crear presupuesto o pedido"
              />
              <QuickActionCard
                href="/operations"
                icon={Briefcase}
                label="Operaciones activas"
                description="Gestionar presupuestos, producción y entregas"
              />
            </div>
          </div>
        </section>

        {/* Pending work */}
        <section aria-label="Trabajo pendiente">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-700">Trabajo pendiente</h2>
              <Link href="/operations" className="text-xs font-semibold text-brand hover:underline">
                Ver cola operativa
              </Link>
            </div>
            <div className="p-5">
              {/* Summary counters */}
              <div className="mb-5 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Saldos por cobrar
                  </p>
                  <strong className="font-display text-2xl font-bold text-brand">
                    {data.pendingWork.paymentFollowUpsCount}
                  </strong>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Producción / entrega
                  </p>
                  <strong className="font-display text-2xl font-bold text-brand">
                    {data.pendingWork.productionFollowUpsCount}
                  </strong>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Mediciones a continuar
                  </p>
                  <strong className="font-display text-2xl font-bold text-brand">
                    {data.pendingWork.draftMeasurementsCount}
                  </strong>
                </div>
              </div>

              <PendingTimeline items={data.pendingWork.items} />
            </div>
          </div>
        </section>

        {/* Recent measurements */}
        <section aria-label="Mediciones recientes">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-700">Mediciones recientes</h2>
              <Link href="/patients" className="text-xs font-semibold text-brand hover:underline">
                Buscar paciente
              </Link>
            </div>
            <div className="p-5">
              <DataTable
                columns={MEASUREMENT_COLUMNS}
                rows={data.latestMeasurements}
                getKey={(row) => row.id}
                emptyMessage="Todavía no hay mediciones registradas."
              />
            </div>
          </div>
        </section>

        {/* Latest patients */}
        <section aria-label="Últimos pacientes">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-700">Últimos pacientes</h2>
              <Link href="/patients" className="text-xs font-semibold text-brand hover:underline">
                Ver todos
              </Link>
            </div>
            <div className="p-5">
              <DataTable
                columns={PATIENT_COLUMNS}
                rows={data.latestPatients}
                getKey={(row) => row.id}
                emptyMessage="Todavía no hay pacientes registrados."
              />
            </div>
          </div>
        </section>

        {/* Recent operations */}
        <section aria-label="Operaciones recientes">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-700">Operaciones recientes</h2>
            </div>
            <div className="p-5">
              <DataTable
                columns={OPERATION_COLUMNS}
                rows={data.latestOperations}
                getKey={(row) => row.id}
                emptyMessage="Todavía no hay operaciones activas."
              />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

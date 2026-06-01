import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KpiCard } from "./_components/dashboard/kpi-card";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { fetchDashboardData } from "@/lib/dashboard";

import { AppShell } from "./_components/app-shell/app-shell";
import { Button } from "./_components/ui/button";
import { Card, CardBody, CardHeader } from "./_components/ui/card";
import { Avatar } from "./_components/dashboard/avatar";
import { DataTable, type DataTableColumn } from "./_components/dashboard/data-table";
import { PendingTimeline } from "./_components/dashboard/pending-timeline";
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
    align: "right",
    render: (row) => <span className="font-mono font-semibold tabular-nums text-slate-800">{formatCurrency(row.totalAmount)}</span>,
  },
  {
    key: "deposit",
    header: "Seña",
    align: "right",
    render: (row) => <span className="font-mono tabular-nums text-slate-500">{formatCurrency(row.depositPaid)}</span>,
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
      currentPath="/"
      description="Resumen operativo del día."
      kicker="MEDIASSWINT · Gestión Interna"
      title="Panel de gestión"
      role={user.role}
      userLabel={user.fullName ? `Bienvenido, ${user.fullName}` : "Bienvenido"}
    >
      <div className="space-y-6">
        {/* KPI grid */}
        <section aria-label="Indicadores clave" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon="users" iconClassName="bg-clinical-50 text-clinical-600" label="Pacientes totales" value={data.totalPatients} />
          <KpiCard icon="calendar" iconClassName="bg-brand/10 text-brand" label="Creados hoy" value={data.patientsCreatedTodayCount} />
          <KpiCard icon="briefcase" iconClassName="bg-amber-50 text-amber-600" label="Operaciones activas" value={data.activeOperationsCount} />
          <KpiCard icon="alertCircle" iconClassName="bg-orange-50 text-orange-500" label="Mediciones abiertas" value={data.openMeasurementDraftsCount} />
          <KpiCard icon="activity" iconClassName="bg-emerald-50 text-emerald-600" label="Finalizadas hoy" value={data.completedMeasurementsTodayCount} />
          <KpiCard icon="dollarSign" iconClassName="bg-mint-50 text-mint-600" label="Total señado" value={formatCurrency(data.totalDeposits)} />
          <KpiCard icon="trendingUp" iconClassName="bg-violet-50 text-violet-600" label="Saldo pendiente" value={formatCurrency(data.totalPendingBalance)} />
        </section>

        {/* Hero: today's work + quick actions */}
        <section aria-label="Trabajo del día" className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Trabajo de hoy"
              action={
                <Button href="/operations" variant="link" size="sm">
                  Ver cola operativa →
                </Button>
              }
            />
            <CardBody className="space-y-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Saldos por cobrar</p>
                  <strong className="mt-1 block font-display text-3xl font-bold leading-none tabular-nums text-brand">
                    {data.pendingWork.paymentFollowUpsCount}
                  </strong>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Producción / entrega</p>
                  <strong className="mt-1 block font-display text-3xl font-bold leading-none tabular-nums text-clinical-600">
                    {data.pendingWork.productionFollowUpsCount}
                  </strong>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Mediciones a continuar</p>
                  <strong className="mt-1 block font-display text-3xl font-bold leading-none tabular-nums text-violet-600">
                    {data.pendingWork.draftMeasurementsCount}
                  </strong>
                </div>
              </div>

              <PendingTimeline items={data.pendingWork.items} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Acciones rápidas" />
            <CardBody className="flex flex-col gap-3">
              <Button href="/patients" variant="primary" className="w-full">
                Buscar o crear paciente
              </Button>
              <Button href="/patients" variant="secondary" className="w-full">
                Iniciar medición
              </Button>
              <Button href="/operations" variant="secondary" className="w-full">
                Cola de operaciones
              </Button>
            </CardBody>
          </Card>
        </section>

        {/* Recent activity */}
        <section aria-label="Actividad reciente" className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="Mediciones recientes"
              action={
                <Button href="/patients" variant="link" size="sm">
                  Buscar paciente →
                </Button>
              }
            />
            <CardBody>
              <DataTable
                columns={MEASUREMENT_COLUMNS}
                rows={data.latestMeasurements}
                getKey={(row) => row.id}
                emptyMessage="Todavía no hay mediciones registradas."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Últimos pacientes"
              action={
                <Button href="/patients" variant="link" size="sm">
                  Ver todos →
                </Button>
              }
            />
            <CardBody>
              <DataTable
                columns={PATIENT_COLUMNS}
                rows={data.latestPatients}
                getKey={(row) => row.id}
                emptyMessage="Todavía no hay pacientes registrados."
              />
            </CardBody>
          </Card>
        </section>

        {/* Recent operations */}
        <section aria-label="Operaciones recientes">
          <Card>
            <CardHeader title="Operaciones recientes" />
            <CardBody>
              <DataTable
                columns={OPERATION_COLUMNS}
                rows={data.latestOperations}
                getKey={(row) => row.id}
                emptyMessage="Todavía no hay operaciones activas."
              />
            </CardBody>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

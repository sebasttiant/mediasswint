"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  CASHBOX_COLORS,
  PAYMENT_METHODS,
  shiftDateKey,
  type CashboxRange,
  type CashCountDetail,
  type DailyCashboxRow,
  type ExpenseDetail,
  type PaymentMovementDetail,
} from "@/lib/cashbox";
import {
  BANK_LABELS,
  INCOME_TYPE_LABELS,
  METHOD_LABELS,
  formatDate,
  formatTimestamp,
} from "@/lib/finance-format";

type MovementFilterState = { method: string; search: string };

type FinanceClientProps = {
  rows: DailyCashboxRow[];
  today: string;
  range: CashboxRange;
  movements: PaymentMovementDetail[];
  expenses: ExpenseDetail[];
  cashCounts: CashCountDetail[];
  movementFilters: MovementFilterState;
};

// Build the export URL carrying the active filters so the file mirrors the screen:
// from/to drive the summary, method/search narrow the movement detail.
function buildExportHref(range: CashboxRange, filters: MovementFilterState, format: string): string {
  const params = new URLSearchParams({ from: range.from, to: range.to, format });
  if (filters.method) params.set("method", filters.method);
  if (filters.search) params.set("search", filters.search);
  return `/api/finance/export?${params.toString()}`;
}

function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return `$${value.toLocaleString("es-CO")}`;
}

function diferenciaClass(value: number | null): string {
  if (value === null) return "text-slate-400";
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-red-600";
  return "text-slate-600";
}

// Softer, UI-only tints for the Excel-derived palette. The exported workbook keeps the
// saturated CASHBOX_COLORS (mirroring the original sheet); on screen those reading as
// "debug" highlights, so we map each one to a calmer pastel. This NEVER touches
// CASHBOX_COLORS or the Excel/PDF exports — it only affects the web rendering.
const UI_GROUP_BG: Readonly<Record<string, string>> = {
  [CASHBOX_COLORS.abonos]: "#FEF9C3", // soft yellow
  [CASHBOX_COLORS.reclamados]: "#FCE7F3", // soft pink (was a strong magenta)
  [CASHBOX_COLORS.bancos]: "#DBEAFE", // soft blue
  [CASHBOX_COLORS.ventaNetaEfectivo]: "#FEF3C7", // soft amber (was pure #FFFF00)
};

function uiBg(color?: string): string | undefined {
  if (!color) return undefined;
  return UI_GROUP_BG[color] ?? color;
}

// Human-readable reading of the daily cash difference, so caja sees instantly whether the
// drawer is over, short or square — not just a signed number.
function diferenciaLabel(value: number | null): string {
  if (value === null) return "Diferencia pendiente";
  if (value > 0) return "Sobrante";
  if (value < 0) return "Faltante";
  return "Caja cuadrada";
}

const DETAIL_HEADERS: ReadonlyArray<{
  label: string;
  key: keyof DailyCashboxRow;
  bg?: string;
  strong?: boolean;
}> = [
  { label: "1 Vez", key: "primeraVez", bg: CASHBOX_COLORS.abonos },
  { label: "R", key: "r", bg: CASHBOX_COLORS.abonos },
  { label: "MEFE", key: "mefe", bg: CASHBOX_COLORS.abonos },
  { label: "Total Abonos", key: "totalAbonos", bg: CASHBOX_COLORS.abonos, strong: true },
  { label: "Recl. 1 Vez", key: "reclamadoPrimeraVez", bg: CASHBOX_COLORS.reclamados },
  { label: "Recl. R", key: "reclamadoR", bg: CASHBOX_COLORS.reclamados },
  { label: "Total Reclamados", key: "totalReclamados", bg: CASHBOX_COLORS.reclamados, strong: true },
  { label: "Transferencia", key: "transferencias", bg: CASHBOX_COLORS.bancos },
  { label: "BOLD", key: "bold", bg: CASHBOX_COLORS.bancos },
  { label: "Tarjeta débito", key: "tarjetaDebito", bg: CASHBOX_COLORS.bancos },
  { label: "Tarjeta crédito", key: "tarjetaCredito", bg: CASHBOX_COLORS.bancos },
  { label: "Total bancos", key: "totalBancos", bg: CASHBOX_COLORS.bancos, strong: true },
  { label: "Otros", key: "otros" },
  { label: "Venta bruta", key: "ventaBruta", strong: true },
  { label: "Egresos", key: "egresos" },
  { label: "Venta neta", key: "ventaNetaEfectivo", bg: CASHBOX_COLORS.ventaNetaEfectivo, strong: true },
  { label: "Real contado", key: "realContado" },
];

// Group band shown above the detail columns so the table reads by section instead
// of as one long strip. Spans must add up to DETAIL_HEADERS.length + 1 (the trailing
// Diferencia column lives in the Conciliación group).
const DETAIL_GROUPS: ReadonlyArray<{ label: string; span: number; bg?: string }> = [
  { label: "Abonos", span: 4, bg: CASHBOX_COLORS.abonos },
  { label: "Reclamados", span: 3, bg: CASHBOX_COLORS.reclamados },
  { label: "Bancos / electrónicos", span: 5, bg: CASHBOX_COLORS.bancos },
  { label: "Otros", span: 1 },
  { label: "Conciliación", span: 5 },
];

export function FinanceClient({
  rows,
  today,
  range,
  movements,
  expenses,
  cashCounts,
  movementFilters,
}: FinanceClientProps) {
  // Index the counted-cash audit by day so each reconciliation card can show the note
  // and the moment the drawer was last counted, tracing where a difference came from.
  const countsByDay = new Map(cashCounts.map((count) => [count.dateKey, count]));
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Controls first: the date range + export drive everything below.
          key on the range remounts the filter so its local input state always
          re-initialises from the URL-driven range (e.g. after browser back/forward),
          never showing a range that disagrees with the data on screen. The active
          movement filters are forwarded so changing the date keeps them composed. */}
      <CashboxFilters
        key={`${range.from}:${range.to}`}
        range={range}
        today={today}
        movementFilters={movementFilters}
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No hay movimientos en el rango seleccionado ({formatDate(range.from)} – {formatDate(range.to)}).
          Probá ampliar el rango de fechas. Los abonos anteriores a este módulo no se incluyen porque no
          tienen método ni fecha confiable.
        </p>
      ) : (
        <>
          {/* Executive read first: the cash reconciliation is the headline of the screen. */}
          <CashboxReconciliationSummary rows={rows} today={today} countsByDay={countsByDay} />
          <CashboxDetailTable rows={rows} />
          <ExpensesAuditSection expenses={expenses} />
        </>
      )}

      {/* Data entry sits below the read-first summary, grouped as a clearly secondary area. */}
      <RegisterForms today={today} />

      <MovementDetailSection
        key={`${range.from}:${range.to}:${movementFilters.method}:${movementFilters.search}`}
        movements={movements}
        range={range}
        filters={movementFilters}
      />
    </div>
  );
}

// Secondary data-entry area: registering an expense or the day's counted cash. Grouped
// under one heading so it reads as an action panel, not as the top of the screen.
function RegisterForms({ today }: { today: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-700">Registrar en caja</h2>
        <p className="text-xs text-slate-400">
          Cargá un egreso o el efectivo realmente contado del día. Se reflejan en la conciliación de arriba.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ExpenseForm today={today} />
        <CashCountForm today={today} />
      </div>
    </section>
  );
}

// Date/range filter for the daily summary + reconciliation. Per the cashbox
// accounting rule this only narrows by DATE — method/patient filters belong to the
// movement detail (separate slice), never here, so the reconciliation stays whole.
// Navigation is server-driven (URL search params) so the bounded DB query is the
// single source of truth; nothing is recomputed on the client.
function CashboxFilters({
  range,
  today,
  movementFilters,
}: {
  range: CashboxRange;
  today: string;
  movementFilters: MovementFilterState;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  function applyRange(nextFrom: string, nextTo: string) {
    const ordered = nextFrom <= nextTo ? { from: nextFrom, to: nextTo } : { from: nextTo, to: nextFrom };
    setFrom(ordered.from);
    setTo(ordered.to);
    const params = new URLSearchParams({ from: ordered.from, to: ordered.to });
    // Keep the movement-detail filters composed when only the date changes.
    if (movementFilters.method) params.set("method", movementFilters.method);
    if (movementFilters.search) params.set("search", movementFilters.search);
    startTransition(() => router.push(`/finance?${params.toString()}`));
  }

  const presets: ReadonlyArray<{ label: string; from: string; to: string }> = [
    { label: "Hoy", from: today, to: today },
    { label: "Últimos 7 días", from: shiftDateKey(today, -6), to: today },
    { label: "Últimos 30 días", from: shiftDateKey(today, -29), to: today },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Filtrar por fecha</h2>
          <p className="text-xs text-slate-400">
            El rango afecta el resumen, la conciliación y el detalle diario.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isPending && <span className="text-xs font-medium text-brand">Actualizando…</span>}
          <a
            href={buildExportHref(range, movementFilters, "xlsx")}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            Exportar Excel
          </a>
          <a
            href={buildExportHref(range, movementFilters, "pdf")}
            className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
          >
            Exportar PDF
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const active = preset.from === range.from && preset.to === range.to;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyRange(preset.from, preset.to)}
                disabled={isPending}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  active
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            applyRange(from, to);
          }}
        >
          <label className="block text-xs font-medium text-slate-500">
            Desde
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Hasta
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Aplicar
          </button>
        </form>
      </div>
    </section>
  );
}

// Movement-level detail. This is the ONLY surface narrowed by method / patient:
// per the cashbox accounting rule those filters must never reach the daily
// reconciliation above. Navigation is server-driven and always carries the shared
// from/to range so the date window stays in sync with the summary.
function MovementDetailSection({
  movements,
  range,
  filters,
}: {
  movements: PaymentMovementDetail[];
  range: CashboxRange;
  filters: MovementFilterState;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [method, setMethod] = useState(filters.method);
  const [search, setSearch] = useState(filters.search);

  function apply(nextMethod: string, nextSearch: string) {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (nextMethod) params.set("method", nextMethod);
    const trimmed = nextSearch.trim();
    if (trimmed) params.set("search", trimmed);
    startTransition(() => router.push(`/finance?${params.toString()}`));
  }

  const hasActiveFilters = Boolean(filters.method || filters.search);
  const listedTotal = Math.round(movements.reduce((sum, m) => sum + m.amount, 0) * 100) / 100;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Detalle de movimientos</h2>
            <p className="text-xs text-slate-400">
              Acotado por el rango de fecha de arriba. Método y paciente filtran{" "}
              <strong>solo este detalle</strong>, no la conciliación diaria.
            </p>
          </div>
          {isPending && <span className="text-xs font-medium text-brand">Actualizando…</span>}
        </div>

        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            apply(method, search);
          }}
        >
          <label className="block text-xs font-medium text-slate-500">
            Método
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">Todos</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Paciente
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre o documento"
              className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Aplicar
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setMethod("");
                setSearch("");
                apply("", "");
              }}
              disabled={isPending}
              className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Limpiar
            </button>
          )}
        </form>

        <p className="mt-2 text-xs text-slate-400">
          {movements.length} movimiento{movements.length === 1 ? "" : "s"}
          {" · "}Total listado <span className="text-slate-400">(todos los métodos)</span>{" "}
          <span className="font-semibold tabular-nums text-slate-500">{formatCurrency(listedTotal)}</span>
          {". "}No es la venta bruta efectivo de la conciliación.
        </p>
      </div>

      {movements.length === 0 ? (
        <p className="px-3 py-6 text-sm text-slate-500 sm:px-4">
          No hay movimientos para los filtros seleccionados en este rango.
        </p>
      ) : (
        <MovementDetailTable movements={movements} />
      )}
    </section>
  );
}

function MovementDetailTable({ movements }: { movements: PaymentMovementDetail[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[48rem] w-full border-collapse text-xs sm:text-sm">
        <caption className="sr-only">Detalle de movimientos por paciente, método y monto</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-3 py-2">Fecha</th>
            <th scope="col" className="px-3 py-2">Paciente</th>
            <th scope="col" className="px-3 py-2">Método</th>
            <th scope="col" className="px-3 py-2">Tipo</th>
            <th scope="col" className="px-3 py-2">Banco</th>
            <th scope="col" className="px-3 py-2 text-right">Monto</th>
            <th scope="col" className="px-3 py-2">Nota</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id} className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-600">{formatDate(m.dateKey)}</td>
              <td className="px-3 py-2 text-slate-700">{m.patientName}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-600">{METHOD_LABELS.get(m.method) ?? m.method}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-600">{INCOME_TYPE_LABELS.get(m.incomeType) ?? m.incomeType}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-500">{m.bank ? BANK_LABELS.get(m.bank) ?? m.bank : "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-800">{formatCurrency(m.amount)}</td>
              <td className="px-3 py-2 text-slate-500">{m.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CashboxLegend() {
  const items = [
    { label: "Abonos", color: CASHBOX_COLORS.abonos },
    { label: "Reclamados", color: CASHBOX_COLORS.reclamados },
    { label: "Bancos / electrónicos", color: CASHBOX_COLORS.bancos },
    { label: "Venta neta efectivo", color: CASHBOX_COLORS.ventaNetaEfectivo },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm border border-slate-300"
            style={{ backgroundColor: uiBg(item.color) }}
            aria-hidden="true"
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// Visual treatment for the headline "Diferencia" badge: green when the count is
// over the expected cash, red when short, neutral when it squares or is pending.
function diferenciaBadgeClass(value: number | null): string {
  if (value === null) return "border-slate-200 bg-slate-100 text-slate-500";
  if (value > 0) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value < 0) return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

// Primary cashbox view: surface the daily CASH reconciliation up front so operators
// do not depend on a wide spreadsheet-style table to read the figures that matter:
// net cash, counted cash and the difference.
//
// The chain reads as a single formula: Venta bruta − Egresos = Venta neta, then
// Real contado is compared against it to produce the Diferencia (the headline).
// Bancos / Otros are electronic / ambiguous income, so they sit apart as context
// and never enter the cash difference.
function CashboxReconciliationSummary({
  rows,
  today,
  countsByDay,
}: {
  rows: DailyCashboxRow[];
  today: string;
  countsByDay: Map<string, CashCountDetail>;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-700">Resumen de conciliación</h2>
        <p className="text-xs text-slate-500">
          Lectura rápida de la caja en efectivo: esperado, egresos, neto, real contado y diferencia.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          La <strong className="font-semibold text-slate-500">venta bruta</strong> es el efectivo esperado; la{" "}
          <strong className="font-semibold text-slate-500">diferencia</strong> compara el real contado contra ese
          efectivo, no contra métodos electrónicos. Los pagos con método <strong className="font-semibold text-slate-500">Otro</strong>{" "}
          se muestran aparte y no cuentan como efectivo físico.
        </p>
      </div>

      <div className="grid gap-3">
        {rows.map((row) => (
          <article key={row.date} className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-700">{formatDate(row.date)}</h3>
                {row.date === today && (
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand">
                    Hoy
                  </span>
                )}
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm font-bold ${diferenciaBadgeClass(row.diferencia)}`}
              >
                {row.diferencia === null ? (
                  "Diferencia pendiente"
                ) : (
                  <>
                    <span className="text-[11px] font-semibold uppercase tracking-wide">
                      {diferenciaLabel(row.diferencia)}
                    </span>
                    <span className="tabular-nums">{formatCurrency(row.diferencia)}</span>
                  </>
                )}
              </span>
            </div>

            {/* Cash chain — wraps instead of scrolling so it always stays in view. */}
            <div className="flex flex-wrap items-stretch gap-2">
              <ChainCell label="Venta bruta efectivo" value={row.ventaBruta} />
              <ChainOperator symbol="−" />
              <ChainCell label="Egresos" value={row.egresos} />
              <ChainOperator symbol="=" />
              <ChainCell label="Venta neta efectivo" value={row.ventaNetaEfectivo} highlight />
              <ChainOperator symbol="vs" muted />
              <ChainCell label="Real contado" value={row.realContado} emphasis pendingWhenNull />
            </div>

            <p className="mt-3 text-xs text-slate-400">
              Bancos / electrónicos{" "}
              <span className="font-semibold tabular-nums text-slate-500">{formatCurrency(row.totalBancos)}</span>
              {" · "}Otros (no efectivo){" "}
              <span className="font-semibold tabular-nums text-slate-500">{formatCurrency(row.otros)}</span>
            </p>

            {(() => {
              const count = countsByDay.get(row.date);
              if (!count) return null;
              return (
                <p className="mt-1 text-xs text-slate-400">
                  Real contado registrado el{" "}
                  <span className="font-semibold text-slate-500">{formatTimestamp(count.updatedAt)}</span>
                  {count.note ? (
                    <>
                      {" · "}Observación: <span className="text-slate-500">{count.note}</span>
                    </>
                  ) : null}
                </p>
              );
            })()}
          </article>
        ))}
      </div>
    </section>
  );
}

function ChainCell({
  label,
  value,
  highlight,
  emphasis,
  pendingWhenNull,
}: {
  label: string;
  value: number | null;
  highlight?: boolean;
  emphasis?: boolean;
  pendingWhenNull?: boolean;
}) {
  const isPending = value === null && pendingWhenNull;
  return (
    <div
      className={`min-w-[min(100%,8rem)] flex-1 rounded-md border px-3 py-2 ${
        highlight
          ? "border-amber-200 bg-amber-50"
          : emphasis
            ? "border-slate-300 bg-white shadow-sm"
            : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {isPending ? (
        <p className="mt-1 text-sm font-semibold text-slate-400">Pendiente</p>
      ) : (
        <p
          className={`mt-1 tabular-nums ${
            highlight || emphasis ? "text-base font-bold text-slate-900" : "text-sm font-semibold text-slate-700"
          }`}
        >
          {formatCurrency(value)}
        </p>
      )}
    </div>
  );
}

function ChainOperator({ symbol, muted }: { symbol: string; muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`hidden select-none items-center text-sm font-bold sm:flex ${muted ? "text-slate-300" : "text-slate-400"}`}
    >
      {symbol}
    </span>
  );
}

function CashboxDetailTable({ rows }: { rows: DailyCashboxRow[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Detalle completo</h2>
            <p className="text-xs text-slate-400">
              Abonos, reclamados, bancos, egresos y conciliación por día.
            </p>
          </div>
          <CashboxLegend />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[72rem] w-full border-collapse text-right text-xs sm:text-sm">
          <caption className="sr-only">Detalle completo de caja diaria por método y conciliación</caption>
          <thead>
            <tr>
              <th
                scope="col"
                rowSpan={2}
                className="sticky left-0 z-20 bg-slate-100 px-3 py-2 text-left align-bottom text-[11px] font-bold uppercase tracking-wide text-slate-500 shadow-[1px_0_0_0_rgba(226,232,240,1)]"
              >
                Fecha
              </th>
              {DETAIL_GROUPS.map((group) => (
                <th
                  key={group.label}
                  scope="colgroup"
                  colSpan={group.span}
                  className={`border-l border-white px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide ${
                    group.bg ? "text-slate-700" : "bg-slate-100 text-slate-600"
                  }`}
                  style={group.bg ? { backgroundColor: uiBg(group.bg) } : undefined}
                >
                  {group.label}
                </th>
              ))}
            </tr>
            <tr className="border-b border-slate-200">
              {DETAIL_HEADERS.map((header) => (
                <th
                  key={header.key}
                  scope="col"
                  className="whitespace-nowrap border-l border-white/70 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                  style={header.bg ? { backgroundColor: uiBg(header.bg) } : undefined}
                >
                  {header.label}
                </th>
              ))}
              <th
                scope="col"
                className="whitespace-nowrap border-l border-slate-200 bg-slate-100 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600"
              >
                Diferencia
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className="border-b border-slate-100 last:border-b-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-3 py-3 text-left font-semibold text-slate-700 shadow-[1px_0_0_0_rgba(226,232,240,1)]"
                >
                  {formatDate(row.date)}
                </th>
                {DETAIL_HEADERS.map((header) => {
                  const value = row[header.key] as number | null;
                  const pending = value === null && header.key === "realContado";
                  const tone = pending
                    ? "font-medium italic text-slate-400"
                    : header.strong
                      ? "font-bold text-slate-800 tabular-nums"
                      : "font-medium text-slate-600 tabular-nums";
                  return (
                    <td
                      key={header.key}
                      className={`whitespace-nowrap border-l border-white/70 px-3 py-3 ${tone}`}
                      style={header.bg ? { backgroundColor: uiBg(header.bg) } : undefined}
                    >
                      {pending ? "Pendiente" : formatCurrency(value)}
                    </td>
                  );
                })}
                <td
                  className={`whitespace-nowrap border-l border-slate-200 bg-slate-50 px-3 py-3 font-bold ${
                    row.diferencia === null ? "italic text-slate-400" : `tabular-nums ${diferenciaClass(row.diferencia)}`
                  }`}
                >
                  {row.diferencia === null ? "Pendiente" : formatCurrency(row.diferencia)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Line-item breakdown behind the daily `Egresos` total. Read-only audit: it explains
// what was paid out and why, without ever changing the reconciliation numbers.
function ExpensesAuditSection({ expenses }: { expenses: ExpenseDetail[] }) {
  const total = Math.round(expenses.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-3 sm:px-4">
        <h2 className="text-sm font-semibold text-slate-700">Detalle de egresos</h2>
        <p className="text-xs text-slate-400">
          Desglose de los egresos sumados en la conciliación diaria. Acotado por el rango de fecha;
          no cambia los totales de caja.
        </p>
      </div>

      {expenses.length === 0 ? (
        <p className="px-3 py-6 text-sm text-slate-500 sm:px-4">
          No hay egresos registrados en el rango seleccionado.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[40rem] w-full border-collapse text-xs sm:text-sm">
            <caption className="sr-only">Detalle de egresos por fecha, concepto y monto</caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-3 py-2">Fecha</th>
                <th scope="col" className="px-3 py-2">Concepto</th>
                <th scope="col" className="px-3 py-2 text-right">Monto</th>
                <th scope="col" className="px-3 py-2">Observación</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-600">{formatDate(expense.dateKey)}</td>
                  <td className="px-3 py-2 text-slate-700">{expense.concept}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-800">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{expense.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <th scope="row" colSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                  Total egresos del rango
                </th>
                <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-slate-800">
                  {formatCurrency(total)}
                </td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function ExpenseForm({ today }: { today: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, amount: String(parseFloat(amount)), concept, note: note || undefined }),
      });
      if (response.ok) {
        setAmount("");
        setConcept("");
        setNote("");
        router.refresh();
      } else {
        const json = (await response.json()) as { error?: string };
        setError(json.error ?? "No se pudo registrar el egreso");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Registrar egreso</h2>
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-500">
          Fecha
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Monto
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="ej: 50000"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Concepto
          <input
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="ej: Pago proveedor"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Observación (opcional)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving || !amount || !concept}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Registrando…" : "Registrar egreso"}
        </button>
      </div>
    </form>
  );
}

function CashCountForm({ today }: { today: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [countedAmount, setCountedAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/finance/cash-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, countedAmount: String(parseFloat(countedAmount)), note: note || undefined }),
      });
      if (response.ok) {
        setCountedAmount("");
        setNote("");
        router.refresh();
      } else {
        const json = (await response.json()) as { error?: string };
        setError(json.error ?? "No se pudo guardar el real contado");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Registrar real contado</h2>
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-500">
          Fecha
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Efectivo contado
          <input
            type="number"
            min="0"
            step="0.01"
            value={countedAmount}
            onChange={(e) => setCountedAmount(e.target.value)}
            placeholder="ej: 920000"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Observación (opcional)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving || countedAmount === ""}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar real contado"}
        </button>
      </div>
    </form>
  );
}

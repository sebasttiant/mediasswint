"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { CASHBOX_COLORS, type DailyCashboxRow } from "@/lib/cashbox";

type FinanceClientProps = {
  rows: DailyCashboxRow[];
  today: string;
};

function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return `$${value.toLocaleString("es-CO")}`;
}

function formatDate(dateKey: string): string {
  // dateKey is YYYY-MM-DD; render as DD/MM/YYYY without timezone surprises.
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

function diferenciaClass(value: number | null): string {
  if (value === null) return "text-slate-400";
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-red-600";
  return "text-slate-600";
}

// Column groups mirror the Excel layout. Background colors come from the original
// sheet so the cashbox reads like the source document.
const HEADERS: ReadonlyArray<{ label: string; key: keyof DailyCashboxRow; bg?: string; strong?: boolean }> = [
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
  { label: "Otros (no efectivo)", key: "otros" },
  { label: "Venta Bruta (efectivo)", key: "ventaBruta", strong: true },
  { label: "Egresos", key: "egresos" },
  { label: "Venta neta efectivo", key: "ventaNetaEfectivo", bg: CASHBOX_COLORS.ventaNetaEfectivo, strong: true },
  { label: "Real contado", key: "realContado" },
];

export function FinanceClient({ rows, today }: FinanceClientProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <ExpenseForm today={today} />
        <CashCountForm today={today} />
      </div>

      <CashboxLegend />

      <p className="text-xs text-slate-400">
        La <strong>Venta Bruta</strong> es el efectivo esperado: la <strong>Diferencia</strong> compara
        el real contado contra ese efectivo, no contra métodos electrónicos. Los pagos con método{" "}
        <strong>Otro</strong> se muestran aparte y no cuentan como efectivo físico.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Todavía no hay movimientos registrados. Los abonos nuevos (con método y tipo) aparecerán
          acá automáticamente. Los abonos anteriores a este módulo no se incluyen porque no tienen
          método ni fecha confiable.
        </p>
      ) : (
        <>
          <CashboxTable rows={rows} />
          <CashboxCards rows={rows} />
        </>
      )}
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
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm border border-slate-300"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// Desktop / tablet: full Excel-style table with controlled horizontal scroll.
function CashboxTable({ rows }: { rows: DailyCashboxRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
      <table className="w-full border-collapse text-right text-sm">
        <caption className="sr-only">Caja diaria: ingresos por tipo y método, egresos y conciliación</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 bg-slate-100 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              Fecha
            </th>
            {HEADERS.map((header) => (
              <th
                key={header.key}
                scope="col"
                className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-bold text-slate-600"
                style={header.bg ? { backgroundColor: header.bg } : undefined}
              >
                {header.label}
              </th>
            ))}
            <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-bold text-slate-600">
              Diferencia
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date} className="border-t border-slate-100">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-medium text-slate-700"
              >
                {formatDate(row.date)}
              </th>
              {HEADERS.map((header) => (
                <td
                  key={header.key}
                  className={`whitespace-nowrap px-3 py-2.5 tabular-nums ${header.strong ? "font-semibold text-slate-800" : "text-slate-600"}`}
                  style={header.bg ? { backgroundColor: header.bg } : undefined}
                >
                  {formatCurrency(row[header.key] as number | null)}
                </td>
              ))}
              <td className={`whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums ${diferenciaClass(row.diferencia)}`}>
                {formatCurrency(row.diferencia)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Mobile: stacked cards so nothing overflows or gets cut off.
function CashboxCards({ rows }: { rows: DailyCashboxRow[] }) {
  return (
    <div className="space-y-4 md:hidden">
      {rows.map((row) => (
        <article key={row.date} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-base font-bold text-slate-800">{formatDate(row.date)}</h3>

          <CardGroup title="Abonos" color={CASHBOX_COLORS.abonos}>
            <CardLine label="1 Vez" value={row.primeraVez} />
            <CardLine label="R" value={row.r} />
            <CardLine label="MEFE" value={row.mefe} />
            <CardLine label="Total Abonos" value={row.totalAbonos} strong />
          </CardGroup>

          <CardGroup title="Reclamados" color={CASHBOX_COLORS.reclamados}>
            <CardLine label="Reclamado 1 Vez" value={row.reclamadoPrimeraVez} />
            <CardLine label="Reclamado R" value={row.reclamadoR} />
            <CardLine label="Total Reclamados" value={row.totalReclamados} strong />
          </CardGroup>

          <CardGroup title="Bancos / electrónicos" color={CASHBOX_COLORS.bancos}>
            <CardLine label="Transferencia" value={row.transferencias} />
            <CardLine label="BOLD" value={row.bold} />
            <CardLine label="Tarjeta débito" value={row.tarjetaDebito} />
            <CardLine label="Tarjeta crédito" value={row.tarjetaCredito} />
            <CardLine label="Total bancos" value={row.totalBancos} strong />
          </CardGroup>

          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
            <CardLine label="Otros (no efectivo)" value={row.otros} />
            <CardLine label="Venta Bruta (efectivo)" value={row.ventaBruta} strong />
            <CardLine label="Egresos" value={row.egresos} />
            <div style={{ backgroundColor: CASHBOX_COLORS.ventaNetaEfectivo }} className="-mx-1 rounded px-1">
              <CardLine label="Venta neta efectivo" value={row.ventaNetaEfectivo} strong />
            </div>
            <CardLine label="Real contado" value={row.realContado} />
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-semibold text-slate-700">Diferencia</span>
              <span className={`text-sm font-bold tabular-nums ${diferenciaClass(row.diferencia)}`}>
                {formatCurrency(row.diferencia)}
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function CardGroup({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div
        className="mb-1 rounded px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-700"
        style={{ backgroundColor: color }}
      >
        {title}
      </div>
      <div className="space-y-1 px-1">{children}</div>
    </div>
  );
}

function CardLine({ label, value, strong }: { label: string; value: number | null; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${strong ? "font-semibold text-slate-700" : "text-slate-500"}`}>{label}</span>
      <span className={`text-sm tabular-nums ${strong ? "font-semibold text-slate-800" : "text-slate-600"}`}>
        {formatCurrency(value)}
      </span>
    </div>
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
    <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
    <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

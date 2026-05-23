const OPERATION_BADGE: Record<string, { label: string; className: string }> = {
  PRESUPUESTO: { label: "Presupuesto", className: "bg-amber-100 text-amber-700" },
  CONFIRMADO: { label: "Confirmado", className: "bg-emerald-100 text-emerald-700" },
  EN_PRODUCCION: { label: "En producción", className: "bg-sky-100 text-sky-700" },
  ENTREGADO: { label: "Entregado", className: "bg-violet-100 text-violet-700" },
  CANCELADO: { label: "Cancelado", className: "bg-red-100 text-red-700" },
};

const MEASUREMENT_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "Completada", className: "bg-emerald-100 text-emerald-700" },
  VOID: { label: "Anulada", className: "bg-red-100 text-red-700" },
};

type StatusBadgeProps = {
  status: string;
  variant?: "operation" | "measurement";
};

export function StatusBadge({ status, variant = "operation" }: StatusBadgeProps) {
  const map = variant === "measurement" ? MEASUREMENT_BADGE : OPERATION_BADGE;
  const config = map[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${config.className}`}
    >
      {config.label}
    </span>
  );
}

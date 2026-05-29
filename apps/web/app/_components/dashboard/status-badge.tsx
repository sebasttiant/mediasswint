import { Badge, type BadgeVariant } from "../ui/badge";

const OPERATION_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  PRESUPUESTO: { label: "Presupuesto", variant: "warning" },
  CONFIRMADO: { label: "Confirmado", variant: "success" },
  EN_PRODUCCION: { label: "En producción", variant: "info" },
  ENTREGADO: { label: "Entregado", variant: "violet" },
  CANCELADO: { label: "Cancelado", variant: "danger" },
};

const MEASUREMENT_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: "Borrador", variant: "warning" },
  COMPLETED: { label: "Completada", variant: "success" },
  VOID: { label: "Anulada", variant: "danger" },
};

type StatusBadgeProps = {
  status: string;
  variant?: "operation" | "measurement";
};

export function StatusBadge({ status, variant = "operation" }: StatusBadgeProps) {
  const map = variant === "measurement" ? MEASUREMENT_BADGE : OPERATION_BADGE;
  const config = map[status] ?? { label: status, variant: "neutral" as BadgeVariant };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

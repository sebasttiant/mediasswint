import type { DashboardPendingWorkItem } from "@/lib/dashboard";

import { Badge, type BadgeVariant } from "../ui/badge";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";

type PendingTimelineProps = {
  items: DashboardPendingWorkItem[];
};

const KIND_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  PAYMENT: { label: "Cobro", variant: "warning" },
  PRODUCTION: { label: "Producción", variant: "info" },
  MEASUREMENT: { label: "Medición", variant: "violet" },
};

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `hace ${diffDays}d`;
  if (diffHours > 0) return `hace ${diffHours}h`;
  if (diffMins > 0) return `hace ${diffMins}m`;
  return "ahora";
}

export function PendingTimeline({ items }: PendingTimelineProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No hay trabajo pendiente"
        hint="Cuando haya saldos, producción o mediciones por continuar, aparecen acá."
      />
    );
  }

  return (
    <ol className="relative space-y-0">
      {items.map((item, idx) => {
        const badge = KIND_BADGE[item.kind] ?? { label: item.kind, variant: "neutral" as BadgeVariant };
        const isLast = idx === items.length - 1;

        return (
          <li key={item.id} className="relative flex gap-4 pb-5 last:pb-0">
            {!isLast && (
              <span className="absolute left-3 top-8 h-full w-px bg-slate-200" aria-hidden="true" />
            )}
            <span className="relative mt-1 h-6 w-6 shrink-0 rounded-full border-2 border-slate-300 bg-white" />

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <span className="text-xs text-slate-400">{timeAgo(item.createdAt)}</span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-slate-800">{item.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
              <Button href={item.href} variant="link" size="sm" className="mt-1.5">
                {item.actionLabel} →
              </Button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

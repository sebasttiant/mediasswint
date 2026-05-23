import Link from "next/link";

import type { DashboardPendingWorkItem } from "@/lib/dashboard";

type PendingTimelineProps = {
  items: DashboardPendingWorkItem[];
};

const KIND_BADGE: Record<string, { label: string; className: string }> = {
  PAYMENT: { label: "Cobro", className: "bg-amber-100 text-amber-700" },
  PRODUCTION: { label: "Producción", className: "bg-sky-100 text-sky-700" },
  MEASUREMENT: { label: "Medición", className: "bg-violet-100 text-violet-700" },
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
      <p className="text-sm text-slate-400">No hay trabajo pendiente con las señales disponibles.</p>
    );
  }

  return (
    <ol className="relative space-y-0">
      {items.map((item, idx) => {
        const badge = KIND_BADGE[item.kind] ?? { label: item.kind, className: "bg-slate-100 text-slate-600" };
        const isLast = idx === items.length - 1;

        return (
          <li key={item.id} className="relative flex gap-4 pb-6">
            {/* vertical line */}
            {!isLast && (
              <span className="absolute left-3 top-8 h-full w-px bg-slate-200" aria-hidden="true" />
            )}
            {/* dot */}
            <span className="relative mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white" />

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
                <span className="text-xs text-slate-400">{timeAgo(item.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-800">{item.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
              <Link
                href={item.href}
                className="mt-1.5 inline-block text-xs font-semibold text-brand hover:underline"
              >
                {item.actionLabel} →
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

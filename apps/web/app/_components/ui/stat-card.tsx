import type { ReactNode } from "react";

import { cn } from "./cn";

export function StatCard({
  icon,
  iconClassName = "bg-slate-100 text-slate-500",
  label,
  value,
}: {
  icon?: ReactNode;
  iconClassName?: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {icon ? (
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            iconClassName,
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 font-display text-2xl font-bold leading-tight tabular-nums text-slate-900">
          {value}
        </p>
      </div>
    </div>
  );
}

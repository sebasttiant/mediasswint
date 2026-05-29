import type { ReactNode } from "react";

import { cn } from "./cn";

export function EmptyState({
  icon,
  title,
  hint,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-1 text-slate-300" aria-hidden="true">{icon}</div> : null}
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

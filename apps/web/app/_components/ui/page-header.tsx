import type { ReactNode } from "react";

import { cn } from "./cn";

export function PageHeader({
  title,
  subtitle,
  kicker,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  kicker?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {kicker ? (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-brand/70">
            {kicker}
          </p>
        ) : null}
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 md:text-[1.7rem]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

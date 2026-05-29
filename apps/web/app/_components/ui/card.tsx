import type { ReactNode } from "react";

import { cn } from "./cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4",
        className,
      )}
    >
      <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

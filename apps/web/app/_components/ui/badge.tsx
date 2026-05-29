import type { ReactNode } from "react";

import { cn } from "./cn";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "violet";

const VARIANT: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-600",
  brand: "bg-brand/10 text-brand",
  info: "bg-sky-100 text-sky-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  violet: "bg-violet-100 text-violet-700",
};

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

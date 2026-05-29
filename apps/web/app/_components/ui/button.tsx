import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "link";
type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-1 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white shadow-sm hover:bg-brand-strong hover:shadow",
  secondary: "border border-slate-200 bg-white text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50",
  link: "text-brand hover:underline",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

function classesFor(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return cn(BASE, VARIANT[variant], variant !== "link" && SIZE[size], className);
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

type ButtonAsLink = CommonProps & { href: string };
type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };

export function Button(props: ButtonAsLink | ButtonAsButton) {
  if (props.href !== undefined) {
    const { variant = "link", size = "md", className, children, href } = props;
    return (
      <Link href={href} className={classesFor(variant, size, className)}>
        {children}
      </Link>
    );
  }

  const { variant = "secondary", size = "md", className, children, ...rest } = props;
  return (
    <button className={classesFor(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

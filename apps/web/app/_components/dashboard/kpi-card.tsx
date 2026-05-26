"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Briefcase,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Sparkline } from "./sparkline";

type TrendDirection = "up" | "down" | "neutral";

export const KPI_CARD_ICON = {
  activity: "activity",
  alertCircle: "alertCircle",
  briefcase: "briefcase",
  calendar: "calendar",
  dollarSign: "dollarSign",
  trendingUp: "trendingUp",
  users: "users",
} as const;

export type KpiCardIcon = (typeof KPI_CARD_ICON)[keyof typeof KPI_CARD_ICON];

const KPI_CARD_ICONS: Record<KpiCardIcon, LucideIcon> = {
  activity: Activity,
  alertCircle: AlertCircle,
  briefcase: Briefcase,
  calendar: Calendar,
  dollarSign: DollarSign,
  trendingUp: TrendingUp,
  users: Users,
};

type KpiCardProps = {
  icon: KpiCardIcon;
  label: string;
  value: string | number;
  iconClassName?: string;
  trendDirection?: TrendDirection;
  trendLabel?: string;
  sparklineSeed?: number;
};

const TREND_STYLES: Record<TrendDirection, string> = {
  up: "text-emerald-600",
  down: "text-red-500",
  neutral: "text-slate-400",
};

const TREND_ARROW: Record<TrendDirection, string> = {
  up: "▲",
  down: "▼",
  neutral: "—",
};

export function KpiCard({
  icon: Icon,
  iconClassName = "bg-sky-50 text-sky-600",
  label,
  sparklineSeed,
  trendDirection,
  trendLabel,
  value,
}: KpiCardProps) {
  const ResolvedIcon = KPI_CARD_ICONS[Icon];

  return (
    <motion.div
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      whileHover={{ scale: 1.025, y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>
          <ResolvedIcon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        {trendDirection && trendDirection !== "neutral" && (
          <span className={`text-sm font-semibold ${TREND_STYLES[trendDirection]}`}>
            {TREND_ARROW[trendDirection]}
            {trendLabel ? ` ${trendLabel}` : null}
          </span>
        )}
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="mt-0.5 font-display text-3xl font-bold leading-none text-slate-900">{value}</p>
      </div>

      {sparklineSeed !== undefined && (
        <Sparkline
          className={`opacity-60 ${iconClassName.includes("sky") ? "text-sky-500" : iconClassName.includes("emerald") ? "text-emerald-500" : iconClassName.includes("amber") ? "text-amber-500" : "text-slate-400"}`}
          seed={sparklineSeed}
        />
      )}
    </motion.div>
  );
}

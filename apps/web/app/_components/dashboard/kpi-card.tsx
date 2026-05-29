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

import { StatCard } from "../ui/stat-card";

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
};

export function KpiCard({ icon, iconClassName, label, value }: KpiCardProps) {
  const ResolvedIcon = KPI_CARD_ICONS[icon];

  return (
    <StatCard
      icon={<ResolvedIcon className="h-6 w-6" strokeWidth={2} />}
      iconClassName={iconClassName}
      label={label}
      value={value}
    />
  );
}

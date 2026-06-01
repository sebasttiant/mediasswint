import { createElement, type ReactElement, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Briefcase, ScrollText, ShieldCheck, Users } from "lucide-react";

import type { UserRole } from "@/lib/auth-edge";

import { AppShell } from "../_components/app-shell/app-shell";

import { AdminDashboard } from "./admin-dashboard";

export type AdminViewUser = { fullName: string | null };

export type AdminDestinationKey = "patients" | "operations" | "users" | "audit-log";

export type AdminDestination = {
  key: AdminDestinationKey;
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
};

export const ADMIN_DESTINATIONS: readonly AdminDestination[] = [
  {
    key: "users",
    label: "Usuarios",
    href: "/admin/users",
    description: "Alta, roles y estado de las cuentas.",
    icon: ShieldCheck,
  },
  {
    key: "audit-log",
    label: "Auditoría",
    href: "/admin/audit-log",
    description: "Historial de acciones administrativas.",
    icon: ScrollText,
  },
  {
    key: "patients",
    label: "Pacientes",
    href: "/patients",
    description: "Alta, búsqueda y ficha clínica.",
    icon: Users,
  },
  {
    key: "operations",
    label: "Operaciones",
    href: "/operations",
    description: "Presupuestos, producción y entregas.",
    icon: Briefcase,
  },
] as const;

export type RenderAdminViewArgs = {
  user: AdminViewUser;
  role?: UserRole;
  actions?: ReactNode;
};

export function renderAdminView({ user, role, actions }: RenderAdminViewArgs): ReactElement {
  // eslint-disable-next-line react/no-children-prop -- AppShellProps.children is required, so createElement needs it in props
  return createElement(AppShell, {
    actions,
    role,
    currentPath: "/admin",
    description: "Operativa central: usuarios, auditoría, pacientes y operaciones.",
    kicker: "MEDIASSWINT · Administración",
    title: "Administración",
    userLabel: user.fullName ? `Bienvenido, ${user.fullName}` : "Bienvenido",
    children: createElement(AdminDashboard, { destinations: ADMIN_DESTINATIONS }),
  });
}

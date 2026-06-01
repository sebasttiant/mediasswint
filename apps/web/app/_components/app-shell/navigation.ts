import type { LucideIcon } from "lucide-react";
import { Briefcase, Home, LayoutDashboard, ScrollText, ShieldCheck, Stethoscope, Users } from "lucide-react";

import type { UserRole } from "@/lib/auth-edge";

export type AppShellNavKey =
  | "dashboard"
  | "patients"
  | "measurements"
  | "operations"
  | "admin"
  | "admin-users"
  | "admin-audit";

export type AppShellNavItem = {
  key: AppShellNavKey;
  label: string;
  href: string;
  description: string;
  dashboardHref: "/";
  icon: LucideIcon;
  children?: AppShellNavChild[];
};

export type AppShellNavChild = {
  label: string;
  href: string;
  description: string;
};

export const APP_SHELL_NAVIGATION: AppShellNavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/",
    description: "Resumen operativo y accesos rápidos",
    dashboardHref: "/",
    icon: Home,
  },
  {
    key: "patients",
    label: "Pacientes",
    href: "/patients",
    description: "Alta, búsqueda y ficha clínica",
    dashboardHref: "/",
    icon: Users,
    children: [
      { label: "Buscar o crear paciente", href: "/patients", description: "Abrir el listado clínico" },
      { label: "Ficha del paciente", href: "/patients", description: "Seleccionar un paciente para continuar" },
    ],
  },
  {
    key: "measurements",
    label: "Mediciones",
    href: "/patients",
    description: "Toma, borradores y consulta de medidas",
    dashboardHref: "/",
    icon: Stethoscope,
    children: [
      { label: "Iniciar medición", href: "/patients", description: "Elegir paciente antes de medir" },
      { label: "Continuar borrador", href: "/patients", description: "Abrir paciente con mediciones pendientes" },
    ],
  },
  {
    key: "operations",
    label: "Operaciones",
    href: "/operations",
    description: "Presupuestos, producción y entregas",
    dashboardHref: "/",
    icon: Briefcase,
    children: [
      { label: "Cola operativa", href: "/operations", description: "Ver saldos y producción pendientes" },
      { label: "Crear operación", href: "/patients", description: "Elegir paciente antes de presupuestar" },
    ],
  },
];

// Admin module navigation. Kept separate from APP_SHELL_NAVIGATION so the core
// modules stay role-agnostic; surfaced only to ADMIN via buildAppShellNavGroups.
export const ADMIN_NAVIGATION: AppShellNavItem[] = [
  {
    key: "admin",
    label: "Panel",
    href: "/admin",
    description: "Accesos administrativos",
    dashboardHref: "/",
    icon: LayoutDashboard,
  },
  {
    key: "admin-users",
    label: "Usuarios",
    href: "/admin/users",
    description: "Gestión de cuentas y roles",
    dashboardHref: "/",
    icon: ShieldCheck,
  },
  {
    key: "admin-audit",
    label: "Auditoría",
    href: "/admin/audit-log",
    description: "Historial de acciones administrativas",
    dashboardHref: "/",
    icon: ScrollText,
  },
];

export type AppShellNavGroup = {
  label: string;
  items: AppShellNavItem[];
};

/**
 * Build the sidebar groups for a given role. Core modules are always present;
 * the Administración group is appended only for ADMIN so STAFF never sees the
 * admin tools in navigation.
 */
export function buildAppShellNavGroups(role?: UserRole): AppShellNavGroup[] {
  const groups: AppShellNavGroup[] = [
    {
      label: "Principal",
      items: APP_SHELL_NAVIGATION.filter((item) => item.key === "dashboard"),
    },
    {
      label: "Gestión",
      items: APP_SHELL_NAVIGATION.filter((item) =>
        ["patients", "measurements", "operations"].includes(item.key),
      ),
    },
  ];

  if (role === "ADMIN") {
    groups.push({ label: "Administración", items: ADMIN_NAVIGATION });
  }

  return groups;
}

export function getDashboardNavigationItem(): AppShellNavItem {
  return APP_SHELL_NAVIGATION[0]!;
}

export function findAppShellActiveItem(pathname: string): AppShellNavItem | null {
  if (pathname === "/") return getDashboardNavigationItem();
  if (pathname.startsWith("/admin/users")) {
    return ADMIN_NAVIGATION.find((item) => item.key === "admin-users") ?? null;
  }
  if (pathname.startsWith("/admin/audit-log")) {
    return ADMIN_NAVIGATION.find((item) => item.key === "admin-audit") ?? null;
  }
  if (pathname.startsWith("/admin")) {
    return ADMIN_NAVIGATION.find((item) => item.key === "admin") ?? null;
  }
  if (pathname.includes("/measurements")) {
    return APP_SHELL_NAVIGATION.find((item) => item.key === "measurements") ?? null;
  }
  if (pathname.startsWith("/operations")) {
    return APP_SHELL_NAVIGATION.find((item) => item.key === "operations") ?? null;
  }
  if (pathname.startsWith("/patients")) {
    return APP_SHELL_NAVIGATION.find((item) => item.key === "patients") ?? null;
  }

  return null;
}

export function buildAppShellAriaLabel(item: AppShellNavItem, active: boolean): string {
  return active ? `${item.label}, sección activa` : item.label;
}

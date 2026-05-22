export type AppShellNavKey = "dashboard" | "patients" | "measurements" | "operations";

export type AppShellNavItem = {
  key: AppShellNavKey;
  label: string;
  href: string;
  description: string;
  dashboardHref: "/";
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
  },
  {
    key: "patients",
    label: "Pacientes",
    href: "/patients",
    description: "Alta, búsqueda y ficha clínica",
    dashboardHref: "/",
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
    children: [
      { label: "Cola operativa", href: "/operations", description: "Ver saldos y producción pendientes" },
      { label: "Crear operación", href: "/patients", description: "Elegir paciente antes de presupuestar" },
    ],
  },
];

export function getDashboardNavigationItem(): AppShellNavItem {
  return APP_SHELL_NAVIGATION[0]!;
}

export function findAppShellActiveItem(pathname: string): AppShellNavItem | null {
  if (pathname === "/") return getDashboardNavigationItem();
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

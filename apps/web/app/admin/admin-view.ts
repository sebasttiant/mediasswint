import { createElement, type ReactElement, type ReactNode } from "react";
import Link from "next/link";

import { AppShell } from "../_components/app-shell/app-shell";

export type AdminViewUser = { fullName: string | null };

export type AdminDestinationKey = "patients" | "operations";

export type AdminDestination = {
  key: AdminDestinationKey;
  label: string;
  href: string;
  description: string;
};

export const ADMIN_DESTINATIONS: readonly AdminDestination[] = [
  {
    key: "patients",
    label: "Pacientes",
    href: "/patients",
    description: "Alta, búsqueda y ficha clínica.",
  },
  {
    key: "operations",
    label: "Operaciones",
    href: "/operations",
    description: "Presupuestos, producción y entregas.",
  },
] as const;

export type RenderAdminViewArgs = {
  user: AdminViewUser;
  actions?: ReactNode;
};

function buildDestinationLink(destination: AdminDestination): ReactElement {
  return createElement(
    Link,
    {
      key: destination.key,
      href: destination.href,
      "aria-label": `${destination.label}: ${destination.description}`,
    },
    `${destination.label} — ${destination.description}`,
  );
}

export function renderAdminView({ user, actions }: RenderAdminViewArgs): ReactElement {
  // eslint-disable-next-line react/no-children-prop -- AppShellProps.children is required, so createElement needs it in props
  return createElement(AppShell, {
    actions,
    currentPath: "/admin",
    description: "Operativa central: accesos a pacientes y operaciones.",
    kicker: "MEDIASSWINT · Administración",
    title: "Administración",
    userLabel: user.fullName ? `Bienvenido, ${user.fullName}` : "Bienvenido",
    children: createElement(
      "nav",
      { "aria-label": "Destinos administrativos" },
      ADMIN_DESTINATIONS.map(buildDestinationLink),
    ),
  });
}

import {
  createElement,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";

import { AppShell } from "../_components/app-shell/app-shell";

export type PatientSearchParamValue = string | string[] | null | undefined;

export type PatientsViewUser = { fullName: string | null };

export type RenderPatientsViewArgs = {
  user: PatientsViewUser;
  initialQuery: string;
  PatientsClientComponent: ComponentType<{ initialQuery?: string }>;
  actions?: ReactNode;
};

export function resolveInitialPatientQuery(raw: PatientSearchParamValue): string {
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const trimmed = entry.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return "";
  }

  if (typeof raw !== "string") {
    return "";
  }

  return raw.trim();
}

export function renderPatientsView({
  user,
  initialQuery,
  PatientsClientComponent,
  actions,
}: RenderPatientsViewArgs): ReactElement {
  // eslint-disable-next-line react/no-children-prop -- AppShellProps.children is required, so createElement needs it in props
  return createElement(AppShell, {
    actions,
    currentPath: "/patients",
    description: "Alta, búsqueda y ficha clínica.",
    kicker: "MEDIASSWINT · Pacientes",
    title: "Pacientes",
    userLabel: user.fullName ? `Bienvenido, ${user.fullName}` : "Bienvenido",
    children: createElement(PatientsClientComponent, { initialQuery }),
  });
}

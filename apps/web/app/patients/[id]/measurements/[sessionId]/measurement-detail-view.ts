import { createElement, type ReactElement, type ReactNode } from "react";

import { AppShell } from "../../../../_components/app-shell/app-shell";

export type MeasurementDetailViewUser = { fullName: string | null };

export type MeasurementDetailViewPatient = {
  id: string;
  fullName: string;
  sex: string | null;
  documentType: string | null;
  documentNumber: string | null;
  birthDate: string | Date | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type MeasurementDetailViewMeasurement = {
  id: string;
  patientId: string;
  status: string;
  measuredAt: Date;
  notes: string | null;
  diagnosis: string | null;
  garmentType: string | null;
  compressionClass: string | null;
  values: Record<string, number | null>;
  templateSnapshot: unknown;
};

export const MEASUREMENT_DETAIL_VIEW_KICKER = "MEDIASSWINT · Detalle de medición";

const MEASUREMENT_DETAIL_NOTICE =
  "Solo lectura: vista resumida de la medición tomada.";

export function buildMeasurementDetailNotice(): string {
  return MEASUREMENT_DETAIL_NOTICE;
}

export type RenderMeasurementDetailViewArgs = {
  user: MeasurementDetailViewUser;
  patient: MeasurementDetailViewPatient;
  measurement: MeasurementDetailViewMeasurement;
  children: ReactNode;
  actions?: ReactNode;
};

export function renderMeasurementDetailView({
  user,
  patient,
  measurement,
  children,
  actions,
}: RenderMeasurementDetailViewArgs): ReactElement {
  // eslint-disable-next-line react/no-children-prop -- AppShellProps.children is required, so createElement needs it in props
  return createElement(AppShell, {
    actions,
    currentPath: `/patients/${patient.id}/measurements/${measurement.id}`,
    description: `${patient.fullName} · ${buildMeasurementDetailNotice()}`,
    kicker: MEASUREMENT_DETAIL_VIEW_KICKER,
    title: "Detalle de medición",
    userLabel: user.fullName ? `Bienvenido, ${user.fullName}` : "Bienvenido",
    children,
  });
}

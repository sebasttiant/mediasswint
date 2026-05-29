import {
  createElement,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";

import { AppShell } from "../../_components/app-shell/app-shell";

import {
  buildMeasurementDetailHref,
  type OperationSummary,
  type PatientDetail,
  type PatientMeasurementSummary,
  type PatientTimelineItem,
} from "./patient-detail-helpers";

export type PatientDetailViewUser = { fullName: string | null };

export type PatientDetailSectionKey =
  | "demographics"
  | "clinical"
  | "commercial"
  | "measurements";

export type PatientDetailSection = {
  key: PatientDetailSectionKey;
  label: string;
};

export const PATIENT_DETAIL_SECTIONS: readonly PatientDetailSection[] = [
  { key: "demographics", label: "Datos demográficos" },
  { key: "clinical", label: "Historia clínica" },
  { key: "commercial", label: "Operaciones comerciales" },
  { key: "measurements", label: "Mediciones" },
] as const;

export const MEASUREMENTS_EMPTY_MESSAGE = "Todavía no hay mediciones cargadas.";

export type MeasurementsSectionRow = {
  id: string;
  href: string;
  status: string;
  measuredAt: string;
  garmentType: string | null;
  compressionClass: string | null;
  diagnosis: string | null;
};

export type MeasurementsSectionViewModel =
  | { kind: "empty"; message: string }
  | { kind: "list"; rows: MeasurementsSectionRow[] };

export function buildMeasurementsSectionViewModel(args: {
  recentMeasurements: PatientMeasurementSummary[];
  patientId: string;
}): MeasurementsSectionViewModel {
  if (args.recentMeasurements.length === 0) {
    return { kind: "empty", message: MEASUREMENTS_EMPTY_MESSAGE };
  }

  return {
    kind: "list",
    rows: args.recentMeasurements.map((measurement) => ({
      id: measurement.id,
      href: buildMeasurementDetailHref(args.patientId, measurement.id),
      status: measurement.status,
      measuredAt: measurement.measuredAt,
      garmentType: measurement.garmentType,
      compressionClass: measurement.compressionClass,
      diagnosis: measurement.diagnosis,
    })),
  };
}

export type PatientDetailClientProps = {
  initialPatient: PatientDetail;
  recentMeasurements: PatientMeasurementSummary[];
  timeline: PatientTimelineItem[];
  operations: OperationSummary[];
};

export type RenderPatientDetailViewArgs = {
  user: PatientDetailViewUser;
  patient: PatientDetail;
  recentMeasurements: PatientMeasurementSummary[];
  timeline: PatientTimelineItem[];
  operations: OperationSummary[];
  PatientDetailClientComponent: ComponentType<PatientDetailClientProps>;
  actions?: ReactNode;
};

export const PATIENT_DETAIL_VIEW_KICKER = "MEDIASSWINT · Ficha de paciente";

export function buildPatientDetailDescription(): string {
  return PATIENT_DETAIL_SECTIONS.map((section) => section.label).join(" · ");
}

export function renderPatientDetailView({
  user,
  patient,
  recentMeasurements,
  timeline,
  operations,
  PatientDetailClientComponent,
  actions,
}: RenderPatientDetailViewArgs): ReactElement {
  // eslint-disable-next-line react/no-children-prop -- AppShellProps.children is required, so createElement needs it in props
  return createElement(AppShell, {
    actions,
    currentPath: `/patients/${patient.id}`,
    description: buildPatientDetailDescription(),
    kicker: PATIENT_DETAIL_VIEW_KICKER,
    title: patient.fullName,
    userLabel: user.fullName ? `Bienvenido, ${user.fullName}` : "Bienvenido",
    children: createElement(PatientDetailClientComponent, {
      initialPatient: patient,
      recentMeasurements,
      timeline,
      operations,
    }),
  });
}

import {
  createElement,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";

import type { UserRole } from "@/lib/auth-edge";

import { AppShell } from "../../_components/app-shell/app-shell";

import {
  buildMeasurementEditHref,
  buildMeasurementDetailHref,
  type OperationSummary,
  type PatientDetail,
  type PatientMeasurementSummary,
  type PatientTimelineItem,
} from "./patient-detail-helpers";

export type PatientDetailViewUser = { fullName: string | null; role?: UserRole };

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
      href: measurement.status === "DRAFT"
        ? buildMeasurementEditHref(args.patientId, measurement.id)
        : buildMeasurementDetailHref(args.patientId, measurement.id),
      status: measurement.status,
      measuredAt: measurement.measuredAt,
      garmentType: measurement.garmentType,
      compressionClass: measurement.compressionClass,
      diagnosis: measurement.diagnosis,
    })),
  };
}

const CANCELLED_OPERATION_STATUS = "CANCELADO";

export type OperationFinancials = {
  total: number;
  deposit: number;
  pendingBalance: number;
  hasTotal: boolean;
  isCancelled: boolean;
  isFullyPaid: boolean;
  canEdit: boolean;
  canDeposit: boolean;
};

/**
 * Pure financial + action-availability model for a single commercial operation.
 * Keeps the deposit/balance math and the CANCELADO guards out of the JSX so they
 * can be unit-tested. `pendingBalance` is floored at 0 to mirror the server-side
 * `getOperationPendingBalance` helper.
 */
export function buildOperationFinancials(
  operation: Pick<OperationSummary, "status" | "totalAmount" | "depositPaid">,
): OperationFinancials {
  const hasTotal = operation.totalAmount != null && operation.totalAmount !== "";
  const total = hasTotal ? Number(operation.totalAmount) : 0;
  const deposit = Number(operation.depositPaid);
  const pendingBalance = Math.max(total - deposit, 0);
  const isCancelled = operation.status === CANCELLED_OPERATION_STATUS;
  const isFullyPaid = hasTotal && pendingBalance === 0;

  return {
    total,
    deposit,
    pendingBalance,
    hasTotal,
    isCancelled,
    isFullyPaid,
    // CANCELADO is terminal: no mutations allowed (mirrors updateOperation).
    canEdit: !isCancelled,
    // A deposit is only meaningful while there is room left to pay. Operations
    // without a total have no ceiling, so deposits stay allowed.
    canDeposit: !isCancelled && (!hasTotal || pendingBalance > 0),
  };
}

export type CommercialOperationsSummary = {
  totalCount: number;
  totalAmount: number;
  totalDeposit: number;
  totalBalance: number;
};

/**
 * Aggregates the patient's active commercial operations for the section header.
 * CANCELADO operations are excluded so the totals reflect real outstanding work.
 */
export function buildCommercialSummary(operations: OperationSummary[]): CommercialOperationsSummary {
  return operations.reduce<CommercialOperationsSummary>(
    (acc, operation) => {
      const financials = buildOperationFinancials(operation);
      if (financials.isCancelled) return acc;

      return {
        totalCount: acc.totalCount + 1,
        totalAmount: acc.totalAmount + financials.total,
        totalDeposit: acc.totalDeposit + financials.deposit,
        totalBalance: acc.totalBalance + financials.pendingBalance,
      };
    },
    { totalCount: 0, totalAmount: 0, totalDeposit: 0, totalBalance: 0 },
  );
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
    role: user.role,
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

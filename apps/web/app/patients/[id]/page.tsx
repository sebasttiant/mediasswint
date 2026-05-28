import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ComponentType, ReactElement } from "react";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { getDefaultMeasurementsRepository, listPatientMeasurements } from "@/lib/measurements";
import { buildPatientTimeline } from "@/lib/patient-timeline";
import { getPatient } from "@/lib/patients";

import { LogoutButton } from "../../_components/logout-button";

import type {
  OperationSummary,
  PatientDetail,
  PatientMeasurementSummary,
  PatientTimelineItem,
} from "./patient-detail-helpers";
import { resolvePatientDetailLoad } from "./patient-detail-loading";
import {
  renderPatientDetailView,
  type PatientDetailClientProps,
} from "./patient-detail-view";

export type PatientDetailAuthUser = {
  id: string;
  role: string;
  fullName: string | null;
};

type Params = {
  params: Promise<{ id: string }>;
};

type PatientDetailRenderData = {
  patient: PatientDetail;
  recentMeasurements: PatientMeasurementSummary[];
  timeline: PatientTimelineItem[];
  operations: OperationSummary[];
};

export type PatientDetailDataDecision =
  | { action: "redirect"; location: "/login" }
  | { action: "notFound" }
  | { action: "throw" }
  | { action: "render"; data: PatientDetailRenderData };

export type PatientDetailPageDeps = {
  readUser?: () => Promise<PatientDetailAuthUser | null>;
  loadClient?: () => Promise<{ default: ComponentType<PatientDetailClientProps> }>;
  resolveData?: (
    id: string,
    user: PatientDetailAuthUser | null,
  ) => Promise<PatientDetailDataDecision>;
};

async function defaultReadUser(id: string): Promise<PatientDetailAuthUser | null> {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request(`http://localhost/patients/${encodeURIComponent(id)}`, {
    headers: sessionCookie
      ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` }
      : undefined,
  });
  return requireActiveUserFromRequest(request);
}

async function defaultResolveData(
  id: string,
  user: PatientDetailAuthUser | null,
): Promise<PatientDetailDataDecision> {
  const patientResult = user
    ? await getPatient(id)
    : ({ ok: false, error: "UNKNOWN" } as const);
  const decision = resolvePatientDetailLoad(user, patientResult);

  if (decision.action !== "render") {
    return decision;
  }

  const measurementsResult = await listPatientMeasurements(
    id,
    { limit: 5 },
    getDefaultMeasurementsRepository(),
  );
  const recentMeasurements = measurementsResult.ok
    ? measurementsResult.value.map((measurement) => ({
        id: measurement.id,
        status: measurement.status,
        measuredAt: measurement.measuredAt.toISOString(),
        garmentType: measurement.garmentType,
        compressionClass: measurement.compressionClass,
        diagnosis: measurement.diagnosis,
      }))
    : [];
  const timeline = buildPatientTimeline(
    decision.patient,
    measurementsResult.ok ? measurementsResult.value : [],
  ).map((event) => ({
    id: event.id,
    type: event.type,
    occurredAt: event.occurredAt.toISOString(),
    title: event.title,
    description: event.description,
    measurementId: event.measurementId,
  }));

  const { listOperations } = await import("@/lib/operations");
  const operationsResult = await listOperations(id);
  const operations: OperationSummary[] = operationsResult.ok
    ? operationsResult.value.map((op) => ({
        id: op.id,
        status: op.status,
        totalAmount: op.totalAmount?.toString() ?? null,
        depositPaid: op.depositPaid.toString(),
        garmentType: op.garmentType,
        notes: op.notes,
        createdAt: op.createdAt.toISOString(),
        updatedAt: op.updatedAt.toISOString(),
      }))
    : [];

  return {
    action: "render",
    data: {
      patient: decision.patient,
      recentMeasurements,
      timeline,
      operations,
    },
  };
}

const defaultLoadClient: NonNullable<PatientDetailPageDeps["loadClient"]> = () =>
  import("./patient-detail-client");

export async function PatientDetailPage(
  { params }: Params,
  deps: PatientDetailPageDeps = {},
): Promise<ReactElement> {
  const { id } = await params;

  const readUser = deps.readUser ?? (() => defaultReadUser(id));
  const resolveData = deps.resolveData ?? defaultResolveData;
  const loadClient = deps.loadClient ?? defaultLoadClient;

  const user = await readUser();
  const decision = await resolveData(id, user);

  if (decision.action === "redirect") {
    redirect(decision.location);
  }
  if (decision.action === "notFound") {
    notFound();
  }
  if (decision.action === "throw") {
    throw new Error("Unable to load patient detail");
  }

  const { default: PatientDetailClientComponent } = await loadClient();

  return renderPatientDetailView({
    user: { fullName: user!.fullName },
    patient: decision.data.patient,
    recentMeasurements: decision.data.recentMeasurements,
    timeline: decision.data.timeline,
    operations: decision.data.operations,
    PatientDetailClientComponent,
    actions: <LogoutButton />,
  });
}

export default PatientDetailPage;

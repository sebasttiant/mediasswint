import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ComponentType, ReactElement } from "react";

import { LogoutButton } from "@/app/_components/logout-button";
import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import {
  getDefaultMeasurementsRepository,
  getMeasurement,
  type MeasurementSessionDetail,
} from "@/lib/measurements";
import { getPatient } from "@/lib/patients";
import type { Patient } from "@prisma/client";

import { resolvePatientDetailLoad } from "../../patient-detail-loading";
import {
  renderMeasurementDetailView,
  type MeasurementDetailViewMeasurement,
  type MeasurementDetailViewPatient,
  type MeasurementDetailViewUser,
} from "./measurement-detail-view";

type Params = {
  params: Promise<{ id: string; sessionId: string }>;
};

export type MeasurementDetailAuthUser = {
  id: string;
  role: string;
  fullName: string | null;
};

type PatientLoadResult =
  | { ok: true; value: Patient }
  | { ok: false; error: "NOT_FOUND" | "UNKNOWN" | "CONFLICT" };

type MeasurementLoadResult =
  | { ok: true; value: MeasurementSessionDetail }
  | { ok: false; error: "NOT_FOUND" };

type MeasurementDetailBodyProps = {
  patient: MeasurementDetailViewPatient;
  measurement: MeasurementDetailViewMeasurement;
};

export type MeasurementDetailPageDeps = {
  readUser?: () => Promise<MeasurementDetailAuthUser | null>;
  loadPatient?: (id: string) => Promise<PatientLoadResult>;
  loadMeasurement?: (sessionId: string, patientId: string) => Promise<MeasurementLoadResult>;
  loadBody?: () => Promise<{ default: ComponentType<MeasurementDetailBodyProps> }>;
};

async function defaultReadUser(
  id: string,
  sessionId: string,
): Promise<MeasurementDetailAuthUser | null> {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request(
    `http://localhost/patients/${encodeURIComponent(id)}/measurements/${encodeURIComponent(sessionId)}`,
    {
      headers: sessionCookie
        ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` }
        : undefined,
    },
  );
  return requireActiveUserFromRequest(request);
}

async function defaultLoadMeasurement(
  sessionId: string,
  patientId: string,
): Promise<MeasurementLoadResult> {
  const result = await getMeasurement(sessionId, getDefaultMeasurementsRepository());
  if (!result.ok || result.value.patientId !== patientId) {
    return { ok: false, error: "NOT_FOUND" };
  }
  return { ok: true, value: result.value };
}

const defaultLoadBody: NonNullable<MeasurementDetailPageDeps["loadBody"]> = () =>
  import("./measurement-detail-body");

export async function MeasurementDetailPage(
  { params }: Params,
  deps: MeasurementDetailPageDeps = {},
): Promise<ReactElement> {
  const { id, sessionId } = await params;

  const readUser = deps.readUser ?? (() => defaultReadUser(id, sessionId));
  const loadPatient = deps.loadPatient ?? getPatient;
  const loadMeasurement = deps.loadMeasurement ?? defaultLoadMeasurement;
  const loadBody = deps.loadBody ?? defaultLoadBody;

  const user = await readUser();
  const patientResult = user
    ? await loadPatient(id)
    : ({ ok: false, error: "UNKNOWN" } as const);
  const decision = resolvePatientDetailLoad(user, patientResult);

  if (decision.action === "redirect") redirect(decision.location);
  if (decision.action === "notFound") notFound();
  if (decision.action === "throw") throw new Error("Unable to load patient detail");

  const measurementResult = await loadMeasurement(sessionId, id);
  if (!measurementResult.ok) notFound();

  const { default: MeasurementDetailBody } = await loadBody();

  const viewUser: MeasurementDetailViewUser = { fullName: user!.fullName };

  return renderMeasurementDetailView({
    user: viewUser,
    patient: decision.patient,
    measurement: measurementResult.value,
    actions: <LogoutButton />,
    children: (
      <MeasurementDetailBody
        patient={decision.patient}
        measurement={measurementResult.value}
      />
    ),
  });
}

export default MeasurementDetailPage;

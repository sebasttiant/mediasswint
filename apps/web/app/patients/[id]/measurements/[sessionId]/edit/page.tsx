import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import {
  getDefaultMeasurementsRepository,
  getMeasurement,
} from "@/lib/measurements";
import { getMeasurementSnapshotPatientSex } from "@/lib/body-figure-sex";
import { getPatient } from "@/lib/patients";

import { resolvePatientDetailLoad } from "../../../patient-detail-loading";
import NewMeasurementClient from "../../new/new-measurement-client";
import { resolveDraftEditAccess } from "./edit-access";

type Params = {
  params: Promise<{ id: string; sessionId: string }>;
};

export default async function EditMeasurementPage({ params }: Params) {
  const { id, sessionId } = await params;
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request(
    `http://localhost/patients/${encodeURIComponent(id)}/measurements/${encodeURIComponent(sessionId)}/edit`,
    {
      headers: sessionCookie ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` } : undefined,
    },
  );
  const user = await requireActiveUserFromRequest(request);
  const patientResult = user ? await getPatient(id) : { ok: false as const, error: "UNKNOWN" as const };
  const decision = resolvePatientDetailLoad(user, patientResult);

  if (decision.action === "redirect") redirect(decision.location);
  if (decision.action === "notFound") notFound();
  if (decision.action === "throw") throw new Error("Unable to load patient detail");

  const measurement = await getMeasurement(sessionId, getDefaultMeasurementsRepository());
  const access = resolveDraftEditAccess(id, measurement);
  if (access.action === "notFound") notFound();

  return (
    <NewMeasurementClient
      patientId={decision.patient.id}
      patientName={decision.patient.fullName}
      patientSex={getMeasurementSnapshotPatientSex(access.detail.metadata) ?? decision.patient.sex}
      initialDraft={{
        id: access.detail.id,
        templateSnapshot: access.templateSnapshot,
        valuesByKey: access.detail.values,
        measuredAt: access.detail.measuredAt,
        garmentType: access.detail.garmentType,
        compressionClass: access.detail.compressionClass,
        diagnosis: access.detail.diagnosis,
        notes: access.detail.notes,
        patientSex: getMeasurementSnapshotPatientSex(access.detail.metadata) ?? decision.patient.sex,
        metadata: access.detail.metadata as Record<string, unknown> | null,
      }}
    />
  );
}

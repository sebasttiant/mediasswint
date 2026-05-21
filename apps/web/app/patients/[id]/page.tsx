import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { getDefaultMeasurementsRepository, listPatientMeasurements } from "@/lib/measurements";
import { buildPatientTimeline } from "@/lib/patient-timeline";
import { getPatient } from "@/lib/patients";

import PatientDetailClient from "./patient-detail-client";
import { resolvePatientDetailLoad } from "./patient-detail-loading";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function PatientDetailPage({ params }: Params) {
  const { id } = await params;
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request(`http://localhost/patients/${encodeURIComponent(id)}`, {
    headers: sessionCookie ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` } : undefined,
  });
  const user = await requireActiveUserFromRequest(request);
  const patientResult = user ? await getPatient(id) : { ok: false as const, error: "UNKNOWN" as const };
  const decision = resolvePatientDetailLoad(user, patientResult);

  if (decision.action === "redirect") {
    redirect(decision.location);
  }

  if (decision.action === "notFound") {
    notFound();
  }

  if (decision.action === "throw") {
    throw new Error("Unable to load patient detail");
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

  // Dynamic import to avoid build-time DB connection
  const { listOperations } = await import("@/lib/operations");
  const operationsResult = await listOperations(id);
  const operations = operationsResult.ok
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

  return (
    <PatientDetailClient
      initialPatient={decision.patient}
      recentMeasurements={recentMeasurements}
      timeline={timeline}
      operations={operations}
    />
  );
}

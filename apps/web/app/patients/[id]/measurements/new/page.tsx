import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { getPatient } from "@/lib/patients";

import { resolvePatientDetailLoad } from "../../patient-detail-loading";
import NewMeasurementClient from "./new-measurement-client";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function NewMeasurementPage({ params }: Params) {
  const { id } = await params;
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request(`http://localhost/patients/${encodeURIComponent(id)}/measurements/new`, {
    headers: sessionCookie ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` } : undefined,
  });
  const user = await requireActiveUserFromRequest(request);
  const patientResult = user ? await getPatient(id) : { ok: false as const, error: "UNKNOWN" as const };
  const decision = resolvePatientDetailLoad(user, patientResult);

  if (decision.action === "redirect") redirect(decision.location);
  if (decision.action === "notFound") notFound();
  if (decision.action === "throw") throw new Error("Unable to load patient detail");

  return <NewMeasurementClient patientId={decision.patient.id} patientName={decision.patient.fullName} />;
}

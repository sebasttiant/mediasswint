import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";

import PatientsClient from "./patients-client";

export default async function PatientsPage() {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request("http://localhost/patients", {
    headers: sessionCookie ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` } : undefined,
  });
  const user = await requireActiveUserFromRequest(request);

  if (!user) {
    redirect("/login");
  }

  return <PatientsClient />;
}

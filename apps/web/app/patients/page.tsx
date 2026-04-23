import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionCookieName, verifySessionToken } from "@/lib/auth";

import PatientsClient from "./patients-client";

export default async function PatientsPage() {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const session = await verifySessionToken(sessionCookie);

  if (!session) {
    redirect("/login");
  }

  return <PatientsClient />;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionCookieName, verifySessionToken } from "@/lib/auth";

export default async function Home() {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const session = await verifySessionToken(sessionCookie);

  if (session) {
    redirect("/patients");
  }

  redirect("/login");
}

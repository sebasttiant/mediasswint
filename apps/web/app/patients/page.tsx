import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ComponentType, ReactElement } from "react";

import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";

import {
  renderPatientsView,
  resolveInitialPatientQuery,
  type PatientsViewUser,
} from "./patient-search-params";

type PatientsPageProps = {
  searchParams?: Promise<{ q?: string | string[] }>;
};

export type PatientsPageDeps = {
  readUser?: () => Promise<PatientsViewUser | null>;
  loadClient?: () => Promise<{ default: ComponentType<{ initialQuery?: string }> }>;
};

async function defaultReadUser(): Promise<PatientsViewUser | null> {
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request("http://localhost/patients", {
    headers: sessionCookie ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` } : undefined,
  });
  return requireActiveUserFromRequest(request);
}

const defaultLoadClient: NonNullable<PatientsPageDeps["loadClient"]> = () => import("./patients-client");

export async function PatientsPage(
  { searchParams }: PatientsPageProps,
  deps: PatientsPageDeps = {},
): Promise<ReactElement> {
  const readUser = deps.readUser ?? defaultReadUser;
  const user = await readUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedParams = (await searchParams) ?? {};
  const initialQuery = resolveInitialPatientQuery(resolvedParams.q);

  const loadClient = deps.loadClient ?? defaultLoadClient;
  const { default: PatientsClientComponent } = await loadClient();

  return renderPatientsView({
    user,
    initialQuery,
    PatientsClientComponent,
  });
}

export default PatientsPage;

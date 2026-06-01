import { withAuth } from "@/lib/with-auth";

import { handleDuplicateMeasurementRequest, type MeasurementSessionDeps } from "../route";

type Params = {
  params: Promise<{ id: string; sessionId: string }>;
};

export type DuplicateMeasurementSessionDeps = MeasurementSessionDeps;

export const POST = withAuth<Params>(async (request, ctx, { user }) =>
  handleDuplicateMeasurementRequest(request, ctx, user),
);

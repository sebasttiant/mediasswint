import { withAdminAuth } from "@/lib/with-auth";

import { handleReopenMeasurementRequest, type MeasurementSessionDeps } from "../route";

type Params = {
  params: Promise<{ id: string; sessionId: string }>;
};

export type ReopenMeasurementSessionDeps = MeasurementSessionDeps;

// Admin-only: reopening a completed measurement is a privileged correction.
export const POST = withAdminAuth<Params>(async (request, ctx, { user }) =>
  handleReopenMeasurementRequest(request, ctx, user),
);

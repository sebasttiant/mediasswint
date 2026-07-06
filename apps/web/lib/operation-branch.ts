// Business branches (sucursales) where a commercial operation can be taken.
// Controlled vocabulary defined by the client. Values mirror the Prisma
// `OperationBranch` enum exactly; kept as a plain const so it is usable from
// client components without importing @prisma/client.
export const OPERATION_BRANCH_VALUES = ["CENTRO", "HSVP", "ITAGUI", "TERMINAL"] as const;

export type OperationBranchValue = (typeof OPERATION_BRANCH_VALUES)[number];

// Human labels for display. ITAGUI stores ASCII; the label carries the accent.
export const OPERATION_BRANCH_LABELS: Record<OperationBranchValue, string> = {
  CENTRO: "Centro",
  HSVP: "HSVP",
  ITAGUI: "Itagüí",
  TERMINAL: "Terminal",
};

export function isOperationBranch(value: unknown): value is OperationBranchValue {
  return typeof value === "string" && (OPERATION_BRANCH_VALUES as readonly string[]).includes(value);
}

// Display helper: map a stored branch value to its label, or null when absent.
export function formatOperationBranch(value: string | null | undefined): string | null {
  if (!value) return null;
  return isOperationBranch(value) ? OPERATION_BRANCH_LABELS[value] : value;
}

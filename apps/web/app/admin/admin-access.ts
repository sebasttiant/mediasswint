import type { UserRole } from "@/lib/auth";

export type AdminAccessUser = {
  id: string;
  role: UserRole;
};

export type AdminAccessDecision =
  | { allowed: true }
  | { allowed: false; redirectTo: "/login" | "/patients" };

export function resolveAdminAccess(user: AdminAccessUser | null): AdminAccessDecision {
  if (!user) {
    return { allowed: false, redirectTo: "/login" };
  }

  if (user.role !== "ADMIN") {
    return { allowed: false, redirectTo: "/patients" };
  }

  return { allowed: true };
}

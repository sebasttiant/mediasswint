import { AsyncLocalStorage } from "node:async_hooks";

import type { AuthUser } from "@/lib/auth";

/**
 * Per-request audit context propagated through AsyncLocalStorage.
 *
 * `withAuth` enters the context after authenticating the request, so any
 * downstream service code (patient mutation, operation create, etc.) can ask
 * for the current actor without threading `user` through every signature.
 *
 * The store is undefined when no request is in flight (seed scripts,
 * migrations, the auth-bootstrap container). Audit writes degrade to a
 * `userId: null` row in that case — the mutation is still recorded, just
 * without an actor attribution.
 */
export type AuditContext = {
  user: AuthUser;
};

const storage = new AsyncLocalStorage<AuditContext>();

export function getAuditContext(): AuditContext | undefined {
  return storage.getStore();
}

export function getAuditUserId(): string | null {
  return storage.getStore()?.user.id ?? null;
}

export function runWithAuditContext<T>(context: AuditContext, fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(context, fn);
}

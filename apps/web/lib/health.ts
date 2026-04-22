export type ServiceStatus =
  | { ok: true; latency_ms: number }
  | { ok: false; error: string };

export type HealthPayload = {
  app: { ok: true };
  services: {
    postgres: ServiceStatus;
    redis: ServiceStatus;
  };
};

export function getHealthHttpStatus(payload: HealthPayload): 200 | 503 {
  return payload.services.postgres.ok && payload.services.redis.ok ? 200 : 503;
}

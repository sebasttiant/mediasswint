import { NextResponse } from "next/server";
import { Client as PgClient } from "pg";
import { createClient as createRedisClient } from "redis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ServiceStatus =
  | { ok: true; latency_ms: number }
  | { ok: false; error: string };

type HealthPayload = {
  app: { ok: true };
  services: {
    postgres: ServiceStatus;
    redis: ServiceStatus;
  };
};

async function checkPostgres(): Promise<ServiceStatus> {
  const url = process.env.DATABASE_URL;
  if (!url) return { ok: false, error: "DATABASE_URL is not set" };

  const client = new PgClient({ connectionString: url });
  const start = Date.now();
  try {
    await client.connect();
    await client.query("SELECT 1");
    return { ok: true, latency_ms: Date.now() - start };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  } finally {
    await client.end().catch(() => {});
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  const url = process.env.REDIS_URL;
  if (!url) return { ok: false, error: "REDIS_URL is not set" };

  const client = createRedisClient({ url });
  const start = Date.now();
  try {
    await client.connect();
    const pong = await client.ping();
    if (pong !== "PONG") {
      return { ok: false, error: `unexpected PING reply: ${pong}` };
    }
    return { ok: true, latency_ms: Date.now() - start };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  } finally {
    await client.quit().catch(() => {});
  }
}

export async function GET() {
  const [postgres, redis] = await Promise.all([checkPostgres(), checkRedis()]);

  const payload: HealthPayload = {
    app: { ok: true },
    services: { postgres, redis },
  };

  const allOk = postgres.ok && redis.ok;
  return NextResponse.json(payload, { status: allOk ? 200 : 503 });
}

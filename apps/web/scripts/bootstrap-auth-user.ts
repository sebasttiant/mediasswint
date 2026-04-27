import "dotenv/config";

import { bootstrapAuthUser } from "@/lib/auth";

async function main() {
  const email = process.env.AUTH_USER?.trim();
  const password = process.env.AUTH_PASSWORD?.trim();

  if (!email || !password) {
    console.error("[auth:bootstrap] AUTH_USER and AUTH_PASSWORD must be set");
    process.exitCode = 1;
    return;
  }

  const user = await bootstrapAuthUser({ email, password });
  console.log(`[auth:bootstrap] provisioned user ${user.email} (${user.id})`);
}

main().catch((error) => {
  console.error("[auth:bootstrap] failed", error);
  process.exitCode = 1;
});

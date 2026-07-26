const DISPOSABLE_DATABASE_PATTERN = /_probe(?:\?|$)/u;

export function assertDisposableIntegrationDatabaseUrl(url) {
  if (typeof url !== "string" || !DISPOSABLE_DATABASE_PATTERN.test(url)) {
    throw new Error(
      "INTEGRATION_DATABASE_URL must target an explicitly disposable *_probe database.",
    );
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  assertDisposableIntegrationDatabaseUrl(process.env["INTEGRATION_DATABASE_URL"]);
}

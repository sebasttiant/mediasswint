const DISPOSABLE_DATABASE_PATH_PATTERN = /^\/[^/]+_probe$/u;

export function assertDisposableIntegrationDatabaseUrl(url) {
  if (typeof url !== "string") {
    throw new Error(
      "INTEGRATION_DATABASE_URL must target an explicitly disposable *_probe database.",
    );
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      "INTEGRATION_DATABASE_URL must target an explicitly disposable *_probe database.",
    );
  }

  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(parsed.pathname);
  } catch {
    throw new Error(
      "INTEGRATION_DATABASE_URL must target an explicitly disposable *_probe database.",
    );
  }

  if (
    (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") ||
    !DISPOSABLE_DATABASE_PATH_PATTERN.test(decodedPathname)
  ) {
    throw new Error(
      "INTEGRATION_DATABASE_URL must target an explicitly disposable *_probe database.",
    );
  }
}

export function isDisposableIntegrationDatabaseUrl(url) {
  try {
    assertDisposableIntegrationDatabaseUrl(url);
    return true;
  } catch {
    return false;
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  assertDisposableIntegrationDatabaseUrl(process.env["INTEGRATION_DATABASE_URL"]);
}

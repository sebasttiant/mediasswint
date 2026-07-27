/**
 * Single source of truth for "is this database safe to TRUNCATE and re-seed?".
 *
 * Shared by the CLI safety script, the integration suites and the CI gate, so
 * the three can never disagree about what counts as disposable.
 *
 * The database NAME is a naming convention anyone can satisfy — the audit found
 * that `postgresql://user:pass@production.example/production_probe` passed a
 * suffix-only check while pointing straight at a remote host. So the HOST is
 * what actually decides disposability, and the suffix is only a second signal.
 *
 * Every failure mode fails CLOSED.
 */

/** Loopback forms only. Everything else must be named explicitly. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Env var naming the ephemeral CI service host. It is a CI-only escape hatch:
 * it must match the hostname EXACTLY, never as a substring or suffix.
 */
const ALLOWED_HOSTS_ENV = "INTEGRATION_DB_ALLOWED_HOSTS";

const DISPOSABLE_DATABASE_PATH_PATTERN = /^\/[^/]+_probe$/u;

function fail(message) {
  throw new Error(
    `INTEGRATION_DATABASE_URL must target an explicitly disposable *_probe database: ${message}`,
  );
}

function parseAllowedHosts(allowedHosts) {
  const raw =
    allowedHosts !== undefined ? allowedHosts : (process.env[ALLOWED_HOSTS_ENV] ?? "");
  const list = Array.isArray(raw) ? raw : String(raw).split(",");
  return new Set(list.map((host) => host.trim().toLowerCase()).filter((host) => host.length > 0));
}

/**
 * `new URL()` keeps IPv6 hosts bracketed in `.hostname`; strip the brackets so
 * `[::1]` compares equal to the `::1` in the allow-list.
 */
function normalizeHostname(hostname) {
  const lowered = hostname.toLowerCase();
  return lowered.startsWith("[") && lowered.endsWith("]") ? lowered.slice(1, -1) : lowered;
}

export function assertDisposableIntegrationDatabaseUrl(url, options = {}) {
  if (typeof url !== "string" || url.trim() === "") {
    fail("no URL was configured");
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail("the URL could not be parsed");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    fail(`unsupported protocol ${parsed.protocol}`);
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (hostname === "") {
    fail("the URL carries no host");
  }

  // Checked BEFORE the database name so a remote target can never be excused by
  // a convention-satisfying suffix.
  const allowedHosts = parseAllowedHosts(options.allowedHosts);
  if (!LOOPBACK_HOSTS.has(hostname) && !allowedHosts.has(hostname)) {
    fail(
      `host ${hostname} is not disposable — allow it explicitly via ${ALLOWED_HOSTS_ENV} if it is an ephemeral CI service`,
    );
  }

  // Only the PATHNAME counts. `?schema=x_probe` and `#x_probe` live outside it,
  // so neither can smuggle the suffix past this check.
  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(parsed.pathname);
  } catch {
    fail("the database path could not be decoded");
  }

  if (!DISPOSABLE_DATABASE_PATH_PATTERN.test(decodedPathname)) {
    fail("the database name does not end in _probe");
  }
}

export function isDisposableIntegrationDatabaseUrl(url, options = {}) {
  try {
    assertDisposableIntegrationDatabaseUrl(url, options);
    return true;
  } catch {
    return false;
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  assertDisposableIntegrationDatabaseUrl(process.env["INTEGRATION_DATABASE_URL"]);
}

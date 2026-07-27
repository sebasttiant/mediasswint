import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { isDisposableIntegrationDatabaseUrl } from "../scripts/assert-disposable-integration-db.mjs";

/**
 * The CI workflows used to commit complete connection URLs of the shape
 * `postgresql://ci:ci@localhost:5432/mediass_ci_probe`. The service they name is
 * ephemeral, but a committed credential-shaped literal is still worth avoiding:
 * it normalises the pattern, and gitleaks-style scanning cannot tell an
 * ephemeral one from a real one.
 *
 * These assertions read the workflows as text on purpose — the point is what is
 * COMMITTED, not what a YAML parser can reconstruct.
 */

const WORKFLOWS = ["ci-pr.yml", "ci-main.yml"] as const;

/** `scheme://user:secret@host` — a URL carrying an inline password. */
const CREDENTIAL_BEARING_URL = /:\/\/[^/@\s]+:[^/@\s]+@/u;

function readWorkflow(name: string): string {
  const path = fileURLToPath(new URL(`../../../.github/workflows/${name}`, import.meta.url));
  return readFileSync(path, "utf8");
}

describe("CI integration database configuration", () => {
  for (const workflow of WORKFLOWS) {
    it(`${workflow} commits no credential-bearing connection URL`, () => {
      const contents = readWorkflow(workflow);

      assert.equal(
        CREDENTIAL_BEARING_URL.test(contents),
        false,
        `${workflow} contains a URL with inline credentials`,
      );
    });

    it(`${workflow} never echoes the assembled connection URL`, () => {
      const contents = readWorkflow(workflow);

      // Writing to $GITHUB_ENV is fine; printing to the job log is not.
      assert.equal(/echo\s+"?\$\{?(INTEGRATION_)?DATABASE_URL/u.test(contents), false);
      assert.equal(/printf[^\n]*\$url[^\n]*(?!GITHUB_ENV)\n/u.test(contents) && !contents.includes('>> "$GITHUB_ENV"'), false);
    });

    it(`${workflow} gives its ephemeral service no password at all`, () => {
      const contents = readWorkflow(workflow);

      assert.equal(contents.includes("POSTGRES_PASSWORD"), false);
      assert.ok(contents.includes("POSTGRES_HOST_AUTH_METHOD: trust"));
    });

    it(`${workflow} pins the PostgreSQL version the suite is verified against`, () => {
      const contents = readWorkflow(workflow);

      assert.ok(
        contents.includes("image: postgres:18-alpine"),
        `${workflow} must run the same major version the integration evidence claims`,
      );
    });

    it(`${workflow} declares the host allow-list the guard requires`, () => {
      const contents = readWorkflow(workflow);

      assert.ok(contents.includes("INTEGRATION_DB_ALLOWED_HOSTS: localhost"));
    });
  }

  it("the URL assembled from the workflow's parts satisfies the disposable guard", () => {
    // Mirrors the `Compose disposable database URL` step exactly.
    const parts = { user: "ci", host: "localhost", port: "5432", name: "mediass_ci_probe" };
    const url = `postgresql://${parts.user}@${parts.host}:${parts.port}/${parts.name}`;

    assert.equal(isDisposableIntegrationDatabaseUrl(url, { allowedHosts: ["localhost"] }), true);
  });

  it("the same assembly pointed at a remote host is still refused", () => {
    const url = "postgresql://ci@production.example:5432/mediass_ci_probe";

    assert.equal(isDisposableIntegrationDatabaseUrl(url, { allowedHosts: ["localhost"] }), false);
  });
});

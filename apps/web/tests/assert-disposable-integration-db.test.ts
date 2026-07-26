import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertDisposableIntegrationDatabaseUrl } from "../scripts/assert-disposable-integration-db.mjs";

describe("CI integration database guard", () => {
  it("accepts an explicitly disposable *_probe PostgreSQL database", () => {
    assert.doesNotThrow(() =>
      assertDisposableIntegrationDatabaseUrl("postgresql://ci:ci@localhost:5432/mediass_ci_probe"),
    );
  });

  it("fails closed for a missing or non-disposable database URL", () => {
    assert.throws(() => assertDisposableIntegrationDatabaseUrl(undefined), /INTEGRATION_DATABASE_URL/);
    assert.throws(
      () => assertDisposableIntegrationDatabaseUrl("postgresql://ci:ci@localhost:5432/mediass"),
      /_probe/,
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertDisposableIntegrationDatabaseUrl,
  isDisposableIntegrationDatabaseUrl,
} from "../scripts/assert-disposable-integration-db.mjs";

/**
 * The integration fixtures TRUNCATE and re-seed the database they connect to,
 * so this guard is the only thing standing between a misconfigured
 * INTEGRATION_DATABASE_URL and a real dataset.
 *
 * A `_probe` suffix alone was not enough: `production.example/production_probe`
 * satisfies it while pointing at a remote host. The database NAME is a naming
 * convention anyone can satisfy; the HOST is what decides whether the target is
 * genuinely disposable.
 */

const CI_SERVICE_HOST = "postgres";

describe("disposable integration database guard — accepted targets", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    it(`accepts loopback host ${host} with a *_probe database`, () => {
      assert.doesNotThrow(() =>
        assertDisposableIntegrationDatabaseUrl(`postgresql://ci:ci@${host}:5432/mediass_ci_probe`),
      );
    });
  }

  it("accepts the postgres: protocol alias", () => {
    assert.doesNotThrow(() =>
      assertDisposableIntegrationDatabaseUrl("postgres://ci:ci@localhost:5432/mediass_ci_probe"),
    );
  });

  it("accepts the exact ephemeral CI service hostname when it is explicitly allowed", () => {
    assert.doesNotThrow(() =>
      assertDisposableIntegrationDatabaseUrl(
        `postgresql://ci:ci@${CI_SERVICE_HOST}:5432/mediass_ci_probe`,
        { allowedHosts: [CI_SERVICE_HOST] },
      ),
    );
  });

  it("accepts a decoded *_probe pathname", () => {
    assert.doesNotThrow(() =>
      assertDisposableIntegrationDatabaseUrl("postgresql://ci:ci@localhost:5432/mediass%5Fci%5Fprobe"),
    );
  });
});

describe("disposable integration database guard — rejected targets", () => {
  it("rejects a remote host even when the database name ends _probe", () => {
    // The exact URL the audit called out: suffix satisfied, target is remote.
    assert.throws(
      () =>
        assertDisposableIntegrationDatabaseUrl(
          "postgresql://user:pass@production.example/production_probe",
        ),
      /host/i,
    );
  });

  it("rejects a non-local host that is NOT in the explicit allow-list", () => {
    assert.throws(
      () =>
        assertDisposableIntegrationDatabaseUrl(
          "postgresql://ci:ci@db.internal:5432/mediass_ci_probe",
          { allowedHosts: [CI_SERVICE_HOST] },
        ),
      /host/i,
    );
  });

  it("does NOT let an allow-list entry match a different host by substring", () => {
    assert.throws(
      () =>
        assertDisposableIntegrationDatabaseUrl(
          "postgresql://ci:ci@evil-postgres.example:5432/mediass_ci_probe",
          { allowedHosts: [CI_SERVICE_HOST] },
        ),
      /host/i,
    );
  });

  it("rejects a production database that only carries _probe in the query string", () => {
    assert.throws(
      () =>
        assertDisposableIntegrationDatabaseUrl(
          "postgresql://ci:ci@localhost:5432/production?schema=mediass_ci_probe",
        ),
      /_probe/,
    );
  });

  it("rejects a production database that only carries _probe in the fragment", () => {
    assert.throws(
      () =>
        assertDisposableIntegrationDatabaseUrl(
          "postgresql://ci:ci@localhost:5432/production#mediass_ci_probe",
        ),
      /_probe/,
    );
  });

  it("rejects a database name that merely contains _probe", () => {
    assert.throws(
      () => assertDisposableIntegrationDatabaseUrl("postgresql://ci:ci@localhost:5432/mediass_probe_live"),
      /_probe/,
    );
  });

  it("rejects a non-PostgreSQL protocol", () => {
    assert.throws(
      () => assertDisposableIntegrationDatabaseUrl("mysql://ci:ci@localhost:3306/mediass_ci_probe"),
      /protocol/i,
    );
  });

  it("fails closed on a malformed URL", () => {
    assert.throws(() => assertDisposableIntegrationDatabaseUrl("not a URL"), /INTEGRATION_DATABASE_URL/);
  });

  it("fails closed on missing configuration", () => {
    for (const missing of [undefined, null, "", 42]) {
      assert.throws(
        () => assertDisposableIntegrationDatabaseUrl(missing),
        /INTEGRATION_DATABASE_URL/,
      );
    }
  });

  it("fails closed when the database is not a *_probe target", () => {
    assert.throws(
      () => assertDisposableIntegrationDatabaseUrl("postgresql://ci:ci@localhost:5432/mediass"),
      /_probe/,
    );
  });

  it("fails closed when the URL carries no database path at all", () => {
    assert.throws(
      () => assertDisposableIntegrationDatabaseUrl("postgresql://ci:ci@localhost:5432"),
      /_probe/,
    );
  });
});

describe("disposable integration database guard — predicate form", () => {
  it("mirrors the assertion without throwing", () => {
    assert.equal(
      isDisposableIntegrationDatabaseUrl("postgresql://ci:ci@localhost:5432/mediass_ci_probe"),
      true,
    );
    assert.equal(
      isDisposableIntegrationDatabaseUrl("postgresql://user:pass@production.example/production_probe"),
      false,
    );
    assert.equal(isDisposableIntegrationDatabaseUrl(undefined), false);
  });
});

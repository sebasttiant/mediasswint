import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatDate, formatTimestamp } from "@/lib/finance-format";

describe("formatDate", () => {
  it("renders a YYYY-MM-DD key as DD/MM/YYYY without timezone math", () => {
    assert.equal(formatDate("2026-06-17"), "17/06/2026");
  });
});

describe("formatTimestamp", () => {
  it("renders an ISO instant in Colombia (Bogota) time, not the server timezone", () => {
    // 15:00Z is 10:00 in Bogota (UTC-5). The stamp must read 10:00, never 15:00, so the
    // result cannot depend on where the export runs.
    const ts = formatTimestamp("2026-06-17T15:00:00Z");
    assert.match(ts, /17\/06\/2026/);
    assert.match(ts, /10:00/);
    assert.ok(!ts.includes("15:00"), `expected Bogota time, got: ${ts}`);
    assert.ok(ts.includes("(hora Colombia)"), `expected Colombia label, got: ${ts}`);
  });

  it("rolls the date back when the UTC instant is past midnight but still the prior day in Bogota", () => {
    // 03:52Z on the 18th is 22:52 on the 17th in Bogota. The old host-default formatting
    // showed "18/06" here; the explicit zone keeps it on the 17th.
    const ts = formatTimestamp("2026-06-18T03:52:34Z");
    assert.match(ts, /17\/06\/2026/);
    assert.match(ts, /22:52/);
  });
});

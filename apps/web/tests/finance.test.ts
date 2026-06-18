import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cashboxQueryBounds,
  dateOnlyKeyUTC,
  isValidCashCountInput,
  isValidExpenseInput,
  parseDateOnlyUTC,
} from "@/lib/finance";
import { toCashboxDateKey } from "@/lib/cashbox";

describe("parseDateOnlyUTC / dateOnlyKeyUTC", () => {
  it("round-trips a calendar date without timezone drift", () => {
    const date = parseDateOnlyUTC("2026-06-17");
    assert.ok(date);
    assert.equal(dateOnlyKeyUTC(date!), "2026-06-17");
  });

  it("rejects malformed dates", () => {
    assert.equal(parseDateOnlyUTC("17/06/2026"), null);
    assert.equal(parseDateOnlyUTC("2026-13-40"), null);
    assert.equal(parseDateOnlyUTC(""), null);
  });
});

describe("cashboxQueryBounds", () => {
  it("sets the lower bound to the from-day midnight UTC", () => {
    const { gte } = cashboxQueryBounds("2026-06-10", "2026-06-17");
    assert.equal(gte.toISOString(), "2026-06-10T00:00:00.000Z");
  });

  it("pads the upper bound past the to-day to cover the Bogota timezone offset", () => {
    // Exclusive upper bound is to + 2 days at midnight UTC so a late Bogota-night
    // payment (whose paidAt instant rolls into the next UTC day) is never dropped.
    const { lt } = cashboxQueryBounds("2026-06-10", "2026-06-17");
    assert.equal(lt.toISOString(), "2026-06-19T00:00:00.000Z");
  });

  it("keeps a late Bogota payment inside the bounds even though it is a UTC instant", () => {
    // 2026-06-17 23:30 in Bogota (UTC-5) == 2026-06-18T04:30Z. Its cashbox day is
    // still 2026-06-17, so a range ending 2026-06-17 must include this instant.
    const lateBogotaPayment = new Date("2026-06-18T04:30:00Z");
    assert.equal(toCashboxDateKey(lateBogotaPayment), "2026-06-17");
    const { gte, lt } = cashboxQueryBounds("2026-06-17", "2026-06-17");
    assert.ok(lateBogotaPayment >= gte && lateBogotaPayment < lt);
  });
});

describe("isValidExpenseInput", () => {
  it("accepts a well-formed expense", () => {
    assert.equal(
      isValidExpenseInput({ date: "2026-06-17", amount: "150000", concept: "Insumos" }),
      true,
    );
  });

  it("rejects a non-positive amount", () => {
    assert.equal(isValidExpenseInput({ date: "2026-06-17", amount: "0", concept: "X" }), false);
    assert.equal(isValidExpenseInput({ date: "2026-06-17", amount: "-5", concept: "X" }), false);
  });

  it("rejects an empty concept", () => {
    assert.equal(isValidExpenseInput({ date: "2026-06-17", amount: "100", concept: "   " }), false);
  });

  it("rejects a bad date", () => {
    assert.equal(isValidExpenseInput({ date: "nope", amount: "100", concept: "X" }), false);
  });
});

describe("isValidCashCountInput", () => {
  it("accepts a zero count (an empty till is valid)", () => {
    assert.equal(isValidCashCountInput({ date: "2026-06-17", countedAmount: "0" }), true);
  });

  it("accepts a positive count", () => {
    assert.equal(isValidCashCountInput({ date: "2026-06-17", countedAmount: "920000" }), true);
  });

  it("rejects a negative count", () => {
    assert.equal(isValidCashCountInput({ date: "2026-06-17", countedAmount: "-1" }), false);
  });

  it("rejects a bad date", () => {
    assert.equal(isValidCashCountInput({ date: "2026/06/17", countedAmount: "100" }), false);
  });
});

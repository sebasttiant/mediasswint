import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dateOnlyKeyUTC,
  isValidCashCountInput,
  isValidExpenseInput,
  parseDateOnlyUTC,
} from "@/lib/finance";

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

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatOperationBranch,
  isOperationBranch,
  OPERATION_BRANCH_LABELS,
  OPERATION_BRANCH_VALUES,
} from "@/lib/operation-branch";

describe("operation-branch", () => {
  it("has a label for every branch value", () => {
    for (const value of OPERATION_BRANCH_VALUES) {
      assert.equal(typeof OPERATION_BRANCH_LABELS[value], "string");
      assert.ok(OPERATION_BRANCH_LABELS[value].length > 0);
    }
  });

  it("isOperationBranch accepts known values and rejects the rest", () => {
    assert.equal(isOperationBranch("CENTRO"), true);
    assert.equal(isOperationBranch("ITAGUI"), true);
    assert.equal(isOperationBranch("BOGOTA"), false);
    assert.equal(isOperationBranch(""), false);
    assert.equal(isOperationBranch(null), false);
    assert.equal(isOperationBranch(42), false);
  });

  it("formatOperationBranch maps stored value to its accented label", () => {
    assert.equal(formatOperationBranch("ITAGUI"), "Itagüí");
    assert.equal(formatOperationBranch("CENTRO"), "Centro");
    assert.equal(formatOperationBranch("HSVP"), "HSVP");
  });

  it("formatOperationBranch returns null for absent values", () => {
    assert.equal(formatOperationBranch(null), null);
    assert.equal(formatOperationBranch(undefined), null);
    assert.equal(formatOperationBranch(""), null);
  });

  it("formatOperationBranch passes through an unknown non-empty value unchanged", () => {
    // Defensive: legacy/unexpected stored values are shown as-is, not hidden.
    assert.equal(formatOperationBranch("LEGACY"), "LEGACY");
  });
});

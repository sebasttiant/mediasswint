import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toAuditPayload } from "@/lib/audit-log";

// Test toAuditPayload function directly since it's pure
describe("toAuditPayload", () => {
  it("should remove undefined fields and keep null fields", () => {
    const input = {
      id: "item-1",
      name: "Test Item",
      value: 42,
      nested: {
        inner: "value"
      },
      nullField: null,
      undefinedField: undefined as unknown as string,
    };

    const payload = toAuditPayload(input);

    // Expect that undefined fields are removed and null fields are kept
    assert.deepStrictEqual(payload, {
      id: "item-1",
      name: "Test Item",
      value: 42,
      nested: {
        inner: "value"
      },
      nullField: null,
    });
  });

  it("should handle nested objects", () => {
    const input = {
      level1: {
        level2: {
          value: "deep",
          undefined: undefined as unknown as string
        },
        nullValue: null
      },
      topLevelUndefined: undefined as unknown as string
    };

    const payload = toAuditPayload(input);

    assert.deepStrictEqual(payload, {
      level1: {
        level2: {
          value: "deep"
        },
        nullValue: null
      }
    });
  });

  it("should return empty object for all undefined input", () => {
    const input = {
      a: undefined as unknown as string,
      b: undefined as unknown as string
    };

    const payload = toAuditPayload(input);

    assert.deepStrictEqual(payload, {});
  });

  it("should keep all fields when none are undefined", () => {
    const input = {
      a: "value",
      b: null,
      c: 42
    };

    const payload = toAuditPayload(input);

    assert.deepStrictEqual(payload, {
      a: "value",
      b: null,
      c: 42
    });
  });
});
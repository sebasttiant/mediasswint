import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveCanonicalGarmentIdentity,
  type CanonicalGarmentIdentity,
} from "../lib/garment-template-identity";

/**
 * B1 — one canonical garment identity, resolved on the server.
 *
 * Comparing only the resolved TEMPLATE was not enough. MA, MMA and ME are three
 * distinct catalog references; MA and MMA merely happen to share the mascara-v1
 * measurement set. A payload could therefore say `garmentType: "MA"` while
 * carrying `garmentSnapshot.reference: "MMA"` and pass a template-only check,
 * persisting a clinical record whose own identity fields contradict each other.
 *
 * Display metadata (label, family, figure) is derived from the server catalog
 * and never taken from the client.
 */

function ok(result: ReturnType<typeof resolveCanonicalGarmentIdentity>): CanonicalGarmentIdentity {
  assert.equal(result.ok, true, `expected a canonical identity, got ${JSON.stringify(result)}`);
  if (result.ok !== true) throw new Error("unreachable");
  assert.notEqual(result.identity, null, "expected a request that names a garment");
  if (result.identity === null) throw new Error("unreachable");
  return result.identity;
}

describe("resolveCanonicalGarmentIdentity — one reference, server-derived metadata", () => {
  it("accepts a request that names the garment once", () => {
    const identity = ok(resolveCanonicalGarmentIdentity({ garmentType: "MA" }));

    assert.equal(identity.reference, "MA");
    assert.equal(identity.templateCode, "mascara-v1");
    assert.equal(identity.label, "Mascara Adulto");
  });

  it("derives label, family and figure from the catalog, ignoring spoofed client values", () => {
    const identity = ok(
      resolveCanonicalGarmentIdentity({
        garmentType: "ME",
        garmentSnapshot: {
          reference: "ME",
          label: "ETIQUETA FALSA",
          family: "familia-falsa",
          figureKey: "lower-limb",
        },
      }),
    );

    assert.equal(identity.reference, "ME");
    assert.equal(identity.label, "Mentonera Adulto");
    assert.notEqual(identity.label, "ETIQUETA FALSA");
    assert.notEqual(identity.figureKey, "lower-limb");
    assert.equal(identity.templateCode, "mentonera-v1");
  });

  it("REJECTS a payload naming two different garments, even across templates", () => {
    const result = resolveCanonicalGarmentIdentity({
      garmentType: "MA",
      garmentSnapshot: { reference: "ME", label: "x", family: "y", figureKey: "head-or-hand" },
    });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "INCONSISTENT_REFERENCES");
  });

  it("REJECTS MA mixed with MMA, even though both resolve to mascara-v1", () => {
    const result = resolveCanonicalGarmentIdentity({
      garmentType: "MA",
      garmentSnapshot: { reference: "MMA", label: "x", family: "y", figureKey: "head-or-hand" },
    });

    assert.equal(result.ok, false);
    assert.equal(
      result.ok === false && result.reason,
      "INCONSISTENT_REFERENCES",
      "same template is NOT the same garment identity",
    );
  });

  it("accepts an internally consistent MMA payload", () => {
    const identity = ok(
      resolveCanonicalGarmentIdentity({
        garmentType: "MMA",
        garmentSnapshot: {
          reference: "MMA",
          label: "Media Mascara Adulto",
          family: "head-or-hand",
          figureKey: "head-or-hand",
        },
      }),
    );

    assert.equal(identity.reference, "MMA");
    assert.equal(identity.label, "Media Mascara Adulto");
    assert.equal(identity.templateCode, "mascara-v1");
  });

  it("accepts differently cased copies of the same catalog reference", () => {
    const identity = ok(
      resolveCanonicalGarmentIdentity({
        garmentType: "ma",
        garmentSnapshot: { reference: "MA" },
      }),
    );

    assert.equal(identity.reference, "MA");
  });

  it("rejects a reference-only snapshot when it contradicts garmentType", () => {
    const result = resolveCanonicalGarmentIdentity({
      garmentType: "MA",
      garmentSnapshot: { reference: "MMA" },
    });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "INCONSISTENT_REFERENCES");
  });

  it("reports no identity when the request names no garment at all", () => {
    const result = resolveCanonicalGarmentIdentity({});

    assert.equal(result.ok, true);
    assert.equal(result.ok === true && result.identity, null);
  });

  it("rejects an unknown reference explicitly rather than falling back silently", () => {
    const result = resolveCanonicalGarmentIdentity({ garmentType: "NO-EXISTE" });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "UNKNOWN_REFERENCE");
  });

  it("keeps MA and MMA distinct as clinical identities", () => {
    const ma = ok(resolveCanonicalGarmentIdentity({ garmentType: "MA" }));
    const mma = ok(resolveCanonicalGarmentIdentity({ garmentType: "MMA" }));

    assert.equal(ma.templateCode, mma.templateCode, "they share a measurement set");
    assert.notEqual(ma.reference, mma.reference, "but they are different garments");
    assert.notEqual(ma.label, mma.label);
  });
});

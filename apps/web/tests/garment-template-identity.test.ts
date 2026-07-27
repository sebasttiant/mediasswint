import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findGarmentTemplateMismatch } from "../lib/garment-template-identity";

/**
 * A session's template snapshot IS its measurement schema; the garment label is
 * client input. Let the two drift and a record can claim to be a Mentonera
 * (3 measurements) while carrying a schema that does not match it.
 *
 * This is the pure identity decision, independent of any HTTP concern: given
 * what the session already is and what the request asks for, is the change a
 * cross-template one that must be refused?
 *
 * Máscara is still dormant at this point, so MA/MMA resolve to compression.
 * The rule under test is the template BOUNDARY, not any particular garment.
 */

describe("findGarmentTemplateMismatch", () => {
  it("allows a change that stays inside one template", () => {
    assert.equal(
      findGarmentTemplateMismatch({
        sessionTemplateCode: "compression-v1",
        requestedGarmentType: "MR",
      }),
      null,
    );
  });

  it("refuses relabelling a compression session as a Mentonera one", () => {
    const mismatch = findGarmentTemplateMismatch({
      sessionTemplateCode: "compression-v1",
      requestedGarmentType: "ME",
    });

    assert.ok(mismatch);
    assert.equal(mismatch.sessionTemplateCode, "compression-v1");
    assert.equal(mismatch.requestedTemplateCode, "mentonera-v1");
    assert.equal(mismatch.source, "garmentType");
  });

  it("refuses relabelling a Mentonera session as anything else", () => {
    const mismatch = findGarmentTemplateMismatch({
      sessionTemplateCode: "mentonera-v1",
      requestedGarmentType: "MR",
    });

    assert.ok(mismatch);
    assert.equal(mismatch.requestedTemplateCode, "compression-v1");
  });

  it("refuses a cross-template reference arriving via metadata.garmentSnapshot", () => {
    const mismatch = findGarmentTemplateMismatch({
      sessionTemplateCode: "compression-v1",
      requestedGarmentReference: "ME",
    });

    assert.ok(mismatch);
    assert.equal(mismatch.source, "garmentSnapshot");
    assert.equal(mismatch.requestedTemplateCode, "mentonera-v1");
  });

  it("reports garmentType first when BOTH fields cross the boundary", () => {
    const mismatch = findGarmentTemplateMismatch({
      sessionTemplateCode: "compression-v1",
      requestedGarmentType: "ME",
      requestedGarmentReference: "ME",
    });

    assert.equal(mismatch?.source, "garmentType");
  });

  it("treats an UNKNOWN reference on a head session as a real mismatch", () => {
    // Unknown references resolve to the compression fallback rather than to
    // "no opinion" — accepting them silently is how a head session loses its
    // identity.
    const mismatch = findGarmentTemplateMismatch({
      sessionTemplateCode: "mentonera-v1",
      requestedGarmentType: "no-such-garment",
    });

    assert.ok(mismatch);
    assert.equal(mismatch.requestedTemplateCode, "compression-v1");
  });

  it("is silent when the request does not mention garment identity at all", () => {
    assert.equal(findGarmentTemplateMismatch({ sessionTemplateCode: "mentonera-v1" }), null);
    for (const empty of [null, undefined, "", "   "]) {
      assert.equal(
        findGarmentTemplateMismatch({
          sessionTemplateCode: "mentonera-v1",
          requestedGarmentType: empty,
        }),
        null,
      );
    }
  });

  it("has no identity to contradict when the session carries no template code", () => {
    // Left to the snapshot-validation guards rather than reported as a mismatch.
    assert.equal(
      findGarmentTemplateMismatch({
        sessionTemplateCode: null,
        requestedGarmentType: "ME",
      }),
      null,
    );
  });

  it("ignores surrounding whitespace when resolving a reference", () => {
    assert.equal(
      findGarmentTemplateMismatch({
        sessionTemplateCode: "mentonera-v1",
        requestedGarmentType: "  ME  ",
      }),
      null,
    );
  });
});

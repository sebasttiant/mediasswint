import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTemplateCode } from "../lib/garment-template-resolver";

describe("resolveTemplateCode", () => {
  it("resolves only the six normalized MP/Bermuda references to mp-bermuda-v1", () => {
    assert.equal(resolveTemplateCode("MP"), "mp-bermuda-v1");
    assert.equal(resolveTemplateCode(" mpd "), "mp-bermuda-v1");
    assert.equal(resolveTemplateCode("mPi"), "mp-bermuda-v1");
    assert.equal(resolveTemplateCode("bp"), "mp-bermuda-v1");
    assert.equal(resolveTemplateCode(" BD "), "mp-bermuda-v1");
    assert.equal(resolveTemplateCode("bi"), "mp-bermuda-v1");
  });

  it("keeps MP-like exclusions and unknown references on the compression fallback", () => {
    assert.equal(resolveTemplateCode("MP-extra"), "compression-v1");
    assert.equal(resolveTemplateCode("MPE"), "compression-v1");
    assert.equal(resolveTemplateCode("MPF"), "compression-v1");
    assert.equal(resolveTemplateCode("MR"), "compression-v1");
    assert.equal(resolveTemplateCode("MRC"), "compression-v1");
    assert.equal(resolveTemplateCode("MRI"), "compression-v1");
    assert.equal(resolveTemplateCode("MMI"), "compression-v1");
    assert.equal(resolveTemplateCode("NOT-A-REAL-GARMENT"), "compression-v1");
  });

  it("resolves ME (Mentonera) to mentonera-v1", () => {
    assert.equal(resolveTemplateCode("ME"), "mentonera-v1");
  });

  it("resolves MA and MMA (Máscara variants) to mascara-v1", () => {
    assert.equal(resolveTemplateCode("MA"), "mascara-v1");
    assert.equal(resolveTemplateCode("mma"), "mascara-v1");
    assert.equal(resolveTemplateCode(" MMA "), "mascara-v1");
  });

  it("is case-insensitive and trims whitespace around the reference", () => {
    assert.equal(resolveTemplateCode("me"), "mentonera-v1");
    assert.equal(resolveTemplateCode(" ME "), "mentonera-v1");
  });

  it("falls back to compression-v1 for garments without a dedicated template", () => {
    assert.equal(resolveTemplateCode("MR"), "compression-v1");
    assert.equal(resolveTemplateCode("BA"), "compression-v1");
    assert.equal(resolveTemplateCode("GLD"), "compression-v1");
  });

  it("falls back to compression-v1 for an unknown garment reference", () => {
    assert.equal(resolveTemplateCode("NOT-A-REAL-GARMENT"), "compression-v1");
  });

  it("falls back to compression-v1 for empty, null, or undefined references without throwing", () => {
    assert.equal(resolveTemplateCode(""), "compression-v1");
    assert.equal(resolveTemplateCode("   "), "compression-v1");
    assert.equal(resolveTemplateCode(null), "compression-v1");
    assert.equal(resolveTemplateCode(undefined), "compression-v1");
  });
});

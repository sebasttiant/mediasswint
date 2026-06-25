import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GARMENT_CATALOG,
  GARMENT_FIGURE_KEY,
  findGarmentOption,
  getGarmentSnapshot,
  resolveFigureHint,
  resolveGarmentDisplay,
} from "../lib/garment-catalog";

describe("garment catalog", () => {
  it("contains the 43 spreadsheet references without duplicates", () => {
    const references = GARMENT_CATALOG.map((option) => option.reference);

    assert.equal(GARMENT_CATALOG.length, 43);
    assert.equal(new Set(references).size, 43);
    assert.deepEqual(references.slice(0, 4), ["MR", "MRD", "MRC", "MRI"]);
    assert.deepEqual(references.slice(-4), ["GCI", "ÑBD", "ÑBI", "DE"]);
  });

  it("looks up garments by stable reference", () => {
    assert.equal(findGarmentOption("MPF")?.label, "Media Pantalón Estilo Faja");
    assert.equal(findGarmentOption(" ñbd ")?.label, "Funda Muñón Brazo Derecho Adulto");
    assert.equal(findGarmentOption("UNKNOWN"), null);
  });

  it("creates immutable snapshots for known references", () => {
    assert.deepEqual(getGarmentSnapshot("MRD"), {
      reference: "MRD",
      label: "Media a la Rodilla Derecha Adulto",
      family: "Lower limb",
      figureKey: GARMENT_FIGURE_KEY.LOWER_LIMB,
    });
    assert.equal(getGarmentSnapshot("not-cataloged"), null);
  });

  it("resolves display text from snapshot metadata, catalog references, and legacy free text", () => {
    assert.equal(
      resolveGarmentDisplay("MRD", {
        garmentSnapshot: {
          reference: "MRD",
          label: "Custom display label",
          family: "Lower limb",
          figureKey: GARMENT_FIGURE_KEY.LOWER_LIMB,
        },
      }),
      "Custom display label (MRD)",
    );
    assert.equal(resolveGarmentDisplay("MR", { garmentSnapshot: "malformed" }), "Media a la Rodilla Par Adulto (MR)");
    assert.equal(resolveGarmentDisplay("Legacy garment", { garmentSnapshot: null }), "Legacy garment");
    assert.equal(resolveGarmentDisplay(null, undefined), "");
  });

  it("falls back to generic figure hints for missing or malformed snapshots", () => {
    assert.equal(resolveFigureHint(getGarmentSnapshot("BO")), GARMENT_FIGURE_KEY.FULL_BODY);
    assert.equal(resolveFigureHint(getGarmentSnapshot("BA")), GARMENT_FIGURE_KEY.HEAD_OR_HAND);
    assert.equal(resolveFigureHint(null), GARMENT_FIGURE_KEY.GENERIC);
    const malformedSnapshot = {
      reference: "BAD",
      label: "Bad",
      family: "Bad",
      figureKey: "bad",
    } as never;

    assert.equal(resolveFigureHint(malformedSnapshot), GARMENT_FIGURE_KEY.GENERIC);
  });
});

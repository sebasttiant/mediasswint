import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMascaraTemplate, MASCARA_TEMPLATE_CODE } from "../lib/mascara-template";

describe("buildMascaraTemplate", () => {
  it("defines the two fixed circumference measurements from the client form", () => {
    const fields = buildMascaraTemplate().sections.flatMap((section) => section.fields);

    assert.deepEqual(
      fields.map((field) => ({
        key: field.key,
        label: field.label,
        anatomyZone: field.metadata.anatomyZone,
        kind: field.metadata.kind,
        unit: field.unit,
      })),
      [
        {
          key: "mascaraForehead",
          label: "Contorno de la cabeza alrededor de la frente",
          anatomyZone: "head.forehead",
          kind: "circumference",
          unit: "cm",
        },
        {
          key: "mascaraNeck",
          label: "Circunferencia del cuello",
          anatomyZone: "head.neck",
          kind: "circumference",
          unit: "cm",
        },
      ],
    );
  });

  it("exposes the dedicated mascara-v1 template code", () => {
    assert.equal(buildMascaraTemplate().code, MASCARA_TEMPLATE_CODE);
    assert.equal(MASCARA_TEMPLATE_CODE, "mascara-v1");
  });
});

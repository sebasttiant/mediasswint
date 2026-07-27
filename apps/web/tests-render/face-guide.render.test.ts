import assert from "node:assert/strict";
import { createElement } from "react";
import { describe, it } from "node:test";

import { FaceGuide } from "../app/_components/body-highlight/face-guide";
import { attributeValues, render, textContent } from "./support/render";

describe("FaceGuide — rendered policy contract", () => {
  it("renders only when explicitly selected and identifies the female guide", () => {
    const markup = render(createElement(FaceGuide, { sex: "female" }));

    assert.deepEqual(attributeValues(markup, "data-face-guide"), ["female"]);
    assert.match(textContent(markup), /Guía de rostro femenino/);
    assert.match(textContent(markup), /Referencia visual de cabeza y rostro/);
  });

  it("keeps an explicit caller label while preserving the male visual guide", () => {
    const markup = render(createElement(FaceGuide, { sex: "male", ariaLabel: "Referencia facial" }));

    assert.deepEqual(attributeValues(markup, "data-face-guide"), ["male"]);
    assert.match(textContent(markup), /Referencia facial/);
  });
});

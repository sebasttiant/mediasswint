import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { createElement } from "react";

import { mount, cleanup } from "./mount";

describe("happy-dom mount harness", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("mounts a React element and exposes a real DOM document", () => {
    const { document, container } = mount(createElement("p", { id: "greeting" }, "hola"));

    const p = document.getElementById("greeting");
    assert.ok(p, "expected paragraph in happy-dom document");
    assert.equal(p.tagName, "P");
    assert.equal(p.textContent, "hola");
    assert.ok(container.querySelector("#greeting"), "container also has the paragraph");
  });

  it("supports form input focus through the real DOM", () => {
    const { document } = mount(
      createElement("input", { id: "real-focus-target", type: "text" }),
    );

    const input = document.getElementById("real-focus-target") as HTMLInputElement;
    assert.ok(input, "input mounted");
    input.focus();
    assert.equal(document.activeElement, input, "focus moved to the input");
  });
});

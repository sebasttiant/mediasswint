import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  focusVisibleZoneInput,
  HEAD_MEASUREMENT_DESKTOP_FIGURE_CARD_CLASS,
  HEAD_MEASUREMENT_DESKTOP_FIGURE_PANEL_CLASS,
  HEAD_MEASUREMENT_DESKTOP_LAYOUT_CLASS,
  HEAD_MEASUREMENT_MOBILE_FIGURE_CLASS,
} from "../app/patients/[id]/measurements/new/_components/head-measurement-shell-contract";

describe("Head measurement responsive layout contract", () => {
  it("keeps mobile and desktop figures behind reciprocal lg visibility rules", () => {
    assert.match(HEAD_MEASUREMENT_MOBILE_FIGURE_CLASS, /\blg:hidden\b/);
    assert.match(HEAD_MEASUREMENT_DESKTOP_LAYOUT_CLASS, /\bhidden\b/);
    assert.match(HEAD_MEASUREMENT_DESKTOP_LAYOUT_CLASS, /\blg:grid\b/);
  });

  it("preserves the bounded desktop figure composition and scrolling contract", () => {
    assert.match(HEAD_MEASUREMENT_DESKTOP_LAYOUT_CLASS, /lg:grid-cols-\[minmax\(360px,480px\)_minmax\(0,1fr\)\]/);
    assert.match(HEAD_MEASUREMENT_DESKTOP_FIGURE_PANEL_CLASS, /\boverflow-y-auto\b/);
    assert.match(HEAD_MEASUREMENT_DESKTOP_FIGURE_CARD_CLASS, /\bsticky\b/);
    assert.match(HEAD_MEASUREMENT_DESKTOP_FIGURE_CARD_CLASS, /\bmax-w-\[820px\]/);
  });

  it("caps the enlarged head figure below the footer-safe desktop height", () => {
    const stylesheet = readFileSync(
      new URL("../app/_components/body-highlight/body-highlight.module.css", import.meta.url),
      "utf8",
    );

    assert.match(stylesheet, /\.wrapperHead\s*\{\s*max-width:\s*560px;/);
  });
});

describe("focusVisibleZoneInput", () => {
  it("skips the hidden duplicate and focuses the visible enabled field for the zone", () => {
    const focused: string[] = [];
    const hiddenInput = {
      dataset: { anatomyZone: "head.neck" },
      disabled: false,
      getClientRects: () => [],
      focus: () => focused.push("hidden"),
    } as unknown as HTMLInputElement;
    const disabledInput = {
      dataset: { anatomyZone: "head.neck" },
      disabled: true,
      getClientRects: () => [{}] as unknown as DOMRectList,
      focus: () => focused.push("disabled"),
    } as unknown as HTMLInputElement;
    const visibleInput = {
      dataset: { anatomyZone: "head.neck" },
      disabled: false,
      getClientRects: () => [{}] as unknown as DOMRectList,
      focus: () => focused.push("visible"),
    } as unknown as HTMLInputElement;
    const scope = {
      querySelectorAll: () =>
        [hiddenInput, disabledInput, visibleInput] as unknown as NodeListOf<HTMLInputElement>,
    } as unknown as ParentNode;

    focusVisibleZoneInput(scope, "head.neck");

    assert.deepEqual(focused, ["visible"]);
  });

  it("uses the same visible-field focus behavior for the Máscara forehead zone", () => {
    const focused: string[] = [];
    const hiddenInput = {
      dataset: { anatomyZone: "head.forehead" },
      disabled: false,
      getClientRects: () => [],
      focus: () => focused.push("hidden"),
    } as unknown as HTMLInputElement;
    const visibleInput = {
      dataset: { anatomyZone: "head.forehead" },
      disabled: false,
      getClientRects: () => [{}] as unknown as DOMRectList,
      focus: () => focused.push("visible"),
    } as unknown as HTMLInputElement;
    const scope = {
      querySelectorAll: () => [hiddenInput, visibleInput] as unknown as NodeListOf<HTMLInputElement>,
    } as unknown as ParentNode;

    focusVisibleZoneInput(scope, "head.forehead");

    assert.deepEqual(focused, ["visible"]);
  });
});

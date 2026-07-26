import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { focusVisibleZoneInput } from "../app/patients/[id]/measurements/new/_components/head-measurement-shell-contract";

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

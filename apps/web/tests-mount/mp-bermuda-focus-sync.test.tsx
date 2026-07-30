import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { createElement } from "react";
import { flushSync } from "react-dom";

import { MeasurementShell } from "../app/patients/[id]/measurements/new/_components/measurement-shell";
import { buildMpBermudaTemplate } from "../lib/mp-bermuda-template";
import type { TemplateSnapshot, TemplateSnapshotField } from "../lib/measurements";
import { mount, cleanup, type MountResult } from "./support/mount";

function mpSnapshot(): TemplateSnapshot {
  const template = buildMpBermudaTemplate();
  return {
    templateId: "tpl",
    code: template.code,
    name: template.name,
    version: template.version,
    description: template.description,
    sections: template.sections.map((s) => ({
      title: s.title,
      sortOrder: s.sortOrder,
      fields: s.fields.map(
        (f): TemplateSnapshotField => ({ ...f, id: `fld-${f.key}`, metadata: { ...f.metadata } }),
      ),
    })),
  };
}

const MP_FIELD_KEY = "mpRightKneeCircumference";
const MP_MARKER_ID = "right-knee-circumference";
const MP_INPUT_ID = `mp-field-${MP_FIELD_KEY}`;

describe("MeasurementShell MP/Bermuda composed focus synchronization", () => {
  afterEach(async () => {
    await cleanup();
  });

  function shell(valuesByKey: Record<string, string> = {}, onValueChange: (k: string, v: string) => void = () => {}): MountResult {
    return mount(
      createElement(MeasurementShell, {
        templateSnapshot: mpSnapshot(),
        valuesByKey,
        sex: "male" as never,
        footer: null,
        onValueChange,
      } as never) as React.ReactElement,
    );
  }

  function markerGroup(doc: Document): HTMLElement | null {
    return doc.querySelector<HTMLElement>(`[data-mp-marker-id="${MP_MARKER_ID}"]`);
  }

  function clickMarker(marker: HTMLElement): void {
    flushSync(() => {
      marker.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  }

  it("pointer on a marker sets the owning input active and focused (no value change)", () => {
    const { document } = shell();
    const marker = markerGroup(document);
    assert.ok(marker, `marker ${MP_MARKER_ID} rendered`);

    clickMarker(marker!);
    const input = document.getElementById(MP_INPUT_ID) as HTMLInputElement | null;
    assert.ok(input, `input ${MP_INPUT_ID} rendered`);
    assert.equal(document.activeElement, input, "input now has DOM focus");

    const activeMarkers = document.querySelectorAll('[aria-current="true"][data-mp-marker-id]');
    assert.equal(activeMarkers.length, 1, "exactly one marker is active");
    assert.equal(activeMarkers[0].getAttribute("data-mp-marker-id"), MP_MARKER_ID);

    const activeRows = document.querySelectorAll('[aria-current="true"][data-mp-field-key]');
    assert.equal(activeRows.length, 1, "exactly one text row is active");
    assert.equal(activeRows[0].getAttribute("data-mp-field-key"), MP_FIELD_KEY);

    assert.equal((input as HTMLInputElement).value, "", "activating a marker never writes a value");
  });

  it("Enter on a marker equals pointer activation", () => {
    const { document } = shell();
    const marker = markerGroup(document)!;
    flushSync(() => marker.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    const input = document.getElementById(MP_INPUT_ID) as HTMLInputElement;
    assert.equal(document.activeElement, input, "Enter focused the owning input");
    assert.equal(
      document.querySelectorAll('[aria-current="true"][data-mp-marker-id]').length,
      1,
      "exactly one marker active after Enter",
    );
  });

  it("Space on a marker activates and prevents scrolling", () => {
    const { document } = shell();
    const marker = markerGroup(document)!;
    let preventDefaultCalled = false;
    const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    Object.defineProperty(event, "preventDefault", {
      value: () => { preventDefaultCalled = true; },
    });
    flushSync(() => marker.dispatchEvent(event));
    const input = document.getElementById(MP_INPUT_ID) as HTMLInputElement;
    assert.equal(document.activeElement, input, "Space focused the owning input");
    assert.equal(preventDefaultCalled, true, "Space preventDefault was called");
  });

  it("unrelated keys do not activate", () => {
    const { document } = shell();
    const marker = markerGroup(document)!;
    flushSync(() => marker.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true })));
    flushSync(() => marker.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })));
    flushSync(() => marker.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    assert.equal(document.activeElement, document.body, "nothing focused after unrelated keys");
    assert.equal(
      document.querySelectorAll('[aria-current="true"][data-mp-marker-id]').length,
      0,
      "no marker became active",
    );
  });

  it("active and filled coexist on the same field", () => {
    const { document } = shell({ [MP_FIELD_KEY]: "38" });
    const marker = markerGroup(document)!;
    clickMarker(marker);
    const input = document.getElementById(MP_INPUT_ID) as HTMLInputElement;
    assert.equal(document.activeElement, input, "input focused");
    assert.equal(input.value, "38", "value preserved, not overwritten");

    const markerEl = document.querySelector<HTMLElement>(`[data-mp-marker-id="${MP_MARKER_ID}"]`)!;
    assert.match(markerEl.getAttribute("data-filled") ?? "", /true/, "marker is filled");
    assert.match(markerEl.getAttribute("aria-current") ?? "", /true/, "marker is active");

    const rowEl = document.querySelector<HTMLElement>(`[data-mp-field-key="${MP_FIELD_KEY}"]`)!;
    assert.match(rowEl.getAttribute("data-filled") ?? "", /true/, "row is filled");
    assert.match(rowEl.getAttribute("aria-current") ?? "", /true/, "row is active");
  });

  it("activating one marker does not activate others", () => {
    const { document } = shell();
    const markers = document.querySelectorAll('[data-mp-marker-id]');
    const first = markers[0] as HTMLElement;
    clickMarker(first);
    const active = document.querySelectorAll('[aria-current="true"][data-mp-marker-id]');
    assert.equal(active.length, 1, "only one marker active");
    assert.notEqual(active[0].getAttribute("data-mp-marker-id"), markers[1].getAttribute("data-mp-marker-id"), "a different marker did not activate");
  });
});

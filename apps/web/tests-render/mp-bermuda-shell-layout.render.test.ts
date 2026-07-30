import assert from "node:assert/strict";
import { createElement, isValidElement, type ReactNode } from "react";
import { describe, it } from "node:test";

import {
  focusMpBermudaField,
  mpBermudaFieldInputId,
} from "../app/patients/[id]/measurements/new/_components/mp-bermuda-field-strip";
import { MpBermudaShellLayout } from "../app/patients/[id]/measurements/new/_components/mp-bermuda-shell-layout";
import { usesMpBermudaLayout } from "../app/patients/[id]/measurements/measurements-ui";
import type { TemplateSnapshot, TemplateSnapshotField } from "../lib/measurements";
import { buildMentoneraTemplate } from "../lib/mentonera-template";
import { buildMpBermudaTemplate, MP_BERMUDA_TEMPLATE_CODE } from "../lib/mp-bermuda-template";
import { countAttributeValue, openingTagFor, render } from "./support/render";

type Edit = {
  code?: string;
  map?: (field: TemplateSnapshotField) => TemplateSnapshotField;
  drop?: (field: TemplateSnapshotField) => boolean;
  empty?: boolean;
};

function snapshot({ code, map = (f) => f, drop = () => false, empty = false }: Edit = {}): TemplateSnapshot {
  const t = buildMpBermudaTemplate();
  return {
    templateId: "tpl", code: code ?? t.code, name: t.name, version: t.version, description: t.description,
    sections: empty ? [] : t.sections.map((s) => ({
      title: s.title, sortOrder: s.sortOrder,
      fields: s.fields.map((f) => map({ ...f, id: `fld-${f.key}`, metadata: { ...f.metadata } })).filter((f) => !drop(f)),
    })),
  };
}

function headSnapshot(map: (f: TemplateSnapshotField) => TemplateSnapshotField = (f) => f): TemplateSnapshot {
  const t = buildMentoneraTemplate();
  return {
    templateId: "t", code: t.code, name: t.name, version: t.version, description: t.description,
    sections: t.sections.map((s) => ({
      title: s.title, sortOrder: s.sortOrder,
      fields: s.fields.map((f) => map({ ...f, id: `f-${f.key}`, metadata: { ...f.metadata } })),
    })),
  };
}

function element(props: Partial<Parameters<typeof MpBermudaShellLayout>[0]> = {}) {
  return createElement(MpBermudaShellLayout, {
    snapshot: snapshot(), valuesByKey: {}, activeFieldKey: null, onFocus: () => undefined,
    onMarkerActivate: () => undefined, onChange: () => undefined, ...props,
  });
}

const layout = (props: Partial<Parameters<typeof MpBermudaShellLayout>[0]> = {}) => render(element(props));

type Node = { type?: string; role?: string; tabIndex?: number; "aria-label"?: string; id?: string;
  onClick?: () => void; onKeyDown?: (e: { key: string; preventDefault: () => void }) => void };

/** Walks THROUGH function components so assertions reach the real rendered handlers. */
function find(node: ReactNode, match: (el: { type: unknown; props: Node }) => boolean): Node[] {
  if (Array.isArray(node)) return node.flatMap((c) => find(c, match));
  if (!isValidElement(node)) return [];
  const props = node.props as { children?: ReactNode } & Node;
  if (typeof node.type === "function") {
    return find((node.type as (p: unknown) => ReactNode)(props), match);
  }
  const self = match({ type: node.type, props }) ? [props] : [];
  return [...self, ...find(props.children, match)];
}

const markers = (props?: Partial<Parameters<typeof MpBermudaShellLayout>[0]>) =>
  find(element(props), (el) => el.type === "g");

describe("MP/Bermuda shell ownership", () => {
  it("routes by exact frozen template code, not by field metadata", () => {
    assert.equal(usesMpBermudaLayout(snapshot()), true);
    assert.equal(snapshot().code, MP_BERMUDA_TEMPLATE_CODE);
    assert.equal(usesMpBermudaLayout(headSnapshot()), false);
    assert.equal(usesMpBermudaLayout(snapshot({ code: "compression-v1" })), false);
  });

  it("is not hijacked by a non-MP snapshot carrying contaminated MP metadata", () => {
    const contaminated = headSnapshot((f) =>
      f.sortOrder === 0 ? { ...f, metadata: { ...f.metadata, layout: "mp-bermuda", markerId: "x", side: "right" } } : f,
    );

    assert.equal(usesMpBermudaLayout(contaminated), false);
  });

  it("keeps MP ownership when the snapshot is degraded", () => {
    assert.equal(usesMpBermudaLayout(snapshot({ drop: (f) => f.key === "mpLeftFootDorsumCircumference" })), true);
    assert.equal(usesMpBermudaLayout(snapshot({ map: (f) => ({ ...f, metadata: {} }) })), true);
    assert.equal(usesMpBermudaLayout(snapshot({ empty: true })), true);
  });

  it("keeps frozen MP fields usable when their presentation metadata is corrupt", () => {
    const markup = layout({ snapshot: snapshot({ map: (f) => f.key === "mpWeight" ? { ...f, metadata: { side: 9 } } : f }) });

    assert.equal(countAttributeValue(markup, "data-mp-field-state", "pending"), 55);
    assert.match(markup, /<input[^>]*id="mp-field-mpWeight"/);
  });

  it("presents an explicit empty state instead of a silent blank form", () => {
    const markup = layout({ snapshot: snapshot({ empty: true }) });

    assert.equal(markup.includes("<svg"), false);
    assert.equal(countAttributeValue(markup, "data-mp-field-state", "pending"), 0);
    assert.match(markup, /Esta sesión no tiene medidas utilizables/);
  });
});

describe("MP/Bermuda drawing markers are keyboard operable", () => {
  it("exposes button semantics, a tab stop and an accessible name when interactive", () => {
    const markup = layout({ onMarkerActivate: () => undefined });

    assert.equal(countAttributeValue(markup, "role", "button"), 55);
    assert.equal(countAttributeValue(markup, "tabindex", "0"), 55);
    assert.match(openingTagFor(markup, "data-mp-marker-id", "right-knee-circumference") ?? "",
      /aria-label="Contorno Rodilla derecha; right"/);
  });

  it("carries no interactive semantics when the drawing is read-only", () => {
    const readOnly = markers({ onMarkerActivate: undefined });

    assert.equal(readOnly.length, 55);
    assert.equal(readOnly.every((m) => m.role === undefined && m.tabIndex === undefined), true);
    assert.equal(readOnly.every((m) => m.onClick === undefined && m.onKeyDown === undefined), true);
  });

  it("activates the owning field by pointer, Enter and Space alike", () => {
    for (const press of ["click", "Enter", " "] as const) {
      const activated: string[] = [];
      const prevented: string[] = [];
      const marker = markers({ onMarkerActivate: (key) => activated.push(key) })[0];

      if (press === "click") marker?.onClick?.();
      else marker?.onKeyDown?.({ key: press, preventDefault: () => prevented.push(press) });

      assert.deepEqual(activated, ["mpHeight"]);
      assert.deepEqual(prevented, press === " " ? [" "] : []);
    }
  });

  it("ignores keys that are not activation keys", () => {
    const activated: string[] = [];
    const marker = markers({ onMarkerActivate: (key) => activated.push(key) })[0];

    for (const key of ["Tab", "a", "ArrowDown", "Escape"]) {
      marker?.onKeyDown?.({ key, preventDefault: () => activated.push(`prevented:${key}`) });
    }

    assert.deepEqual(activated, []);
  });
});

describe("MP/Bermuda shell layout", () => {
  it("renders the drawing and the textual strip from one snapshot projection", () => {
    const markup = layout();

    assert.equal(countAttributeValue(markup, "data-mp-marker-side", "right"), 25);
    assert.equal(countAttributeValue(markup, "data-mp-marker-side", "left"), 25);
    assert.equal(countAttributeValue(markup, "data-mp-marker-side", "shared"), 5);
    assert.equal(countAttributeValue(markup, "data-mp-field-state", "pending"), 55);
    assert.match(markup, /<input[^>]*id="mp-field-mpRightKneeCircumference"/);
  });

  it("keeps the textual strip usable when the drawing cannot render the frozen snapshot", () => {
    const markup = layout({ snapshot: snapshot({ drop: (f) => f.key === "mpLeftFootDorsumCircumference" }) });

    assert.equal(markup.includes("<svg"), false);
    assert.equal(countAttributeValue(markup, "data-mp-field-state", "pending"), 54);
    assert.match(markup, /<input[^>]*id="mp-field-mpRightKneeCircumference"/);
  });

  it("marks exactly the active field in both views and lets active coexist with filled", () => {
    const markup = layout({
      valuesByKey: { mpRightKneeCircumference: "38", mpHeight: "170" },
      activeFieldKey: "mpRightKneeCircumference",
    });
    const marker = openingTagFor(markup, "data-mp-marker-id", "right-knee-circumference") ?? "";
    const row = openingTagFor(markup, "data-mp-field-key", "mpRightKneeCircumference") ?? "";

    assert.equal(countAttributeValue(markup, "aria-current", "true"), 2);
    assert.match(marker, /data-filled="true"/);
    assert.match(marker, /aria-current="true"/);
    assert.match(row, /data-filled="true"/);
    assert.match(row, /aria-current="true"/);
    assert.match(openingTagFor(markup, "data-mp-marker-id", "shared-mpHeight") ?? "", /data-mp-marker-state="filled"/);
    assert.doesNotMatch(openingTagFor(markup, "data-mp-field-key", "mpWeight") ?? "", /data-filled/);
  });

  it("keeps a validation error attached to its own textual input", () => {
    const markup = layout({ errorsByKey: { mpWeight: "Valor fuera de rango" } });

    assert.match(openingTagFor(markup, "id", "mp-field-mpWeight") ?? "", /aria-invalid="true"/);
    assert.doesNotMatch(openingTagFor(markup, "id", "mp-field-mpHeight") ?? "", /aria-invalid/);
    assert.match(markup, /role="alert"[^>]*>Valor fuera de rango/);
  });

  it("focuses the input that owns a marker, and tolerates its absence", () => {
    const seen: string[] = [];
    const doc = { getElementById: (id: string) => ({ focus: () => seen.push(id) }) as unknown as HTMLElement };

    focusMpBermudaField("mpRightKneeCircumference", doc);

    assert.deepEqual(seen, [mpBermudaFieldInputId("mpRightKneeCircumference")]);
    assert.doesNotThrow(() => focusMpBermudaField("mpHeight", { getElementById: () => null }));
    assert.doesNotThrow(() => focusMpBermudaField("mpHeight", null));
  });
});

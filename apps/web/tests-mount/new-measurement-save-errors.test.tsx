/**
 * What the clinician SEES when an MP/Bermuda save is refused.
 *
 * Mounts the real editor with a persisted MP draft, answers its PATCH requests
 * with the API's actual response shapes, and asserts on the rendered form:
 * which inputs are marked invalid, the Spanish text under them, and the banner.
 * Every save attempt must show only its own errors — never a previous
 * response's.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import NewMeasurementClient from "../app/patients/[id]/measurements/new/new-measurement-client";
import { buildMpBermudaTemplate } from "../lib/mp-bermuda-template";
import type { TemplateSnapshot } from "../lib/measurements";
import { cleanup, mount, type MountResult } from "./support/mount";

function mpSnapshot(): TemplateSnapshot {
  const template = buildMpBermudaTemplate();
  return {
    templateId: "tpl",
    code: template.code,
    name: template.name,
    version: template.version,
    description: template.description,
    sections: template.sections.map((section) => ({
      title: section.title,
      sortOrder: section.sortOrder,
      fields: section.fields.map((field) => ({ ...field, id: `fld-${field.key}`, metadata: { ...field.metadata } })),
    })),
  };
}

const MP_REFUSAL = {
  error: "MP/Bermuda completion requirements are incomplete",
  code: "MP_COMPLETION_INVALID",
  reason: "The MP/Bermuda draft was saved, but completion requirements are incomplete.",
  committed: true,
  errors: [
    { field: "valuesByKey.mpWeight", message: "a finite value is required" },
    { field: "valuesByKey.mpShoeSize", message: "a finite value is required" },
  ],
};
const RANGE_REFUSAL = {
  errors: [{ field: "valuesByKey.mpLeftWaistCircumference", message: "must be between 0.1 and 300" }],
};

type Reply = { status: number; body: unknown };

describe("MP editor: save errors are visible, in Spanish, and never stale", () => {
  let replies: Reply[] = [];
  let pushed: string[] = [];
  let originalFetch: typeof globalThis.fetch | undefined;
  let view: MountResult;

  beforeEach(() => {
    replies = [];
    pushed = [];
    const router = {
      push: (href: string) => { pushed.push(href); },
      replace: () => {},
      refresh: () => {},
      back: () => {},
      forward: () => {},
      prefetch: () => {},
    };
    view = mount(
      createElement(
        AppRouterContext.Provider,
        { value: router as never },
        createElement(NewMeasurementClient, {
          patientId: "patient-1",
          patientName: "Paciente Sintético",
          patientSex: "FEMALE",
          initialDraft: {
            id: "session-1",
            templateSnapshot: mpSnapshot(),
            valuesByKey: { mpHeight: 165 },
            measuredAt: new Date("2026-05-05T10:00:00.000Z"),
            garmentType: "MP",
            compressionClass: null,
            diagnosis: null,
            notes: null,
          },
        }),
      ) as React.ReactElement,
    );
    // Installed after mount: the harness registers its own DOM globals first.
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      const reply = replies.shift();
      assert.ok(reply, "unexpected extra PATCH");
      return new Response(JSON.stringify(reply.body), {
        status: reply.status,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;
  });

  afterEach(async () => {
    if (originalFetch) globalThis.fetch = originalFetch;
    await cleanup();
  });

  const doc = () => view.document;
  const input = (key: string) => doc().getElementById(`mp-field-${key}`) as HTMLInputElement;
  const invalidKeys = () =>
    [...doc().querySelectorAll('input[aria-invalid="true"]')].map((element) => element.id.replace("mp-field-", ""));
  const errorText = (key: string) => {
    const ids = (input(key).getAttribute("aria-describedby") ?? "").split(/\s+/);
    return ids.map((id) => doc().getElementById(id)).find((node) => node?.getAttribute("role") === "alert")?.textContent ?? null;
  };
  const bodyText = () => doc().body.textContent ?? "";

  function type(key: string, value: string) {
    const element = input(key);
    flushSync(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function press(label: RegExp, reply: Reply) {
    replies.push(reply);
    const button = [...doc().querySelectorAll("button")].find((element) => label.test(element.textContent ?? ""));
    assert.ok(button, `button ${label} must exist`);
    flushSync(() => button.click());
    // Let the fetch, its JSON body and React's state updates settle.
    for (let i = 0; i < 20 && replies.length > 0; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("marks the out-of-range field of a 400 and explains it in Spanish", async () => {
    type("mpLeftWaistCircumference", "999");
    await press(/Guardar borrador/, { status: 400, body: RANGE_REFUSAL });

    assert.deepEqual(invalidKeys(), ["mpLeftWaistCircumference"]);
    assert.equal(errorText("mpLeftWaistCircumference"), "Debe estar entre 0.1 y 300.");
    assert.match(bodyText(), /No se pudieron guardar las medidas/);
    assert.doesNotMatch(bodyText(), /must be between/);
    assert.deepEqual(pushed, [], "a refused save must keep the editor open");
  });

  it("keeps the MP draft-saved notice and marks the missing values of a 422", async () => {
    await press(/Finalizar/, { status: 422, body: MP_REFUSAL });

    assert.deepEqual(invalidKeys().sort(), ["mpShoeSize", "mpWeight"]);
    assert.equal(errorText("mpWeight"), "Completá este valor para poder finalizar.");
    assert.match(bodyText(), /Guardamos el borrador, pero no pudimos finalizar la sesión/);
    assert.doesNotMatch(bodyText(), /finite value|MP\/Bermuda draft/);
  });

  it("drops the 422 errors when the next attempt answers 400", async () => {
    await press(/Finalizar/, { status: 422, body: MP_REFUSAL });
    type("mpLeftWaistCircumference", "999");
    await press(/Guardar borrador/, { status: 400, body: RANGE_REFUSAL });

    assert.deepEqual(invalidKeys(), ["mpLeftWaistCircumference"]);
    assert.equal(errorText("mpWeight"), null);
    assert.doesNotMatch(bodyText(), /Guardamos el borrador/);
  });

  it("leaves no residual error after a successful retry", async () => {
    type("mpLeftWaistCircumference", "999");
    await press(/Guardar borrador/, { status: 400, body: RANGE_REFUSAL });
    assert.deepEqual(invalidKeys(), ["mpLeftWaistCircumference"], "precondition: the 400 marked the field");
    type("mpLeftWaistCircumference", "70");
    await press(/Guardar borrador/, { status: 200, body: { id: "session-1", status: "DRAFT" } });

    assert.deepEqual(invalidKeys(), []);
    assert.doesNotMatch(bodyText(), /No se pudieron guardar|Debe estar entre/);
    assert.deepEqual(pushed, ["/patients/patient-1/measurements/session-1"]);
  });
});

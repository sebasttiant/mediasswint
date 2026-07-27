import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { ReactElement } from "react";

import { HeadDetailFemale } from "../app/_components/body-highlight/silhouettes/head-detail-female";
import { HeadDetailMale } from "../app/_components/body-highlight/silhouettes/head-detail-male";
import { HeadFigure } from "../app/_components/body-highlight/silhouettes/head-figure";
import {
  HEAD_DETAIL_VIEWBOX,
  HEAD_FIGURE_VIEWBOX,
} from "../app/_components/body-highlight/silhouettes/silhouette-shared";

// These two render paths MUST stay separate: the generic full-body head-hotspot
// detail uses the sex-specific reference PNG, and the dedicated Mentonera
// view="head" path uses the PDF-derived vector figure. No figure or coordinate
// space may leak between them.

type El = ReactElement<Record<string, unknown>, string>;

function collectPaths(node: unknown, out: El[] = []): El[] {
  if (Array.isArray(node)) {
    for (const child of node) collectPaths(child, out);
    return out;
  }
  if (node && typeof node === "object" && "type" in node) {
    const el = node as El;
    if (el.type === "path") out.push(el);
    const children = (el.props as { children?: unknown })?.children;
    if (children) collectPaths(children, out);
  }
  return out;
}

describe("generic head detail vs Mentonera figure — separate render paths", () => {
  it("HeadDetailFemale renders the sex-specific reference PNG (not the SVG)", () => {
    const el = HeadDetailFemale({}) as El;
    assert.equal(el.type, "image");
    assert.equal(el.props.href, "/anatomy/head-female.png");
    assert.equal(el.props.width, HEAD_DETAIL_VIEWBOX.width);
    assert.equal(el.props.height, HEAD_DETAIL_VIEWBOX.height);
  });

  it("HeadDetailMale renders the male reference PNG", () => {
    const el = HeadDetailMale({}) as El;
    assert.equal(el.type, "image");
    assert.equal(el.props.href, "/anatomy/head-male.png");
    assert.equal(el.props.width, HEAD_DETAIL_VIEWBOX.width);
  });

  it("HeadFigure renders the PDF-derived vector paths (not a raster image)", () => {
    const el = HeadFigure() as El;
    assert.equal(el.type, "g");
    assert.equal(el.props.href, undefined, "figure must not embed a raster href");
    const paths = collectPaths(el.props.children);
    assert.ok(paths.length > 30, `expected the traced path set, got ${paths.length}`);
    for (const p of paths) {
      assert.equal(typeof (p.props as { d?: unknown }).d, "string");
    }
  });

  it("the two figures do not share a coordinate space", () => {
    // Generic PNG space is the raster's native size; the Mentonera figure is
    // its own tight vector viewBox. They must differ so overlays never leak.
    assert.notDeepEqual(HEAD_DETAIL_VIEWBOX, HEAD_FIGURE_VIEWBOX);
    assert.ok(HEAD_DETAIL_VIEWBOX.width > HEAD_FIGURE_VIEWBOX.width);
    assert.ok(HEAD_DETAIL_VIEWBOX.height > HEAD_FIGURE_VIEWBOX.height);
  });
});

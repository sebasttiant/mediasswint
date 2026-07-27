import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

/**
 * Minimal rendered-behaviour helpers.
 *
 * `renderToStaticMarkup` needs no jsdom and no test framework — it produces the
 * exact markup the server sends. Combined with the CSS stub hook this is enough
 * to assert what a clinician actually sees: which figure panels are drawn,
 * which markers exist, what the accessible description says, whether the
 * finalize control is disabled.
 *
 * These helpers intentionally parse markup with narrow, explicit queries rather
 * than re-implementing any production filtering logic.
 */

export function render(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

/** All values of `attribute` across the markup, in document order. */
export function attributeValues(markup: string, attribute: string): string[] {
  const pattern = new RegExp(`${attribute}="([^"]*)"`, "g");
  const found: string[] = [];
  for (const match of markup.matchAll(pattern)) {
    if (match[1] !== undefined) found.push(match[1]);
  }
  return found;
}

/** True when an element carrying `attribute="value"` exists. */
export function hasAttributeValue(markup: string, attribute: string, value: string): boolean {
  return attributeValues(markup, attribute).includes(value);
}

/** Text content with tags stripped and entities decoded, for assertions on copy. */
export function textContent(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The opening tag of the first element matching `attribute="value"`, so a test
 * can assert on sibling attributes such as `disabled`.
 */
export function openingTagFor(
  markup: string,
  attribute: string,
  value: string,
): string | null {
  const pattern = new RegExp(`<[^>]*${attribute}="${value}"[^>]*>`);
  return pattern.exec(markup)?.[0] ?? null;
}

/** Count of elements whose `attribute` equals `value`. */
export function countAttributeValue(markup: string, attribute: string, value: string): number {
  return attributeValues(markup, attribute).filter((found) => found === value).length;
}

/**
 * Node module-resolution hooks that let tests import React components which
 * transitively import CSS modules.
 *
 * The unit runner is plain `node --test --import tsx`. Importing
 * body-highlight.tsx fails with ERR_UNKNOWN_FILE_EXTENSION because it imports
 * body-highlight.module.css, and Node has no loader for `.css`. That single
 * limitation is why this codebase had NO rendered-DOM coverage and fell back to
 * asserting on implementation source text.
 *
 * These hooks resolve any `.css` specifier to a tiny module exporting a Proxy
 * that returns the requested class name as a string. Components therefore get
 * stable, meaningful `className` values (`styles.wrapperHead` -> "wrapperHead")
 * without any CSS being parsed. Tests assert on rendered semantics, never on
 * the class strings themselves.
 */

const CSS_STUB_URL = "data:text/javascript," + encodeURIComponent(`
const handler = {
  get(_target, prop) {
    if (prop === "__esModule") return true;
    if (prop === "default") return proxy;
    if (typeof prop === "symbol") return undefined;
    return String(prop);
  },
};
const proxy = new Proxy({}, handler);
export default proxy;
`);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(".css")) {
    return { url: CSS_STUB_URL, shortCircuit: true, format: "module" };
  }
  return nextResolve(specifier, context);
}

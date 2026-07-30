import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";

/**
 * Append-only mount harness for React + happy-dom under the Node test runner.
 *
 * Registers a real DOM globally (so React's client code finds `document` and
 * `window`), renders a component into a fresh container, and returns handles the
 * test can use to assert behavior and drive real events/focus.
 *
 * Each test must call `cleanup()` (see afterEach in mount.smoke.test.ts) so the
 * global DOM is unregistered between tests and state never leaks forward.
 */
export function mount<T>(element: React.ReactElement<T>): MountResult {
  GlobalRegistrator.register();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  flushSync(() => root.render(element));
  roots.set(container, root);
  return { document, window, container };
}

export type MountResult = {
  document: Document;
  window: Window & typeof globalThis;
  container: HTMLElement;
};

const roots = new Map<HTMLElement, Root>();

export async function cleanup(): Promise<void> {
  for (const [container, root] of roots) {
    try {
      flushSync(() => root.unmount());
    } catch {
      // Already unmounted.
    }
    container.remove();
  }
  roots.clear();
  // Let React's scheduler drain pending microtasks before the DOM disappears,
  // otherwise a queued passive effect can run after unregister() and hit a
  // "window is not defined" ReferenceError when it reads a global.
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    GlobalRegistrator.unregister();
  } catch {
    // Already unregistered; safe to ignore.
  }
}

export { createElement };

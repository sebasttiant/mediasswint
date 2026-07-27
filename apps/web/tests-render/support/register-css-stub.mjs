/**
 * Registers the CSS-module resolution hook (see css-module-stub.mjs).
 *
 * Passed to Node via `--import` so it runs before any test module is loaded:
 *   node --import tsx --import ./tests/support/register-css-stub.mjs --test ...
 */
import { register } from "node:module";

register("./css-module-stub.mjs", import.meta.url);

// Guards a dependency contract the test suite cannot otherwise see.
//
// brace-expansion 5 changed its CommonJS shape from a callable default export
// (`module.exports = expand`) to a named one (`exports.expand`). minimatch 3
// and 5 still do `var expand = require('brace-expansion')` and call the result,
// so any resolution that puts a 5.x copy under them throws
// "expand is not a function" the first time a brace pattern is expanded.
//
// That is exactly what a careless security override produces, and nothing else
// here catches it: every suite, the linter, the typechecker and the build stay
// green while the wiring is broken, because no product code path reaches these
// globs today. The hazard is latent, which is precisely why it needs a guard —
// the day something does reach it, the failure would surface in production
// rather than in CI.
//
// The assertion is deliberately about the contract, not about pinned versions:
// every minimatch copy in the tree must be able to expand a brace pattern, no
// matter which brace-expansion line resolution picked for it.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);

// tests/ -> apps/web -> apps -> repo root, where pnpm keeps its virtual store.
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const PNPM_STORE = path.join(REPO_ROOT, "node_modules", ".pnpm");

type MinimatchModule = ((target: string, pattern: string) => boolean) | {
  minimatch?: (target: string, pattern: string) => boolean;
};

function installedMinimatchDirs(): string[] {
  return readdirSync(PNPM_STORE)
    .filter((entry) => entry.startsWith("minimatch@"))
    .map((entry) => path.join(PNPM_STORE, entry, "node_modules", "minimatch"))
    .sort();
}

// v3 and v5 export the matcher itself; v10 exports it as a named property.
function resolveMatcher(loaded: MinimatchModule): (target: string, pattern: string) => boolean {
  if (typeof loaded === "function") return loaded;
  assert.equal(
    typeof loaded.minimatch,
    "function",
    "minimatch exported neither a callable default nor a `minimatch` function",
  );
  return loaded.minimatch as (target: string, pattern: string) => boolean;
}

describe("dependency wiring", () => {
  it("finds every installed minimatch copy", () => {
    const dirs = installedMinimatchDirs();
    assert.ok(
      dirs.length > 0,
      `no minimatch copies found under ${PNPM_STORE} — the guard below would pass vacuously`,
    );
  });

  it("lets every installed minimatch expand a brace pattern", () => {
    for (const dir of installedMinimatchDirs()) {
      const matcher = resolveMatcher(require(dir) as MinimatchModule);

      // The brace group is the point: matching it forces minimatch through
      // brace-expansion, so an incompatible copy throws right here.
      assert.equal(
        matcher("sheet1.xml", "*.{xml,rels}"),
        true,
        `${path.basename(path.dirname(path.dirname(dir)))} could not expand a brace pattern`,
      );
      assert.equal(
        matcher("sheet1.txt", "*.{xml,rels}"),
        false,
        `${path.basename(path.dirname(path.dirname(dir)))} matched a pattern it should reject`,
      );
    }
  });
});

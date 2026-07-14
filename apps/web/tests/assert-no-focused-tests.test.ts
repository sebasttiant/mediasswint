import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { promisify } from "node:util";

import {
  DEFAULT_TESTS_DIR,
  findFocusedCalls,
  findFocusedTestFiles,
  hasFocusedTest,
} from "../scripts/assert-no-focused-tests.mjs";

const execFileAsync = promisify(execFile);

const SCRIPT_PATH = path.join(DEFAULT_TESTS_DIR, "..", "scripts", "assert-no-focused-tests.mjs");

// Focused markers below are data, not code. The guard parses executable AST, so
// a marker inside a string can never be reported — that is what makes this file
// safe to commit while still exercising every bypass.
const ONLY = "only";

async function makeTree(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "focused-guard-"));

  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }

  return root;
}

describe("focused-test guard — detects every confirmed bypass", () => {
  it("detects plain dotted focused calls", () => {
    assert.equal(hasFocusedTest(`describe.${ONLY}("s", () => {});`), true);
    assert.equal(hasFocusedTest(`it.${ONLY}("c", () => {});`), true);
    assert.equal(hasFocusedTest(`test.${ONLY}("c", () => {});`), true);
  });

  it("detects computed string access: it[\"only\"](...)", () => {
    assert.equal(hasFocusedTest(`it["${ONLY}"]("c", () => {});`), true);
    assert.equal(hasFocusedTest(`describe['${ONLY}']("s", () => {});`), true);
    assert.equal(hasFocusedTest(`test[\`${ONLY}\`]("c", () => {});`), true);
  });

  it("detects optional chaining: test?.only(...)", () => {
    assert.equal(hasFocusedTest(`test?.${ONLY}("c", () => {});`), true);
    assert.equal(hasFocusedTest(`it?.["${ONLY}"]("c", () => {});`), true);
  });

  it("detects parenthesised callees: (it).only(...)", () => {
    assert.equal(hasFocusedTest(`(it).${ONLY}("c", () => {});`), true);
    assert.equal(hasFocusedTest(`((describe)).${ONLY}("s", () => {});`), true);
  });

  it("detects focused calls through TS assertion wrappers", () => {
    assert.equal(hasFocusedTest(`(it!).${ONLY}("c", () => {});`), true);
    assert.equal(hasFocusedTest(`(it as never).${ONLY}("c", () => {});`), true);
  });

  it("detects executable focused calls inside template interpolation", () => {
    assert.equal(hasFocusedTest("`${it." + ONLY + '("c", () => {})}`;'), true);
    assert.equal(hasFocusedTest("`outer ${`inner ${test." + ONLY + '("c", () => {})}`}`;'), true);
  });

  it("detects a focused call nested deep inside other expressions", () => {
    assert.equal(
      hasFocusedTest(`function wrap() { return [1].map(() => it.${ONLY}("c", () => {})); }`),
      true,
    );
  });

  it("reports the 1-based line of each focused call", () => {
    const source = ['it("a", () => {});', "", `it.${ONLY}("b", () => {});`].join("\n");

    assert.deepEqual(findFocusedCalls(source), [{ line: 3 }]);
  });
});

describe("focused-test guard — ignores every confirmed false positive", () => {
  it("ignores ordinary describe/it/test calls", () => {
    const source = ['describe("s", () => {', '  it("a", () => {});', '  test("b", () => {});', "});"].join(
      "\n",
    );

    assert.equal(hasFocusedTest(source), false);
  });

  it("ignores regex literals that look like focused calls", () => {
    assert.equal(hasFocusedTest(`const pattern = /it.${ONLY}/u;`), false);
    assert.equal(hasFocusedTest(`const pattern = /describe\\.${ONLY}\\(/gu;`), false);
  });

  it("ignores line and block comments", () => {
    assert.equal(hasFocusedTest(`// never commit it.${ONLY}(...)\nit("c", () => {});`), false);
    assert.equal(hasFocusedTest(`/* describe.${ONLY} is banned */\nit("c", () => {});`), false);
  });

  it("ignores ordinary string literals in every quote style", () => {
    assert.equal(hasFocusedTest(`const a = "it.${ONLY}(x)";`), false);
    assert.equal(hasFocusedTest(`const b = 'describe.${ONLY}(x)';`), false);
  });

  it("ignores template-literal text that is not interpolated code", () => {
    assert.equal(hasFocusedTest("const c = `it." + ONLY + '("c", () => {})`;'), false);
  });

  it("ignores property access that is never invoked", () => {
    assert.equal(hasFocusedTest(`const focused = it.${ONLY};`), false);
    assert.equal(hasFocusedTest(`console.log(typeof describe.${ONLY});`), false);
  });

  it("ignores the only member of unrelated objects", () => {
    assert.equal(hasFocusedTest(`suite.${ONLY}("s", () => {});`), false);
    assert.equal(hasFocusedTest(`myRunner.${ONLY}("s", () => {});`), false);
    assert.equal(hasFocusedTest("const readonly = { only: true };"), false);
  });

  it("parses TSX without treating JSX as a syntax error", () => {
    assert.equal(hasFocusedTest("const view = <div className=\"x\" />;", "a.test.tsx"), false);
    assert.equal(hasFocusedTest(`const v = <div />; it.${ONLY}("c", () => {});`, "a.test.tsx"), true);
  });
});

describe("focused-test guard — directory scan", () => {
  it("reports focused files with line numbers, recursing and skipping non-test files", async () => {
    const root = await makeTree({
      "clean.test.ts": 'it("c", () => {});',
      "fixture.test.ts": `const s = "it.${ONLY}";`,
      "nested/focused.test.ts": `it("a", () => {});\nit.${ONLY}("b", () => {});`,
      "helper.ts": `describe.${ONLY}("not a test file", () => {});`,
    });

    const focused = await findFocusedTestFiles(root);

    assert.equal(focused.length, 1, `unexpected: ${JSON.stringify(focused)}`);
    assert.equal(focused[0]?.file, path.join("nested", "focused.test.ts"));
    assert.deepEqual(focused[0]?.lines, [2]);
  });

  it("returns an empty list for a clean tree", async () => {
    const root = await makeTree({ "clean.test.ts": 'it("c", () => {});' });

    assert.deepEqual(await findFocusedTestFiles(root), []);
  });

  it("defaults to the committed tests directory, which has no focused tests", async () => {
    assert.deepEqual(await findFocusedTestFiles(), []);
  });
});

describe("focused-test guard — end to end", () => {
  it("exits non-zero and names the file when a real focused test exists", async () => {
    const root = await makeTree({
      "zz-focused.test.ts": `import { it } from "node:test";\nit.${ONLY}("focused", () => {});`,
    });

    const failure = await execFileAsync(process.execPath, [SCRIPT_PATH, root]).then(
      () => null,
      (error: { code?: number; stderr?: string }) => error,
    );

    assert.ok(failure, "expected the guard to exit non-zero");
    assert.equal(failure.code, 1);
    assert.match(String(failure.stderr), /zz-focused\.test\.ts/u);
  });

  it("exits zero for a clean directory, from any working directory", async () => {
    const root = await makeTree({ "clean.test.ts": 'it("c", () => {});' });

    const { stderr } = await execFileAsync(process.execPath, [SCRIPT_PATH, root], { cwd: tmpdir() });

    assert.equal(stderr, "");
  });

  it("scans the real tests directory when run from the repository root", async () => {
    const repoRoot = path.resolve(DEFAULT_TESTS_DIR, "..", "..", "..");

    const { stderr } = await execFileAsync(process.execPath, [SCRIPT_PATH], { cwd: repoRoot });

    assert.equal(stderr, "");
  });
});

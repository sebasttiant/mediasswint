import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const TEST_FILE_PATTERN = /\.test\.(?:[cm]?[jt]sx?)$/u;
const FOCUSED_ROOTS = new Set(["describe", "it", "test"]);
const FOCUSED_MEMBER = "only";

// The tests directory is resolved from this script's own location, never from
// process.cwd(), so the guard behaves identically whether it is invoked from the
// repository root or from apps/web.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_TESTS_DIR = path.resolve(SCRIPT_DIR, "..", "tests");

function scriptKindFor(fileName) {
  if (fileName.endsWith("x")) return ts.ScriptKind.TSX;
  return ts.ScriptKind.TS;
}

// Peel away the wrappers that do not change what is being invoked, so that
// `(it).only(...)`, `(it!).only(...)` and `(it as Fn).only(...)` all resolve
// back to the `it` identifier.
function unwrapExpression(node) {
  let current = node;

  for (;;) {
    if (
      ts.isParenthesizedExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isTypeAssertionExpression(current)
    ) {
      current = current.expression;
      continue;
    }

    return current;
  }
}

function isFocusedRoot(node) {
  const root = unwrapExpression(node);
  return ts.isIdentifier(root) && FOCUSED_ROOTS.has(root.text);
}

// True when `callee` selects the `only` member of describe/it/test, covering
// dotted access, optional chaining and computed string access.
function isFocusedCallee(callee) {
  const target = unwrapExpression(callee);

  // describe.only(...) / it?.only(...)
  if (ts.isPropertyAccessExpression(target)) {
    return target.name.text === FOCUSED_MEMBER && isFocusedRoot(target.expression);
  }

  // it["only"](...) / test?.["only"](...)
  if (ts.isElementAccessExpression(target)) {
    const argument = target.argumentExpression;
    const isOnlyLiteral =
      (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) &&
      argument.text === FOCUSED_MEMBER;

    return isOnlyLiteral && isFocusedRoot(target.expression);
  }

  return false;
}

// Walks executable nodes only. Comments, string contents, template-literal text
// and regex literals are not CallExpressions, so they can never be reported.
// A focused call inside `${...}` IS executable and is reached by this walk.
export function findFocusedCalls(source, fileName = "source.ts") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    scriptKindFor(fileName),
  );

  const focusedCalls = [];

  const visit = (node) => {
    if (ts.isCallExpression(node) && isFocusedCallee(node.expression)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      focusedCalls.push({ line: line + 1 });
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  return focusedCalls;
}

export function hasFocusedTest(source, fileName = "source.ts") {
  return findFocusedCalls(source, fileName).length > 0;
}

export async function collectTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectTestFiles(entryPath);
      }

      if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
        return [entryPath];
      }

      return [];
    }),
  );

  return files.flat();
}

export async function findFocusedTestFiles(directory = DEFAULT_TESTS_DIR) {
  const testFiles = await collectTestFiles(directory);
  const focused = [];

  for (const testFile of testFiles) {
    const content = await readFile(testFile, "utf8");
    const calls = findFocusedCalls(content, testFile);

    if (calls.length > 0) {
      focused.push({
        file: path.relative(directory, testFile),
        lines: calls.map((call) => call.line),
      });
    }
  }

  return focused;
}

// Importing this module must stay side-effect free: the scan only runs when the
// script is executed directly. Without this check, importing it from a test
// would run the scan and set a failing exit code for the whole suite.
const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const directory = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_TESTS_DIR;
  const focused = await findFocusedTestFiles(directory);

  if (focused.length > 0) {
    console.error("Focused tests are not allowed in committed unit tests:");
    for (const { file, lines } of focused) {
      console.error(`- ${file} (line${lines.length > 1 ? "s" : ""} ${lines.join(", ")})`);
    }
    process.exitCode = 1;
  }
}

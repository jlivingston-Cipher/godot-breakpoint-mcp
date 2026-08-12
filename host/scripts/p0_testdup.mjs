// p0_testdup.mjs — session 241. P0 · test duplication, clustered by WHAT A TEST ASSERTS.
//
// The charter's words: "same subject + same oracle + same shape = a merge candidate."
//
//   subject  the first thing the body actually calls that is not language furniture
//   oracle   the multiset of assertion methods used — what would have to be wrong for
//            the test to fail
//   shape    ERR/OK · ASYNC/SYNC · SERVER/PURE · SINGLE/MULTI
//
// 🔴 A CLUSTER IS A CANDIDATE, NOT A VERDICT. Two tests sharing a key are worth opening;
// they are not proved redundant. Reporting them as "duplicates" would be the same error
// the inventory's §1 records against ts-prune — a reader whose output reads as a decision
// it did not make.
//
// This file PRINTS. Its claims are in p0_testdup.selftest.mjs beside it, which is where
// the `async` defect below is pinned so it cannot come back.
import ts from "typescript";
import { readFileSync, globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// resolve against host/, not the caller's cwd — a reporter whose population depends on
// where it was invoked from is a reporter whose count nobody can reproduce.
export const HOST = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 🔴 THE FIRST DRAFT'S LARGEST CLUSTER WAS 44 TESTS UNDER THE SUBJECT `async`.
// `\b(\w+)\s*\(` matches the `async (` of every `async () => {}` callback, so the top row
// of the report was a language keyword shared by every asynchronous test in the suite —
// a subject common to a third of the population and therefore no subject at all. The
// clusterer was measuring its own regex. Keys moved 331 -> 457 when this set was added.
export const NOISE = new Set([
  "assert", "test", "it", "if", "for", "while", "catch", "switch", "return",
  "await", "async", "function", "String", "Number", "Boolean", "Object", "Array",
  "JSON", "Promise", "Map", "Set", "Error", "require", "describe", "before",
  "after", "beforeEach", "afterEach", "expect", "console", "setTimeout", "t",
]);

export function oracleOf(src) {
  const oracle = {};
  for (const m of src.matchAll(/\bassert\s*\.\s*(\w+)/g)) oracle[m[1]] = (oracle[m[1]] || 0) + 1;
  for (const m of src.matchAll(/\bassert\s*\(/g)) oracle.ok = (oracle.ok || 0) + 1;
  return oracle;
}

// 🔴 AND THE SELFTEST FOUND THE SAME DEFECT A SECOND TIME, ONE TOKEN OVER. With `async`
// in NOISE the walker still read `assert.equal(toFsPath(x), y)` as subject `equal` — the
// bare-identifier filter drops `assert`, but `\b(\w+)\s*\(` then matches the METHOD NAME
// after the dot. So the subject of a test was frequently its assertion method: `equal`,
// `ok`, `deepEqual`. Two drafts, two subjects that were syntax rather than semantics.
// A member name is not a call to a thing under test, so the identifier must not be
// preceded by a dot. This claim is pinned in p0_testdup.selftest.mjs.
const CALL_RE = /(?<![.\w$])([a-zA-Z_$][\w$]*)\s*\(/g;

export function subjectOf(src) {
  const calls = [...src.matchAll(CALL_RE)]
    .map((m) => m[1])
    .filter((n) => !NOISE.has(n));
  return calls[0] || "<none>";
}

export function shapeOf(src, oracle) {
  return [
    src.includes("rejects") || src.includes("throws") ? "ERR" : "OK",
    /\bawait\b/.test(src) ? "ASYNC" : "SYNC",
    /makeServer|createServer|buildServer|newServer/.test(src) ? "SERVER" : "PURE",
    Object.values(oracle).reduce((a, b) => a + b, 0) <= 1 ? "SINGLE" : "MULTI",
  ].join("/");
}

export function oracleKeyOf(oracle) {
  return Object.keys(oracle).sort().map((k) => `${k}x${oracle[k]}`).join(",") || "<none>";
}

/** Every `test(...)`/`it(...)` in one source, with its cluster key. */
export function extractTests(text, fileName = "<mem>") {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true);
  const out = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === "test" || node.expression.text === "it") &&
      node.arguments.length >= 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      const name = node.arguments[0].text;
      const src = node.arguments[node.arguments.length - 1].getText(sf);
      const oracle = oracleOf(src);
      const subject = subjectOf(src);
      const oracleKey = oracleKeyOf(oracle);
      const shape = shapeOf(src, oracle);
      out.push({ file: fileName, name, subject, oracleKey, shape, key: `${subject} | ${oracleKey} | ${shape}` });
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return out;
}

export function cluster(tests) {
  const byKey = new Map();
  for (const t of tests) {
    if (!byKey.has(t.key)) byKey.set(t.key, []);
    byKey.get(t.key).push(t);
  }
  return byKey;
}

function main() {
  const files = globSync("test/**/*.ts", { cwd: HOST });
  const tests = files.flatMap((f) => extractTests(readFileSync(resolve(HOST, f), "utf8"), f));
  const byKey = cluster(tests);
  const clusters = [...byKey.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);

  console.log(`=== TEST DUPLICATION — ${tests.length} test(s) across ${files.length} file(s) ===`);
  console.log(`distinct (subject | oracle | shape) keys: ${byKey.size}`);
  console.log(`clusters of 2+: ${clusters.length}   tests inside them: ${clusters.reduce((a, [, v]) => a + v.length, 0)}`);
  console.log(`singletons: ${[...byKey.values()].filter((v) => v.length === 1).length}`);
  console.log("\n=== TOP 25 CLUSTERS — candidates for P5, not verdicts ===");
  for (const [k, v] of clusters.slice(0, 25)) {
    const filesIn = new Set(v.map((t) => t.file));
    console.log(`\n${v.length}x  ${k}   [${filesIn.size} file(s)]`);
    for (const t of v.slice(0, 4)) console.log(`      ${t.file}  ${t.name.slice(0, 88)}`);
    if (v.length > 4) console.log(`      … ${v.length - 4} more`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

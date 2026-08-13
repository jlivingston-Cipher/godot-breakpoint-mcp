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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
// 🔴 242 — SHARED WITH `p0_complexity.mjs` RATHER THAN COPIED. Both reporters shipped the
// same `globSync` import in 241 and both failed to LINK on Node 18 and 20 (see the note
// on `walkTs`); importing the one walk means the engine floor is asserted in one place.
import { walkTs } from "./p0_complexity.mjs";

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

// 🆕 244 §4 — THE SECOND COMMAND, SAME REASON AS `p0_complexity.mjs`'s AND A DIFFERENT
// COLLAPSE. This reporter's whole output is a CLUSTERING, so its failure mode is not an
// empty population — it is a key function that stops discriminating. Measured, not
// assumed: `subjectOf` blinded takes 469 keys to 240 and 355 singletons to 145 while the
// test count, the file count and the CLUSTER count all stay healthy, so the collapse is
// visible in exactly the two quantities a duplication report is about. `shapeOf` blinded
// takes nine shapes to one and leaves everything else inside its floor.
// 🔴 SO THE FLOOR IS ON THE PARTS AND NOT ON THE VERDICT, AND THAT IS THE POINT. A
// clustering has two ways to stop being one — everything in a cluster, or nothing — and a
// floor on the cluster count alone is blind to the first. Each of the three key
// components carries its own, singletons carry one against the collapse direction, and
// none is summed (172 §6). Measured live: 53 files, 724 tests, 469 keys, 114 clusters,
// 355 singletons, 129 subjects, 9 shapes. Floored from BELOW with headroom (198 §36).
export const FLOOR = {
  files: 45,
  tests: 600,
  keys: 380,
  clusters: 40,
  singletons: 250,
  subjects: 100,
  shapes: 5,
};

export function floorProblems(tests, files, byKey, floor = FLOOR) {
  const out = [];
  const at = (what, got, want) => {
    if (got < want) out.push(`${what} ${got}, floor ${want}`);
  };
  const part = (i) => new Set(tests.map((t) => String(t.key).split(" | ")[i])).size;
  at("test files walked", files.length, floor.files);
  at("tests extracted", tests.length, floor.tests);
  at("distinct keys", byKey.size, floor.keys);
  at("clusters of 2+", [...byKey.values()].filter((v) => v.length > 1).length, floor.clusters);
  at("singleton keys", [...byKey.values()].filter((v) => v.length === 1).length, floor.singletons);
  at("distinct subjects", part(0), floor.subjects);
  at("distinct shapes", part(2), floor.shapes);
  return out;
}

function main() {
  const files = walkTs(resolve(HOST, "test"), HOST);
  const tests = files.flatMap((f) => extractTests(readFileSync(resolve(HOST, f), "utf8"), f));
  const byKey = cluster(tests);
  const clusters = [...byKey.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);

  if (process.argv.includes("--floor")) {
    // 🔴 THE CENSUS FIRST — see p0_complexity.mjs's for why it is not the `ok` line.
    console.log(
      `P0_TESTDUP_CENSUS files=${files.length} tests=${tests.length} keys=${byKey.size} ` +
      `clusters=${clusters.length} ` +
      `singletons=${[...byKey.values()].filter((v) => v.length === 1).length}`,
    );
    const problems = floorProblems(tests, files, byKey);
    // 🔴 `FAIL <NAME>` — the spelling `failure_lines` counts; see p0_complexity.mjs.
    for (const p of problems) console.log(`  FAIL P0_TESTDUP_FLOOR ${p}`);
    if (problems.length) {
      console.log(
        `P0_TESTDUP_FLOOR ${problems.length} measure(s) collapsed — this reporter is ` +
        `still printing and has stopped discriminating`,
      );
      process.exitCode = 1;
      return;
    }
    console.log("P0_TESTDUP_FLOOR ok — every measure is above its floor");
    return;
  }

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

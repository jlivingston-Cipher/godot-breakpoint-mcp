// p0_testdup.selftest.mjs — session 241. The claims p0_testdup.mjs does not make itself.
//
// 🔴 THE FIRST CASE BELOW IS A NEGATIVE CONTROL ON A DEFECT THIS FILE'S SUBJECT SHIPPED
// WITH. The clusterer's first draft put 44 tests — a third of the asynchronous suite —
// into one cluster under the subject `async`, because `\b(\w+)\s*\(` matches the `async (`
// of every arrow callback. The top row of a duplication report was a language keyword.
// A comment saying "don't do that again" is a sentence; 240's whole finding is that a
// sentence and the code enforcing it are not the same artifact. This is the artifact.
import assert from "node:assert/strict";
import { test } from "node:test";
import { NOISE, cluster, extractTests, oracleKeyOf, oracleOf, shapeOf, subjectOf, floorProblems, FLOOR } from "./p0_testdup.mjs";

// ── subject ───────────────────────────────────────────────────────────────────────
test("subjectOf never returns `async` — the defect that made a keyword the top cluster", () => {
  assert.notEqual(subjectOf("async () => { await callTheTool(1); }"), "async");
  assert.equal(subjectOf("async () => { await callTheTool(1); }"), "callTheTool");
});

test("every language keyword that can precede `(` is in NOISE", () => {
  for (const kw of ["async", "await", "function", "if", "for", "while", "switch", "catch", "return"]) {
    assert.ok(NOISE.has(kw), `${kw} must be noise, not a subject`);
  }
});

test("subjectOf skips the assertion itself and reaches the thing under test", () => {
  assert.equal(subjectOf("assert.equal(toFsPath('res://a.gd'), '/a.gd')"), "toFsPath");
});

test("subjectOf reports <none> rather than inventing one when the body calls nothing", () => {
  assert.equal(subjectOf("assert.ok(true)"), "<none>");
});

// ── oracle ────────────────────────────────────────────────────────────────────────
test("oracleOf counts each assertion method separately, with multiplicity", () => {
  assert.deepEqual(
    oracleOf("assert.equal(a,1); assert.equal(b,2); assert.match(c,/x/)"),
    { equal: 2, match: 1 },
  );
});

test("a bare assert(...) is counted as `ok`, not dropped", () => {
  assert.deepEqual(oracleOf("assert(x > 1)"), { ok: 1 });
});

test("oracleKeyOf is stable under source order — a key that reordered would split a cluster", () => {
  assert.equal(
    oracleKeyOf(oracleOf("assert.match(c,/x/); assert.equal(a,1)")),
    oracleKeyOf(oracleOf("assert.equal(a,1); assert.match(c,/x/)")),
  );
});

test("oracleKeyOf names the empty oracle rather than returning an empty string", () => {
  assert.equal(oracleKeyOf({}), "<none>");
});

// ── shape ─────────────────────────────────────────────────────────────────────────
test("shape separates the error path from the happy path", () => {
  assert.match(shapeOf("await assert.rejects(p)", { rejects: 1 }), /^ERR\//);
  assert.match(shapeOf("await assert.equal(a,1)", { equal: 1 }), /^OK\//);
});

test("shape separates a single-oracle test from a multi-oracle one", () => {
  assert.match(shapeOf("assert.equal(a,1)", { equal: 1 }), /SINGLE$/);
  assert.match(shapeOf("assert.equal(a,1);assert.equal(b,2)", { equal: 2 }), /MULTI$/);
});

test("a synchronous body is not reported as ASYNC", () => {
  assert.match(shapeOf("assert.equal(a,1)", { equal: 1 }), /\/SYNC\//);
});

// ── extraction and clustering ─────────────────────────────────────────────────────
const SRC = `
import { test } from "node:test";
test("first", async () => { await runTool("a"); assert.deepEqual(r, {}); });
test("second", async () => { await runTool("b"); assert.deepEqual(r, {}); });
it("third", () => { assert.equal(pureFn(1), 2); });
`;

test("extractTests finds both test() and it() blocks", () => {
  assert.equal(extractTests(SRC, "s.ts").length, 3);
});

test("two tests with the same subject, oracle and shape land in one cluster", () => {
  const byKey = cluster(extractTests(SRC, "s.ts"));
  const sizes = [...byKey.values()].map((v) => v.length).sort((a, b) => b - a);
  assert.deepEqual(sizes, [2, 1]);
});

test("🔴 NEGATIVE CONTROL — the three tests do NOT collapse into one cluster", () => {
  // With the `async` defect present every one of these keys began `async | …`, and the
  // sync test's different subject was the only thing keeping them apart. If a future
  // edit puts a keyword back in the subject, this is the claim that goes red.
  const byKey = cluster(extractTests(SRC, "s.ts"));
  assert.equal(byKey.size, 2);
  for (const key of byKey.keys()) assert.ok(!key.startsWith("async "), `keyword subject: ${key}`);
});

test("a file with no tests contributes nothing rather than throwing", () => {
  assert.deepEqual(extractTests("export const x = 1;", "s.ts"), []);
});

// ── 🆕 244 §4 — THE FLOOR READER, SAME REASON AS `p0_complexity.selftest.mjs`'s ───────
//
// 🔴 AND ONE CLAIM THIS FILE HAS THAT ITS SIBLING DOES NOT: THE COLLAPSE HAS TWO
// DIRECTIONS. A clustering stops being one when everything shares a key AND when nothing
// does, and a floor on the cluster count alone is blind to the first. Both are asserted.
const mk = (n, keyFn) => Array.from({ length: n }, (_, i) => ({
  file: `t${i % 50}.test.ts`, name: `t${i}`, key: keyFn(i),
}));
const SHAPES = ["OK/SYNC/PURE/SINGLE", "OK/SYNC/PURE/MULTI", "OK/ASYNC/PURE/SINGLE",
                "ERR/SYNC/PURE/SINGLE", "ERR/ASYNC/SERVER/MULTI", "OK/ASYNC/SERVER/MULTI"];
// 500 singletons and 200 tests spread over 60 repeated keys — a real duplication report's
// shape, and the only fixture both directions of the claim below can be measured against.
const healthy = mk(700, (i) => (i < 500
  ? `subj${i} | okx${i % 7} | ${SHAPES[i % SHAPES.length]}`
  : `dup${(i - 500) % 60} | okx1 | ${SHAPES[i % SHAPES.length]}`));
const files = Array.from({ length: 50 }, (_, i) => `t${i}.test.ts`);

test("a healthy clustering is accepted", () => {
  assert.deepEqual(floorProblems(healthy, files, cluster(healthy)), []);
});

test("everything in ONE cluster is refused — the singleton floor is what sees it", () => {
  const collapsed = mk(700, () => "S | okx1 | OK/SYNC/PURE/SINGLE");
  const problems = floorProblems(collapsed, files, cluster(collapsed));
  assert.ok(problems.some((p) => p.startsWith("singleton keys 0")), problems.join("; "));
  assert.ok(problems.some((p) => p.startsWith("distinct keys 1")), problems.join("; "));
  assert.ok(!problems.some((p) => p.startsWith("tests extracted")),
    "every test is still there — the population is not what collapsed");
});

test("everything a SINGLETON is refused — the cluster floor is what sees it", () => {
  const scattered = mk(700, (i) => `subj${i} | okx${i} | ${SHAPES[i % SHAPES.length]}`);
  const problems = floorProblems(scattered, files, cluster(scattered));
  assert.ok(problems.some((p) => p.startsWith("clusters of 2+ 0")), problems.join("; "));
  assert.ok(!problems.some((p) => p.startsWith("singleton keys")),
    "the other direction must stay quiet, or the two claims are one claim");
});

test("every floor is named in the problem it produces, and none is summed", () => {
  assert.equal(floorProblems([], [], new Map()).length, Object.keys(FLOOR).length);
});

// ── 🆕 244 §4 — THE ORACLE KEY, WHICH THIS FILE DID NOT COVER AND THE SWEEP SAID SO ───
//
// 🔴 SAME FINDING AS `walkTs`'s ONE FILE OVER, AND THE SAME FIRST SWEEP FOUND IT.
// `{SIG:oracleKeyOf}` blinded to a constant left every claim here green: the key's MIDDLE
// component is what tells `assert.equal` used once from `assert.equal` used three times,
// and nothing asserted the spelling it produces. It is one third of the clustering key
// this whole file exists to defend.
test("the oracle key is sorted, counted, and stable under key order", () => {
  assert.equal(oracleKeyOf({ ok: 1, equal: 2 }), "equalx2,okx1");
  assert.equal(oracleKeyOf({ equal: 2, ok: 1 }), "equalx2,okx1",
    "two tests asserting the same things must land on ONE key whatever order they wrote them in");
});

test("a test with no assertions gets a key that says so rather than an empty string", () => {
  assert.equal(oracleKeyOf({}), "<none>");
});

test("the COUNT is part of the key — one assert.equal is not three", () => {
  assert.notEqual(oracleKeyOf({ equal: 1 }), oracleKeyOf({ equal: 3 }));
});

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
import {
  NOISE, cluster, extractTests, oracleKeyOf, oracleOf, shapeOf, subjectOf,
} from "./p0_testdup.mjs";

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

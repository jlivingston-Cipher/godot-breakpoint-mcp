// p0_complexity.selftest.mjs — session 241. The claims p0_complexity.mjs does not make.
//
// The load-bearing one is NESTED_FUNCTIONS_ARE_THEIR_OWN_ROW. This tree's registration
// bodies hold twenty-odd tool callbacks each; if the walker charged a nested function's
// branches to its parent, `registerRuntimeTools` would top every column and the real
// finding — a 32-line function at cognitive 76 — would sit below forty flat ones.
import assert from "node:assert/strict";
import { test } from "node:test";
import { measureSource } from "./p0_complexity.mjs";

const rowFor = (src, name) => measureSource(src, "t.ts").rows.find((r) => r.name === name);

test("a branchless function is cyclomatic 1, cognitive 0, nesting 0", () => {
  const r = rowFor("function f() { return 1; }", "f");
  assert.deepEqual([r.cyclo, r.cognitive, r.maxNest], [1, 0, 0]);
});

test("each decision point adds exactly one to cyclomatic", () => {
  assert.equal(rowFor("function f(a){ if(a) return 1; return 2; }", "f").cyclo, 2);
  assert.equal(rowFor("function f(a){ if(a) return 1; if(a) return 2; return 3; }", "f").cyclo, 3);
});

test("a logical operator is a decision point too — `a && b` is a hidden branch", () => {
  assert.equal(rowFor("function f(a,b){ return a && b; }", "f").cyclo, 2);
  assert.equal(rowFor("function f(a,b,c){ return a && b || c; }", "f").cyclo, 3);
});

test("cognitive charges for depth and cyclomatic does not — the whole reason for two columns", () => {
  const flat = rowFor("function f(a,b){ if(a){return 1;} if(b){return 2;} return 3; }", "f");
  const deep = rowFor("function f(a,b){ if(a){ if(b){ return 1; } } return 3; }", "f");
  assert.equal(flat.cyclo, deep.cyclo, "same number of decision points");
  assert.ok(deep.cognitive > flat.cognitive, "nested must cost more than sequential");
  assert.deepEqual([flat.maxNest, deep.maxNest], [1, 2]);
});

test("nesting depth is the deepest path, not the count of nesting nodes", () => {
  assert.equal(rowFor("function f(a){ if(a){ for(;;){ while(a){ } } } }", "f").maxNest, 3);
});

test("🔴 NESTED_FUNCTIONS_ARE_THEIR_OWN_ROW — a callback's branches are not the parent's", () => {
  const src = `
    function register(s) {
      s.tool("a", (x) => { if (x) { if (x > 1) { return 1; } } return 0; });
      s.tool("b", (y) => { if (y) { if (y > 1) { return 1; } } return 0; });
    }`;
  const { rows } = measureSource(src, "t.ts");
  const parent = rows.find((r) => r.name === "register");
  assert.equal(parent.cyclo, 1, "the registration body itself branches on nothing");
  assert.equal(parent.cognitive, 0);
  assert.equal(rows.length, 3, "the parent and both callbacks each get a row");
  for (const cb of rows.filter((r) => r !== parent)) assert.equal(cb.cyclo, 3);
});

test("a long flat function ranks below a short dense one on cognitive — the tree's real shape", () => {
  const flat = `function big(){ ${"const x0 = 1;\n".repeat(60)} return 1; }`;
  const dense = "function small(a,b,c){ if(a){ if(b){ if(c){ return 1; } } } return 0; }";
  const b = rowFor(flat, "big");
  const s = rowFor(dense, "small");
  assert.ok(b.length > s.length * 5, "the flat one is far longer");
  assert.ok(s.cognitive > b.cognitive, "and far less complex by cognitive — that is the point");
});

test("arrow functions and methods are measured, not only declarations", () => {
  const { rows } = measureSource("const f = (a) => a ? 1 : 2; class C { m(a){ return a?1:2; } }", "t.ts");
  assert.deepEqual(rows.map((r) => r.name).sort(), ["f", "m"]);
  for (const r of rows) assert.equal(r.cyclo, 2, "a ternary is a decision point");
});

test("a catch clause counts and an empty try does not double-count", () => {
  assert.equal(rowFor("function f(){ try { g(); } catch(e) { h(); } }", "f").cyclo, 2);
});

test("file length and file max-nesting are reported alongside the rows", () => {
  const r = measureSource("function f(a){ if(a){ if(a){} } }\n\n\n", "t.ts");
  assert.equal(r.lines, 4);
  assert.equal(r.maxNest, 2);
});

test("a source with no functions yields no rows rather than throwing", () => {
  assert.deepEqual(measureSource("export const x = 1;", "t.ts").rows, []);
});

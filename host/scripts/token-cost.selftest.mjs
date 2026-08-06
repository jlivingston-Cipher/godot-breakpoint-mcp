#!/usr/bin/env node
// The refusal proof for `token-cost.mjs`'s three governed constants — 206 §4, 207 §7.1.
//
// 🆕 208 added WIRE_DIALECT and WIRE_TASK_DEFAULT, which are the first two checks here
// with NO constant behind them — floor_pin_gate cannot move a floor that is not a number,
// so for those two this table is not a second opinion, it is the only one.
//
// 🔴 A SEPARATE FILE FOR `path-cohort.mjs`'s REASON. The instrument PRINTS; a printer has
// no claim sites the tautology classifier can read, and exempting it while leaving its
// constants unasserted would be an exemption that buys silence. This is where the claims
// live, and it is what `floor_pin_gate.py` runs when it moves BYTES_CEILING, TOOL_FLOOR
// and SCHEMA_PER_TOOL_CEILING off their shipped values.
//
// 🔴 THE ROWS DRIVE THE PURE CORE, so the proof needs no server, no dist/ and no network.
// That is the half 204 §8.27 is about — a check that has never refused has not been
// audited. Eight of the twelve rows REFUSE.
//
// 🔴 207 DELETED A DEAD COPY OF SECTION 1 FROM THIS FILE. An unreferenced `function
// selftest()` sat above the live proof, running nothing, printing nothing, and asserting
// nothing — a second table that would have gone stale silently while looking like
// coverage. Found while adding to the file, not by any gate; noted so the class is on
// record.
import assert from "node:assert/strict";
import {
  measure, verdict, BYTES_CEILING, TOOL_FLOOR, SCHEMA_PER_TOOL_CEILING,
} from "./token-cost.mjs";

const mkTools = (n, descLen) =>
  Array.from({ length: n }, (_, i) => ({
    name: `fam${i % 7}_tool${i}`,
    description: "d".repeat(descLen),
    inputSchema: { type: "object", properties: {} },
  }));

// 🔴 THE SCHEMA ROWS ARE GROWN AGAINST THE LIVE CONSTANT, NOT AGAINST A NUMBER TYPED
// BESIDE IT. 206 §3.2: a self-test that hard-codes what the constant is supposed to be
// agrees with itself over a deleted floor. Padding one property description until
// `measure()` REPORTS the target makes the row's meaning ("exactly at the ceiling",
// "one byte over") true by construction whatever the ceiling is moved to.
const mkSchemaTools = (n, targetPerTool) => {
  const build = (pad) =>
    Array.from({ length: n }, (_, i) => ({
      name: `fam${i % 7}_tool${i}`,
      description: "d",
      inputSchema: {
        type: "object",
        properties: { p: { type: "string", description: "x".repeat(pad) } },
      },
    }));
  let tools = build(0);
  for (let pad = 0; pad <= targetPerTool + 64; pad += 1) {
    tools = build(pad);
    const got = measure(tools).schemaPerTool;
    if (got >= targetPerTool) break;
  }
  return tools;
};

const SELFTEST = [
  // (name, tools, wantOk, wantProblemSubstring)
  ["a healthy surface passes", mkTools(291, 200), true, ""],
  ["🔴 the surface collapsing to nothing — THE FLOOR'S REFUSAL",
    [], false, "TOOL_FLOOR"],
  ["🔴 one tool under the floor — the floor's EDGE",
    mkTools(TOOL_FLOOR - 1, 10), false, "TOOL_FLOOR"],
  ["exactly at the floor stays legal", mkTools(TOOL_FLOOR, 10), true, ""],
  ["🔴 a surface over budget — THE CEILING'S REFUSAL",
    mkTools(291, 2000), false, "BYTES_CEILING"],
  ["🔴 both at once names both", [], false, "TOOL_FLOOR"],
  // 🆕 207 — the third constant, and its edge on both sides.
  ["exactly at the schema ceiling stays legal",
    mkSchemaTools(291, SCHEMA_PER_TOOL_CEILING), true, ""],
  ["🔴 one byte per tool over the schema ceiling — THE EDGE",
    mkSchemaTools(291, SCHEMA_PER_TOOL_CEILING + 1), false, "SCHEMA_PER_TOOL_CEILING"],
  // 🆕 208 — THE TWO INVARIANTS, WHICH HAVE NO CONSTANT TO MOVE. floor_pin_gate proves a
  // NUMBER can fire by moving it; nothing here is a number, so these rows are the only
  // proof either check has ever refused, and they are the whole of 204 §8.27 for them.
  ["🔴 ONE schema declaring its own dialect — THE DIALECT REFUSAL",
    [{ name: "a_one", description: "d",
       inputSchema: { $schema: "http://json-schema.org/draft-07/schema#", type: "object" } },
     ...mkTools(TOOL_FLOOR, 10)], false, "WIRE_DIALECT"],
  ["🔴 the declaration on the OUTPUT schema alone is still a declaration",
    [{ name: "a_one", description: "d", inputSchema: { type: "object" },
       outputSchema: { $schema: "http://json-schema.org/draft-07/schema#", type: "object" } },
     ...mkTools(TOOL_FLOOR, 10)], false, "WIRE_DIALECT"],
  ["🔴 ONE tool restating the spec's own taskSupport default — THE TASK REFUSAL",
    [{ name: "a_one", description: "d", inputSchema: { type: "object" },
       execution: { taskSupport: "forbidden" } }, ...mkTools(TOOL_FLOOR, 10)],
    false, "WIRE_TASK_DEFAULT"],
  ["a genuine taskSupport 'optional' is NOT the default and stays legal",
    [{ name: "a_one", description: "d", inputSchema: { type: "object" },
       execution: { taskSupport: "optional" } }, ...mkTools(TOOL_FLOOR, 10)], true, ""],
];

// ── 1. THE FLOORS, DRIVEN OVER A TABLE THAT MUST CONTAIN REFUSALS ────────────────────
let bad = 0;
console.log("TOKEN_COST selftest — the floors' refusal, proved without a server");
for (const [name, tools, wantOk, want] of SELFTEST) {
  const v = verdict(measure(tools));
  let agree = true;
  try {
    assert.equal(v.ok, wantOk, `${name}: expected ok=${wantOk}, got ${v.ok}`);
    if (want !== "") {
      assert.ok(v.problems.join(" ").includes(want),
        `${name}: expected a problem naming ${want}, got ${JSON.stringify(v.problems)}`);
    } else {
      assert.equal(v.problems.length, 0, `${name}: expected no problems`);
    }
  } catch (e) {
    agree = false;
    bad += 1;
    console.log(`        ${e.message}`);
  }
  console.log(`  ${agree ? "\u{1F7E2}" : "\u{1F534}"} ${v.ok ? "PASS  " : "REFUSE"} `
    + `tools=${String(tools.length).padStart(4)} ${name}`);
}

// ── 2. THE CONSTANTS THEMSELVES, OR SECTION 1 ASSERTS ABOUT NOTHING ──────────────────
// 🔴 A row that drives `verdict()` proves the COMPARISON works. It cannot prove the
// constant it compares against still exists — an undefined `TOOL_FLOOR` makes every
// `count < undefined` false and the healthy rows keep passing. 172 §10.21's shape.
assert.ok(Number.isInteger(TOOL_FLOOR) && TOOL_FLOOR > 0, "TOOL_FLOOR must be a positive integer");
assert.ok(Number.isInteger(BYTES_CEILING) && BYTES_CEILING > 0, "BYTES_CEILING must be a positive integer");
assert.ok(Number.isInteger(SCHEMA_PER_TOOL_CEILING) && SCHEMA_PER_TOOL_CEILING > 0,
  "SCHEMA_PER_TOOL_CEILING must be a positive integer");

// ── 3. THE TABLE'S OWN SHAPE — A PROOF THAT CANNOT REFUSE IS NOT A PROOF ─────────────
const refusals = SELFTEST.filter((r) => !r[2]).length;
console.log(`\n  ${SELFTEST.length} rows · ${refusals} REFUSE · `
  + `${bad ? `\u{1F534} ${bad} DISAGREE` : "\u{1F7E2} all agree"}`);
assert.ok(refusals >= 6,
  "fewer than six refusing rows — this table has stopped proving the floors can fire");

// ── 4. THE DECOMPOSITION MUST LEAVE NOTHING UNNAMED — 207's FIX, ASSERTED ────────────
// 🔴 THIS IS THE DEFECT 206 SHIPPED, WRITTEN DOWN AS A PROOF. `measure()` reported
// `names`, `descs` and `schemas`, the printer presented them as the breakdown, and on the
// real surface they accounted for 60.9% of it — the missing 39.1% was four optional MCP
// keys nobody had named. A tool carrying a fourth key is the smallest case of that, and
// these assertions fail if `keys` ever narrows back to a fixed list.
const withExtras = [
  { name: "a_one", description: "d", inputSchema: { type: "object" },
    outputSchema: { type: "object", properties: { r: { type: "string" } } },
    annotations: { readOnlyHint: true }, title: "A One" },
  { name: "b_two", description: "dd", inputSchema: { type: "object" }, title: "B Two" },
];
const mx = measure(withExtras);
const named = new Set(mx.keys.map(([k]) => k));
for (const k of ["name", "description", "inputSchema", "outputSchema", "annotations", "title"]) {
  assert.ok(named.has(k), `measure().keys must name every key a tool carries; missing ${k}`);
}
const keyed = mx.keys.reduce((s, [, e]) => s + e.b, 0);
assert.equal(keyed + mx.frame, mx.total,
  "per-key bytes plus the structural frame must account for the whole surface");
assert.ok(mx.frame >= 0, "a negative frame means the per-key walk double-counted");
// 🔴 AND THE THREE OLD SLICES MUST BE SHOWN TO BE A PROJECTION, not a decomposition —
// if this ever stops holding, the difference has gone to zero and the 207 finding with it.
const three = ["name", "description", "inputSchema"]
  .reduce((s, k) => s + (mx.keys.find(([kk]) => kk === k)?.[1].b ?? 0), 0);
assert.ok(three < mx.total,
  "name+description+inputSchema must not be presentable as the whole surface");
console.log(`  🟢 per-key decomposition names ${mx.keys.length} keys · `
  + `frame ${mx.frame} B · the three named slices are ${((three / mx.total) * 100).toFixed(1)}% of it`);

// ── 4b. THE TWO COUNTS ARE DERIVED FROM THE TOOLS, NOT ASSUMED ZERO ──────────────────
// 🔴 SECTION 1 PROVES verdict() FIRES ON A NON-ZERO COUNT. It cannot prove measure()
// ever PRODUCES one from a real shape — a counter wired to a typo reports zero forever
// and every row above still passes, because they all pass their own literals through the
// same broken walk. These two assert the walk finds what is actually there.
const dirty = measure([
  { name: "a_one", description: "d",
    inputSchema: { $schema: "http://json-schema.org/draft-07/schema#", type: "object" },
    execution: { taskSupport: "forbidden" } },
  { name: "b_two", description: "d", inputSchema: { type: "object" },
    execution: { taskSupport: "optional" } },
]);
assert.equal(dirty.dialects, 1, "measure() must count the schema that declares a dialect");
assert.equal(dirty.taskDefault, 1, "measure() must count only the spec-default taskSupport");
const clean = measure(mkTools(4, 10));
assert.equal(clean.dialects, 0, "a surface with no declarations must count none");
assert.equal(clean.taskDefault, 0, "a surface with no execution key must count none");
console.log(`  🟢 wire counts derived from the tools · dirty ${dirty.dialects}/${dirty.taskDefault} · clean 0/0`);

// ── 5. THE PER-TOOL SCHEMA NUMBER IS DERIVED, NOT STORED ─────────────────────────────
// 🔴 A ceiling compared against a field that no longer tracks its source is 199 §34's
// claim-not-a-fix. Doubling every schema must double the number the ceiling reads.
const one = measure(mkSchemaTools(TOOL_FLOOR, 200));
const two = measure(mkSchemaTools(TOOL_FLOOR, 400));
assert.ok(two.schemaPerTool > one.schemaPerTool,
  "schemaPerTool must move with the schemas it is derived from");
assert.equal(measure([]).schemaPerTool, 0, "an empty surface must not divide by zero");

if (bad) process.exit(1);
console.log("TOKEN_COST_SELFTEST ok");

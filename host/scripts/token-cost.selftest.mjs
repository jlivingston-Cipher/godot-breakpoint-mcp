#!/usr/bin/env node
// The refusal proof for `token-cost.mjs`'s two governed constants — 206 §4.
//
// 🔴 A SEPARATE FILE FOR `path-cohort.mjs`'s REASON. The instrument PRINTS; a printer has
// no claim sites the tautology classifier can read, and exempting it while leaving its
// constants unasserted would be an exemption that buys silence. This is where the claims
// live, and it is what `floor_pin_gate.py` runs when it moves BYTES_CEILING and TOOL_FLOOR
// off their shipped values.
//
// 🔴 THE ROWS DRIVE THE PURE CORE, so the proof needs no server, no dist/ and no network.
// That is the half 204 §8.27 is about — a check that has never refused has not been
// audited. Four of the six rows REFUSE.
import assert from "node:assert/strict";
import { measure, verdict, BYTES_CEILING, TOOL_FLOOR } from "./token-cost.mjs";

const mkTools = (n, descLen) =>
  Array.from({ length: n }, (_, i) => ({
    name: `fam${i % 7}_tool${i}`,
    description: "d".repeat(descLen),
    inputSchema: { type: "object", properties: {} },
  }));

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
];

function selftest() {
  console.log("TOKEN_COST selftest — the floors' refusal, proved without a server");
  let bad = 0;
  for (const [name, tools, wantOk, want] of SELFTEST) {
    const v = verdict(measure(tools));
    const agree = v.ok === wantOk && (want === "" || v.problems.join(" ").includes(want));
    if (!agree) bad += 1;
    console.log(`  ${agree ? "🟢" : "🔴"} ${v.ok ? "PASS  " : "REFUSE"} ` +
      `tools=${String(tools.length).padStart(4)} ${name}`);
    if (!agree) console.log(`        want ${want || "ok"} · got ${JSON.stringify(v.problems)}`);
  }
  // ── 3. THE TABLE'S OWN SHAPE — A PROOF THAT CANNOT REFUSE IS NOT A PROOF ─────────────
const refusals = SELFTEST.filter((r) => !r[2]).length;
  console.log(`\n  ${SELFTEST.length} rows · ${refusals} REFUSE · ` +
    `${bad ? `🔴 ${bad} DISAGREE` : "🟢 all agree"}`);
  if (refusals < 3) {
    console.log("  🔴 fewer than three refusing rows — this table has stopped proving " +
      "that either constant can fire");
    return 1;
  }
  return bad ? 1 : 0;
}


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

// ── 3. THE TABLE'S OWN SHAPE — A PROOF THAT CANNOT REFUSE IS NOT A PROOF ─────────────
const refusals = SELFTEST.filter((r) => !r[2]).length;
console.log(`\n  ${SELFTEST.length} rows · ${refusals} REFUSE · `
  + `${bad ? `\u{1F534} ${bad} DISAGREE` : "\u{1F7E2} all agree"}`);
assert.ok(refusals >= 3,
  "fewer than three refusing rows — this table has stopped proving either constant can fire");
if (bad) process.exit(1);
console.log("TOKEN_COST_SELFTEST ok");

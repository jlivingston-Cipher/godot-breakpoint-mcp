#!/usr/bin/env node
// difference_field_gate.selftest.mjs — session 285.
//
// 🔴 EVERY READER IS BLINDED AND MUST REDDEN, AND THAT IS THE WHOLE POINT OF THIS FILE.
// 284 §1.3 is the warning it was written from: emptying `queue_head` to (0, "") made a
// requirement `range(233, 0)` — empty, therefore satisfied — and `instrument_gate`
// reported GREEN OVER A TREE IT HAD LEARNED NOTHING ABOUT. Blinding the reader that
// FINDS a gap reddens and proves nothing; blinding the reader that says WHAT THE
// POPULATION IS is the one that goes quiet.
//
// `SECOND_CALL_GATE_DESIGN_2026-08-27.md` §6.1 names three ways this shape goes quiet: a
// population that derives to zero, an exemption ledger that swallows the roster, and a
// witness that silently no-ops. This gate has no witness, so two of the three apply and
// both are driven below. A GREEN RUN MEANS EACH READER HAS BEEN SHOWN TO FAIL WHEN IT IS
// LIED TO, not that the shipped tree happens to pass.
//
// 🔴 AND THE ASSERTIONS ARE WRITTEN OUT RATHER THAN FUNNELLED THROUGH A `claim()` HELPER,
// WHICH THE TAUTOLOGY GATE TAUGHT THIS FILE ON ITS FIRST RUN. The helper version made 29
// claims through ONE `assert.ok` site, and the classifier read exactly what was there: a
// single site it could not attribute — one more orphan against a ceiling with two left
// (248's `orphan-ceiling-headroom`). That is 171 §2's second class — a file whose idiom
// the finder cannot read — earned inside the file that exists to keep a reader honest.
// Twenty-nine claims are twenty-nine sites now, and the sweep can see every one.
//
// Fixtures, never the live wire: a selftest that spawned the server would be testing the
// tree rather than the judgement, and would go green the day the derivation broke.
import assert from "node:assert/strict";
import { judge, REACH, POPULATION_FLOOR } from "./difference_field_gate.mjs";

// 🔴 THE MARKER IS THE FIRST LINE AND IT IS EMITTED BEFORE ANY VERDICT BRANCH — 233's
// draft-3 rule, which `instrument_gate` refused this file for not having. A marker printed
// only on success (the tally at the bottom) is absent from every red run, so "the gate
// caught the mutant" and "the mutant crashed the gate" become one observable (181 §4). This
// line survives an assertion failure and is absent from an import-time crash, which is
// exactly the discrimination the blinding harness needs.
console.log("DIFFERENCE_FIELD_SELFTEST_BEGIN 7 section(s) — every reader is blinded below");

let claims = 0;
const counted = () => { claims += 1; return true; };

// 🔴 EVERY SECTION RUNS, AND A FAILURE IS REPORTED RATHER THAN THROWN — 175's rule, which
// `instrument_gate` turned from a preference into a requirement on this file's first sweep.
// A self-test that dies at its first bad assertion reports ONE broken reader and hides the
// rest behind it, and it reports that one as a STACK TRACE: `failure_lines` counts zero, so
// the blinding harness recorded `red · 0 failure line(s)` and `BLAST_FLOOR` had nothing to
// floor — a sweep that stopped reddening anything would have read the same. `FAIL <LABEL>`
// is this tree's own self-test dialect (`A_FAIL` in instrument_gate.py), so the count is
// readable by the instrument that needs it.
const failures = [];
const fail = (label, why) => { failures.push(label); console.log(`  FAIL ${label} ${why}`); };

/** One row of the shape `readWire` returns. */
/**
 * @param {string} name
 * @param {string[]} [input]
 * @param {string[]} [output]
 * @param {string[]} [outputRequired]
 * @returns {{name: string, input: Set<string>, output: Set<string>, outputRequired: Set<string>}}
 */
const row = (name, input = [], output = [], outputRequired = []) => ({
  name, input: new Set(input), output: new Set(output), outputRequired: new Set(outputRequired),
});

/** A minimal shipped-shaped surface: N destination writers, plus the three live oddities. */
/**
 * @param {number} [n]
 * @param {{extra?: Array<{name: string, input: Set<string>, output: Set<string>, outputRequired: Set<string>}>, defaultHidden?: string[]}} [opts]
 */
function fixture(n = 26, { extra = [], defaultHidden = [] } = {}) {
  /** @type {Array<{name: string, input: Set<string>, output: Set<string>, outputRequired: Set<string>}>} */
  const full = [];
  for (let i = 0; i < n; i += 1) full.push(row(`writer_${i}`, ["overwrite", "to_path"], ["replaced", "saved"], ["saved"]));
  full.push(row("namer", ["name"], ["coerced", "requested", "path"], ["path"]));
  full.push(row("screen_set", ["tab"], ["active", "requested"], ["active", "requested"]));
  full.push(row("dir_make", ["path"], ["created", "existed"], ["created", "existed"]));
  full.push(...extra);
  const hidden = new Set(defaultHidden);
  return { full, dflt: full.filter((r) => !hidden.has(r.name)) };
}

const DECL = {
  dualSense: { requested: { screen_set: "REQUIRED: echoes the requested tab beside the MEASURED `active`" } },
  valueKind: { existed: { dir_make: "REQUIRED boolean, read by value" } },
  defaultOff: {},
};

// ── 0 · the green case, so a red fixture below is not just "everything reddens" ───────
try {
  const { full, dflt } = fixture();
  const r = judge(full, dflt, DECL);
  assert.ok(counted() && r.bad.length === 0, `GREEN_BASE: the shipped shape must pass: ${r.bad.join(" | ")}`);
  assert.ok(counted() && r.lines.some((l) => l.includes("DF_POPULATION 26")),
    "GREEN_BASE_SPOKE: the population line must carry the number it derived, or a green says nothing about what was read");
} catch (e) { fail("GREEN_BASE", e && e.message ? e.message : String(e)); }

// ── 1 · DF_POPULATION — the reader that goes QUIET rather than red ────────────────────
// 🔴 THIS IS 284 §1.3's HALF. With no floor, an empty population makes DF_SYMMETRY,
// DF_DEFAULT_REACH and DF_UNDECLARED all vacuously true — every set difference against
// the empty set is empty — and the gate prints a clean green having read nothing.
try {
  const bare = [
    row("namer", ["name"], ["coerced", "requested"]),
    row("screen_set", ["tab"], ["active", "requested"], ["active", "requested"]),
    row("dir_make", ["path"], ["created", "existed"], ["created", "existed"]),
  ];
  const r = judge(bare, [], DECL);
  assert.ok(counted() && r.bad.length > 0, "BLIND_POPULATION_EMPTY: an empty population stayed GREEN — this reader measures nothing");
  assert.ok(counted() && r.bad.some((b) => b.includes("DF_POPULATION")),
    `BLIND_POPULATION_EMPTY_NAMED: reddened somewhere other than DF_POPULATION: ${r.bad.join(" | ")}`);
} catch (e) { fail("BLIND_POPULATION_EMPTY", e && e.message ? e.message : String(e)); }
try {
  const { full, dflt } = fixture(POPULATION_FLOOR - 1);
  const r = judge(full, dflt, DECL);
  assert.ok(counted() && r.bad.length > 0, "BLIND_POPULATION_SHRUNK: a population below the floor stayed GREEN");
  assert.ok(counted() && r.bad.some((b) => b.includes("DF_POPULATION")),
    `BLIND_POPULATION_SHRUNK_NAMED: reddened somewhere other than DF_POPULATION: ${r.bad.join(" | ")}`);
} catch (e) { fail("BLIND_POPULATION_SHRUNK", e && e.message ? e.message : String(e)); }
try {
  const { full, dflt } = fixture(POPULATION_FLOOR);
  assert.ok(counted() && judge(full, dflt, DECL).bad.length === 0,
    "POPULATION_AT_FLOOR: the floor is a floor, not a ceiling — a population exactly at it must pass");
} catch (e) { fail("POPULATION_AT_FLOOR", e && e.message ? e.message : String(e)); }
try {
  const { full, dflt } = fixture(POPULATION_FLOOR + 9);
  assert.ok(counted() && judge(full, dflt, DECL).bad.length === 0,
    "POPULATION_MAY_GROW: a growing population is the tree working, and a gate that reddens on it gets edited to shut it up");
} catch (e) { fail("POPULATION_MAY_GROW", e && e.message ? e.message : String(e)); }

// ── 2 · DF_SYMMETRY — both directions, because they are different defects ─────────────
try {
  const { full } = fixture();
  full.push(row("takes_only", ["overwrite", "to_path"], ["saved"], ["saved"]));
  const r = judge(full, full, DECL);
  assert.ok(counted() && r.bad.length > 0, "BLIND_SYMMETRY_INPUT_ONLY: a tool that accepts `overwrite` and cannot say it used it stayed GREEN");
  assert.ok(counted() && r.bad.some((b) => b.includes("DF_SYMMETRY") && b.includes("takes_only")),
    `BLIND_SYMMETRY_INPUT_ONLY_NAMED: the refusal must name the tool: ${r.bad.join(" | ")}`);
} catch (e) { fail("BLIND_SYMMETRY_INPUT_ONLY", e && e.message ? e.message : String(e)); }
try {
  const { full } = fixture();
  full.push(row("says_only", ["to_path"], ["replaced", "saved"], ["saved"]));
  const r = judge(full, full, DECL);
  assert.ok(counted() && r.bad.length > 0, "BLIND_SYMMETRY_OUTPUT_ONLY: a tool declaring `replaced` with no way to ask for it stayed GREEN");
  assert.ok(counted() && r.bad.some((b) => b.includes("DF_SYMMETRY") && b.includes("says_only")),
    `BLIND_SYMMETRY_OUTPUT_ONLY_NAMED: the refusal must name the tool: ${r.bad.join(" | ")}`);
} catch (e) { fail("BLIND_SYMMETRY_OUTPUT_ONLY", e && e.message ? e.message : String(e)); }

// ── 3 · DF_DEFAULT_REACH — the gap a live gate would not drive, and the stale claim ───
try {
  const { full, dflt } = fixture(26, { defaultHidden: ["writer_3", "writer_4"] });
  const r = judge(full, dflt, DECL);
  assert.ok(counted() && r.bad.length > 0,
    "BLIND_REACH_UNDECLARED: two members of the population absent from the default wire and declared nowhere stayed GREEN");
  assert.ok(counted() && r.bad.some((b) => b.includes("DF_DEFAULT_REACH") && b.includes("writer_3")),
    `BLIND_REACH_UNDECLARED_NAMED: the refusal must name the unreachable tools: ${r.bad.join(" | ")}`);
  const declared = judge(full, dflt, { ...DECL, defaultOff: { writer_3: "declared", writer_4: "declared" } });
  assert.ok(counted() && declared.bad.length === 0, `REACH_DECLARED_PASSES: a declared gap must pass: ${declared.bad.join(" | ")}`);
} catch (e) { fail("BLIND_REACH_UNDECLARED", e && e.message ? e.message : String(e)); }
try {
  // 🔴 AN EXEMPTION THAT NO LONGER DESCRIBES THE WIRE IS THE LEDGER SWALLOWING THE ROSTER
  // — design §6.1's second way this shape goes quiet. It must cost a refusal, not sit
  // there being harmlessly true of nothing (233 §18, and check 16's both-directions rule).
  const { full, dflt } = fixture();
  const r = judge(full, dflt, { ...DECL, defaultOff: { writer_3: "declared but plainly visible" } });
  assert.ok(counted() && r.bad.length > 0, "BLIND_REACH_STALE_EXEMPTION: an exemption true of nothing stayed GREEN");
  assert.ok(counted() && r.bad.some((b) => b.includes("DF_DEFAULT_REACH") && b.includes("writer_3")),
    `BLIND_REACH_STALE_EXEMPTION_NAMED: the refusal must name the stale exemption: ${r.bad.join(" | ")}`);
} catch (e) { fail("BLIND_REACH_STALE_EXEMPTION", e && e.message ? e.message : String(e)); }

// ── 4 · DF_KIND — the finding this gate exists for ────────────────────────────────────
try {
  const { full, dflt } = fixture();
  const r = judge(full, dflt, { ...DECL, dualSense: {} });
  assert.ok(counted() && r.bad.length > 0,
    "BLIND_KIND_UNDECLARED_SPLIT: `requested` PRESENCE on one cohort and REQUIRED on another, declared nowhere, stayed GREEN");
  assert.ok(counted() && r.bad.some((b) => b.includes("DF_KIND") && b.includes("requested")),
    `BLIND_KIND_UNDECLARED_SPLIT_NAMED: the refusal must name the field: ${r.bad.join(" | ")}`);
} catch (e) { fail("BLIND_KIND_UNDECLARED_SPLIT", e && e.message ? e.message : String(e)); }
try {
  // a second tool joins the required side without joining the declaration
  const { full, dflt } = fixture();
  full.push(row("restore", ["paths"], ["restored", "requested"], ["restored", "requested"]));
  const r = judge(full, dflt, DECL);
  assert.ok(counted() && r.bad.length > 0, "BLIND_KIND_NEW_ECHO: a NEW tool echoing `requested` stayed GREEN behind an old declaration");
  assert.ok(counted() && r.bad.some((b) => b.includes("DF_KIND") && b.includes("restore")),
    `BLIND_KIND_NEW_ECHO_NAMED: the refusal must name the new echo: ${r.bad.join(" | ")}`);
} catch (e) { fail("BLIND_KIND_NEW_ECHO", e && e.message ? e.message : String(e)); }
try {
  // a declared VALUE-kind field that has quietly become optional — the reverse rot, and
  // the one a table nobody re-derives would never notice
  const { full } = fixture();
  const softened = full.map((r) => (r.name === "dir_make" ? row("dir_make", ["path"], ["created", "existed"], ["created"]) : r));
  const r = judge(softened, softened, DECL);
  assert.ok(counted() && r.bad.length > 0, "BLIND_KIND_VALUE_WENT_OPTIONAL: a declared VALUE-kind field that became optional stayed GREEN");
  assert.ok(counted() && r.bad.some((b) => b.includes("DF_KIND") && b.includes("existed")),
    `BLIND_KIND_VALUE_WENT_OPTIONAL_NAMED: the refusal must name the field: ${r.bad.join(" | ")}`);
} catch (e) { fail("BLIND_KIND_VALUE_WENT_OPTIONAL", e && e.message ? e.message : String(e)); }
try {
  // 🔴 THE READER ITSELF BLINDED: if the classifier stopped seeing a field at all, every
  // split would read as uniform and the gate would go green over the ambiguity. This is
  // the `stripCheck` case from `wire_invisible_gate.mjs` — the measurement that can only
  // fail loud is the one worth having.
  const { full } = fixture();
  const gone = full.filter((r) => r.name !== "namer" && r.name !== "screen_set");
  const r = judge(gone, gone, DECL);
  assert.ok(counted() && r.bad.length > 0, "BLIND_KIND_FIELD_VANISHED: a difference field on NO tool stayed GREEN");
  assert.ok(counted() && r.bad.some((b) => b.includes("DF_KIND") && b.includes("blind")),
    `BLIND_KIND_FIELD_VANISHED_NAMED: the refusal must say the reader has gone blind: ${r.bad.join(" | ")}`);
} catch (e) { fail("BLIND_KIND_FIELD_VANISHED", e && e.message ? e.message : String(e)); }

// ── 5 · DF_UNDECLARED — a required `replaced` is always present and signals nothing ────
try {
  const { full } = fixture();
  const mutated = full.map((r) => (r.name === "writer_0"
    ? row("writer_0", ["overwrite", "to_path"], ["replaced", "saved"], ["replaced", "saved"]) : r));
  const r = judge(mutated, mutated, DECL);
  assert.ok(counted() && r.bad.length > 0, "BLIND_UNDECLARED_REQUIRED_REPLACED: a REQUIRED `replaced` signals nothing and stayed GREEN");
  assert.ok(counted() && r.bad.some((b) => b.includes("DF_UNDECLARED") && b.includes("writer_0")),
    `BLIND_UNDECLARED_REQUIRED_REPLACED_NAMED: the refusal must name the tool: ${r.bad.join(" | ")}`);
} catch (e) { fail("BLIND_UNDECLARED_REQUIRED_REPLACED", e && e.message ? e.message : String(e)); }

// ── 6 · the declared reach is asserted, so it cannot rot into a paragraph ─────────────
try {
  assert.ok(counted() && REACH.reads.length >= 3, "REACH_READS: the gate must say what it reads");
  assert.ok(counted() && REACH.cannotSee.some((s) => /second call/i.test(s)),
    "REACH_CANNOT_SEE_SECOND_CALL: the gate MUST say out loud that it cannot see a second call — a gate silent about what it cannot see is 281 §1.2's defect");
  assert.ok(counted() && REACH.cannotSee.some((s) => /filesystem|engine/i.test(s)),
    "REACH_CANNOT_SEE_WORLD: the gate MUST say it does not observe the world, which is the half the design brief calls the witness");
} catch (e) { fail("REACH_DECLARED", e && e.message ? e.message : String(e)); }

console.log(`DIFFERENCE_FIELD_SELFTEST ${claims - failures.length}/${claims} claims, ${failures.length} failed`
  + (failures.length ? ` — ${failures.join(", ")}` : " — every reader blinded and reddened"));
if (failures.length) process.exit(1);

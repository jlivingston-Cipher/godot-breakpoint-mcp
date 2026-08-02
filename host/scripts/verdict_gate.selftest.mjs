#!/usr/bin/env node
// verdict_gate.selftest.mjs — session 175.
//
// 173's rule: an instrument with no gate is not a passing instrument. `verdict_gate.mjs`
// is what stands between the live drivers and 175's finding — three scripts that fetched
// a verdict from a `runtime_assert_*` tool, wrote it to a transcript, and exited 0
// regardless. If its scanner stopped recognising the shape, it would print "ok" over a
// directory it no longer reads, exactly as taut169 did over a suite it had never parsed.
//
// Every case drives `inspect()` / `judge()` with source text and hand-built populations
// directly: no fixture files, no engine, no compile step. Both the CATCHES and the
// DISMISSALS are pinned — a gate that reds on everything constrains nothing.
//
// 🔴 AND THE POPULATIONS THAT THE HEALTHY TREE CANNOT PRODUCE ARE THE POINT. Against the
// real host root, `judge()` returns zero offenders on every branch: no unread verdicts,
// no stale exemption, no dead exemption, no collapse. 174 §8 watched a collector that was
// only ever asserted EMPTY lose its filter invisibly. These are the parameters that make
// those branches reachable at all.
import { inspect, judge, scan, SUBJECT_FLOOR } from "./verdict_gate.mjs";

let ran = 0, bad = 0;
const claim = (cond, what) => {
  ran++;
  if (!cond) { bad++; console.log(`🔴 FAILED: ${what}`); }
};
const sub = (f, o = {}) => ({ f, tools: ["runtime_assert_node_state"], readsVerdict: true, exitsNonZero: true, labelsAssert: false, ...o });
const J = (subjects, roster = {}, floor = 1) => judge(subjects, roster, floor);
const said = (r, needle) => r.lines.some((l) => l.includes(needle));

// ── 1. THE SCANNER RECOGNISES A VERDICT-BEARING DRIVER AT ALL ────────────────────────
// The whole reason this file exists.
claim(inspect("a.mjs", `t("runtime_assert_node_state", {p: 1});`).tools.length === 1,
  "a call naming an assert tool makes the file a subject");
claim(inspect("a.mjs", `t("godot_output", {id});`).tools.length === 0,
  "a call naming a non-verdict tool does not");
claim(inspect("a.mjs", `t("runtime_assert_perf", {}); t("runtime_assert_screen_text", {});`).tools.length === 2,
  "two distinct verdict tools are two entries");
claim(inspect("a.mjs", `t("runtime_assert_perf", {}); t("runtime_assert_perf", {});`).tools.length === 1,
  "the same tool twice is one entry — tools is a set, not a call count");
claim(inspect("a.mjs", `rec("assert grew_ever==false", "runtime_assert_node_state", {}, r);`).labelsAssert === true,
  'a step LABELLED "assert…" is noticed — the exact spelling 175 found');

// ── 2. READING THE VERDICT, AND THE HALF THAT IS NOT ENOUGH ──────────────────────────
// 🔴 cs_demo_verify_live_gif.mjs IS WHY BOTH HALVES ARE REQUIRED. It read `.ok` into two
// locals, printed them, wrote them to JSON and returned them — and exited 0.
claim(inspect("a.mjs", `const a = r.ok;`).readsVerdict === true, "`.ok` property access is reading the verdict");
claim(inspect("a.mjs", `const a = r["ok"];`).readsVerdict === true, "and so is the element-access spelling");
claim(inspect("a.mjs", `const a = r.status;`).readsVerdict === false, "reading some other field is not");
claim(inspect("a.mjs", `process.exit(failures.length ? 1 : 0);`).exitsNonZero === true,
  "a COMPUTED exit status is a verdict reaching the shell");
claim(inspect("a.mjs", `process.exit(0);`).exitsNonZero === false, "a literal exit(0) is not");
// 🔴 THIS ONE IS THE GATE'S OWN BLIND SPOT, PINNED. Every one of the three broken files
// ended `main().catch((e) => { …; process.exit(1); })`. Counting a literal `exit(1)`
// would have made the gate GREEN on all three, because a crash handler is present in
// every driver in the directory, working or not.
claim(inspect("a.mjs", `main().catch((e) => { process.exit(1); });`).exitsNonZero === false,
  "🔴 a literal exit(1) in a crash handler is NOT a verdict — counting it greens all three defects");
claim(inspect("a.mjs", `if (!id) { process.exit(1); }`).exitsNonZero === false,
  "nor is a bare abort path — it fires on the run that asserted nothing");

// ── 3. THE JUDGEMENT, ON POPULATIONS THE TREE CANNOT PRODUCE ─────────────────────────
claim(J([sub("ok.mjs")]).failed === false, "a driver that reads its verdict and can exit on it passes");
claim(J([sub("bad.mjs", { readsVerdict: false })]).failed === true, "one that never reads it fails");
claim(J([sub("bad.mjs", { exitsNonZero: false })]).failed === true, "one that reads it and drops it fails");
claim(said(J([sub("b.mjs", { exitsNonZero: false })]), "READS the verdict and drops it"),
  "and the two failure modes are reported differently");
claim(said(J([sub("b.mjs", { readsVerdict: false })]), "never reads it"),
  "the never-read mode names itself");

// ── 4. THE ROSTER, BOTH DIRECTIONS ───────────────────────────────────────────────────
claim(J([sub("x.mjs", { readsVerdict: false })], { "x.mjs": "a written reason" }).failed === false,
  "a written exemption excuses a driver that cannot fail");
claim(J([sub("x.mjs")], { "x.mjs": "a written reason" }).failed === true,
  "🔴 but an exemption for a driver that DOES check is stale and reds — 174's TAUT_ROSTER_STALE");
claim(J([sub("x.mjs")], { "gone.mjs": "a written reason" }).failed === true,
  "🔴 and an exemption naming a file that is not a subject at all is DEAD — the branch that caught this gate's own first roster entry");
claim(said(J([sub("x.mjs")], { "gone.mjs": "r" }), "VERDICT_ROSTER_DEAD"), "the dead-entry line names itself");

// ── 5. SCOPE — THE GATE'S OWN POPULATION ─────────────────────────────────────────────
// 170 §4: a scan that matches nothing reports zero offenders and passes.
claim(J([], {}, 1).failed === true, "an empty subject list is a COLLAPSE, not a pass");
claim(said(J([], {}, 1), "VERDICT_SCOPE_COLLAPSE"), "and it says so");
claim(J([sub("a.mjs"), sub("b.mjs")], {}, 3).failed === true, "a population under its floor collapses");
claim(J([sub("a.mjs"), sub("b.mjs")], {}, 2).failed === false, "at the floor it does not");

// ── 6. THE REAL TREE, READ RATHER THAN ASSUMED ───────────────────────────────────────
// 🔴 A LITERAL, NOT `>= scan().length`. 172 §10.21: a floor supplied by the same finder
// it floors is `len(x) >= len(x)` wearing a disguise.
const live = scan();
claim(live.length === 4, `the host root holds exactly 4 verdict-bearing drivers (got ${live.length})`);
claim(live.every((s) => s.readsVerdict && s.exitsNonZero), "and every one of them reads its verdict and can exit on it");
claim(live.some((s) => s.f === "cs_demo_verify_live_gif.mjs"), "including the gif driver, 175's sharpest case");
claim(judge(live).failed === false, "so the gate is green on the tree it ships with");
// 🔴 THE SHIPPED FLOOR ITSELF, NAMED. 175's reverse sweep set SUBJECT_FLOOR to 0 and
// every case above stayed green — the collapse cases pass their own floor, and this one
// reads whatever the module says. A literal nothing asserts is a literal anyone can move.
claim(SUBJECT_FLOOR === 4, `the shipped subject floor is 4, not ${SUBJECT_FLOOR}`);
claim(judge(live, {}, live.length + 1).failed === true,
  "and the live population one above its own size collapses — the floor is compared, not decorative");

console.log(`\nVERDICT_SELFTEST ${ran - bad}/${ran} claims`);
if (bad) { console.log(`🔴 VERDICT_SELFTEST FAILED — ${bad} of ${ran}`); process.exit(1); }
// 🔴 29, MEASURED — AND THIS LINE WAS WRITTEN AT 30 FROM A GUESS AND CAUGHT ITSELF, the
// SECOND floor-above-the-truth in this session after VERDICT_GATE's SUBJECT_FLOOR=5.
// Both were harmless because both reddened immediately; a floor written from a guess in
// the other direction is the one that never says anything.
if (ran < 31) { console.log(`🔴 VERDICT_SELFTEST ran ${ran} claims, floor is 31 — cases were deleted or stopped running`); process.exit(1); }
console.log("VERDICT_SELFTEST ok");

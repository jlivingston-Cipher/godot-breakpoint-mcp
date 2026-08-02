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
import {
  inspect, judge, scan, SUBJECT_FLOOR,
  discarded, scanDiscarded, judgeDiscarded, combine,
  DISCARD_SITE_FLOOR, DISCARD_DIR_FLOOR, DISCARD_SKIP,
} from "./verdict_gate.mjs";

let ran = 0, bad = 0;
const claim = (cond, what) => {
  ran++;
  if (!cond) { bad++; console.log(`🔴 FAILED: ${what}`); }
};
// 🔴 NAMED AND PINNED, BECAUSE 176's REVERSE SWEEP FOUND THE BARE LITERAL UNFALSIFIABLE.
// Setting `if (ran < 31)` to `if (ran < 0)` left this whole file green — the floor was
// read by exactly one branch and asserted by nothing, so the collapse detector could be
// switched off without a single case noticing. 175's G9 (`SUBJECT_FLOOR` unpinned), one
// file over and one level up: this is the floor that protects the floors.
const CLAIM_FLOOR = 69;

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

// ── 7. 176: THE DISCARD HALF, WHOSE UNIT IS THE CALL SITE ────────────────────────────
// `inspect()` asks a per-FILE question and that is right for the host root's accumulator
// idiom. It is the wrong unit for test-integration, where a probe making fifty
// assertions passes trivially while one call site drops its reply — which is exactly
// what `inject-input.integration.mjs` did, sealing "fixture intact" over a discarded
// `runtime_assert_scene_structure`.
const drop = (src) => discarded("t.mjs", src);
const one = (src) => drop(src)[0];

claim(one(`await call("runtime_assert_x", {});`)?.dropped === true,
  "a bare `await call(verdictTool, …)` statement is a DISCARDED reply — 176's defect shape");
claim(one(`void (await call("runtime_assert_x", {}));`)?.dropped === true,
  "🔴 and so is `void` — the one operator whose whole meaning is 'discard this', so stopping the climb there would miss the MOST explicit discard");
claim(one(`const r = await call("runtime_assert_x", {});`)?.dropped === false,
  "a bound reply is kept — whether it is then read is inspect()'s question, not this one");
claim(one(`assert.equal((await call("runtime_assert_x", {})).ok, true);`)?.dropped === false,
  "a reply passed straight into an assertion is kept");
claim(one(`const f = () => call("runtime_assert_x", {});`)?.dropped === false,
  "a reply returned from an arrow is kept — it becomes the caller's problem, which is a caller's");
claim(one(`call("runtime_assert_x", {}).then((r) => r.ok);`)?.dropped === false,
  "and a reply consumed by .then() is kept");
claim(drop(`await call("runtime_set_property", { confirm: true });`).length === 0,
  "a non-verdict tool discarded is not a site at all — most tools are called for effect");

// 🔴 THE DIVERGENCE FROM inspect(), PINNED RATHER THAN LEFT TO BE REDISCOVERED. inspect()
// scans EVERY argument because it asks "does this file mention a verdict tool"; discarded()
// reads argument 0 ONLY because it asks "where is the tool INVOKED". The repo's invocation
// convention is `fn(toolName, args)`, so a recorder like
// `rec("assert …", "runtime_assert_x", {}, S(await t("runtime_assert_x", …)))` must NOT be
// counted as a second call site — the real one is the inner `t(…)`, and counting the outer
// would be 175 §3's fabricated population in a new spelling.
claim(inspect("t.mjs", `rec("assert grew", "runtime_assert_x", {}, r);`).tools.length === 1,
  "inspect() finds a verdict tool named in a LATER argument — the recorder idiom");
claim(drop(`rec("assert grew", "runtime_assert_x", {}, r);`).length === 0,
  "🔴 but discarded() does not call that a call site — the recorder is not the invocation, and counting it would fabricate a population");
claim(drop(`await t("runtime_assert_x", {}); await t("runtime_assert_y", {});`).length === 2,
  "two invocations are two sites — this is a call-site list, not a tool set");
claim(one(`\nawait call("runtime_assert_x", {});`)?.line === 2,
  "the reported line is 1-based and real — a defect nobody can locate is a defect nobody fixes");

// ── 8. THE DISCARD JUDGEMENT, ON POPULATIONS THE TREE CANNOT PRODUCE ─────────────────
const site = (o = {}) => ({ file: "a.mjs", line: 1, tool: "runtime_assert_x", dropped: false, ...o });
const many = (n, o = {}) => Array.from({ length: n }, (_, i) => site({ line: i + 1, ...o }));
const D = (sites, floor = 1, dirFloor = 1) => judgeDiscarded(sites, floor, dirFloor);

claim(D([site()]).failed === false, "a kept reply passes");
claim(D([site({ dropped: true })]).failed === true, "a dropped reply fails");
claim(D([site({ dropped: true })]).lines.some((l) => l.includes("VERDICT_DISCARDED")),
  "and the offender line names itself");
claim(D([], 1).failed === true, "an empty site list is a COLLAPSE, not a clean tree");
claim(D([site()], 2).failed === true, "a population under its site floor collapses");
claim(D([site()], 2).lines.some((l) => l.includes("VERDICT_DISCARD_SCOPE_COLLAPSE")), "and says so");

// 🔴 THE DIRECTORY FLOOR IS NOT THE SITE FLOOR, AND THIS PAIR IS WHY IT EXISTS. A walk
// that stopped descending still finds the host root's thirteen sites; with a site floor
// alone that is a green run over a SUBSET, and a subset that passes is indistinguishable
// from a clean tree. 175 §4: readdirSync is not recursive.
claim(D(many(60, { file: "a.mjs" }), 55, 1).failed === false,
  "sixty sites in one directory clear a site floor of 55");
claim(D(many(60, { file: "a.mjs" }), 55, 2).failed === true,
  "🔴 and the SAME population fails the directory floor — a deep walk that went shallow");
claim(D(many(60, { file: "a.mjs" }), 55, 2).lines.some((l) => l.includes("VERDICT_DISCARD_DIRS_COLLAPSE")),
  "the directory collapse names itself separately from the site collapse");
claim(D([site({ file: "a.mjs" }), site({ file: "sub/b.mjs" })], 1, 2).failed === false,
  "two directories satisfy it, and a bare filename counts as the root");

// 🔴 EVERY EXCLUSION COSTS PROSE. 174 §5 found a `_` filename prefix buying a silent
// exemption for 127 claim sites; the corollary is that a skip roster whose values may be
// empty is a roster whose next entry will be.
claim(Object.values(DISCARD_SKIP).every((why) => typeof why === "string" && why.length > 12),
  "every skipped directory carries a written reason a reviewer has to disagree with");

// ── 9. THE REAL TREE, READ RATHER THAN ASSUMED ───────────────────────────────────────
const liveSites = scanDiscarded();
claim(liveSites.length === 61, `the tree holds exactly 61 verdict call sites (got ${liveSites.length})`);
claim(liveSites.filter((s) => s.dropped).length === 0,
  "and not one of them discards its reply — 176 fixed the only one");
const liveDirs = new Set(liveSites.map((s) => (s.file.includes("/") ? s.file.slice(0, s.file.lastIndexOf("/")) : ".")));
claim(liveDirs.size === 2, `the walk reaches exactly 2 directories (got ${[...liveDirs].join(", ")})`);
claim(liveDirs.has("test-integration"),
  "🔴 including test-integration — the directory 175 shipped this gate unable to enter");
claim(liveSites.some((s) => s.file === "test-integration/inject-input.integration.mjs"),
  "and the file 176's defect was in is inside the population, not merely adjacent to it");
claim(judgeDiscarded(liveSites).failed === false, "so the discard gate is green on the tree it ships with");
// 🔴 THE SHIPPED FLOORS THEMSELVES, NAMED. 175's reverse sweep found SUBJECT_FLOOR
// unpinned: setting it to 0 left every case green because the collapse cases pass their
// own floor and the live case reads whatever the module says.
claim(DISCARD_SITE_FLOOR === 55, `the shipped site floor is 55, not ${DISCARD_SITE_FLOOR}`);
claim(DISCARD_DIR_FLOOR === 2, `the shipped directory floor is 2, not ${DISCARD_DIR_FLOOR}`);
claim(judgeDiscarded(liveSites, liveSites.length + 1).failed === true,
  "and the live population one above its own size collapses — the floor is compared, not decorative");
claim(judgeDiscarded(liveSites, DISCARD_SITE_FLOOR, liveDirs.size + 1).failed === true,
  "as does one directory above the number the walk actually reached");

// ── 10. THE WIRING, WHICH THE SHIPPED TREE CANNOT FALSIFY ────────────────────────────
// 🔴 176's REVERSE SWEEP CAUGHT THIS INLINED IN main(). With nothing dropped on the real
// tree, `d.failed` is always false, so `r.failed || d.failed` could lose its second term
// and every gate stayed green. Two conditions never satisfied apart in the live
// population — 173's G3, 174's H5, 175's G3, and now this.
const V = (failed, lines = []) => ({ failed, lines });
claim(combine(V(false), V(false)).failed === false, "two clean halves are a clean run");
claim(combine(V(true), V(false)).failed === true, "the subject half alone can fail the run");
claim(combine(V(false), V(true)).failed === true,
  "🔴 and so can the DISCARD half alone — the term the sweep could delete invisibly");
claim(combine(V(true), V(true)).failed === true, "both failing is still one failure");
claim(combine(V(false, ["a"]), V(false, ["b"])).lines.join() === "a,b",
  "and both halves' lines are printed, in order — a half that runs silently is a half nobody reads");
claim(CLAIM_FLOOR === 69, `the shipped claim floor is 69, not ${CLAIM_FLOOR}`);

console.log(`\nVERDICT_SELFTEST ${ran - bad}/${ran} claims`);
if (bad) { console.log(`🔴 VERDICT_SELFTEST FAILED — ${bad} of ${ran}`); process.exit(1); }
// 🔴 29, MEASURED — AND THIS LINE WAS WRITTEN AT 30 FROM A GUESS AND CAUGHT ITSELF, the
// SECOND floor-above-the-truth in this session after VERDICT_GATE's SUBJECT_FLOOR=5.
// Both were harmless because both reddened immediately; a floor written from a guess in
// the other direction is the one that never says anything.
if (ran < CLAIM_FLOOR) { console.log(`🔴 VERDICT_SELFTEST ran ${ran} claims, floor is ${CLAIM_FLOOR} — cases were deleted or stopped running`); process.exit(1); }
console.log("VERDICT_SELFTEST ok");

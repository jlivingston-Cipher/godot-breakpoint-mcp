#!/usr/bin/env node
// tautology_gate.mjs — session 171.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// WHAT THIS DEFENDS, AND WHY IT EXISTS AT ALL
//
// 168 §4 named the class: an assertion whose condition is TRUE OF EVERY REPLY THE TOOL
// CAN PRODUCE. 169 built `taut169.mjs` to enumerate it mechanically and swept the probe
// suite. It also reported ZERO candidates against the 47-file host UNIT suite, and 170
// §10 item 2 handed that number over unresolved: "either good news or the classifier not
// understanding node:test assertions. Nobody has checked which."
//
// 🔴 IT WAS THE CLASSIFIER, AND TOTALLY. taut169's claim finder requires the callee to be
// a BARE IDENTIFIER (`pass(…)`, `check(…)`, the probe idiom). Every host unit assertion
// is `assert.equal(…)` — a PropertyAccessExpression. It found zero CLAIM SITES, not zero
// candidates: its 324 were 100% from `test-integration`, and 2175 unit assertions plus
// 422 bare `node:assert` calls inside the probes themselves were never examined.
//
// 🔴 AND ITS OWN SCOPE LINE COULD NOT SEE THAT. `TAUT169_SCOPE claim_sites=324 across 68
// files` aggregated both directories, so a total collapse in one hid behind a healthy
// number from the other. 168 §6 built that line to catch exactly this failure. It is
// 170 §4's VACUOUS one level up — a reassuring sentence that survives the deletion of
// everything beneath it — which is why SCOPE HERE IS PER DIRECTORY, WITH A LITERAL
// FLOOR, and a collapse is a hard failure rather than a quiet zero.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// THE UNIT OF JUDGEMENT IS THE TEST BLOCK, NOT THE ASSERTION
//
// `assert.ok(!r.isError)` is shape-only by 168 §4's definition and there are forty of
// them — each a PRECONDITION guarding real value assertions below it. Failing those is
// 170 §4's "a gate that cries wolf on green is a gate that gets deleted". What is
// actually wrong is a test() block in which EVERY assertion is shape-only: a case that
// passes whatever the code answers. That is 170's VACUOUS gate ported from probe
// families to test cases — the symmetry 170 §10.2 itself pointed at.
//
// THE THREE THINGS THAT FAIL THIS GATE
//   VACUOUS   a test block whose every assertion is satisfied by a wrong answer of the
//             right type                                    (recipes.test.ts, 171 D3)
//   EVERY     `.every(pred)` with no length floor — true of the empty collection
//   OFFENDER  `deepEqual(offenders, [])` where nothing in the FILE floors the
//             population that was filtered  (dbg_scene_guard.test.ts's REFUSED, 171 D1)
//   SCOPE     any directory whose claim-site count falls under its literal floor
//
// Every judgement below is checked by `tautology_gate.selftest.mjs`, which runs in the
// same required `ci` job — 169 §2 and 170 §5's rule: check the instrument before
// believing it. It is not a `node:test` file on purpose: `.ts` under `host/test` would
// move the 681 and drag `contract_check.py` check 11c in, for a file that needs no
// compile step and belongs beside the thing it checks (170 §5, carried).
import ts from "../node_modules/typescript/lib/typescript.js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname — the repo lives under "Godot MCP" and .pathname keeps
// the %20. A path wrong only when it contains a space works here and dies in CI.
const ROOT = fileURLToPath(new URL("../", import.meta.url));

// 🔴 FLOORS ARE >=, NOT EXACT, AND THAT IS DELIBERATE. 170 set its runtime probe floors
// EXACT because those populations are fixed and identical in four environments. This
// population is a unit suite that is SUPPOSED to grow; an exact floor would go red on
// every legitimate test added, and a gate that goes red on good work gets deleted. What
// must never happen is a COLLAPSE, so the floor is a collapse detector.
// 🔴 174 RAISED test-integration 700 -> 850. Admitting the three `_*.selftest.mjs`
// gates moved this population 794 -> 923 in one commit, and a floor left at 700 would
// have let all 127 of the newly-swept sites disappear again without a word. A floor
// that does not move when its population does is a floor measuring the old population.
//
// 🔴 175 ADDED `scripts` AND THE HOST ROOT, AND THE ROSTER WAS THE THIRD VARIANT OF
// 174 §5's FINDING. 174 excluded by FILENAME PREFIX. This excluded by DIRECTORY ROSTER —
// and, measured this session, by a fourth mechanism nobody had named: `readdirSync` is
// NOT RECURSIVE, so `test/helpers/` was unswept even though `test` is rostered. Three
// spellings of one mistake: an exclusion that costs nothing to write.
//
//   scripts    96 sites — `tautology_gate.selftest.mjs` (67) is THIS GATE'S OWN GATE,
//              never once classified by it, and `verdict_gate.selftest.mjs` (29) is new.
//   .          11 sites — the live drivers. Admitted only AFTER `collectFailers`, which
//              removed seventeen sites this gate had INVENTED here (see CHECK_FNS).
//   test/helpers  DELIBERATELY NOT ROSTERED, and pinned: `recording-server.ts` and
//              `tcp.ts` are fixtures — a recording MCP server and a socket harness. They
//              make no claims and are not suites. 174's D5 corollary is why this is
//              written down AND asserted rather than left as a quiet omission: see
//              `tautology_gate.selftest.mjs`'s HELPERS_NOT_ROSTERED case, which fails if
//              either file ever grows a claim site.
export const FLOORS = { test: 2100, "test-integration": 850, scripts: 90, ".": 10 };
// 🆕 183 — AND A FLOOR ON THE FILE COUNT, WHICH IS THE HALF `FLOORS` CANNOT COVER.
// `FLOORS` counts claim SITES, so a filter that quietly stopped reading five files is
// invisible to it as long as the sites those files held stay under the headroom of the
// ones that remain — which is 182 §8's finding about `CHECKS_RUN` (a roster needs to be a
// roster AND a floor) in the directory walk instead of in the check list. 183 removed a
// filename-prefix filter that had been excluding five files silently since 174; this is
// what would have said so. Measured 47 / 30 / 8 / 12. `>=`, and a directory that
// legitimately loses a file lowers the literal ON PURPOSE.
export const FILE_FLOORS = { test: 45, "test-integration": 28, scripts: 8, ".": 12 };

// 🔴 AND EVERY ONE OF THEM PINS AN INPUT. Session 180, answering 179 §11.2 — which asked
// the question of five instruments and got one yes. `FLOORS` counts claim sites the
// FINDER FOUND. Between that and the verdict sits ATTRIBUTION: `verdict()` keys each
// claim to its marker or its `test()` block and drops the rest on the floor —
//
//     const k = c.marker ? … : c.owner ? … : null;
//     if (!k) continue;                        // silent, and 472 of 3465 already take it
//
// — and `vacuous`, the class this gate was built for, is scored over the BLOCKS that
// survive. So the resolution step had nothing under it. MEASURED, NOT REASONED
// (`_to_delete/measure180c.mjs`): forcing that `continue` to fire for every claim leaves
// all four directory floors at their shipped values and prints
//
//     TAUT_CLAIM_SITES 3465 across 0 unit(s) — 472 attributed to neither …
//     TAUT_GATE ok — 3465 claim sites, 0 blocks, none vacuous
//
// and exits 0. That is 179 §8's shape exactly, one instrument over: "3465 claim sites,
// none vacuous" is literally true of zero blocks, in the same way 169 §4's
// `…_ALL ok every claim held` was literally true of the empty set.
//
// TWO floors, because they are two different collapses and a single number hides one
// behind the other (171 §10.22): a gate that keeps every unit but one claim each still
// scores `vacuous` over a population that quietly shrank.
export const UNIT_FLOOR = 1200;         // measured 1408 units (blocks `vacuous` is scored over)
export const ATTRIBUTED_FLOOR = 2500;   // measured 2993 of 3465 claim sites reaching a unit
// 🔴 182 — AND THE TWO THAT PIN THE CLASSIFIER RATHER THAN THE FINDER. Every floor above
// counts claim SITES; a classifier that stops classifying leaves all of them untouched.
// Measured with a LATE blind: `classifyLeaf` honest for one call and constant for the
// other 1604 printed byte-identical output, and so did `leaves` over 1216.
export const SHAPED_FLOOR = 80;         // measured 116 claims whose leaves are EVERY one SHAPE
export const PRECONDITION_FLOOR = 40;   // measured 61 whose leaves are every one an outcome flag

// 🔴 191 — AND THE OTHER SIDE OF THE SAME SUBTRACTION, WHICH HAS BEEN PRINTED AND
// UNGOVERNED FOR NINE SESSIONS. `orphan = sites - attributed` has been in this gate's
// output since 170 and floored by nothing since; 180 §11.4 named it, and 181, 182, 183,
// 186, 188, 189 and 190 all carried the same complaint forward without acting on it. It
// read 472 when 180 wrote it down, 503 in 189, 507 in 190, and 508 today.
//
// 🔴 A NUMBER FLOORED FROM ONE SIDE ONLY IS A NUMBER NOBODY CAN ACT ON. `ATTRIBUTED_FLOOR`
// pins how many claims REACH a unit, which bounds the orphans from above only if `sites`
// is also pinned — and `sites` is free to grow, so every session's new claims could land
// in the orphan pile and every floor in this file would stay green. That is precisely what
// has been happening: the count has risen in six of the last nine sessions and no run has
// ever gone red over it.
//
// 🔴 A CEILING, BECAUSE THE MOVE IS NOW WORKED THREE TIMES IN TWO FILES. 189 §5 turned a
// count into `SILENT_REGIONS_CEILING`, 190 §4 did it again with `ALIAS_BLIND_CEILING`, and
// 191 took that second one to zero. The shape is the same each time and the argument is
// the same: a ceiling sits ON the live value, so it re-earns itself every run, and a rise
// is a thing somebody has to look at and either fix or raise DELIBERATELY with the reading
// written down. That is the opposite of a floor with slack, which is satisfied by drift.
//
// 🔴 AND IT IS PINNED EXACTLY, NOT WITH HEADROOM. Headroom here would be a licence to add
// orphans up to the headroom without anyone reading one, which is the state this replaces.
// Raising it is cheap and honest; drifting past it silently is what stops.
//
// 🔴 ITS FIRST ACT WAS TO CATCH ITS OWN AUTHOR, AND THAT IS THE READING. Pinned at 508 from
// the tree as it stood, the very next run went red at 509 — because this gate scans
// `scripts/` as well as the test directories, so writing the self-test cases for THIS RULE
// added a claim site that reaches no unit. The ceiling was raised to 509 for that reason and
// no other. It is the shortest possible demonstration of what the rule is for: a number that
// had drifted 472 → 508 across nine sessions without a single red run could not drift one
// further without somebody writing down why.
// 🔴 193 — AND THE CEILING CAME DOWN, BECAUSE SOMEBODY FINALLY READ UNDER IT. 191 pinned
// it, 192 carried it forward saying "not one of them has been read", and reading them
// answered the binary question BOTH ways: 77 legitimate banner claims and 432 in eleven
// `*.integration.mjs` files that reach no unit AT ALL. The second half was not a licence
// being used up — it was the live-engine integration suite going unscored for tautology,
// because `vacuous` is scored over the units that survive attribution and an orphan
// survives nothing. Teaching `enclosingTest` the section-banner idiom those files already
// write attributed 362 of them; the 147 that remain are the legitimate class plus the five
// script-shaped files that carry no banners either.
//
// 🔴 THE CEILING IS WHAT CATCHES THE FALLBACK DYING. Units and claims BOTH rose (1408 →
// 1680, 3212 → 3574) and both floors have enough headroom that breaking the banner path
// would leave them green — `UNIT_FLOOR` is 1200 and `ATTRIBUTED_FLOOR` is 2500. Only this
// number moves the other way: kill the fallback and the orphans go straight back to 509,
// which is 362 over. It is pinned EXACTLY for the same reason it was pinned exactly in
// 191 — headroom here is a licence to add orphans nobody reads.
//
// 🔴 AND IT CAUGHT ITS OWN AUTHOR A SECOND TIME, WHICH IS THE SAME READING TWICE. 191 §5
// pinned this at 508 and the very next run went red at 509, because writing the self-test
// cases for the rule added a claim site in `scripts/` that reaches no unit. Pinning it at
// 147 this session did it again: the nine cases written for BANNER_ATTRIBUTED_FLOOR took
// sites 3721 → 3730 and attribution 3574 → 3582, and the ninth reaches nothing. 148 for
// that reason and no other. A rule whose own arrival it can measure is a rule that works.
// 🔴 194 — AND DOWN AGAIN, 148 → 45, AND IT CAUGHT ITS OWN AUTHOR FOR THE THIRD SESSION
// RUNNING. 193 read under the ceiling and taught the reader the section BANNER. Reading
// under what was left found the reader was missing two more section idioms — one of them
// the `population.open()`/`seal()` calls the RUNTIME already attributes by — and closing
// those took 148 → 41 with no test file edited. The fifteen self-test cases written for
// the new rules then took sites 3730 → 3745 and four of them reach no unit, so 45 for that
// reason and no other. 191 pinned 508 and went red at 509; 193 pinned 147 and went red at
// 148; this is the same mechanism a third time, and a rule whose own arrival it can
// measure is a rule that works.
export const ORPHAN_CEILING = 46;       // measured 3746 sites - 3700 attributed, 2026-08-04
                                        //   (41 + 5: this session's self-test, as in 191/193)
                                        //   🔴 THE LIVE VALUE IS 42 SINCE 248, NOT 46, and
                                        //   this is deliberately NOT lowered here: the
                                        //   self-test pins the digit absolutely in ten
                                        //   places (184 §7 — pinning the key is not
                                        //   pinning the value), and a release commit is
                                        //   the wrong place to move ten pins. The four
                                        //   sessions of headroom are the licence this
                                        //   file says it will not issue, so the row that
                                        //   spends it is `orphan-ceiling-headroom` (248).

// 🔴 AND THE POSITIVE SIDE OF THE SAME FACT, BECAUSE A SUBTRACTION IS NOT A POPULATION.
// The ceiling above says "few claims are orphans"; it does not say the banner path RAN.
// Both would be satisfied by an `enclosingTest` that stopped reading banners on a tree
// where somebody had meanwhile added `test()` blocks. 172's rule — one number per
// population — asks for the banner-attributed claims to be counted as themselves.
// 🔴 194 — AND THIS FLOOR CAME DOWN 300 → 15, WHICH IS NOT A RETREAT. The section path
// below is tried FIRST, because `population.seal()` is what `_population.mjs` counts by at
// runtime and a comment above the same claim is decoration. Ten of the eleven files this
// floor was measured on carry BOTH, so 341 of its 362 moved to the path that is actually
// right about them and the honest remainder is 21. A floor left at 300 over a population
// of 21 is not governance, it is a red gate — and re-pinning it low is the same act as
// pinning it high was: put the number where the measurement is.
export const BANNER_ATTRIBUTED_FLOOR = 15;    // measured 21, 2026-08-04 (was 300 of 362)

// 🔴 194 — AND THE SECOND FALLBACK, WHICH IS THE SAME ARGUMENT WITH ONE NEW EDGE. The
// banner floor exists because the ceiling is a subtraction. There are now TWO paths under
// that one subtraction, so the ceiling is even less able to say which of them ran: kill
// the section path and the banner path's own growth could cover the loss. One number per
// population, 172 §10.22 — and this population is the one the RUNTIME already counts by,
// so a collapse here means the static scorer and the live probe have started disagreeing.
export const SECTION_ATTRIBUTED_FLOOR = 380;  // measured 448, 2026-08-04

// 🆕 275 — THE DURATION POPULATION'S OWN FLOOR, and it is the same argument as the two
// above rather than a new one: the offence this rule reports is zero on a healthy tree,
// so the only number that can say the reader RAN is the number of sites it recognised.
// Measured on this tree: four elapsed comparisons in `test/` — two lower bounds, both
// carrying `TIMER_SLACK_MS` since 273, and two upper bounds.
export const DURATION_FLOOR = 4;              // measured 4 sites, 2026-08-20

// 🔴 EVERY FILE IS A POPULATION (172). 171 §10.22 wrote the rule after watching a total
// collapse in one directory hide behind a healthy number from the other: "any scope
// assertion over more than one population needs one number per population." A DIRECTORY
// is not the smallest population it aggregates — a FILE is. Measured before this line
// existed: `TAUT_SCOPE test-integration files=21 claim_sites=422 floor=400 ok` was
// printed while NINE of those twenty-one files contributed ZERO, including the largest
// probe in the tree. The floor could not see it for exactly the reason 171's could not
// see the unit suite. A file at zero is now a hard failure unless it is on this roster,
// with the reason it has nothing to count.
// 🔴 EXEMPT WITH A STATED REASON, THE WAY EVERY OTHER ROSTER IN THIS REPO IS
// (SHAPE_COVERAGE_EXEMPT, BRIDGE_SCAN_EXEMPT, FAMILY_COUNT_EXEMPT). A file that is
// SUPPOSED to have no claims is a decision somebody made; a file that has stopped
// having them is a defect. The only difference between the two is whether the reason
// is written down, which is what this roster is for. Each quotes the file's own header.
export const NO_CLAIMS_EXPECTED = {
  "csharp-lsp.integration.mjs": "documented LOG-ONLY diagnostic — its only gate is reachability (170, measured)",
  "csharp-dap.integration.mjs": "documented LOG-ONLY diagnostic — its only gate is reachability (170, measured)",
  "editor-lsp.integration.mjs": 'best-effort probe bank, its own header: "probe failures are never fatal — only an unreachable language server fails the job"',
  "editor-subscriptions.integration.mjs": 'event-push probe, its own header: "The reachability check is the gate (exit 1 if the addon is unreachable)"',

  // ── the four helper MODULES, admitted 183 with the prefix filter ───────────────────
  // 🔴 THESE WERE EXEMPT BY FILENAME UNTIL 183 AND THE EXEMPTION WAS INVISIBLE. Each is a
  // library the probes import, not a suite; each has its claims in the `.selftest.mjs`
  // beside it, which has been swept since 174. Writing the reason down is the whole
  // change — the four files are read by the classifier now and are silent ON PURPOSE,
  // which is a different fact from being unreadable, and the gate can tell them apart.
  "_population.mjs": 'the claim counter itself — its own header: "Dependency-free… same as _png.mjs and _workspace.mjs". Its claims are in _population.selftest.mjs (321 lines)',
  "_workspace.mjs": "the snapshot/restore/diff library AUTH_CLEAN is derived from; it asserts nothing itself, and its claims are in _workspace.selftest.mjs (58 of them)",
  "_png.mjs": 'the PNG reader — its own header: "Deliberately NOT a general PNG library… returns null for anything else, so a caller can degrade rather than throw". Its claims are in _png.selftest.mjs',
  "_path_ledger.mjs": "the live-vs-ledger comparison; a parser and a differ, asserting nothing. Its claims are in _path_ledger.selftest.mjs (39 of them)",

  // ── host/scripts, admitted 175 ─────────────────────────────────────────────────────
  // The gates themselves. A gate is a classifier, not a suite; its claims live in the
  // `.selftest.mjs` beside it, which IS classified (67 and 29 sites).
  "tautology_gate.mjs": "the classifier itself — its claims are in tautology_gate.selftest.mjs, now swept (175)",
  "verdict_gate.mjs": "the verdict classifier itself — its claims are in verdict_gate.selftest.mjs (175)",
  "boundary_gate.mjs": "the cross-boundary classifier — it reads GDScript constants and JS comparisons and asserts nothing itself; its 49 claims are in boundary_gate.selftest.mjs (177)",
  "seal_order_gate.mjs": "the seal-order classifier — it reads probe sources for markers written above their own claims and asserts nothing itself; its 62 claims are in seal_order_gate.selftest.mjs (185)",
  // 🆕 219 — the same shape as the four gates above and admitted for the same written
  // reason, not by a filename rule. `positive_control_gate.mjs` reads every emptiness
  // claim in the tree and decides whether its unit defends it; it asserts nothing itself,
  // and its 43 claims — including the four defects found while promoting it out of scratch
  // — are in positive_control_gate.selftest.mjs beside it, which IS classified.
  "positive_control_gate.mjs": "the positive-control classifier — it reads assertion units and asserts nothing itself; its 43 claims are in positive_control_gate.selftest.mjs (219)",
  "path-cohort.mjs": "a reporting tool that PRINTS the cohort; the ledger comparison it feeds is asserted in _path_ledger.selftest.mjs",
  "token-cost.mjs": "a reporting tool that PRINTS the tool-surface cost; its two governed constants are asserted in token-cost.selftest.mjs",

  // 🆕 241 — THE TWO P0 REPORTERS, admitted for `token-cost.mjs`'s written reason and not
  // by any filename rule. Both PRINT an inventory the code review consumes; neither
  // decides anything, which is the point — `docs/CODE_REVIEW_P0_INVENTORY.md` §6 records
  // that a cluster is a CANDIDATE, not a verdict. 🔴 AND THE SELFTESTS ARE NOT A
  // FORMALITY: `p0_testdup.selftest.mjs` found a live defect in its own subject on the
  // run that introduced it — the clusterer was reading `assert.equal(…)` as subject
  // `equal`, so the key count this document published was wrong until the fixture said so.
  "p0_complexity.mjs": "the complexity reporter — it PRINTS cyclomatic/cognitive/nesting per function and asserts nothing itself; its 12 claims are in p0_complexity.selftest.mjs (241)",
  "p0_testdup.mjs": "the test-duplication clusterer — it PRINTS (subject | oracle | shape) clusters as CANDIDATES and asserts nothing itself; its 14 claims, including a negative control on the `async` subject defect, are in p0_testdup.selftest.mjs (241)",
  // 🔴 209 — AND THIS ONE'S REASON HAS A CAVEAT THE OTHERS DO NOT, so it is written here
  // rather than borrowed from the line above. `wire_diff.mjs` is not purely a printer: it
  // REFUSES, throwing on a collapsed population. That refusal is a `throw`, not an
  // `assert`, because it must reach a caller that catches it and prints the unreachable
  // banner — so the classifier cannot read it, and calling this file "asserting nothing"
  // would be false. It asserts one thing, in an idiom this gate does not grade, and the
  // nineteen rows that grade it are in wire_diff.selftest.mjs.
  "wire_diff.mjs": "the release wire classifier — it PRINTS a MINOR/PATCH/MAJOR verdict and REFUSES on a collapsed surface via `throw`, an idiom this gate does not read; its 19 rows and its SURFACE_FLOOR are asserted in wire_diff.selftest.mjs",
  // 🆕 231 — AND THIS ONE'S REASON IS THE ONE ABOVE WITH THE THROW TAKEN OUT.
  // `wire_invisible_gate.mjs` REPORTS: it walks the zod, measures each refinement against
  // the emitter, prints a roster and returns an exit code. Its refusals are `audit`'s
  // return value rather than a condition this classifier can grade, and the 27 claims that
  // grade them — including the one where a site is added and another deleted at an
  // unchanged count — are in wire_invisible_gate.selftest.mjs, which IS classified.
  "wire_invisible_gate.mjs": "the wire-invisible refinement roster — it walks the zod declarations, measures each class against the emitter and PRINTS which the wire drops, returning an exit code rather than asserting; its 27 claims and its two floors are asserted in wire_invisible_gate.selftest.mjs",
  "stage-addon.mjs": "a packaging step — copies the addon into the tarball. Its correctness is asserted by the packaging job, not by a claim here",

  // ── the host root, admitted 175 ────────────────────────────────────────────────────
  // 🔴 THESE ARE THE FILES 175 WAS ABOUT, SO THE REASONS ARE THE FINDING. Four of them
  // drive a `runtime_assert_*` tool and are gated by `verdict_gate.mjs` — which is a
  // DIFFERENT gate on purpose (174 §3): the tautology gate grades conditions, and these
  // files' defect was that there was no condition, only a fetched verdict nobody read.
  // The rest genuinely assert nothing, and each says which kind of nothing.
  "cs_demo_verify_live_gif.mjs": "drives both passes and pins all four verdicts through a local `pin()`; VERDICT_GATE is its gate (175 — it printed its conclusion as a string literal)",
  "verify_family_s102_live.mjs": "accumulates verdicts into a `summary` map and exits on it; VERDICT_GATE is its gate — the honest shape the other three were made to match",
  "cs_demo_verify_replay.mjs": "renders a captured transcript for a GIF and re-runs nothing; its ✓/✗ are READ from cs_demo_verify_{buggy,fixed}.json, which the live drivers write and VERDICT_GATE pins at the source",
  "demo_debugger_live.mjs": "a scripted debugger walkthrough for a recording — it steps and prints; nothing here is a verdict",
  "cs_demo_debugger_live.mjs": "the C# mirror of demo_debugger_live.mjs, same reason",
  "dap_scenario.mjs": "a single-session DAP driver for manual gate work; it exercises a sequence and prints replies",
  "runtime_scenario.mjs": "a single-session runtime-bridge driver, same reason as dap_scenario.mjs",
  "drive.mjs": "the minimal stdio client — `drive.mjs call <tool>`; a CLI, and its two throws are argument validation, not claims",
  "sweep_editor.mjs": "a coverage SWEEP: it calls every editor tool and tabulates OK / SCHEMA-MISMATCH / THREW for a human. 🔴 Its local `check(name, args)` is the tool invoker whose fifteen invented claim sites collectFailers removed (175) — it is named like an assertion and is not one",
};

const SHAPE_TYPEOF = new Set(["boolean", "number", "string", "object", "function", "undefined", "bigint", "symbol"]);
// 🔴 `.includes(x)` AND `.some(p)` FLOOR A COLLECTION AS SURELY AS `.length > 0` DOES —
// a collection that contains something is not empty. Added in 172 after the extended
// finder reported `AUTH_SCENE_DEPENDENCIES` and `AUTH_NESTED_PATH_LEGAL`, both of which
// floor themselves this way, as unfloored `.every()`s. Same lesson as 171 §3's inline
// floor: the best version of the fix must not be what the gate reports.
// 🆕 219 — EXPORTED, because `positive_control_gate.mjs` needs the same question
// asked the same way. It had a byte-identical copy for one commit; two literals over one
// population is one of them wrong (203 §2), and the copy would have been the wrong one
// the first time this pattern learned a new self-flooring idiom.
export const FLOOR_RE = /\.length|\.size|\bcount\b|\.byteLength|\.includes\s*\(|\.some\s*\(/;
const DERIVING = /\.(filter|map|flatMap|flat|reduce|concat|entries|keys|values|from)\s*\(|\bObject\.(keys|values|entries)\b/;

// ── 🆕 275 — `duration-assertions-unguarded` (OPEN 273) ───────────────────────────────
//
// 🔴 273's OWN SUBJECT, AS A RULE. An assertion that claims a wait ACTUALLY HAPPENED by
// bracketing a `setTimeout` with a clock reading is not wrong about the code, it is wrong
// about the CLOCK. Node schedules timers against libuv's loop clock, cached at the top of
// each iteration, so a timer can return before its window has elapsed on any clock a test
// can read — measured at 273 over 2000 rounds, `performance.now()` came back early 24
// times, worst shortfall 0.609 ms, and `Date.now()` scored zero only because millisecond
// truncation rounds it away on an idle machine. It rounded the other way on a GitHub
// runner and `main` went red at `4a718f7` over `waited 199ms`.
//
// 🔴 SO THE RULE IS ABOUT THE BOUND AND NOT ABOUT THE CLOCK, which is the half careful
// reasoning misses: no clock choice fixes it and the assertion has to carry slack. A
// LOWER bound on an elapsed reading must subtract a named tolerance. An UPPER bound is
// COUNTED AND NOT REFUSED — the tree's two (`< 5000` on a 250 ms wait, `< 2000` on a
// refusal that never dials) have three orders of magnitude of margin, and "it finished in
// time" is a different claim from "the wait happened".
//
// 🔴 AND THE POPULATION IS COUNTED BECAUSE THE OFFENCE CANNOT BE. A healthy tree has zero
// unguarded lower bounds, so a rule that printed only its offences would read identically
// whether it was working or had stopped recognising the idiom — 181 §5's problem, which
// every floor in this file exists to answer. `TAUT_DURATION` prints the sites it found.
export const ELAPSED_RE = /(?:\b(?:Date|performance)\.now\s*\(\s*\)\s*-)|\b(?:elapsed|waited|took|duration)\b/;
export const SLACK_RE = /slack/i;
const COMPARE_RE = /(>=|<=|>|<)/;

/**
 * The condition with every quoted span blanked — 🆕 275, and it is not defensive coding.
 *
 * 🔴 THE GATE'S OWN SELF-TEST CAUGHT THIS ON THE FIRST RUN, which is the fifth session
 * running that a fixture beat the author. `durationClaim` reads the CONDITION TEXT, and
 * this file's fixtures pass the idiom they are about as a string: the condition
 * `durationClaim("elapsed >= 200")?.lower === true` contains `elapsed >= 200` and is not
 * a duration claim at all — it is a claim ABOUT one. Four self-test cases were reported
 * as unguarded lower bounds, in a file that asserts nothing about a clock.
 *
 * 🔴 AND THE RULE GENERALISES PAST THIS FILE: a comparison inside a quoted string is not
 * a comparison, in any suite. The same shape reaches every assertion whose message quotes
 * the expression it is about, which is most of them.
 */
export function unquoted(text) {
  return text.replace(/`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
}

/**
 * (null | {lower, guarded}) — how a claim brackets a clock, if it does at all.
 *
 * 🔴 THE SIDE MATTERS AND A NAIVE READER WOULD MISS HALF THE POPULATION. `elapsed >= n`
 * and `n <= elapsed` are the same claim written in two directions, and only the first is
 * what anybody writes — which is exactly why the second is the one that would ship
 * unread.
 */
export function durationClaim(cond) {
  const text = unquoted(cond || "");
  if (!ELAPSED_RE.test(text)) return null;
  const m = COMPARE_RE.exec(text);
  if (m === null) return null;
  const onLeft = ELAPSED_RE.test(text.slice(0, m.index));
  const op = m[1];
  const lower = onLeft ? op === ">=" || op === ">" : op === "<=" || op === "<";
  return { lower, guarded: SLACK_RE.test(text) };
}
// `family` is `_population.mjs`'s block form and `authoring-plane`'s own — the probe
// equivalent of `test()`, and the unit its manifest is keyed on.
const TEST_FNS = new Set(["test", "it", "family"]);
const NOT_A_CLAIM = new Set(["fail"]);
const CONTROL = new Set(["throws", "rejects", "doesNotThrow", "doesNotReject"]);

// ── THE PROBE IDIOM (172) ───────────────────────────────────────────────────────────
// 🔴 171 REPLACED taut169's CLAIM FINDER RATHER THAN EXTENDING IT, AND NOBODY MEASURED
// WHAT FELL OUT. taut169 recognised bare-identifier callees (`check`, `pass`, `fail`);
// 171 recognised `assert.*`, fixed 2175 unseen unit assertions, and in the same move
// stopped seeing 303 probe claims — 209 of them in `authoring-plane`, the largest probe
// in the tree. Its `TAUT_SCOPE test-integration 422/400 ok` covered none of them.
// A finder swapped for its mirror image is still a finder that matches nothing here.
//
// The two shapes, read out of the sources rather than guessed:
//   check(cond, marker, detail)         lsp-plane, cs-lsp-plane, gdscript-dap-plane
//   cond ? pass(M, d) : fail(M, d)      authoring-plane, tabletop-plane
// 🔴 IN THE TERNARY THE CLAIM IS THE CONDITION, NOT THE CALL. taut169 pointed at the
// `pass(...)` site, where the only thing to classify is a marker string constant.
// 🔴 THE MARKER IS THE FIRST STRING LITERAL AND THE CONDITION IS THE FIRST ARGUMENT
// THAT IS NOT ONE. `lsp-plane` writes `check(cond, "MARKER", detail)`; `cs-dap-plane`
// writes `claim("NAME", cond, detail)` — the same idiom with the arguments the other
// way round. Keying on POSITION would have read one of them backwards and classified a
// marker string; keying on SHAPE reads both, and a bare `claim()` with no condition
// (the `_population.mjs` counting form) self-excludes because there is nothing to find.
// 🔴 175: THIS SET WAS MATCHED BY NAME ALONE, AND A NAME IS NOT A BEHAVIOUR.
// 174 §5 found a filename prefix buying a silent exemption. This is the same shape
// pointing the other way: a name buying a silent ADMISSION. `sweep_editor.mjs` declares
//   async function check(name, args = {}) { … results.push({tool: name, status}) … }
// — a TOOL INVOKER. It branches on the reply, never on a parameter, and cannot fail.
// The finder read fifteen `check("scene_open", {path: …})` calls, took the first
// non-string argument as the condition, and recorded fifteen claims whose condition is
// an OBJECT LITERAL. `cs_demo_verify_replay.mjs` declares `assertOk` as a transcript
// READER and contributed two more. Seventeen of the host root's twenty-four claim
// sites were invented by the gate, every one of them unfailable.
//
// 🔴 A GATE THAT FABRICATES ITS OWN POPULATION IS WORSE THAN ONE THAT MISSES IT. 168's
// rule is that a measurement which gets smaller is not a measurement that got better;
// the converse is sharper, because the fabricated sites INFLATE the very floors that
// are supposed to detect a collapse. A floor set against a population the finder
// invented is a floor that cannot go red when the real population disappears.
//
// So the name is now a CANDIDATE and `canFail` is the test. See `collectFailers`.
// `_check` is kept for the record and matches nothing in the tree — measured 175: no
// declaration of that name exists anywhere under test/, test-integration/ or scripts/.
// It is left because removing it would be an unmeasured deletion (172's rule), and it
// is now HARMLESS: unresolvable names admit nothing.
//
// 🆕 `verdict` is 175's own idiom, added because the three fixed drivers assert through
// it. It is SAFE FOR THE REASON THE RESOLVER EXISTS: `tautology_gate.selftest.mjs`
// calls an IMPORTED `verdict(A(src))` — the gate's own exported analyser — on almost
// every line, and under the old name-only rule that would have recorded a hundred-odd
// claims whose condition is a call to the classifier. It resolves to no local
// declaration, so it admits nothing. The fix and the extension landed together, and the
// extension is only shippable because of the fix.
const CHECK_FNS = new Set(["check", "_check", "assertOk", "claim", "verdict"]);

// 🔴 AN OUTCOME FLAG IS A PRECONDITION, IN EVERY IDIOM (172). 171 §3 dismissed forty
// `assert.ok(!r.isError)` because each guards real value claims below it, and warned
// that failing them costs the gate its credibility on the first green run. The probes
// spell the same precondition `check(!res.isError, "SUPPORTED", …)` and tabletop-plane
// spells it `expectOk(marker, r)`. One rule for all three — and it is asked of the
// LEAVES rather than the source text, so it survives one-hop resolution and helper
// inlining, neither of which leaves the original spelling behind.
//
// It changes 171's judgement nowhere: a unit holding a precondition AND a shape-only
// value claim is still vacuous, because the value claim still is.
const OUTCOME_FLAG = /\.(isError|threw)$/;
const isPrecondition = (ls) => ls.length > 0 && ls.every((l) => OUTCOME_FLAG.test((l.text ?? "").trim()));

// ──────────────────────────────────────── is this expression decided at authoring time? --
// 🔴 185. A LITERAL, OR SOMETHING BUILT ONLY OUT OF LITERALS. The point of the narrowing
// is what it EXCLUDES: an identifier is not literalish (so `assert.equal(count, 3)` is
// untouched, which is the false-fail 184 §10.2 was right to refuse), and neither is a
// property access (so `_population.selftest.mjs`'s `assert.ok === assert.ok` — a real
// claim about a memoising Proxy — stays green). A template literal counts only when it
// has no substitutions; `${x}` makes it a reading.
//
// Structural, not a text test, for 174 §6's reason: the class/function separation that
// session needed was found in a PROPERTY rather than in a naming convention, and the same
// discipline applies here — `-1` is a prefix-unary over a numeric literal, not a literal,
// and a regex over source text would have had to guess.
export function isLiteralish(node) {
  if (!node) return false;
  if (ts.isParenthesizedExpression(node)) return isLiteralish(node.expression);
  if (ts.isPrefixUnaryExpression(node)) return isLiteralish(node.operand);
  if (ts.isNumericLiteral(node) || ts.isBigIntLiteral(node) || ts.isStringLiteral(node)) return true;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return true;
  const k = node.kind;
  return k === ts.SyntaxKind.TrueKeyword || k === ts.SyntaxKind.FalseKeyword
      || k === ts.SyntaxKind.NullKeyword;
}

// ─────────────────────────────────────────────── the leaf classifier (169's judgements) --
// A leaf is SHAPE when it can be satisfied by a value that is the wrong ANSWER but the
// right TYPE. A leaf is VALUE when satisfying it constrains WHAT the value is.
export function classifyLeaf(node, src) {
  const t = (n) => n.getText(src);

  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind;
    const eq = op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsToken;
    const ne = op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken;

    for (const [a, b] of [[node.left, node.right], [node.right, node.left]]) {
      if (ts.isTypeOfExpression(a) && ts.isStringLiteralLike(b)) {
        if (eq && SHAPE_TYPEOF.has(b.text) && b.text !== "undefined") return { kind: "SHAPE", why: `typeof === "${b.text}"`, text: t(node) };
        if (eq && b.text === "undefined") return { kind: "VALUE", why: "typeof === undefined (a negative)", text: t(node) };
        if (ne && b.text === "undefined") return { kind: "SHAPE", why: 'typeof !== "undefined" (presence only)', text: t(node) };
        return { kind: "VALUE", why: `typeof ${ne ? "!==" : "=="} "${b.text}"`, text: t(node) };
      }
      if (ne && (t(b) === "undefined" || t(b) === "null")) return { kind: "SHAPE", why: `${t(b)} presence check`, text: t(node) };
      if (eq && (t(b) === "undefined" || t(b) === "null")) return { kind: "VALUE", why: `asserts ${t(b)}`, text: t(node) };
    }

    if (/\.length$/.test(t(node.left)) || /\.length$/.test(t(node.right))) {
      const lit = ts.isNumericLiteral(node.right) ? Number(node.right.text) : ts.isNumericLiteral(node.left) ? Number(node.left.text) : null;
      if (lit === 0 && (op === ts.SyntaxKind.GreaterThanEqualsToken || op === ts.SyntaxKind.LessThanEqualsToken))
        return { kind: "SHAPE", why: "length >= 0 is vacuous", text: t(node) };
    }
    // 🔴 185, AND IT IS 179's RULE INSIDE THE INSTRUMENT 179's RULE WAS WRITTEN FOR:
    // AN INSTRUMENT ENFORCES ITS RULES WHERE THEY WERE WRITTEN, NOT WHERE ITS POPULATION
    // COMES FROM. `conditionOf` below has tested `t(a) === t(b)` since 169 — for the
    // METHOD spelling, `assert.equal(3, 3)`. This branch is the EXPRESSION spelling, and
    // it never had the check. Measured against the shipped classifier:
    //
    //     assert.equal(3, 3)     -> SHAPE "both sides are the same expression"   flagged
    //     assert.ok(84 !== 84)   -> VALUE "compared to a value"                  GREEN
    //
    // The second is the path taken by every `assert.ok(a === b)`, every ternary
    // condition, and EVERY HELPER GUARD — which is where all thirty of the claim sites
    // reached through an asserter helper are classified (184 §10.2, measured 185:
    // 30 of 3591, `host/_to_delete/laundered185.mjs`). 184's G2 mutant replaced a call
    // site's reading with a literal and this gate stayed green; this is the branch that
    // was letting it.
    //
    // 🔴 BOTH SIDES LITERAL, NOT MERELY IDENTICAL, AND THE TREE IS WHY. Measured across
    // 2006 comparisons (`host/_to_delete/identical185.mjs`): exactly ONE has textually
    // identical sides, and it is a REAL CLAIM —
    //
    //     _population.selftest.mjs:197   assert.ok === assert.ok
    //
    // — because that file's `assert` is a memoising PROXY, so evaluating the same text
    // twice need not give the same value. A rule reading "identical sides are vacuous"
    // would have reddened the one honest instance in the tree and been deleted. A
    // LITERAL cannot be a proxy trap, and cannot be the `x !== x` NaN idiom either, so
    // both known counterexamples are excluded by construction rather than by an
    // exemption somebody has to maintain. Measured cost on the tree today: zero sites.
    if ((eq || ne) && isLiteralish(node.left) && isLiteralish(node.right)) {
      return { kind: "SHAPE", why: "both operands are literals — the comparison is decided at authoring time", text: t(node) };
    }
    if (eq || ne) return { kind: "VALUE", why: "compared to a value", text: t(node) };
    if (isLiteralish(node.left) && isLiteralish(node.right)) {
      return { kind: "SHAPE", why: "both operands are literals — the comparison is decided at authoring time", text: t(node) };
    }
    return { kind: "VALUE", why: `relational (${ts.tokenToString(op)})`, text: t(node) };
  }

  if (ts.isCallExpression(node)) {
    const callee = t(node.expression);
    if (/^(Array\.isArray|Number\.isFinite|Number\.isInteger|Number\.isSafeInteger)$/.test(callee))
      return { kind: "SHAPE", why: `${callee}() is a type test`, text: t(node) };
    // 🔴 `.some()`/`.includes()`/`.find()` CONSTRAIN EXISTENCE — an empty collection
    // fails them. taut169 recursed into every predicate alike and so read an existence
    // claim as a shape test. `.every()` is the exact opposite and gets its own class.
    const m = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : null;
    if (m && ["some", "includes", "find", "findIndex", "indexOf"].includes(m))
      return { kind: "VALUE", why: `.${m}() constrains existence`, text: t(node) };
    return { kind: "CALL", why: callee, text: t(node), call: node, method: m };
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword) return { kind: "SHAPE", why: "literal true", text: t(node) };
  if (ts.isNumericLiteral(node) && Number(node.text) !== 0) return { kind: "SHAPE", why: "truthy literal", text: t(node) };
  // A non-null assertion or an `as` cast is a COMPILE-time claim and constrains nothing
  // at runtime. These are TS-only forms that taut169's ScriptKind.JS parse never saw.
  if (ts.isNonNullExpression(node) || ts.isAsExpression(node)) return classifyLeaf(node.expression, src);
  if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
    return { kind: "SHAPE", why: "bare truthiness (presence only)", text: t(node) };

  return { kind: "OTHER", why: ts.SyntaxKind[node.kind], text: t(node) };
}

export function leaves(node, src, out = [], depth = 0) {
  if (depth > 40) return out;
  if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) return leaves(node.expression, src, out, depth + 1);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken)
    return leaves(node.operand, src, out, depth + 1);
  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      leaves(node.left, src, out, depth + 1);
      leaves(node.right, src, out, depth + 1);
      return out;
    }
  }
  const c = classifyLeaf(node, src);
  if (c.kind === "CALL" && c.call) {
    // 🔴 `.every(pred)` RETURNS TRUE ON AN EMPTY COLLECTION whatever pred is, so it is
    // satisfiable without a single element being examined. Its own class, because the
    // fix is a length floor rather than a rewrite.
    if (c.method === "every") {
      // 🔴 KEEP THE RECEIVER (172). `.every()` is vacuous because the collection may be
      // EMPTY — so a receiver that provably is not (a non-empty array literal, directly
      // or one hop away) is not this class at all. Measured: `gdscript-dap-plane`'s
      // `capNames.every(…)` runs over an eight-element literal declared two lines up.
      const recv = ts.isPropertyAccessExpression(c.call.expression) ? c.call.expression.expression.getText(src) : null;
      out.push({ kind: "EVERY", why: ".every() is vacuously true on an empty collection", text: c.text, recv });
      return out;
    }
    let recursed = false;
    for (const arg of c.call.arguments) {
      if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
        const body = ts.isBlock(arg.body) ? null : arg.body;
        if (body) { leaves(body, src, out, depth + 1); recursed = true; }
      }
    }
    if (recursed) return out;
    // A call we cannot see inside is OPAQUE, never a tautology: it may well be the
    // discriminating part. Under-reporting is the safe direction (169, carried).
    out.push({ kind: "OPAQUE", why: `call ${c.why}()`, text: c.text });
    return out;
  }
  out.push(c);
  return out;
}

// ─────────────────────────────────────────────────────────────────── regex vacuity --
// `assert.match(s, /./)` passes for every non-empty string. Rather than reason about
// regex algebra, PROBE it: a pattern accepting nine wildly different strings constrains
// nothing a wrong answer could fail.
const PROBES = ["", "x", "0", "!!", "\n", "a b c", "ZZZZ", "res://a.tscn", "{}"];
function regexVacuity(node, src) {
  if (!ts.isRegularExpressionLiteral(node)) return null;
  const raw = node.getText(src);
  const m = /^\/(.*)\/([a-z]*)$/s.exec(raw);
  if (!m) return null;
  let re;
  try { re = new RegExp(m[1], m[2].replace(/[gy]/g, "")); } catch { return null; }
  let hits = 0;
  for (const p of PROBES) { try { if (re.test(p)) hits++; } catch { return null; } }
  return hits === PROBES.length
    ? { kind: "SHAPE", why: `regex ${raw} matches every probe string`, text: raw }
    : { kind: "VALUE", why: `regex ${raw}`, text: raw };
}

// ───────────────────────────────────────────────────────────────── the claim finder --
// 🔴 THE PART taut169 STRUCTURALLY COULD NOT HAVE. node:test assertions are
// PropertyAccessExpressions on `assert`, plus the bare `assert(x)` call form. Each
// method carries its condition somewhere different; this mapping is the whole port.
function conditionOf(method, args, src) {
  const t = (n) => n.getText(src);
  const nullish = (n) => t(n) === "undefined" || t(n) === "null";

  switch (method) {
    case "ok": case "__bare__":
      return args[0] ? { leaves: leaves(args[0], src), shown: t(args[0]) } : null;

    case "equal": case "strictEqual": {
      const [a, b] = args; if (!a || !b) return null;
      if (t(a) === t(b)) return { leaves: [{ kind: "SHAPE", why: "both sides are the same expression", text: t(a) }], shown: `${t(a)} === ${t(b)}` };
      for (const [x, y] of [[a, b], [b, a]]) {
        if (ts.isTypeOfExpression(x) && ts.isStringLiteralLike(y)) {
          const shape = SHAPE_TYPEOF.has(y.text) && y.text !== "undefined";
          return { leaves: [{ kind: shape ? "SHAPE" : "VALUE", why: `typeof === "${y.text}"`, text: t(x) }], shown: `${t(a)} === ${t(b)}` };
        }
      }
      return { leaves: [{ kind: "VALUE", why: "equality against a value", text: t(b) }], shown: `${t(a)} === ${t(b)}` };
    }

    case "notEqual": case "notStrictEqual": {
      const [a, b] = args; if (!a || !b) return null;
      // 🔴 185: THE THIRD SPELLING, WHICH NEVER HAD THE CHECK AT ALL. `equal` and
      // `deepEqual` above have tested identical sides since 169; this case is their
      // negation and was written without it. Kept to LITERALS for the reason the leaf
      // classifier is — `assert.notEqual(x, x)` on a memoising proxy is a real claim,
      // and `x !== x` is the NaN idiom.
      if (isLiteralish(a) && isLiteralish(b))
        return { leaves: [{ kind: "SHAPE", why: "both operands are literals — the comparison is decided at authoring time", text: `${t(a)} !== ${t(b)}` }], shown: `${t(a)} !== ${t(b)}` };
      if (nullish(b) || nullish(a))
        return { leaves: [{ kind: "SHAPE", why: `notEqual ${nullish(b) ? t(b) : t(a)} — presence only`, text: t(a) }], shown: `${t(a)} !== ${t(b)}` };
      return { leaves: [{ kind: "VALUE", why: "inequality against a value", text: t(b) }], shown: `${t(a)} !== ${t(b)}` };
    }

    case "deepEqual": case "deepStrictEqual": {
      const [a, b] = args; if (!a || !b) return null;
      if (t(a) === t(b)) return { leaves: [{ kind: "SHAPE", why: "both sides are the same expression", text: t(a) }], shown: `${t(a)} deepEqual ${t(b)}` };
      // 🔴 THE OFFENDER-LIST IDIOM. `assert.deepEqual(missing, [])` is a STRONG claim
      // about content and a WEAK one about scope: an enumeration that returned nothing
      // satisfies it. Flagged only when the left side is DERIVED from a population; a
      // `deepEqual(reply, [])` against a fixed return value is a real claim.
      if (/^\[\s*\]$/.test(t(b)))
        return { leaves: [{ kind: "OFFENDER", why: "offender list vs [] — passes if the population is empty", text: t(a) }], shown: `${t(a)} deepEqual []` };
      return { leaves: [{ kind: "VALUE", why: "structural equality", text: t(b) }], shown: `${t(a)} deepEqual ${t(b)}` };
    }
    case "notDeepEqual": case "notDeepStrictEqual":
      return args[1] ? { leaves: [{ kind: "VALUE", why: "structural inequality", text: t(args[1]) }], shown: "notDeepEqual(…)" } : null;

    case "match": {
      const [s, r] = args; if (!s || !r) return null;
      const v = regexVacuity(r, src);
      return v ? { leaves: [v], shown: `match(${t(s)}, ${t(r)})` }
               : { leaves: [{ kind: "OPAQUE", why: "regex is not a literal", text: t(r) }], shown: `match(${t(s)}, …)` };
    }
    case "doesNotMatch":
      return { leaves: [{ kind: "VALUE", why: "a negative claim about content", text: t(args[1] ?? args[0]) }], shown: "doesNotMatch(…)" };

    default: return null;
  }
}

// ───────────────────────────────────────────── one-hop resolution (169's FP killer) --
// 🔴 A BARE IDENTIFIER IS ONLY A TAUTOLOGY IF WHAT DEFINED IT WAS ONE. 169 found this by
// checking its instrument before believing it: `good`, `residue.clean` and friends
// looked vacuous until the name was followed to `const good = a === "x" && b === 3`.
// Resolve to the NEAREST PRECEDING binding, which is what a reader does — a name bound
// more than once is not unresolvable.
function collectConsts(src) {
  const list = [];
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer)
      list.push({ name: n.name.text, pos: n.getStart(src), init: n.initializer });
    ts.forEachChild(n, visit);
  };
  visit(src);
  return list;
}
const lookup = (consts, name, usePos) => {
  let best = null;
  for (const c of consts) if (c.name === name && c.pos < usePos && (!best || c.pos > best.pos)) best = c;
  return best;
};
function resolveLeaves(ls, consts, src, usePos, depth = 0) {
  if (depth > 2) return ls;
  const out = []; let changed = false;
  for (const l of ls) {
    if (l.kind === "SHAPE" && l.why === "bare truthiness (presence only)" && /^[A-Za-z_$][\w$]*$/.test(l.text)) {
      const c = lookup(consts, l.text, usePos);
      if (c) {
        const sub = leaves(c.init, src);
        if (sub.length) { out.push(...sub.map((s) => ({ ...s, why: `${l.text} := ${s.why}` }))); changed = true; continue; }
      }
    }
    out.push(l);
  }
  return changed ? resolveLeaves(out, consts, src, usePos, depth + 1) : out;
}

// 🔴 A RECEIVER THAT IS A NON-EMPTY ARRAY LITERAL CANNOT BE EMPTY (172). One hop, the
// same resolution `resolveLeaves` does, asked of the collection rather than the claim.
function isNonEmptyLiteralArray(text, consts, src, usePos) {
  if (!text) return false;
  if (/^\[\s*[^\]\s]/.test(text)) return true;
  if (!/^[A-Za-z_$][\w$]*$/.test(text)) return false;
  const c = lookup(consts, text, usePos);
  if (!c) return false;
  return ts.isArrayLiteralExpression(c.init) && c.init.elements.length > 0;
}

// Is this expression a collection DERIVED from a population? Either it filters/maps
// inline, or it is a name whose nearest preceding binding does — or an empty-array
// accumulator a loop pushes offenders into.
function isDerived(text, consts, src, usePos) {
  if (DERIVING.test(text)) return true;
  if (!/^[A-Za-z_$][\w$]*$/.test(text)) return false;
  const c = lookup(consts, text, usePos);
  if (!c) return false;
  const init = c.init.getText(src);
  return DERIVING.test(init) || /^\[\s*\]$/.test(init);
}

// ─────────────────────────────────────── local asserter helpers (172, tabletop-plane) --
// 🔴 A THIRD PROBE SHAPE, AND THE ONLY REASON `tabletop-plane` READ AS SILENT.
// It asserts through two local helpers that take a REPLY rather than a condition:
//   function expectRefusal(marker, r, code) {
//     if (!r.isError && !r.threw) return fail(marker, …);
//     if (!text.includes(code))   return fail(marker, …);
//     pass(marker, …);
//   }
// There is no condition at the call site to classify — it lives one hop away, in the
// helper's guard clauses. Resolving into them is the same one-hop move `resolveLeaves`
// already makes for names, asked of a function instead. The guards are written in the
// FAILING polarity (`if (bad) fail`); `leaves()` unwraps a leading `!` already and the
// SHAPE/VALUE distinction does not depend on polarity, so the kinds carry over intact.
// 🔴 EXPORTED IN 185 FOR THE MEASUREMENT 184 §10.2 ASKED FOR, AND FOR verdict_gate.mjs's
// REASON: "two spellings of the same population would be two populations, and the one
// nobody re-read would drift." The question — how many claim sites are reached through a
// helper whose CONDITION IS ITS OWN, rather than written at the call site — is a question
// about exactly this map, and re-deriving it in a scratch script would have answered a
// slightly different one. Behaviour is unchanged; the word `export` is the whole diff.
export function collectAsserters(src) {
  const out = new Map();
  const guards = (body) => {
    const conds = [];
    const walk = (n) => {
      if (ts.isIfStatement(n) && /\b(pass|fail)\s*\(/.test(n.getText(src))) conds.push(n.expression);
      ts.forEachChild(n, walk);
    };
    walk(body);
    return conds;
  };
  const consider = (name, fn) => {
    if (!fn?.body || !/\b(pass|fail)\s*\(/.test(fn.body.getText(src))) return;
    const conds = guards(fn.body);
    if (conds.length) out.set(name, conds);
  };
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) consider(n.name.text, n);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
        && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)))
      consider(n.name.text, n.initializer);
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

// ──────────────────────────────────── can this helper FAIL? (175, the CHECK_FNS fix) --
// 🔴 STRUCTURAL, NOT A NAME LIST — 174 §6's precedent. That session had to tell a class
// from a function and found ONE property that separates them (a non-writable
// `prototype`) rather than pattern-matching on capitalisation. Same discipline here:
// what actually separates the six real helpers from the two impostors?
//
//   REAL      check(cond, name)   `if (cond) {…} console.log("FAIL"); failures++`
//             claim(cond, what)   `if (!cond) { bad++; console.log("🔴 FAILED") }`
//             claim(name, cond)   `if (cond) log(ok); else { failures++; log(FAIL) }`
//   IMPOSTOR  check(name, args)   branches on `r.isError` — a value it FETCHED
//             assertOk(o, step)   `return s && s.result ? s.result.ok : undefined`
//
// TWO conditions, and BOTH are needed. Either alone admits an impostor:
//   1. the body branches on a PARAMETER of the helper — the impostors branch only on
//      values they derived, so their behaviour is not a function of what the caller
//      claimed. `sweep_editor`'s `check` fails here.
//   2. on some branch it does something OTHER than compute a return value: mutates a
//      binding declared outside itself, throws, or exits nonzero. `assertOk` fails
//      here — it branches on a parameter-derived value and then merely RETURNS it.
//
// 🔴 CONDITION 2 ALONE IS NOT ENOUGH, AND THAT IS THE INTERESTING PART. `sweep_editor`'s
// `check` DOES mutate an outer binding (`results.push({tool, status})`) — a reasonable
// first rule admits it. The parameter test is what excludes it: a helper that never
// consults what it was told cannot be asserting it.
//
// A name that resolves to NO declaration in the file admits nothing. Measured 175:
// every one of the six live helpers is declared locally, so this costs no coverage —
// `test` and `test-integration` are byte-identical before and after (3141 sites).
function collectFailers(src) {
  const out = new Set();
  const consider = (name, fn) => {
    if (!fn?.body) return;
    const params = new Set(
      (fn.parameters ?? []).filter((p) => ts.isIdentifier(p.name)).map((p) => p.name.text),
    );
    if (!params.size) return;

    // Every binding the helper declares itself. Anything assigned that is NOT one of
    // these and NOT a parameter is state belonging to an enclosing scope.
    const own = new Set(params);
    const collectOwn = (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) own.add(n.name.text);
      ts.forEachChild(n, collectOwn);
    };
    collectOwn(fn.body);

    const mentionsParam = (node) => {
      let hit = false;
      const walk = (n) => {
        if (ts.isIdentifier(n) && params.has(n.text)) hit = true;
        ts.forEachChild(n, walk);
      };
      walk(node);
      return hit;
    };

    // The root of an assignment/increment target: `failures++` -> failures,
    // `results.push(x)` -> results, `o.steps[0].n = 1` -> o.
    const rootName = (e) => {
      let n = e;
      for (let i = 0; i < 40 && n; i++) {
        if (ts.isIdentifier(n)) return n.text;
        if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) n = n.expression;
        else if (ts.isCallExpression(n)) n = n.expression;
        else return null;
      }
      return null;
    };

    let branchesOnParam = false;
    let escapes = false;
    const walk = (n) => {
      if ((ts.isIfStatement(n) || ts.isConditionalExpression(n)) && mentionsParam(n.expression ?? n.condition))
        branchesOnParam = true;
      if (ts.isIfStatement(n) && mentionsParam(n.expression)) branchesOnParam = true;
      if (ts.isConditionalExpression(n) && mentionsParam(n.condition)) branchesOnParam = true;

      if (ts.isThrowStatement(n)) escapes = true;
      if (ts.isCallExpression(n) && /^process\.exit$/.test(n.expression.getText(src))) {
        const a = n.arguments[0];
        if (!a || a.getText(src).trim() !== "0") escapes = true;
      }
      if (ts.isPostfixUnaryExpression(n) || ts.isPrefixUnaryExpression(n)) {
        const op = n.operator;
        if (op === ts.SyntaxKind.PlusPlusToken || op === ts.SyntaxKind.MinusMinusToken) {
          const r = rootName(n.operand);
          if (r && !own.has(r)) escapes = true;
        }
      }
      if (ts.isBinaryExpression(n) && ts.isToken(n.operatorToken)
          && /Equals(Token)?$/.test(ts.SyntaxKind[n.operatorToken.kind] ?? "")) {
        const r = rootName(n.left);
        if (r && !own.has(r)) escapes = true;
      }
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
          && /^(push|add|set|delete|unshift)$/.test(n.expression.name.text)) {
        const r = rootName(n.expression.expression);
        if (r && !own.has(r)) escapes = true;
      }
      ts.forEachChild(n, walk);
    };
    walk(fn.body);

    if (branchesOnParam && escapes) out.add(name);
  };
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) consider(n.name.text, n);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
        && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)))
      consider(n.name.text, n.initializer);
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

// 🔴 193 §9.3 — THE SECTION BANNER, AND WHY THE ORPHAN CEILING HAD TO BE READ BEFORE THIS
// COULD BE WRITTEN. 191 §5 turned `orphan = sites - attributed` into ORPHAN_CEILING = 509
// and 192 carried it forward untouched, saying so: "pins 509; not one of them has been
// read." Reading them answered the handoff's binary question BOTH ways, 85/15:
//
//   77 orphans / 12 files   the BANNER class, legitimate — self-tests asserting module
//                           constants at file scope, outside any unit by nature
//  432 orphans / 11 files   🔴 the GAP. Every `*.integration.mjs` where NOT ONE claim
//                           reaches a unit. They use zero `node:test`: bare async scripts
//                           with a `die()` helper, so `enclosingTest` finds nothing.
//
// 🔴 THE CONSEQUENCE IS THE WHOLE POINT. `vacuous`, `every` and `offender` are scored over
// the units that survive attribution. An orphan is scored by nothing — so the live-engine
// integration suite, the most expensive tests in this repo, was unscored for tautology.
// The plane files escaped it only because they spell claims `check(cond, marker, detail)`,
// which the marker path already reads.
//
// The fallback is the files' OWN existing convention, so it costs no new maintenance
// surface — the same argument the marker path was given:
//
//     // ====================================== 2. `visible`, all THREE branches ===
//
// Anchored on the RULE CHARACTERS, not on a numbered prefix: several of these files number
// their sections and several do not, and a rule that only read the numbered ones would
// attribute a file's first half and call the rest orphans.
const BANNER_RE = /^\s*\/\/\s*[=-]{4,}\s*(.+?)\s*$/;

// 🔴 194 §9.3 — AND THE TREE DRAWS THIS BANNER THREE WAYS, NOT ONE. 193 chose the idiom by
// reading eleven `*.integration.mjs` files and generalising from what they wrote. It was
// the right method applied to the wrong sample: the same convention is drawn with BOX
// characters in 183 lines across `scripts/`, `test/` and `test-integration/`, and with a
// THREE-dash leading rule in both LSP plane probes. Measured, not guessed:
//
//   // ── 6. THE REAL TREE, READ RATHER THAN ASSUMED ──────────   verdict_gate.selftest
//   // --- the refusals: states the mock server cannot produce ---  cs-lsp-plane, lsp-plane
//
// Those files were being counted as "carrying no banners", and the 193 handoff passed that
// reading forward as "give them the banners the other ten already have". They HAVE them.
// Widening the reader is the fix that costs no maintenance surface; adding a second,
// differently-drawn banner above an existing one is the fix that costs a lie.
//
// FORM B is a title FLANKED by rules, which is what the two missed idioms have in common
// and what a leading-run-only rule cannot express. It is a UNION with form A, never a
// replacement: form A matches a leading rule with no trailing one and that population must
// not move. The leading run drops to 2 only because it is now paying for a trailing run of
// 3 — `// -- TODO --` still matches nothing.
const BANNER_FLANKED_RE = /^\s*\/\/\s*[=\-─═━]{2,}\s*(.+?)\s*[=\-─═━]{3,}\s*$/;
const RULE_TAIL_RE = /\s*[=\-─═━]+\s*$/;

function bannerUnits(text) {
  const out = [];
  text.split("\n").forEach((ln, i) => {
    const m = BANNER_RE.exec(ln) ?? BANNER_FLANKED_RE.exec(ln);
    if (!m) return;
    const name = m[1].replace(RULE_TAIL_RE, "").trim();
    // A bare rule (`// ==========`) titles nothing and is a separator, not a unit.
    if (name && !/^[=\-─═━]+$/.test(name)) out.push({ name, line: i + 1 });
  });
  return out;
}

// 🔴 194 §9.3 — AND BEFORE THE COMMENT, THE SECTION MARKER THE PROBE EXECUTES.
// 193 taught this reader the DECORATIVE section marker. These files also carry an
// EXECUTABLE one, and it is not a convention anybody has to keep up: `_population.mjs`
// documents two idioms and attributes every claim by them at runtime —
//
//   HEADER-FIRST  `population.open(label)`  — "claims count into it until the next open"
//   FAIL-FAST     `population.seal(marker)` — "attribute every claim made since the
//                                             previous seal", so the marker CLOSES its
//                                             section and sits BELOW its own claims
//
// The scorer was reading neither, and `vcs.integration.mjs` — 78 claims, the largest
// single block of orphans in the tree — spells all twelve of its sections with `seal()`.
// The runtime has always known which section each of those claims belongs to. This makes
// the static reader ask the same question, which is why it needs no new banners: the
// answer is already in the file, executable and already load-bearing.
//
// 🔴 THE WRAPPED IDIOM IS EXCLUDED, AND NOT FOR TIDINESS. `population.family(label, fn)`
// sets `current = null` when its body returns, so a claim AFTER a family belongs to no
// section — "the nearest event above" would hand it the family that just closed. Those
// files need nothing here anyway: `family` is in `TEST_FNS`, so the AST walk above already
// owns their claims. Measured: no file in the tree mixes the two, and this returns null
// rather than guessing if one ever does.
const POPULATION_RECV_RE = /(?:const|let|var)\s+(\w+)\s*=\s*new\s+Population\b/;

function populationSections(text) {
  const m = POPULATION_RECV_RE.exec(text);
  if (!m) return null;
  const recv = m[1];
  if (new RegExp(`\\b${recv}\\.family\\s*\\(`).test(text)) return null;
  const re = new RegExp(`^\\s*${recv}\\.(open|seal)\\s*\\(\\s*["'\`]([^"'\`]+)`);
  const out = [];
  text.split("\n").forEach((ln, i) => {
    const e = re.exec(ln);
    if (e) out.push({ mode: e[1], name: e[2], line: i + 1 });
  });
  return out.length ? out : null;
}

// The nearest enclosing `test("name", …)` / `it(…)`, so each assertion is attributed to
// the case it belongs to — falling back to the probe's own executed section marker, and
// then to the nearest section banner ABOVE the claim for the script-shaped files that have
// no test() blocks at all.
// 🔴 248 — A `test()` NAMED BY A TEMPLATE LITERAL WAS INVISIBLE HERE, AND INVISIBLE IS
// SPELLED `orphan`. `ts.isStringLiteralLike` admits a plain string and a template with no
// substitutions, and rejects the one shape a table-driven suite always reaches for:
// ``test(`${flag} is refused`, …)``. Every assertion inside such a case fell through to
// the banner fallback and then out of attribution entirely — so a file could add twenty
// well-formed cases and the only number that moved was the orphan count, which reads as
// *claims nobody wrote a unit for* and here meant *a unit this reader could not spell*.
// That is 246's rule one file over: a lookup that silently skips what it cannot spell is
// a scope decision nobody wrote down.
function templateName(node, src) {
  if (!ts.isTemplateExpression(node)) return null;
  // The literal spans, joined by the placeholder the source actually reads. A name is an
  // identifier for a unit, not a value — two loop iterations SHOULD share one unit name,
  // because they are one case driven twice and `vacuous` is scored per unit.
  return [node.head.text, ...node.templateSpans.map((t) => t.literal.text)].join("${…}");
}

function enclosingTest(node, src, banners = null, sections = null) {
  for (let p = node.parent, hops = 0; p && hops < 60; p = p.parent, hops++) {
    if (!ts.isCallExpression(p) || !p.arguments.length) continue;
    const arg0 = p.arguments[0];
    const name = ts.isStringLiteralLike(arg0) ? arg0.text : templateName(arg0, src);
    if (name === null) continue;
    {
      const c = p.expression;
      const n = ts.isIdentifier(c) ? c.text
        : ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) ? c.expression.text : null;
      if (n && TEST_FNS.has(n)) return { name, line: src.getLineAndCharacterOfPosition(p.getStart(src)).line + 1 };
    }
  }
  // The EXECUTED marker first — it is what the runtime counts by, so where the two
  // disagree the executed one is right and the comment is decoration.
  if (sections && sections.length) {
    const line = src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1;
    let last = null;
    for (const s of sections) { if (s.line < line) last = s; else break; }
    // `open()` captures what follows it. Anything else — a closed section, or the top of
    // the file — leaves the claim PENDING, which is exactly the word `_population.mjs`
    // uses, and pending claims are drained by the next `seal()` below.
    if (last && last.mode === "open") return { name: last.name, line: last.line, section: true };
    const next = sections.find((s) => s.line > line && s.mode === "seal");
    if (next) return { name: next.name, line: next.line, section: true };
  }
  if (banners && banners.length) {
    const line = src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1;
    let owner = null;
    for (const b of banners) { if (b.line < line) owner = b; else break; }
    if (owner) return { name: owner.name, line: owner.line, banner: true };
  }
  return null;
}

/** Analyse one source text. Exported so the self-test can drive it with no files. */
export function analyze(fileName, text) {
  const src = ts.createSourceFile(
    fileName, text, ts.ScriptTarget.Latest, true,
    /\.ts$/.test(fileName) ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );
  const consts = collectConsts(src);
  const asserters = collectAsserters(src);
  // 🔴 ONLY WHERE THERE ARE NO test() BLOCKS AT ALL. A file that has both would get its
  // stray file-scope claims swept under whichever banner happened to precede them, which
  // turns the legitimate 77 (see `enclosingTest`) into fake attribution and hides the very
  // class this fallback exists to expose. The fallback is for script-shaped files, and
  // "script-shaped" is asked of the file rather than assumed from its name.
  const banners = /\b(?:test|it|family)\s*\(\s*["'`]/.test(text) ? null : bannerUnits(text);
  // 🔴 NOT GATED THE SAME WAY, AND THE DIFFERENCE IS THE WHOLE ARGUMENT. The banner gate
  // exists because a COMMENT that happens to precede a stray claim proves nothing about
  // where that claim belongs. `population.open`/`seal` are not adjacency — they are the
  // calls that decide attribution at runtime, so reading them cannot invent a fact. What
  // it CAN do is disagree with `family()`, and `populationSections` refuses that case.
  const sections = populationSections(text);
  // 175: a CHECK_FNS name is only a claim idiom when it resolves to something that can
  // actually fail. See `collectFailers` — the name is the candidate, this is the test.
  const failers = collectFailers(src);
  const claims = [];

  // One shared scorer, so a probe claim and a unit claim are judged by the same rules.
  // `marker` is the probe's family name; it is the unit `_population.mjs` keys on, and
  // therefore the unit a probe's vacuity must be scored at.
  const record = (node, method, conds, marker, override = null) => {
    const list = Array.isArray(conds) ? conds : [conds];
    const raw = list.map((c) => c.getText(src)).join(" && ").replace(/\s+/g, " ");
    const ls = override ?? resolveLeaves(list.flatMap((c) => leaves(c, src)), consts, src, node.getStart(src));
    const off = ls.find((l) => l.kind === "OFFENDER");
    claims.push({
      file: fileName, line: src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1,
      method, marker, owner: enclosingTest(node, src, banners, sections),
      cond: raw.slice(0, 170),
      // 🔴 THE FLOOR MUST BE LOOKED FOR IN THE *RESOLVED* TEXT (172). `hasFloor` tested
      // `cond` alone, so `(searchOk && listOk)` — whose floor lives one hop away in the
      // const that defines `searchOk` — read as unfloored. Latent in the unit suite,
      // where conditions are mostly inline; immediate in the probes, where they are not.
      floorText: `${raw} ${ls.map((l) => l.text ?? "").join(" ")}`,
      leaves: ls,
      precondition: isPrecondition(ls),
      allShape: ls.length > 0 && ls.every((l) => l.kind === "SHAPE"),
      anyEvery: ls.some((l) => l.kind === "EVERY" && !isNonEmptyLiteralArray(l.recv, consts, src, node.getStart(src))),
      anyOffender: Boolean(off) && isDerived(off.text, consts, src, node.getStart(src)),
    });
  };

  const visit = (node) => {
    // ── the probe idioms (172) ─────────────────────────────────────────────────────
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments.length) {
      const callee = node.expression.text;
      // marker = the first string literal; condition = the first argument that is not
      // one. Order-independent, so `check(cond, "M")` and `claim("M", cond)` both read.
      const marker = node.arguments.find((a) => ts.isStringLiteralLike(a));
      const cond = node.arguments.find((a) => !ts.isStringLiteralLike(a));
      if (CHECK_FNS.has(callee) && failers.has(callee) && cond) record(node, callee, cond, marker?.text ?? null);
      // a call to a local pass/fail helper: the condition lives in its guard clauses
      //
      // 🔴 185 — AND THE CALL SITE IS ASKED ONE QUESTION FIRST, WHICH IS 184 §8's G2.
      // The guard is the SAME TEXT for every call site of the helper, so classifying it
      // says the same thing about all of them however vacuous the operands are one frame
      // up: `tcheck(census(dir).files, 84)` and `tcheck(84, 84)` are indistinguishable
      // here, and 184 committed the second shape's blindness one edit after this gate
      // caught the honest first draft. The narrow, measurable question the call site CAN
      // answer: did the caller supply anything the helper could not have known?
      //
      // 🔴 ALL of them, not ANY. 184 §10.2 refused the rule "flag constant operands"
      // because it false-fails every honest `assert.equal(count, 3)` — and it was right;
      // the working rule is one word away. `tcheck(census(dir).files, 84)` supplies a
      // reading AND a literal and is untouched. Only a call where EVERY non-marker
      // argument is decided at authoring time is a claim the helper cannot rescue.
      //
      // Measured before shipping (`host/_to_delete/laundered185.mjs`): 30 claim sites of
      // 3591 reach the classifier through an asserter at all, across three helpers in two
      // files, and ZERO of them pass only literals. The rule costs nothing on this tree
      // and kills G2's mutant at the site it was written.
      else if (asserters.has(callee) && marker) {
        const supplied = node.arguments.filter((a) => !ts.isStringLiteralLike(a));
        const decided = supplied.length > 0 && supplied.every((a) => isLiteralish(a));
        record(node, callee, asserters.get(callee), marker.text, decided ? [{
          kind: "SHAPE",
          why: `every argument to ${callee}() is a literal — the helper compares two things the caller already decided`,
          text: supplied.map((a) => a.getText(src)).join(", "),
        }] : null);
      }
    }
    if (ts.isConditionalExpression(node)) {
      const callee = (e) => (ts.isCallExpression(e) && ts.isIdentifier(e.expression) ? e.expression.text : null);
      if (callee(node.whenTrue) === "pass" && callee(node.whenFalse) === "fail") {
        const a = node.whenTrue.arguments?.[0];
        record(node, "pass/fail", node.condition, a && ts.isStringLiteralLike(a) ? a.text : null);
      }
    }
    if (ts.isCallExpression(node)) {
      let method = null;
      if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "assert")
        method = node.expression.name.text;
      else if (ts.isIdentifier(node.expression) && node.expression.text === "assert") method = "__bare__";

      if (method && !NOT_A_CLAIM.has(method)) {
        const owner = enclosingTest(node, src, banners, sections);
        const line = src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1;
        if (CONTROL.has(method)) {
          // a throws/rejects IS a claim for block purposes: it constrains control flow.
          claims.push({ file: fileName, line, method, marker: null, owner, cond: `${method}(…)`, floorText: "", allShape: false, precondition: false, anyEvery: false, anyOffender: false });
        } else {
          const c = conditionOf(method, node.arguments, src);
          if (c) {
            const ls = resolveLeaves(c.leaves, consts, src, node.getStart(src));
            const off = ls.find((l) => l.kind === "OFFENDER");
            const shown = c.shown.replace(/\s+/g, " ");
            claims.push({
              file: fileName, line, method, marker: null, owner,
              cond: shown.slice(0, 170),
              floorText: `${shown} ${ls.map((l) => l.text ?? "").join(" ")}`,
              leaves: ls,
              precondition: isPrecondition(ls),
              allShape: ls.length > 0 && ls.every((l) => l.kind === "SHAPE"),
              anyEvery: ls.some((l) => l.kind === "EVERY" && !isNonEmptyLiteralArray(l.recv, consts, src, node.getStart(src))),
              anyOffender: Boolean(off) && isDerived(off.text, consts, src, node.getStart(src)),
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return claims;
}

/** Score a whole set of claims into the three failing classes. */
export function verdict(claims) {
  // 🔴 THE UNIT IS THE MARKER WHERE THERE IS ONE, THE test() BLOCK OTHERWISE (172).
  // A probe is a program, not a suite: it has no `test()` blocks, so 171's block scorer
  // skipped every one of its claims — `if (!c.owner) continue`. 171 §10.2 handed that
  // over as "two instruments, one seam, and nobody has checked the seam is flush",
  // assuming `_population.mjs` covered the other side. IT COVERS A DIFFERENT FAILURE:
  // its VACUOUS proves a family SPOKE. Nothing proved that what a family said could
  // have been different. The marker is exactly the key its manifest is built on, so
  // scoring there makes the two gates meet instead of merely abut.
  const blocks = new Map();
  // 🔴 COUNTED, BECAUSE THE `continue` BELOW IS THE RESOLUTION STEP AND IT WAS SILENT
  // (180). `attributed` is this gate's `judged`: the claims that reached a unit and can
  // therefore reach a verdict. The 3465 - 2993 = 472 that do not are §11.10's orphans,
  // reported since 170 and floored by nothing until now.
  let attributed = 0;
  // 🔴 AND THE TWO POPULATIONS ONLY A CLASSIFIER THAT CLASSIFIED CAN PRODUCE (182).
  // Every number this gate printed until now counts claim SITES — what the FINDER found.
  // Nothing counted a CLASSIFICATION. Measured with a LATE blind (call 1 honest, calls
  // 2..1605 returning `{ kind: "VALUE" }`, which is the answer a healthy leaf gives):
  // the gate printed BYTE-IDENTICAL output and exited 0. `leaves()` blinded the same way,
  // 1216 calls, byte-identical again.
  //
  // A floor cannot sit on `vacuous`, `every` or `offender` — their healthy value is zero,
  // which is 181 §5's problem. But `allShape` and `precondition` are healthy, non-zero,
  // and unreachable without a working classifier: `allShape` needs every leaf of a claim
  // to come back SHAPE, and `precondition` needs every leaf's TEXT to match an outcome
  // flag. Both are 0 under either blind, and neither is the offence.
  let shaped = 0, precondition = 0, bannerAttributed = 0, sectionAttributed = 0;
  for (const c of claims) {
    if (c.allShape) shaped++;
    if (c.precondition) precondition++;
    const k = c.marker ? `${c.file}::${c.marker}` : c.owner ? `${c.file}::${c.owner.line}::${c.owner.name}` : null;
    if (!k) continue;
    attributed++;
    if (!c.marker && c.owner?.banner) bannerAttributed++;
    // 194: its OWN number, for 193's own reason. The orphan ceiling is a subtraction and
    // a subtraction cannot say a path RAN — and now there are two paths under it, so one
    // could die while the other's growth keeps the total healthy. 172 §10.22, again.
    if (!c.marker && c.owner?.section) sectionAttributed++;
    if (!blocks.has(k)) blocks.set(k, { file: c.file, name: c.marker ?? c.owner.name, line: c.marker ? c.line : c.owner.line, marker: Boolean(c.marker), claims: [] });
    blocks.get(k).claims.push(c);
  }
  // 🔴 THE FLOOR IS FILE-SCOPED, NOT BLOCK-SCOPED. `registration.test.ts` floors its
  // population in ONE test and spends four more on offender lists built from the same
  // enumerator; if it collapses, that one test goes red and CI is red — the others ARE
  // defended, just not locally. Scoring per block reported five defended tests as
  // defects. An INLINE floor in the claim's own condition counts too, which is how
  // `assert.ok(seen.length > 0 && seen.every(…))` — the best version of the fix —
  // stopped being reported as the defect.
  const floorFiles = new Set(claims.filter((c) => FLOOR_RE.test(c.floorText || c.cond || "")).map((c) => c.file));
  const hasFloor = (c) => FLOOR_RE.test(c.floorText || c.cond || "") || floorFiles.has(c.file);

  return {
    blocks: blocks.size,
    attributed,
    bannerAttributed,
    sectionAttributed,
    shaped,
    precondition,
    // A unit made ONLY of outcome-flag preconditions is 171 §3's forty, and demanding
    // more of them is how a gate loses its credibility on the first green run. A unit
    // that makes a real claim is judged on the real claims alone.
    vacuous: [...blocks.values()].filter((b) => {
      const real = b.claims.filter((c) => !c.precondition);
      return real.length > 0 && real.every((c) => c.allShape);
    }),
    every: claims.filter((c) => c.anyEvery && !hasFloor(c)),
    offender: claims.filter((c) => c.anyOffender && !hasFloor(c)),
    // 🆕 275 — read off the condition text here rather than flagged at the two claim
    // construction sites, for `hasFloor`'s own reason one line up: it is a question about
    // the WHOLE condition, and the third construction site (the helper-call form) has no
    // condition to ask it of.
    duration: claims.map((c) => ({ c, d: durationClaim(c.cond) })).filter((x) => x.d !== null),
  };
}

/**
 * The OUTPUT collapse, as a pure function of the verdict — 180, answering 179 §11.2.
 *
 * 🔴 A SEPARATE EXPORTED FUNCTION FOR THE REASON `verdict_gate.judge()` IS ONE (174 §8,
 * 176's sweep): a branch that is empty against the healthy tree by construction cannot
 * be reached at all if it is inlined in `main()`, and a floor is empty by construction —
 * the shipped tree is above it or the gate would be red. Taking the population and the
 * floors as parameters is what makes both branches reachable from a fixture.
 *
 * 🔴 AND THAT IS 179 §9's STRUCTURAL POINT ABOUT NARROWINGS, RESTATED FOR FLOORS. The
 * reverse sweep deletes a rule and asks whether the gate still reddens. Deleting a floor
 * cannot redden a tree that is ABOVE it, so `UNIT_FLOOR = 0` is green live, exactly as
 * `G25`–`G28` are. The coverage is in the self-test, by construction, not by accident —
 * and `mutate180.py` says so at the mutant.
 */
export function judgeScope(v, sites, unitFloor = UNIT_FLOOR, attrFloor = ATTRIBUTED_FLOOR, shapedFloor = SHAPED_FLOOR, preFloor = PRECONDITION_FLOOR, orphanCeiling = ORPHAN_CEILING, bannerFloor = BANNER_ATTRIBUTED_FLOOR, sectionFloor = SECTION_ATTRIBUTED_FLOOR) {
  const out = { lines: [], failed: false };
  const say = (s) => out.lines.push(s);
  const orphan = sites - v.attributed;
  say(`TAUT_ATTRIBUTED units=${v.blocks}/${unitFloor} claims=${v.attributed}/${attrFloor} orphan=${orphan}/${orphanCeiling}`);
  // 🔴 193 — THE BANNER PATH, COUNTED AS ITSELF. `bannerAttributed` may be undefined when a
  // self-test drives `judgeScope` with a hand-built verdict; treat that as "not measured"
  // rather than as zero, because a fixture that does not exercise this path must not be
  // able to redden it. The LIVE run always sets it.
  if (v.bannerAttributed !== undefined) {
    say(`TAUT_BANNER_ATTRIBUTED ${v.bannerAttributed}/${bannerFloor}`);
    if (v.bannerAttributed < bannerFloor) {
      out.failed = true;
      say(`🔴 TAUT_BANNER_COLLAPSE ${v.bannerAttributed} < ${bannerFloor} — the section-banner`);
      say(`   fallback stopped attributing. Those claims are not gone, they are ORPHANS again, and`);
      say(`   \`vacuous\`/\`every\`/\`offender\` are scored over attributed units only — so the whole`);
      say(`   live-engine integration suite silently stops being scored, which is the state 193 §9.3`);
      say(`   found and closed. Either the banner idiom changed (update BANNER_RE deliberately) or`);
      say(`   the files grew test() blocks, which switches them off this path by design.`);
    }
  }
  // 🔴 194 — THE EXECUTED-MARKER PATH, COUNTED SEPARATELY FROM THE COMMENT ONE. Same
  // `undefined` treatment and the same argument as the banner floor above, plus one this
  // session earned: there are now TWO fallbacks under a single orphan ceiling, and a
  // subtraction cannot tell them apart. Kill the section path while the banner path keeps
  // growing and the ceiling never notices — which is 193's own reason for the banner
  // floor, applied to the path 193 did not have.
  if (v.sectionAttributed !== undefined) {
    say(`TAUT_SECTION_ATTRIBUTED ${v.sectionAttributed}/${sectionFloor}`);
    if (v.sectionAttributed < sectionFloor) {
      out.failed = true;
      say(`🔴 TAUT_SECTION_COLLAPSE ${v.sectionAttributed} < ${sectionFloor} — the probes' OWN`);
      say(`   \`population.open()\` / \`population.seal()\` markers stopped attributing. These are not`);
      say(`   comments: they are the calls \`_population.mjs\` counts by at runtime, so this path`);
      say(`   going quiet means the static scorer and the live probe now disagree about which`);
      say(`   section a claim belongs to. Either the Population idiom changed (update`);
      say(`   \`populationSections\` deliberately) or a probe grew a \`family()\`, which switches`);
      say(`   it off this path by design — and onto the AST walk, where its claims still count.`);
    }
  }
  // 🔴 191 — THE OTHER SIDE OF THE SUBTRACTION, GOVERNED AT LAST (180 §11.4, carried nine
  // sessions). See `ORPHAN_CEILING`. A rise is not a failure of the code under test; it is
  // a claim nobody attributed, and the only thing that makes attribution a decision rather
  // than a default is that going past this line stops the build.
  if (orphan > orphanCeiling) {
    out.failed = true;
    say(`🔴 TAUT_ORPHAN_RISE ${orphan} > ${orphanCeiling} — ${orphan - orphanCeiling} claim site(s) reached`);
    say(`   neither a marker nor a \`test()\` block, above the count this tree was pinned at.`);
    say(`   \`vacuous\` is scored over the units that survive attribution, so an orphan is a claim`);
    say(`   NO class in this gate can judge — it is counted by the finder and dropped by the`);
    say(`   resolution step. Either give the new claim(s) a unit (a marker, or a \`test()\` block`);
    say(`   around them), or raise ORPHAN_CEILING deliberately with the reading written down.`);
    say(`   🔴 Raising it silently is what this rule exists to stop: the count went 472 → 508`);
    say(`   across nine sessions with every floor in this file green the whole way.`);
  }
  // 🔴 182 — THE CLASSIFIER'S OWN OUTPUT, ON ITS OWN LINE. Everything above counts what
  // the FINDER found; these two count what the CLASSIFIER decided, and `?? 0` is
  // deliberate: a verdict built before 182 reads as a COLLAPSE rather than as an
  // exemption, because an absent population is the loudest case and not the quietest.
  say(`TAUT_CLASSIFIED shaped=${v.shaped ?? 0}/${shapedFloor} precondition=${v.precondition ?? 0}/${preFloor}`);
  for (const [name, got, floor, why] of [
    ["UNITS", v.blocks, unitFloor,
      "the population `vacuous` is scored over. Every FLOORS entry pins claim sites the finder FOUND; this pins the ones that reached a unit, and until 180 attribution could resolve NOTHING while all four held"],
    ["CLAIMS", v.attributed, attrFloor,
      "units can survive intact while each keeps one claim of twenty — a shrink no unit count can see (171 §10.22)"],
    ["SHAPED", v.shaped ?? 0, shapedFloor,
      "🆕 182: the CLASSIFIER stopped classifying. `allShape` needs every leaf of a claim to come back SHAPE, so it cannot be reached without a working `classifyLeaf` and `leaves` — and a late blind on either printed byte-identical output while every floor above held"],
    ["PRECONDITION", v.precondition ?? 0, preFloor,
      "the same collapse read from the other side: a precondition needs every leaf's TEXT to match an outcome flag, so it dies when the leaf walk goes quiet even if the kinds survive"],
  ]) {
    if (got >= floor) continue;
    out.failed = true;
    say(`🔴 TAUT_ATTRIBUTION_COLLAPSE ${name} ${got} < ${floor} — ${why}.`);
    say(`   "N claim sites, none vacuous" is literally true of zero of them (169 §4).`);
  }
  return out;
}

/**
 * 🔴 THE WIRE, AS A FUNCTION, BECAUSE THE SWEEP CAUGHT IT — 180, and `verdict_gate.mjs`
 * already carries the identical fix for the identical reason.
 *
 * The first draft of §18 read `if (scope.failed) failed = true;` inline in `main()`.
 * `mutate180.py`'s G5 deletes that line and G6 stops `judgeScope` running at all, and
 * BOTH stayed GREEN — because on a healthy tree `scope.failed` is already false, so the
 * term it is ORed with is never satisfied apart and the whole wire can be removed
 * invisibly. That is 174 §8 and 176's G3 for the third time: A COLLECTOR ONLY EVER
 * ASSERTED EMPTY IS A COLLECTOR NOBODY HAS PROVED COLLECTS.
 *
 * `verdict_gate.combine(r, d)` exists word for word for this — "Inlined in `main()`,
 * dropping `|| d.failed` left the gate GREEN." Taking both verdicts as parameters is
 * what makes the second one reachable at all.
 */
export function combineFailed(failedSoFar, scope) {
  return failedSoFar || scope.failed;
}

/**
 * The duration verdict — 🆕 275, `duration-assertions-unguarded` (273).
 *
 * 🔴 A SEPARATE FUNCTION FOR `judgeScope`'s REASON AND `combineFailed`'s: both of its
 * failing branches are empty against the shipped tree by construction — the floor is
 * below the live count and the offence list is empty — so neither can be reached from
 * `main()` at all. Taking the population and the floor as parameters is what lets the
 * self-test drive each of them.
 */
export function judgeDuration(rows, floor = DURATION_FLOOR) {
  const out = { lines: [], failed: false };
  const say = (s) => out.lines.push(s);
  const lower = rows.filter((x) => x.d.lower);
  const guarded = lower.filter((x) => x.d.guarded);
  const bare = lower.filter((x) => !x.d.guarded);
  say(`TAUT_DURATION  sites=${rows.length}/${floor} lower=${lower.length} guarded=${guarded.length}`);
  if (rows.length < floor) {
    out.failed = true;
    say(`🔴 TAUT_DURATION_COLLAPSE ${rows.length} < ${floor} — either the elapsed assertions were`);
    say(`   deleted, or this reader stopped recognising the idiom. The offence it reports is zero on a`);
    say(`   healthy tree, so the site count is the only number that can tell those two apart.`);
  }
  for (const { c } of bare) {
    out.failed = true;
    say(`🔴 TAUT_DURATION_UNGUARDED ${c.file.replace(ROOT, "")}:${c.line} "${c.owner?.name ?? c.marker ?? "(module scope)"}"`);
    say(`   ${c.cond}`);
    say(`   a LOWER bound on an elapsed reading with no slack term. Node schedules timers against libuv's`);
    say(`   loop clock, so a \`setTimeout(n)\` can return with fewer than n milliseconds on every clock a`);
    say(`   test can read — 273 measured 24 early returns in 2000 rounds and \`main\` went red on one of`);
    say(`   them. Subtract a named tolerance (\`TIMER_SLACK_MS\` in \`test/helpers/tcp.ts\`).`);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────── main --
function main() {
  let all = [], failed = false;
  for (const [dir, floor] of Object.entries(FLOORS)) {
    const d = join(ROOT, dir);
    // 🔴 174: `!f.startsWith("_")` WAS A SILENT EXEMPTION, AND IT COVERED THE GATES.
    // The prefix is right for the HELPER MODULES — `_population.mjs`, `_path_ledger.mjs`
    // and `_workspace.mjs` are libraries, not suites, and have no claims to classify.
    // But their SELF-TESTS carry the same prefix and are nothing BUT claims: they are
    // the gates `instrument_gate.py` points its blinding harness at. Measured before
    // the change, by admitting them: +127 claim sites across 3 files the classifier had
    // never read — and TAUT_VACUOUS went 0 -> 1, on `PROXY_PASSES_NON_METHODS` in
    // `_population.selftest.mjs`, a claim that was green over a real defect in the
    // instrument fourteen live probes report through.
    //
    // 🔴 AND NOTE WHAT THE TWO EXCLUSIONS COST DIFFERENTLY. NO_CLAIMS_EXPECTED costs a
    // written reason; a filename prefix costs nothing and is invisible in the output.
    // The gate's own scope line read `files=21` either way. Silent exemptions are the
    // shape this gate exists to catch, one level out from the claims it reads.
    // 175: `.` is a rostered directory now, and a DIRECTORY whose name ends in .ts or
    // .mjs would otherwise be read as a file and throw EISDIR.
    //
    // 🆕 183: AND 174 FIXED THE INSTANCE, NOT THE CLASS. The filter it left behind read
    // `!f.startsWith("_") || f.endsWith(".selftest.mjs")` — a whitelist keyed on a NAMING
    // CONVENTION, so every underscore-prefixed file shape that is not `.selftest.mjs` is
    // exempt BY CONSTRUCTION and the scope line reads `files=21` either way. 183 added
    // `_caller_shape.harness.mjs`, a file that is nothing but claims, and it would have
    // been swept by nothing while the gate printed ok — which is the identical defect one
    // gate over: `floor_pin_gate.py`'s DISCOVER walk was scoped to `.mjs` rather than to
    // "is a floor", so a floor written in Python sat outside it (182 §9).
    //
    // 🔴 THE FIX IS TO INVERT IT, NOT TO ADD A SUFFIX. Sweep every .mjs/.ts, and let the
    // only exemption be the one that costs a written reason — which the comment above
    // already said was the difference that mattered and which NO_CLAIMS_EXPECTED already
    // is. The four helper MODULES land there now, each quoting its own header. A rule
    // scoped to the property cannot rot in the direction a rule scoped to a name does.
    const files = readdirSync(d).filter(
      (f) => /\.(mjs|ts)$/.test(f) && statSync(join(d, f)).isFile(),
    );
    let mine = [];
    const empty = [];
    for (const f of files) {
      const got = analyze(join(d, f), readFileSync(join(d, f), "utf8"));
      if (got.length === 0 && !(f in NO_CLAIMS_EXPECTED)) empty.push(f);
      mine = mine.concat(got);
    }
    all = all.concat(mine);
    const ok = mine.length >= floor;
    console.log(`TAUT_SCOPE ${dir.padEnd(17)} files=${String(files.length).padStart(3)} claim_sites=${String(mine.length).padStart(5)} floor=${floor} ${ok ? "ok" : "🔴 BELOW FLOOR"}`);
    if (!ok) {
      console.log(`🔴 TAUT_SCOPE_COLLAPSE ${dir}: ${mine.length} < ${floor}. Either coverage was deleted, or the classifier stopped`);
      console.log(`   recognising this suite's assertions — which is exactly how taut169 reported a clean unit suite it had never read.`);
      failed = true;
    }
    // 🔴 AND THE DIRECTORY TOTAL IS ITSELF AN AGGREGATE (172). 171 §10.22: "any scope
    // assertion over more than one population needs one number per population." The
    // line above sums twenty-one files; a file that fell to zero hides behind the other
    // twenty exactly as `test` hid behind `test-integration`. Measured on the tree 171
    // shipped: NINE of twenty-one at zero under a floor that read `ok`.
    const fileFloor = FILE_FLOORS[dir];
    console.log(`TAUT_SCOPE_FILES ${dir.padEnd(11)} silent=${empty.length} exempt=${files.filter((f) => f in NO_CLAIMS_EXPECTED).length} read=${files.length}/${fileFloor}`);
    // 🆕 183 — THE FILE COUNT, FLOORED. See FILE_FLOORS. A directory walk that stopped
    // reading files reports the same `silent=0` as one that read them all and found
    // claims in every one; only the count can tell those apart.
    if (files.length < fileFloor) {
      failed = true;
      console.log(`🔴 TAUT_SCOPE_FILES_COLLAPSE ${dir}: ${files.length} file(s) read, floor is ${fileFloor}.`);
      console.log(`   Either sources were deleted, or the walk's filter stopped admitting them — and the second`);
      console.log(`   is what a filename-prefix exemption did here, unseen, from 174 to 183.`);
    }
    // 🔴 AND AN EXEMPTION THAT IS NO LONGER EARNED IS A PLACE TO HIDE. Check 16 in
    // `contract_check.py` fails both directions for this reason; so does this. A file
    // rostered as silent that has since grown claims keeps buying a silence it does not
    // need, and the next file to take that name inherits it.
    for (const f of files) {
      if (!(f in NO_CLAIMS_EXPECTED)) continue;
      if (analyze(join(d, f), readFileSync(join(d, f), "utf8")).length === 0) continue;
      failed = true;
      console.log(`🔴 TAUT_ROSTER_STALE ${dir}/${f} is on NO_CLAIMS_EXPECTED but DOES make claims now — remove it.`);
    }
    for (const f of empty) {
      failed = true;
      console.log(`🔴 TAUT_FILE_SILENT ${dir}/${f} — not one claim site the classifier can read.`);
      console.log(`   Either this file asserts nothing, or the finder does not recognise the idiom it asserts in.`);
      console.log(`   Both are the failure 171 §2 named; neither is visible in the directory total above.`);
    }
  }

  const v = verdict(all);
  const orphan = all.filter((c) => !c.marker && !c.owner).length;
  console.log(`TAUT_CLAIM_SITES ${all.length} across ${v.blocks} unit(s) — ${orphan} attributed to neither a test() block nor a marker`);
  // 🔴 THE OUTPUT FLOOR (180). Printed and enforced here; judged in `judgeScope()` so a
  // fixture can drive it from below, which the live tree cannot do.
  const scope = judgeScope(v, all.length);
  for (const l of scope.lines) console.log(l);
  failed = combineFailed(failed, scope);
  console.log(`TAUT_VACUOUS   ${v.vacuous.length}`);
  console.log(`TAUT_EVERY     ${v.every.length}`);
  console.log(`TAUT_OFFENDER  ${v.offender.length}`);
  // 🆕 275 — `duration-assertions-unguarded` (273). Judged in `judgeDuration` for the
  // reason `judgeScope` is a function: the floor's failing branch is unreachable on a
  // tree that is above it, so a fixture has to be able to drive it from below.
  // 🔴 `?? []` FOR THE `?? {}` REASON THIS FILE ALREADY CARRIES: a blind on `verdict`
  // returns the contract's empty, and a field this call reads without a default turns
  // that blind into a TypeError — RED WITHOUT A VERDICT, which proves that JavaScript
  // throws on `undefined` and not that the gate's floor bites (`CRASH_CEILING`, 275).
  const dur = judgeDuration(v.duration ?? []);
  for (const l of dur.lines) console.log(l);
  failed = combineFailed(failed, dur);

  for (const b of v.vacuous) {
    failed = true;
    console.log(`\n🔴 TAUT_VACUOUS ${b.file.replace(ROOT, "")}:${b.line} "${b.name}"`);
    console.log(`   every one of its ${b.claims.length} assertion(s) is satisfied by a wrong answer of the right type:`);
    for (const c of b.claims) console.log(`     L${c.line} ${c.marker ? c.method : `assert.${c.method}`} ${c.cond}   [${c.leaves.map((l) => l.why).join(" | ")}]`);
  }
  for (const c of v.every) {
    failed = true;
    console.log(`\n🔴 TAUT_EVERY ${c.file.replace(ROOT, "")}:${c.line} "${c.owner?.name ?? "(module scope)"}"`);
    console.log(`   ${c.cond}\n   .every() is true of the empty collection — assert a length in the same file.`);
  }
  for (const c of v.offender) {
    failed = true;
    console.log(`\n🔴 TAUT_OFFENDER ${c.file.replace(ROOT, "")}:${c.line} "${c.owner?.name ?? "(module scope)"}"`);
    console.log(`   ${c.cond}\n   nothing in this file floors the population that was filtered — an enumeration`);
    console.log(`   returning nothing satisfies this. Assert its size against a literal (170 §4 SCOPE).`);
  }

  if (failed) { console.log(`\nTAUT_GATE 🔴 FAILED`); process.exit(1); }
  console.log(`\nTAUT_GATE ok — ${all.length} claim sites, ${v.attributed} of them attributed across ${v.blocks} blocks, none vacuous`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("tautology_gate.mjs")) main();

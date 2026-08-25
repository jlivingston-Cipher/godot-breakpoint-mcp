#!/usr/bin/env node
// verdict_gate.mjs — session 175. A SCRIPT THAT RECORDS A VERDICT MUST READ IT.
//
// 🔴 WHY THIS EXISTS. The tautology gate's roster named `test` and `test-integration`.
// Asking 174 §11.3's question properly — which directories does the sweep not enter? —
// turned up `host/scripts` (the gate's own self-test, 67 claims) and the HOST ROOT,
// twelve live drivers. The classifier read the host root as silent, and 171 §2 says a
// silent file is either a file that asserts nothing or a file whose idiom the finder
// cannot read. Here it was the FIRST, and the files it was true of were these:
//
//   demo_verify_live.mjs        "asserts against the LIVE game" — never read `.ok`
//   cs_demo_verify_live.mjs     the C# mirror, same two verdicts, same exit 0
//   cs_demo_verify_live_gif.mjs ran both passes, held {a1,a2} from each, and printed
//                               "buggy FAILS both · fixed PASSES both — automation
//                               proves the fix" as a STRING LITERAL
//
// Each called `runtime_assert_node_state` / `runtime_assert_screen_text`, wrote the
// reply to a transcript, and exited 0 regardless. `demo_verify_buggy.json` on disk
// holds `ok: false` twice — that run exited 0. The word "assert" lived in the STEP
// LABEL. Two siblings in the same directory (`verify_family_s102_live.mjs`,
// `verify_shot_editor_live.mjs`) already did it honestly, so the correct shape was
// sitting next to the broken one the whole time.
//
// 🔴 AND THE TAUTOLOGY GATE CANNOT PIN THIS, WHICH IS THE POINT (174 §3's division of
// labour). That gate classifies CONDITIONS. These files' failure was that there was no
// condition to classify: the verdict was fetched, recorded and dropped. A gate for the
// absence of a check cannot be the gate that grades checks.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// fileURLToPath, not .pathname — the repo lives under "Godot MCP" (174 §10).
const ROOT = fileURLToPath(new URL("../", import.meta.url));

// The directories whose scripts drive a live engine and report a verdict.
//
// 🔴 176 MEASURED 175 §11.3's QUESTION AND THE ANSWER IS THAT THIS STAYS AT THE HOST
// ROOT — a documented divergence from the discard half below, which walks everything.
// `test-integration/` holds five probes that drive a `runtime_assert_*` tool, and every
// one of them is HONEST. But their honesty is throw-shaped: they escape through
// `node:assert`, which the runner turns into a nonzero exit. `exitsNonZero` looks for a
// COMPUTED `process.exit`, deliberately, because a literal `exit(1)` in a crash handler
// was present in all three of 175's broken drivers and counting it would have greened
// every one. Admitting test-integration to THIS half would therefore red five healthy
// files — including `verification-family.integration.mjs`, which checks forty verdicts.
//
// 🔴 AND THE FILE IS THE WRONG UNIT THERE ANYWAY, WHICH IS THE REAL FINDING. A probe
// making a hundred assertions satisfies "reads a verdict somewhere and can escape"
// however many replies it drops. That is what `discarded()` below is for, and it is why
// the answer to "extend the roster?" was a second question rather than a bigger roster.
const DIRS = ["."];

// 🔴 A LITERAL FLOOR ON THE SUBJECT COUNT, FOR 170 §4's REASON. This gate derives its
// own population by scanning for a shape; a scan that matches nothing reports zero
// offenders and passes. The floor is the collapse detector, not the count.
//
// 🔴 AND IT WAS WRITTEN AT 5 FROM A GUESS AND CAUGHT ITSELF ON THE FIRST RUN — 174 §8's
// H7 in this session's own code. The real population is FOUR:
// `verify_shot_editor_live.mjs` drives `screenshot_editor`, not a verdict tool, and is
// covered by the tautology gate through its `pass/fail` ternaries;
// `cs_demo_verify_replay.mjs` re-runs nothing at all. A floor above the truth is a gate
// that reds on a healthy tree, and a gate that reds on good work gets deleted.
//
// 🔴 EXPORTED BECAUSE THE REVERSE SWEEP FOUND IT UNPINNED (175's G9). Setting it to 0
// left every self-test case green: the collapse cases pass an explicit floor, and the
// live-tree case reads whatever this says. A literal that no claim names is a literal
// anyone can move — which is the whole failure this gate is an instance of.
export const SUBJECT_FLOOR = 4;

// A tool whose reply IS a verdict — the surface whose `ok` field is the answer.
const VERDICT_TOOL = /assert/i;

// 🔴 EXEMPTIONS COST A WRITTEN REASON, AND 174 §5 IS WHY THERE IS NO PREFIX RULE HERE.
// That session found a `_` filename prefix buying a silent exemption for 127 claim
// sites. An exemption that costs nothing to write is an exemption nobody re-reads —
// so this roster is keyed on the FILENAME and its value is prose a reviewer must
// disagree with in words. An entry that stops being true fails check `STALE` below.
// 🔴 IT IS EMPTY, AND THE FIRST ENTRY WRITTEN INTO IT WAS WRONG. 175 rostered
// `cs_demo_verify_replay.mjs` — a GIF renderer that reads a captured transcript — and
// the DEAD-ENTRY check below immediately reported it, because that file drives no
// verdict tool and so was never a subject to exempt. An exemption for something that
// was never in scope reads on every re-reading as a considered decision about a real
// case. That is 174's D5 corollary, and this roster caught its own instance of it
// before the commit. The mechanism is exercised by `verdict_gate.selftest.mjs`, not by
// a live entry, so it is proven without anything being excused.
const NOT_A_VERDICT = {};

/** Read one source. Exported so the self-test can drive the SCANNER with no files. */
export function inspect(file, text) {
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const tools = new Set();
  let readsVerdict = false;
  let exitsNonZero = false;
  let labelsAssert = false;

  const visit = (n) => {
    // A call whose first string literal names a verdict-bearing tool.
    if (ts.isCallExpression(n)) {
      for (const a of n.arguments) {
        if (ts.isStringLiteralLike(a) && VERDICT_TOOL.test(a.text) && /^\w+$/.test(a.text)) tools.add(a.text);
        if (ts.isStringLiteralLike(a) && /^assert\b/i.test(a.text)) labelsAssert = true;
      }
    }
    // 🔴 READING `.ok` IS NOT ENOUGH ON ITS OWN, AND cs_demo_verify_live_gif.mjs IS WHY.
    // It read `.ok` into a1/a2, printed them, wrote them to JSON, RETURNED them — and
    // exited 0. A value that is read and then dropped is not a check; it is a display.
    // Both halves are required: the verdict must be read AND must be able to change the
    // exit status of the process that read it.
    if (ts.isPropertyAccessExpression(n) && n.name.text === "ok") readsVerdict = true;
    if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression ?? {}) && n.argumentExpression.text === "ok") readsVerdict = true;

    if (ts.isCallExpression(n) && n.expression.getText(src) === "process.exit") {
      const a = n.arguments[0];
      // `process.exit(1)` inside `main().catch(...)` is a CRASH handler, not a verdict.
      // It is present in every one of these files, including the three that were broken,
      // so counting it would make the gate green on all of them. Only an exit whose
      // status is COMPUTED — `exit(failures.length ? 1 : 0)` — is a verdict reaching the
      // shell. A bare `exit(1)` in an abort path is not enough either: it fires when the
      // engine never started, which is exactly the run that asserted nothing.
      if (a && !ts.isNumericLiteral(a)) exitsNonZero = true;
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return { tools: [...tools].sort(), readsVerdict, exitsNonZero, labelsAssert };
}

// ── 176: THE SECOND QUESTION, AND IT NEEDS A DIFFERENT UNIT ──────────────────────────
//
// 🔴 `inspect()` above asks a per-FILE question: does this file read a verdict ANYWHERE,
// and can it exit on it? That is the right unit for the host root, whose drivers push
// every reply into a recorder and check the whole run at the end. It is the WRONG unit
// for `test-integration/`, where each reply is checked at its own site by node:assert —
// a probe making a hundred assertions passes the file-level test trivially even if ONE
// call site drops its verdict. 175 §11.3 handed over "test-integration holds fourteen
// live probes; do any of THEM fetch a verdict they do not read?" Measuring it found
// exactly that shape, once:
//
//   inject-input.integration.mjs, section 7 "leave it pristine"
//     await call("runtime_assert_scene_structure", { expect: [{ path: ".", type: "Node2D" }] });
//     population.seal("INPUT_LIVE_PRISTINE", `ok … fixture intact`);
//
//   `call()` throws only on `isError`, and a structure mismatch is a SUCCESSFUL reply
//   carrying `ok: false` — so a fixture that had stopped being a Node2D sealed
//   "fixture intact" anyway, from a string literal, in the step #146's rule exists for.
//
// 🔴 AND THE FIRST INSTRUMENT WRITTEN TO ANSWER THAT QUESTION INVENTED SEVENTEEN OTHERS.
// Asking "is `.ok` read?" per call site flagged 17 sites in test-integration. Reading
// them showed almost every one was an HONEST check on a DIFFERENT field: `.matches` is
// the measurement for `runtime_assert_screen_text` (`min_count` changes the verdict, not
// the count), `.isError` is the whole point of the `raw()` error-path cases, and the
// three `boot` guards read `boot.structuredContent?.ok` — a nested access the test could
// not see. That is 175 §3's OWN defect committed by 175's own follow-up question:
// matching a check by the NAME of a field rather than by what the reply DOES.
//
// 🔴 SO THE ONLY CLASSIFICATION THAT SURVIVES EVERY IDIOM IS THE ABSENCE OF A BINDING.
// A reply that is never bound cannot be read by node:assert, by an accumulator, by a
// computed exit or by anything else — no field name and no escape convention has to be
// guessed, so the false-positive rate is structurally zero rather than merely low. What
// it costs is everything it does NOT catch: a reply that is bound and then ignored is
// invisible here, and that is the honest trade. This half finds the verdict nobody KEPT;
// `inspect()` finds the verdict nobody READ.
export function discarded(file, text) {
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const sites = [];
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const a0 = n.arguments[0];
      // The SAME predicate `inspect()` uses. Two spellings of "a verdict-bearing tool"
      // would be two populations, and the one nobody re-read would drift.
      if (a0 && ts.isStringLiteralLike(a0) && VERDICT_TOOL.test(a0.text) && /^\w+$/.test(a0.text)) {
        // Climb past `await`, parentheses and `void` to the node that actually carries
        // the value. `void` is in that list on purpose: it is the one operator whose
        // whole meaning is "discard this", so stopping the climb there would classify
        // the most explicit possible discard as a reply somebody kept.
        let v = n;
        while (v.parent && (ts.isAwaitExpression(v.parent) || ts.isParenthesizedExpression(v.parent)
               || (ts.isVoidExpression(v.parent)))) v = v.parent;
        const line = src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1;
        // 🔴 THE WHOLE TEST. If the value-carrying node's parent is the STATEMENT, the
        // reply went nowhere: not into a binding, not into an argument, not into a
        // return, not into a condition. Everything else is kept by somebody.
        sites.push({ file, line, tool: a0.text, dropped: ts.isExpressionStatement(v.parent) });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return sites;
}

// 🔴 ONE RECURSIVE WALK, AND NO DIRECTORY ROSTER AT ALL. 175 shipped this gate with
// `DIRS = ["."]` in the very session that found two directory rosters hiding real
// defects (175 §11.22), and the first draft of THIS half repeated it a third time:
// `[".", "scripts", "test-integration"]` over a recursive walk double-counted every
// site under the last two, reporting 109 sites where there are 61 and the one real
// defect TWICE. A roster whose entries overlap is a roster nobody re-read.
//
// So there is no roster. The walk starts at `host/` and descends, and the only thing it
// will not enter is named below — with a written reason, because 174 §5 found a `_`
// filename prefix buying a silent exemption for 127 claim sites and the lesson is that
// an exclusion costing nothing to write is an exclusion nobody re-reads.
//
// 🔴 AND IT DESCENDS BECAUSE `readdirSync` DOES NOT. 175 §4 found `test/helpers` unswept
// INSIDE a rostered directory for exactly that reason — the third spelling of one
// mistake in a single session. `DISCARD_DIRS_SEEN` below pins that this walk reaches
// more than one directory, so a walk that quietly stopped descending goes red rather
// than reporting a clean subset.
export const DISCARD_SKIP = {
  node_modules: "third-party sources; nothing here is ours to fix",
  dist: "compiled output of host/src — the .ts is the instrument, and it drives no probe",
  "dist-test": "compiled test output, same reason",
  _to_delete: "the bridge-scratch convention (129 §7). Scratch may evaporate between sessions",
  addon: "gitignored build output that `npm run stage-addon` recreates by copying verbatim",
  ".godot": "engine cache, not source",
};

function walkMjs(abs, rel = "") {
  const out = [];
  for (const e of readdirSync(join(abs, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (Object.hasOwn(DISCARD_SKIP, e.name)) continue;
      out.push(...walkMjs(abs, r));
    } else if (/\.mjs$/.test(e.name)) out.push(r);
  }
  return out;
}

// 🔴 A FLOOR ON THE SITES EXAMINED, not on the offenders found. A finder that matches
// nothing reports zero dropped replies and passes — 170 §4, and the shape this whole
// gate is an instance of. Measured at 61 on the tree this ships with.
export const DISCARD_SITE_FLOOR = 55;
// 🔴 AND A FLOOR ON THE DIRECTORIES REACHED, which is the OTHER way this collapses. A
// site floor alone stays green on a walk that stopped descending as long as the host
// root still carries enough calls — and the host root carries 13 of the 61.
export const DISCARD_DIR_FLOOR = 2;
// 🆕 209 — AND A THIRD, BECAUSE THE FIRST TWO WERE TWO FILES FROM SILENCE AND NOBODY
// COULD HAVE SEEN IT. `instrument_gate.py` blinds `discarded()` from its SECOND call
// onwards to a healthy-looking single site, modelling a finder that stops finding and
// reports a plausible placeholder. That blind produces roughly ONE SITE PER .mjs FILE
// WALKED, so `DISCARD_SITE_FLOOR` catches it only while the tree has FEWER WALKABLE
// FILES THAN THE FLOOR. Measured this session: main reddened at 53 fabricated sites
// against a floor of 55, and adding two unrelated files to `host/scripts` — neither
// carrying a single verdict call — took the fabricated total to 55 and the gate went
// GREEN. 🔴 THE FLOOR'S BITE WAS AN ACCIDENT OF AN UNRELATED POPULATION'S SIZE, and it
// had five files of margin left.
//
// 🔴 SO THIS ONE IS SCALE-FREE, WHICH IS THE WHOLE POINT. The real population is
// CONCENTRATED — 61 sites live in NINE files and forty of them in one — while a
// fabricated one is UNIFORM, exactly one per file however many files there are. Flooring
// the busiest file separates those two shapes at any tree size, and it also catches the
// walk that stops descending into the one file that carries most of the population.
export const DISCARD_BUSIEST_FLOOR = 30;

export function scanDiscarded(root = ROOT) {
  const sites = [];
  for (const f of walkMjs(root)) sites.push(...discarded(f, readFileSync(join(root, f), "utf8")));
  return sites;
}

/** The discard judgement, as a pure function of its population (174 §8's reason). */
export function judgeDiscarded(sites, floor = DISCARD_SITE_FLOOR, dirFloor = DISCARD_DIR_FLOOR,
                               busiestFloor = DISCARD_BUSIEST_FLOOR) {
  const out = { lines: [], failed: false };
  const say = (s) => out.lines.push(s);
  const dropped = sites.filter((s) => s.dropped);
  const dirs = new Set(sites.map((s) => (s.file.includes("/") ? s.file.slice(0, s.file.lastIndexOf("/")) : ".")));
  // 🆕 209 — THE SHAPE OF THE POPULATION, not its size. See DISCARD_BUSIEST_FLOOR.
  const perFile = new Map();
  for (const s of sites) perFile.set(s.file, (perFile.get(s.file) ?? 0) + 1);
  const busiest = perFile.size ? Math.max(...perFile.values()) : 0;

  say(`VERDICT_DISCARD sites=${sites.length} floor=${floor} dirs=${dirs.size}/${dirFloor}`
    + ` busiest=${busiest}/${busiestFloor} in ${perFile.size} file(s) dropped=${dropped.length}`);
  if (busiest < busiestFloor) {
    say(`🔴 VERDICT_DISCARD_SHAPE_COLLAPSE busiest file holds ${busiest} < ${busiestFloor} site(s)`);
    say(`   across ${perFile.size} file(s). The real population is CONCENTRATED — forty of`);
    say(`   the sixty-one live in one probe — and a finder that has gone blind reports a`);
    say(`   UNIFORM one-per-file instead. The site floor cannot tell those apart once the`);
    say(`   tree has more .mjs files than the floor, which it was five files away from.`);
    out.failed = true;
  }
  if (dirs.size < dirFloor) {
    say(`🔴 VERDICT_DISCARD_DIRS_COLLAPSE ${dirs.size} < ${dirFloor} — the walk reached ${[...dirs].join(", ") || "nothing"}.`);
    say(`   readdirSync is not recursive (175 §4); a walk that stops descending reports a`);
    say(`   clean SUBSET, and a subset that passes is indistinguishable from a clean tree.`);
    out.failed = true;
  }
  if (sites.length < floor) {
    say(`🔴 VERDICT_DISCARD_SCOPE_COLLAPSE ${sites.length} < ${floor} — either the probes stopped`);
    say(`   driving verdict tools, or this scan stopped recognising the call. Zero dropped`);
    say(`   replies out of zero sites examined is not a clean tree.`);
    out.failed = true;
  }
  for (const d of dropped) {
    out.failed = true;
    say(`\n🔴 VERDICT_DISCARDED ${d.file}:${d.line}  ${d.tool}`);
    say(`   the reply is not even bound, so no idiom in this repo can be reading it —`);
    say(`   not node:assert, not an accumulator, not a computed exit. A verdict tool`);
    say(`   called for its side effects is a verdict tool called for nothing: these`);
    say(`   tools have none. Bind it and assert on it, or call something that is not`);
    say(`   an assertion.`);
  }
  say(out.failed ? `\nVERDICT_DISCARD 🔴 FAILED` : `VERDICT_DISCARD ok — ${sites.length} site(s), every reply is kept by somebody`);
  return out;
}

/**
 * The whole judgement, as a pure function of (subjects, roster). Exported so the
 * self-test can drive it with populations the tree cannot produce on demand.
 *
 * 🔴 173's G3, AND 174 §8 HIT IT AGAIN: a collector that only ever gets asserted EMPTY
 * is a collector whose filter can be deleted invisibly. Every branch below — unread,
 * displayed-but-dropped, stale exemption, dead exemption, collapsed scope — is empty
 * against the real tree by design, because the tree is healthy. Inlined here they
 * would be untestable; taking the populations as parameters is what makes them
 * reachable at all.
 */
export function judge(subjects, roster = NOT_A_VERDICT, floor = SUBJECT_FLOOR) {
  const out = { lines: [], failed: false };
  const say = (s) => out.lines.push(s);

  say(`VERDICT_GATE subjects=${subjects.length} floor=${floor}`);
  if (subjects.length < floor) {
    say(`🔴 VERDICT_SCOPE_COLLAPSE ${subjects.length} < ${floor} — either the drivers were deleted, or`);
    say(`   this scan stopped recognising them. A gate that found nothing is not a gate that passed.`);
    out.failed = true;
  }

  // 🔴 AN EXEMPTION FOR A FILE THAT IS NOT A SUBJECT. Caught its own first entry (see
  // NOT_A_VERDICT). This is the shape a stale-roster check normally misses: the entry
  // is not merely no-longer-earned, it was never exercised, so no check that inspects
  // the excused FILE can ever reach it. Only the roster-vs-population comparison can.
  const names = new Set(subjects.map((s) => s.f));
  for (const k of Object.keys(roster)) {
    if (names.has(k)) continue;
    say(`🔴 VERDICT_ROSTER_DEAD ${k} is excused but is not a subject — it drives no verdict tool.`);
    say(`   An exemption nothing exercises reads as a decision about a real case. Delete it.`);
    out.failed = true;
  }

  for (const s of subjects) {
    const exempt = roster[s.f];
    const honest = s.readsVerdict && s.exitsNonZero;
    if (exempt) {
      if (honest) {
        say(`🔴 VERDICT_ROSTER_STALE ${s.f} is exempt but DOES read a verdict and exit on it — remove the entry.`);
        out.failed = true;
      } else say(`   exempt  ${s.f} — ${exempt.slice(0, 72)}…`);
      continue;
    }
    if (honest) { say(`   ok      ${s.f}  tools=${s.tools.join(",")}`); continue; }
    out.failed = true;
    say(`\n🔴 VERDICT_UNREAD ${s.f}`);
    say(`   drives ${s.tools.join(", ")}${s.labelsAssert ? ' and labels a step "assert…"' : ""}`);
    say(`   reads the verdict: ${s.readsVerdict}   ·   can exit on it: ${s.exitsNonZero}`);
    say(`   ${s.readsVerdict
      ? "it READS the verdict and drops it — a displayed value is not a check (cs_demo_verify_live_gif.mjs, 175)."
      : "it records the verdict and never reads it. The word \"assert\" is in the step label only."}`);
    say(`   The honest shape is in this directory already: verify_family_s102_live.mjs ends`);
    say(`   \`process.exit(failures.length ? 1 : 0)\`. Either match it, or add a written reason`);
    say(`   to NOT_A_VERDICT — one a reviewer has to disagree with in words.`);
  }
  say(out.failed
    ? `\nVERDICT_GATE 🔴 FAILED`
    : `VERDICT_GATE ok — ${subjects.length} driver(s), every recorded verdict is read and can redden the run`);
  return out;
}

/** Scan the real tree. Exported so the self-test can check the SCANNER separately. */
export function scan() {
  const subjects = [];
  for (const dir of DIRS) {
    const d = join(ROOT, dir);
    for (const f of readdirSync(d).filter((x) => /\.mjs$/.test(x)).sort()) {
      const got = inspect(f, readFileSync(join(d, f), "utf8"));
      if (!got.tools.length) continue;          // drives no verdict-bearing tool
      subjects.push({ f, ...got });
    }
  }
  return subjects;
}

/**
 * The two halves combined.
 *
 * 🔴 BOTH ALWAYS RUN, AND NEITHER SHORT-CIRCUITS THE OTHER. A gate that stops at its
 * first failing half reports one defect and hides the rest of the population behind it —
 * the reader then fixes the named file and reads the next green run as clean.
 *
 * 🔴 AND IT IS A SEPARATE EXPORTED FUNCTION BECAUSE 176's REVERSE SWEEP CAUGHT THE
 * WIRING. Inlined in `main()`, dropping `|| d.failed` left the gate GREEN: the shipped
 * tree has nothing dropped, so the discard half never fails and the term it was ORed
 * with could be deleted invisibly. That is 174 §8 and 175's G3 a third time — two
 * conditions never satisfied apart in the live population. Taking both verdicts as
 * parameters is what makes the second one reachable at all.
 */
export function combine(r, d) {
  return { lines: [...r.lines, ...d.lines], failed: r.failed || d.failed };
}

export function main() {
  const c = combine(judge(scan()), judgeDiscarded(scanDiscarded()));
  for (const l of c.lines) console.log(l);
  if (c.failed) process.exit(1);
}

if (process.argv[1]?.endsWith("verdict_gate.mjs")) main();

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

/** Every function-shaped declaration in a source, by name. */
function declarations(src) {
  const out = new Map();
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) out.set(n.name.text, n);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
        && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)))
      out.set(n.name.text, n.initializer);
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

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
  return { tools: [...tools].sort(), readsVerdict, exitsNonZero, labelsAssert, decls: declarations(src) };
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

export function main() {
  const r = judge(scan());
  for (const l of r.lines) console.log(l);
  if (r.failed) process.exit(1);
}

if (process.argv[1]?.endsWith("verdict_gate.mjs")) main();

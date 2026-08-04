#!/usr/bin/env node
// seal_order_gate.mjs — session 185. A MARKER MUST NOT BE WRITTEN ABOVE THE CLAIMS IT
// DESCRIBES.
//
// 🔴 WHY THIS EXISTS. `Population.seal(marker)` attributes every claim made since the
// PREVIOUS seal. So a marker written above its own assertions owns the section before it
// and hands its own to the next one. 184 §5 measured four instances, all in
// `runtime-peers.integration.mjs`, with a 40-line regex scan that said in its own
// docstring that it was heuristic. Nothing goes UNATTRIBUTED when this happens, so
// `report()`'s gate 6 — the unsealed count 184 added — is blind to it by construction.
// What it costs is the report's aim: delete section 5's three claims and it is
// `F6_PEERS_CEILING` that reads vacuous, one section past the one that actually broke.
//
// 🔴 AND NO RUNTIME GATE CAN SEE IT EITHER, WHICH IS THE FINDING THAT DECIDED THE SHAPE.
// A seal drains what has ALREADY happened, so every claim it takes preceded it in time;
// the defect is entirely in the SOURCE's reading. 185 asked the obvious follow-up anyway
// — could a call-site reading make it exact? — and measured the answer instead of
// assuming it (`host/_to_delete/sealsite185.mjs`):
//
//   the OUTERMOST own-file frame is the async IIFE's own invocation line, and it
//   VANISHES across an `await` (ownFrames drops to 1). Unusable.
//   the INNERMOST own-file frame is the assertion's line for an inline claim — and the
//   HELPER'S BODY line for a claim made inside one.
//
// `host/_to_delete/helperexposure185.py` then counted the exposure that second reading
// carries: THIRTEEN assert-making helpers are defined below the first seal of their own
// file, across six probes. A rule reading innermost frames would have called every claim
// they make a violation. So this gate is static, and it says why in a measurement rather
// than in a preference.
//
// 🔴 WHAT IT ENFORCES IS AN IDIOM, NOT A PROOF, AND THE DIFFERENCE IS WORTH THE SENTENCE.
// Between seal A and seal B every claim belongs to B — that is what the code does, and no
// scan can know which of them the AUTHOR meant for A. What a scan CAN know is that these
// probes separate their sections with a blank line, and that a claim written under a
// marker with no blank line between them reads to a human as covered by that marker while
// being counted onto the next one. The gate bans that shape. It does not catch a claim
// placed a paragraph away, and saying so here is cheaper than a reader discovering it.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// fileURLToPath, not .pathname — the repo lives under "Godot MCP" (174 §10).
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIR = "test-integration";

// 🔴 A FLOOR ON THE ROSTER, BECAUSE THE ROSTER IS DISCOVERED. 183 §9's rule, which 184
// §7 then paid again on `POPULATION_LINES`: a list with no floor loses an entry in
// silence. This one is discovered by scanning for `.seal(`, so a rename of that member
// would empty it and the gate would report zero offenders out of zero files.
export const FILES_FLOOR = 10;
// 🔴 AND A FLOOR ON THE SEALS, which is the OTHER way the same finder collapses: every
// file still present, every file contributing one seal. Measured at 111 on the tree this
// ships with; floored below that, because a probe legitimately losing a section should
// be a CHANGELOG entry rather than a red gate.
export const SEAL_FLOOR = 95;

/**
 * Every callee spelling that counts one claim, resolved PER FILE.
 *
 * 🔴 THE FINDER IS THE PART THAT HAD TO BE MEASURED, AND 171 §2 IS WHY: a file that
 * reports zero claim sites is either a file that makes none or a file whose idiom the
 * finder cannot read, and nothing in the output distinguishes them. `cs-dap-plane` is
 * the live proof — ELEVEN seals and not one `assert.` call anywhere, because it keeps a
 * local `claim(name, cond, detail)` arrow that calls `population.claim()` itself. A
 * finder that knew only the direct spellings would have read that file as making no
 * claims at all and passed it, silently, on all eleven sections.
 *
 * So: the direct spellings, then every local binding whose body reaches one, to a fixed
 * point. `CLAIM_SITE_FLOORS` below is the backstop for the case this still cannot read.
 */
export function claimCallees(src) {
  // `assert.equal(…)` where `assert` is the counting proxy, `population.claim()`,
  // `p.assert.ok(…)`. Matched on the callee's TEXT because the proxy is bound by a
  // dozen different names across the probes and a binding analysis would be a second
  // population to keep correct.
  const direct = (text) => /(^|\.)assert\.\w+$/.test(text) || /(^|\.)claim$/.test(text);
  const helpers = new Set();
  let grew = true;

  const isClaimCall = (n) => {
    if (!ts.isCallExpression(n)) return false;
    const t = n.expression.getText(src);
    return direct(t) || helpers.has(t);
  };

  // A definition's name, for the two spellings these files use.
  const definedName = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)
        && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) {
      return n.name.text;
    }
    return null;
  };

  // Fixed point: a helper that calls a helper that claims, claims.
  while (grew) {
    grew = false;
    const visit = (n) => {
      const name = definedName(n);
      if (name && !helpers.has(name)) {
        let reaches = false;
        const inner = (m) => { if (isClaimCall(m)) reaches = true; ts.forEachChild(m, inner); };
        ts.forEachChild(n, inner);
        if (reaches) { helpers.add(name); grew = true; }
      }
      ts.forEachChild(n, visit);
    };
    visit(src);
  }
  return { helpers, isClaimCall };
}

/** Every claim site and every seal in one file, with line numbers. */
export function inspect(file, text) {
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const { helpers, isClaimCall } = claimCallees(src);
  const lineOf = (n) => src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1;
  const endLineOf = (n) => src.getLineAndCharacterOfPosition(n.getEnd()).line + 1;

  const claims = [];
  const seals = [];
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const t = n.expression.getText(src);
      if (/(^|\.)seal$/.test(t)) {
        const a0 = n.arguments[0];
        seals.push({
          line: lineOf(n),
          endLine: endLineOf(n),
          marker: a0 && ts.isStringLiteralLike(a0) ? a0.text : "(computed)",
        });
      } else if (isClaimCall(n)) {
        claims.push({ line: lineOf(n), callee: t });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  claims.sort((a, b) => a.line - b.line);
  seals.sort((a, b) => a.line - b.line);
  return { file, claims, seals, helpers: [...helpers].sort(), lines: text.split("\n") };
}

/**
 * 🔴 A PER-FILE FLOOR ON THE CLAIM SITES FOUND, and it is the check that stops this gate
 * from ever passing a file it could not read. `tautology_gate.mjs` earned this exact
 * backstop in 1.59.0 for the same reason — an unread file cannot be reported as silent.
 * Keyed on the filename with a MEASURED value, so a probe that changes its claim idiom
 * to one this finder does not know reddens instead of going quietly to zero.
 *
 * Floors, not counts: a probe is free to grow. Measured on the tree this ships with and
 * set a little below, so ordinary editing does not redden a healthy file.
 */
export const CLAIM_SITE_FLOORS = {
  "_caller_shape.harness.mjs": 25,
  "_population.selftest.mjs": 30,
  "animation-lane.integration.mjs": 45,
  "cs-dap-plane.integration.mjs": 30,
  "inject-input.integration.mjs": 45,
  "node-lifecycle.integration.mjs": 45,
  "runtime-peers.integration.mjs": 20,
  "runtime-screenshot.integration.mjs": 25,
  "tree-shape.integration.mjs": 30,
  "vcs.integration.mjs": 70,
  "verification-family.integration.mjs": 90,
};

/**
 * 🔴 EXEMPTIONS COST A WRITTEN REASON — 174 §5, which found a `_` filename prefix buying
 * a silent exemption for 127 claim sites, and 184 §3, which refused to gate `unsealed` at
 * zero for the same reason. So this is keyed on the filename and its value is prose a
 * reviewer has to disagree with in words.
 *
 * 🔴 AND THE ONE ENTRY IN IT IS THE GATE'S FIRST RUN TALKING. `_population.selftest.mjs`
 * came back with three SEAL_ORDER_TRAILING hits on the tree this ships with, and reading
 * them showed the finder was right about the text and wrong about the file: that file
 * builds FIXTURES, one compressed line per section —
 *
 *     assert.ok(true); assert.equal(1, 1); p.seal("A", "ok");
 *     assert.ok(true); p.seal("B", "ok");
 *
 * — so the claim on the next line belongs to the next section BY CONSTRUCTION, which is
 * the whole point of writing it that way. There is no structural signal separating that
 * from the defect; a blank line between sections is a PROBE idiom and this file is not a
 * probe. Exempted from the trailing rule only: it still counts toward the roster, the
 * seal floor and its own claim-site floor, because those detect a collapsed finder and a
 * collapsed finder is not something an exemption should buy.
 */
export const NOT_A_PROBE = {
  "_population.selftest.mjs":
    "the instrument's own self-test: it constructs populations one compressed line per "
    + "section, so consecutive claims and seals are separate fixtures rather than a "
    + "section and its marker. Still floored and still counted.",
};

/**
 * The judgement, as a pure function of its population (174 §8's reason, and 176's:
 * every branch below is empty against a healthy tree, so inlining them would make them
 * untestable). `files` is a list of `inspect()` results.
 */
export function judge(files, { filesFloor = FILES_FLOOR, sealFloor = SEAL_FLOOR, siteFloors = CLAIM_SITE_FLOORS, roster = NOT_A_PROBE } = {}) {
  const out = { lines: [], failed: false };
  const say = (s) => out.lines.push(s);
  const totalSeals = files.reduce((n, f) => n + f.seals.length, 0);
  const totalClaims = files.reduce((n, f) => n + f.claims.length, 0);

  say(`SEAL_ORDER_GATE files=${files.length}/${filesFloor} seals=${totalSeals}/${sealFloor} claim-sites=${totalClaims}`);

  if (files.length < filesFloor) {
    say(`🔴 SEAL_ORDER_ROSTER_COLLAPSE ${files.length} < ${filesFloor} — the roster is DISCOVERED by`);
    say(`   scanning for \`.seal(\`, so a rename of that member empties it and this gate then`);
    say(`   reports zero offenders out of zero files. Zero of zero is not a clean tree.`);
    out.failed = true;
  }
  if (totalSeals < sealFloor) {
    say(`🔴 SEAL_ORDER_SEAL_COLLAPSE ${totalSeals} < ${sealFloor} — every file still present and the`);
    say(`   seal finder matching a fraction of them is the collapse a file count cannot see.`);
    out.failed = true;
  }

  // 🔴 AN EXEMPTION FOR A FILE THAT IS NOT IN THE ROSTER. verdict_gate.mjs caught its
  // own first entry this way in 175: an exemption for something that was never in scope
  // reads on every re-reading as a considered decision about a real case. Only the
  // roster-vs-population comparison can see it, because no check that inspects the
  // excused FILE ever reaches it.
  const present = new Set(files.map((f) => f.file));
  for (const k of Object.keys(roster)) {
    if (present.has(k)) continue;
    say(`🔴 SEAL_ORDER_ROSTER_DEAD ${k} is excused but seals nothing — it is not a subject.`);
    say(`   An exemption nothing exercises reads as a decision about a real case. Delete it.`);
    out.failed = true;
  }

  for (const f of files) {
    // 🔴 THE UNREADABLE-IDIOM CHECK, FIRST, BECAUSE EVERYTHING BELOW READS AS CLEAN
    // WITHOUT IT. A file whose claim idiom this finder cannot parse contributes zero
    // claim sites, and zero claim sites can never sit after a seal.
    const floor = siteFloors[f.file];
    if (floor === undefined) {
      say(`🔴 SEAL_ORDER_UNFLOORED ${f.file} makes seals and has no entry in CLAIM_SITE_FLOORS.`);
      say(`   A new seal-shape probe must declare what this finder should find in it, or the`);
      say(`   first time the finder cannot read its idiom the file passes at zero sites.`);
      out.failed = true;
    } else if (f.claims.length < floor) {
      say(`🔴 SEAL_ORDER_UNREADABLE ${f.file} — ${f.claims.length} claim site(s) found, floor is ${floor}.`);
      say(`   171 §2: a silent file either asserts nothing or asserts in an idiom the finder`);
      say(`   cannot read. This file seals ${f.seals.length} section(s), so it is the second.`);
      say(`   Resolved claim helpers here: ${f.helpers.join(", ") || "(none)"}`);
      out.failed = true;
    }

    const hits = [];
    for (const s of f.seals) {
      // Scan forward from the END of the seal statement to the next blank line. That
      // blank line is the probes' own section separator — see the header: this enforces
      // the idiom the files already keep, it does not prove attribution.
      let stop = s.endLine;
      while (stop < f.lines.length && f.lines[stop].trim() !== "") stop++;
      const trailing = f.claims.filter((c) => c.line > s.endLine && c.line <= stop);
      if (trailing.length) hits.push({ seal: s, trailing });
    }

    // 🔴 A STALE EXEMPTION IS A FAILURE, NOT A SPARE ONE. verdict_gate.mjs's
    // ROSTER_STALE, and the reason is the same: an excused file that would pass anyway
    // spends a reader's attention on a decision that has stopped being a decision, and
    // the NEXT reader inherits it as evidence that the shape is legitimate.
    if (roster[f.file]) {
      if (!hits.length) {
        say(`🔴 SEAL_ORDER_ROSTER_STALE ${f.file} is excused but trips nothing — remove the entry.`);
        out.failed = true;
      } else {
        say(`   exempt  ${f.file} (${hits.length} site(s)) — ${roster[f.file].slice(0, 68)}…`);
      }
      continue;
    }

    for (const { seal: s, trailing } of hits) {
      out.failed = true;
      say(`\n🔴 SEAL_ORDER_TRAILING ${f.file}:${s.line}  ${s.marker}`);
      for (const c of trailing) say(`   claim at :${c.line}  ${c.callee}(…)  — counted onto the NEXT marker`);
      say(`   \`seal()\` attributes every claim made since the PREVIOUS seal, so a claim written`);
      say(`   under this marker with no blank line between them is counted onto the next section`);
      say(`   while reading to a human as covered by this one. Nothing goes unattributed, so the`);
      say(`   unsealed gate (184 §3) cannot see it; what breaks is the report's AIM — delete`);
      say(`   these claims and it is the NEXT marker that reads vacuous. Move the seal below them.`);
    }
  }

  say(out.failed
    ? `\nSEAL_ORDER_GATE 🔴 FAILED`
    : `SEAL_ORDER_GATE ok — ${totalSeals} seal(s) across ${files.length} file(s), every marker sits below its own claims`);
  return out;
}

/** Scan the real tree. Exported so the self-test can drive the SCANNER separately. */
export function scan(root = ROOT) {
  const dir = join(root, DIR);
  const files = [];
  for (const name of readdirSync(dir).filter((x) => /\.mjs$/.test(x)).sort()) {
    const text = readFileSync(join(dir, name), "utf8");
    // The roster is every file that SEALS. A file importing Population without sealing
    // uses the tally or header-first shape, where `seal()` is not in play at all.
    if (!/\.seal\(/.test(text)) continue;
    files.push(inspect(name, text));
  }
  return files;
}

export function main() {
  const r = judge(scan());
  for (const l of r.lines) console.log(l);
  if (r.failed) process.exit(1);
}

if (process.argv[1]?.endsWith("seal_order_gate.mjs")) main();

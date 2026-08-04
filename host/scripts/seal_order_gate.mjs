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
// 🔴 WHAT THE FIRST RULE ENFORCES IS AN IDIOM, NOT A PROOF. Between seal A and seal B
// every claim belongs to B — that is what the code does, and no scan can know which of
// them the AUTHOR meant for A. What a scan CAN know is that these probes separate their
// sections with a blank line, and that a claim written under a marker with no blank line
// between them reads to a human as covered by that marker while being counted onto the
// next one. `SEAL_ORDER_TRAILING` bans that shape.
//
// 🔴 AND THE SECOND RULE IS 185 §10.2, WHICH ASKED WHETHER ANY SIGNAL SEPARATES "THE
// AUTHOR MEANT THIS FOR THE PREVIOUS MARKER" FROM "THIS IS THE NEXT SECTION". There is
// one, and it was found by measuring rather than by guessing (`host/_to_delete/` —
// sectionsignal186, headless186, introcomment186). These probes ANNOUNCE the next
// section before asserting in it, in one of two idioms:
//
//   a numbered / ruled header    // ============== 4. the library holds more ===
//   a prose paragraph comment    // The other direction, and the whole point of the pair:
//
// So the boundary of the next section is its header if it has one and its first comment
// otherwise, and a claim ABOVE that boundary was written in the section the seal just
// closed — however many blank lines are in between. That is `SEAL_ORDER_UNANNOUNCED`,
// and the header tier is the strong one: if a numbered header falls BETWEEN two seals,
// then seal B is inside the next numbered section by construction and everything above
// the header is in seal A's, which is a structural reading rather than a preference.
//
// Measured before it was written: 86 inter-seal regions, 81 announced by a comment and
// 63 of those by a header; **five regions announce nothing at all** and this rule is
// blind to them by construction — floored rather than assumed, see
// ANNOUNCED_REGIONS_FLOOR. Fourteen claims across four regions were above their own
// section's announcement, in two probes, and hand-reading all four found the same defect
// each time: a section that existed in the source and had no marker of its own.
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

// 🔴 AND A FLOOR ON THIS RULE'S OWN COVERAGE, which is the collapse the other two floors
// cannot see: every file present, every seal found, and the probes having quietly stopped
// announcing their sections, so `SEAL_ORDER_UNANNOUNCED` inspects nothing and prints ok.
// 184 §10.6's complaint, honoured on the way in rather than four sessions later: a number
// floored from one side only is a number nobody can act on. Measured at 84 of 89 regions
// on the tree this ships with.
export const ANNOUNCED_REGIONS_FLOOR = 80;

// ── THE THIRD RULE (187) — THE HEADER LIST A READER GREPS ────────────────────────────
//
// 🔴 186 §8 ASKED THE ONE-RULE-TWO-SPELLINGS QUESTION OF THESE FILES AND GOT AN ANSWER
// THAT WAS WRONG, AND THE WAY IT WAS WRONG IS THE REASON THIS RULE IS ONE-DIRECTIONAL.
// Six of the eleven sealing probes print their markers in a grep-able header comment AND
// declare them in the `Population` manifest, and 186 compared the two as SETS: 6 files
// carrying a header, ZERO agreeing, 8 families missing and 5 markers "advertised that are
// not families", three of them called the residue of 184's own fix.
//
// 187 re-measured before writing the rule (`host/_to_delete/markerspike187.mjs`) and the
// second measurement killed the first:
//
//   family AND printed                                       59
//   printed, deliberately NOT a family (_PING, _RESULT, …)    16
//   🔴 PHANTOM — in the header, neither a family nor in the file at all       0
//   🔴 FAMILY ABSENT FROM ITS OWN HEADER                                      2
//
// Every one of the "phantoms" is a real, greppable line: `F6_PEERS_SPAWN`,
// `F6_PEERS_FROZEN`, `F6_PEERS_CONVERGE`, `NODE_LIVE_SCENE` and `RENDER_LIVE_SCENE` are
// all printed by their own probes. THE TWO LISTS WERE NEVER THE SAME LIST — the header is
// *what a reader can grep for* and the manifest is *what is sealed as a family*, and the
// header is a superset by design. An equality rule would have demanded sixteen deletions
// of accurate documentation, or sixteen fake families to make a classifier happy (184
// §30's shape).
//
// So the rule is asymmetric, and each half is worth exactly what it catches:
//
//   MARKER_UNLISTED  every family in the manifest must appear in the header. Two did not
//                    — `ANIM_LIVE_LEFT_CLEAN` and `NODE_LIVE_NO_LEAK` — and each is a
//                    section a reader greps the documented list for and does not find.
//   MARKER_PHANTOM   every token in the header must be FINDABLE in the file below it.
//                    Measured at zero, and shipped anyway: it is what excludes `_PING`
//                    and `_RESULT` BY CONSTRUCTION rather than by a roster (186 §10.3's
//                    own instruction), and a roster is the thing that rots.
//
// 🔴 AND ITS COVERAGE IS FLOORED ON THE WAY IN, like the rule above it. Five of eleven
// sealing files carry no header at all and this rule reads nothing in them; a probe that
// DELETES its header does not fail — it removes itself, and the gate would print ok over
// a shrinking population. 186 §6, paid on the way in for the second session running.
export const MARKER_HEADER_FILES_FLOOR = 6;
// The other half of the same collapse: every header still present and the manifests
// emptied. Measured at 61 families across the six files that carry a header.
export const HEADER_FAMILY_FLOOR = 55;

/** The grep-able header block, if the file carries one. */
export const MARKER_HEADER = /\/\/ Markers \(grep-able\):([\s\S]*?)\.\s*\n/;

/** A line that announces the next section outright — the strong tier of the boundary. */
export const SECTION_HEADER = /^\s*\/\/\s*(?:[-–—─=_*#]{4,}|\d+[a-z]?\s*[.):]\s+\S)/;
/** Any comment line — the weak tier, used when the region has no header. */
export const ANY_COMMENT = /^\s*(?:\/\/|\/\*)/;

/**
 * Where the section that seal B closes begins: its own header if it has one, its first
 * comment otherwise, and `null` when it announces itself in no way at all.
 *
 * 🔴 THE TWO TIERS ARE NOT INTERCHANGEABLE AND THE ORDER MATTERS. A header is a declared
 * boundary, so a claim above it is in the PREVIOUS numbered section as a matter of
 * structure. A prose comment is only the idiom these files keep. Preferring the header
 * where one exists is what catches a claim introduced by its own paragraph comment while
 * still sitting inside the section above — 186 §3's animation-lane and _TEXT_OPTS cases,
 * which the comment tier alone reads as clean.
 */
export function sectionBoundary(lines, from, to) {
  let comment = null;
  for (let ln = from; ln <= to; ln++) {
    const text = lines[ln - 1] ?? "";
    if (SECTION_HEADER.test(text)) return { line: ln, tier: "header" };
    if (comment === null && ANY_COMMENT.test(text)) comment = ln;
  }
  return comment === null ? null : { line: comment, tier: "comment" };
}

/**
 * Every (seal, next seal) region in one file. The LAST seal's region is deliberately
 * absent: claims after the last seal belong to no section at all, which is the `unsealed`
 * population `report()`'s gate 6 declares (184 §3). Two gates on one population is two
 * populations.
 */
export function regionsOf(f) {
  const out = [];
  for (let i = 0; i < f.seals.length - 1; i++) {
    const from = f.seals[i].endLine + 1;
    const to = f.seals[i + 1].line - 1;
    if (to < from) continue;
    out.push({
      seal: f.seals[i],
      next: f.seals[i + 1],
      from,
      to,
      boundary: sectionBoundary(f.lines, from, to),
      claims: f.claims.filter((c) => c.line >= from && c.line <= to),
    });
  }
  return out;
}

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

/**
 * The two spellings of one file's marker list: the grep-able header and the `Population`
 * manifest — plus whether each header token can be FOUND in the body below the header.
 *
 * 🔴 `findable` IS THE WHOLE DESIGN. It is what tells `INPUT_LIVE_PING` (a reachability
 * banner the probe prints, documented in its own file as deliberately not a family) from
 * a token the header advertises and the file does not contain. Deriving it means `_PING`
 * and `_RESULT` need no roster entry, and 174 §5's rule is why that matters: an exclusion
 * that costs nothing to write is an exclusion nobody re-reads.
 *
 * Returns null when the file carries no header — that is not a failure, it is the
 * coverage this rule does not have, and `MARKER_HEADER_FILES_FLOOR` is what watches it.
 */
export function markerList(text) {
  const hdr = text.match(MARKER_HEADER);
  const pre = text.match(/new Population\(\s*"([A-Z0-9_]+)"/);
  const fam = text.match(/families:\s*\[([\s\S]*?)\n\s*\]/);
  if (!hdr) return null;
  if (!pre || !fam) return { prefix: null, declared: [], listed: [], body: "" };

  const prefix = pre[1];
  const declared = [...fam[1].matchAll(/"([A-Z][A-Z0-9_]+)"/g)].map((m) => m[1]);
  // The header writes them shorthand — `VERIFY_LIVE_PING / _STRUCT / _STRUCT_RED` — so a
  // bare token opening with `_` is the prefix plus that token.
  const listed = [...new Set(
    [...hdr[1].replace(/\/\//g, " ").matchAll(/(_?[A-Z][A-Z0-9_]*)/g)]
      .map((m) => (m[1].startsWith("_") ? prefix + m[1] : m[1]))
      .filter((x) => x !== prefix && x.length > prefix.length),
  )];
  const body = text.slice(text.indexOf(hdr[0]) + hdr[0].length);
  return { prefix, declared, listed, body };
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
  return { file, claims, seals, helpers: [...helpers].sort(), lines: text.split("\n"),
           markers: markerList(text) };
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
export function judge(files, { filesFloor = FILES_FLOOR, sealFloor = SEAL_FLOOR, siteFloors = CLAIM_SITE_FLOORS, roster = NOT_A_PROBE, announcedFloor = ANNOUNCED_REGIONS_FLOOR, headerFilesFloor = MARKER_HEADER_FILES_FLOOR, headerFamilyFloor = HEADER_FAMILY_FLOOR } = {}) {
  const out = { lines: [], failed: false };
  const say = (s) => out.lines.push(s);
  const totalSeals = files.reduce((n, f) => n + f.seals.length, 0);
  const totalClaims = files.reduce((n, f) => n + f.claims.length, 0);

  // The second rule's population, counted before anything is judged so the coverage line
  // prints on a healthy run too — 184 §3's lesson about `unsealed=`, which was invisible
  // in the passing case and therefore in no log anyone could compare against.
  const allRegions = files.flatMap((f) => regionsOf(f).map((r) => ({ ...r, file: f.file })));
  const announced = allRegions.filter((r) => r.boundary !== null);
  const silent = allRegions.filter((r) => r.boundary === null);
  const silentClaims = silent.reduce((n, r) => n + r.claims.length, 0);

  say(`SEAL_ORDER_GATE files=${files.length}/${filesFloor} seals=${totalSeals}/${sealFloor} claim-sites=${totalClaims}`);
  say(`SEAL_ORDER_REGIONS ${allRegions.length} inter-seal · announced ${announced.length}/${announcedFloor}`
      + ` (header ${announced.filter((r) => r.boundary.tier === "header").length})`
      + ` · announcing nothing ${silent.length} holding ${silentClaims} claim(s)`);

  // 🔴 THE THIRD RULE'S POPULATION, COUNTED AND PRINTED ON GREEN RUNS FOR THE SAME
  // REASON. The files WITHOUT a header are the blind spot, and a reader of a passing log
  // is the only person who can act on it.
  const withHeader = files.filter((f) => f.markers !== null);
  const headerFamilies = withHeader.reduce((n, f) => n + f.markers.declared.length, 0);
  say(`SEAL_ORDER_MARKERS ${withHeader.length}/${headerFilesFloor} file(s) carry a grep-able header`
      + ` · ${headerFamilies}/${headerFamilyFloor} famil(ies) declared in them`
      + ` · ${files.length - withHeader.length} file(s) carry none and are unread by this rule`);

  if (withHeader.length < headerFilesFloor) {
    say(`🔴 MARKER_COVERAGE_COLLAPSE ${withHeader.length} < ${headerFilesFloor} — a probe that DELETES its`);
    say(`   grep-able header does not fail the marker rule, it REMOVES itself from it, and this`);
    say(`   gate would print ok over a shrinking population. Same shape as the coverage floor`);
    say(`   above it, and the same instruction: move the floor on purpose or restore the header.`);
    out.failed = true;
  }
  if (headerFamilies < headerFamilyFloor) {
    say(`🔴 MARKER_FAMILY_COLLAPSE ${headerFamilies} < ${headerFamilyFloor} — every header still present and`);
    say(`   the manifests emptied is the collapse a FILE count cannot see, which is 172 §6's rule`);
    say(`   about one floor per population rather than one floor per instrument.`);
    out.failed = true;
  }

  if (announced.length < announcedFloor) {
    say(`🔴 SEAL_ORDER_COVERAGE_COLLAPSE ${announced.length} < ${announcedFloor} — the UNANNOUNCED rule reads`);
    say(`   the boundary of the next section off a header or, failing that, the first comment.`);
    say(`   Probes that stop announcing their sections do not fail this rule, they REMOVE`);
    say(`   themselves from it, and the gate would print ok over a shrinking population.`);
    out.failed = true;
  }

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

    // 🔴 THE THIRD RULE, PER FILE, AND IT RUNS BEFORE THE EXEMPTION BELOW BECAUSE THE
    // ONE EXEMPT FILE CARRIES NO HEADER AND IS THEREFORE ALREADY OUT OF SCOPE — an
    // exemption that also happens to cover something is 175's dead-entry shape.
    if (f.markers) {
      const { declared, listed, body } = f.markers;
      const inHeader = new Set(listed);
      for (const d of declared) {
        if (inHeader.has(d)) continue;
        out.failed = true;
        say(`\n🔴 MARKER_UNLISTED ${f.file}  ${d}`);
        say(`   is a family in the Population manifest and is NOT in the file's own grep-able`);
        say(`   header. The header is the list a reader greps; a family missing from it is a`);
        say(`   whole section that reader will not find. Add it to the header comment.`);
      }
      for (const m of listed) {
        if (body.includes(m)) continue;
        out.failed = true;
        say(`\n🔴 MARKER_PHANTOM ${f.file}  ${m}`);
        say(`   is advertised in the grep-able header and appears NOWHERE below it. Grepping for`);
        say(`   it finds only the advertisement. Either the marker was renamed and the header was`);
        say(`   not, or a section was deleted and its entry survived — 184 §4's fix moved seals`);
        say(`   and left this list behind, which is how the class was found.`);
        say(`   🔴 Note what this rule does NOT say: a header token that is printed but is not a`);
        say(`   family is FINE. \`_PING\` and \`_RESULT\` are banners these probes emit on purpose,`);
        say(`   and they are excluded by being findable rather than by a roster anybody keeps.`);
      }
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

    // 🔴 THE SECOND RULE. A claim above the point at which the section it is counted onto
    // announces itself was written in the section the seal just closed. Claims already
    // named by the shape rule above are excluded: one claim, one finding, or a reader
    // fixing the first report discovers the second only on the next run.
    const named = new Set(hits.flatMap((h) => h.trailing.map((c) => c.line)));
    const stranded = [];
    for (const r of regionsOf(f)) {
      if (r.boundary === null) continue;
      const above = r.claims.filter((c) => c.line < r.boundary.line && !named.has(c.line));
      if (above.length) stranded.push({ region: r, above });
    }

    // 🔴 A STALE EXEMPTION IS A FAILURE, NOT A SPARE ONE. verdict_gate.mjs's
    // ROSTER_STALE, and the reason is the same: an excused file that would pass anyway
    // spends a reader's attention on a decision that has stopped being a decision, and
    // the NEXT reader inherits it as evidence that the shape is legitimate.
    if (roster[f.file]) {
      if (!hits.length && !stranded.length) {
        say(`🔴 SEAL_ORDER_ROSTER_STALE ${f.file} is excused but trips nothing — remove the entry.`);
        out.failed = true;
      } else {
        say(`   exempt  ${f.file} (${hits.length} shape / ${stranded.length} unannounced site(s))`
            + ` — ${roster[f.file].slice(0, 60)}…`);
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

    for (const { region: r, above } of stranded) {
      out.failed = true;
      say(`\n🔴 SEAL_ORDER_UNANNOUNCED ${f.file}:${r.seal.line}  ${r.seal.marker}`);
      say(`   ${r.next.marker} announces itself at :${r.boundary.line} (${r.boundary.tier}), and these are above it:`);
      for (const c of above) say(`   claim at :${c.line}  ${c.callee}(…)  — counted onto ${r.next.marker}`);
      say(`   Every one of them was written before the next section began and is drained by its`);
      say(`   marker anyway. Nothing goes unattributed, so neither the unsealed gate (184 §3) nor`);
      say(`   the shape rule above can see it — what breaks is the report's AIM. Each of the four`);
      say(`   found in 186 §3 was the same thing: a section that existed in the source and had no`);
      say(`   marker of its own. Seal it, or move the seal above it down past its own claims.`);
    }
  }

  say(out.failed
    ? `\nSEAL_ORDER_GATE 🔴 FAILED`
    : `SEAL_ORDER_GATE ok — ${totalSeals} seal(s) across ${files.length} file(s), every marker sits below`
      + ` its own claims and above none of the next section's`);
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

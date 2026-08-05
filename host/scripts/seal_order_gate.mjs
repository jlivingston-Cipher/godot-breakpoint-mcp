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
// 🔴 189 — AND THE NUMBER MOVED DOWN BECAUSE THE POPULATION WAS NARROWED, NOT BECAUSE
// COVERAGE FELL. The fourth rule's block below takes the two `_*` instruments out of the
// region population: 89 → 82 regions, announced 83 → 77, and not one judged site lost
// (both instruments contributed zero). Re-measured at 77 and floored a little under, the
// same way this number was set the first time.
export const ANNOUNCED_REGIONS_FLOOR = 73;

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
// 🔴 188 §6 — AND THE FLOOR IS NOW A CEILING TOO, BECAUSE THE FIVE WERE READ.
//
// 187 §8.3 handed the blind spot over with an instruction: READ the five sealing files
// that carry no header before deciding whether they should, because two of them are
// instruments rather than probes and that would make this a roster-with-a-reason rather
// than five edits — which is exactly what §5 had just turned into.
//
// Read. THREE are probes in every sense that matters here — `cs-dap-plane`, `tree-shape`
// and `vcs` each declare a `Population`, seal 8–11 families and print every marker. They
// were missing a header for no reason beyond the order they were written in, and all
// three now carry one. TWO are not probes: `_caller_shape.harness.mjs` is 183's live axis
// for three instruments, and `_population.selftest.mjs` is the gate on the gate. Neither
// has families a reader would grep for; a header on them would document markers that are
// not a section index.
//
// 🔴 THE EXCLUSION IS DERIVED, NOT LISTED, AND THAT IS 187 §5's RULE APPLIED TO FILES
// INSTEAD OF TOKENS. `MARKER_PHANTOM` excludes `_PING` and `_RESULT` by asking whether
// the token is findable, rather than by a roster that rots; the same question here is
// *is this file a probe?*, and the directory already answers it — the two instruments are
// the only two entries whose names begin with `_`, which is the convention every file in
// it already follows. So the rule is: EVERY SEALING FILE NOT NAMED `_*` MUST CARRY A
// HEADER. A new probe is covered the moment it lands, an instrument is excluded by being
// named like one, and nobody has to remember to update a list.
// 🔴 189 — AND THE PREDICATE IS NOW NAMED FOR THE QUESTION IT ANSWERS, BECAUSE A SECOND
// RULE NEEDED THE SAME ANSWER AND WAS ASKING A ROSTER FOR IT. `NOT_A_PROBE` below has
// carried one hand-written entry since 175 whose written reason is *this file is not a
// probe*; the directory has been able to derive that since 188 §6. One convention, two
// rules, one spelling — see the fourth rule's block for what the roster keeps.
export const isProbe = (file) => !file.startsWith("_");
export const headerRequired = isProbe;

// The floor stays, and it is now the OTHER half: `headerRequired` says which files are
// judged, and this says how many must exist at all. Rename all nine probes to `_x` and
// the rule above would judge nothing while reporting no offenders — the derived exclusion
// buys freedom from a roster and costs exactly this one number to keep honest.
export const MARKER_HEADER_FILES_FLOOR = 9;
// The other half of the same collapse: every header still present and the manifests
// emptied. Measured at 61 across six files in 187; 91 across nine after 188 §6.
export const HEADER_FAMILY_FLOOR = 85;

// ── THE FOURTH RULE (189) — THE REGIONS THAT ANNOUNCED NOTHING ───────────────────────
//
// 186 §6 measured five regions that announce themselves in no way at all, floored them
// and handed them over. 187 and 188 carried the note unchanged. 188 §9.3's instruction
// was §6's method: READ them first, then derive the exclusion rather than listing it.
//
// Read — all six, in `host/_to_delete/silent189.mjs`, one at a time with the seals either
// side and every claim inside. The reading split them 5/1, and the 1 is the finding:
//
//   FIVE ARE PROBE REGIONS AND EVERY ONE IS CORRECTLY ATTRIBUTED. `cs-dap-plane` ×2, a
//   run of one-line path-guard cases where the seal's own marker is the announcement;
//   `runtime-peers` (three for-loops, all about the step the next seal names);
//   `runtime-screenshot` (the bad-reference case); `verification-family` (five claims,
//   all about the RED expectation the next seal names). Nothing to fix in any of them.
//
//   🔴 THE SIXTH IS `_caller_shape.harness.mjs`, AND IT DOCUMENTS THE OPPOSITE IDIOM IN
//   ITS OWN WORDS: *"Verified in the NEXT section on purpose: a claim made after the last
//   seal belongs to no section and is counted in the total."* The premise all three rules
//   above rest on — a claim between two seals was written for the second — is false there
//   BY CONSTRUCTION, deliberately, because that file is a fixture for the counting
//   machinery rather than a narrative of a live system.
//
// 🔴 AND `NOT_A_PROBE` HAD ALREADY SAID SO ABOUT THE OTHER INSTRUMENT, ONE FILE OVER.
// Its single entry excuses `_population.selftest.mjs` with the written reason *"a blank
// line between sections is a PROBE idiom and this file is not a probe"* — which is word
// for word true of the harness, which is not in it. The roster was one name short and
// nothing could see that: the harness gets away with it only because its fixture claims
// are spelled `sassert.ok`, which the claim finder cannot read (189 §5).
//
// So the region population is now PROBE FILES ONLY, derived from the same `_*` convention
// the header rule uses, and the two instruments contribute 7 of the 89 regions and ZERO
// judged sites — a ratio over a population the gate chose for itself (188 §4's phrase).
// `NOT_A_PROBE` keeps its entry and stays live: the TRAILING rule still runs over every
// file and still trips three times in the self-test, so this narrows one rule, not three.
export const REGION_FILES_FLOOR = 9;

// 🔴 AND THE COUNT IS NOW FLOORED FROM BOTH SIDES, WHICH IS 180 §11.4's COMPLAINT ABOUT
// ORPHANS ANSWERED SOMEWHERE ELSE — a number floored from one side only is a number
// nobody can act on, and it has been carried for seven sessions. The five silent regions
// were READ, one at a time, and that reading is what licenses the rule to pass over them.
// A SIXTH is a region nobody has read, so it fails: read it, then either announce it or
// raise the ceiling with the reading written down. That is 188 §6's move exactly — a
// floor became a ceiling the session the population was read.
export const SILENT_REGIONS_CEILING = 5;

// ── THE FIFTH RULE (190) — THE BINDING THE FINDER CANNOT READ ────────────────────────
//
// 189 §9.2 handed over a defect and an instruction attached to it: `_caller_shape.
// harness.mjs` binds `const sassert = sealPop.assert` and wraps it in `sok()`, so its
// SEVEN fixture claims are spelled `sassert.ok` — which `READS_AS_CLAIM` does not match,
// because the character before `assert` is `s` and not a dot. The helper fixed point
// cannot rescue it either: `sok` is only promoted if its body reaches a call the finder
// ALREADY reads, and it does not. That file's whole seal section reports ZERO claim
// sites, and `CLAIM_SITE_FLOORS` cannot see it because the file's other two shapes
// supply 41 on their own. A per-SECTION collapse underneath a per-FILE floor.
//
// 🔴 THE INSTRUCTION WAS: DO NOT JUST WIDEN THE REGEX — MEASURE THE SHAPE FIRST. Measured
// (`host/_to_delete/alias190.mjs`), across all thirty files in the directory:
//
//   ELEVEN files bind a population's `.assert` member. TEN of them — every probe that
//   does it, and all nine bindings in `_population.selftest.mjs` — bind it to a name
//   spelled exactly `assert`, which `^assert\.\w+$` reads. ONE binding in the entire
//   population is invisible, and it is this one. ZERO PROBES HAVE THE SHAPE.
//
// So widening the regex would move `claim-sites`, every per-file floor under it and the
// tautology gate's population, on account of one instrument's fixtures — 189 §12.25's
// reason for naming it rather than doing it, now measured instead of suspected. The
// fixture claims STAY deliberately unreadable. What changes is that they are DECLARED:
// this rule counts the bindings the finder cannot read, fails outright if a PROBE ever
// grows one, and pins the instruments' count from above.
//
// 🔴 A CEILING RATHER THAN A ROSTER, for 189 §12.24's reason — the harness trips nothing,
// so a `NOT_A_PROBE` entry would fire `SEAL_ORDER_ROSTER_STALE` the moment it landed, and
// an exemption keyed on a filename is a decision nobody re-reads. The ceiling re-earns
// itself every run: a second unreadable binding anywhere is a blind spot nobody measured.
//
// ── 191: THE CEILING IS ZERO, AND THAT IS THE DECISION 190 §9.2 ASKED FOR ─────────────
//
// 190 shipped this at 1 and said so in its own words: the harness's seven fixture claims
// were left unreadable "because §3's measurement licenses leaving it alone, not because
// leaving it alone is right", and it warned that a ceiling nobody can ever act on is worse
// than no ceiling at all. 191 acted on it. `_caller_shape.harness.mjs` now claims through
// `sealPop.assert.ok` directly, which `READS_AS_CLAIM` reads, so `sok` is promoted by the
// ordinary fixed point and the section is in the population like every other.
//
// 🔴 AND THE COST WAS NOT THE COST 190 PREDICTED. 190 §9.2 wrote "renaming `sassert` to any
// name the finder reads would count seven more sites and cost nothing measured." Measured
// (`_to_delete/idiom191.mjs`), the delta is **NINE**, not seven: the seven `sok(…)` call
// sites, plus the `sealPop.assert.ok` inside `sok` itself, plus `runSeal()` — which the
// fixed point promotes once its body reaches a readable call, exactly as it already
// promotes `run` and `runTally` in the same file. `claim-sites` 595 → 604. The prediction
// was not wrong about the direction, it was wrong about the number, and it was wrong
// because it counted the FIXTURES rather than what the finder would find. That is 190
// §29's own rule turned on 190: a carried item that names a fix has usually not been
// measured, and this one named the fix AND the number.
//
// 🔴 ZERO IS A DIFFERENT KIND OF CONSTANT FROM 1, AND THAT IS WHY THE RULE SURVIVES IT.
// 181 §5's problem — a ceiling whose healthy value is zero cannot prove it ever counted —
// applies to a rule with no other axis. This one has two: `SEAL_ORDER_ALIAS` prints the
// TOTAL binding population (18) on every green run, which is non-zero and floored by the
// self-test, so a detector that stopped detecting shows up there rather than hiding behind
// a satisfied zero. The reverse sweep plants exactly that mutant (`mutate191.py`, U1a).
export const ALIAS_BLIND_CEILING = 0;

/**
 * The total binding population, floored — because `ALIAS_BLIND_CEILING` is now 0 and a
 * ceiling at zero is satisfied by a detector that returns nothing at all (181 §5).
 *
 * 🔴 THIS IS THE OTHER SIDE 190 §30 SAID EVERY GREEN RULE NEEDS. "Zero unreadable
 * bindings" is only honest if something separately witnessed that bindings were FOUND.
 * Measured at 18 across the 11 roster files; floored below that so an ordinary refactor
 * that removes one does not red, while `assertAliases` going quiet does.
 */
export const ALIAS_BINDINGS_FLOOR = 14;

/**
 * Every binding that holds a population's `.assert` member, and whether a call made
 * through it is one the finder can read.
 *
 * Two spellings, because those are the two the directory uses: `const x = p.assert` and
 * `const { assert: x } = p`. The readability question is asked of `READS_AS_CLAIM`
 * itself rather than of a second regex — see its block.
 */
export function assertAliases(src) {
  const found = [];
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && n.initializer) {
      if (ts.isPropertyAccessExpression(n.initializer)
          && n.initializer.name.text === "assert" && ts.isIdentifier(n.name)) {
        found.push({ name: n.name.text, node: n });
      }
      if (ts.isObjectBindingPattern(n.name)) {
        for (const el of n.name.elements) {
          const prop = (el.propertyName ?? el.name).getText(src);
          if (prop === "assert") found.push({ name: el.name.getText(src), node: el });
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return found.map((a) => ({
    name: a.name,
    line: src.getLineAndCharacterOfPosition(a.node.getStart(src)).line + 1,
    // The question the finder will be asked at every call site through this binding.
    readable: READS_AS_CLAIM(`${a.name}.ok`),
  }));
}

/**
 * A region's paragraphs: runs of non-blank lines separated by blank lines.
 *
 * 🔴 THIS IS NOT A NEW IDIOM, IT IS THE ONE THE FIRST RULE ALREADY ENFORCES. Read the
 * header: *these probes separate their sections with a blank line*, and
 * `SEAL_ORDER_TRAILING` bans a claim written under a marker with no blank line between
 * them. So the blank line is this gate's own section separator, and reading it inside a
 * SILENT region asks the only question left there: did the author draw a section break
 * with the separator and announce it with nothing?
 *
 * Measured across all 89 regions before the rule was written (`_to_delete/paras189.mjs`):
 * every one of the six silent regions is a SINGLE unbroken paragraph, while 55 of the 83
 * announced ones are not. It discriminates.
 */
export function paragraphsOf(lines, from, to) {
  const out = [];
  let cur = null;
  for (let ln = from; ln <= to; ln++) {
    if ((lines[ln - 1] ?? "").trim() === "") { cur = null; continue; }
    if (!cur) { cur = { from: ln, to: ln }; out.push(cur); }
    cur.to = ln;
  }
  return out;
}

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
 * 🔴 WHAT THE FINDER CAN READ, AS ONE EXPORTED PREDICATE — `assert.equal(…)` where
 * `assert` is the counting proxy, `population.claim()`, `p.assert.ok(…)`. Matched on the
 * callee's TEXT because the proxy is bound by a dozen different names across the probes
 * and a binding analysis would be a second population to keep correct.
 *
 * 🔴 IT IS EXPORTED BECAUSE THE FIFTH RULE ASKS THE SAME QUESTION FROM THE OTHER SIDE,
 * and 178 §10.25's carried question is *which invariants are enforced in one place and
 * asserted in another*. A blind-spot rule that re-spelled this regex would agree with the
 * finder only until one of them was edited.
 */
export const READS_AS_CLAIM = (text) =>
  /(^|\.)assert\.\w+$/.test(text) || /(^|\.)claim$/.test(text);

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
  const direct = READS_AS_CLAIM;
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
           markers: markerList(text), aliases: assertAliases(src) };
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
  // 🔴 191: 25 -> 45, AND THE REVERSE SWEEP IS WHY. `mutate191.py`'s E1 narrows
  // `READS_AS_CLAIM` from `/(^|\.)assert\.\w+$/` to `/^assert\.\w+$/` — deleting the arm
  // this file's seal section was moved onto — and NOTHING went red. The section's nine
  // sites vanish, the file drops 50 -> 41, and 41 still cleared a floor of 25 with room
  // to spare. That is 190 §4's own finding arriving by a second route: the per-file floor
  // could not see the collapse when an ALIAS hid the section, and it could not see it when
  // a narrowed PREDICATE hid it either.
  //
  // 🔴 SO THE FIX AND THE FLOOR ARE ONE COMMIT, NOT TWO. `ALIAS_BLIND_CEILING = 0` guards
  // the revert-by-alias (C1); this guards the revert-by-predicate. Set at 45 — above the
  // 41 the file reports with the seal section unread, below the 50 it reports today, so
  // ordinary editing has five sites of room and losing the section has none.
  "_caller_shape.harness.mjs": 45,
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
export function judge(files, { filesFloor = FILES_FLOOR, sealFloor = SEAL_FLOOR, siteFloors = CLAIM_SITE_FLOORS, roster = NOT_A_PROBE, announcedFloor = ANNOUNCED_REGIONS_FLOOR, headerFilesFloor = MARKER_HEADER_FILES_FLOOR, headerFamilyFloor = HEADER_FAMILY_FLOOR, needsHeader = headerRequired, inSections = isProbe, regionFilesFloor = REGION_FILES_FLOOR, silentCeiling = SILENT_REGIONS_CEILING, aliasCeiling = ALIAS_BLIND_CEILING, aliasFloor = ALIAS_BINDINGS_FLOOR } = {}) {
  const out = { lines: [], failed: false };
  const say = (s) => out.lines.push(s);
  const totalSeals = files.reduce((n, f) => n + f.seals.length, 0);
  const totalClaims = files.reduce((n, f) => n + f.claims.length, 0);

  // The second rule's population, counted before anything is judged so the coverage line
  // prints on a healthy run too — 184 §3's lesson about `unsealed=`, which was invisible
  // in the passing case and therefore in no log anyone could compare against.
  // 🔴 189 — AND THE POPULATION IS PROBE FILES ONLY. See the fourth rule's block: the two
  // `_*` instruments build FIXTURES between their seals, one of them says so in a comment
  // and the other has a roster entry saying so, and neither has ever contributed a judged
  // site. Counting them made every ratio below one over a population the gate chose.
  const regionFiles = files.filter((f) => inSections(f.file));
  const allRegions = regionFiles.flatMap((f) => regionsOf(f).map((r) => ({ ...r, file: f.file, lines: f.lines })));
  const announced = allRegions.filter((r) => r.boundary !== null);
  const silent = allRegions.filter((r) => r.boundary === null);
  const silentClaims = silent.reduce((n, r) => n + r.claims.length, 0);

  say(`SEAL_ORDER_GATE files=${files.length}/${filesFloor} seals=${totalSeals}/${sealFloor} claim-sites=${totalClaims}`);
  say(`SEAL_ORDER_REGIONS ${allRegions.length} inter-seal in ${regionFiles.length}/${regionFilesFloor} probe file(s)`
      + ` · announced ${announced.length}/${announcedFloor}`
      + ` (header ${announced.filter((r) => r.boundary.tier === "header").length})`
      + ` · announcing nothing ${silent.length}/${silentCeiling} holding ${silentClaims} claim(s)`
      + ` · claiming nothing ${allRegions.filter((r) => r.claims.length === 0).length}`
      + ` · ${files.length - regionFiles.length} instrument(s) excluded by name`);

  // 🔴 THE THIRD RULE'S POPULATION, COUNTED AND PRINTED ON GREEN RUNS FOR THE SAME
  // REASON. The files WITHOUT a header are the blind spot, and a reader of a passing log
  // is the only person who can act on it.
  // 🔴 199 §9.2 — THE ONE OF THE NINE THAT IS NOT IN A SELF-TEST, AND THE FILTER IS WHY.
  // `!== null` is a strict test against ONE falsy value guarding a read that assumes a
  // whole object: a record whose `markers` key is absent is `undefined`, passes the
  // filter, and `.declared.length` throws — inside the gate, outside any claim, so the
  // gate dies rather than reporting the five failures it had already found. Measured, not
  // reasoned: a blinded `inspect` returns `{ file, claims, seals, helpers, lines }` with
  // no `markers` key at all. `!= null` covers both spellings of absent, and the read
  // below is defended in its own right so the filter and the reduce cannot drift apart.
  const withHeader = files.filter((f) => f.markers != null);
  const headerFamilies = withHeader.reduce((n, f) => n + (f.markers.declared?.length ?? 0), 0);
  say(`SEAL_ORDER_MARKERS ${withHeader.length}/${headerFilesFloor} file(s) carry a grep-able header`
      + ` · ${headerFamilies}/${headerFamilyFloor} famil(ies) declared in them`
      + ` · ${files.filter((f) => !needsHeader(f.file)).length} instrument(s) excluded by name`);

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

  // 🔴 THE OTHER HALF OF THE DERIVED EXCLUSION, exactly as `MARKER_HEADER_FILES_FLOOR` is
  // the other half of `headerRequired`. Rename the nine probes to `_x` and the three rules
  // above would judge nothing while reporting no offenders.
  if (regionFiles.length < regionFilesFloor) {
    say(`🔴 SEAL_ORDER_REGION_SCOPE_COLLAPSE ${regionFiles.length} < ${regionFilesFloor} — the region rules`);
    say(`   exclude instruments by name (\`_*\`), which is free until the day a PROBE is named`);
    say(`   like one. Then it leaves the population instead of failing in it, and this gate`);
    say(`   reports no offenders over the files it stopped reading. 174 §5's exact defect.`);
    out.failed = true;
  }

  // 🔴 THE FOURTH RULE. A silent region is one the UNANNOUNCED rule cannot read at all,
  // and the five on this tree were read BY HAND (189 §3) — that reading is what licenses
  // passing over them, so it is pinned from above. Both directions, which is 180 §11.4's
  // seven-session-old complaint about a number floored from one side only.
  if (silent.length > silentCeiling) {
    say(`🔴 SEAL_ORDER_SILENT_UNREAD ${silent.length} > ${silentCeiling} region(s) announce themselves in no`);
    say(`   way at all. The five on the tree this ships with were read one at a time and each`);
    say(`   is correctly attributed; a sixth is a region NOBODY HAS READ, and the rule that`);
    say(`   would judge it is blind to it by construction. Read it, then either announce the`);
    say(`   section with a comment or raise this ceiling with the reading written down.`);
    for (const r of silent) say(`   silent  ${r.file}:${r.from}-${r.to}  between ${r.seal.marker} and ${r.next.marker}`);
    out.failed = true;
  }
  for (const r of silent) {
    // The blank line is this gate's own section separator — `SEAL_ORDER_TRAILING` is
    // built on it. Inside a region that announces nothing it is the only signal left.
    const paras = paragraphsOf(r.lines ?? [], r.from, r.to);
    const holding = paras.filter((p) => r.claims.some((c) => c.line >= p.from && c.line <= p.to));
    if (holding.length < 2) continue;
    out.failed = true;
    say(`\n🔴 SEAL_ORDER_SILENT_SPLIT ${r.file}:${r.from}-${r.to}  between ${r.seal.marker} and ${r.next.marker}`);
    say(`   announces nothing, and its claims fall in ${holding.length} blank-line-separated paragraphs:`);
    for (const p of holding) {
      const cs = r.claims.filter((c) => c.line >= p.from && c.line <= p.to);
      say(`   :${p.from}-${p.to}  ${cs.length} claim(s) at ${cs.map((c) => c.line).join(", ")}`);
    }
    say(`   A blank line IS this gate's section separator — the shape rule above is built on`);
    say(`   it. Two paragraphs of claims with no comment between them is a section break the`);
    say(`   author drew and announced with nothing, and \`seal()\` counts every one of them`);
    say(`   onto ${r.next.marker} regardless. Announce the second section, or seal the first.`);
  }

  // 🔴 THE FIFTH RULE'S OTHER HALF, AND THE SYMPTOM RATHER THAN THE CAUSE. 189 §9.2's
  // exact words: `CLAIM_SITE_FLOORS` is a per-FILE floor and an unreadable idiom inside
  // ONE seal section is a per-SECTION collapse, so the file's other sections go on
  // satisfying the floor while a whole section reads as having claimed nothing.
  //
  // Measured before it was written (`_to_delete/alias190.mjs`, Q3): of the 89 inter-seal
  // regions in the directory, SIX report zero claim sites and all six are in the two
  // INSTRUMENTS — four fixture sections in `_population.selftest.mjs` and the two the
  // `sassert` alias hides. ZERO PROBE SECTIONS ARE EMPTY. So over the population the
  // region rules already use, this is green with no exclusions and it has teeth: it is
  // what would have caught the harness had the harness been a probe.
  const emptySections = allRegions.filter((r) => r.claims.length === 0);
  for (const r of emptySections) {
    out.failed = true;
    say(`\n🔴 SEAL_ORDER_SECTION_SILENT ${r.file}:${r.from}-${r.to}`);
    say(`   ${r.seal.marker} and ${r.next.marker} have NO claim site between them. A marker that`);
    say(`   drains nothing is either a section that asserts nothing — in which case the marker`);
    say(`   is reporting a family it never tested — or a section whose claim idiom this finder`);
    say(`   cannot read, which is 171 §2 at a granularity the per-FILE floor cannot reach:`);
    say(`   ${r.file}'s other sections keep satisfying \`CLAIM_SITE_FLOORS\` while this one`);
    say(`   counts as nothing. Check the binding first — see SEAL_ORDER_ALIAS above.`);
  }

  // 🔴 THE FIFTH RULE (190). The finder reads a callee's TEXT, so a binding that holds a
  // population's `.assert` under a name the text test does not match makes every call
  // through it — and every wrapper of it — invisible. Counted and printed on green runs,
  // 184 §3's reason: the blind spot's SIZE is the thing a reader of a passing log needs.
  const aliases = files.flatMap((f) => (f.aliases ?? []).map((a) => ({ ...a, file: f.file })));
  const blindAliases = aliases.filter((a) => !a.readable);
  say(`SEAL_ORDER_ALIAS ${aliases.length}/${aliasFloor} binding(s) hold a population's .assert`
      + ` · ${blindAliases.length}/${aliasCeiling} unreadable by the claim finder`
      + ` · ${blindAliases.filter((a) => inSections(a.file)).length} of them in a probe`);

  // 🔴 THE FLOOR UNDER THE CEILING (191). With `ALIAS_BLIND_CEILING = 0` the unreadable
  // count is satisfied by a detector that finds NOTHING, so the population it was counted
  // out of has to be witnessed separately — 190 §30's rule ("a rule with zero offenders is
  // only honest if its population was counted separately") applied to the rule 190 shipped.
  if (aliases.length < aliasFloor) {
    out.failed = true;
    say(`🔴 SEAL_ORDER_ALIAS_COLLAPSE ${aliases.length} < ${aliasFloor} binding(s) found. The`);
    say(`   unreadable count above is a CEILING AT ZERO, which \`assertAliases\` returning an`);
    say(`   empty array satisfies perfectly. This floor is the only thing that can tell`);
    say(`   "nothing is unreadable" from "nothing was read".`);
  }

  for (const a of blindAliases.filter((a) => inSections(a.file))) {
    // In a PROBE this is not a ceiling question. The measurement that licensed the
    // ceiling found the shape in ZERO probes; one appearing is 171 §2's collapse at a
    // granularity `CLAIM_SITE_FLOORS` cannot reach, because a probe's other sections
    // keep satisfying its per-file floor while the aliased section reports nothing.
    out.failed = true;
    say(`\n🔴 SEAL_ORDER_ALIAS_BLIND ${a.file}:${a.line}  const ${a.name} = ….assert`);
    say(`   Every claim made through \`${a.name}\` is invisible to this gate: the finder matches`);
    say(`   the callee's TEXT against \`READS_AS_CLAIM\`, and \`${a.name}.ok\` fails it. The helper`);
    say(`   fixed point cannot rescue a wrapper of it either — a helper is promoted only when`);
    say(`   its body reaches a call the finder ALREADY reads. This file's per-file floor will`);
    say(`   go on being satisfied by its other sections while these count as nothing.`);
    say(`   Bind it as \`assert\` (which the finder reads), or claim through \`population.claim\`.`);
  }
  if (blindAliases.length > aliasCeiling) {
    out.failed = true;
    say(`\n🔴 SEAL_ORDER_ALIAS_UNREAD ${blindAliases.length} > ${aliasCeiling} binding(s) the claim finder`);
    say(`   cannot read. 190 shipped this rule with the ceiling at 1, for \`sassert\` in the`);
    say(`   caller-shape harness; 191 removed that binding and took the ceiling to ZERO, so the`);
    say(`   tree now has no such shape anywhere and this is a NEW one. Bind it as \`assert\`, or`);
    say(`   claim through \`population.claim\`, or call \`<population>.assert.<member>\` directly —`);
    say(`   all three are spellings \`READS_AS_CLAIM\` reads, and the third is what the harness`);
    say(`   uses now. Raising this ceiling is not the fix: the last time it was above zero the`);
    say(`   entry documented itself as unreadable ON PURPOSE and still had to be undone.`);
    for (const a of blindAliases) say(`   unreadable  ${a.file}:${a.line}  ${a.name}`);
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
    // 🔴 188 §6 — AND THE MISSING HEADER IS NOW A FAILURE FOR A PROBE. Until this session
    // `markers === null` was silently out of scope: a probe could delete its header and
    // remove itself from the rule rather than fail it, with only a floor watching the
    // count. The exclusion is derived from the name, so nothing has to be remembered.
    if (!f.markers && needsHeader(f.file)) {
      out.failed = true;
      say(`\n🔴 MARKER_NO_HEADER ${f.file} seals ${f.seals.length} section(s) and carries no`);
      say(`   grep-able \`// Markers (grep-able): …\` header. A probe's header is the index a`);
      say(`   reader greps to find a section; without one MARKER_UNLISTED reads nothing here,`);
      say(`   so the file is not exempt from the rule — it is invisible to it. Instruments are`);
      say(`   excluded by being named \`_*\`; if this file is one, rename it, do not list it.`);
    }
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
    // 🔴 189 — AND THE SAME EXCLUSION AS THE COUNT ABOVE, or the ratio and the judgement
    // would be over two different populations, which is 188 §5's whole finding.
    const named = new Set(hits.flatMap((h) => h.trailing.map((c) => c.line)));
    const stranded = [];
    for (const r of (inSections(f.file) ? regionsOf(f) : [])) {
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

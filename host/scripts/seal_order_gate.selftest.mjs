#!/usr/bin/env node
// seal_order_gate.selftest.mjs — session 185.
//
// 173's rule: an instrument with no gate is not a passing instrument. And 184 §8's, which
// is sharper and is why this file leads with the DISMISSALS: a fix that satisfies a
// classifier by changing a claim's shape has not fixed the claim. This gate bans a source
// SHAPE, so the only thing standing between it and uselessness is the set of shapes it
// declines to flag — a gate that reds on everything constrains nothing, and one whose
// finder quietly stops matching reds on nothing while printing ok.
//
// Every case drives `inspect()` / `judge()` with source text and hand-built populations:
// no fixture files, no engine, no compile step.
//
// 🔴 AND THE POPULATIONS THE HEALTHY TREE CANNOT PRODUCE ARE THE POINT. Against the real
// `test-integration/`, `judge()` returns zero trailing claims, zero collapses, zero dead
// and zero stale roster entries — every branch below is empty there. 174 §8 watched a
// collector that was only ever asserted EMPTY lose its filter invisibly.
import {
  inspect, judge, scan, claimCallees, regionsOf, sectionBoundary,
  FILES_FLOOR, SEAL_FLOOR, CLAIM_SITE_FLOORS, NOT_A_PROBE, ANNOUNCED_REGIONS_FLOOR,
  markerList, MARKER_HEADER_FILES_FLOOR, HEADER_FAMILY_FLOOR, headerRequired,
} from "./seal_order_gate.mjs";

let ran = 0, bad = 0;
const claim = (cond, what) => {
  ran++;
  if (!cond) { bad++; console.log(`🔴 FAILED: ${what}`); }
};
// 🔴 NAMED AND PINNED, for 176's reason, carried: a bare `if (ran < 40)` is read by one
// branch and asserted by nothing, so the collapse detector can be switched off without a
// single case noticing. This is the floor that protects the floors.
const CLAIM_FLOOR = 95;

const said = (r, needle) => r.lines.some((l) => l.includes(needle));
// Judge one hand-written source with every floor relaxed, so a case fails for its own
// reason rather than for the roster's size.
const J = (text, opts = {}) => judge([inspect("probe.integration.mjs", text)], {
  filesFloor: 1, sealFloor: 1, siteFloors: { "probe.integration.mjs": 0 }, roster: {},
  // 188 §6: the fixture is named like a probe, so the header rule would judge every case
  // below. Off by default here and exercised explicitly in its own block — the same shape
  // the floors already use, and it keeps each case about one rule.
  announcedFloor: 0, headerFilesFloor: 0, headerFamilyFloor: 0, needsHeader: () => false,
  ...opts,
});

// ── 1. THE FINDER, WHICH IS THE HALF THAT HAD TO BE MEASURED ─────────────────────────
// 171 §2: a file reporting zero claim sites either makes none or asserts in an idiom the
// finder cannot read. `cs-dap-plane` is the live proof — eleven seals, not one `assert.`
// call, because it keeps a local `claim(name, cond)` arrow that calls `population.claim()`.
const DIRECT = `
const assert = population.assert;
assert.ok(true);
population.claim();
p.assert.equal(1, 1);
population.seal("A", "ok");
`;
{
  const got = inspect("probe.integration.mjs", DIRECT);
  claim(got.claims.length === 3, `the three direct spellings are claim sites, got ${got.claims.length}`);
  claim(got.seals.length === 1 && got.seals[0].marker === "A", "and the seal's marker is read from its first argument");
}

const HELPER = `
const check = (name, cond) => {
  population.claim();
};
const twice = (name) => { check(name, true); };
const notAClaim = (x) => x + 1;
check("one", true);
twice("two");
notAClaim(3);
population.seal("A", "ok");
`;
{
  const got = inspect("probe.integration.mjs", HELPER);
  claim(got.helpers.includes("check"), "a local arrow whose body claims IS a claim helper");
  claim(got.helpers.includes("twice"),
    "🔴 and so is one that only reaches a claim through another helper — the fixed point");
  claim(!got.helpers.includes("notAClaim"), "a helper that claims nothing is not one — the dismissal");
  // 4 = population.claim() inside check, the two helper call sites, and check() inside twice
  claim(got.claims.length === 4, `every helper call site counts, got ${got.claims.length}`);
  claim(!got.claims.some((c) => c.callee === "notAClaim"), "and the non-claiming call is not among them");
}

// ── 2. THE RULE, AND THE SHAPE IT MUST DECLINE TO FLAG ───────────────────────────────
const CLEAN = `
const assert = population.assert;
assert.ok(a);
assert.ok(b);
population.seal("A", "ok");

assert.ok(c);
population.seal("B", "ok");
`;
claim(J(CLEAN).failed === false, "a marker written BELOW its own claims trips nothing");

const TRAILING = `
const assert = population.assert;
assert.ok(a);
population.seal("A", "ok");
assert.ok(b);

population.seal("B", "ok");
`;
{
  const r = J(TRAILING);
  claim(r.failed === true, "🔴 a claim written directly under a marker is the 184 §5 defect");
  claim(said(r, "SEAL_ORDER_TRAILING"), "and it is named SEAL_ORDER_TRAILING");
  claim(said(r, "counted onto the NEXT marker"), "with what actually happens to the claim, not just a line number");
}

// 🔴 THE DISMISSAL THAT DEFINES THE RULE. The claim below is also drained by the NEXT
// seal — that is what `seal()` does — but a blank line separates it from this marker, so
// no reader attributes it here. Flagging it would red every healthy probe in the tree.
const SEPARATED = `
const assert = population.assert;
assert.ok(a);
population.seal("A", "ok");

assert.ok(b);
population.seal("B", "ok");
`;
claim(J(SEPARATED).failed === false,
  "🔴 a claim a paragraph below the marker is NOT flagged — the blank line is the section separator");

// 🔴 AND THE COST OF THAT DISMISSAL, WRITTEN DOWN RATHER THAN DISCOVERED. The same defect
// with a blank line inserted is invisible here. This gate bans a shape; it does not prove
// attribution, and no static reading can (nor any runtime one — a seal drains what has
// already happened, so every claim it takes preceded it in TIME).
claim(J(SEPARATED).lines.every((l) => !l.includes("SEAL_ORDER_TRAILING")),
  "the false-negative is real and is asserted here so it cannot be discovered as a surprise");

const MULTILINE = `
const assert = population.assert;
assert.ok(a);
population.seal(
  "A",
  "ok",
);
assert.ok(b);
`;
claim(J(MULTILINE).failed === true,
  "🔴 a seal statement spanning lines is measured from its END — otherwise its own closing lines hide the claim");

const VIA_HELPER = `
const check = (name, cond) => { population.claim(); };
check("a", true);
population.seal("A", "ok");
check("b", true);
`;
claim(J(VIA_HELPER).failed === true,
  "🔴 and the trailing claim is caught through a HELPER too — cs-dap-plane's whole idiom is that shape");

// ── 2b. THE SECOND RULE (186 §3), AND ITS DISMISSALS FIRST ───────────────────────────
// 185 §10.2 asked whether anything separates "the author meant this for the previous
// marker" from "this is the next section". The answer measured off the tree: the next
// section ANNOUNCES itself, with a numbered/ruled header where it has one and with its
// first comment otherwise. A claim above that announcement is in the section the seal
// just closed, however many blank lines are in between.
{
  const L = (s) => s.split("\n");
  //                                   1   2                3           4
  const withHeader = L(`\nassert.ok(a);\n// ==== 3. the next thing ====\nassert.ok(b);`);
  claim(sectionBoundary(withHeader, 1, 4)?.line === 3, "the boundary is the section header's line");
  claim(sectionBoundary(withHeader, 1, 4)?.tier === "header", "and it is reported as the HEADER tier");

  //                             1   2                3                    4
  const prose = L(`\nassert.ok(a);\n// what comes next\nassert.ok(b);`);
  claim(sectionBoundary(prose, 1, 4)?.tier === "comment",
    "with no header, the first prose comment is the boundary — the weak tier");

  // 🔴 THE ORDER OF THE TIERS IS THE WHOLE POINT AND IS ASSERTED, NOT ASSUMED. A
  // paragraph comment BEFORE the header does not win: the header is a declared section
  // boundary and the comment is only an idiom. animation-lane's re-stop claim is exactly
  // this shape — introduced by its own comment, still inside the section above.
  const both = L(`\n// a paragraph of its own\nassert.ok(a);\n// ==== 4. next ====`);
  claim(sectionBoundary(both, 1, 4)?.line === 4 && sectionBoundary(both, 1, 4)?.tier === "header",
    "🔴 a header later in the region beats a comment earlier in it");

  claim(sectionBoundary(L(`\nassert.ok(a);\nassert.ok(b);`), 1, 3) === null,
    "a region announcing nothing at all has NO boundary — the blind spot, named");
}

const UNANNOUNCED = `
const assert = population.assert;
assert.ok(a);
population.seal("A", "ok");

assert.ok(tail);

// ================= 2. the next section =================
assert.ok(b);
population.seal("B", "ok");
`;
{
  const r = J(UNANNOUNCED);
  claim(r.failed === true, "🔴 a claim a paragraph below the marker but ABOVE the next section's header is caught");
  claim(said(r, "SEAL_ORDER_UNANNOUNCED"), "and it is named SEAL_ORDER_UNANNOUNCED, not TRAILING");
  claim(said(r, "counted onto B"), "naming the marker the claim actually lands on");
  claim(said(r, "(header)"), "and which tier decided the boundary, because the two are not equally strong");
}

// 🔴 THE DISMISSAL THAT KEEPS THE RULE NARROW. The claim below sits UNDER the next
// section's announcement, which is where a claim belonging to B is supposed to be. A rule
// that flagged this would red every healthy region in the tree — all 83 of them.
const BELOW_BOUNDARY = `
const assert = population.assert;
assert.ok(a);
population.seal("A", "ok");

// ================= 2. the next section =================
assert.ok(b);
population.seal("B", "ok");
`;
claim(J(BELOW_BOUNDARY).failed === false,
  "🔴 a claim BELOW the next section's announcement is where B's claims belong — not flagged");

// 🔴 AND THE BLIND SPOT, ASSERTED SO IT CANNOT BE DISCOVERED LATER. Six regions on the
// tree announce themselves in no way at all; this rule reads nothing in them. That is
// what ANNOUNCED_REGIONS_FLOOR is for — the population can shrink, and shrinking is not
// the same as passing.
const NO_BOUNDARY = `
const assert = population.assert;
assert.ok(a);
population.seal("A", "ok");

assert.ok(tail);
population.seal("B", "ok");
`;
claim(J(NO_BOUNDARY).failed === false,
  "a region that announces nothing is not judged — the rule has no boundary to read");
claim(J(NO_BOUNDARY).lines.some((l) => l.includes("announcing nothing 1")),
  "🔴 but it is COUNTED and printed, so a growing blind spot is visible rather than silent");

// 🔴 ONE CLAIM, ONE FINDING. A claim in the seal's own paragraph is TRAILING; reporting
// it again as UNANNOUNCED would send a reader who fixed the first report back for a
// second run to discover the second.
const BOTH_RULES = `
const assert = population.assert;
assert.ok(a);
population.seal("A", "ok");
assert.ok(tail);

// ================= 2. the next section =================
assert.ok(b);
population.seal("B", "ok");
`;
{
  const r = J(BOTH_RULES);
  claim(said(r, "SEAL_ORDER_TRAILING"), "the shape rule names the claim in the seal's own paragraph");
  claim(!said(r, "SEAL_ORDER_UNANNOUNCED"), "🔴 and the second rule does not name it a second time");
}

// 🔴 THE LAST SEAL'S REGION IS NOT THIS GATE'S. Claims after the final seal belong to no
// section and are `report()`'s `unsealed` population (184 §3). Two gates on one
// population is two populations.
const AFTER_LAST = `
const assert = population.assert;
assert.ok(a);
population.seal("A", "ok");

assert.ok(trailing);
`;
{
  const f = inspect("probe.integration.mjs", AFTER_LAST);
  claim(regionsOf(f).length === 0, "a file with one seal has no inter-seal region at all");
  claim(J(AFTER_LAST).failed === false, "and a claim after the last seal is gate 6's, not this gate's");
}

// ── 3. THE FLOORS, EACH ASSERTED TO BITE ─────────────────────────────────────────────
const live = scan();
claim(live.length >= FILES_FLOOR, `the live roster holds ${live.length}, floor is ${FILES_FLOOR}`);
claim(judge(live).failed === false, "and the tree this ships with passes the gate it ships");

claim(judge(live, { filesFloor: live.length + 1 }).failed === true,
  "a roster floor one above the roster collapses — the floor is compared, not decorative");
claim(said(judge(live, { filesFloor: live.length + 1 }), "SEAL_ORDER_ROSTER_COLLAPSE"), "and says which collapse it was");
const liveSeals = live.reduce((n, f) => n + f.seals.length, 0);
claim(judge(live, { sealFloor: liveSeals + 1 }).failed === true,
  "🔴 as does a seal floor above the seals found — every file present with a finder matching a fraction of them");
claim(judge([], { filesFloor: 0, sealFloor: 0, roster: {}, announcedFloor: 0, headerFilesFloor: 0, headerFamilyFloor: 0 }).failed === false,
  "and an empty population with floors of zero is not a failure — the floors are what make it one");
// 🔴 WRITTEN WITHOUT `roster: {}` FIRST AND CAUGHT ITSELF ON THE FIRST RUN. The default
// roster excuses one real file, so an EMPTY population makes that entry dead — the gate
// was right and the case was wrong. Kept as a case, because it is the interaction the
// two checks have with each other and nothing else asserts it.
claim(judge([], { filesFloor: 0, sealFloor: 0, announcedFloor: 0, headerFilesFloor: 0, headerFamilyFloor: 0 }).failed === true,
  "an empty population with the SHIPPED roster is a failure — every exemption in it is dead");

// 🔴 THE COVERAGE FLOOR, WHICH IS THE ONE THIS SESSION ADDED AND THE ONE THE OTHER TWO
// CANNOT SEE. Every file present, every seal found, and the probes having quietly
// stopped announcing their sections: the UNANNOUNCED rule then reads nothing and the
// gate prints ok over a population that shrank to nothing.
claim(judge(live, { announcedFloor: 10_000 }).failed === true,
  "🔴 a coverage floor above the announced regions is a failure — the rule's own population is floored");
claim(said(judge(live, { announcedFloor: 10_000 }), "SEAL_ORDER_COVERAGE_COLLAPSE"), "named COVERAGE_COLLAPSE");
{
  const liveRegions = live.flatMap((f) => regionsOf(f));
  const liveAnnounced = liveRegions.filter((r) => r.boundary !== null);
  claim(liveAnnounced.length >= ANNOUNCED_REGIONS_FLOOR,
    `the tree announces ${liveAnnounced.length} of ${liveRegions.length} regions, floor is ${ANNOUNCED_REGIONS_FLOOR}`);
  claim(liveRegions.length > liveAnnounced.length,
    "🔴 and the blind spot is NOT empty on the live tree — a rule with no measured gap is a rule nobody checked");
  claim(liveAnnounced.some((r) => r.boundary.tier === "header") && liveAnnounced.some((r) => r.boundary.tier === "comment"),
    "both tiers are exercised by the real tree, so neither branch is dead code");
}

// 🔴 THE PER-FILE FLOOR, WHICH IS THE ONE THAT STOPS THIS GATE PASSING A FILE IT CANNOT
// READ. Zero claim sites can never sit after a seal, so an unreadable file is green on
// every other check in this file.
const UNREADABLE = `population.seal("A", "ok");\n`;
claim(judge([inspect("probe.integration.mjs", UNREADABLE)],
  { filesFloor: 1, sealFloor: 1, siteFloors: { "probe.integration.mjs": 5 }, roster: {}, announcedFloor: 0, headerFilesFloor: 0, headerFamilyFloor: 0 }).failed === true,
  "🔴 a file whose claim idiom the finder cannot read is a FAILURE, not a clean file");
claim(said(judge([inspect("probe.integration.mjs", UNREADABLE)],
  { filesFloor: 1, sealFloor: 1, siteFloors: { "probe.integration.mjs": 5 }, roster: {}, announcedFloor: 0, headerFilesFloor: 0, headerFamilyFloor: 0 }), "SEAL_ORDER_UNREADABLE"),
  "and it is named as an unreadable idiom rather than as zero offenders");
claim(judge([inspect("probe.integration.mjs", CLEAN)],
  { filesFloor: 1, sealFloor: 1, siteFloors: {}, roster: {}, announcedFloor: 0, headerFilesFloor: 0, headerFamilyFloor: 0 }).failed === true,
  "🔴 and a sealing file with NO floor entry at all fails — a new probe must declare what to find in it");
claim(said(judge([inspect("probe.integration.mjs", CLEAN)],
  { filesFloor: 1, sealFloor: 1, siteFloors: {}, roster: {}, announcedFloor: 0, headerFilesFloor: 0, headerFamilyFloor: 0 }), "SEAL_ORDER_UNFLOORED"), "named UNFLOORED");

// Every live file is floored, and every floor is under what the finder actually finds.
for (const f of live) {
  claim(CLAIM_SITE_FLOORS[f.file] !== undefined, `${f.file} has a claim-site floor`);
  claim(f.claims.length >= (CLAIM_SITE_FLOORS[f.file] ?? 0),
    `${f.file}: ${f.claims.length} sites found, floor ${CLAIM_SITE_FLOORS[f.file]}`);
}
claim(Object.keys(CLAIM_SITE_FLOORS).every((k) => live.some((f) => f.file === k)),
  "and no floor names a file that no longer seals — a floor for nothing is a floor nobody re-reads");

// ── 4. THE ROSTER, BOTH WAYS ─────────────────────────────────────────────────────────
claim(judge(live, { roster: { "no-such-file.mjs": "why" } }).failed === true,
  "🔴 an exemption for a file that seals nothing is a failure — 175's ROSTER_DEAD, one gate over");
claim(said(judge(live, { roster: { "no-such-file.mjs": "why" } }), "SEAL_ORDER_ROSTER_DEAD"), "named ROSTER_DEAD");

const cleanFile = inspect("probe.integration.mjs", CLEAN);
claim(judge([cleanFile], { filesFloor: 1, sealFloor: 1, siteFloors: { "probe.integration.mjs": 0 },
  roster: { "probe.integration.mjs": "excused" }, announcedFloor: 0, headerFilesFloor: 0, headerFamilyFloor: 0 }).failed === true,
  "🔴 an exemption for a file that trips NOTHING is a failure — a decision that stopped being one");
claim(said(judge([cleanFile], { filesFloor: 1, sealFloor: 1, siteFloors: { "probe.integration.mjs": 0 },
  roster: { "probe.integration.mjs": "excused" }, announcedFloor: 0, headerFilesFloor: 0, headerFamilyFloor: 0 }), "SEAL_ORDER_ROSTER_STALE"), "named ROSTER_STALE");

// 🔴 AND STALENESS IS JUDGED ON BOTH RULES, WHICH THE FIRST DRAFT GOT WRONG. A file that
// trips only the UNANNOUNCED rule is still earning its exemption; reading only the shape
// rule would have called it stale and told a maintainer to delete a live entry.
claim(judge([inspect("probe.integration.mjs", UNANNOUNCED)],
  { filesFloor: 1, sealFloor: 1, siteFloors: { "probe.integration.mjs": 0 },
    roster: { "probe.integration.mjs": "a real reason" }, announcedFloor: 0, headerFilesFloor: 0, headerFamilyFloor: 0, needsHeader: () => false }).failed === false,
  "🔴 an exemption earned by the SECOND rule alone is not stale");

const dirtyFile = inspect("probe.integration.mjs", TRAILING);
{
  const r = judge([dirtyFile], { filesFloor: 1, sealFloor: 1, siteFloors: { "probe.integration.mjs": 0 },
    roster: { "probe.integration.mjs": "a real reason" }, announcedFloor: 0, headerFilesFloor: 0, headerFamilyFloor: 0, needsHeader: () => false });
  claim(r.failed === false, "an EARNED exemption suppresses the failure");
  claim(said(r, "exempt  probe.integration.mjs"),
    "🔴 and prints the excused file with its reason — an exemption nobody sees is an exemption nobody re-reads");
  claim(said(r, "a real reason"), "including the reason itself, not just the filename");
}
claim(Object.keys(NOT_A_PROBE).length === 1 && NOT_A_PROBE["_population.selftest.mjs"],
  "the shipped roster excuses exactly one file, the instrument's own self-test");
claim(NOT_A_PROBE["_population.selftest.mjs"].length > 80,
  "and the reason is prose a reviewer can disagree with, not a word");

// ── 4b. THE MARKER LIST, AND THE ASYMMETRY IS THE POINT ──────────────────────────────
// 🔴 THE CASE THAT DECIDED THE RULE'S SHAPE IS THE ONE THAT MUST **NOT** FIRE. 186 §8
// compared the grep-able header and the `Population` manifest as sets and reported zero
// of six agreeing; 187 re-measured and every "phantom" turned out to be a line the probe
// really prints. An equality rule would have demanded sixteen deletions of accurate
// documentation. So: a family missing from the header is a failure, a header token that
// is printed but is not a family is FINE, and a token that appears nowhere is a phantom.
const MARKED = `
// Markers (grep-able): P_PING / _ALPHA / _BETA / _RESULT.
const population = new Population("P", {
  families: [
    "P_ALPHA", "P_BETA",
  ],
  scope: 2,
});
const assert = population.assert;
console.log("P_PING ok");
assert.ok(true);
population.seal("P_ALPHA", "ok");

// the second section
assert.ok(true);
population.seal("P_BETA", "ok");
console.log("P_RESULT done");
`;
claim(J(MARKED).failed === false,
  "🔴 a header listing two families plus a printed PING and RESULT is CLEAN — the header is a superset by design");
claim(said(J(MARKED), "SEAL_ORDER_MARKERS"), "and the marker population is printed on a green run, not only on a red one");

// `_PING` and `_RESULT` are excluded by being FINDABLE, not by a roster — so deleting the
// line that prints one turns it into a phantom, which is the whole design in one case.
const PHANTOM = MARKED.replace('console.log("P_PING ok");', "");
claim(J(PHANTOM).failed === true,
  "🔴 a header token that appears NOWHERE below the header is a phantom — no _PING roster, it is derived");
claim(said(J(PHANTOM), "MARKER_PHANTOM"), "named MARKER_PHANTOM");

const UNLISTED_FAMILY = MARKED.replace('"P_ALPHA", "P_BETA",', '"P_ALPHA", "P_BETA", "P_GAMMA",')
  .replace('population.seal("P_BETA", "ok");', 'population.seal("P_BETA", "ok");\nassert.ok(true);\npopulation.seal("P_GAMMA", "ok");');
claim(J(UNLISTED_FAMILY).failed === true,
  "🔴 a family in the manifest and absent from the header is a section a reader greps for and does not find");
claim(said(J(UNLISTED_FAMILY), "MARKER_UNLISTED"), "named MARKER_UNLISTED");

// 🔴 188 §6 — AND THIS IS THE CLAIM THAT CHANGED SIDES. Until this session a file with no
// header was out of scope: "not a failure, the coverage this rule does not have". Reading
// the five that had none showed three were probes missing a header for no reason but the
// order they were written in — so a missing header is now a failure for anything not
// named like an instrument, and the exclusion is derived from the name rather than listed.
claim(J(CLEAN, { needsHeader: () => false }).failed === false,
  "an INSTRUMENT carrying no grep-able header is out of scope, not in violation");
claim(J(CLEAN, { needsHeader: () => true }).failed === true,
  "🔴 but a PROBE carrying no header is in violation — it was invisible to the rule, not exempt from it");
claim(said(J(CLEAN, { needsHeader: () => true }), "MARKER_NO_HEADER"), "named MARKER_NO_HEADER");
// The derivation itself, asserted rather than trusted: `_`-named files are excluded and
// nothing else is. A roster would need this test too and would also need maintaining.
claim(headerRequired("vcs.integration.mjs") === true, "a probe needs a header");
claim(headerRequired("_population.selftest.mjs") === false, "an instrument does not");
claim(headerRequired("_caller_shape.harness.mjs") === false, "nor does the caller-shape harness");
// 🔴 AND THE LIVE TREE HAS EXACTLY THE TWO INSTRUMENTS THE RULE EXCLUDES. A third file
// renamed to `_x` would quietly leave the rule's scope; this is what notices.
claim(live.filter((f) => !headerRequired(f.file)).length === 2,
  `two live sealing files are excluded by name, not ${live.filter((f) => !headerRequired(f.file)).length}`);
claim(live.every((f) => !headerRequired(f.file) || f.markers !== null),
  "every live file the rule requires a header of carries one");
claim(judge(live, { headerFilesFloor: 10_000 }).failed === true,
  "🔴 a header-coverage floor above the files that carry one is a failure — 186 §6's one-sided floor, paid on the way in");
claim(said(judge(live, { headerFilesFloor: 10_000 }), "MARKER_COVERAGE_COLLAPSE"), "named MARKER_COVERAGE_COLLAPSE");
claim(judge(live, { headerFamilyFloor: 10_000 }).failed === true,
  "🔴 and every header present with the manifests emptied is the collapse a FILE count cannot see");
claim(said(judge(live, { headerFamilyFloor: 10_000 }), "MARKER_FAMILY_COLLAPSE"), "named MARKER_FAMILY_COLLAPSE");
{
  const carrying = live.filter((f) => f.markers !== null);
  claim(carrying.length >= MARKER_HEADER_FILES_FLOOR,
    `${carrying.length} live file(s) carry a grep-able header, floor is ${MARKER_HEADER_FILES_FLOOR}`);
  claim(carrying.length < live.length,
    "🔴 and the blind spot is NOT empty on the live tree — a rule with no measured gap is a rule nobody checked");
  claim(carrying.some((f) => f.markers.listed.some((m) => !f.markers.declared.includes(m))),
    "🔴 the live tree really does list markers that are not families — the case this rule refuses to call a defect");
}

// ── 5. THE SHIPPED VALUES, PINNED ────────────────────────────────────────────────────
// 🔴 180 §7.3 / `floor_pin_gate.py`: a floor read by one branch and named by no claim is a
// literal anyone can move. Pinning the KEY is not pinning the VALUE — 184 §7 paid that
// twice in one session on `POPULATION_LINES_FLOOR`.
claim(FILES_FLOOR === 10, `the shipped file floor is 10, not ${FILES_FLOOR}`);
claim(SEAL_FLOOR === 95, `the shipped seal floor is 95, not ${SEAL_FLOOR}`);
claim(Object.keys(CLAIM_SITE_FLOORS).length === 11, `eleven per-file floors ship, not ${Object.keys(CLAIM_SITE_FLOORS).length}`);
claim(ANNOUNCED_REGIONS_FLOOR === 80, `the shipped coverage floor is 80, not ${ANNOUNCED_REGIONS_FLOOR}`);
claim(MARKER_HEADER_FILES_FLOOR === 9, `the shipped marker-header coverage floor is 9, not ${MARKER_HEADER_FILES_FLOOR}`);
claim(HEADER_FAMILY_FLOOR === 85, `the shipped header-family floor is 85, not ${HEADER_FAMILY_FLOOR}`);
claim(CLAIM_FLOOR === 95, `the shipped claim floor is 95, not ${CLAIM_FLOOR}`);

console.log(`\nSEAL_ORDER_SELFTEST ${ran - bad}/${ran} claims`);
if (bad) { console.log(`🔴 SEAL_ORDER_SELFTEST FAILED — ${bad} of ${ran}`); process.exit(1); }
if (ran < CLAIM_FLOOR) { console.log(`🔴 SEAL_ORDER_SELFTEST ran ${ran} claims, floor is ${CLAIM_FLOOR} — cases were deleted or stopped running`); process.exit(1); }
console.log("SEAL_ORDER_SELFTEST ok");

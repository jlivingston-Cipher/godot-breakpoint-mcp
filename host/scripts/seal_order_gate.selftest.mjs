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
  inspect, judge, scan, claimCallees,
  FILES_FLOOR, SEAL_FLOOR, CLAIM_SITE_FLOORS, NOT_A_PROBE,
} from "./seal_order_gate.mjs";

let ran = 0, bad = 0;
const claim = (cond, what) => {
  ran++;
  if (!cond) { bad++; console.log(`🔴 FAILED: ${what}`); }
};
// 🔴 NAMED AND PINNED, for 176's reason, carried: a bare `if (ran < 40)` is read by one
// branch and asserted by nothing, so the collapse detector can be switched off without a
// single case noticing. This is the floor that protects the floors.
const CLAIM_FLOOR = 55;

const said = (r, needle) => r.lines.some((l) => l.includes(needle));
// Judge one hand-written source with every floor relaxed, so a case fails for its own
// reason rather than for the roster's size.
const J = (text, opts = {}) => judge([inspect("probe.integration.mjs", text)], {
  filesFloor: 1, sealFloor: 1, siteFloors: { "probe.integration.mjs": 0 }, roster: {}, ...opts,
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
claim(judge([], { filesFloor: 0, sealFloor: 0, roster: {} }).failed === false,
  "and an empty population with floors of zero is not a failure — the floors are what make it one");
// 🔴 WRITTEN WITHOUT `roster: {}` FIRST AND CAUGHT ITSELF ON THE FIRST RUN. The default
// roster excuses one real file, so an EMPTY population makes that entry dead — the gate
// was right and the case was wrong. Kept as a case, because it is the interaction the
// two checks have with each other and nothing else asserts it.
claim(judge([], { filesFloor: 0, sealFloor: 0 }).failed === true,
  "an empty population with the SHIPPED roster is a failure — every exemption in it is dead");

// 🔴 THE PER-FILE FLOOR, WHICH IS THE ONE THAT STOPS THIS GATE PASSING A FILE IT CANNOT
// READ. Zero claim sites can never sit after a seal, so an unreadable file is green on
// every other check in this file.
const UNREADABLE = `population.seal("A", "ok");\n`;
claim(judge([inspect("probe.integration.mjs", UNREADABLE)],
  { filesFloor: 1, sealFloor: 1, siteFloors: { "probe.integration.mjs": 5 }, roster: {} }).failed === true,
  "🔴 a file whose claim idiom the finder cannot read is a FAILURE, not a clean file");
claim(said(judge([inspect("probe.integration.mjs", UNREADABLE)],
  { filesFloor: 1, sealFloor: 1, siteFloors: { "probe.integration.mjs": 5 }, roster: {} }), "SEAL_ORDER_UNREADABLE"),
  "and it is named as an unreadable idiom rather than as zero offenders");
claim(judge([inspect("probe.integration.mjs", CLEAN)],
  { filesFloor: 1, sealFloor: 1, siteFloors: {}, roster: {} }).failed === true,
  "🔴 and a sealing file with NO floor entry at all fails — a new probe must declare what to find in it");
claim(said(judge([inspect("probe.integration.mjs", CLEAN)],
  { filesFloor: 1, sealFloor: 1, siteFloors: {}, roster: {} }), "SEAL_ORDER_UNFLOORED"), "named UNFLOORED");

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
  roster: { "probe.integration.mjs": "excused" } }).failed === true,
  "🔴 an exemption for a file that trips NOTHING is a failure — a decision that stopped being one");
claim(said(judge([cleanFile], { filesFloor: 1, sealFloor: 1, siteFloors: { "probe.integration.mjs": 0 },
  roster: { "probe.integration.mjs": "excused" } }), "SEAL_ORDER_ROSTER_STALE"), "named ROSTER_STALE");

const dirtyFile = inspect("probe.integration.mjs", TRAILING);
{
  const r = judge([dirtyFile], { filesFloor: 1, sealFloor: 1, siteFloors: { "probe.integration.mjs": 0 },
    roster: { "probe.integration.mjs": "a real reason" } });
  claim(r.failed === false, "an EARNED exemption suppresses the failure");
  claim(said(r, "exempt  probe.integration.mjs"),
    "🔴 and prints the excused file with its reason — an exemption nobody sees is an exemption nobody re-reads");
  claim(said(r, "a real reason"), "including the reason itself, not just the filename");
}
claim(Object.keys(NOT_A_PROBE).length === 1 && NOT_A_PROBE["_population.selftest.mjs"],
  "the shipped roster excuses exactly one file, the instrument's own self-test");
claim(NOT_A_PROBE["_population.selftest.mjs"].length > 80,
  "and the reason is prose a reviewer can disagree with, not a word");

// ── 5. THE SHIPPED VALUES, PINNED ────────────────────────────────────────────────────
// 🔴 180 §7.3 / `floor_pin_gate.py`: a floor read by one branch and named by no claim is a
// literal anyone can move. Pinning the KEY is not pinning the VALUE — 184 §7 paid that
// twice in one session on `POPULATION_LINES_FLOOR`.
claim(FILES_FLOOR === 10, `the shipped file floor is 10, not ${FILES_FLOOR}`);
claim(SEAL_FLOOR === 95, `the shipped seal floor is 95, not ${SEAL_FLOOR}`);
claim(Object.keys(CLAIM_SITE_FLOORS).length === 11, `eleven per-file floors ship, not ${Object.keys(CLAIM_SITE_FLOORS).length}`);
claim(CLAIM_FLOOR === 55, `the shipped claim floor is 55, not ${CLAIM_FLOOR}`);

console.log(`\nSEAL_ORDER_SELFTEST ${ran - bad}/${ran} claims`);
if (bad) { console.log(`🔴 SEAL_ORDER_SELFTEST FAILED — ${bad} of ${ran}`); process.exit(1); }
if (ran < CLAIM_FLOOR) { console.log(`🔴 SEAL_ORDER_SELFTEST ran ${ran} claims, floor is ${CLAIM_FLOOR} — cases were deleted or stopped running`); process.exit(1); }
console.log("SEAL_ORDER_SELFTEST ok");

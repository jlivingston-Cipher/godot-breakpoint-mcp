// _path_ledger.selftest.mjs — THE GATE ON THE LEDGER GATE.
//
// The four claims that decide whether the live path cohort and `path-cohort-ledger.tsv`
// agree have run, since session 167, in exactly one place: inside a probe that boots the
// Godot editor GUI under Xvfb. They were never once executed against a case whose right
// answer was written down first.
//
// That is the gap 173 found answering 172 §10.2. The blinding harness needs a gate to
// point at; `comparePathLedger` had none, so no amount of blinding could say anything
// about it. Each case below is a population that is healthy, or one that collapsed in a
// specific way, with the verdict written down before the code ran (169 §2's discipline).
import { comparePathLedger as compareAtScale, parsePathLedger, ledgerScopeFailures, LEDGER_CANARIES, LEDGER_CLASSES, LEDGER_SCOPE, LEDGER_POPULATION } from "./_path_ledger.mjs";

let failures = 0;
const claims = [];
function check(cond, name, detail = "") {
  claims.push(name);
  if (cond) { console.log(`  ok   ${name}${detail ? ` — ${detail}` : ""}`); return true; }
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
  return false;
}

// The two canaries are the fixed points every case below is built around: a healthy
// ledger must classify them, and a blind enumerator must lose them.
const CANARY_ROWS = LEDGER_CANARIES.map(([tool, param]) => ({ tool, param }));
const canaryLines = LEDGER_CANARIES.map(([t, p]) => `${t}\t${p}\tguarded\tthe canary's own row`);
const line = (t, p, cls = "guarded", why = "a reason") => `${t}\t${p}\t${cls}\t${why}`;
const ledgerOf = (...extra) => ["# a ledger", "", ...canaryLines, ...extra].join("\n");
const rowsOf = (...extra) => [...CANARY_ROWS, ...extra];

// 🔴 180 — `comparePathLedger` NOW FLOORS THE TWO SIDES IT COMPARES, and every fixture in
// this file is three rows. The floor is a PARAMETER for exactly this reason (173's move,
// mirrored): a fixture states the scale it is testing at, so a case about `stale` is not
// also a case about the population size. `FIXTURE_SCALE` is named and zero rather than
// absent, so nothing here quietly opts out of a floor it should be meeting — the SHIPPED
// default gets its own section below, driven from both sides.
const FIXTURE_SCALE = Object.freeze({ live: 0, ledger: 0 });
const comparePathLedger = (rows, ledger, pop = FIXTURE_SCALE) => compareAtScale(rows, ledger, pop);

// ────────────────────────────────────────────────────────────── the healthy run
console.log("\n-- agreement --");
{
  const r = comparePathLedger(rowsOf({ tool: "a_tool", param: "path" }), ledgerOf(line("a_tool", "path")));
  check(r.unclassified.length === 0, "AGREE_NOTHING_UNCLASSIFIED every live row has an entry");
  check(r.stale.length === 0, "AGREE_NOTHING_STALE every entry has a live row");
  check(r.badClass.length === 0, "AGREE_WELLFORMED every entry carries a known class and a reason");
  check(r.lost.length === 0, "AGREE_CANARIES_PRESENT both canaries are enumerated");
  check(r.scope.length === 0, "AGREE_SCOPE_HELD the gate's own two populations are at their floors");
  check(r.liveCount === 3 && r.ledgerCount === 3, "AGREE_COUNTS both sides report their size", `live=${r.liveCount} ledger=${r.ledgerCount}`);
}

// ───────────────────────────────────────────────────── the two directions, apart
console.log("\n-- disagreement, each direction --");
{
  // a parameter entered the surface and nobody classified it
  const r = comparePathLedger(rowsOf({ tool: "new_tool", param: "target_path" }), ledgerOf());
  check(r.unclassified.length === 1 && r.unclassified[0] === "new_tool\ttarget_path",
    "UNCLASSIFIED names the parameter nobody classified", r.unclassified.join(","));
  check(r.stale.length === 0, "UNCLASSIFIED_ONLY the other direction stays quiet");
}
{
  // a classification outlived the thing it classified
  const r = comparePathLedger(rowsOf(), ledgerOf(line("deleted_tool", "path")));
  check(r.stale.length === 1 && r.stale[0] === "deleted_tool\tpath",
    "STALE names the entry that outlived its parameter", r.stale.join(","));
  check(r.unclassified.length === 0, "STALE_ONLY the other direction stays quiet");
}

// ──────────────────────────────────────────────────────────────── malformed rows
console.log("\n-- wellformedness --");
{
  const r = comparePathLedger(rowsOf({ tool: "t", param: "p" }), ledgerOf(line("t", "p", "vibes", "sure")));
  check(r.badClass.length === 1 && r.badClass[0].includes("vibes"), "BADCLASS an unknown class is rejected", r.badClass.join(";"));
  check(r.unclassified.length === 1, "BADCLASS_NOT_AN_ENTRY a rejected row does not classify its parameter");
}
{
  const r = comparePathLedger(rowsOf({ tool: "t", param: "p" }), ledgerOf(`t\tp\tguarded\t   `));
  check(r.badClass.length === 1 && r.badClass[0].includes("no reason"),
    "NO_REASON a classification nobody has to defend is rejected", r.badClass.join(";"));
}
{
  const r = parsePathLedger("# only a comment\n\n   \n");
  check(r.entries.size === 0 && r.badClass.length === 0, "PARSE_SKIPS comments and blank lines are not rows");
}

// ──────────────────────────────────────── 🔴 THE CASE THE PROBE COMMENT DESCRIBES
//
// A blind enumerator shrinks the live set, so `unclassified` is empty. `stale` catches
// that only while the ledger still holds the lost rows — so a session that REGENERATED
// the ledger from the blind enumerator takes BOTH claims green together. That is why
// the canaries name parameters instead of counting them, and until now the sentence
// saying so had never been executed.
console.log("\n-- the blind enumerator, and the ledger regenerated from it --");
{
  const r = comparePathLedger([], "# a ledger regenerated from a blind enumerator\n");
  check(r.unclassified.length === 0, "BLIND_UNCLASSIFIED_SILENT the shrunken side reports nothing unclassified");
  check(r.stale.length === 0, "BLIND_STALE_SILENT a regenerated ledger leaves nothing stale");
  check(r.lost.length === LEDGER_CANARIES.length,
    "BLIND_CANARY_IS_THE_ONLY_ONE_LEFT the canaries are what catches it", `lost=${r.lost.length}`);
}
{
  // the partial blindness: only the `path`-named cohort discarded (enum163's line 2).
  const rows = rowsOf().filter((r) => r.param !== "path");
  const res = comparePathLedger(rows, ledgerOf());
  check(res.lost.length === 1 && res.lost[0][0] === "theme_set_font",
    "BLIND_PARTIAL_CANARY one canary lost names which blindness returned", res.lost.map((x) => x[0]).join(","));
  check(res.stale.length === 1, "BLIND_PARTIAL_ALSO_STALE the un-regenerated ledger still notices");
}

// ───────────────────────────────────────── 🔴 THE GATE'S OWN SCOPE, THE 173 FINDING
//
// `canaries.filter(...)` over an EMPTIED list returns nothing, and the claim reads
// "both blindness canaries are still enumerated". Measured against the shipped gate,
// that is exactly what it printed. `_population.mjs` takes `scope` as a separate
// argument for this reason; the ledger gate, written five sessions later, had none.
console.log("\n-- the gate's own populations --");
{
  check(LEDGER_CANARIES.length >= LEDGER_SCOPE.canaries,
    "SCOPE_CANARY_FLOOR the canary list is at or above its literal floor", `${LEDGER_CANARIES.length}/${LEDGER_SCOPE.canaries}`);
  check(LEDGER_CLASSES.length >= LEDGER_SCOPE.classes,
    "SCOPE_CLASS_FLOOR the class list is at or above its literal floor", `${LEDGER_CLASSES.length}/${LEDGER_SCOPE.classes}`);
  check(Object.isFrozen(LEDGER_CANARIES) && Object.isFrozen(LEDGER_CLASSES),
    "SCOPE_FROZEN neither population can be emptied at runtime by a probe that imports it");
}
{
  // 🔴 THE POSITIVE CASE, AND THE REVERSE SWEEP IS WHY IT EXISTS.
  //
  // The first draft of this file only ever asserted `scope` was EMPTY, on a healthy
  // population — so deleting the scope check outright left every gate in the tree green,
  // and G3 caught it in the code written to fix 173. A collector asserted only empty is
  // a collector nobody has proved collects. `ledgerScopeFailures` takes its populations
  // as parameters for exactly this: the collapse is one call away.
  const noCanaries = ledgerScopeFailures([], LEDGER_CLASSES);
  check(noCanaries.length === 1 && noCanaries[0].includes("LEDGER_CANARIES holds 0"),
    "SCOPE_COLLAPSE_CANARY an emptied canary list PRODUCES a named failure", noCanaries[0]?.slice(0, 52));

  const noClasses = ledgerScopeFailures(LEDGER_CANARIES, []);
  check(noClasses.length === 1 && noClasses[0].includes("LEDGER_CLASSES holds 0"),
    "SCOPE_COLLAPSE_CLASS an emptied class list PRODUCES a named failure", noClasses[0]?.slice(0, 52));

  // and one line per population, never a sum: both collapsed reports TWO, not one.
  check(ledgerScopeFailures([], []).length === 2,
    "SCOPE_ONE_LINE_PER_POPULATION two collapses report two lines, not one total (172 §6)");

  check(ledgerScopeFailures().length === 0,
    "SCOPE_HEALTHY_IS_QUIET ...and the shipped populations produce none");
}

// ──────────────────────────────────────────────────────── defensive input shapes
console.log("\n-- shapes --");
{
  const r = comparePathLedger(null, null);
  check(r.liveCount === 0 && r.ledgerCount === 0, "SHAPES_NULL a null on either side is empty, not a throw");
  check(r.lost.length === LEDGER_CANARIES.length, "SHAPES_NULL_LOUD ...and it still loses both canaries");
}

// ─────────────────────────── 180: THE POPULATION THIS GATE COMPARES, floored at last
//
// 179 §11.2 asked five instruments whether every floor they hold can hold while the
// number they exist to produce goes to zero. `LEDGER_SCOPE` floors this gate's OWN
// roster; nothing floored `liveCount` or `ledgerCount`. The hole was already written in
// prose above `LEDGER_CANARIES` — *"a session that REGENERATED the ledger from a blind
// enumerator would take both green together"* — and had never been executed. It was, in
// `_to_delete/measure180d.mjs`, and it was true: two rows of 258, every claim passing,
// the probe printing "all 2 path-like parameters in the live surface are classified".
//
// 🔴 AND THE FLOOR ALREADY EXISTED, IN THE OTHER CALLER. `scripts/path-cohort.mjs` pins
// `sum.total >= 250` before it calls this function; `authoring-plane.integration.mjs`
// calls the same function with nothing under it. 179's meta-rule verbatim: an instrument
// enforces its rules where they were WRITTEN, not where its population COMES FROM.
console.log("\n-- population (180) --");
{
  const two = rowsOf();                       // exactly the two canaries: a blind enumerator
  const r = compareAtScale(two, ledgerOf());  // …and a ledger regenerated from it
  check(r.unclassified.length === 0 && r.stale.length === 0 && r.lost.length === 0,
    "POP_THE_QUIET_CASE every OTHER claim is green — this is why a floor was needed",
    `unclassified=${r.unclassified.length} stale=${r.stale.length} lost=${r.lost.length}`);
  check(r.scope.length === 2, "POP_BOTH_SIDES_COLLAPSE and both sides report, separately (172 §6)", `scope=${r.scope.length}`);
  check(r.scope.some((s) => s.includes("LIVE cohort")), "POP_LIVE_NAMED the live side names itself");
  check(r.scope.some((s) => s.includes("LEDGER holds")), "POP_LEDGER_NAMED …and so does the ledger side");
}
{
  // ONE side at a time, because a shared total would let either hide behind the other.
  const live = Array.from({ length: LEDGER_POPULATION.live }, (_, i) => ({ tool: `t${i}`, param: "path" }));
  const full = ["# a ledger", ...live.map((r) => line(r.tool, r.param))].join("\n");
  check(compareAtScale(live, full).scope.length === 0, "POP_AT_THE_FLOOR exactly at both floors is quiet");
  check(compareAtScale(live.slice(1), full).scope.some((s) => s.includes("LIVE cohort")),
    "POP_LIVE_ALONE one row below on the LIVE side alone reddens");
  const short = ["# a ledger", ...live.slice(1).map((r) => line(r.tool, r.param))].join("\n");
  check(compareAtScale(live, short).scope.some((s) => s.includes("LEDGER holds")),
    "POP_LEDGER_ALONE …and one entry below on the LEDGER side alone reddens");
}
check(LEDGER_POPULATION.live >= 200 && LEDGER_POPULATION.ledger >= 200,
  "POP_FLOOR_IS_A_LITERAL the shipped floor is a measured literal with headroom, not a rounding of zero",
  `live=${LEDGER_POPULATION.live} ledger=${LEDGER_POPULATION.ledger}`);
check(Object.isFrozen(LEDGER_POPULATION), "POP_FROZEN it cannot be lowered at runtime by a probe that imports it");
// 🔴 THE DEFAULT IS THE SHIPPED ONE. Every fixture above passes FIXTURE_SCALE; this is
// the claim that stops the override from quietly becoming the norm.
check(ledgerScopeFailures(LEDGER_CANARIES, LEDGER_CLASSES, 0, 0).length === 2,
  "POP_DEFAULT_IS_SHIPPED called with no `pop`, the floors are LEDGER_POPULATION's — not zero");

// ──────────────────────────────────────────────────────── population + summary
//
// This file has a population of its own, for the reason every other gate here does.
const SELFTEST_CLAIM_FLOOR = 30;   // 180: 22 -> 30 (the population section)
// 🔴 AND THE FLOOR'S OWN VALUE IS PINNED, because `mutate180`'s G15 set it to 0 and this
// file stayed GREEN. A `<` floor with nothing asserting what it IS can be zeroed
// invisibly: the run still passes, the population line still prints, and the only thing
// that changed is that the floor stopped being one. `verdict_gate.selftest.mjs` pins
// `SUBJECT_FLOOR === 4` and `DISCARD_SITE_FLOOR === 55` for exactly this reason; this
// file, three sessions older, never did.
check(SELFTEST_CLAIM_FLOOR === 30, "SELFTEST_FLOOR_PINNED the claim floor is 30, not whatever it was last set to");
console.log(`\nLEDGER_SELFTEST_CLAIMS ${claims.length} (floor ${SELFTEST_CLAIM_FLOOR})`);
if (claims.length < SELFTEST_CLAIM_FLOOR) {
  console.log(`  FAIL LEDGER_SELFTEST_POPULATION — only ${claims.length} claim(s) ran, floor is ${SELFTEST_CLAIM_FLOOR}`);
  failures++;
}
if (new Set(claims).size !== claims.length) {
  console.log("  FAIL LEDGER_SELFTEST_POPULATION — two claims share a name, so one of them is not being read");
  failures++;
}

if (failures) {
  console.error(`::error::LEDGER_SELFTEST FAILED — ${failures} claim(s) did not hold; the path-cohort ledger gate is not trustworthy`);
  process.exit(1);
}
console.log(`\nLEDGER_SELFTEST ok every claim held (${claims.length} claim(s) ran)`);

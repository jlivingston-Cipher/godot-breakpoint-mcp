// _population.selftest.mjs — THE GATE ON THE GATE.
//
// `_population.mjs` is the only thing standing between twelve live probes and 169
// §4's "…_ALL ok every claim held", which is true of the empty set. If the
// instrument silently stopped counting, all twelve would go back to reporting
// coverage they no longer have — and they would do it in green.
//
// 169 §2 is the reason this file exists rather than a comment claiming the
// instrument works: that session's enumerator was WRONG THREE TIMES, and each
// time the only thing that caught it was checking the instrument against a case
// whose right answer was known independently. Every case below is one of those:
// a population that is healthy, or one that shrank in a specific way, with the
// verdict written down before the code ran.
//
// Deliberately NOT a node:test file. It has no dependencies, needs no compile
// step, and lives beside the thing it checks; the `ci` job runs it directly.
import nodeAssert from "node:assert";
import { Population } from "./_population.mjs";

import { spawnSync } from "node:child_process";

let failures = 0;
const claims = [];
function check(cond, name, detail = "") {
  claims.push(name);
  if (cond) { console.log(`  ok   ${name}${detail ? ` — ${detail}` : ""}`); return true; }
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
  return false;
}
const gates = (f) => f.map((x) => x.split(" — ")[0].replace(/^T_POPULATION_?/, "")).filter(Boolean).sort().join(",");

// Silence the instrument's own console output; the verdicts below are the point.
const realLog = console.log;
const quiet = (fn) => { console.log = () => {}; try { return fn(); } finally { console.log = realLog; } };

// ─────────────────────────────────────────────── the SEAL shape (fail-fast probes)
console.log("\n-- seal shape --");

// A complete run: two sections, three assertions, nothing missing.
check(gates(quiet(() => {
  const p = new Population("T", { families: ["A", "B"], scope: 2, claims: 3 });
  const assert = p.assert;
  assert.ok(true); assert.equal(1, 1); p.seal("A", "ok");
  assert.ok(true); p.seal("B", "ok");
  return p.report();
})) === "", "SEAL_HEALTHY a complete run trips no gate");

// 🔴 THE CASE THAT MOTIVATED `vacuous`: every assertion under a marker deleted,
// the marker itself left in place. The old probes printed this and exited 0.
check(gates(quiet(() => {
  const p = new Population("T", { families: ["A", "B"], scope: 2, claims: 3 });
  const assert = p.assert;
  assert.ok(true); assert.equal(1, 1); assert.ok(true); p.seal("A", "ok");
  p.seal("B", "ok");                      // <- asserts nothing, still says ok
  return p.report();
})) === "VACUOUS", "SEAL_VACUOUS a marker that outlived its claims is caught");

// A whole section skipped — by a conditional, or by a throw upstream of it.
check(gates(quiet(() => {
  const p = new Population("T", { families: ["A", "B"], scope: 2, claims: 3 });
  const assert = p.assert;
  assert.ok(true); assert.equal(1, 1); assert.ok(true); p.seal("A", "ok");
  return p.report();
})) === "SILENT", "SEAL_SILENT a section that never ran is caught");

// Sections all present, assertions thinned out inside them.
check(gates(quiet(() => {
  const p = new Population("T", { families: ["A", "B"], scope: 2, claims: 5 });
  const assert = p.assert;
  assert.ok(true); p.seal("A", "ok"); assert.ok(true); p.seal("B", "ok");
  return p.report();
})) === "FLOOR", "SEAL_FLOOR a suite that got smaller is caught even with every family present");

// ────────────────────────────────────── the TALLY and OPEN shapes
console.log("\n-- tally + open shapes --");

check(gates(quiet(() => {
  const p = new Population("T", { families: ["A", "B"], scope: 2, claims: 3 });
  p.claim("A"); p.claim("A"); p.claim("B");
  return p.report();
})) === "", "TALLY_HEALTHY an explicit-family run trips no gate");

check(gates(quiet(() => {
  const p = new Population("T", { families: ["A", "B"], scope: 2, claims: 3 });
  p.claim("A"); p.claim("A"); p.claim("A");
  return p.report();
})) === "SILENT", "TALLY_SILENT a marker that stopped being reached is caught");

check(gates(quiet(() => {
  const p = new Population("T", { families: ["S1", "S2"], scope: 2, claims: 2 });
  const assert = p.assert;
  p.open("S1"); assert.ok(true);
  p.open("S2"); assert.ok(true);
  return p.report();
})) === "", "OPEN_HEALTHY a header-first run trips no gate");

check(gates(quiet(() => {
  const p = new Population("T", { families: ["S1", "S2"], scope: 2, claims: 1 });
  const assert = p.assert;
  p.open("S1"); assert.ok(true);
  p.open("S2");                            // <- opened, emptied
  return p.report();
})) === "VACUOUS", "OPEN_VACUOUS an opened section that asserts nothing is caught");

// ─────────────────────────── the WRAPPED shape (`family()`, throws contained)
console.log("\n-- family shape --");

check(gates(await (async () => {
  const p = new Population("T", { families: ["A", "B"], scope: 2, claims: 2 });
  await p.family("A", async () => p.claim());
  await p.family("B", async () => p.claim());
  return quiet(() => p.report());
})()) === "", "FAMILY_HEALTHY a run where both families complete trips no gate");

// 🔴 168's 207 -> 189: the family throws AFTER claiming, so the claims it had not
// reached are dropped rather than failed, and the pass RATE stays 100%.
check(gates(await (async () => {
  const p = new Population("T", { families: ["A", "B"], scope: 2, claims: 2 });
  await p.family("A", async () => { p.claim(); throw new Error("halfway"); });
  await p.family("B", async () => p.claim());
  return quiet(() => p.report());
})()) === "PARTIAL", "FAMILY_PARTIAL a family that threw after claiming is caught");

// A family that throws on its FIRST call is the loud case: it made nothing, so it
// reads as vacuous rather than partial — and either way it does not pass.
check(gates(await (async () => {
  const p = new Population("T", { families: ["A", "B"], scope: 2, claims: 1 });
  await p.family("A", async () => { throw new Error("immediately"); });
  await p.family("B", async () => p.claim());
  return quiet(() => p.report());
})()) === "VACUOUS", "FAMILY_EMPTY a family that threw before claiming is caught");

// The probe's own failure marker still fires, and the claim it makes is counted
// AFTER `made` so "what the body actually claimed" stays honest.
{
  const p = new Population("T", { families: ["A"], scope: 1, claims: 1 });
  const seen = [];
  const r = await p.family("A", async () => { p.claim(); throw new Error("boom"); }, (l, t) => { seen.push(`${l}:${t}`); p.claim(); });
  check(seen.length === 1 && seen[0].startsWith("A:boom"), "FAMILY_ONTHROW the probe's own _THREW marker still fires", seen[0]);
  check(r.made === 1, "FAMILY_MADE_EXCLUDES_THREW the _THREW claim is not counted as body work", `made=${r.made}`);
  quiet(() => p.report());
}

// 🔴 THE HOLE THE TABLETOP MUTANT FOUND (session 170, measured against the real probe).
// The `_THREW` marker is itself a claim. While the family was still open it landed ON
// the family, so a family that threw before asserting anything read as having spoken
// once and VACUOUS stayed quiet — the exact shape this whole session is about.
check(gates(await (async () => {
  const p = new Population("T", { families: ["A", "B"], scope: 2, claims: 1 });
  await p.family("A", async () => { throw new Error("before any claim"); }, () => p.claim());
  await p.family("B", async () => p.claim());
  return quiet(() => p.report());
})()) === "VACUOUS", "FAMILY_THREW_IS_NOT_A_CLAIM the _THREW marker cannot satisfy the family it reports on");

// ────────────────────────────────────── the gate's OWN scope (168 §6)
console.log("\n-- scope --");

check(gates(quiet(() => {
  const p = new Population("T", { families: ["A"], scope: 4, claims: 1 });
  p.claim("A");
  return p.report();
})) === "SCOPE", "SCOPE a manifest emptied below its literal floor is caught");

// A manifest cannot be empty at all, and the floors must be real numbers — an
// instrument constructed wrong must refuse to run rather than pass vacuously.
for (const [name, opts] of [
  ["no families", { families: [], scope: 0, claims: 0 }],
  ["no scope floor", { families: ["A"], claims: 0 }],
  ["no claim floor", { families: ["A"], scope: 1 }],
]) {
  let threw = false;
  try { new Population("T", opts); } catch { threw = true; }
  check(threw, `CONSTRUCT_REFUSES ${name}`);
}
let noPrefix = false;
try { new Population("", { families: ["A"], scope: 1, claims: 1 }); } catch { noPrefix = true; }
check(noPrefix, "CONSTRUCT_REFUSES no prefix");

// ────────────────────────────────────── the proxy must be TRANSPARENT
console.log("\n-- the counting proxy --");
{
  const p = new Population("T", { families: ["A"], scope: 1, claims: 1 });
  const assert = p.assert;
  let msg = null;
  try { assert.equal(1, 2, "the probe's own message"); } catch (e) { msg = String(e?.message ?? ""); }
  check(msg !== null && msg.includes("the probe's own message"), "PROXY_STILL_THROWS a red assertion throws with its own message", msg?.slice(0, 40));
  check(p.total === 1, "PROXY_COUNTS_THE_RED_ONE the throwing call was still counted", `total=${p.total}`);
  check(assert.ok === assert.ok, "PROXY_STABLE_IDENTITY assert.ok is the same function twice");
  // 🔴 174: THIS CLAIM USED TO READ `typeof assert.AssertionError === "function"` AND
  // IT WAS GREEN OVER A REAL DEFECT. The proxy wrapped every function-valued property
  // in an ARROW, and an arrow cannot be constructed — so AssertionError did not survive
  // the proxy at all, and the claim named for its survival passed because the wrapper
  // that broke it is also a function. A wrong answer of the right type: the exact shape
  // `tautology_gate.mjs` exists to catch, in a file its `_`-prefix filter never swept.
  // Identity and constructability, now, because those are what "survives" means.
  check(assert.AssertionError === nodeAssert.AssertionError,
    "PROXY_PASSES_NON_METHODS AssertionError comes through as the REAL class, not a wrapper");
  let built = null;
  try { built = new assert.AssertionError({ message: "constructed through the proxy" }); } catch { /* left null */ }
  check(built instanceof nodeAssert.AssertionError,
    "PROXY_NON_METHOD_CONSTRUCTS ...and `new` through it still builds a real AssertionError", built ? "built" : "THREW");
  check(p.total === 1,
    "PROXY_CONSTRUCT_IS_NOT_A_CLAIM building an error object did not inflate the population", `total=${p.total}`);
}
{
  // 🔴 COUNTING AT THE CALL, NOT THE SOURCE LINE. One assertion inside a helper run
  // per tool is a claim PER TOOL — the runtime population is what the floor defends.
  const p = new Population("T", { families: ["A"], scope: 1, claims: 3 });
  const assert = p.assert;
  const perTool = (n) => assert.ok(n >= 0);
  for (const n of [1, 2, 3]) perTool(n);
  quiet(() => p.seal("A", "ok"));
  check(p.total === 3, "PROXY_COUNTS_PER_CALL a looped helper counts once per execution", `total=${p.total}`);
  check(gates(quiet(() => p.report())) === "", "PROXY_COUNTS_PER_CALL ...and that satisfies the floor");
}
{
  // Claims made after the last seal are real and counted, but must never be able to
  // stand in for a family that went missing.
  const p = new Population("T", { families: ["A", "B"], scope: 2, claims: 2 });
  const assert = p.assert;
  assert.ok(true); quiet(() => p.seal("A", "ok"));
  assert.ok(true);                          // <- never sealed
  check(gates(quiet(() => p.report())) === "SILENT", "UNSEALED trailing claims count but do not satisfy a family");
}

// ─────────────────────────────────── 🔴 reportOrDie — THE 173 BLIND SPOT, MEASURED
//
// Every case above exercises `report()`. ELEVEN of the fourteen live probes never call
// it: they call `reportOrDie()`, the one member that turns a failure list into a
// non-zero exit. 173 pointed 172's blinding harness at this file and got one survivor
// out of eight — `reportOrDie() { return 0; }` left this self-test entirely GREEN.
//
// Blinded that way the eleven probes print no population line at all and exit 0, so
// every gate above it — SCOPE, SILENT, VACUOUS, PARTIAL, FLOOR — becomes decorative in
// exactly the probes that have no other backstop. The gate on the gate had tested
// everything except the last mile, which is the only part those probes use.
//
// It exits the process, so it is tested in a CHILD process. That is the point, not an
// inconvenience: "did it exit non-zero" is the claim, and it cannot be made in-process.
console.log("\n-- reportOrDie: the exit, not the report --");
{
  const POP_URL = new URL("./_population.mjs", import.meta.url).href;
  const child = (body) => spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `import { Population } from ${JSON.stringify(POP_URL)};\n${body}`],
    { encoding: "utf8" },
  );

  // healthy: it returns the claim total and the process carries on.
  const ok = child(`
    const p = new Population("T", { families: ["A"], scope: 1, claims: 1 });
    p.assert.ok(true); p.seal("A", "ok");
    console.log("RETURNED " + p.reportOrDie());
    console.log("STILL RUNNING");
  `);
  check(ok.status === 0, "ORDIE_HEALTHY_EXIT_ZERO a healthy population exits 0", `status=${ok.status}`);
  check(/RETURNED 1\b/.test(ok.stdout), "ORDIE_RETURNS_THE_TOTAL ...and returns the claim total", ok.stdout.trim().split("\n").pop());
  check(ok.stdout.includes("STILL RUNNING"), "ORDIE_HEALTHY_DOES_NOT_EXIT ...and does not stop the probe");

  // 🔴 a family that went missing: it must EXIT, not return.
  const silent = child(`
    const p = new Population("T", { families: ["A", "B"], scope: 2, claims: 1 });
    p.assert.ok(true); p.seal("A", "ok");
    p.reportOrDie();
    console.log("STILL RUNNING");
  `);
  check(silent.status === 1, "ORDIE_SILENT_EXITS_ONE a missing family exits 1", `status=${silent.status}`);
  check(!silent.stdout.includes("STILL RUNNING"),
    "ORDIE_SILENT_STOPS_THE_PROBE ...and the probe does NOT carry on past it — the claim a `return 0` breaks");
  check(silent.stderr.includes("::error::T population gate failed"),
    "ORDIE_SILENT_ANNOTATES ...and files a CI error annotation naming the prefix", silent.stderr.trim().slice(0, 60));
  check(/_POPULATION_SILENT/.test(silent.stderr), "ORDIE_SILENT_NAMES_THE_GATE ...naming which gate failed");

  // a marker that outlived its assertions, and a suite that simply got smaller.
  const vacuous = child(`
    const p = new Population("T", { families: ["A"], scope: 1, claims: 1 });
    p.seal("A", "ok");
    p.reportOrDie();
  `);
  check(vacuous.status === 1 && /_POPULATION_VACUOUS/.test(vacuous.stderr),
    "ORDIE_VACUOUS_EXITS_ONE a marker that asserted nothing exits 1", `status=${vacuous.status}`);

  const shrank = child(`
    const p = new Population("T", { families: ["A"], scope: 1, claims: 9 });
    p.assert.ok(true); p.seal("A", "ok");
    p.reportOrDie();
  `);
  check(shrank.status === 1 && /_POPULATION_FLOOR/.test(shrank.stderr),
    "ORDIE_FLOOR_EXITS_ONE a suite below its claim floor exits 1", `status=${shrank.status}`);

  // and the population line itself still reaches the log, because CI reads it.
  check(/T_POPULATION claims=/.test(silent.stdout),
    "ORDIE_PRINTS_THE_LINE the population line is printed before the exit", silent.stdout.trim().split("\n")[1]?.slice(0, 50));
}

// ────────────────────────────────────────────────────────── population + summary
//
// The self-test has a population of its own, for the same reason everything else
// here does: a `for` loop that stopped iterating would take these claims with it.
const SELFTEST_CLAIM_FLOOR = 35;
// 🔴 AND THE FLOOR'S OWN VALUE IS PINNED (181, from 180 §11.3). The third instance of
// the hole 180 §7.3 closed in `_path_ledger.selftest.mjs`: a `<` floor with nothing
// asserting its VALUE zeroes in silence. Found by sweeping every floor in the tree
// rather than by reading this file, which three sessions had already read.
check(SELFTEST_CLAIM_FLOOR === 35, "SELFTEST_FLOOR_PINNED the claim floor is 35, not whatever it was last set to");
console.log(`\nPOP_SELFTEST_CLAIMS ${claims.length} (floor ${SELFTEST_CLAIM_FLOOR})`);
if (claims.length < SELFTEST_CLAIM_FLOOR) {
  console.log(`  FAIL POP_SELFTEST_POPULATION — only ${claims.length} claim(s) ran, floor is ${SELFTEST_CLAIM_FLOOR}`);
  failures++;
}
if (new Set(claims).size !== claims.length) {
  console.log("  FAIL POP_SELFTEST_POPULATION — two claims share a name, so one of them is not being read");
  failures++;
}

if (failures) {
  console.error(`::error::POP_SELFTEST FAILED — ${failures} claim(s) did not hold; the population gate on twelve probes is not trustworthy`);
  process.exit(1);
}
console.log(`\nPOP_SELFTEST ok every claim held (${claims.length} claim(s) ran)`);

#!/usr/bin/env node
// positive_control_gate.selftest.mjs — session 219.
//
// 173's rule: an instrument with no gate is not a passing instrument. This is the gate
// for `positive_control_gate.mjs`, and it exists because that reader spent four sessions
// as a scratch probe in which FOUR separate defects each produced a clean, plausible table
// (214 §5). Not one of them would have been visible from the totals. Every one is a case
// below, written as the shape that gets the WRONG answer under the defect.
//
// Every case drives `classify()` / `judge()` with source text and hand-built rows: no
// fixture files, no tree, no compile step. 🔴 AND BOTH SIDES ARE PINNED — the catches and
// the dismissals. A finder that reds on everything constrains nothing, and 215 §4's whole
// correction was that three of the classes it reddened were not defects at all.
import {
  classify, judge, acceptance,
  DEFENDED, EXEMPT_TRAP, POPULATION_FLOORED, DEFECT, RESIDUE,
  PC_POPULATION, PC_FILES, PC_ACCEPTANCE, PC_ACCEPTANCE_MISSING,
  PC_TRAP_UNFLOORED, PC_UNDEFENDED_EXCESS, PC_UNREADABLE_EXCESS,
  CLAIM_FLOOR, FILE_FLOOR, DEFECT_CEILING, RESIDUE_CEILING, ACCEPTANCE,
} from "./positive_control_gate.mjs";

let ran = 0, bad = 0;
const claim = (cond, what) => {
  ran++;
  if (!cond) { bad++; console.log(`🔴 FAILED: ${what}`); }
};
// 🔴 NAMED AND PINNED, BECAUSE A BARE LITERAL IS UNFALSIFIABLE (176's reverse sweep).
// The floor is read by exactly one branch; asserted by nothing, it can be switched off
// without a single case noticing. This is the floor that protects the floors.
const CLAIM_FLOOR_SELF = 44;

// 🔴 THE UNIT FUNCTION IS SPELLED IN PIECES, AND IT HAS TO BE. `tautology_gate` decides
// whether a file is unit-shaped by looking for the unit function's name followed by an
// open paren and a quote ANYWHERE in its text — a string literal counts, and these
// fixtures are full of them — and a file it reads as unit-shaped gets no banner
// attribution at all. Spelled directly, every claim below becomes an orphan and
// `ORPHAN_CEILING` reddens for a reason that has nothing to do with what this file
// asserts. The fixtures need the token; this file must not contain it.
//
// 🔴 INCLUDING IN THIS COMMENT, WHICH IS HOW THE LAST ONE WAS FOUND. The first draft of
// the paragraph above quoted the token to explain why the token must not appear, and that
// one occurrence — in prose, inside backticks, in a comment — was enough to make the file
// unit-shaped again. 216 §4's finding about content shaped like syntax, two files over
// and one level funnier.
const UNIT = "te" + "st";
const ts = (body) => `import assert from "node:assert/strict";\n${body}`.replaceAll("@unit", UNIT);
const verdicts = (name, src) => classify(name, src).map((r) => r.verdict);
const one = (name, src) => classify(name, src)[0] ?? null;
const said = (r, needle) => r.lines.some((l) => l.includes(needle));
const row = (verdict, extra = {}) => ({ file: "test/x.test.ts", line: 1, unit: "u", claim: "c", verdict, ...extra });
const many = (verdict, n, extra = {}) => Array.from({ length: n }, () => row(verdict, extra));

// ── 🆕 232 — A BLINDED MEMBER MUST FAIL THIS PROOF, NOT ABORT IT ──────────────────────
// `instrument_gate.py` admitted this file as its thirteenth instrument, and its FIRST
// sweep refused two of the three blinds — not because they stayed green, but because they
// CRASHED. `classify` blinded to `[]` makes `one(...)` null and the next line calls
// `judge([null])`; `acceptance` blinded to `[]` makes `acceptance(…)[0]` undefined. Both
// throw while the ARGUMENT is being built, so this file died before printing a verdict
// line and the harness could say only "JavaScript throws on an empty" — 197 §5's
// discriminator, and 198 §9.2's fix one file over.
//
// 🔴 THE FALLBACK IS A SYMBOL, WHICH IS EQUAL TO NOTHING. A fabricated `false`/`[]` would
// satisfy some comparison somewhere and turn a crash into a PASS; `CRASHED` matches no
// verdict, no code and no boolean, so every positive claim reading it fails and says so.
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
const CRASHED = Symbol("crashed");
const jg = (...a) => safe(() => judge(...a), { lines: [], failed: CRASHED, codes: [CRASHED] });
// 🔴 AND THE FIRST DRAFT OF `ac` GUARDED THE THROW AND NOT THE EMPTY — in the file whose
// entire subject is collections that are empty for more than one reason. `acceptance`
// blinded to `[]` does not throw: it returns, and the crash happens one character later
// at `[0].ok`, OUTSIDE the wrapper. Measured, not reasoned about: the sweep still filed
// this member as a CRASH after the wrapper was in place. An empty result IS the blind,
// so it takes the same answer a throw does.
const ac = (...a) => {
  const r = safe(() => acceptance(...a), null);
  return Array.isArray(r) && r.length ? r : [{ ok: CRASHED, code: CRASHED }];
};

// ── 1. THE BOUNDARY — THE WHOLE REASON THIS READER EXISTS ────────────────────────────
// 213 §3: `assert.deepEqual(wire, [])` twice, same spelling, same binding name. A
// FILE-wide search calls both defended (212's reading); a CLAIM-scoped one calls both
// defects (211's proposal). Only the test BLOCK separates them.
const BOUNDARY = ts(`
@unit("no control anywhere in this unit", () => {
  const wire = [];
  refuse();
  assert.deepEqual(wire, [], "nothing may reach the wire");
});
@unit("the same spelling, four lines above its own control", () => {
  const wire = [];
  assert.deepEqual(wire, [], "nothing may reach the wire");
  legal();
  assert.equal(wire.length, 1, "and a legal call still reaches it");
});`);
claim(verdicts("test/b.test.ts", BOUNDARY).join(",") === `${DEFECT},${DEFENDED}`,
  "the boundary pair is split: the undefended unit is a DEFECT, the defended one is not");

// ── 2. 214 §5.1 — `Object.keys` IS NOT A DERIVATION OF `Object` ──────────────────────
// `keys` and `values` are both instance derivers and `Object.` statics. A DERIVER_METHODS
// test that runs first walks to the global and files the claim against an unresolvable
// binding literally named `Object` — four claims did exactly that.
const STATIC = ts(`
@unit("the static form resolves to its argument", () => {
  const TOOLS = ["a", "b"];
  const stale = Object.keys(TOOLS).filter((n) => !live(n));
  assert.deepEqual(stale, [], "no stale names");
});`);
claim(one("test/s.test.ts", STATIC)?.verdict === DEFENDED,
  "🔴 Object.keys(TOOLS) resolves to TOOLS — whose non-empty literal defends the claim");
claim(/non-empty array literal/.test(one("test/s.test.ts", STATIC)?.why ?? ""),
  "…and it says so by the terminal it reached, not by finding a control");
claim(/←  TOOLS  ←/.test(one("test/s.test.ts", STATIC)?.chain ?? ""),
  "🔴 and the chain passes THROUGH `TOOLS` — under the defect it walks to the global instead");
claim(/<non-empty-literal>$/.test(one("test/s.test.ts", STATIC)?.chain ?? ""),
  "…ending in the literal that answers the question, not in an unresolvable binding");

// ── 3. 214 §5.2 — DESTRUCTURING IS VISIBLE, AND IT IS NAMED ──────────────────────────
// `const { wire } = planeFor(root)` resolved to nothing, so eight claims bottomed out in
// an unresolved binding — including three acceptance members, which flagged for the WRONG
// REASON. A destructured binding is reported as such rather than treated as absent.
// The helper is the tree's own shape and it is load-bearing here: `analyze` resolves the
// leaf by NAME across the file, so `wire` is a claim at all only because `planeFor`
// declares one. The destructuring is what THIS reader has to see through, one level up.
const DESTRUCTURED = ts(`
const planeFor = (root) => { const wire = []; return { handlers: mk(wire), wire }; };
@unit("a destructured collection", () => {
  const { wire } = planeFor(root);
  refuse();
  assert.deepEqual(wire, [], "nothing may reach the wire");
});`);
claim(one("test/d.test.ts", DESTRUCTURED)?.verdict === DEFECT,
  "a destructured collection with no control is still a defect");
claim(/destructured-binding/.test(one("test/d.test.ts", DESTRUCTURED)?.chain ?? ""),
  "🔴 and the chain SAYS destructured-binding — flagging for the right reason is the fix");
claim(one("test/d.test.ts", DESTRUCTURED)?.verdict !== RESIDUE,
  "…and it is not residue: the reader can read this, it just found nothing to defend it");

// ── 4. 214 §5.3 — THE UNIT'S SPAN CONTAINS ITS OWN CLAIM ─────────────────────────────
// 🔴 A SECTION OWNER CAN SIT BELOW ITS CLAIMS. `_population.mjs`'s FAIL-FAST idiom
// attributes a claim to the next `seal()` underneath it, so a span of
// `[owner.line, next owner.line)` searches the wrong half of the file — and returns a
// clean DEFECT verdict from having looked in the wrong place. The span is the min/max of
// the lines the owner actually owns, which cannot have that failure because the claim is
// in the set that defines it.
const BELOW = `let ran = 0, bad = 0;
const claim = (cond, what) => { ran++; if (!cond) { bad++; console.log(what); } };
const pop = new Population("x");
const live = collect();
claim(live.filter((f) => f.bad).every((f) => f.ok), "nothing offends");
claim(live.length === 4, "and the population is four");
pop.seal("THE MARKER THAT SITS BELOW ITS OWN CLAIMS");`;
const belowRow = one("scripts/below.mjs", BELOW);
claim(belowRow?.verdict === DEFENDED,
  "🔴 a control ABOVE the section marker that owns it is inside the unit, not outside");
claim(belowRow?.unit === "THE MARKER THAT SITS BELOW ITS OWN CLAIMS",
  "…and the unit is the executed marker, which is what the runtime counts by");

// ── 5. 214 §5.4 — TWO COLLECTIONS SPELLED `[]` ARE NOT ONE COLLECTION ────────────────
// 🔴 THE DEFECT THAT PASSED THE ACCEPTANCE TEST WHILE BEING WRONG. Matching a control to
// a target through the target's chain is right, but the chain still ended in the literal
// `[]` a collector is initialised to — and so does every OTHER collector's in the same
// unit. `assert.equal(events.length, 1)` was matched against two unrelated collectors on
// the strength of a shared empty array literal, and both came back defended.
const SHARED = ts(`
@unit("three empty arrays and one control", () => {
  const first = [];
  const second = [];
  const events = [];
  watch((e) => events.push(e));
  assert.deepEqual(first, [], "the first stays empty");
  assert.deepEqual(second, [], "so does the second");
  assert.equal(events.length, 1, "but THIS one filled");
});`);
claim(verdicts("test/sh.test.ts", SHARED).join(",") === `${DEFECT},${DEFECT}`,
  "🔴 a control on a THIRD binding defends neither collector — targets are rooted in a declaration");

// ── 6. 215 §4 CLASS B — THE PROCESS TRAP, AND THE FLOOR ITS EXEMPTION IS BOUGHT WITH ──
// A trap fills only when Node is about to die, so the "legal case that proves it can
// fill" would be a real uncaughtException injected into the shared test process — i.e.
// asserting the exact fault the test denies. 🔴 AND THE EXEMPTION IS DERIVED, NOT A
// ROSTER (217 §6.3): every write into the collection happens inside a process-fault
// listener, and a companion binding proves the fault path actually ran.
const TRAP_BOUND = ts(`
@unit("a rejection is not an unhandled rejection", async () => {
  const uncaught = [];
  const onUncaught = (e) => uncaught.push(e);
  process.on("uncaughtException", onUncaught);
  const events = [];
  dap.on("start_failed", (e) => events.push(e));
  await reject();
  assert.deepEqual(uncaught, [], "the rejection must not surface as an uncaught exception");
  assert.equal(events.length, 1, "the failure is announced on a distinct event name");
});`);
claim(one("test/t.test.ts", TRAP_BOUND)?.verdict === EXEMPT_TRAP,
  "🔴 a trap bound to a NAME and registered by that name is recognised — the spelling the tree uses");
claim(/floored on `events`/.test(one("test/t.test.ts", TRAP_BOUND)?.why ?? ""),
  "…and the exemption names the companion binding it was bought with");

const TRAP_INLINE = ts(`
@unit("the inline spelling", async () => {
  const uncaught = [];
  process.on("uncaughtException", (e) => uncaught.push(e));
  const events = [];
  dap.on("start_failed", (e) => events.push(e));
  await reject();
  assert.deepEqual(uncaught, [], "no uncaught exception");
  assert.equal(events.length, 1, "the failure is announced");
});`);
claim(one("test/ti.test.ts", TRAP_INLINE)?.verdict === EXEMPT_TRAP,
  "the inline listener form is the same class and is read the same way");

// 🔴 AND THE HALF THAT MAKES THE EXEMPTION MEAN ANYTHING. Without a companion floor the
// two empty arrays are a silence nobody proved was reached, which is a defect with its
// own name rather than an exemption — it must not hide inside DEFECT_CEILING.
const TRAP_BARE = ts(`
@unit("a trap with nothing proving the path ran", async () => {
  const uncaught = [];
  process.on("uncaughtException", (e) => uncaught.push(e));
  await reject();
  assert.deepEqual(uncaught, [], "no uncaught exception");
});`);
const bareRow = one("test/tb.test.ts", TRAP_BARE);
claim(bareRow?.verdict === DEFECT && bareRow?.trapUnfloored === true,
  "🔴 a trap with NO companion floor is NOT exempt — it is a defect, and a named one");
claim(said(jg([bareRow], FILE_FLOOR, []), PC_TRAP_UNFLOORED),
  `…and the judge refuses it as ${PC_TRAP_UNFLOORED} rather than counting it toward the ceiling`);

// A collector filled from an ORDINARY listener is not a trap. The exemption is for the
// events that mean the process is dying, not for every `.on(…)` in the file.
const NOT_A_TRAP = ts(`
@unit("an ordinary listener is not a process trap", async () => {
  const frames = [];
  socket.on("data", (d) => frames.push(d));
  const events = [];
  dap.on("start_failed", (e) => events.push(e));
  await run();
  assert.deepEqual(frames, [], "no frames arrived");
  assert.equal(events.length, 1, "the failure is announced");
});`);
claim(one("test/na.test.ts", NOT_A_TRAP)?.verdict === DEFECT,
  "🔴 `socket.on(\"data\")` is not a fault trap — the exemption is by EVENT, not by shape");

// ── 7. 215 §4 CLASS C — THE ACCUMULATOR, AND WHERE ITS FLOOR BELONGS ─────────────────
// An intersection can only ever fill when a real bug exists, so it cannot carry a control
// of its own. What CAN go vacuous is the POPULATION it drains — an empty registry leaves
// the assertion below green having compared [] to []. That is where the floor belongs,
// and this reader follows the accumulation to find it.
const ACCUM = ts(`
@unit("no tool is both read-only and destructive", () => {
  const contradictory = [];
  const calls = registerAll();
  assert.equal(calls.length, EXPECTED_TOOL_COUNT);
  for (const c of calls) {
    if (c.readOnly && c.destructive) contradictory.push(c.name);
  }
  assert.deepEqual(contradictory, [], "read-only AND destructive");
});`);
claim(one("test/ac.test.ts", ACCUM)?.verdict === POPULATION_FLOORED,
  "an accumulator whose iteration source is floored is POPULATION_FLOORED, not a defect");
claim(/an accumulator over `calls`/.test(one("test/ac.test.ts", ACCUM)?.why ?? ""),
  "…and it names the population it followed to get there");

const ACCUM_BARE = ts(`
@unit("the same shape with nothing flooring the population", () => {
  const contradictory = [];
  const calls = registerAll();
  for (const c of calls) {
    if (c.readOnly && c.destructive) contradictory.push(c.name);
  }
  assert.deepEqual(contradictory, [], "read-only AND destructive");
});`);
claim(one("test/ab.test.ts", ACCUM_BARE)?.verdict === DEFECT,
  "🔴 and WITHOUT that floor the same shape is a defect — the class is earned, not assumed");

const ACCUM_FOREACH = ts(`
@unit("the callback spelling of the same accumulation", () => {
  const bad = [];
  const calls = registerAll();
  assert.equal(calls.length, EXPECTED_TOOL_COUNT);
  calls.forEach((c) => { if (c.gated) bad.push(c.name); });
  assert.deepEqual(bad, [], "none is gated");
});`);
claim(one("test/af.test.ts", ACCUM_FOREACH)?.verdict === POPULATION_FLOORED,
  "`forEach` accumulates exactly as `for…of` does and is read the same way");

// ── 8. RESIDUE IS REPORTED, NOT FOLDED INTO EITHER ANSWER ────────────────────────────
// 213 §4.22: a classifier with no `unclassified` column has not classified anything, it
// has partitioned. A claim at module scope with no test() and no marker belongs to no
// unit, and saying so is the point.
const ORPHAN = `let ran = 0, bad = 0;
const claim = (cond, what) => { ran++; if (!cond) { bad++; console.log(what); } };
const live = collect();
claim(live.filter((f) => f.bad).every((f) => f.ok), "nothing offends");`;
claim(one("scripts/o.mjs", ORPHAN)?.verdict === RESIDUE,
  "an unattributed module-scope claim is RESIDUE, not a silent skip and not a defect");

// ── 9. THE JUDGE — EVERY REFUSAL BY NAME, OVER POPULATIONS THE TREE CANNOT PRODUCE ───
// 174 §8 watched a collector that was only ever asserted EMPTY lose its filter invisibly.
// These are the parameters that make each branch reachable at all.
claim(jg(many(DEFENDED, CLAIM_FLOOR), FILE_FLOOR, []).failed === false,
  "a healthy population at both floors passes");
claim(said(jg(many(DEFENDED, CLAIM_FLOOR - 1), FILE_FLOOR, []), PC_POPULATION),
  `one claim below the floor is ${PC_POPULATION} — the floor is compared, not decorative`);
claim(said(jg([], FILE_FLOOR, []), PC_POPULATION),
  "and an EMPTY population is a collapse, not a pass (170 §4)");
claim(said(jg(many(DEFENDED, CLAIM_FLOOR), FILE_FLOOR - 1, []), PC_FILES),
  `one file below the floor is ${PC_FILES} — claim sites alone cannot see a walk that stopped`);
claim(said(jg(many(DEFECT, DEFECT_CEILING + 1), FILE_FLOOR, []), PC_UNDEFENDED_EXCESS),
  `one defect above the ceiling is ${PC_UNDEFENDED_EXCESS}`);
claim(safe(() => !said(judge(many(DEFECT, DEFECT_CEILING).concat(many(DEFENDED, CLAIM_FLOOR)), FILE_FLOOR, []), PC_UNDEFENDED_EXCESS),
  false), "…and AT the ceiling it does not fire — the twenty that ship today are not a failure");
claim(said(jg(many(RESIDUE, RESIDUE_CEILING + 1).concat(many(DEFENDED, CLAIM_FLOOR)), FILE_FLOOR, []), PC_UNREADABLE_EXCESS),
  `one residue above the ceiling is ${PC_UNREADABLE_EXCESS} — a reader that stopped reading says so`);
claim(jg(many(DEFENDED, CLAIM_FLOOR), FILE_FLOOR, []).codes.length === 0,
  "🔴 and the green case emits NO code at all — two defects returning one value is how a zero stays green");

// ── 10. THE ACCEPTANCE FIXTURE — CONTENT-ADDRESSED, AND ITS TWO FAILURES ARE DIFFERENT ─
// 🔴 A VERDICT THAT CHANGED AND A SITE THAT VANISHED ARE NOT THE SAME EVENT. 215 §4 read
// the line-numbered probe at 1/8 after one session: four line DRIFTS, two intended FLIPS,
// and no way to tell either from a regression. Addressing by content makes drift invisible
// and makes the other two distinguishable from each other.
const FIX = [{ file: "test/x.test.ts", verdict: DEFENDED, claim: /^assert\.deepEqual\(wire, \[\]\)$/, why: "w" }];
const HIT = [row(DEFENDED, { claim: "assert.deepEqual(wire, [])" })];
const MISS = [row(DEFECT, { claim: "assert.deepEqual(wire, [])" })];
const GONE = [row(DEFENDED, { claim: "assert.deepEqual(bridge, [])" })];
claim(ac(HIT, FIX)[0].ok === true, "a member whose measured verdict matches holds");
claim(ac([{ ...HIT[0], line: 999 }], FIX)[0].ok === true,
  "🔴 …and it holds at a DIFFERENT LINE — line drift is not a finding, which is the whole point");
claim(ac(MISS, FIX)[0].code === PC_ACCEPTANCE,
  `a member whose verdict changed is ${PC_ACCEPTANCE}`);
claim(ac(GONE, FIX)[0].code === PC_ACCEPTANCE_MISSING,
  `a member whose SITE is gone is ${PC_ACCEPTANCE_MISSING} — a different event, named differently`);
claim(said(jg(many(DEFENDED, CLAIM_FLOOR).concat(GONE), FILE_FLOOR, FIX), PC_ACCEPTANCE_MISSING),
  "…and the judge refuses on it: a fixture that cannot find its own members is not passing");
claim(jg(many(DEFENDED, CLAIM_FLOOR).concat(HIT), FILE_FLOOR, FIX).failed === false,
  "while the matching case is green all the way through the judge");

// 🔴 THE SHIPPED FIXTURE, READ RATHER THAN ASSUMED. A list of members that are all one
// verdict is a list that cannot tell a fix from a finder that stopped looking.
const shipped = new Set(ACCEPTANCE.map((m) => m.verdict));
claim(ACCEPTANCE.length >= 12, `the shipped fixture holds at least 12 members (${ACCEPTANCE.length})`);
claim(shipped.has(DEFENDED) && shipped.has(EXEMPT_TRAP) && shipped.has(POPULATION_FLOORED) && shipped.has(DEFECT),
  "🔴 and it pins all four verdicts, defects included — pinning only the answers you like proves nothing");
claim(ACCEPTANCE.every((m) => m.claim instanceof RegExp && typeof m.why === "string" && m.why.length > 20),
  "every member is addressed by content and carries a written reason");

// ── 11. THE FLOORS THEMSELVES, NAMED ─────────────────────────────────────────────────
// 175's G9: a literal nothing asserts is a literal anyone can move.
claim(CLAIM_FLOOR === 40, `the shipped claim floor is 40, not ${CLAIM_FLOOR}`);
claim(FILE_FLOOR === 90, `the shipped file floor is 90, not ${FILE_FLOOR}`);
claim(DEFECT_CEILING === 20, `the shipped defect ceiling is 20, not ${DEFECT_CEILING}`);
claim(RESIDUE_CEILING === 1, `the shipped residue ceiling is 1, not ${RESIDUE_CEILING}`);
// 🔴 AND THIS FILE'S OWN, WHICH IS THE ONE `floor_pin_gate` CAUGHT. Every floor
// above was pinned by an exact comparison and this one was read by a single branch and
// asserted by nothing, so setting it to zero left the file green — the collapse
// detector switched off with no case noticing. 175's G9, in the file that quotes it.
claim(CLAIM_FLOOR_SELF === 44, `this file's own claim floor is 44, not ${CLAIM_FLOOR_SELF}`);

if (ran < CLAIM_FLOOR_SELF) {
  bad++;
  console.log(`🔴 FAILED: this self-test ran ${ran} claim(s), below its own floor of ${CLAIM_FLOOR_SELF} — cases were deleted or stopped running`);
}
console.log(bad
  ? `🔴 POSITIVE_CONTROL_SELFTEST — ${bad} of ${ran} claim(s) FAILED`
  : `POSITIVE_CONTROL_SELFTEST ok — ${ran} claim(s), the four 214 §5 defects and all five verdicts pinned with no tree`);
if (bad) process.exit(1);

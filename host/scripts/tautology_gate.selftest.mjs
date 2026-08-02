#!/usr/bin/env node
// tautology_gate.selftest.mjs — session 171.
//
// 169 §2 and 170 §5: CHECK THE INSTRUMENT BEFORE BELIEVING IT. `tautology_gate.mjs` is
// the only thing standing between 676 test blocks and 168 §4's class returning silently.
// If its claim finder stopped recognising `assert.*` — precisely how taut169 reported a
// clean unit suite it had never read — the gate would print "ok" over a suite it no
// longer parses.
//
// Every case drives `analyze()` / `verdict()` with source text directly: no fixture
// files, no compile step. Both the CATCHES and the DISMISSALS are pinned, because a
// classifier that reports everything constrains nothing — the tautology problem one
// level up (169's third false-positive mode).
//
// 🔴 THE CLAIM FLOOR IS A LITERAL. 170 §5's self-test caught its own miscount twice
// because of exactly this line; if a case stops running, the count moves and this fails.
import { analyze, verdict, NO_CLAIMS_EXPECTED } from "./tautology_gate.mjs";

let ran = 0, bad = 0;
const claim = (cond, what) => {
  ran++;
  if (!cond) { bad++; console.log(`🔴 FAILED: ${what}`); }
};
const A = (src) => analyze("fixture.ts", src);
const V = (src) => verdict(A(src));
const wrap = (body) => `import assert from "node:assert/strict";\ntest("a case", () => {\n${body}\n});\n`;

// ── 1. THE CLAIM FINDER SEES assert.* AT ALL ─────────────────────────────────────────
// The whole reason this file exists. taut169 scored zero here.
claim(A(wrap(`  assert.equal(x, 1);`)).length === 1, "assert.equal is a claim site");
claim(A(wrap(`  assert.ok(x);`)).length === 1, "assert.ok is a claim site");
claim(A(wrap(`  assert(x);`)).length === 1, "the bare assert(x) form is a claim site");
claim(A(wrap(`  assert.deepEqual(a, b);\n  assert.match(s, /x/);`)).length === 2, "several methods in one block");
claim(A(wrap(`  assert.fail("nope");`)).length === 0, "assert.fail is not a claim");

// ── 2. SHAPE vs VALUE — 168 §4's distinction, the part 169 got right ─────────────────
claim(V(wrap(`  assert.equal(typeof r.imported, "boolean");`)).vacuous.length === 1,
  'assert.equal(typeof x, "boolean") is vacuous — 168 §4 in node:test dress');
claim(V(wrap(`  assert.ok(typeof r.name === "string");`)).vacuous.length === 1,
  "the same shape written through assert.ok");
claim(V(wrap(`  assert.equal(r.imported, false);`)).vacuous.length === 0,
  "a comparison to a value is NOT vacuous");
claim(V(wrap(`  assert.equal(typeof r.x, "undefined");`)).vacuous.length === 0,
  'typeof === "undefined" is a negative and DOES constrain');
claim(V(wrap(`  assert.ok(r.ok);`)).vacuous.length === 1, "bare truthiness alone is vacuous");
claim(V(wrap(`  assert.notEqual(r.value, undefined);`)).vacuous.length === 1,
  "notEqual undefined is presence only");
claim(V(wrap(`  assert.notEqual(r.value, 3);`)).vacuous.length === 0,
  "notEqual against a real value constrains");
claim(V(wrap(`  assert.ok(true);`)).vacuous.length === 1, "assert.ok(true) cannot fail");
claim(V(wrap(`  assert.equal(r.x, r.x);`)).vacuous.length === 1, "a self-comparison cannot fail");
claim(V(wrap(`  assert.ok(r.list.length >= 0);`)).vacuous.length === 1, "length >= 0 is vacuous");
claim(V(wrap(`  assert.ok(r.list.length > 0);`)).vacuous.length === 0, "length > 0 constrains");

// ── 3. ONE BLOCK, NOT ONE ASSERTION — the over-reporting 170 §4 warned about ─────────
// `assert.ok(!r.isError)` guarding a real assertion is a PRECONDITION doing its job.
// Forty of these exist; failing them would cost the gate its credibility on green.
claim(V(wrap(`  assert.ok(!r.isError);\n  assert.equal(r.value, 42);`)).vacuous.length === 0,
  "a shape-only precondition beside a value claim does NOT make the block vacuous");
claim(V(wrap(`  assert.ok(!r.isError);\n  assert.ok(r.value);`)).vacuous.length === 1,
  "a block where EVERY assertion is shape-only IS vacuous");

// ── 4. .every() IS TRUE OF THE EMPTY COLLECTION ──────────────────────────────────────
claim(V(wrap(`  assert.ok(rows.every((x) => x.ok));`)).every.length === 1,
  ".every() with no floor anywhere is flagged");
claim(V(wrap(`  assert.ok(rows.length > 0 && rows.every((x) => x.ok));`)).every.length === 0,
  "🔴 an INLINE floor in the same condition dismisses it — the best version of the fix");
claim(V(wrap(`  assert.equal(rows.length, 3);\n  assert.ok(rows.every((x) => x.ok));`)).every.length === 0,
  "a floor elsewhere in the same file dismisses it");
claim(V(wrap(`  assert.ok(rows.some((x) => x.ok));`)).every.length === 0,
  ".some() constrains existence and is not the same class");

// ── 5. THE OFFENDER-LIST IDIOM ───────────────────────────────────────────────────────
claim(V(wrap(`  const bad = all.filter((t) => !t.ok);\n  assert.deepEqual(bad, []);`)).offender.length === 1,
  "a filtered offender list vs [] with no population floor is flagged");
claim(V(wrap(`  const bad = all.filter((t) => !t.ok);\n  assert.equal(all.length, 12);\n  assert.deepEqual(bad, []);`)).offender.length === 0,
  "a population floor in the same file dismisses it");
claim(V(wrap(`  assert.deepEqual(reply.paths, []);`)).offender.length === 0,
  "🔴 a deepEqual [] against a FIXED value is a real claim, not a scope-dependent one");
claim(V(wrap(`  const bad = [];\n  for (const t of all) if (!t.ok) bad.push(t);\n  assert.deepEqual(bad, []);`)).offender.length === 1,
  "the loop-accumulator spelling of the same idiom is flagged too");

// ── 6. ONE-HOP RESOLUTION — 169's false-positive killer, still killing them ──────────
claim(V(wrap(`  const good = r.status === "ok" && r.count === 3;\n  assert.ok(good);`)).vacuous.length === 0,
  "🔴 a name that resolves to a real comparison is NOT a tautology");
claim(V(wrap(`  const present = r.value;\n  assert.ok(present);`)).vacuous.length === 1,
  "a name that resolves to bare truthiness still is");
claim(V(wrap(`  const good = a === 1;\n  const good2 = b;\n  const good = c === 2;\n  assert.ok(good);`)).vacuous.length === 0,
  "a name bound more than once resolves to the NEAREST PRECEDING binding");

// ── 7. UNDER-REPORT RATHER THAN OVER-REPORT (169, carried) ───────────────────────────
claim(V(wrap(`  assert.ok(isValidThing(r));`)).vacuous.length === 0,
  "a call the classifier cannot see inside is OPAQUE, never a tautology");
claim(V(wrap(`  assert.match(text, /outside the project root/);`)).vacuous.length === 0,
  "a discriminating regex is a value claim");
claim(V(wrap(`  assert.match(text, /.*/);`)).vacuous.length === 1,
  "a regex matching every probe string is not");
// 🔴 AND THE INSTRUMENT WAS RIGHT WHERE THIS FILE WAS WRONG. The first cut of this
// self-test asserted `/./` was vacuous. It is not: `.` requires one character, so an
// empty reply FAILS it, and the probe set caught the distinction the author missed.
claim(V(wrap(`  assert.match(text, /./);`)).vacuous.length === 0,
  "/./ still rejects the empty string and therefore constrains");
claim(V(wrap(`  await assert.rejects(fn);`)).vacuous.length === 0,
  "a rejects() is a control-flow claim and keeps its block honest");

// ── 8. TYPESCRIPT FORMS taut169's ScriptKind.JS PARSE NEVER SAW ──────────────────────
claim(A(`import assert from "node:assert/strict";\ntest("t", () => {\n  const x: string[] = [];\n  assert.equal(x.length, 0);\n});\n`).length === 1,
  "🔴 a type annotation parses — taut169 read .ts as ScriptKind.JS and mis-parsed 11 of 47 files");
claim(V(wrap(`  assert.ok((r as Reply).ok!);`)).vacuous.length === 1,
  "an `as` cast and a non-null assertion are compile-time claims and constrain nothing at runtime");

// ── 9. ATTRIBUTION — a claim outside any test() belongs to no block ──────────────────
claim(A(`import assert from "node:assert/strict";\nassert.ok(x);\n`)[0].owner === null,
  "a module-scope assertion has no owning block");
claim(A(wrap(`  assert.ok(x);`))[0].owner?.name === "a case", "a claim inside test() is attributed to it");

// ═══ 172 ═════════════════════════════════════════════════════════════════════════════
// 🔴 THE FAILURE THIS SECTION EXISTS FOR IS THE ONE 171 COMMITTED. 171 did not extend
// taut169's claim finder, it REPLACED it — and nothing measured what fell out. 303 probe
// claims went from swept to unseen in the same commit that fixed 2175 unit ones, and
// `TAUT_SCOPE test-integration 422/400 ok` reported health over a population it no
// longer contained. Every idiom below is pinned so the next replacement has to notice.
const probe = (body) => `const check = (c, m, d) => {};\nfunction pass(m, d) {}\nfunction fail(m, d) {}\n${body}\n`;

// ── 10. THE PROBE IDIOMS, ALL THREE, READ OUT OF THE SOURCES ────────────────────────
claim(A(probe(`check(r.count === 3, "M_ONE", "detail");`)).length === 1,
  "🔴 check(cond, marker, …) is a claim site — 303 of these were invisible to 171's gate");
claim(A(probe(`claim("M_ONE", r.count === 3, "detail");`)).length === 1,
  "🔴 claim(marker, cond, …) reads too — cs-dap-plane writes the arguments the other way round");
claim(V(probe(`claim("M_ONE", typeof r.x === "string");`)).vacuous.length === 1,
  "the name-first form is CLASSIFIED, not merely counted — the condition is found by shape, not position");
claim(A(probe(`r.count === 3 ? pass("M_TWO", "d") : fail("M_TWO", "d");`)).length === 1,
  "cond ? pass(M) : fail(M) is a claim site");
claim(V(probe(`typeof r.x === "string" ? pass("M_TWO") : fail("M_TWO");`)).vacuous.length === 1,
  "🔴 and the CONDITION is what gets classified — taut169 pointed at pass(), where the only thing to read is a marker string");
claim(A(probe(`claim();`)).length === 0,
  "a bare claim() with no condition is _population.mjs's counting form and self-excludes");
claim(A(probe(`fail("M_THREE", "d");`)).length === 0, "a bare fail() reports an outcome, it does not make a claim");
claim(A(probe(`someHelper("M_FOUR", r);`)).length === 0,
  "a call to a function that does not assert is not a claim site (under-report, 169's safe direction)");

// ── 11. LOCAL ASSERTER HELPERS — the third shape, and why tabletop-plane read silent ──
const helper = `function pass(m, d) {}\nfunction fail(m, d) {}\n`
  + `function expectRefusal(marker, r, code) {\n  if (!r.isError && !r.threw) return fail(marker, "x");\n  if (!r.text.includes(code)) return fail(marker, "y");\n  pass(marker, "z");\n}\n`
  + `function expectOk(marker, r) {\n  if (r.threw) return fail(marker, "x");\n  if (r.isError) return fail(marker, "y");\n  pass(marker, "z");\n}\n`;
claim(A(helper + `expectRefusal("TT_A", reply, "E_CODE");`).length === 1,
  "🔴 a call to a local pass/fail helper IS a claim site — its condition lives one hop away, in the guard clauses");
claim(V(helper + `expectRefusal("TT_A", reply, "E_CODE");`).vacuous.length === 0,
  "and the guards are classified: .includes(code) is a content claim, so the marker is not vacuous");
claim(V(helper + `expectOk("TT_B", reply);`).vacuous.length === 0,
  "🔴 a helper asserting ONLY outcome flags is 171 §3's precondition, dismissed — not a defect to report");

// ── 12. THE UNIT IS THE MARKER — the seam 171 §10.2 assumed was covered ─────────────
// `_population.mjs` keys its family manifest on markers and proves a family SPOKE.
// Nothing proved what a family said could have been different. Scoring here is what
// makes the two gates meet rather than merely abut.
claim(V(probe(`check(typeof r.a === "string", "SAME", "");\ncheck(typeof r.b === "string", "SAME", "");`)).blocks === 1,
  "two claims under one marker are ONE unit");
claim(V(probe(`check(typeof r.a === "string", "SAME", "");\ncheck(typeof r.b === "string", "SAME", "");`)).vacuous.length === 1,
  "a marker whose every claim is shape-only is vacuous");
claim(V(probe(`check(typeof r.a === "string", "SAME", "");\ncheck(r.b === 3, "SAME", "");`)).vacuous.length === 0,
  "one real claim under the marker defends the whole marker");
claim(V(probe(`check(typeof r.a === "string", "ONE", "");\ncheck(r.b === 3, "TWO", "");`)).vacuous.length === 1,
  "🔴 and a DIFFERENT marker is a different unit — a neighbour's claim does not defend it");
claim(A(`import assert from "node:assert/strict";\nawait family("F", async () => {\n  assert.equal(x, 1);\n});\n`)[0].owner?.name === "F",
  "family() attributes like test() — it is _population.mjs's block form");

// ── 13. PRECONDITIONS, ASKED OF THE LEAVES RATHER THAN THE TEXT ─────────────────────
claim(V(probe(`check(!res.isError, "SUPPORTED", "");`)).vacuous.length === 0,
  "🔴 check(!res.isError, …) alone is 171 §3's forty in probe dress, dismissed for the same reason");
claim(V(probe(`check(res.isError === true, "REFUSED", "");`)).vacuous.length === 0,
  "the positive spelling of the same outcome flag is dismissed too");
claim(V(probe(`check(!res.isError && !!res.structuredContent, "STRUCTURED", "");`)).vacuous.length === 1,
  "🔴 BUT AN OUTCOME FLAG BESIDE A SHAPE-ONLY CLAIM IS NOT — `{}` satisfied a marker named STRUCTURED, twice (172 D1/D2)");
claim(V(probe(`check(!res.isError && Object.keys(res.structuredContent ?? {}).length > 0, "STRUCTURED", "");`)).vacuous.length === 0,
  "and the fix — a non-empty check rather than a presence check — clears it");
claim(V(probe(`check(!v.isError && Array.isArray(v.sc?.variables), "VARS", "");`)).vacuous.length === 1,
  "🔴 Array.isArray() is a type test and [] is an array (172 D3)");

// ── 14. .every() — THE RECEIVER DECIDES, NOT THE PREDICATE ──────────────────────────
claim(V(probe(`check(["a", "b"].every((k) => typeof k === "string"), "M", "");`)).every.length === 0,
  "🔴 .every() over a NON-EMPTY ARRAY LITERAL cannot be vacuously true — there is nothing empty about it");
claim(V(probe(`const names = ["a", "b", "c"];\ncheck(names.every((k) => typeof k === "string"), "M", "");`)).every.length === 0,
  "and one hop away is still the same literal (gdscript-dap-plane's capNames)");
claim(V(probe(`const names = [];\ncheck(names.every((k) => typeof k === "string"), "M", "");`)).every.length === 1,
  "an EMPTY literal is exactly the class");
claim(V(wrap(`  assert.ok(rows.filter((r) => r.ok).every((r) => r.n));`)).every.length === 1,
  "a derived collection with no floor is still flagged");

// ── 15. THE FLOOR IS LOOKED FOR IN THE RESOLVED TEXT, NOT THE SPELLING ──────────────
// 🔴 `hasFloor` tested the raw condition, so `(searchOk && listOk)` — floored one hop
// away, inside the const that defines `searchOk` — read as unfloored. Latent in the
// unit suite, where conditions are inline; immediate in the probes, where they are not.
claim(V(probe(`const ok = rows.length > 0 && rows.every((r) => r.n);\ncheck(ok, "M", "");`)).every.length === 0,
  "🔴 a floor that arrives through one-hop resolution counts — the best version of the fix must not be the reported defect");
claim(V(probe(`check(list.includes("res://player.gd") && list.every((d) => d.startsWith("res://")), "M", "");`)).every.length === 0,
  ".includes() floors a collection as surely as .length does");
claim(V(probe(`check(list.some((d) => d.bad) === false && list.every((d) => d.ok), "M", "");`)).every.length === 0,
  ".some() floors it too");

// ── 16. THE ROSTER IS NOT A PLACE TO HIDE ───────────────────────────────────────────
claim(Object.keys(NO_CLAIMS_EXPECTED).length > 0 && Object.values(NO_CLAIMS_EXPECTED).every((r) => typeof r === "string" && r.length > 20),
  "every exempt file states its reason, at length — a roster of bare names is a list nobody can justify");

// ── the floor on this file itself (170 §5) ───────────────────────────────────────────
// 🔴 IT CAUGHT ITS OWN MISCOUNT ON THE FIRST RUN — 170 §5's experience, verbatim: the
// literal read 35 and 37 claims actually ran. Keep it a literal for that reason.
const EXPECTED = 67;
if (ran !== EXPECTED) {
  console.log(`🔴 TAUT_SELFTEST_SCOPE ${ran} claims ran, expected ${EXPECTED} — a case stopped running`);
  process.exit(1);
}
if (bad) { console.log(`🔴 TAUT_SELFTEST ${bad} of ${ran} claims FAILED`); process.exit(1); }
console.log(`TAUT_SELFTEST ok every claim held (${ran} claim(s) ran)`);

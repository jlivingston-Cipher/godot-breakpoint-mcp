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
import {
  analyze, verdict, NO_CLAIMS_EXPECTED, FLOORS, FILE_FLOORS,
  judgeScope, combineFailed, UNIT_FLOOR, ATTRIBUTED_FLOOR,   // 180 — the output floor and its wire
  ORPHAN_CEILING,                                            // 191 — the other side of the subtraction
  BANNER_ATTRIBUTED_FLOOR,                                   // 193 — the fallback, counted as itself
  SECTION_ATTRIBUTED_FLOOR,                                  // 194 — the SECOND fallback, the executed one
  SHAPED_FLOOR, PRECONDITION_FLOOR,                          // 🆕 182 — the CLASSIFIER's own output
  durationClaim, judgeDuration, DURATION_FLOOR, unquoted,    // 🆕 275 — 273's subject, as a rule
} from "./tautology_gate.mjs";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";   // not .pathname — "Godot MCP" keeps the %20

let ran = 0, bad = 0;
const claim = (cond, what) => {
  ran++;
  if (!cond) { bad++; console.log(`🔴 FAILED: ${what}`); }
};
// 🔴 242 — THE SECOND PARAMETER EXISTS BECAUSE SEVEN CALL SITES WERE ALREADY PASSING IT
// AND IT REACHED NOTHING. `A` took one argument and `V` took one argument, and seven
// claims below wrote `V(src, "b.mjs")` / `V(src, "p.mjs")` — an argument whose entire
// purpose is to make `analyze` parse the fixture as JS, since `analyze` picks
// `ScriptKind.TS` vs `ScriptKind.JS` off `/\.ts$/.test(fileName)` and nothing else. The
// name was discarded at the arrow and every one of those claims was proved under
// `fixture.ts` while its own prose says it is about the `.mjs` idiom that
// `verdict_gate.selftest.mjs` and `_population.mjs` really use.
//
// 🔴 ALL SEVEN STILL HOLD WITH THE NAME HONOURED — 157/157, checked before and after —
// so this was never a wrong answer. It is a claim that was not proving what it said it
// proved, in the self-test of the gate whose entire subject is claims that cannot fail.
// `tsc --allowJs --checkJs` reported all seven as TS2554 *Expected 0-1 arguments, but got
// 2*, and has been able to for as long as they have existed: 229 §5.2, one language over,
// found by `lint_ceiling.py`'s JS half on its first run.
const A = (src, name = "fixture.ts") => analyze(name, src);
// 179's idiom, imported by hand: a gate's PRINTED name is part of its contract, so the
// self-test asserts on the line and not only on the boolean.
const said = (r, s) => r.lines.some((l) => l.includes(s));
const V = (src, name) => verdict(A(src, name));
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

// ── 5b. 🆕 275 — THE DURATION IDIOM (`duration-assertions-unguarded`, 273) ────────────
// 🔴 BOTH DIRECTIONS ON EVERY ARM, because a rule that flags every comparison would
// "catch" 273's defect and constrain nothing — 169's third false-positive mode, which is
// the reason this file pins the DISMISSALS as hard as the catches.
claim(durationClaim("elapsed >= 200")?.lower === true
   && durationClaim("elapsed >= 200")?.guarded === false,
  "a bare lower bound on an elapsed reading is a duration claim and is unguarded");
claim(durationClaim("elapsed >= WAIT_MS - TIMER_SLACK_MS")?.guarded === true,
  "a named slack term guards it — the shape 273 shipped");
claim(durationClaim("Date.now() - started >= 250 - TIMER_SLACK_MS")?.lower === true,
  "the inline `Date.now() - t` spelling is read the same way as a named `elapsed`");
claim(durationClaim("Date.now() - started < 5000")?.lower === false,
  "an UPPER bound is counted and is not the offence — 'it finished in time' is a different claim");
claim(durationClaim("200 <= elapsed")?.lower === true,
  "🔴 the reversed spelling is the same claim, and it is the one that would have shipped unread");
claim(durationClaim("rows.length >= 3") === null && durationClaim("elapsed") === null,
  "a length floor is not a duration claim, and neither is a mention with no comparison in it");

// and the verdict wire, on both of the branches a healthy tree cannot reach
claim(judgeDuration([{ c: { file: "a.ts", line: 3, cond: "elapsed >= 200", owner: { name: "t" } },
                       d: { lower: true, guarded: false } }], 1).failed === true,
  "an unguarded lower bound reddens the gate");
claim(said(judgeDuration([{ c: { file: "a.ts", line: 3, cond: "elapsed >= 200", owner: { name: "t" } },
                            d: { lower: true, guarded: false } }], 1), "TAUT_DURATION_UNGUARDED"),
  "…and says so by name, with the condition beside it");
claim(judgeDuration([{ c: { file: "a.ts", line: 3, cond: "elapsed >= 200 - SLACK", owner: { name: "t" } },
                       d: { lower: true, guarded: true } }], 1).failed === false,
  "a guarded one does not");
claim(judgeDuration([], 1).failed === true && said(judgeDuration([], 1), "TAUT_DURATION_COLLAPSE"),
  "🔴 and an EMPTY population reddens too — the offence is zero on a healthy tree, so only the site count can say the reader ran");
claim(DURATION_FLOOR >= 1,
  "the shipped floor is not zero — a floor of zero is the branch that can never fail (182 §11.3)");
claim(V(wrap(`  assert.ok(Date.now() - t0 >= 200 - TIMER_SLACK_MS);`)).duration.length === 1,
  "the whole route, end to end: `verdict()` collects the site off a real parse");
// 🔴 AND THE CASE THAT CAUGHT THE FIRST DRAFT: the four claims above pass the idiom as a
// STRING, and the live gate reported every one of them as an unguarded lower bound in a
// file that asserts nothing about a clock. A comparison inside a quoted span is not a
// comparison — in this file or in any suite whose assertion message quotes its own
// expression, which is most of them.
claim(durationClaim(`label === "elapsed >= 200"`) === null,
  "🔴 an idiom inside a quoted string is not a duration claim — the gate's own fixtures are what proved it");
claim(unquoted(`a === "x >= 1"`) === `a === ""`,
  "the quoted span is BLANKED and not deleted, so the operator search cannot see the comparison it hid");
// 🔴 AND THE WIRE, WHICH IS THE HALF A HEALTHY TREE CAN NEVER EXERCISE. `main()` calls
// `combineFailed` twice now — once for the scope verdict and once for this one — and the
// second call's argument is `false` on every green tree, so a LATE blind that answers
// honestly and then returns its empty drops the duration refusal live and nothing reddens.
// `instrument_gate.py`'s `LATE_DECLARED_GREEN` declares that and points here: this claim is
// the axis where the second wire has a case with a known answer.
claim(combineFailed(false, judgeDuration([{ c: { file: "a.ts", line: 3, cond: "elapsed >= 200", owner: { name: "t" } },
                                             d: { lower: true, guarded: false } }], 1)) === true,
  "🔴 the duration verdict reaches the exit code — the second `combineFailed` call, unreachable from a green tree");

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
// 🔴 199 §9.2 — `[0]` ON A FINDER'S RESULT IS A READ THAT CAN MISS. A blinded `analyze`
// returns no claims at all, and `[0].owner` threw here before any of the nineteen
// failures below could be recorded. `?.[0]?.owner` fails the claim instead: `undefined`
// is not `null`, which is the right answer — a finder that found nothing did not find a
// module-scope assertion either.
claim(A(`import assert from "node:assert/strict";\nassert.ok(x);\n`)?.[0]?.owner === null,
  "a module-scope assertion has no owning block");
claim(A(wrap(`  assert.ok(x);`))?.[0]?.owner?.name === "a case", "a claim inside test() is attributed to it");

// ═══ 172 ═════════════════════════════════════════════════════════════════════════════
// 🔴 THE FAILURE THIS SECTION EXISTS FOR IS THE ONE 171 COMMITTED. 171 did not extend
// taut169's claim finder, it REPLACED it — and nothing measured what fell out. 303 probe
// claims went from swept to unseen in the same commit that fixed 2175 unit ones, and
// `TAUT_SCOPE test-integration 422/400 ok` reported health over a population it no
// longer contained. Every idiom below is pinned so the next replacement has to notice.
// 🔴 175 HAD TO MAKE THIS FIXTURE REAL, AND THAT IS A FINDING ABOUT THE FIXTURE.
// It declared `const check = (c, m, d) => {};` — AN EMPTY BODY — and `claim` not at all.
// Under name-only matching that was invisible. Under `collectFailers` it is exactly the
// impostor the resolver is built to reject: a helper that cannot fail, and a name with
// no declaration behind it. Every one of these cases had been proving the classifier
// against a stub that no probe in the tree resembles. The bodies below are the real
// `lsp-plane` / `cs-dap-plane` helpers, reduced.
const probe = (body) => `let failures = 0;
const check = (c, m, d) => { if (c) { console.log("ok " + m); return true; } failures++; console.log("FAIL " + m + d); return false; };
const claim = (m, c, d = "") => { if (c) console.log("ok " + m); else { failures++; console.log("FAIL " + m + d); } };
function pass(m, d) {}
function fail(m, d) {}
${body}
`;

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
claim(A(`import assert from "node:assert/strict";\nawait family("F", async () => {\n  assert.equal(x, 1);\n});\n`)?.[0]?.owner?.name === "F",
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

// ── 17. A NAME IS NOT A BEHAVIOUR (175) ─────────────────────────────────────────────
// 🔴 CHECK_FNS WAS MATCHED BY NAME ALONE, AND THE HOST ROOT IS WHERE THAT SHOWED. The
// gate INVENTED seventeen of that directory's twenty-four claim sites — fifteen from a
// tool invoker called `check` and two from a transcript reader called `assertOk`.
// A gate that fabricates its own population inflates the very floor meant to detect a
// collapse. Both impostors below are the real shapes, reduced.
const REAL_CHECK = `let failures = 0;\nfunction check(cond, name) {\n  if (cond) { console.log("ok " + name); return true; }\n  console.log("FAIL " + name); failures++; return false;\n}\n`;
const INVOKER = `const results = [];\nasync function check(name, args = {}) {\n  const r = await call(name, args);\n  results.push({ tool: name, status: r.isError ? "ERR" : "OK" });\n  return r;\n}\n`;
const READER = `const assertOk = (o, step) => {\n  const s = o.steps.find((x) => x.step === step);\n  return s && s.result ? s.result.ok : undefined;\n};\n`;

claim(A(REAL_CHECK + `check(x.length > 0, "M");`).length === 1,
  "a helper that branches on its condition parameter and counts a failure IS a claim idiom");
claim(A(INVOKER + `check("scene_open", { path: "res://main.tscn" });`).length === 0,
  '🔴 a tool INVOKER named `check` is not — sweep_editor.mjs, fifteen invented sites (175)');
claim(A(READER + `assertOk(o, "assert GrewEver==false");`).length === 0,
  "🔴 nor is a transcript READER named `assertOk` — cs_demo_verify_replay.mjs, two more (175)");
claim(A(`check(x.length > 0, "M");`).length === 0,
  "🔴 and a name that resolves to NO local declaration admits nothing — which is why adding `verdict` to CHECK_FNS is safe, with this gate's own selftest calling an imported verdict() on every line");
claim(A(`const claim = (cond, what) => { ran++; if (!cond) { bad++; console.log(what); } };\nclaim(n === 3, "M");`).length === 1,
  "the `claim(cond, what)` form still reads — this very file's idiom");
claim(A(`const verdict = (step, result) => {\n  const ok = result ? result.ok : undefined;\n  if (ok !== expected) failures.push(step);\n  return ok;\n};\nverdict("assert grew_ever==false", a1);`).length === 1,
  "and 175's `verdict(step, result)` form reads — the shape the three fixed drivers assert through");
// 🔴 CONDITION 2 ALONE WOULD ADMIT THE INVOKER, WHICH IS WHY BOTH ARE REQUIRED. The
// invoker DOES mutate an outer binding (`results.push`). Only the parameter test
// excludes it: a helper that never consults what it was told cannot be asserting it.
claim(A(`const out = [];\nconst check = (cond, name) => { out.push(name); return cond; };\ncheck(x > 0, "M");`).length === 0,
  "🔴 outer mutation alone is not enough — it must branch on a PARAMETER, or the invoker walks straight back in");
// 🔴 AND THE OTHER HALF, WHICH THE REVERSE SWEEP FOUND UNPROVEN (175's G3). Dropping the
// ESCAPE test left every case above still green: the invoker and the reader are both
// excluded by the PARAMETER test, so nothing isolated the second condition. 173's G3 and
// 174's H5, a third time — two conditions that in the live population are never satisfied
// apart. This is a pure predicate: it branches on its parameter and only returns.
claim(A(`const check = (cond, name) => (cond ? true : false);\ncheck(x > 0, "M");`).length === 0,
  "🔴 a helper that branches on its parameter and only RETURNS is not an assertion — it computes, it does not claim");

// ── 18. WHICH DIRECTORIES DOES THE SWEEP NOT ENTER? (175, 174 §11.3's question) ──────
claim(Object.keys(FLOORS).length === 4 && ["test", "test-integration", "scripts", "."].every((d) => d in FLOORS),
  "four directories are rostered — `scripts` and the host root were admitted in 175");
// 🔴 THE ROSTER WAS PINNED AND THE VALUES WERE NOT (181, from 180 §11.3). The claim
// above asserts four KEYS and that each name is present; `FLOORS = { test: 0,
// "test-integration": 0, scripts: 0, ".": 0 }` satisfies every word of it. Measured by
// the §11.3 sweep: zeroing any of the four leaves this file GREEN, so all four of the
// directory floors 180 §4 reported as "held at their shipped values" could have been
// zeroed by a find-and-replace with nothing to say. Exact `===`, not `>=`: this is a
// PIN, and it is supposed to cost a deliberate edit — the same reason
// `verdict_gate.selftest.mjs` writes `SUBJECT_FLOOR === 4`.
claim(FLOORS.test === 2100 && FLOORS["test-integration"] === 850
  && FLOORS.scripts === 90 && FLOORS["."] === 10,
  "🔴 and each of the four VALUES is pinned — a rostered directory with a floor of 0 is not floored, "
  + `got ${JSON.stringify(FLOORS)}`);
// 🆕 183 — THE SAME PAIR FOR `FILE_FLOORS`, AND THE PAIR IS THE POINT. `FLOORS` counts
// claim SITES; `FILE_FLOORS` counts FILES READ, which is the only number that can see a
// walk that stopped admitting sources. Written as two claims for 181's reason, one file
// up: a roster pinned by KEY is not a roster pinned, and a floor of 0 is not a floor.
claim(Object.keys(FILE_FLOORS).length === 4
  && ["test", "test-integration", "scripts", "."].every((d) => d in FILE_FLOORS),
  "the file-count floor covers the same four rostered directories — a directory with a claim-site "
  + "floor and no file floor is half floored");
claim(FILE_FLOORS.test === 45 && FILE_FLOORS["test-integration"] === 28
  && FILE_FLOORS.scripts === 8 && FILE_FLOORS["."] === 12,
  "🔴 and each of the four file-count VALUES is pinned — zeroing one re-permits the filename-prefix "
  + `exemption 183 removed, in silence, got ${JSON.stringify(FILE_FLOORS)}`);
// 🔴 `test/helpers` IS DELIBERATELY NOT ROSTERED, AND THIS IS THE ASSERTION THAT SAYS SO.
// `readdirSync` is not recursive, so a SUBDIRECTORY of a rostered directory is unswept —
// the fourth spelling of 174 §5's finding, after the filename prefix and the directory
// roster. 174's D5 died of a note reading "deliberately left alone… no assertion here
// either way", so this decision is pinned rather than written: `recording-server.ts` and
// `tcp.ts` are fixtures. If either grows a claim site, this fails and the decision gets
// re-made by a person.
const HELPERS = fileURLToPath(new URL("../test/helpers/", import.meta.url));
const helperClaims = readdirSync(HELPERS)
  .filter((f) => /\.(mjs|ts)$/.test(f))
  .map((f) => [f, analyze(join(HELPERS, f), readFileSync(join(HELPERS, f), "utf8")).length]);
claim(helperClaims.length === 2, `test/helpers holds exactly 2 files (got ${helperClaims.length})`);
claim(helperClaims.every(([, n]) => n === 0),
  `🔴 HELPERS_NOT_ROSTERED — test/helpers asserts nothing, so a non-recursive sweep costs no coverage: ${JSON.stringify(helperClaims)}`);

// ── 18. 🔴 THE OUTPUT FLOOR (180, answering 179 §11.2) ───────────────────────────────
//
// `FLOORS` pins claim sites the FINDER FOUND. Between that and the verdict sits
// attribution, and `vacuous` is scored over what survives it. Measured before this
// section existed (`_to_delete/measure180c.mjs`): forcing `verdict()`'s `if (!k)
// continue` to fire for every claim left all four directory floors at their shipped
// values and printed `TAUT_GATE ok — 3465 claim sites, 0 blocks, none vacuous`, exit 0.
//
// 🔴 AND THESE CASES CANNOT LIVE AT THE LIVE GATE, FOR 179 §9's REASON RESTATED. The
// sweep deletes a rule and asks whether the gate still reddens; deleting a floor cannot
// redden a tree that is ABOVE it. So a floor is fixture-covered BY CONSTRUCTION, exactly
// like a narrowing, and `mutate180.py` says so at G3/G4.
claim(V(wrap(`  assert.equal(x, 1);\n  assert.equal(y, 2);`)).attributed === 2,
  "verdict() counts the claims that REACHED a unit — this gate's `judged`");
claim(V(`import assert from "node:assert/strict";\nassert.equal(x, 1);\n`).attributed === 0,
  "🔴 and a claim in neither a test() block nor a marker reaches no unit — 148 of 3730 take this path today");
// 🔴 A FIXTURE VERDICT CARRIES ALL FOUR POPULATIONS (182). `judgeScope` reads
// `v.shaped ?? 0`, so a fixture that omits them is a COLLAPSE rather than an exemption —
// deliberately, because an absent population is the loudest case, not the quietest. `S`
// supplies the shipped classification counts so each case below still varies exactly one
// number, which is the only way a case can name what it caught.
const S = (o) => ({ shaped: 116, precondition: 61, ...o });
claim(judgeScope(S({ blocks: 1408, attributed: 3317 }), 3360).failed === false,
  "the shipped population is above all four floors");
claim(judgeScope(S({ blocks: 0, attributed: 0 }), 3360).failed === true,
  "🔴 attribution resolving NOTHING reddens — the case that exited 0 before 180");
claim(said(judgeScope(S({ blocks: 0, attributed: 0 }), 3360), "TAUT_ATTRIBUTION_COLLAPSE UNITS"),
  "…and it is named as an attribution collapse, not as a claim-site one");
claim(judgeScope(S({ blocks: UNIT_FLOOR - 1, attributed: 3317 }), 3360).failed === true,
  "one unit below the floor reddens");
claim(judgeScope(S({ blocks: UNIT_FLOOR, attributed: 3317 }), 3360).failed === false,
  "…and exactly at it does not");
// 🔴 THE CASE A UNIT FLOOR ALONE CANNOT SEE, and the whole reason there are two numbers.
// Measured live: keeping every unit but only its FIRST claim leaves units=1408/1200 `ok`
// and takes claims to 1408/2500. One number would have hidden this behind the other —
// 171 §10.22, one instrument over.
claim(judgeScope(S({ blocks: 1408, attributed: 1408 }), 3360).failed === true,
  "🔴 every unit intact, one claim each: the UNIT floor holds and the CLAIM floor catches it");
claim(said(judgeScope(S({ blocks: 1408, attributed: 1408 }), 3360), "TAUT_ATTRIBUTION_COLLAPSE CLAIMS"),
  "…and it is named separately, because it is a different collapse");
claim(judgeScope({ blocks: 0, attributed: 0 }, 3465, 0, 0, 0, 0, 3465).failed === false,
  "the floors are parameters — a fixture can drive this from below, which the live tree cannot");
claim(UNIT_FLOOR >= 1000 && ATTRIBUTED_FLOOR >= 2000,
  `🔴 the shipped floors are literals with headroom, not a rounding of zero (${UNIT_FLOOR}/${ATTRIBUTED_FLOOR})`);
claim(said(judgeScope(S({ blocks: 1408, attributed: 3317 }), 3360), "orphan=43"),
  "a green run still prints the orphan count — 148 since 193 read under it, no longer floored by nothing");

// ── 191: AND THE ORPHAN COUNT IS FLOORED FROM THE OTHER SIDE AT LAST ─────────────────
// 180 §11.4 asked for this and 181, 182, 183, 186, 188, 189 and 190 all carried it. The
// count is `sites - attributed`, so it is bounded above only if BOTH are pinned — and
// `sites` is free to grow, which is why it went 472 → 508 with every floor in this file
// green the whole way. THE DISMISSAL FIRST, as this repo's self-tests do: the live shape
// must not fire, or the rule is just a red build.
claim(judgeScope(S({ blocks: 1739, attributed: 3700 }), 3746).failed === false,
  "🔴 THE DISMISSAL: the shipped tree sits exactly ON the ceiling and passes — 148 of 148");
claim(judgeScope(S({ blocks: 1739, attributed: 3700 }), 3747).failed === true,
  "🔴 and ONE more claim site that reaches no unit reddens — the drift that has run for nine sessions");
claim(said(judgeScope(S({ blocks: 1739, attributed: 3700 }), 3747), "TAUT_ORPHAN_RISE"),
  "…named TAUT_ORPHAN_RISE, not folded into an attribution collapse — a different failure");
claim(said(judgeScope(S({ blocks: 1739, attributed: 3700 }), 3747), "47 > 46"),
  "…and it prints both numbers, so the reading needed to raise it deliberately is in the log");
// 🔴 THE ARM THE LIVE TREE CANNOT REACH: a rise caused by attribution FALLING rather than
// by sites rising. Same subtraction, opposite input, and a ceiling reads them identically
// — which is the property that makes it worth having, since `ATTRIBUTED_FLOOR` has 700 of
// slack under it and would stay green through a drop of this size.
claim(judgeScope(S({ blocks: 1613, attributed: 2600 }), 3713).failed === true,
  "🔴 attribution dropping 605 with sites unchanged reddens HERE while ATTRIBUTED_FLOOR (2500) stays green");
claim(judgeScope(S({ blocks: 1613, attributed: 2600 }), 3713).lines.some((l) => l.includes("TAUT_ORPHAN_RISE"))
  && !judgeScope(S({ blocks: 1613, attributed: 2600 }), 3713).lines.some((l) => l.includes("COLLAPSE CLAIMS")),
  "🔴 and ONLY this rule names it — the case that proves the ceiling is not a restatement of the floor");
claim(ORPHAN_CEILING === 46, `the shipped orphan ceiling is 46, not ${ORPHAN_CEILING}`);
claim(judgeScope(S({ blocks: 1739, attributed: 3700 }), 3746, UNIT_FLOOR, ATTRIBUTED_FLOOR, SHAPED_FLOOR, PRECONDITION_FLOOR, 47).failed === false,
  "and the ceiling is a PARAMETER — raising it is what a deliberate rise looks like, and it is reachable from a fixture");

// 🔴 193 — THE BANNER FALLBACK, AND THE ARM THAT PROVES THE CEILING ALONE IS NOT ENOUGH.
// Reading under the 509 found that 432 of them were eleven `*.integration.mjs` files where
// NOT ONE claim reached a unit — so `vacuous`/`every`/`offender`, which are scored over
// attributed units, were scoring nothing at all over the most expensive tests in the repo.
// The fallback reads the section banners those files already write, and attributes 362.
//
// THE DISMISSAL FIRST. The live shape must not fire.
claim(judgeScope(S({ blocks: 1739, attributed: 3700, bannerAttributed: 362 }), 3746).failed === false,
  "🔴 THE DISMISSAL: 362 banner-attributed claims clear the floor — the shape 193 shipped, kept as a case even though the live number is now 21 (194 moved ten of eleven files to the section path)");
claim(said(judgeScope(S({ blocks: 1739, attributed: 3700, bannerAttributed: 362 }), 3746), "TAUT_BANNER_ATTRIBUTED 362/15"),
  "…and the number is PRINTED with its floor, so a drift is readable before it is a failure");
claim(judgeScope(S({ blocks: 1739, attributed: 3700, bannerAttributed: 14 }), 3746).failed === true,
  "🔴 one under the floor reddens — the fallback silently ceasing to attribute is the failure");
claim(said(judgeScope(S({ blocks: 1739, attributed: 3700, bannerAttributed: 14 }), 3746), "TAUT_BANNER_COLLAPSE"),
  "…named as its own class, not folded into an orphan rise");
// 🔴 THE ARM THAT IS THE WHOLE ARGUMENT FOR THIS FLOOR EXISTING. A verdict where the banner
// path has died but somebody has meanwhile ADDED enough test() blocks to keep the orphan
// count under its ceiling: every other number in this file reads healthy, and only this one
// says the integration suite stopped being scored. The ceiling cannot see this; a
// subtraction never can.
claim(judgeScope(S({ blocks: 1739, attributed: 3700, bannerAttributed: 0 }), 3746).failed === true,
  "🔴 banner attribution at ZERO with orphan/units/claims all healthy still reddens — the case the ceiling is blind to");
claim(!judgeScope(S({ blocks: 1739, attributed: 3700, bannerAttributed: 0 }), 3746).lines.some((l) => l.includes("TAUT_ORPHAN_RISE")),
  "…and the orphan rule stays SILENT through it, which is what makes the two rules different rules");
// 🔴 AND A FIXTURE THAT DOES NOT EXERCISE THE PATH MUST NOT BE ABLE TO REDDEN IT. Every
// judgeScope case above this block builds a verdict with no `bannerAttributed` at all;
// treating that as 0 would have turned all of them red and the floor would have been
// weakened to fit, which is 188 §9's failure mode exactly.
claim(judgeScope(S({ blocks: 1739, attributed: 3700 }), 3746).failed === false,
  "🔴 an unmeasured banner count is NOT a collapse — absent and zero are different readings");
claim(!said(judgeScope(S({ blocks: 1739, attributed: 3700 }), 3746), "TAUT_BANNER_ATTRIBUTED"),
  "…and nothing is printed for it either, so the log does not claim a measurement it did not take");
claim(BANNER_ATTRIBUTED_FLOOR === 15 && BANNER_ATTRIBUTED_FLOOR < 21,
  `🔴 the floor is a literal UNDER the live value, not a rounding of it (${BANNER_ATTRIBUTED_FLOOR} vs 21 measured)`);

// ── 194: THE SECOND FALLBACK, AND THE THREE THINGS THAT MADE IT NECESSARY ────────────
// 🔴 1. THE READER KNEW ONE OF THE THREE WAYS THE TREE DRAWS A BANNER. 193 generalised
// from eleven files and got the idiom right for those eleven. `verdict_gate.selftest.mjs`
// draws the same convention in box characters and both LSP planes draw it with a three-dash
// leading rule, and neither was being read — 183 such lines across the tree.
const banner = (line, body) => V(`${line}\n${body}`, "b.mjs");
claim(banner("// ── 6. THE REAL TREE, READ RATHER THAN ASSUMED ─────────", "assert.ok(x > 0);").attributed === 1,
  "🔴 a box-drawing banner is a banner — the idiom `verdict_gate.selftest.mjs` has always used");
claim(banner("// --- the refusals: states the mock server cannot produce ---", "assert.ok(x > 0);").attributed === 1,
  "🔴 a THREE-dash leading rule is a banner when a trailing rule flanks it — both LSP planes");
claim(banner("// ================== 2. `visible`, all THREE branches ===", "assert.ok(x > 0);").attributed === 1,
  "…and form A, the one 193 shipped, still matches — the new form is a UNION, never a swap");
// 🔴 AND THE CASE THAT MAKES THAT A UNION RATHER THAN A CLAIM. The sweep's G1b killed form
// A and the LIVE run stayed green, which is a fact about the tree, not about the rule:
// measured 199 lines are titled by both forms, 116 by form B alone, and the 13 that only
// form A reads all sit in files served by a `test()` block or by the section path, so none
// of them currently reaches this fallback. Form A's coverage is in this fixture BY
// CONSTRUCTION — 179 §9's argument about floors, applied to a regex — and deleting form A
// as "dead code" would silently narrow the reader the day one of those files changes shape.
claim(banner("// --------------------------------- PauseLatch --", "assert.ok(x > 0);").attributed === 1,
  "🔴 FORM A ALONE: a leading rule with a TWO-character tail is a banner, and form B rejects "
  + "it — 13 lines in this tree are written that way and G1b is green only because of where");
claim(banner("// -- TODO --", "assert.ok(x > 0);").attributed === 0,
  "🔴 but a two-and-two comment is NOT a banner: the leading run only drops to 2 because it "
  + "is paying for a trailing run of 3, and a rule that matched this would attribute prose");
claim(banner("// ─────────────────────────", "assert.ok(x > 0);").attributed === 0,
  "…and a bare box rule titles nothing, exactly as a bare ASCII rule titles nothing");

// 🔴 2. AND BEFORE ANY COMMENT, THE MARKER THE PROBE EXECUTES. `_population.mjs` attributes
// every claim at runtime by `open()` and `seal()`; the scorer was reading neither, which is
// why `vcs.integration.mjs` — twelve sealed sections — was the largest block of orphans in
// the tree. These are not a convention anybody has to keep: they are load-bearing calls.
const POP = 'const population = new Population("P", { families: [], scope: 1, claims: 1 });\n'
  + "const assert = population.assert;\n";
claim(V(`${POP}population.open("SEC_A");\nassert.ok(x > 0);`, "p.mjs").attributed === 1,
  "🔴 HEADER-FIRST: `open()` owns the claims that follow it — `_population.mjs`'s own words");
claim(V(`${POP}assert.ok(x > 0);\npopulation.seal("SEC_B", "ok");`, "p.mjs").attributed === 1,
  "🔴 FAIL-FAST: `seal()` owns the claims ABOVE it, because it drains what was pending");
claim(V(`${POP}population.seal("SEC_A", "ok");\nassert.ok(x > 0);`, "p.mjs").attributed === 0,
  "🔴 and a claim after the LAST seal belongs to nobody — pending with nothing to drain it. "
  + "A fallback that reached backwards for the nearest seal would invent that attribution");
claim(V(`${POP}population.family("F", async () => {});\nassert.ok(x > 0);\npopulation.seal("S", "ok");`, "p.mjs").attributed === 0,
  "🔴 THE WRAPPED IDIOM DISABLES THIS PATH ENTIRELY. `family()` sets current=null on exit, so "
  + "'nearest event above' would hand a post-family claim the family that just closed — and "
  + "those files need nothing here, because `family` is in TEST_FNS and the AST walk owns them");
claim(V('population.open("SEC_A");\nassert.ok(x > 0);', "p.mjs").attributed === 0,
  "…and a file that never constructs a Population has no section markers to read, whatever "
  + "it happens to call `population` — the receiver is derived from `new Population`, not assumed");

// 🔴 3. THE EXECUTED MARKER BEATS THE COMMENT, AND THAT ORDERING IS THE WHOLE CLAIM. Where
// a file carries both — ten of the eleven do — the runtime's answer is the right one and the
// comment is decoration. This is also what took BANNER_ATTRIBUTED_FLOOR from 300 to 15.
const both = V(`${POP}// ========== A DECORATIVE TITLE ===\npopulation.open("SEC_EXEC");\nassert.ok(x > 0);`, "p.mjs");
claim(both.sectionAttributed === 1 && both.bannerAttributed === 0,
  "🔴 with both present the claim counts as SECTION-attributed, not banner-attributed — "
  + "two paths, two numbers, and the one that is right about the file wins");

// 🔴 AND THE SECTION FLOOR IS THE BANNER FLOOR'S ARGUMENT AGAIN, ONE PATH LATER. There are
// now TWO fallbacks under ONE orphan ceiling, so the subtraction is even less able to say
// which of them ran: kill the section path and the banner path's growth could cover it.
claim(judgeScope(S({ blocks: 1728, attributed: 3689, bannerAttributed: 21, sectionAttributed: 0 }), 3730).failed === true,
  "🔴 section attribution at ZERO with every other number healthy still reddens");
claim(said(judgeScope(S({ blocks: 1728, attributed: 3689, bannerAttributed: 21, sectionAttributed: 0 }), 3730), "TAUT_SECTION_COLLAPSE"),
  "…and it says which path died, not just that something did");
claim(judgeScope(S({ blocks: 1728, attributed: 3689, bannerAttributed: 21 }), 3730).failed === false,
  "🔴 an unmeasured section count is NOT a collapse — same reading as the banner floor above");
claim(SECTION_ATTRIBUTED_FLOOR === 380 && SECTION_ATTRIBUTED_FLOOR < 448,
  `🔴 a literal UNDER the live value, not a rounding of it (${SECTION_ATTRIBUTED_FLOOR} vs 448 measured)`);

// 🔴 THE THIRD AND FOURTH POPULATIONS (182), AND THE COLLAPSE NEITHER OF THE FIRST TWO
// CAN SEE. Every floor above — the four in FLOORS, UNITS, CLAIMS — counts what the FINDER
// found. Nothing counted what the CLASSIFIER decided. Measured with a LATE blind, the
// axis `instrument_gate.py` gained this session: `classifyLeaf` honest for ONE call and
// returning `{ kind: "VALUE" }` for the other 1604 left the live gate printing
// BYTE-IDENTICAL output and exiting 0, and `leaves` over 1216 calls did the same.
//
// `allShape` cannot be reached without a working classifier — it needs EVERY leaf of a
// claim to come back SHAPE — and `precondition` needs every leaf's TEXT. Both are healthy
// and non-zero on a clean tree (116 and 61), which `vacuous`, `every` and `offender` are
// not: their healthy value is zero, so no floor can sit on them at all (181 §5).
claim(judgeScope(S({ blocks: 1408, attributed: 3317, shaped: 0 }), 3360).failed === true,
  "🔴 a classifier that classified NOTHING as SHAPE reddens — the case that printed byte-identical output before 182");
claim(said(judgeScope(S({ blocks: 1408, attributed: 3317, shaped: 0 }), 3360), "TAUT_ATTRIBUTION_COLLAPSE SHAPED"),
  "…and it is named separately from the two attribution collapses");
claim(judgeScope(S({ blocks: 1408, attributed: 3317, precondition: 0 }), 3360).failed === true,
  "🔴 and the same collapse read from the other side: no leaf TEXT resolved to an outcome flag");
claim(said(judgeScope(S({ blocks: 1408, attributed: 3317, precondition: 0 }), 3360), "TAUT_ATTRIBUTION_COLLAPSE PRECONDITION"),
  "…named separately again, because a kind collapse and a text collapse are different failures");
claim(judgeScope(S({ blocks: 1408, attributed: 3317, shaped: SHAPED_FLOOR - 1 }), 3360).failed === true,
  "one below the shaped floor reddens");
claim(judgeScope(S({ blocks: 1408, attributed: 3317, shaped: SHAPED_FLOOR }), 3360).failed === false,
  "…and exactly at it does not");
claim(judgeScope(S({ blocks: 1408, attributed: 3317, precondition: PRECONDITION_FLOOR }), 3360).failed === false,
  "…and so does the precondition floor, at its own value");
claim(SHAPED_FLOOR >= 50 && PRECONDITION_FLOOR >= 20,
  `🔴 both classification floors are literals with headroom, not a rounding of zero (${SHAPED_FLOOR}/${PRECONDITION_FLOOR})`);
claim(said(judgeScope(S({ blocks: 1408, attributed: 3317 }), 3360), "TAUT_CLASSIFIED shaped=116/"),
  "the classification counts print on every run, green or red — a population nobody prints is a population nobody diffs");
// 🔴 ABSENT IS A COLLAPSE, NOT AN EXEMPTION. A verdict built before 182 has neither
// field, and `?? 0` makes that the loudest case rather than the quietest — which is the
// opposite of how check 14 treated the two lock fields it was written for.
// 🔴 ONE CASE PER `??`, NOT ONE FOR BOTH — the boundary gate's twin of this case was
// caught green by `mutate182.py`'s G5 for exactly this reason: with both absent, either
// row alone reddens the verdict, so the case proves only that ONE of the two defaults
// bites and cannot say which.
claim(judgeScope({ blocks: 1408, attributed: 3317 }, 3360).failed === true,
  "🔴 a verdict carrying NO classification population at all fails rather than skipping");
claim(said(judgeScope({ blocks: 1408, attributed: 3317, precondition: 61 }, 3360), "TAUT_ATTRIBUTION_COLLAPSE SHAPED"),
  "…an absent SHAPED population alone collapses, by name");
claim(said(judgeScope({ blocks: 1408, attributed: 3317, shaped: 116 }, 3360), "TAUT_ATTRIBUTION_COLLAPSE PRECONDITION"),
  "…and an absent PRECONDITION population alone collapses, by its own name");
// …and the two are produced by `verdict()` itself, from real source, not only asserted here.
claim(V(wrap(`  assert.ok(typeof x === "string");`)).shaped === 1,
  "verdict() counts a claim whose every leaf is SHAPE — the population the floor pins");
claim(V(wrap(`  assert.equal(x, 1);`)).shaped === 0,
  "…and a claim that compares a VALUE is not one of them");

// 🔴 AND THE WIRE, WHICH THE SWEEP CAUGHT AFTER THE FLOOR LOOKED FINISHED. `mutate180`'s
// G5 deleted `if (scope.failed) failed = true` from `main()` and G6 stopped `judgeScope`
// running at all; BOTH stayed green, because on a healthy tree `scope.failed` is already
// false and the term it is ORed with is never satisfied apart. 174 §8, 176's G3, and
// `verdict_gate.combine()` — the third time, so it gets the same fix.
claim(combineFailed(false, { failed: true }) === true,
  "🔴 an attribution collapse REACHES the exit code — the wire, not just the verdict");
claim(combineFailed(true, { failed: false }) === true,
  "…and it does not swallow a failure raised earlier in the run");
claim(combineFailed(false, { failed: false }) === false, "a healthy run stays green");

// ── 19. 🔴 THE ARGUMENT THAT REACHES THE ASSERTION (185, answering 184 §10.2) ────────
//
// 184 §8: this gate classifies the ASSERTION, not the argument that reaches it. Its own
// reverse sweep predicted a `tcheck` whose reading was replaced by a literal would be
// caught, and it was not — `actual !== expected` is a value comparison however vacuous
// the operands are one frame up. 184 refused to patch it on a hunch and asked for the
// population first. Measured (`host/_to_delete/laundered185.mjs`, `identical185.mjs`):
//
//   30 of 3591 claim sites reach the classifier through an asserter helper (0.8%),
//   across THREE helpers in TWO files — too small to build a rule around; and
//   2006 comparisons in the swept tree, ONE with textually identical sides, and that
//   one is a REAL claim (`assert.ok === assert.ok` over a memoising Proxy).
//
// So the rule is not "the helper's callers must vary" and not "identical sides are
// vacuous". It is: an operand DECIDED AT AUTHORING TIME on BOTH sides. 184's own framing
// — "the question is not 'flag constant operands', that false-fails every honest
// `assert.equal(count, 3)`" — is one word from the rule that works: ALL, not ANY.
const EXPR = (body) => `import assert from "node:assert/strict";\ntest("t", () => {\n${body}\n});\n`;
claim(V(EXPR(`  assert.ok(84 !== 84);`)).vacuous.length === 1,
  "🔴 a literal-vs-literal comparison inside assert.ok() is vacuous — the EXPRESSION spelling of a rule "
  + "the METHOD spelling has had since 169, and the branch 184's G2 mutant escaped through");
claim(V(EXPR(`  assert.ok(census(d).files !== 84);`)).vacuous.length === 0,
  "…and a reading compared to a literal is untouched — the false-fail 184 §10.2 was right to refuse");
claim(V(EXPR(`  assert.equal(count, 3);`)).vacuous.length === 0,
  "as is the honest method spelling of the same shape");
claim(V(EXPR(`  assert.notEqual(3, 4);`)).vacuous.length === 1,
  "🔴 notEqual is the third spelling and never had the check at all");
claim(V(EXPR(`  assert.notEqual(r.value, 3);`)).vacuous.length === 0,
  "…and it still constrains when one side is a reading");
claim(V(EXPR(`  assert.ok(-1 < 0);`)).vacuous.length === 1,
  "a RELATIONAL comparison between literals is decided at authoring time too, and `-1` is a "
  + "prefix-unary over a literal rather than a literal — structural, not a text test (174 §6)");
claim(V(EXPR(`  assert.ok(rows.length > 0);`)).vacuous.length === 0,
  "…while a relational against a reading is the floor idiom the tree is full of");
// 🔴 AND THE HALF THE HELPER HIDES, WHICH IS G2 ITSELF. The guard is the same text at
// every call site, so nothing about it can distinguish a reading from a constant. The
// call site can.
const TCHECK = `function pass(m, d) {}\nfunction fail(m, d) {}\n`
  + `const tcheck = (marker, actual, expected) => {\n  if (actual !== expected) return fail(marker, "got");\n  pass(marker, "ok");\n};\n`;
claim(V(TCHECK + `tcheck("HONEST", census(dir).files, 84);`).vacuous.length === 0,
  "a helper call supplying a READING and a literal is honest and stays green");
claim(V(TCHECK + `tcheck("G2", 84, 84);`).vacuous.length === 1,
  "🔴 and the same helper called with only literals is vacuous — 184's G2 mutant, caught at the site it was written");
// 🔴 199 §9.2 — FOUR CHAINED READS, EVERY ONE ABLE TO MISS. A blinded `collectAsserters`
// fills no lookup, so `[0].leaves` threw here and the two failures already recorded above
// never reached a verdict line. Guarded end to end: `?.includes(…)` yields `undefined`,
// the claim fails, and the gate says so.
claim(A(TCHECK + `tcheck("G2", 84, 84);`)?.[0]?.leaves?.[0]?.why?.includes("every argument to tcheck()") === true,
  "…and the report names the CALL SITE's arguments, not the guard, so the reader is sent to the right frame");
// 🔴 THE DISMISSAL THAT KEEPS THE RULE NARROW, AND IT IS THE ONE INSTANCE IN THE TREE.
// `_population.selftest.mjs:197` asserts `assert.ok === assert.ok` — a real claim,
// because that `assert` is a memoising Proxy and evaluating the same text twice need not
// give the same value. A rule reading "identical sides" would have reddened the single
// honest instance of its own shape and been deleted on the first green run.
claim(V(EXPR(`  assert.ok(proxy.ok === proxy.ok);`)).vacuous.length === 0,
  "🔴 identical PROPERTY ACCESSES are not literals — a getter or a Proxy trap can differ between evaluations");
claim(V(EXPR(`  assert.ok(x !== x);`)).vacuous.length === 0,
  "🔴 nor is `x !== x` — that is the NaN idiom, and an identifier is not decided at authoring time");
claim(V(EXPR("  assert.ok(`a` !== `b`);")).vacuous.length === 1,
  "a template literal with no substitution is decided at authoring time");
claim(V(EXPR("  assert.ok(`${x}` !== `b`);")).vacuous.length === 0,
  "…and one WITH a substitution is a reading");

// ── 242: THE FIXTURE NAME, AND THE HALF OF IT THAT IS NOT FALSIFIABLE ────────────────
// 🔴 THE NAME IS OBSERVABLE ON THE ROW, WHICH IS WHY THIS IS A CLAIM AND NOT AN ARITY
// CHECK. Every claim `analyze` returns carries the `file` it was parsed under, so "the
// argument reached the assertion" is a fact about the OUTPUT rather than about the
// signature — and it is the fact that was false: before 242 both helpers took one
// parameter and dropped the second, so `V(src, "p.mjs").vacuous[0].file` read
// `fixture.ts`. Collapse either signature back to `(src)` and both lines below redden
// here, in the file that owns them, rather than in a checker nobody runs.
// 185 §19 was titled "the argument that reaches the assertion" and swept this gate's
// SUBJECT; the same defect was sitting in the file's own two helpers for fifty-seven
// sessions, and what finally reported it was `tsc --allowJs --checkJs`, off the shelf.
// 🔴 `?? {}` IS NOT DEFENSIVE STYLE, IT IS WHAT MAKES THESE CLAIMS BLINDABLE — and the
// instrument gate refused the first draft for the want of it. `instrument_gate.py` blinds
// `analyze`, `verdict`, `leaves` and `classifyLeaf` in turn and requires this file to go
// RED *with a verdict*; a bare `[0].file` throws a TypeError on the empty array a blind
// returns, so all four rows crashed the runner instead of failing it. `CRASH_CEILING 4 >
// 0` — a crash proves that JavaScript throws on an empty, not that the claim bites.
claim((A(wrap("  assert.equal(x, 1);"), "k.mjs")[0] ?? {}).file === "k.mjs"
   && (A(wrap("  assert.equal(x, 1);"))[0] ?? {}).file === "fixture.ts",
  "🔴 `A` forwards the fixture name and still defaults without one — both directions, because a helper that ignored the argument passed the first half by accident");
claim((V(wrap("  assert.ok(true);"), "p.mjs").vacuous[0] ?? {}).file === "p.mjs",
  "🔴 …and `V` forwards it too — the helper the seven call sites below actually use");

// 🔴 AND THE HONEST HALF: `ScriptKind` IS NOT OBSERVABLE THROUGH `analyze` TODAY, SO THE
// SEVEN `.mjs` NAMES ARE DOCUMENTARY AND THIS SESSION SAYS SO RATHER THAN IMPLYING MORE.
// `analyze` picks TS or JS off `/\.ts$/` and nothing else, and TypeScript's JS parser
// still builds an AST for TS-only syntax — `as` casts, type annotations, generic call
// arguments and `satisfies` were each measured through both kinds and every one agreed on
// sites and on verdict. This claim pins that agreement: the day `analyze` grows behaviour
// that depends on the name, it reddens, and the seven claims below stop being decoration
// and start needing a re-read. That is the only direction in which it CAN fail, which is
// why it is written as an agreement and not as a difference.
claim(A(wrap("  assert.equal((x as any).n, 1);"), "k.ts").length
   === A(wrap("  assert.equal((x as any).n, 1);"), "k.mjs").length,
  "🔴 the fixture name changes nothing `analyze` returns today — pinned so that the day it does, the seven claims that pass one are re-read rather than trusted");

// ── the floor on this file itself (170 §5) ───────────────────────────────────────────
// 🔴 IT CAUGHT ITS OWN MISCOUNT ON THE FIRST RUN — 170 §5's experience, verbatim: the
// literal read 35 and 37 claims actually ran. Keep it a literal for that reason.
// 🆕 185: WRITTEN AT 125 FROM A COUNT OF THE CASES AND CAUGHT ITSELF AT 124 ON THE FIRST
// RUN — 170 §5's experience for the fourth time, and the reason the literal stays.
const EXPECTED = 175;  // 275: 160 -> 175 (the duration idiom — both directions on each arm of `durationClaim`, the two `judgeDuration` branches a healthy tree cannot reach, the floor that may not be zero, and the end-to-end parse) · 242: 157 -> 160 (the fixture name that reached nothing — `A` and `V` forwarding it, read off the row's own `file`, and the pinned agreement that says the name is documentary until `analyze` makes it otherwise) · 194: 141 -> 157 (the SECOND fallback — the executed `population.open`/`seal` marker the runtime already counts by, the two banner idioms the reader could not see, the ordering that puts the executed marker ahead of the comment, and SECTION_ATTRIBUTED_FLOOR) · 193: 132 -> 141 (BANNER_ATTRIBUTED_FLOOR — the section-banner fallback counted as its own population, and the arm where it dies while every other number stays healthy) · 191: 124 -> 132 (ORPHAN_CEILING — the other side of `sites - attributed`, floored from one side only since 170 and carried by nine handoffs) · 185: 110 -> 124 (§19, the argument that reaches the assertion — 184 §10.2) · 183: 108 -> 110 (FILE_FLOORS, keys and values, §3) · 175: 67 -> 78 (the resolver, roster, HELPERS_NOT_ROSTERED) · 180: 78 -> 90 (§18, the output floor) · 181: 93 -> 94 (the FLOORS values, §11.3) · 182: 94 -> 108 (the CLASSIFIER's own two populations, §11.2's late blind, plus one case per `??` after mutate182's G5)
if (ran !== EXPECTED) {
  console.log(`🔴 TAUT_SELFTEST_SCOPE ${ran} claims ran, expected ${EXPECTED} — a case stopped running`);
  process.exit(1);
}
if (bad) { console.log(`🔴 TAUT_SELFTEST ${bad} of ${ran} claims FAILED`); process.exit(1); }
console.log(`TAUT_SELFTEST ok every claim held (${ran} claim(s) ran)`);

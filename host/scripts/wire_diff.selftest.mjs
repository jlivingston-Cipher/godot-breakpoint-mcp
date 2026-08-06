#!/usr/bin/env node
// wire_diff.selftest.mjs — the refusal proof for check 8's classifier.
//
// 🔴 THE ROWS DRIVE THE PURE CORE, so the proof needs no worktree, no tsc, no server and
// no tags. That is deliberate and it is what makes this a CI step rather than a release
// step: the live half needs a baseline ref to exist, and a check that can only run at
// release time has been audited only at release time.
//
// 🔴 AND THE THING THIS TABLE IS REALLY FOR. A release classifier that answers PATCH is
// indistinguishable, from the outside, from a release classifier that answers PATCH to
// everything. Fifteen of the nineteen rows are cases where PATCH is the WRONG answer, and
// they are the only reason the PATCH this file prints on most releases means anything.
//
// 🔴 NOTHING HERE THROWS, AND THAT IS THE INSTRUMENT GATE'S REQUIREMENT RATHER THAN A
// STYLE. A bare `assert` aborts the process, so a blinded `classify` would kill this file
// before it printed its verdict — and "the gate caught it" and "the mutant crashed the
// gate" become one observable (181 §4). Every case goes through `claim()`, every risky
// call through `safe()`, and the run reaches WIRE_DIFF_SELFTEST either way.
import {
  classify, normalise, shapeOf, typeName, effectiveTaskSupport, SURFACE_FLOOR, SHAPE_FLOOR,
} from "./wire_diff.mjs";

let ran = 0, bad = 0;
const claim = (cond, what) => {
  ran++;
  if (!cond) { bad++; console.log(`🔴 FAILED: ${what}`); }
};
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
// 🆕 211 §4 — COUNTED, BECAUSE THE SUMMARY LINE USED TO SAY "collapse refuses on 4
// shapes" AS A LITERAL. It was true when it was typed and this session added three more
// without it moving. A number printed beside a population it does not read is the same
// defect `control_gate` refuses one file over; the fix is that `threw` is the only way a
// collapse row can be written, so the count cannot drift from the rows again.
let collapseShapes = 0;
const threw = (fn, re) => {
  collapseShapes++;
  try { fn(); return false; } catch (e) { return re.test(String(e?.message ?? e)); }
};

// 🔴 NAMED AND PINNED, for 176's reason one file over: a bare `if (ran < 50)` is read by
// exactly one branch and asserted by nothing, so the collapse detector can be switched
// off without a single case noticing.
const CLAIM_FLOOR = 50;

// 🔴 GROWN AGAINST THE LIVE CONSTANT, not against a number typed beside it (206 §3.2).
// A self-test that hard-codes what the floor is supposed to be agrees with itself over a
// deleted floor.
// 🆕 211 §4 — AND THE SAME ARGUMENT NOW APPLIES TO THE SECOND FLOOR. `pad` used to emit
// ONE property per tool, so `pad(SURFACE_FLOOR)` cleared the tool floor and read 200
// schema paths — below `SHAPE_FLOOR`, which is the point of that floor existing. The
// width is DERIVED from the two constants rather than typed beside them, for the same
// reason the height is: a padder that hard-codes eleven agrees with itself over a raised
// floor, and the rows above would start refusing for a reason no row is named for.
const PAD_PROPS = Math.ceil(SHAPE_FLOOR / SURFACE_FLOOR) + 1;
const padProps = () => Object.fromEntries(
  Array.from({ length: PAD_PROPS }, (_, j) => [`p${j}`, { type: "string" }]));
const pad = (n, from = []) => [
  ...from,
  ...Array.from({ length: Math.max(0, n - from.length) }, (_, i) => ({
    name: `fam${i % 7}_pad${i}`,
    description: "d",
    inputSchema: { type: "object", properties: padProps() },
  })),
];
const BASE = pad(SURFACE_FLOOR);

// One tool, mutated — every row below is BASE with a head prepended, so the only thing
// that differs between baseline and current is the thing the row is named for.
const head = (over) => [{
  name: "a_subject",
  description: "the tool under test",
  title: "A Subject",
  inputSchema: {
    type: "object",
    properties: { keep: { type: "string" }, opt: { type: "number" } },
    required: ["keep"],
  },
  outputSchema: { type: "object", properties: { r: { type: "string" } } },
  ...over,
}, ...BASE];

const IN = (over) => ({
  inputSchema: {
    type: "object",
    properties: { keep: { type: "string" }, opt: { type: "number" }, ...over.properties },
    required: over.required ?? ["keep"],
  },
});

const ROWS = [
  // (name, before, after, wantVerdict, wantSubstring)
  ["an identical surface is PATCH and names nothing",
    head({}), head({}), "PATCH", ""],

  // ── MAJOR: a caller that worked can now fail ───────────────────────────────────────
  ["🔴 a tool REMOVED",
    head({}), BASE, "MAJOR", "TOOL REMOVED  a_subject"],
  ["🔴 an input property REMOVED",
    head({}),
    head({ inputSchema: { type: "object", properties: { keep: { type: "string" } }, required: ["keep"] } }),
    "MAJOR", "inputSchema.opt REMOVED"],
  ["🔴 an input property's TYPE changed",
    head({}), head(IN({ properties: { opt: { type: "string" } } })),
    "MAJOR", "inputSchema.opt type number -> string"],
  ["🔴 an optional input property became REQUIRED",
    head({}), head(IN({ required: ["keep", "opt"] })),
    "MAJOR", "inputSchema.opt became REQUIRED"],
  ["🔴 an OUTPUT property removed — a client that reads it now reads undefined",
    head({}), head({ outputSchema: { type: "object", properties: {} } }),
    "MAJOR", "outputSchema.r REMOVED"],
  ["🔴 outputSchema removed entirely",
    head({}), head({ outputSchema: undefined }), "MAJOR", "outputSchema REMOVED"],
  ["🔴 a NESTED property removed — the walk goes deeper than one level",
    head({ inputSchema: { type: "object", properties: { o: { type: "object", properties: { deep: { type: "string" } } } } } }),
    head({ inputSchema: { type: "object", properties: { o: { type: "object", properties: {} } } } }),
    "MAJOR", "inputSchema.o.deep REMOVED"],
  ["🔴 an ARRAY ITEM's property removed — items are walked too",
    head({ inputSchema: { type: "object", properties: { xs: { type: "array", items: { type: "object", properties: { id: { type: "string" } } } } } } }),
    head({ inputSchema: { type: "object", properties: { xs: { type: "array", items: { type: "object", properties: {} } } } } }),
    "MAJOR", "inputSchema.xs[].id REMOVED"],
  ["🔴 MAJOR outranks a MINOR in the same diff",
    head({}),
    head({ inputSchema: { type: "object", properties: { keep: { type: "string" }, added: { type: "string" } }, required: ["keep"] } }),
    "MAJOR", "inputSchema.opt REMOVED"],

  // ── MINOR: new surface, additively ─────────────────────────────────────────────────
  ["🔴 a tool ADDED",
    head({}), [{ name: "z_new", description: "n", inputSchema: { type: "object" } }, ...head({})],
    "MINOR", "TOOL ADDED  z_new"],
  ["🔴 an input property ADDED",
    head({}), head(IN({ properties: { extra: { type: "string" } } })),
    "MINOR", "inputSchema.extra ADDED"],
  ["🔴 a required property became OPTIONAL",
    head({}), head(IN({ required: [] })), "MINOR", "inputSchema.keep no longer required"],
  ["🔴 taskSupport moved off the default",
    head({}), head({ execution: { taskSupport: "optional" } }),
    "MINOR", "taskSupport forbidden -> optional"],
  ["🔴 an annotation moved",
    head({}), head({ annotations: { readOnlyHint: true } }), "MINOR", "annotations moved"],

  // ── PATCH: prose, and the two removals #256 made ───────────────────────────────────
  ["a description edit is PATCH — it moves what a MODEL sees, and breaks no caller",
    head({}), head({ description: "reworded" }), "PATCH", "description moved"],
  ["🔴 #256's OWN CHANGE IS PATCH — the dialect declaration is not a public-API event",
    head({ inputSchema: { $schema: "http://json-schema.org/draft-07/schema#", type: "object", properties: { keep: { type: "string" } }, required: ["keep"] } }),
    head({ inputSchema: { type: "object", properties: { keep: { type: "string" } }, required: ["keep"] } }),
    "PATCH", ""],
  ["🔴 AND SO IS DROPPING execution:{taskSupport:'forbidden'} — absent IS the default",
    head({ execution: { taskSupport: "forbidden" } }), head({}), "PATCH", ""],

  // 🔴 THE ROW THE FIRST DRAFT WOULD HAVE FAILED, AND IT IS 208 §3's FINDING IN THIS FILE.
  // `normalise` used to delete every key named `$schema` at any depth before comparing.
  // That made the row ABOVE pass for the wrong reason and blinded the classifier to a
  // tool's own property of the same name: removing it read as PATCH. The strip is gone;
  // this row is what stops it coming back wearing a fail-safe's face.
  ["🔴 a property NAMED $schema is the AUTHOR'S vocabulary, not the protocol's",
    head({ inputSchema: { type: "object", properties: { keep: { type: "string" }, $schema: { type: "string" } }, required: ["keep"] } }),
    head({ inputSchema: { type: "object", properties: { keep: { type: "string" } }, required: ["keep"] } }),
    "MAJOR", "inputSchema.$schema REMOVED"],
];

// ── 1. THE TABLE ─────────────────────────────────────────────────────────────────────
console.log("WIRE_DIFF selftest — check 8's classifier, proved without a worktree");
for (const [name, before, after, wantVerdict, want] of ROWS) {
  const got = safe(() => classify(before, after));
  const all = got ? [...got.major, ...got.minor, ...got.patch].join(" | ") : "";
  claim(got !== null && got.verdict === wantVerdict,
    `${name} — expected ${wantVerdict}, got ${got?.verdict ?? "THREW"}`);
  if (want !== "") {
    claim(all.includes(want), `${name} — expected a reason naming ${want}, got ${all || "nothing"}`);
  } else {
    claim(got !== null && got.moved === 0, `${name} — expected nothing reported, got ${all}`);
  }
  console.log(`  ${String(got?.verdict ?? "THREW").padEnd(6)} moved `
    + `${String(got?.moved ?? 0).padStart(3)}  ${name}`);
}

// ── 2. THE FLOOR, WHICH IS THE ONE REFUSAL NO ROW ABOVE CAN REACH ────────────────────
// 🔴 EVERY ROW ABOVE COMPARES TWO POPULATED SURFACES. The failure this file exists for is
// the one where BOTH reads returned nothing and the classifier agreed with itself
// perfectly. That case has to be constructed, and it has to THROW rather than report.
const COLLAPSE = /WIRE_DIFF POPULATION COLLAPSED/;
claim(threw(() => classify([], []), COLLAPSE), "both surfaces empty must refuse");
claim(threw(() => classify([], BASE), COLLAPSE), "an empty baseline must refuse");
claim(threw(() => classify(BASE, []), COLLAPSE), "an empty current surface must refuse");
claim(threw(() => classify(pad(SURFACE_FLOOR - 1), BASE), COLLAPSE),
  "one tool under the floor must refuse — the floor's EDGE");
claim(safe(() => classify(BASE, BASE))?.verdict === "PATCH",
  "exactly at the floor stays legal — the other side of the same edge");

// ── 3. THE CONSTANT ITSELF, OR EVERY ROW ABOVE ASSERTS ABOUT NOTHING ─────────────────
// 🔴 An undefined SURFACE_FLOOR makes every `size < undefined` false and the whole table
// keeps passing. 172 §10.21's shape.
// 🆕 211 §4 — THE SECOND FLOOR, AND THE ROW ABOVE CANNOT REACH IT EITHER. Every case in
// this file so far compares two surfaces that PASSED `SURFACE_FLOOR`; the failure this
// block is for is the one where they pass it and `shapeOf` reads nothing on EITHER side.
// 🔴 SYMMETRIC ON PURPOSE. A one-sided emptying reads as mass removal and classifies
// MAJOR, which is loud. The one that had to be constructed is the one where the same
// broken reader ran over both payloads and they agreed perfectly — verdict PATCH, exit 0.
const SHAPE_COLLAPSE = /WIRE_DIFF SHAPE POPULATION COLLAPSED/;
const flat = (n) => Array.from({ length: n }, (_, i) => ({
  name: `fam${i % 7}_pad${i}`,
  description: "d",
  // A schema `shapeOf` cannot descend: no `properties`, so no paths — which is precisely
  // what an SDK moving to `$defs` or a wrapper envelope would leave behind.
  inputSchema: { type: "object", $defs: { p: { type: "string" } } },
}));
claim(threw(() => classify(flat(SURFACE_FLOOR), flat(SURFACE_FLOOR)), SHAPE_COLLAPSE),
  "🔴 a schema read that returns NOTHING on both sides must refuse, not answer PATCH");
claim(safe(() => classify(flat(SURFACE_FLOOR), flat(SURFACE_FLOOR)))?.verdict !== "PATCH",
  "🔴 and it must not be reachable as a verdict at all — PATCH here is the whole defect");
claim(threw(() => classify(BASE, flat(SURFACE_FLOOR)), SHAPE_COLLAPSE),
  "one side emptied must refuse too — the floor reads BOTH counts");
claim(safe(() => classify(BASE, BASE))?.paths?.before >= SHAPE_FLOOR,
  "a populated surface must report the path count it actually read");
claim(safe(() => classify(BASE, BASE))?.paths?.floor === SHAPE_FLOOR,
  "and it must report the floor it was judged against, so the pair can be read together");

claim(Number.isInteger(SURFACE_FLOOR) && SURFACE_FLOOR > 0,
  "SURFACE_FLOOR must be a positive integer");
// 🔴 THE SAME 172 §10.21 ARGUMENT. An undefined SHAPE_FLOOR makes every `n < undefined`
// false and the six rows above keep passing over a floor that is not there.
claim(Number.isInteger(SHAPE_FLOOR) && SHAPE_FLOOR > 0,
  "SHAPE_FLOOR must be a positive integer");
claim(PAD_PROPS * SURFACE_FLOOR >= SHAPE_FLOOR,
  "the padder must actually clear the shape floor it is derived from");
claim(Number.isInteger(CLAIM_FLOOR) && CLAIM_FLOOR > 0,
  "CLAIM_FLOOR must be a positive integer");

// ── 4. THE NORMALISERS, DERIVED AND NOT ASSUMED ──────────────────────────────────────
// 🔴 The rows prove the COMPARISON works. They cannot prove the normalisers PRODUCE
// anything from a real shape — one wired to a typo returns a constant and every row above
// still passes, because both sides go through the same broken function.
claim(effectiveTaskSupport({}) === "forbidden", "an absent execution key IS the spec's forbidden");
claim(effectiveTaskSupport({ execution: { taskSupport: "optional" } }) === "optional",
  "an explicit taskSupport must survive normalisation");
claim(safe(() => normalise({ name: "t", execution: { taskSupport: "optional" } }).taskSupport) === "optional",
  "normalise must carry the effective taskSupport onto the compared object");
claim(safe(() => normalise({ name: "t" }).execution, "SET") === undefined,
  "normalise must not leave the raw execution key on the compared object");
// 🔴 THE ABSENCE OF THE STRIP, ASSERTED. A key the author happens to name `$schema` must
// survive normalisation — the row above proves the CLASSIFIER sees it, this proves the
// normaliser does not eat it on the way in.
claim(safe(() => normalise({ name: "t", inputSchema: { properties: { $schema: { type: "string" } } } })
  .inputSchema.properties.$schema.type) === "string",
  "normalise must not delete an author's own $schema-named property");

claim(typeName({ type: "string" }) === "string", "a plain type is its own name");
claim(typeName({ type: ["string", "null"] }) === "null|string", "a union must be order-stable");
// 🆕 211 §3 — ARITY WAS NOT ENOUGH, AND THESE THREE ROWS ARE WHY IT LOOKED LIKE IT WAS.
// They asserted `enum(3)`, `anyOf(2)` and `const` — every one of them true, and every one
// of them satisfied by a reader that cannot tell `["a","b"]` from `["x","y"]`. A row that
// pins the count pins the count. The pairs below pin the DISTINCTION.
claim(typeName({ enum: [1, 2, 3] }).startsWith("enum(3"), "an enum names its arity");
claim(typeName({ anyOf: [{}, {}] }).startsWith("anyOf(2"), "anyOf names its arity");
claim(typeName({ const: 1 }).startsWith("const("), "a const is its own kind");
claim(typeName({ const: "v1" }) !== typeName({ const: "v2" }),
  "🔴 two consts with different VALUES are different types to a caller");
claim(typeName({ enum: ["a", "b"] }) !== typeName({ enum: ["x", "y"] }),
  "🔴 two enums of equal arity and different MEMBERS are different types to a caller");
claim(typeName({ enum: ["a", "b"] }) === typeName({ enum: ["b", "a"] }),
  "…but member ORDER is not a wire event — the digest is over the sorted members");
claim(typeName({ type: "string" }) !== typeName({ type: "string", pattern: "^a" }),
  "🔴 a constraint that NARROWS an existing type is a caller-breaking change");
claim(typeName({ type: "integer", minimum: 0 }) !== typeName({ type: "integer", minimum: 99 }),
  "🔴 and so is moving one");
claim(typeName({ type: "string" }) === typeName({ type: "string", description: "d" }),
  "…while prose beside the type is still not one");
claim(typeName({ anyOf: [{ type: "string" }, { type: "number" }] })
  !== typeName({ anyOf: [{ type: "string" }, { type: "null" }] }),
  "🔴 anyOf branches that were RETYPED at equal arity are a change");
// 🔴 THE BOUND, ASSERTED. A digest that grew with the value would put a whole enum into
// every diff line and make the reader's output unreadable — which is the argument the
// original `enum(n)` was making, and it was right about that much.
claim(typeName({ enum: Array.from({ length: 500 }, (_, i) => `member_${i}`) }).length < 40,
  "the value fingerprint must stay bounded however large the value is");
claim(typeName(undefined) === "unknown", "an absent schema node is unknown, not a crash");

const sh = safe(() => shapeOf({
  type: "object",
  properties: { a: { type: "string" }, b: { type: "object", properties: { c: { type: "number" } } } },
  required: ["a"],
}), new Map());
claim(sh.size === 3, "shapeOf must find the nested property, not only the two at the root");
claim(sh.get("a")?.type === "string" && sh.get("a")?.required === true,
  "a required root property is reported required");
claim(sh.get("b.c")?.type === "number" && sh.get("b.c")?.required === false,
  "a nested property is reported by its dotted path and is not required");
claim(safe(() => shapeOf(undefined).size, -1) === 0, "an absent schema is an empty shape, not a crash");

// ── 5. THE TABLE'S OWN SHAPE — A PROOF THAT CANNOT REFUSE IS NOT A PROOF ─────────────
const nonPatch = ROWS.filter((r) => r[3] !== "PATCH").length;
const majors = ROWS.filter((r) => r[3] === "MAJOR").length;
claim(majors >= 6,
  `only ${majors} MAJOR row(s) — this table has stopped proving the classifier can refuse`);
claim(nonPatch >= 10,
  `only ${nonPatch} non-PATCH row(s) — a classifier only ever asked for PATCH proves nothing`);

// 🆕 211 §4 — AND THE COLLAPSE ROWS GET A FLOOR OF THEIR OWN, for the reason the file
// already gives about `ran`: deleting them leaves every remaining row comparing two
// populated surfaces, which is the one case that was never the problem.
const COLLAPSE_SHAPE_FLOOR = 6;
// 🔴 AND THE CONSTANT ITSELF, for the reason the two floors above already carry: a
// `>=` against zero can never fire, so a floor moved to zero is a deleted floor wearing
// a name. `floor_pin_gate` moves it and requires this file to redden.
claim(Number.isInteger(COLLAPSE_SHAPE_FLOOR) && COLLAPSE_SHAPE_FLOOR > 0,
  "COLLAPSE_SHAPE_FLOOR must be a positive integer");
claim(collapseShapes >= COLLAPSE_SHAPE_FLOOR,
  `only ${collapseShapes} collapse shape(s) constructed, floor ${COLLAPSE_SHAPE_FLOOR} — `
  + `the refusals this file exists for have been deleted`);

console.log(`\n  ${ROWS.length} rows · ${nonPatch} answer something other than PATCH `
  + `(${majors} MAJOR) · collapse refuses on ${collapseShapes} shapes`);
console.log(`WIRE_DIFF_SELFTEST ${ran - bad}/${ran} claims`);
if (bad) { console.log(`🔴 WIRE_DIFF_SELFTEST FAILED — ${bad} of ${ran}`); process.exit(1); }
// 🔴 THE COLLAPSE DETECTOR FOR THIS FILE ITSELF. Cases deleted, or a loop that stopped
// running, leaves every claim above vacuously satisfied and the file green.
if (ran < CLAIM_FLOOR) {
  console.log(`🔴 WIRE_DIFF_SELFTEST ran ${ran} claims, floor is ${CLAIM_FLOOR} — cases `
    + `were deleted or stopped running`);
  process.exit(1);
}
console.log("WIRE_DIFF_SELFTEST ok");

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
  classify, normalise, shapeOf, typeName, effectiveTaskSupport, SURFACE_FLOOR,
} from "./wire_diff.mjs";

let ran = 0, bad = 0;
const claim = (cond, what) => {
  ran++;
  if (!cond) { bad++; console.log(`🔴 FAILED: ${what}`); }
};
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
const threw = (fn, re) => {
  try { fn(); return false; } catch (e) { return re.test(String(e?.message ?? e)); }
};

// 🔴 NAMED AND PINNED, for 176's reason one file over: a bare `if (ran < 50)` is read by
// exactly one branch and asserted by nothing, so the collapse detector can be switched
// off without a single case noticing.
const CLAIM_FLOOR = 50;

// 🔴 GROWN AGAINST THE LIVE CONSTANT, not against a number typed beside it (206 §3.2).
// A self-test that hard-codes what the floor is supposed to be agrees with itself over a
// deleted floor.
const pad = (n, from = []) => [
  ...from,
  ...Array.from({ length: Math.max(0, n - from.length) }, (_, i) => ({
    name: `fam${i % 7}_pad${i}`,
    description: "d",
    inputSchema: { type: "object", properties: { p: { type: "string" } } },
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
claim(Number.isInteger(SURFACE_FLOOR) && SURFACE_FLOOR > 0,
  "SURFACE_FLOOR must be a positive integer");
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
claim(typeName({ enum: [1, 2, 3] }) === "enum(3)", "an enum names its arity");
claim(typeName({ anyOf: [{}, {}] }) === "anyOf(2)", "anyOf names its arity");
claim(typeName({ const: 1 }) === "const", "a const is its own kind");
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

console.log(`\n  ${ROWS.length} rows · ${nonPatch} answer something other than PATCH `
  + `(${majors} MAJOR) · collapse refuses on 4 shapes`);
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

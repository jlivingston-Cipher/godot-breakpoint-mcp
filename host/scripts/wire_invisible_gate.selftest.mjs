#!/usr/bin/env node
// wire_invisible_gate.selftest.mjs — the refusal proof for the roster.
//
// 🔴 THE ROWS DRIVE `audit`, WHICH TAKES THE MEASUREMENT AS AN ARGUMENT. So this needs no
// build, no server and no dist/ — a proof that can only run after `npm run build` is a
// proof that has only ever been run at build time.
//
// 🔴 AND THE ROW THIS FILE IS REALLY FOR IS THE ONE WHERE NOTHING COUNTS DIFFERENTLY. A
// roster keyed on a COUNT goes green when one site is deleted and another appears, which
// is 229 §2's argument and 230 §2's, and is why this gate names sites. If that row is ever
// deleted the gate can be replaced by `wc -l` without a single other case noticing.
//
// 🔴 NOTHING HERE THROWS. A bare `assert` aborts the process, so a blinded `audit` would
// kill this file before it printed a verdict and "the gate caught it" and "the mutant
// crashed the gate" would be one observable (181 §4).
import { z } from "zod";
import {
  audit, walkNode, walkSurface, stripCheck, siteKey, checkKind,
  TOOL_FLOOR, FACT_FLOOR, SITE_FLOOR, WIRE_INVISIBLE,
} from "./wire_invisible_gate.mjs";

let ran = 0, bad = 0;
const claim = (cond, what) => {
  ran++;
  if (!cond) { bad++; console.log(`🔴 FAILED: ${what}`); }
};
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

// 🔴 NAMED AND PINNED, for 176's reason: a bare `if (ran < 20)` is read by one branch and
// asserted by nothing, so the collapse detector can be switched off without a case noticing.
const CLAIM_FLOOR = 22;

// ── fixtures ─────────────────────────────────────────────────────────────────────────
const F = (cls, tool, io, path) => ({ cls, tool, io, path });
const SITE = "runtime_assert_perf inputSchema baseline<val>";
// 🆕 255 — A STAND-IN CLASS, BECAUSE THE SHIPPED ROSTER IS NOW EMPTY. `.finite()` was the
// one row this gate ever held and the installed zod builds no check for it at all, so the
// rows below that need a rostered class have to bring one. `number.multiple_of` is a real
// class in the installed vocabulary that this tree declares NOWHERE, which is what makes
// it usable as a hypothesis without asserting anything about the shipped surface.
const HYP = "number.multiple_of";
const HYP_ROSTER = {
  [HYP]: {
    reason: "a stand-in row for the refusal proofs below — the shipped roster is empty, and "
      + "a rule that only fires on a populated one would go unproven for as long as it stays "
      + "that way, which is exactly how a gate stops working without anybody noticing.",
    sites: [SITE],
  },
};
const HYPF = F(HYP, "runtime_assert_perf", "inputSchema", "baseline<val>");
// Filler stands in for the refinements the emitter DOES carry: they clear the fact
// floor and they must never earn a roster row, which is case 11.
const filler = (n) => Array.from({ length: n }, (_, i) =>
  F(i % 3 === 0 ? "number.number_format" : i % 3 === 1 ? "number.greater_than" : "string.string_format",
    `tool${i}`, "inputSchema", `p${i}`));
const FACTS = [...filler(FACT_FLOOR + 8), HYPF];
const TOOLS = TOOL_FLOOR + 92;
const INVIS = () => new Set([HYP]);

// 🔴 THE ROSTER UNDER TEST IS THE SHIPPED ONE WHEREVER THE CASE ALLOWS IT. A proof against
// a fixture roster agrees with itself about a file nobody reads — so case 1 drives the
// shipped table, and only the rows that need a POPULATED roster substitute `HYP_ROSTER`,
// each saying so.
const ROSTER = WIRE_INVISIBLE;
const codes = (over = {}) => safe(() => audit({
  toolCount: TOOLS, facts: FACTS, invisible: INVIS(), roster: ROSTER, ...over,
}), null)?.map((p) => p.code) ?? ["THREW"];

const row = (what, want, over) => {
  const got = codes(over);
  const ok = want.length === 0
    ? got.length === 0
    : want.every((w) => got.includes(w));
  claim(ok, `${what} — wanted ${want.join("+") || "no problem"}, got ${got.join("+") || "none"}`);
};

// ── 1. the shipped shape, and the classes that must NOT be rostered ──────────────────
// 🔴 THE SHIPPED ROSTER, AGAINST A SURFACE WHERE NOTHING IS INVISIBLE — which is the tree
// as it actually ships since 255, and the row that would redden if a row were added here
// without a live site to hang it on.
row("🟢 the shipped roster passes against the shipped measurement",
  [], { facts: filler(FACT_FLOOR + 8), invisible: new Set() });
row("🟢 the hypothesis shape passes", [], { roster: HYP_ROSTER });
row("🟢 a class the wire CARRIES needs no roster row — every live class is one of these",
  [], { roster: HYP_ROSTER, facts: [...FACTS, F("string.min_length", "vcs_commit", "inputSchema", "message")] });

// ── 2. the four refusals ─────────────────────────────────────────────────────────────
row("🔴 a refinement the emitter drops that nobody declared",
  ["UNDECLARED"], {
    roster: HYP_ROSTER,
    facts: [...FACTS, F("string.overwrite", "vcs_commit", "inputSchema", "message")],
    invisible: new Set([HYP, "string.overwrite"]),
  });
row("🔴 an UNDECLARED class against the SHIPPED roster — the state the tree is one bump from",
  ["UNDECLARED"], {
    facts: [...filler(FACT_FLOOR + 8), F("string.overwrite", "vcs_commit", "inputSchema", "message")],
    invisible: new Set(["string.overwrite"]),
  });
row("🔴 a SECOND site on a declared class — a fourth one added silently",
  ["SITES_MOVED"], {
    roster: HYP_ROSTER,
    facts: [...FACTS, F(HYP, "runtime_get_monitors", "inputSchema", "baseline<val>")],
  });
row("🔴 THE ONE THAT MATTERS — one site in, one site out, the COUNT UNCHANGED",
  ["SITES_MOVED"], {
    roster: HYP_ROSTER,
    facts: [...filler(FACT_FLOOR + 8),
      F(HYP, "runtime_get_monitors", "inputSchema", "baseline<val>")],
  });
row("🔴 a rostered class with no live site — an exemption outliving its subject",
  ["STALE_ROW"], { roster: HYP_ROSTER, facts: filler(FACT_FLOOR + 8), invisible: new Set() });
row("🔴 a rostered class the emitter has STARTED carrying",
  ["NOW_VISIBLE"], { roster: HYP_ROSTER, invisible: new Set() });
row("🔴 a roster row with no reason",
  ["NO_REASON"], {
    roster: { [HYP]: { reason: "  ", sites: [SITE] } },
  });

// ── 3. the floors, and they are behavioural rather than asserted ─────────────────────
// 🔴 `floor_pin_gate` moves each of these to 0 and requires this file to redden. It does,
// because these two rows ask the floor to REFUSE something — a floor at zero refuses
// nothing, which is the whole of what a deleted floor does.
row("🔴 a surface that failed to build reads zero tools and must not pass",
  ["SURFACE_FLOOR"], { toolCount: 0, facts: FACTS });
row("🔴 a walk that stopped descending reads zero refinements and must not pass",
  ["FACT_FLOOR"], { toolCount: TOOLS, facts: [] });
row("🔴 both collapses at once still names both floors",
  ["SURFACE_FLOOR", "FACT_FLOOR"], { toolCount: 0, facts: [], invisible: new Set() });
row("🔴 one tool short of the floor is still short",
  ["SURFACE_FLOOR"], { toolCount: TOOL_FLOOR - 1 });

// 🆕 255 — THE THIRD FLOOR, AND IT IS THE ONE THE OTHER TWO CANNOT STAND IN FOR. Every
// fact is present and the count is untouched; only the identity function has stopped
// telling one place from another, which is exactly what an `siteKey` blinded to a constant
// does. `FACT_FLOOR` sees a full population and says nothing.
row("🔴 a full population that resolves to one site — the count is fine and the identity is gone",
  ["SITE_FLOOR"], {
    facts: Array.from({ length: FACT_FLOOR + 8 }, (_, i) =>
      F(i % 2 ? "number.number_format" : "number.greater_than", "one_tool", "inputSchema", "p")),
    invisible: new Set(),
  });
row("🟢 and a population at the site floor exactly is not short",
  [], {
    facts: Array.from({ length: Math.max(FACT_FLOOR, SITE_FLOOR) + 8 }, (_, i) =>
      F("number.number_format", `tool${i}`, "inputSchema", `p${i}`)),
    invisible: new Set(),
  });
// 🔴 AND IT MUST NOT FIRE ON A COLLAPSED WALK, which is FACT_FLOOR's report to make. Two
// floors naming one collapse is how a reader learns to ignore both.
row("🔴 a walk that read nothing reports the WALK, not the sites",
  ["FACT_FLOOR"], { facts: [], invisible: new Set() });

// ── 4. the measurement's own moving part ─────────────────────────────────────────────
// If `stripCheck` stops removing anything, every class compares equal to itself, every
// class reads invisible, and the gate reddens on all of them — loud, but for the wrong
// reason. These rows keep the reason right.
const kinds = (n) => safe(() => (n._def.checks || []).map(checkKind).join(","), "<threw>");
const oneNode = z.number().multipleOf(2);
claim(safe(() => oneNode._def.checks.length, -1) === 1,
  "the fixture carries exactly the one check the strip is about");
claim(safe(() => stripCheck(oneNode, "multiple_of")._def.checks.length, -1) === 0,
  "stripCheck removes the check it is asked for");
const two = z.number().multipleOf(2).min(0);
claim(kinds(stripCheck(two, "multiple_of")) === "greater_than",
  "stripCheck removes ONLY the kind it is asked for and leaves the siblings");
claim(safe(() => stripCheck(two, "multiple_of")._def.checks, null) !== two._def.checks
  && safe(() => two._def.checks.length, -1) === 2,
  "stripCheck does not mutate the live node it was handed");
const twice = z.number().min(1).min(2);
claim(safe(() => stripCheck(twice, "greater_than")._def.checks.length, -1) === 1,
  "a repeated kind loses ONE occurrence, not all of them — the count is the population");

// 🆕 255 — AND THE ROW THE PORT EXISTS FOR. The installed zod folds each check into
// `_zod.bag` at CONSTRUCTION and the converter reads the bag, not the checks — so a strip
// that edits only the def emits the schema it was cloned from, every class compares equal,
// and every one of them reads INVISIBLE. That is a gate reporting five undeclared classes
// and hundreds of dropped rules on a tree where nothing changed, and no case above would
// have caught it: they all read the def, which the broken strip edited correctly.
claim(safe(() => stripCheck(z.number().positive(), "greater_than")._zod.bag.exclusiveMinimum, 0)
  === undefined,
  "🔴 the strip reaches the BAG the emitter actually reads, not just the def it was written from");
claim(safe(() => z.number().positive()._zod.bag.exclusiveMinimum, undefined) === 0,
  "and the live node it was handed keeps its own bag — the clone is a clone");

// ── 5. the walk names the leaf, not the parameter it hides under ─────────────────────
const found = (schema, key = "p") => safe(() => walkNode(schema, "t", "inputSchema", key, []), []);
claim(found(z.record(z.string(), z.number().multipleOf(2).optional()))[0]?.path === "p<val>",
  "a refinement inside a record's VALUE is named at the value, through the optional wrapper");
claim(found(z.array(z.object({ n: z.number().int() })))[0]?.path === "p[].n",
  "a refinement inside an array of objects is named by its full path");
claim(found(z.number().int().optional())[0]?.cls === "number.number_format",
  "a wrapper is descended through rather than reported as a class of its own");
claim(found(z.string()).length === 0, "an unrefined leaf declares nothing");
claim(safe(() => walkSurface([{ name: "t", config: { outputSchema: { r: z.number().multipleOf(2) } } }])[0]?.io, "")
  === "outputSchema",
  "the OUTPUT side is walked too — a refinement there is as invisible as one on the input");
claim(safe(() => siteKey({ tool: "a", io: "inputSchema", path: "b" }), "") === "a inputSchema b",
  "a site is tool, side and path — the three things that make it the same site");

// ── 6. the roster's own shape ────────────────────────────────────────────────────────
const rows = Object.entries(ROSTER);
// 🆕 255 — THE SHIPPED ROSTER IS EMPTY AND THAT IS ALLOWED, WHICH IS WHY THE OLD
// `rows.length >= 1` HAD TO GO RATHER THAN BE SATISFIED. It was there so an emptied table
// could not make the rules above vacuous; the rules are no longer driven by the shipped
// table alone — `HYP_ROSTER` drives every populated-roster case — so the guard that
// actually matters is that the hypothesis is not silently identical to the shipped one.
claim(Object.keys(HYP_ROSTER).length >= 1
  && !Object.prototype.hasOwnProperty.call(ROSTER, HYP),
  "the refusal proofs run against a POPULATED roster, and it is not the shipped one");
claim(rows.every(([, r]) => Array.isArray(r.sites) && r.sites.length > 0),
  "every shipped row names at least one site");
claim(rows.every(([, r]) => typeof r.reason === "string" && r.reason.trim().length > 40),
  "every shipped row says why the rule lives where the wire cannot reach it");

// 🔴 AND THE FILE'S OWN FLOOR, for the reason `wire_diff.selftest.mjs` gives beside its
// collapse floor: `ran < 0` can never fire, so a floor moved to zero is a deleted floor
// wearing a name. The two floors above need no such claim — their rows ask the gate to
// refuse an empty population, and a floor at zero refuses nothing — but this one is read
// by a single comparison at the bottom of this file and by nothing else.
claim(Number.isInteger(CLAIM_FLOOR) && CLAIM_FLOOR > 0,
  "CLAIM_FLOOR must be a positive integer");

console.log(`\n  ${rows.length} roster row(s) · floors ${TOOL_FLOOR}/${FACT_FLOOR}/${SITE_FLOOR}`);
console.log(`WIRE_INVISIBLE_SELFTEST ${ran - bad}/${ran} claims`);
if (bad) { console.log(`🔴 WIRE_INVISIBLE_SELFTEST FAILED — ${bad} of ${ran}`); process.exit(1); }
// 🔴 THE COLLAPSE DETECTOR FOR THIS FILE ITSELF. Cases deleted, or a loop that stopped
// running, leaves every claim above vacuously satisfied and the file green.
if (ran < CLAIM_FLOOR) {
  console.log(`🔴 WIRE_INVISIBLE_SELFTEST ran ${ran} claims, floor is ${CLAIM_FLOOR} — cases `
    + `were deleted or stopped running`);
  process.exit(1);
}
console.log(`WIRE_INVISIBLE_SELFTEST ok — ${ran} case(s)`);

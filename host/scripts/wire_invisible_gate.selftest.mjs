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
  audit, walkNode, walkSurface, stripCheck, siteKey,
  TOOL_FLOOR, FACT_FLOOR, WIRE_INVISIBLE,
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
const FINITE = F("ZodNumber.finite", "runtime_assert_perf", "inputSchema", "baseline<val>");
// Filler stands in for the 309 refinements the emitter DOES carry: they clear the fact
// floor and they must never earn a roster row, which is case 11.
const filler = (n) => Array.from({ length: n }, (_, i) =>
  F(i % 3 === 0 ? "ZodNumber.int" : i % 3 === 1 ? "ZodNumber.min" : "ZodString.regex",
    `tool${i}`, "inputSchema", `p${i}`));
const FACTS = [...filler(FACT_FLOOR + 8), FINITE];
const TOOLS = TOOL_FLOOR + 92;
const INVIS = () => new Set(["ZodNumber.finite"]);

// 🔴 THE ROSTER UNDER TEST IS THE SHIPPED ONE. A proof against a fixture roster agrees
// with itself about a file nobody reads.
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
row("🟢 the live shape passes", []);
row("🟢 a class the wire CARRIES needs no roster row — 309 of 310 refinements are these",
  [], { facts: [...FACTS, F("ZodString.min", "vcs_commit", "inputSchema", "message")] });

// ── 2. the four refusals ─────────────────────────────────────────────────────────────
row("🔴 a refinement the emitter drops that nobody declared",
  ["UNDECLARED"], {
    facts: [...FACTS, F("ZodString.trim", "vcs_commit", "inputSchema", "message")],
    invisible: new Set(["ZodNumber.finite", "ZodString.trim"]),
  });
row("🔴 a SECOND site on a declared class — the fourth `.finite()` added silently",
  ["SITES_MOVED"], {
    facts: [...FACTS, F("ZodNumber.finite", "runtime_get_monitors", "inputSchema", "baseline<val>")],
  });
row("🔴 THE ONE THAT MATTERS — one site in, one site out, the COUNT UNCHANGED",
  ["SITES_MOVED"], {
    facts: [...filler(FACT_FLOOR + 8),
      F("ZodNumber.finite", "runtime_get_monitors", "inputSchema", "baseline<val>")],
  });
row("🔴 a rostered class with no live site — an exemption outliving its subject",
  ["STALE_ROW"], { facts: filler(FACT_FLOOR + 8), invisible: new Set() });
row("🔴 a rostered class the emitter has STARTED carrying",
  ["NOW_VISIBLE"], { invisible: new Set() });
row("🔴 a roster row with no reason",
  ["NO_REASON"], {
    roster: { "ZodNumber.finite": { reason: "  ", sites: [SITE] } },
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

// ── 4. the measurement's own moving part ─────────────────────────────────────────────
// If `stripCheck` stops removing anything, every class compares equal to itself, every
// class reads invisible, and the gate reddens on all of them — loud, but for the wrong
// reason. These rows keep the reason right.
const finiteNode = z.number().finite();
claim(safe(() => finiteNode._def.checks.length, -1) === 1,
  "the fixture carries exactly the one check the strip is about");
claim(safe(() => stripCheck(finiteNode, "finite")._def.checks.length, -1) === 0,
  "stripCheck removes the check it is asked for");
const two = z.number().finite().min(0);
claim(safe(() => stripCheck(two, "finite")._def.checks.map((c) => c.kind).join(","), "") === "min",
  "stripCheck removes ONLY the kind it is asked for and leaves the siblings");
claim(safe(() => stripCheck(two, "finite")._def.checks, null) !== two._def.checks
  && safe(() => two._def.checks.length, -1) === 2,
  "stripCheck does not mutate the live node it was handed");
const twice = z.number().min(1).min(2);
claim(safe(() => stripCheck(twice, "min")._def.checks.length, -1) === 1,
  "a repeated kind loses ONE occurrence, not all of them — the count is the population");

// ── 5. the walk names the leaf, not the parameter it hides under ─────────────────────
const found = (schema, key = "p") => safe(() => walkNode(schema, "t", "inputSchema", key, []), []);
claim(found(z.record(z.string(), z.number().finite().optional()))[0]?.path === "p<val>",
  "a refinement inside a record's VALUE is named at the value, through the optional wrapper");
claim(found(z.array(z.object({ n: z.number().int() })))[0]?.path === "p[].n",
  "a refinement inside an array of objects is named by its full path");
claim(found(z.number().int().optional())[0]?.cls === "ZodNumber.int",
  "a wrapper is descended through rather than reported as a class of its own");
claim(found(z.string()).length === 0, "an unrefined leaf declares nothing");
claim(safe(() => walkSurface([{ name: "t", config: { outputSchema: { r: z.number().finite() } } }])[0]?.io, "")
  === "outputSchema",
  "the OUTPUT side is walked too — a refinement there is as invisible as one on the input");
claim(safe(() => siteKey({ tool: "a", io: "inputSchema", path: "b" }), "") === "a inputSchema b",
  "a site is tool, side and path — the three things that make it the same site");

// ── 6. the roster's own shape ────────────────────────────────────────────────────────
const rows = Object.entries(ROSTER);
claim(rows.length >= 1, "an empty roster makes every rule above vacuous");
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

console.log(`\n  ${rows.length} roster row(s) · floors ${TOOL_FLOOR}/${FACT_FLOOR}`);
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

#!/usr/bin/env node
// Measure what a server's tool surface COSTS a client, in bytes — 205 §8.6 / D2,
// and 207 §7.1, which is where the alternative's number stopped being a quotation.
//
// 🔴 206 SHIPPED A COMPARISON IT COULD NOT REPRODUCE, AND SAID SO. Their figure —
// `godot-mcp-go`, 2026-08-05, "319 tools ≈ 202 KB ≈ ~50,000 tokens" — was PUBLISHED,
// not re-derived here, and 206 §7.1 refused to let a README quote it until it had been.
// Session 207 built it and ran it. IT REPRODUCES, and to the byte:
//
//     theirs, published    319 tools   ~202 KB     ~50,000 tokens (at 4 B/token)
//     theirs, REPRODUCED   319 tools  202,327 B    ~51,000 tokens (at 4 B/token)
//
// Every one of the ten per-group figures on their docs page reproduced exactly, and the
// two project-local commands they said their measurement picked up are in the count. The
// method they published — `initialize`, then `tools/list`, bytes of the payload — IS this
// file's method. THE COMPARISON IS NOW HONEST IN BOTH DIRECTIONS. See `--server` below.
//
// 🔴 AND REPRODUCING IT REFUTED WHAT 206 CONCLUDED FROM IT. 206 §7.2 named input schemas
// as "the real D2 finding" — 38% of our surface, the heaviest component we had. Measured
// against a server whose schemas are 70% of ITS surface:
//
//     component (both measured by the code below)   ours (291)   theirs (319)    ratio
//     input schemas                                   151,295       138,033      1.09x
//     descriptions                                     73,805        50,385      1.47x
//     names                                             5,650         8,167      0.69x
//     🔴 outputSchema + annotations + execution + title 151,210             0        —
//     TOTAL                                           393,887       202,327      1.95x
//
// 🔴 THE COST GAP IS NOT THE SCHEMAS. Ours are within nine percent of a server carrying
// twenty-eight MORE tools. FOUR KEYS THEY DO NOT SHIP AT ALL ARE 38% OF OUR SURFACE and
// 79% of the whole gap — and 206's own `measure()` could not see a byte of them, because
// it projected a tool onto three keys and reported the three as if they were the tool.
// That is the tenth asking of 203-206's standing question landing on the reader THIS FILE
// SHIPS: what does it project its population onto, and what is invisible in that
// projection? 60.9% was projected. 39.1% was not. `keys` below is the fix.
//
// 🔴 WHAT IS COUNTED, STATED SO IT CAN BE DISAGREED WITH. A client puts the `tools` array
// of a `tools/list` result into the model's context, so the unit is `JSON.stringify(tools)`
// in UTF-8 BYTES — exact, dependency-free, reproducible on any machine with a built
// `dist/`. TOKENS ARE NOT GOVERNED HERE: every tokenizer disagrees, none ships with this
// repo, and a number that needs a dependency to re-derive is a number nobody re-derives.
// 🔴 THE TOKEN FIGURES ABOVE USE THEIR DIVISOR (4 B/token), NOT OURS (3.6). Quoting our
// ~109,400 against their ~50,000 compares two different divisions and reads as 2.19x when
// the bytes say 1.95x. Bytes are the only honest unit across two publishers.
//
// 🔴 BOTH SURFACES, BECAUSE THE DEFAULT IS THE ONE MOST CLIENTS PAY. Quoting only the
// larger is the mirror of 205 §4, where our own live listing said 289 while three cards
// said 291.
//
//   node scripts/token-cost.mjs             # both surfaces + per-key + per-family
//   node scripts/token-cost.mjs --summary   # totals only
//   node scripts/token-cost.mjs --server <cmd> [args...]   # ANY stdio MCP server
//   node scripts/token-cost.selftest.mjs    # the floors' refusal, no server needed
//
// 🔴 `--server` IS WHY THE COMPARISON CAN STAY HONEST. It drives a foreign server through
// the SAME core, so an alternative's figure is re-derived rather than quoted — the "26 CI jobs"
// defect (205 §2) is only avoidable with someone else's number if you can take it
// yourself. OUR FLOORS ARE NOT APPLIED TO A FOREIGN SURFACE: a budget written for this
// repo has no jurisdiction over anyone else's, and a gate that reddens on an alternative's
// choices is a gate nobody can act on (206 §3's rule, pointed outward).
//
// 🔴 THIS FILE PRINTS; IT DOES NOT ASSERT, which is why the tautology gate exempts it
// by the same reason `path-cohort.mjs` carries. The claims live in
// `token-cost.selftest.mjs`, and that is the file the floors' runner points at.
//
// Requires a built dist/ for the live read. No editor, no ports: it reads the tool list
// over stdio and never calls a tool — and 257 added `--results`, which reads back what a
// host running with BREAKPOINT_RESULT_COST recorded, so the axis this sentence names as
// out of scope now has a reader instead of only a confession.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HOST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── the governed constants ────────────────────────────────────────────────────
// 🔴 A CEILING ON BYTES AND A FLOOR ON TOOLS, AND THEY CATCH OPPOSITE FAILURES.
// The ceiling is a BUDGET: it is already too high, and it is here so the number cannot
// drift further without someone deciding to let it. The floor is the usual collapse
// guard — a reader that lists zero tools would otherwise report a wonderfully small
// surface and pass. Measured in session 206 at three hundred and ninety-three thousand
// bytes over two hundred and ninety-one tools; the ceiling carries a little headroom so
// an ordinary description edit does not redden, and is meant to be LOWERED as the
// surface is paid down, never raised without a note saying what bought the growth.
// 🔴 NO NUMERIC SEPARATOR. `410_000` is invisible to floor_pin_gate's ledger scan,
// which reads a plain integer — and an unreadable constant reports as a DELETED one,
// the half that error message calls the more dangerous.
// 🆕 208 — LOWERED FROM 410000, AND THE NOTE THIS COMMENT DEMANDS: nothing was trimmed.
// Two fields the SDK emits and nobody here authored were deleted from the wire — the
// draft-07 `$schema` inside every schema (30,160 B) and `taskSupport:"forbidden"` on the
// 288 non-task tools (11,520 B). 393,887 -> 352,207 B. The headroom is the same ~4% the
// old ceiling carried, measured against the new floor rather than inherited from it.
// 🆕 212 §5 — THE DECISION 211 §6.2 LEFT OPEN, TAKEN AND RECORDED: **B2**. One
// `editor_get_log` tool plus a `log_seq` integer on the 153 tools that can emit, measured
// at +5,627 B over today's surface — against +59,058 for D1a's nested `entries[]` shape
// on the same 153, +13,311 for a flat `string[]`, and +731 for caller-side bracketing
// with no correlator at all. 211 §3 priced all six; 210 §5 had priced ONE and reported it
// as the cost of the feature.
// 🔴 AND THE CEILING IS NOT RAISED HERE, ON PURPOSE. This comment's own rule, three
// paragraphs up, is "never raised without a note saying what bought the growth" — and
// nothing has bought it yet. Raising it now would hand D1b a budget it has not spent and
// leave this constant measuring nothing until it does. The raise belongs in the commit
// that ships the field, with the measured surface beside it, which is the same rule the
// 410000 lowering followed in the other direction.
// 🔴 AND `SCHEMA_PER_TOOL_CEILING` DOES NOT MOVE UNDER ANY OF THE SIX. `measure()` reads
// `inputSchema` only and `engine_log`/`log_seq` are OUTPUT fields, so the one number a
// competitive claim may honestly use — see the next constant — is unchanged at 468 by
// every option. 210 §5's argument against the growth was computed on the AGGREGATE: on
// exactly the share of the surface the next comment says a comparison may not quote.
// 🆕 267 — RAISED 366,000 → 366,220, AND THE NOTE THIS CONSTANT DEMANDS IS THE RELEASE.
// The rule three paragraphs up is "raise it only with a note saying what bought the
// growth", and D1b's raise was deliberately NOT taken in advance for exactly that reason.
// What bought this one is measured and on the wire: FIVE output keys across five shipped
// tools — `initialized_seen` on `dbg_launch`, `dbg_attach`, `cs_dbg_launch` and
// `cs_dbg_attach`, and `signal` on `godot_output` — plus the `warning` the two C# launch
// tools gained beside it. Surface went 365,986 → 366,206 B, +220 B, or **0.06%**.
//
// 🔴 IT IS SET AT THE LIVE VALUE PLUS FOURTEEN BYTES, NOT AT A ROUND NUMBER. A ceiling
// with slack in it is a budget the next session spends without deciding to, which is the
// drift this constant exists to stop; the fourteen bytes are what a one-character key
// rename costs, not what a feature does. `SCHEMA_PER_TOOL_CEILING` does not move: every
// key added here is an OUTPUT field and `measure()` reads `inputSchema` only, so the one
// number a competitive claim may honestly quote is unchanged at 468.
// 🆕 270 — RAISED AGAIN, AND THE NOTE THIS CONSTANT DEMANDS IS ISSUE #327's FIX.
// What bought this one is on the INPUT side for the first time, which is why it is the
// largest single raise this constant has taken. `value` was spelled `z.any()` on seven
// shipped tools and compiled to `{}` — the cheapest possible subschema, and the reason
// it was cheap is the defect: `z.any()` is OPTIONAL in zod, so `value` was published
// outside every one of those tools' `required` lists and a client omitting it wrote the
// property type's zero. `requiredEncodedValue` is a six-member union admitting
// everything JSON can carry and nothing else, so each of the seven grew by the union's
// own shape, and `coerced`/`requested` were declared on two output schemas beside them.
// Surface went 366,206 -> 367,602 B, or **0.38%**.
//
// 🔴 SET AT THE LIVE VALUE PLUS FOURTEEN BYTES, on 267's rule and for 267's reason: a
// ceiling with slack in it is a budget the next session spends without deciding to, and
// fourteen is what a one-character key rename costs rather than what a feature does.
// `SCHEMA_PER_TOOL_CEILING` DOES move under this one — `measure()` reads `inputSchema`
// and this raise is input-side — from 468 to 472 against a ceiling of 490, which is the
// first time that number has moved since it was written. It is still inside its own
// budget and it is still the one number a competitive claim may honestly quote.
//
// 🆕 278 — RAISED, AND WHAT BOUGHT IT IS A PRODUCT DECISION RATHER THAN A FEATURE. Six
// shipped surfaces on the GDScript debug plane — `dbg_goto`, `dbg_data_breakpoints`,
// `dbg_set_exception_breakpoints`, and the `conditions` / `hit_conditions` /
// `log_messages` modifiers on `dbg_set_breakpoints` — are gated on adapter capabilities
// that NO Godot build this project tests advertises. 278 measured that off the live
// integration runs on 4.3-stable and 4.7-stable (`docs/dap_capability_ledger.json`) and
// the maintainer chose to say so in each description, where a caller reads it before
// choosing, rather than leave the measurement in a file only this repository reads.
//
// 🔴 THE COST IS THE POINT AND NOT AN ACCIDENT: a description is the tool surface, so
// honesty about six dead surfaces is paid for in the same bytes a feature would spend.
// Surface went 367,602 -> 369,157 B, or **0.42%**. Set at the live value plus fourteen
// bytes, on 267's rule — a ceiling with slack in it is a budget the next session spends
// without deciding to.
// 🆕 282 — RAISED, AND WHAT BOUGHT IT IS A SAFETY GUARANTEE THE PACKAGE ALREADY MADE.
// `docs/TOOL_CATALOG.md` has promised since it was written that *every tool flagged
// destructive accepts an optional `confirm: boolean` … so a destructive op is never
// executed silently*. 282 measured that false for 23 of the 89 destructive tools: the
// parameter was absent from `tools/list`, so no caller could have passed it.
// `applyDestructiveGate` injects it at registration for exactly those tools, derived from
// the `destructiveHint` annotation this surface already publishes.
//
// 🔴 THE COST IS 23 COPIES OF ONE OPTIONAL BOOLEAN AND ITS DESCRIPTION, AND IT IS THE
// SAME BARGAIN 278 STRUCK: an input schema IS the tool surface, so a guarantee being true
// on the wire is paid for in the same bytes a feature would spend. Surface went
// 369,157 -> 370,730 B, or **0.43%**, and the schema-per-tool figure — the one number a
// competitive claim may honestly quote — moved 468 -> 479 against its own ceiling of 490,
// which it is still under. Set at the live value exactly, on 267's rule that a ceiling
// with slack in it is a budget the next session spends without deciding to.
//
// 🆕 283 — RAISED AGAIN, AND THIS CEILING ASKED FOR THE NOTE IN ITS OWN REFUSAL TEXT.
// What bought the growth: `coerced`/`requested` on the 23 tools that add a node, plus one
// shared sentence on each of their `name` parameters. Both halves are the feature, not
// packaging — the output fields are the machine-readable channel for *the engine named
// your node something else*, and the input sentence is the only warning a caller gets
// BEFORE it picks a name it cannot keep. Measured 370,730 -> 374,208 B, or 0.94%.
//
// 🔴 AND THE FIRST DRAFT WAS REFUSED BY THE OTHER CEILING FIRST, WHICH IS THE ONE THAT
// MATTERS. The long form of that sentence put schema-per-tool at 492 B against 490 — the
// single number a competitive claim may honestly quote. It was cut to a pointer and the
// essay moved to TOOL_CATALOG's Conventions section, which nobody pays for per call:
// 486 B, back under. A ceiling that refuses prose before it refuses a feature is the
// ceiling working.
export const BYTES_CEILING = 374208;
export const TOOL_FLOOR = 250;

// 🆕 207 §7.1 — THE ONLY COMPONENT TWO SERVERS CAN BE COMPARED ON, SO IT GETS ITS OWN
// CEILING. `BYTES_CEILING` governs the whole surface, which means it moves when an
// optional key is added or dropped — and four of ours are optional MCP fields the alternative
// ships none of. The input schema is the one field both carry, so it is the one number a
// competitive claim may honestly use, and the one that must not drift behind the
// aggregate. Measured 207 at five hundred and twenty bytes per tool against their four
// hundred and thirty-three; the headroom is small ON PURPOSE, because this is the
// number a claim would quote.
// 🆕 208 — 545 -> 490. The input schema shed its 52 B/tool dialect declaration, so the
// number a claim would quote fell 520 -> 468 against their 433. 🔴 THE RATIO THIS GOVERNS
// IS NOW 1.08x AND IT WAS 1.20x, which sharpens rather than softens 207 §4's finding.
export const SCHEMA_PER_TOOL_CEILING = 490;

// 🆕 257 — THE OTHER HALF OF CLIENT COST, AND THIS FILE SAID SO ITSELF FOR EIGHT SESSIONS.
// The header above is honest — "it reads the tool list over stdio and never calls a tool" —
// and 249 then measured ONE `gd_completion` at 342,116 B, 99.6% of the whole surface this
// file governs, in a single result. Every floor here read that tree and printed `ok`,
// correctly, about a question nobody was asking. `tool-results-outside-token-cost`.
//
// 🔴 THE UNIT IS THE SAME AND THE POPULATION IS NOT. The catalogue is paid ONCE per
// session and this file can read it any time; a result is paid per CALL and can only be
// read by calling, against a live engine, a live language server and a real project. So
// the result axis is a METER plus a reader — `BREAKPOINT_RESULT_COST=<file>` on the host
// records `tool\tbytes` per call, and `--results <file>` reads them back — and its
// ceiling governs the LARGEST single result, because that is the number a client pays
// without ever having asked for a catalogue.
//
// 100000 is the round number just above the knowledge family's shipped caps and far below
// the 342,116 B that opened the row. It is not a measured typical: it is the line past
// which a single result costs more than a third of the entire tool surface, which is the
// point at which "one call" stops being a reasonable unit of anything.
export const RESULT_BYTES_CEILING = 100000;

/** Parse the meter's log: one `tool<TAB>bytes` line per call, blank lines ignored. */
export function parseResults(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const [tool, raw] = line.split("\t");
    const b = Number(raw);
    if (!tool || !Number.isFinite(b)) continue;
    rows.push({ tool, bytes: b });
  }
  return rows;
}

/**
 * The pure core of the result axis: per-tool worst case, call count, and the total.
 * Pure and exported for the same reason `measure` is — the refusal proof drives it
 * without a server, and a check that has never refused has not been audited.
 */
export function measureResults(rows) {
  const perTool = new Map();
  let total = 0;
  for (const r of rows) {
    total += r.bytes;
    const e = perTool.get(r.tool) ?? { n: 0, max: 0, sum: 0 };
    e.n += 1;
    e.sum += r.bytes;
    if (r.bytes > e.max) e.max = r.bytes;
    perTool.set(r.tool, e);
  }
  const worst = [...perTool.entries()].sort((a, b) => b[1].max - a[1].max);
  return { calls: rows.length, tools: perTool.size, total, worst };
}

/** The verdict on a measured result log. Same shape as `verdict()` below. */
export function verdictResults(m) {
  const problems = [];
  if (m.calls === 0) {
    problems.push(
      "the log records no calls. An empty meter is not a green result axis — it is the "
      + "same silence the catalogue-only reader already had, written to a file.",
    );
  }
  for (const [tool, e] of m.worst) {
    if (e.max > RESULT_BYTES_CEILING) {
      problems.push(
        `${tool} returned ${e.max.toLocaleString()} B in one result, over the `
        + `${RESULT_BYTES_CEILING.toLocaleString()} B ceiling. A client pays this per CALL, `
        + `with no catalogue to amortise it against — cap the list and say so with a `
        + `truncated flag, the way gd_completion and the knowledge family do.`,
      );
    }
  }
  return { ok: problems.length === 0, problems };
}

// Measured once, tokenizer named, used ONLY for a human-readable estimate. Not governed.
const BYTES_PER_TOKEN = 3.6;
const TOKENIZER_NOTE = "cl100k_base, measured on the full surface in session 206";

export const bytes = (v) => Buffer.byteLength(JSON.stringify(v), "utf8");

// A tool's family is its name up to the first underscore — the grouping the tool catalog
// and README already use, so the breakdown can be compared to something.
export const family = (name) =>
  name.includes("_") ? name.slice(0, name.indexOf("_")) : name;

/**
 * The pure core: everything the floors are checked against, derived from a tool list.
 * 🔴 PURE AND EXPORTED so the refusal proof can drive it without a server — the half
 * that carries 204 §8.27 (a check that has never refused has not been audited).
 *
 * 🔴 `keys` IS THE 207 FIX AND IT IS WHY `names`/`descs`/`schemas` SURVIVE ONLY AS
 * NAMED SLICES. Those three were the whole decomposition until this session, and on our
 * own surface they accounted for 60.9% of it while the printer presented them as the
 * breakdown. `keys` walks whatever keys the tools ACTUALLY carry, so a field nobody
 * named cannot hide in the difference; `frame` is the structural remainder (braces,
 * commas, brackets) and is the only thing left over by construction.
 */
export function measure(tools) {
  const total = bytes(tools);
  const fams = new Map();
  const keys = new Map();
  for (const t of tools) {
    const f = family(t.name);
    const e = fams.get(f) ?? { n: 0, b: 0 };
    e.n += 1;
    e.b += bytes(t);
    fams.set(f, e);
    for (const k of Object.keys(t)) {
      const ke = keys.get(k) ?? { n: 0, b: 0 };
      ke.n += 1;
      ke.b += bytes(k) + 1 + bytes(t[k]); // "key" + ':' + value
      keys.set(k, ke);
    }
  }
  const keyed = [...keys.values()].reduce((s, e) => s + e.b, 0);
  const schemas = bytes(tools.map((t) => t.inputSchema ?? {}));
  // 🆕 208 — TWO COUNTS THAT SHOULD BE ZERO, and they are counts rather than budgets.
  // A dialect declaration and a spec-default `taskSupport` are not expensive-but-earned
  // bytes; they are bytes saying what the protocol already says. Measured here so the
  // floors below can refuse on them, and reported for a foreign surface without judging.
  const dialects = tools.filter(
    (t) => t.inputSchema?.$schema !== undefined || t.outputSchema?.$schema !== undefined).length;
  const taskDefault = tools.filter((t) => t.execution?.taskSupport === "forbidden").length;
  return {
    count: tools.length,
    total,
    names: bytes(tools.map((t) => t.name)),
    descs: bytes(tools.map((t) => t.description ?? "")),
    schemas,
    schemaPerTool: tools.length ? Math.round(schemas / tools.length) : 0,
    perTool: tools.length ? Math.round(total / tools.length) : 0,
    dialects,
    taskDefault,
    families: [...fams.entries()].sort((a, b) => b[1].b - a[1].b),
    keys: [...keys.entries()].sort((a, b) => b[1].b - a[1].b),
    frame: total - keyed,
  };
}

/** (ok, problems) — the floors applied. Separated from `measure` so both are testable. */
export function verdict(m) {
  const problems = [];
  if (m.count < TOOL_FLOOR)
    problems.push(
      `TOOL_FLOOR: the surface collapsed to ${m.count} tool(s), floor ${TOOL_FLOOR}. ` +
        `A reader that lists nothing reports a wonderfully small surface and passes — ` +
        `which is why this floor exists and not because the count is expected to fall.`);
  if (m.total > BYTES_CEILING)
    problems.push(
      `BYTES_CEILING: the tool surface is ${m.total.toLocaleString()} B, ceiling ` +
        `${BYTES_CEILING.toLocaleString()} B. This budget is ALREADY too high relative ` +
        `to what the alternatives publish — it is here to stop the number drifting further, so ` +
        `LOWER it as the surface is paid down; raise it only with a note saying what ` +
        `bought the growth.`);
  if (m.count >= TOOL_FLOOR && m.schemaPerTool > SCHEMA_PER_TOOL_CEILING)
    problems.push(
      `SCHEMA_PER_TOOL_CEILING: input schemas cost ${m.schemaPerTool.toLocaleString()} B ` +
        `per tool, ceiling ${SCHEMA_PER_TOOL_CEILING.toLocaleString()} B. This is the ` +
        `ONE component a comparison can honestly use, because it is the only field ` +
        `both servers carry — the four optional keys we ship and they do not are 38% of ` +
        `our surface and move the aggregate without moving this. Drift here is drift in ` +
        `the number a claim would quote.`);
  // 🆕 208 — 🔴 NO CONSTANT FOR EITHER OF THESE, AND THE ABSENCE IS THE POINT. A ceiling
  // is a budget you may spend; these two are invariants you may not. Giving a knob to
  // "how many schemas may declare a foreign dialect" would invite turning it up on the
  // afternoon somebody wanted the build green, and the value of the check is that there
  // is no such afternoon.
  if (m.count > 0 && m.dialects > 0)
    problems.push(
      `WIRE_DIALECT: ${m.dialects} of ${m.count} tool(s) ship a schema declaring its own ` +
        `JSON Schema dialect. MCP fixes the default at 2020-12 and requires every ` +
        `implementation to support it; a \`$schema\` field is an EXPLICIT SWITCH to a ` +
        `dialect a peer is not obliged to support and MUST reject gracefully if it does ` +
        `not. Measured 208: all 580 of our schemas failed to compile under a strict ` +
        `2020-12 validator while the declaration was present, and all 580 compiled with ` +
        `it removed, with ZERO semantic disagreement over 2,320 probes. If this fired, ` +
        `either \`applyWireDefaults\` stopped running or a schema now genuinely needs ` +
        `draft-07 — \`dialectSensitive()\` keeps the declaration in that second case, so ` +
        `read the schema before reaching for this check.`);
  if (m.count > 0 && m.taskDefault > 0)
    problems.push(
      `WIRE_TASK_DEFAULT: ${m.taskDefault} of ${m.count} tool(s) ship ` +
        `\`execution:{taskSupport:"forbidden"}\` — the value the spec defines for an ` +
        `ABSENT field ("clients MUST NOT attempt to invoke the tool as a task... This is ` +
        `the default behavior"), in a field revision 2026-07-28 deletes from \`Tool\` ` +
        `outright. Nobody here writes it; \`McpServer.registerTool\` hardcodes it. ` +
        `\`applyWireDefaults\` removes it and leaves the three genuine "optional" tools ` +
        `alone, so a non-zero count means that wrapper is no longer reaching the listing.`);
  return { ok: problems.length === 0, problems };
}

// ── live read ─────────────────────────────────────────────────────────────────
// 🔴 THE COMMAND IS A PARAMETER, NOT A CONSTANT, and that is the whole of `--server`.
// An alternative's figure re-derived by this code is evidence; the same figure quoted from
// their README is a claim about their measurement, not about their server.
async function surface({ command, args, cwd, env }) {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } =
    await import("@modelcontextprotocol/sdk/client/stdio.js");
  const transport = new StdioClientTransport({
    command,
    args,
    cwd,
    env: { ...process.env, ...env },
    stderr: "ignore",
  });
  const client = new Client({ name: "token-cost", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  const tools = [];
  let cursor;
  do {
    const page = await client.listTools(cursor ? { cursor } : {});
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  await client.close();
  return tools;
}

const ours = (env) =>
  surface({ command: "node", args: [path.join(HOST_DIR, "dist", "index.js")], cwd: HOST_DIR, env });

// 🔴 THE LIVE READ RUNS ONLY AS AN ENTRY POINT. `token-cost.selftest.mjs` imports the
// pure core from this file, and a top-level `await surface()` would spawn a server (and
// require a built dist/) merely to ASSERT ABOUT ARITHMETIC. A proof that needs the thing
// it is proving to already work is not a proof.
const IS_MAIN = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (!IS_MAIN) { /* imported for `measure` / `verdict` — nothing below runs */ }
else await main();

async function main() {
const argv = process.argv.slice(2);
const args = new Set(argv);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const tok = (n) => `~${(Math.round(n / BYTES_PER_TOKEN / 100) * 100).toLocaleString()}`;

const report = (label, m) => {
  console.log(`TOKEN_COST ${label}`);
  console.log(`  tools            ${m.count}`);
  console.log(`  TOTAL BYTES      ${m.total.toLocaleString()}  (${kb(m.total)})`);
  console.log(`    names          ${m.names.toLocaleString()}`);
  console.log(`    descriptions   ${m.descs.toLocaleString()}`);
  console.log(`    input schemas  ${m.schemas.toLocaleString()}   ${m.schemaPerTool.toLocaleString()} B/tool`);
  console.log(`  bytes/tool       ${m.perTool.toLocaleString()}`);
  console.log(`  DERIVED tokens   ${tok(m.total)}   🔴 estimate only — ${TOKENIZER_NOTE}`);
  // 🔴 EVERY KEY, NOT THE THREE ABOVE. The three named slices are a projection, and until
  // 207 the difference between them and the surface — 39.1% of it — was reported nowhere.
  console.log(`  PER-KEY, the decomposition that leaves nothing unnamed:`);
  for (const [k, e] of m.keys) {
    console.log(`    ${k.padEnd(16)} on ${String(e.n).padStart(4)}/${m.count}  `
      + `${String(e.b).padStart(8)} B  ${((e.b / m.total) * 100).toFixed(1).padStart(5)}%`);
  }
  console.log(`    ${"[frame]".padEnd(16)}           ${String(m.frame).padStart(8)} B  `
    + `${((m.frame / m.total) * 100).toFixed(1).padStart(5)}%   braces, commas, brackets`);
  console.log();
};

// ── RESULT AXIS: read back what the host's meter recorded ───────────────────────────
const ri = argv.indexOf("--results");
if (ri >= 0) {
  const file = argv[ri + 1];
  if (!file) {
    console.error("🔴 --results needs a file: --results <path written by BREAKPOINT_RESULT_COST>");
    process.exit(2);
  }
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    // 🔴 A MISSING LOG IS NOT A PASS. The whole defect this axis answers is an instrument
    // reporting ok about something it could not see; refusing to read is the one thing
    // that must never look like agreement.
    console.error(`🔴 TOKEN_COST REFUSED — could not read ${file}: ${err.message}. `
      + `Run the host with BREAKPOINT_RESULT_COST=${file} and exercise the tools first.`);
    process.exit(1);
  }
  const m = measureResults(parseResults(text));
  console.log(`TOKEN_COST RESULTS ${file}`);
  console.log(`  calls            ${m.calls}`);
  console.log(`  tools called     ${m.tools}`);
  console.log(`  TOTAL BYTES      ${m.total.toLocaleString()}  (${kb(m.total)})`);
  console.log(`  WORST SINGLE RESULT, heaviest first — the number a client pays per call:`);
  for (const [t, e] of m.worst.slice(0, 15)) {
    console.log(`    ${t.padEnd(28)} ${String(e.max).padStart(9)} B max  `
      + `${String(Math.round(e.sum / e.n)).padStart(9)} B mean  ${String(e.n).padStart(4)} call(s)`);
  }
  const rv = verdictResults(m);
  console.log(`TOKEN_COST results floor  worst ${(m.worst[0]?.[1].max ?? 0).toLocaleString()} `
    + `<= ${RESULT_BYTES_CEILING.toLocaleString()} · ${m.calls} call(s) over ${m.tools} tool(s)`);
  if (!rv.ok) {
    for (const p of rv.problems) console.error(`\n🔴 TOKEN_COST REFUSED — ${p}`);
    process.exit(1);
  }
  console.log("TOKEN_COST results ok — no single result over the ceiling in this log");
  process.exit(0);
}

// ── FOREIGN SURFACE: measure anyone's stdio MCP server with this same core ──────────
const si = argv.indexOf("--server");
if (si >= 0) {
  const [command, ...rest] = argv.slice(si + 1);
  if (!command) {
    console.error("🔴 --server needs a command: --server <cmd> [args...]");
    process.exit(2);
  }
  const m = measure(await surface({ command, args: rest, cwd: process.cwd(), env: {} }));
  report(`FOREIGN ${[command, ...rest].join(" ")}`, m);
  console.log("PER-FAMILY, heaviest first");
  for (const [f, e] of m.families.slice(0, 12)) {
    console.log(`  ${f.padEnd(16)}  ${String(e.n).padStart(5)}  ${String(e.b).padStart(8)}`
      + `  ${((e.b / m.total) * 100).toFixed(1).padStart(5)}%  `
      + `${String(Math.round(e.b / e.n)).padStart(10)}`);
  }
  // 🔴 NO VERDICT ON A FOREIGN SURFACE. Our budget has no jurisdiction over their repo,
  // and a refusal nobody can act on trains people to ignore the ones they can.
  console.log("\nTOKEN_COST foreign surface — measured, NOT judged (our floors are ours)");
  process.exit(0);
}

const def = measure(await ours({ BREAKPOINT_PRIVILEGED_GROUPS: "" }));
const all = measure(await ours({ BREAKPOINT_PRIVILEGED_GROUPS: "all" }));

report("default (no BREAKPOINT_PRIVILEGED_GROUPS)", def);
report("all groups (BREAKPOINT_PRIVILEGED_GROUPS=all)", all);

if (!args.has("--summary")) {
  console.log("PER-FAMILY (all groups), heaviest first — the breakdown the alternative published");
  console.log("  family            tools     bytes    share   bytes/tool");
  for (const [f, e] of all.families) {
    console.log(`  ${f.padEnd(16)}  ${String(e.n).padStart(5)}  ${String(e.b).padStart(8)}`
      + `  ${((e.b / all.total) * 100).toFixed(1).padStart(5)}%  `
      + `${String(Math.round(e.b / e.n)).padStart(10)}`);
  }
  console.log();
}

// 🔴 THE FLOORS ARE APPLIED TO THE FULL SURFACE, which is the larger of the two and the
// one that grows first. The default surface is a subset by construction.
const v = verdict(all);
console.log(`TOKEN_COST floors  tools ${all.count} >= ${TOOL_FLOOR} · `
  + `bytes ${all.total.toLocaleString()} <= ${BYTES_CEILING.toLocaleString()} · `
  + `schema/tool ${all.schemaPerTool.toLocaleString()} <= ${SCHEMA_PER_TOOL_CEILING.toLocaleString()} · `
  + `dialect declarations ${all.dialects} · spec-default taskSupport ${all.taskDefault}`);
if (!v.ok) {
  for (const p of v.problems) console.error(`\n🔴 TOKEN_COST REFUSED — ${p}`);
  process.exit(1);
}
// 🔴 AND THE LINE SAYS WHAT IT DID NOT MEASURE. 256 §5.3: a green verdict is scoped to
// what the reader can see, and the scope is not on the line it prints. This reader's
// scope is the CATALOGUE — one payment per session — and the axis it cannot see from
// here is the RESULT, paid per call, where 249 measured a single 342,116 B answer.
console.log("TOKEN_COST ok — within budget, and the budget is already too high (see header)");
console.log("TOKEN_COST scope  CATALOGUE ONLY — tool RESULTS are unmeasured here; "
  + "run the host with BREAKPOINT_RESULT_COST=<file> and read it with --results <file>");
}

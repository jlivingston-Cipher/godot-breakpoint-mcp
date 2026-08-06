#!/usr/bin/env node
// Measure what a server's tool surface COSTS a client, in bytes — 205 §8.6 / D2,
// and 207 §7.1, which is where the rival's number stopped being a quotation.
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
// the SAME core, so a rival figure is re-derived rather than quoted — the "26 CI jobs"
// defect (205 §2) is only avoidable with someone else's number if you can take it
// yourself. OUR FLOORS ARE NOT APPLIED TO A FOREIGN SURFACE: a budget written for this
// repo has no jurisdiction over anyone else's, and a gate that reddens on a rival's
// choices is a gate nobody can act on (206 §3's rule, pointed outward).
//
// 🔴 THIS FILE PRINTS; IT DOES NOT ASSERT, which is why the tautology gate exempts it
// by the same reason `path-cohort.mjs` carries. The claims live in
// `token-cost.selftest.mjs`, and that is the file the floors' runner points at.
//
// Requires a built dist/ for the live read. No editor, no ports: it reads the tool list
// over stdio and never calls a tool.
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
export const BYTES_CEILING = 410000;
export const TOOL_FLOOR = 250;

// 🆕 207 §7.1 — THE ONLY COMPONENT TWO SERVERS CAN BE COMPARED ON, SO IT GETS ITS OWN
// CEILING. `BYTES_CEILING` governs the whole surface, which means it moves when an
// optional key is added or dropped — and four of ours are optional MCP fields the rival
// ships none of. The input schema is the one field both carry, so it is the one number a
// competitive claim may honestly use, and the one that must not drift behind the
// aggregate. Measured 207 at five hundred and twenty bytes per tool against their four
// hundred and thirty-three; the headroom is small ON PURPOSE, because this is the
// number a claim would quote.
export const SCHEMA_PER_TOOL_CEILING = 545;

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
  return {
    count: tools.length,
    total,
    names: bytes(tools.map((t) => t.name)),
    descs: bytes(tools.map((t) => t.description ?? "")),
    schemas,
    schemaPerTool: tools.length ? Math.round(schemas / tools.length) : 0,
    perTool: tools.length ? Math.round(total / tools.length) : 0,
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
        `to what rivals publish — it is here to stop the number drifting further, so ` +
        `LOWER it as the surface is paid down; raise it only with a note saying what ` +
        `bought the growth.`);
  if (m.count >= TOOL_FLOOR && m.schemaPerTool > SCHEMA_PER_TOOL_CEILING)
    problems.push(
      `SCHEMA_PER_TOOL_CEILING: input schemas cost ${m.schemaPerTool.toLocaleString()} B ` +
        `per tool, ceiling ${SCHEMA_PER_TOOL_CEILING.toLocaleString()} B. This is the ` +
        `ONE component a rival comparison can honestly use, because it is the only field ` +
        `both servers carry — the four optional keys we ship and they do not are 38% of ` +
        `our surface and move the aggregate without moving this. Drift here is drift in ` +
        `the number a claim would quote.`);
  return { ok: problems.length === 0, problems };
}

// ── live read ─────────────────────────────────────────────────────────────────
// 🔴 THE COMMAND IS A PARAMETER, NOT A CONSTANT, and that is the whole of `--server`.
// A rival's figure re-derived by this code is evidence; the same figure quoted from
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
  console.log("PER-FAMILY (all groups), heaviest first — the breakdown the rival published");
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
  + `schema/tool ${all.schemaPerTool.toLocaleString()} <= ${SCHEMA_PER_TOOL_CEILING.toLocaleString()}`);
if (!v.ok) {
  for (const p of v.problems) console.error(`\n🔴 TOKEN_COST REFUSED — ${p}`);
  process.exit(1);
}
console.log("TOKEN_COST ok — within budget, and the budget is already too high (see header)");
}

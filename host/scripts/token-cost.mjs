#!/usr/bin/env node
// Measure what this server's tool surface COSTS a client, in bytes — 205 §8.6 / D2.
//
// 🔴 THE MEASUREMENT CAME FIRST AND IT REFUTED THE PREMISE. 205 §8.6 said "do the
// measurement before writing any claim about it", because the competitive item behind it
// is a rival PUBLISHING a number we had never taken: `godot-mcp-go`, 2026-08-05,
// "319 tools ≈ 202 KB ≈ ~50,000 tokens". The implied claim was that we would compare
// well. Measured, session 206:
//
//     ours,  all groups   291 tools   393,887 B   1,354 B/tool
//     ours,  default      278 tools   373,855 B   1,345 B/tool
//     theirs (published)  319 tools  ~206,848 B    ~648 B/tool
//
// 🔴 WE SHIP FEWER TOOLS AND COST ROUGHLY TWICE AS MUCH PER TOOL. This file exists to
// stop that growing while it is being paid down, and to make the number reproducible by
// anyone who doubts it. 205 §5's "do not race the count" now has a companion: we would
// also lose on cost. NO README CLAIM SHOULD QUOTE A COMPARISON UNTIL THEIR NUMBER HAS
// BEEN REPRODUCED BY THIS SCRIPT AGAINST THEIR SERVER — a published figure measured some
// other way is exactly the "26 CI jobs" defect (205 §2) with someone else's number.
//
// 🔴 WHAT IS COUNTED, STATED SO IT CAN BE DISAGREED WITH. A client puts the `tools` array
// of a `tools/list` result into the model's context, so the unit is `JSON.stringify(tools)`
// in UTF-8 BYTES — exact, dependency-free, reproducible on any machine with a built
// `dist/`. TOKENS ARE NOT GOVERNED HERE: every tokenizer disagrees, none ships with this
// repo, and a number that needs a dependency to re-derive is a number nobody re-derives.
//
// 🔴 BOTH SURFACES, BECAUSE THE DEFAULT IS THE ONE MOST CLIENTS PAY. Quoting only the
// larger is the mirror of 205 §4, where our own live listing said 289 while three cards
// said 291.
//
//   node scripts/token-cost.mjs             # both surfaces + per-family breakdown
//   node scripts/token-cost.mjs --summary   # totals only
//   node scripts/token-cost.selftest.mjs    # the floors' refusal, no server needed
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
 */
export function measure(tools) {
  const total = bytes(tools);
  const fams = new Map();
  for (const t of tools) {
    const f = family(t.name);
    const e = fams.get(f) ?? { n: 0, b: 0 };
    e.n += 1;
    e.b += bytes(t);
    fams.set(f, e);
  }
  return {
    count: tools.length,
    total,
    names: bytes(tools.map((t) => t.name)),
    descs: bytes(tools.map((t) => t.description ?? "")),
    schemas: bytes(tools.map((t) => t.inputSchema ?? {})),
    perTool: tools.length ? Math.round(total / tools.length) : 0,
    families: [...fams.entries()].sort((a, b) => b[1].b - a[1].b),
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
  return { ok: problems.length === 0, problems };
}

// ── live read ─────────────────────────────────────────────────────────────────
async function surface(env) {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } =
    await import("@modelcontextprotocol/sdk/client/stdio.js");
  const transport = new StdioClientTransport({
    command: "node",
    args: [path.join(HOST_DIR, "dist", "index.js")],
    cwd: HOST_DIR,
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

// 🔴 THE LIVE READ RUNS ONLY AS AN ENTRY POINT. `token-cost.selftest.mjs` imports the
// pure core from this file, and a top-level `await surface()` would spawn a server (and
// require a built dist/) merely to ASSERT ABOUT ARITHMETIC. A proof that needs the thing
// it is proving to already work is not a proof.
const IS_MAIN = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (!IS_MAIN) { /* imported for `measure` / `verdict` — nothing below runs */ }
else await main();

async function main() {
const args = new Set(process.argv.slice(2));

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const tok = (n) => `~${(Math.round(n / BYTES_PER_TOKEN / 100) * 100).toLocaleString()}`;

const def = measure(await surface({ BREAKPOINT_PRIVILEGED_GROUPS: "" }));
const all = measure(await surface({ BREAKPOINT_PRIVILEGED_GROUPS: "all" }));

for (const [label, m] of [["default (no BREAKPOINT_PRIVILEGED_GROUPS)", def],
                          ["all groups (BREAKPOINT_PRIVILEGED_GROUPS=all)", all]]) {
  console.log(`TOKEN_COST ${label}`);
  console.log(`  tools            ${m.count}`);
  console.log(`  TOTAL BYTES      ${m.total.toLocaleString()}  (${kb(m.total)})`);
  console.log(`    names          ${m.names.toLocaleString()}`);
  console.log(`    descriptions   ${m.descs.toLocaleString()}`);
  console.log(`    input schemas  ${m.schemas.toLocaleString()}`);
  console.log(`  bytes/tool       ${m.perTool.toLocaleString()}`);
  console.log(`  DERIVED tokens   ${tok(m.total)}   🔴 estimate only — ${TOKENIZER_NOTE}`);
  console.log();
}

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
  + `bytes ${all.total.toLocaleString()} <= ${BYTES_CEILING.toLocaleString()}`);
if (!v.ok) {
  for (const p of v.problems) console.error(`\n🔴 TOKEN_COST REFUSED — ${p}`);
  process.exit(1);
}
console.log("TOKEN_COST ok — within budget, and the budget is already too high (see header)");
}

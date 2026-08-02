#!/usr/bin/env node
// List every path-like parameter in the tool surface — the enumeration a containment
// session scopes its work with.
//
// 🔴 THIS REPLACES `_to_delete/enum163.mjs`, WHOSE COUNT ("78") WAS QUOTED IN THREE
// HANDOFFS AND TWO SHIPPED CHANGELOGS AND WAS WRONG BY 180 ROWS. It lives here, and
// its walk lives in `src/path-cohort.ts` under unit test, so the next session inherits
// an instrument with assertions rather than a scratch file with a `continue`.
//
//   npm run path-cohort              # summary + every row, TSV
//   npm run path-cohort -- --summary # just the cohort sizes
//   npm run path-cohort -- --named   # only the rows literally named `path`
//
// Requires a built dist/ (`npm run build`). Does NOT need an editor: it reads the
// tool list over stdio and never calls a tool.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { enumeratePathCohort, summarisePathCohort } from "../dist/path-cohort.js";
import { comparePathLedger, LEDGER_CANARIES } from "../test-integration/_path_ledger.mjs";

const HOST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));

const transport = new StdioClientTransport({
  command: "node",
  args: [path.join(HOST_DIR, "dist", "index.js")],
  cwd: HOST_DIR,
  // every group, or the cohort is scoped to whatever this shell happens to enable
  env: { ...process.env, BREAKPOINT_PRIVILEGED_GROUPS: "all" },
  stderr: "ignore",
});
const client = new Client({ name: "path-cohort", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);

const tools = [];
let cursor;
do {
  const page = await client.listTools(cursor ? { cursor } : {});
  tools.push(...page.tools);
  cursor = page.nextCursor;
} while (cursor);

const rows = enumeratePathCohort(tools);
const sum = summarisePathCohort(rows);

console.log(`PATH_COHORT tools=${tools.length}`);
console.log(`PATH_COHORT top_level_named_path=${sum.topLevelNamedPath}`);
console.log(`PATH_COHORT top_level_other=${sum.topLevelOther}`);
console.log(`PATH_COHORT nested=${sum.nested}`);
console.log(`PATH_COHORT total=${sum.total}`);

if (!args.has("--summary")) {
  const shown = args.has("--named") ? rows.filter((r) => r.named) : rows;
  for (const r of shown) {
    console.log(`ROW\t${r.tool}\t${r.param}\td${r.depth}\t${r.why}\t${r.desc.slice(0, 90)}`);
  }
}

// ─────────────────────────────────────────────────── 🔴 THE FIVE NUMBERS, FLOORED
//
// 173, answering 172 §10.2. Until now this script printed five counts and exited 0
// whatever they were. It is the successor to `enum163.mjs`, whose number — 78 — was
// quoted in three handoffs and two shipped changelogs and was wrong by 180 rows; the
// replacement was shipped with nothing comparing ITS number to anything either.
//
// 168's rule is the whole reason this block exists: A MEASUREMENT THAT GETS SMALLER IS
// NOT A MEASUREMENT THAT GOT BETTER. A blinded enumerator here prints `total=0` and
// exits 0, and a reader who wanted good news gets it.
//
// LITERAL floors, ONE LINE PER POPULATION, each naming what its collapse would mean
// (172 §6). `>=` not exact: every one of these is supposed to grow. Measured on the
// full surface (`BREAKPOINT_PRIVILEGED_GROUPS=all`), session 173: 291/124/128/6/258.
const FLOORS = [
  ["tools", tools.length, 285, "the tool list itself came back short — every count below is scoped to a surface that is not the real one"],
  ["top_level_named_path", sum.topLevelNamedPath, 120, "the cohort enum163 DISCARDED. 15 of these were escaping when it was measured"],
  ["top_level_other", sum.topLevelOther, 124, "the compound names an exact-word test cannot match (`font_path`, `to_path`)"],
  ["nested", sum.nested, 6, "the cohort enum163 could not see AT ALL — a top-level-only walk reports zero of these and looks healthy"],
  ["total", sum.total, 250, "the number the handoffs quote. It was wrong by 180 rows once already"],
];

const failures = [];
for (const [name, got, floor, why] of FLOORS) {
  console.log(`PATH_COHORT_FLOOR ${name} ${got}/${floor} ${got >= floor ? "ok" : "🔴 BELOW FLOOR"}`);
  if (got < floor) failures.push(`${name} ${got} < ${floor} — ${why}`);
}

// 🔴 AND THE COUNTS ALONE CANNOT SEE A BLINDNESS THAT IS NARROW ENOUGH. The canaries
// name parameters, so a filter that drops one specific historical cohort is caught even
// while the total stays over its floor. Same two rows the ledger gate keys on, imported
// rather than copied — two lists that agree by hand are two lists that drift.
const lostCanaries = LEDGER_CANARIES.filter(([t, p]) => !rows.some((r) => r.tool === t && r.param === p));
console.log(`PATH_COHORT_CANARY ${LEDGER_CANARIES.length - lostCanaries.length}/${LEDGER_CANARIES.length} ${lostCanaries.length ? "🔴 LOST" : "ok"}`);
if (lostCanaries.length) failures.push(`the enumerator lost ${lostCanaries.map(([t, p, why]) => `${t}.${p} (${why})`).join("; ")} — a historical blindness has been reintroduced`);

// 🔴 AND THE LEDGER COMPARISON, WHICH UNTIL NOW RAN ONLY INSIDE A PROBE THAT BOOTS THE
// EDITOR GUI UNDER XVFB. It needs neither: a tool list and a file. Running it here means
// an unclassified parameter is caught by anything that can run `npm run build`.
const ledgerPath = path.join(HOST_DIR, "path-cohort-ledger.tsv");
const cmp = comparePathLedger(rows, fs.readFileSync(ledgerPath, "utf8"));
console.log(`PATH_COHORT_LEDGER live=${cmp.liveCount} ledger=${cmp.ledgerCount} unclassified=${cmp.unclassified.length} stale=${cmp.stale.length} malformed=${cmp.badClass.length} scope=${cmp.scope.length}`);
if (cmp.unclassified.length) failures.push(`${cmp.unclassified.length} path-like parameter(s) entered the surface unclassified -> ${cmp.unclassified.map((k) => k.replace("\t", ".")).slice(0, 8).join(", ")} — measure them, then add a line to host/path-cohort-ledger.tsv`);
if (cmp.stale.length) failures.push(`${cmp.stale.length} ledger entr(ies) name a parameter that no longer exists -> ${cmp.stale.map((k) => k.replace("\t", ".")).slice(0, 8).join(", ")}`);
if (cmp.badClass.length) failures.push(`${cmp.badClass.length} malformed ledger entr(ies) -> ${cmp.badClass.slice(0, 5).join("; ")}`);
if (cmp.scope.length) failures.push(`this gate's OWN scope collapsed -> ${cmp.scope.join(" | ")}`);

await client.close();

if (failures.length) {
  for (const f of failures) console.error(`  FAIL ${f}`);
  console.error(`::error::PATH_COHORT gate failed — ${failures.length} population(s) collapsed or disagreed with the ledger`);
  process.exit(1);
}
console.log("PATH_COHORT ok — every cohort is at or above its literal floor and agrees with the ledger");
process.exit(0);

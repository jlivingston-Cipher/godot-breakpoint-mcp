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
import { fileURLToPath } from "node:url";
import { enumeratePathCohort, summarisePathCohort } from "../dist/path-cohort.js";

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

await client.close();
process.exit(0);

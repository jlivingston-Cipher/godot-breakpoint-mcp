#!/usr/bin/env node
// cs_demo_verify_live.mjs — Track 3 C# mirror of demo_verify_live.mjs: the R-tier
// runtime-verification close on the C# track (§4.I), with NO debugger.
//
// Runs res://demo/demo.tscn from example-csharp as a managed .NET/Mono game
// (GODOT_BIN = Godot_mono, GODOT_PROJECT = example-csharp) and asserts against the
// LIVE C# node over the runtime bridge — the same two honest checks the GDScript
// close makes, but on C# state read by its PascalCase names (no [Export] needed):
//   ASSERT 1  the ice NEVER grew on a warm spell       -> GrewEver == false
//   ASSERT 2  the finish condition fired              -> "ALL MELTED" on screen
// Before the one-line clamp (int melt = warmth - Shade) these FAIL
// (GrewEver == true, never emptied, final Ice = 3); after it (Mathf.Max(0, ...)) they
// PASS (GrewEver == false, "ALL MELTED", final Ice = 0). Automation proves the fix,
// and the proof is a check that can fail. Rebuild the C# assembly between passes.
//
// Usage from host/:  node cs_demo_verify_live.mjs <label>     (label e.g. buggy | fixed)
// Env (set by the runner): GODOT_BIN=<Godot_mono …/MacOS/Godot>,
//   GODOT_PROJECT=<example-csharp abs>, PATH incl dotnet@8/bin, DOTNET_ROOT — so the
//   managed Godot child finds the .NET runtime to load the built assembly.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const HOST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HOST_DIR, "..");
const DIST = path.join(HOST_DIR, "dist", "index.js");
const GODOT_PROJECT = process.env.GODOT_PROJECT || path.join(REPO, "example-csharp");
const GODOT_BIN = process.env.GODOT_BIN || "godot";
const LABEL = process.argv[2] || "run";
const HOME = os.homedir();
function redact(s) {
  return s
    .split(GODOT_PROJECT + "/demo/").join("res://demo/")
    .split(GODOT_PROJECT + "/").join("res://")
    .split(GODOT_PROJECT).join("<project>")
    .split(REPO).join("<project>")
    .split(HOME).join("~");
}


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const S = (res) => (res && res.structuredContent ? res.structuredContent : res);
const out = { label: LABEL, steps: [] };
function rec(step, tool, args, result) {
  out.steps.push({ step, tool, args, result });
  console.log(`\n=== [${LABEL}] ${step} — ${tool} ${JSON.stringify(args)} ===`);
  console.log(redact(JSON.stringify(result, null, 2)));
}

async function main() {
  const transport = new StdioClientTransport({
    command: "node", args: [DIST], cwd: HOST_DIR,
    env: { ...process.env, GODOT_BIN, GODOT_PROJECT, BREAKPOINT_PRIVILEGED_GROUPS: "code-execution" },
    stderr: "ignore",
  });
  const client = new Client({ name: "gcb-cs-demo-verify", version: "1.0.0" }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async () => ({ action: "accept", content: { proceed: true } }));
  await client.connect(transport);
  const t = (name, args = {}) => client.callTool({ name, arguments: args }, undefined, { timeout: 60000 });

  // run the C# demo scene as a managed process (captured console)
  const runRes = S(await t("godot_run_managed", { scene: "res://demo/demo.tscn" }));
  rec("run", "godot_run_managed", { scene: "res://demo/demo.tscn" }, runRes);
  const id = runRes && runRes.id;
  if (!id) { console.log("no managed id — aborting"); await client.close(); process.exit(1); }

  // wait for the runtime bridge to answer (CLR boot + _Ready loop complete). The C#
  // property is Ice (PascalCase); the bridge resolves it via node.get("Ice").
  let ice = null;
  for (let i = 0; i < 45; i++) {
    await sleep(700);
    try {
      const g = S(await t("runtime_get_property", { path: ".", property: "Ice" }));
      if (g && g.value !== undefined && g.value !== null && !g.isError) { ice = g.value; break; }
    } catch { /* not up yet */ }
  }
  rec("final Ice", "runtime_get_property", { path: ".", property: "Ice" }, { value: ice });
  rec("final GrewEver", "runtime_get_property", { path: ".", property: "GrewEver" },
    S(await t("runtime_get_property", { path: ".", property: "GrewEver" })));

  // ASSERT 1 — the ice NEVER grew on a warm spell (GrewEver stayed false)
  rec("assert GrewEver==false", "runtime_assert_node_state",
    { path: ".", expect: { GrewEver: false } },
    S(await t("runtime_assert_node_state", { path: ".", expect: { GrewEver: false } })));

  // ASSERT 2 — the finish condition fires when Ice <= 0
  rec('assert screen "ALL MELTED"', "runtime_assert_screen_text", { text: "ALL MELTED" },
    S(await t("runtime_assert_screen_text", { text: "ALL MELTED" })));

  // captured console — the trajectory + (fixed only) the ALL MELTED line
  const console_out = S(await t("godot_output", { id }));
  rec("captured console", "godot_output", { id }, console_out);

  rec("teardown", "godot_stop", { id }, S(await t("godot_stop", { id })));

  writeFileSync(path.join(HOST_DIR, `cs_demo_verify_${LABEL}.json`), redact(JSON.stringify(out, null, 2)));
  console.log(`\n=== wrote cs_demo_verify_${LABEL}.json ===`);
  await client.close();
  process.exit(0);
}
main().catch((e) => { console.error("[cs-verify] FATAL:", (e && e.stack) || e); process.exit(1); });

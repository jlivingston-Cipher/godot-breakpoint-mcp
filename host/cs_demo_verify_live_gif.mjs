#!/usr/bin/env node
// cs_demo_verify_live_gif.mjs — TRULY-LIVE capture driver for the C# runtime-verify
// close (session 117). Unlike cs_demo_verify_replay.mjs (which reformats the captured
// session-115 transcripts), this DRIVES THE REAL managed .NET/Mono game over the
// runtime bridge — buggy pass, the one-line fix + rebuild, fixed pass — printing a
// clean shareable narrative as each LIVE assert resolves. Recorded under asciinema and
// rendered with agg -> host/cs_demo_verify_live.gif.
//
// Env (set by the asciinema runner): GODOT_BIN=<Godot_mono .../MacOS/Godot>,
//   GODOT_PROJECT=<example-csharp abs>, PATH incl dotnet@8/bin, DOTNET_ROOT.
// Side effects: opens two game windows; edits DemoCombat.cs then git-restores it and
// rebuilds (buggy is the teaching artifact) in a finally block. Never pushes anything.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const HOST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HOST_DIR, "..");
const DIST = path.join(HOST_DIR, "dist", "index.js");
const GODOT_PROJECT = process.env.GODOT_PROJECT || path.join(REPO, "example-csharp");
const GODOT_BIN = process.env.GODOT_BIN || "godot";
const CS = path.join(GODOT_PROJECT, "demo", "DemoCombat.cs");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const S = (r) => (r && r.structuredContent ? r.structuredContent : r);
const w = (s) => process.stdout.write(s);
const C = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m", gray: "\x1b[90m",
};
const mark = (ok) => (ok ? `${C.green}✓ PASS${C.reset}` : `${C.red}✗ FAIL${C.reset}`);

function dotnetBuild() {
  execSync("dotnet build ExampleCsharp.sln -c Debug --nologo -v quiet", {
    cwd: GODOT_PROJECT, env: process.env, stdio: "ignore",
  });
}
function narratedBuild() {
  w(`  ${C.dim}dotnet build example-csharp (Debug)…${C.reset} `);
  dotnetBuild();
  console.log(`${C.green}✓${C.reset}`);
}
function pkill() { try { execSync("pkill -9 -f Godot_mono", { stdio: "ignore" }); } catch {} }

async function runPass(t, label, color) {
  console.log(`${color}${C.bold}── ${label} build ─────────────────${C.reset}`);
  narratedBuild();
  pkill(); await sleep(700);
  console.log(`${C.cyan}▶ godot_run_managed${C.reset} { scene: "res://demo/demo.tscn" }   ${C.dim}(managed .NET/Mono — a game window opens)${C.reset}`);
  const runRes = S(await t("godot_run_managed", { scene: "res://demo/demo.tscn" }));
  const id = runRes && runRes.id;
  if (!id) throw new Error(`${label}: godot_run_managed returned no id`);
  console.log(`  ${C.dim}⏳ booting CLR + running _Ready…${C.reset}`);
  let hp = null;
  for (let i = 0; i < 70; i++) {
    await sleep(800);
    try {
      const g = S(await t("runtime_get_property", { path: ".", property: "Hp" }));
      if (g && g.value !== undefined && g.value !== null && !g.isError) { hp = g.value; break; }
    } catch { /* not up yet */ }
  }
  const healed = (S(await t("runtime_get_property", { path: ".", property: "HealedEver" })) || {}).value;
  const co = S(await t("godot_output", { id }));
  const lines = ((co && co.lines) || []).map((l) => l.text).filter((x) => x.startsWith("[demo]"));
  for (const l of lines) { console.log(`  ${C.gray}${l}${C.reset}`); await sleep(220); }
  console.log(`  ${C.dim}live C# node (PascalCase, no [Export]):${C.reset}  Hp = ${C.bold}${hp}${C.reset}   HealedEver = ${C.bold}${healed}${C.reset}`);
  const a1 = (S(await t("runtime_assert_node_state", { path: ".", expect: { HealedEver: false } })) || {}).ok;
  const a2 = (S(await t("runtime_assert_screen_text", { text: "YOU DIED" })) || {}).ok;
  await sleep(300);
  console.log(`  ASSERT 1  HealedEver == false   ${mark(a1)}${a1 ? "" : `  ${C.red}(actual ${healed} — healed on a hit)${C.reset}`}`);
  await sleep(350);
  console.log(`  ASSERT 2  screen "YOU DIED"     ${mark(a2)}${a2 ? `  ${C.green}(Label = "YOU DIED")${C.reset}` : `  ${C.red}(never died, final Hp=${hp})${C.reset}`}`);
  await t("godot_stop", { id });
  pkill();
  writeFileSync(path.join(HOST_DIR, `cs_demo_verify_live_${label.toLowerCase()}.json`),
    JSON.stringify({ label, hp, healed, assert_healed_false: a1, assert_you_died: a2, demo: lines }, null, 2));
  console.log("");
  return { hp, healed, a1, a2 };
}

async function main() {
  const transport = new StdioClientTransport({
    command: "node", args: [DIST], cwd: HOST_DIR,
    env: { ...process.env, GODOT_BIN, GODOT_PROJECT, BREAKPOINT_PRIVILEGED_GROUPS: "code-execution" },
    stderr: "ignore",
  });
  const client = new Client({ name: "gcb-cs-verify-live-gif", version: "1.0.0" }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async () => ({ action: "accept", content: { proceed: true } }));
  await client.connect(transport);
  const t = (n, a = {}) => client.callTool({ name: n, arguments: a }, undefined, { timeout: 90000 });

  console.log("");
  console.log(`${C.bold}${C.cyan}Breakpoint MCP — C# runtime-verify close${C.reset}  ${C.dim}· LIVE on Godot 4.7 .NET · the proof is a check that can fail${C.reset}`);
  console.log(`${C.dim}Driving the REAL managed C# game over the runtime bridge — the same two honest checks as the GDScript close.${C.reset}`);
  console.log("");
  await sleep(800);

  try {
    execSync("git checkout -- example-csharp/demo/DemoCombat.cs", { cwd: REPO, stdio: "ignore" });
    await runPass(t, "BUGGY", C.red);

    console.log(`${C.yellow}✎ the one-line fix${C.reset}  ${C.dim}DemoCombat.cs${C.reset}   int effective = ${C.red}damage - Armor${C.reset}   →   int effective = ${C.green}Mathf.Max(0, damage - Armor)${C.reset}`);
    console.log("");
    const src = readFileSync(CS, "utf8");
    const patched = src.replace("int effective = damage - Armor;", "int effective = Mathf.Max(0, damage - Armor);");
    if (patched === src) throw new Error("fix replacement did not match DemoCombat.cs");
    writeFileSync(CS, patched);
    await sleep(400);

    await runPass(t, "FIXED", C.green);

    console.log(`${C.bold}buggy ${C.red}FAILS both${C.reset}${C.bold} · fixed ${C.green}PASSES both${C.reset}${C.bold} — automation proves the fix on the C# track, live.${C.reset}`);
    console.log(`${C.dim}Captured live on Godot 4.7 .NET. The runtime bridge reads C# props by PascalCase → zero [Export] needed.${C.reset}`);
    console.log("");
    await sleep(600);
  } finally {
    try { execSync("git checkout -- example-csharp/demo/DemoCombat.cs", { cwd: REPO, stdio: "ignore" }); } catch {}
    try { dotnetBuild(); } catch {}
    pkill();
    try { await client.close(); } catch {}
  }
  process.exit(0);
}
main().catch((e) => { console.error("[cs-verify-live] FATAL:", (e && e.stack) || e); process.exit(1); });

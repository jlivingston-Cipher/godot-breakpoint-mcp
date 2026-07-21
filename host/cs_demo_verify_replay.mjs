#!/usr/bin/env node
// cs_demo_verify_replay.mjs — renders a clean, shareable terminal narrative of the
// C# runtime-verify close from the REAL captured transcripts (cs_demo_verify_
// {buggy,fixed}.json — the session-115 live run on Godot 4.7 .NET). Every Ice value,
// GrewEver, console line, and assert verdict shown is READ from those transcripts;
// this reformats real captured data for a GIF, it does not re-run the game.
// Record:  asciinema rec cs_demo_verify.cast --command "node cs_demo_verify_replay.mjs" \
//            --window-size 120x30 --idle-time-limit 2.0 --overwrite
//   then:  agg cs_demo_verify.cast cs_demo_verify.gif --theme monokai --font-size 26 --speed 1.4
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const load = (l) => JSON.parse(readFileSync(path.join(HERE, `cs_demo_verify_${l}.json`), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const C = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m", gray: "\x1b[90m",
};

const stepVal = (o, step, key = "value") => {
  const s = o.steps.find((x) => x.step === step);
  return s && s.result ? s.result[key] : undefined;
};
const assertOk = (o, step) => {
  const s = o.steps.find((x) => x.step === step);
  return s && s.result ? s.result.ok : undefined;
};
const demoLines = (o) => {
  const s = o.steps.find((x) => x.tool === "godot_output");
  return (s.result.lines || []).map((l) => l.text).filter((t) => t.startsWith("[demo]"));
};

async function pass(o, label, color) {
  console.log(`${color}${C.bold}── ${label} build ─────────────────────────────${C.reset}`);
  await sleep(500);
  console.log(`${C.cyan}▶ godot_run_managed${C.reset} { scene: "res://demo/demo.tscn" }   ${C.dim}(managed .NET/Mono)${C.reset}`);
  await sleep(650);
  for (const l of demoLines(o)) { console.log(`  ${C.gray}${l}${C.reset}`); await sleep(300); }
  const ice = stepVal(o, "final Ice");
  const grew = stepVal(o, "final GrewEver");
  await sleep(350);
  console.log(`  ${C.dim}live C# node (read by PascalCase, no [Export]):${C.reset}  Ice = ${C.bold}${ice}${C.reset}   GrewEver = ${C.bold}${grew}${C.reset}`);
  await sleep(550);
  const a1 = assertOk(o, "assert GrewEver==false");
  const a2 = assertOk(o, 'assert screen "ALL MELTED"');
  const mark = (ok) => (ok ? `${C.green}✓ PASS${C.reset}` : `${C.red}✗ FAIL${C.reset}`);
  console.log(`  ASSERT 1  GrewEver == false   ${mark(a1)}${a1 ? "" : `  ${C.red}(actual ${grew} — grew on a warm moment)${C.reset}`}`);
  await sleep(400);
  console.log(`  ASSERT 2  screen "ALL MELTED"     ${mark(a2)}${a2 ? `  ${C.green}(Label = "ALL MELTED")${C.reset}` : `  ${C.red}(never emptied, final Ice=${ice})${C.reset}`}`);
  await sleep(750);
  console.log("");
}

async function main() {
  console.log("");
  console.log(`${C.bold}${C.cyan}Breakpoint MCP — C# runtime-verify close${C.reset}  ${C.dim}· Godot 4.7 .NET · the proof is a check that can fail${C.reset}`);
  console.log(`${C.dim}Assert the R tier on the LIVE C# game over the runtime bridge — the same two honest checks as the GDScript close.${C.reset}`);
  console.log("");
  await sleep(900);
  await pass(load("buggy"), "BUGGY", C.red);
  await sleep(300);
  console.log(`${C.yellow}✎ the one-line fix${C.reset}  ${C.dim}DemoSnowman.cs${C.reset}   int melt = ${C.red}warmth - Shade${C.reset}   →   int melt = ${C.green}Mathf.Max(0, warmth - Shade)${C.reset}`);
  console.log(`${C.dim}   rebuild the C# assembly…${C.reset}`);
  console.log("");
  await sleep(1100);
  await pass(load("fixed"), "FIXED", C.green);
  console.log(`${C.bold}buggy ${C.red}FAILS both${C.reset}${C.bold} · fixed ${C.green}PASSES both${C.reset}${C.bold} — automation proves the fix on the C# track.${C.reset}`);
  console.log(`${C.dim}Captured live on Godot 4.7 .NET (session 115). The runtime bridge reads C# props by PascalCase, so zero [Export] needed.${C.reset}`);
  console.log("");
  await sleep(400);
}
main();

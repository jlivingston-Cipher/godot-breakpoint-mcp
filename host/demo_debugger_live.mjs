#!/usr/bin/env node
// demo_debugger_live.mjs — Track 3 live pass: the debugger-led demo (GDScript track).
//
// Drives the §4 transcript of BREAKPOINT_DEBUGGER_DEMO_2026-07-17.md against the
// self-contained buggy combat scene res://demo/demo.tscn, over the real MCP host (stdio),
// which talks to the live Godot editor's Debug Adapter (:6006). Captures every tool call +
// result into demo_gdscript_transcript.json and prints a readable transcript.
//
// The scene self-drives: _ready() runs `for d in [3,20,4,90]: take_hit(d)`, and the
// breakpoint on demo_combat.gd:17 (`hp -= effective`) halts on the FIRST hit (damage=3),
// where effective = 3 - 5 = -2 -> `hp -= (-2)` HEALS. That negative is the smoking gun.
//
// Godot populates a frame's variables asynchronously after `scopes`, so variable reads are
// retried until they settle. dbg_evaluate is a code-execution tool, so the host is launched
// with BREAKPOINT_PRIVILEGED_GROUPS=code-execution. Run from host/ with the editor up:
//   node demo_debugger_live.mjs

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import path from "node:path";

const HOST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HOST_DIR, "..");
const DIST = path.join(HOST_DIR, "dist", "index.js");
const GODOT_PROJECT = process.env.GODOT_PROJECT || path.join(REPO, "example");
const GODOT_BIN = process.env.GODOT_BIN || "godot";
const BP_LINE = 17;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const S = (res) => (res && res.structuredContent ? res.structuredContent : res);
const isErr = (r) => Boolean(r && r.isError);
const transcript = [];
function rec(step, tool, args, result) {
  transcript.push({ step, tool, args, result });
  console.log(`\n=== ${step} — ${tool} ${JSON.stringify(args)} ===`);
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const transport = new StdioClientTransport({
    command: "node", args: [DIST], cwd: HOST_DIR,
    env: { ...process.env, GODOT_BIN, GODOT_PROJECT, CLAUDE_RUNTIME_TIMEOUT_MS: "120000",
      BREAKPOINT_PRIVILEGED_GROUPS: "code-execution" },
    stderr: "inherit",
  });
  const client = new Client({ name: "gcb-demo-dap", version: "1.0.0" }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async () => {
    process.stderr.write("[demo] elicitation -> ACCEPT\n");
    return { action: "accept", content: { proceed: true } };
  });
  await client.connect(transport);
  const t = (name, args = {}) => client.callTool({ name, arguments: args }, undefined, { timeout: 130000 });

  // Read a frame's scopes + variables, retrying until Godot has populated them (the
  // `scopes`->`variables` race returns "DAP error [variables]: unknown" until ready).
  async function readFrame(frame_id) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const scopes = S(await t("dbg_scopes", { frame_id }));
      const list = scopes.scopes || [];
      const vars = {};
      let anyErr = false;
      for (const sc of list) {
        if (sc.variables_ref == null) continue;
        const v = S(await t("dbg_variables", { variables_ref: sc.variables_ref }));
        if (isErr(v)) { anyErr = true; break; }
        vars[sc.name] = { variables_ref: sc.variables_ref, variables: v.variables || [] };
      }
      if (!anyErr) return { scopes: list, vars, attempts: attempt + 1 };
      await sleep(700);
    }
    return null;
  }

  // A — arm the trap: buffer the breakpoint on `hp -= effective` (demo_combat.gd:17)
  rec("A", "dbg_set_breakpoints", { path: "res://demo/demo_combat.gd", lines: [BP_LINE] },
    S(await t("dbg_set_breakpoints", { path: "res://demo/demo_combat.gd", lines: [BP_LINE] })));

  // B — launch the demo scene under the debugger; _ready() self-drives into take_hit()
  rec("B", "dbg_launch", { scene: "res://demo/demo.tscn" },
    S(await t("dbg_launch", { scene: "res://demo/demo.tscn" })));

  // wait for the stop by polling stackTrace until frames appear (software boot is slow)
  let frames = [];
  for (let i = 0; i < 70; i++) {
    await sleep(600);
    try {
      const st = S(await t("dbg_stack_trace", { levels: 10 }));
      if (Array.isArray(st.frames) && st.frames.length > 0) { frames = st.frames; break; }
    } catch { /* not stopped yet */ }
  }
  if (frames.length === 0) {
    console.log("\n!! never stopped at demo_combat.gd:17 within ~42s — aborting");
    writeFileSync(path.join(HOST_DIR, "demo_gdscript_transcript.json"), JSON.stringify({ ok: false, transcript }, null, 2));
    await client.close(); process.exit(2);
  }
  await sleep(1000); // settle: let Godot fetch the frame variable dump from the debuggee

  // C — read the REAL call stack (proof #1: take_hit <- _ready, at line 17)
  rec("C", "dbg_stack_trace", { levels: 10 }, { frames });

  // D — open scopes + read the REAL variable values (proof #2: effective = -2)
  const top = frames[0] && frames[0].id != null ? frames[0].id : 0;
  const f = await readFrame(top);
  if (!f) {
    console.log("\n!! variables never settled — aborting");
    writeFileSync(path.join(HOST_DIR, "demo_gdscript_transcript.json"), JSON.stringify({ ok: false, transcript }, null, 2));
    await client.close(); process.exit(3);
  }
  rec("D", "dbg_scopes", { frame_id: top }, { scopes: f.scopes, settled_after_attempts: f.attempts });
  for (const [name, data] of Object.entries(f.vars)) {
    rec(`D:${name}`, "dbg_variables", { variables_ref: data.variables_ref }, { variables: data.variables });
  }

  // E — prove the fix in the paused frame (proof #3: max(0, damage-armor) -> 0)
  rec("E", "dbg_evaluate", { expression: "max(0, damage - armor)", frame_id: top, confirm: true },
    S(await t("dbg_evaluate", { expression: "max(0, damage - armor)", frame_id: top, confirm: true })));
  // contrast: the buggy expression the code actually runs
  rec("E'", "dbg_evaluate", { expression: "damage - armor", frame_id: top, confirm: true },
    S(await t("dbg_evaluate", { expression: "damage - armor", frame_id: top, confirm: true })));

  // F — step over line 17 and re-read hp: it went UP on a hit (the bug, caught in the act)
  rec("F", "dbg_step", { kind: "over" }, S(await t("dbg_step", { kind: "over" })));
  await sleep(800);
  const f2 = await readFrame(top);
  if (f2 && f2.vars.Members) {
    rec("F:Members(after step)", "dbg_variables", { variables_ref: f2.vars.Members.variables_ref }, { variables: f2.vars.Members.variables });
  }

  // G — clear the breakpoint and release the game so _ready() finishes, then done
  rec("G", "dbg_set_breakpoints", { path: "res://demo/demo_combat.gd", lines: [] },
    S(await t("dbg_set_breakpoints", { path: "res://demo/demo_combat.gd", lines: [] })));
  rec("G", "dbg_continue", {}, S(await t("dbg_continue", {})));

  writeFileSync(path.join(HOST_DIR, "demo_gdscript_transcript.json"), JSON.stringify({ ok: true, transcript }, null, 2));
  console.log("\n=== wrote demo_gdscript_transcript.json ===");
  await client.close();
  process.exit(0);
}
main().catch((e) => { console.error("[demo] FATAL:", (e && e.stack) || e); process.exit(1); });

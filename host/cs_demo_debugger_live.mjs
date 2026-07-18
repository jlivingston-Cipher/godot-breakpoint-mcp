#!/usr/bin/env node
// cs_demo_debugger_live.mjs — Track 3 C# mirror: the debugger-led demo (C# track).
//
// Mirrors demo_debugger_live.mjs on DemoCombat.TakeHit (res://demo/DemoCombat.cs:22,
// `Hp -= effective`), driven over the real MCP host by **netcoredbg** (GODOT_CSDAP_CMD)
// launching the .NET/Mono Godot (GODOT_CSHARP_BIN) on the example-csharp project. The
// scene self-drives: _Ready() runs `foreach d in [3,20,4,90]: TakeHit(d)`, so the
// breakpoint halts on the FIRST hit (damage=3) where effective = 3 - 5 = -2 -> HEAL.
//
// netcoredbg presents a single "Locals" scope with `this` as an expandable entry (unlike
// Godot's DAP Locals/Members split), so member fields (Hp/Armor/HealedEver) are read by
// expanding `this`. cs_dbg_evaluate is code-execution, so the host runs with
// BREAKPOINT_PRIVILEGED_GROUPS=code-execution. Env (set by the runner):
//   GODOT_CSDAP_CMD, GODOT_CSHARP_BIN, GODOT_CSHARP_PROJECT, DOTNET_ROOT, PATH(dotnet@8)

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import path from "node:path";

const HOST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HOST_DIR, "..");
const DIST = path.join(HOST_DIR, "dist", "index.js");
const CSPROJ = process.env.GODOT_CSHARP_PROJECT || path.join(REPO, "example-csharp");
const BP_LINE = 22;

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
    env: { ...process.env, CLAUDE_RUNTIME_TIMEOUT_MS: "120000",
      BREAKPOINT_PRIVILEGED_GROUPS: "code-execution", GODOT_CSHARP_PROJECT: CSPROJ },
    stderr: "inherit",
  });
  const client = new Client({ name: "gcb-demo-csdap", version: "1.0.0" }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async () => {
    process.stderr.write("[demo] elicitation -> ACCEPT\n");
    return { action: "accept", content: { proceed: true } };
  });
  await client.connect(transport);
  const t = (name, args = {}) => client.callTool({ name, arguments: args }, undefined, { timeout: 130000 });

  // Read a frame's scopes + variables; netcoredbg nests instance fields under `this`,
  // so expand it into a synthetic "this" group for the Member values.
  async function readFrame(frame_id) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const scopes = S(await t("cs_dbg_scopes", { frame_id }));
      const list = scopes.scopes || [];
      if (!list.length) { await sleep(600); continue; }
      const vars = {};
      let anyErr = false;
      for (const sc of list) {
        if (!sc.variables_ref) continue;
        const v = S(await t("cs_dbg_variables", { variables_ref: sc.variables_ref }));
        if (isErr(v)) { anyErr = true; break; }
        vars[sc.name] = { variables_ref: sc.variables_ref, variables: v.variables || [] };
        const thisVar = (v.variables || []).find((x) => x.name === "this" && x.variables_ref);
        if (thisVar) {
          const tv = S(await t("cs_dbg_variables", { variables_ref: thisVar.variables_ref }));
          if (!isErr(tv)) vars["this"] = { variables_ref: thisVar.variables_ref, variables: tv.variables || [] };
        }
      }
      if (!anyErr) return { scopes: list, vars, attempts: attempt + 1 };
      await sleep(700);
    }
    return null;
  }

  // A — arm the trap: buffer the breakpoint on `Hp -= effective` (DemoCombat.cs:22)
  rec("A", "cs_dbg_set_breakpoints", { path: "res://demo/DemoCombat.cs", lines: [BP_LINE] },
    S(await t("cs_dbg_set_breakpoints", { path: "res://demo/DemoCombat.cs", lines: [BP_LINE] })));

  // B — launch the .NET Godot on the demo scene; _Ready() self-drives into TakeHit()
  const launchArgs = ["--headless", "--path", CSPROJ, "res://demo/demo.tscn"];
  rec("B", "cs_dbg_launch", { args: launchArgs },
    S(await t("cs_dbg_launch", { args: launchArgs })));

  // wait for the stop by polling stackTrace until frames appear (CLR boot is slow)
  let frames = [];
  for (let i = 0; i < 90; i++) {
    await sleep(700);
    try {
      const st = S(await t("cs_dbg_stack_trace", { levels: 10 }));
      if (Array.isArray(st.frames) && st.frames.length > 0) { frames = st.frames; break; }
    } catch { /* not stopped yet */ }
  }
  if (frames.length === 0) {
    console.log("\n!! never stopped at DemoCombat.cs:22 within ~63s — aborting");
    writeFileSync(path.join(HOST_DIR, "cs_demo_transcript.json"), JSON.stringify({ ok: false, transcript }, null, 2));
    await client.close(); process.exit(2);
  }
  await sleep(1200); // settle: let netcoredbg fetch the frame's variable dump

  // C — the REAL call stack (proof #1: TakeHit <- _Ready)
  rec("C", "cs_dbg_stack_trace", { levels: 10 }, { frames });

  // D — scopes + REAL variables (proof #2: effective = -2; Members via `this`)
  const top = frames[0] && frames[0].id != null ? frames[0].id : 0;
  const f = await readFrame(top);
  if (!f) {
    console.log("\n!! variables never settled — aborting");
    writeFileSync(path.join(HOST_DIR, "cs_demo_transcript.json"), JSON.stringify({ ok: false, transcript }, null, 2));
    await client.close(); process.exit(3);
  }
  rec("D", "cs_dbg_scopes", { frame_id: top }, { scopes: f.scopes, settled_after_attempts: f.attempts });
  for (const [name, data] of Object.entries(f.vars)) {
    rec(`D:${name}`, "cs_dbg_variables", { variables_ref: data.variables_ref }, { variables: data.variables });
  }

  // E — prove the bug from the paused frame by evaluating the ACTUAL buggy expression live
  // (frame-local evaluation is the beat the field disclaims). netcoredbg evaluates binary
  // arithmetic on locals/fields natively, so `damage - Armor` -> -2 is computed in-frame.
  rec("E", "cs_dbg_evaluate", { expression: "damage - Armor", frame_id: top, confirm: true },
    S(await t("cs_dbg_evaluate", { expression: "damage - Armor", frame_id: top, confirm: true })));
  // E2 — the corrected clamp the fix applies (Mathf.Max) needs function-evaluation, which
  // netcoredbg does NOT implement for GodotSharp calls (returns 0x80004005). Recorded as an
  // honest adapter-capability delta: on the C# track the bug is proven from ground truth
  // (effective = -2, with damage=3 < Armor=5) rather than by evaluating the fix call.
  rec("E2 (netcoredbg has no funceval — honest delta)", "cs_dbg_evaluate", { expression: "Mathf.Max(0, damage - Armor)", frame_id: top, confirm: true },
    S(await t("cs_dbg_evaluate", { expression: "Mathf.Max(0, damage - Armor)", frame_id: top, confirm: true })));

  // F — step over line 22 and re-read Hp via `this`: it went UP on a hit.
  // netcoredbg assigns fresh frame handles at each stop, so re-fetch stackTrace before reading.
  rec("F", "cs_dbg_step", { kind: "over" }, S(await t("cs_dbg_step", { kind: "over" })));
  await sleep(1200);
  let top2 = top;
  try {
    const st2 = S(await t("cs_dbg_stack_trace", { levels: 3 }));
    if (Array.isArray(st2.frames) && st2.frames.length && st2.frames[0].id != null) top2 = st2.frames[0].id;
  } catch { /* keep top */ }
  const f2 = await readFrame(top2);
  if (f2 && f2.vars["this"]) {
    const members = f2.vars["this"].variables.filter((v) => ["Hp", "Armor", "HealedEver"].includes(v.name));
    rec("F:this(after step)", "cs_dbg_variables", { variables_ref: f2.vars["this"].variables_ref }, { variables: members });
  } else if (f2) {
    for (const [name, data] of Object.entries(f2.vars)) {
      rec(`F:${name}(after step)`, "cs_dbg_variables", { variables_ref: data.variables_ref }, { variables: data.variables });
    }
  }

  // G — clear the breakpoint and release the game so _Ready() finishes
  rec("G", "cs_dbg_set_breakpoints", { path: "res://demo/DemoCombat.cs", lines: [] },
    S(await t("cs_dbg_set_breakpoints", { path: "res://demo/DemoCombat.cs", lines: [] })));
  rec("G", "cs_dbg_continue", {}, S(await t("cs_dbg_continue", {})));

  writeFileSync(path.join(HOST_DIR, "cs_demo_transcript.json"), JSON.stringify({ ok: true, transcript }, null, 2));
  console.log("\n=== wrote cs_demo_transcript.json ===");
  await client.close();
  process.exit(0);
}
main().catch((e) => { console.error("[demo] FATAL:", (e && e.stack) || e); process.exit(1); });

#!/usr/bin/env node
// demo_verify_live.mjs — Track 3 live pass: the R-tier verification close (§4.I).
//
// Runs res://demo/demo.tscn as a managed game (captured console) and asserts against the
// LIVE game over the runtime bridge, with NO debugger: the ice must NEVER GROW on a
// warm spell (grew_ever == false) and the finish condition must fire ("ALL MELTED").
// Before the fix these FAIL; after the one-line clamp they PASS. That is the honest close:
// automation proves the fix, and the proof is a check that can fail.
//
// Usage from host/:  node demo_verify_live.mjs <label>     (label e.g. buggy | fixed)

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
const GODOT_PROJECT = process.env.GODOT_PROJECT || path.join(REPO, "example");
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

// 🔴 175: THIS SCRIPT RECORDED VERDICTS IT NEVER READ, AND EXITED 0 EITHER WAY.
// The header above says it "asserts against the LIVE game" and that "before the fix
// these FAIL; after the one-line clamp they PASS. That is the honest close." Every
// word of that was true of the TOOL and false of the SCRIPT: `rec()` pushes the reply
// into `out.steps` and prints it, and the word "assert" appeared only in the step
// LABEL. Its own captures are the proof — `demo_verify_buggy.json` holds ok:false
// twice and that run exited 0.
//
// 🔴 AND THE EXPECTED VERDICT IS A FUNCTION OF THE LABEL, WHICH IS WHY "exit 1 if any
// verdict is false" WOULD BE THE SAME BUG POINTING THE OTHER WAY. The buggy pass is
// SUPPOSED to fail both; a script that reddened on it would break the two-capture
// workflow AND would still exit 0 on the day the buggy build quietly stopped being
// buggy — the half nobody would notice. Pinning both halves is the honest close.
const EXPECT = { buggy: false, fixed: true };
const expected = EXPECT[LABEL];   // undefined for ad-hoc labels — then nothing is pinned
const failures = [];
function verdict(step, result) {
  const ok = result && typeof result === "object" ? result.ok : undefined;
  if (expected === undefined) {
    console.log(`  VERDICT ${step} -> ok=${ok}  (label "${LABEL}" pins nothing)`);
    return ok;
  }
  if (ok !== expected) failures.push(`${step}: expected ok=${expected} for the "${LABEL}" build, got ${JSON.stringify(ok)}`);
  console.log(`  VERDICT ${step} -> ok=${ok}  expected ${expected}  ${ok === expected ? "✓" : "🔴 MISMATCH"}`);
  return ok;
}

async function main() {
  const transport = new StdioClientTransport({
    command: "node", args: [DIST], cwd: HOST_DIR,
    env: { ...process.env, GODOT_BIN, GODOT_PROJECT, BREAKPOINT_PRIVILEGED_GROUPS: "code-execution" },
    stderr: "ignore",
  });
  const client = new Client({ name: "gcb-demo-verify", version: "1.0.0" }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async () => ({ action: "accept", content: { proceed: true } }));
  await client.connect(transport);
  const t = (name, args = {}) => client.callTool({ name, arguments: args }, undefined, { timeout: 60000 });

  // run the demo scene as a managed process (captured console)
  const runRes = S(await t("godot_run_managed", { scene: "res://demo/demo.tscn" }));
  rec("run", "godot_run_managed", { scene: "res://demo/demo.tscn" }, runRes);
  const id = runRes && runRes.id;
  if (!id) { console.log("no managed id — aborting"); await client.close(); process.exit(1); }

  // wait for the runtime bridge to answer (boot + _ready loop complete)
  let ice = null;
  for (let i = 0; i < 30; i++) {
    await sleep(600);
    try {
      const g = S(await t("runtime_get_property", { path: ".", property: "ice" }));
      if (g && g.value !== undefined && !g.isError) { ice = g.value; break; }
    } catch { /* not up yet */ }
  }
  rec("final ice", "runtime_get_property", { path: ".", property: "ice" }, { value: ice });
  rec("final grew_ever", "runtime_get_property", { path: ".", property: "grew_ever" },
    S(await t("runtime_get_property", { path: ".", property: "grew_ever" })));

  // ASSERT 1 — the ice NEVER grew on a warm spell
  const a1 = S(await t("runtime_assert_node_state", { path: ".", expect: { grew_ever: false } }));
  rec("assert grew_ever==false", "runtime_assert_node_state",
    { path: ".", expect: { grew_ever: false } }, a1);
  verdict("assert grew_ever==false", a1);

  // ASSERT 2 — the finish condition fires when ice <= 0
  const a2 = S(await t("runtime_assert_screen_text", { text: "ALL MELTED" }));
  rec('assert screen "ALL MELTED"', "runtime_assert_screen_text", { text: "ALL MELTED" }, a2);
  verdict('assert screen "ALL MELTED"', a2);

  // captured console — the trajectory + (fixed only) the ALL MELTED line
  const console_out = S(await t("godot_output", { id }));
  rec("captured console", "godot_output", { id }, console_out);

  rec("teardown", "godot_stop", { id }, S(await t("godot_stop", { id })));

  writeFileSync(path.join(HOST_DIR, `demo_verify_${LABEL}.json`), redact(JSON.stringify(out, null, 2)));
  console.log(`\n=== wrote demo_verify_${LABEL}.json ===`);
  await client.close();
  // The capture is written FIRST and is byte-identical to what this script always
  // produced; only the exit status is new. A failed verdict must still leave the
  // transcript on disk — that transcript is the evidence for what went wrong.
  for (const f of failures) console.error(`🔴 VERDICT_MISMATCH ${f}`);
  console.log(`VERIFY_CLOSE label=${LABEL} verdicts=2 mismatches=${failures.length}`);
  process.exit(failures.length ? 1 : 0);
}
main().catch((e) => { console.error("[verify] FATAL:", (e && e.stack) || e); process.exit(1); });

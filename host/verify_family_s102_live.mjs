#!/usr/bin/env node
// verify_family_s102_live.mjs — LIVE runtime pass for the verification family.
// Confirms slice 3.1 (assert_node_state / assert_scene_structure) + the three
// s102 slices (assert_perf, assert_screen_text, screenshot_diff) against a real
// running game over the socketed runtime autoload — the one thing static + headless
// can't do. Boots the example project as a managed child so the host stays alive.
//
//   Prereq: on the feat/verify-family-s102 branch (or after applying the patches),
//           then:  cd host && npm run build && node verify_family_s102_live.mjs
//   Prereq: close any other running game first so port 9081 is free.
//   Optional: SCREEN_TEXT="..." to assert your own on-screen string
//             (default matches the ReadyLabel scene-edit block in the handoff).

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";

const HOST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HOST_DIR, "..");
const DIST = path.join(HOST_DIR, "dist", "index.js");
const GODOT_PROJECT = process.env.GODOT_PROJECT || path.join(REPO, "example");
const GODOT_BIN = process.env.GODOT_BIN || "godot";
const SCREEN_TEXT = process.env.SCREEN_TEXT || "READY PLAYER ONE";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (_k, v) => (typeof v === "string" && v.length > 120 ? `«${v.length} chars»` : v);
const S = (res) => (res && res.structuredContent ? res.structuredContent : res);
function log(label, val) { console.log(`\n=== ${label} ===`); console.log(JSON.stringify(val, short, 2)); }

// --- minimal dependency-free PNG writer (solid color) for the mismatch reference ---
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
  return (~c) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function makePng(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const row = Buffer.alloc(1 + w * 4);
  for (let x = 0; x < w; x++) { row[1 + x * 4] = rgba[0]; row[2 + x * 4] = rgba[1]; row[3 + x * 4] = rgba[2]; row[4 + x * 4] = rgba[3]; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}

async function main() {
  const transport = new StdioClientTransport({
    command: "node", args: [DIST], cwd: HOST_DIR,
    env: { ...process.env, GODOT_BIN, GODOT_PROJECT }, stderr: "inherit",
  });
  const client = new Client({ name: "gcb-verify-s102", version: "1.0.0" }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async () => ({ action: "accept", content: { proceed: true } }));
  await client.connect(transport);
  const t = (name, args = {}) => client.callTool({ name, arguments: args }, undefined, { timeout: 60000 });
  const summary = {};
  const REF = path.join(GODOT_PROJECT, "verify_ref.png");
  const REF_SMALL = path.join(GODOT_PROJECT, "verify_ref_small.png");

  // boot the game as a managed child, then wait for the runtime bridge to answer
  const runRes = S(await t("godot_run_managed", {}));
  log("godot_run_managed", runRes);
  const id = runRes && runRes.id;
  if (!id) { console.log("no managed id — aborting"); await client.close(); process.exit(1); }
  let up = false;
  for (let i = 0; i < 30; i++) {
    await sleep(600);
    try {
      const g = S(await t("runtime_get_property", { path: ".", property: "counter" }));
      if (g && g.value !== undefined && !g.isError) { up = true; break; }
    } catch { /* not up yet */ }
  }
  summary["bridge up"] = up;

  // --- slice 3.1 — assert_node_state / assert_scene_structure (re-confirm live) ---
  const ns = S(await t("runtime_assert_node_state", { path: ".", expect: { counter: 100 } }));
  log("3.1 assert_node_state {counter:100}", ns);
  summary["3.1 node_state ok"] = ns.ok === true && Array.isArray(ns.mismatches) && ns.mismatches.length === 0;

  const nsBad = S(await t("runtime_assert_node_state", { path: ".", expect: { counter: 999 } }));
  summary["3.1 node_state reports mismatch"] = nsBad.ok === false && nsBad.mismatches.length === 1;

  const ss = S(await t("runtime_assert_scene_structure", {
    expect: [{ path: ".", type: "Node2D" }, { path: "Sprite2D", type: "Sprite2D" }, { path: "NoSuchNode", absent: true }],
  }));
  log("3.1 assert_scene_structure", ss);
  summary["3.1 scene_structure ok"] = ss.ok === true && ss.failures.length === 0;

  // --- slice 3.4 — assert_perf: capture a live baseline, assert pass; force a regression ---
  const mon = S(await t("runtime_get_monitors", {}));
  const nodeCount = mon.monitors["object/node_count"];
  const passPerf = S(await t("runtime_assert_perf", {
    baseline: { "object/node_count": nodeCount }, tolerance: 0.1,
  }));
  log("3.4 assert_perf (stable baseline)", passPerf);
  summary["3.4 perf passes on live baseline"] = passPerf.ok === true && passPerf.regressions.length === 0;

  const regPerf = S(await t("runtime_assert_perf", { baseline: { "time/fps": 100000 } }));
  log("3.4 assert_perf (impossible fps baseline)", regPerf);
  summary["3.4 perf flags a regression"] =
    regPerf.ok === false && regPerf.regressions[0] &&
    regPerf.regressions[0].key === "time/fps" && regPerf.regressions[0].direction === "higher_better";

  // --- slice 3.2 — assert_screen_text: absence always valid; positive needs on-screen text ---
  const absent = S(await t("runtime_assert_screen_text", { text: "ZZZ_NO_SUCH_TEXT_9137", present: false }));
  log("3.2 assert_screen_text (absence)", absent);
  summary["3.2 screen_text absence ok"] = absent.ok === true && absent.matches === 0;

  const present = S(await t("runtime_assert_screen_text", { text: SCREEN_TEXT }));
  log(`3.2 assert_screen_text (present: "${SCREEN_TEXT}")`, present);
  summary[`3.2 screen_text finds "${SCREEN_TEXT}"`] =
    present.ok === true && present.matches >= 1
      ? true
      : `NO MATCH — add the ReadyLabel scene edit, or set SCREEN_TEXT to text on screen`;

  // --- slice 3.3 — screenshot_diff: capture frame -> reference; diff self; force mismatch ---
  const shot = await t("runtime_screenshot", {});
  const img = ((shot && shot.content) || []).find((c) => c.type === "image");
  if (img && img.data) {
    fs.writeFileSync(REF, Buffer.from(img.data, "base64"));
    const self = S(await t("runtime_screenshot_diff", { reference: "res://verify_ref.png", tolerance: 0.05 }));
    log("3.3 screenshot_diff (vs itself)", self);
    summary["3.3 diff self ~0 & stats present"] =
      typeof self.diff_ratio === "number" && self.total_pixels > 0 && self.width > 1 && self.diff_ratio <= 0.05;

    fs.writeFileSync(REF_SMALL, makePng(2, 2, [255, 0, 0, 255]));
    const mismatch = S(await t("runtime_screenshot_diff", { reference: "res://verify_ref_small.png" }));
    log("3.3 screenshot_diff (size mismatch)", mismatch);
    summary["3.3 diff reports dimension_mismatch"] = mismatch.ok === false && mismatch.reason === "dimension_mismatch";
  } else {
    summary["3.3 screenshot captured"] = "NO IMAGE — cannot test screenshot_diff";
  }

  // cleanup refs + teardown
  for (const f of [REF, REF_SMALL]) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
  log("teardown — godot_stop", S(await t("godot_stop", { id })));

  console.log("\n=== SUMMARY (verification family live pass) ===");
  console.log(JSON.stringify(summary, null, 2));
  const failures = Object.entries(summary).filter(([, v]) => v !== true);
  console.log(failures.length ? `\n✗ ${failures.length} check(s) not green` : "\n✓ ALL GREEN");
  await client.close();
  process.exit(failures.length ? 1 : 0);
}
main().catch((e) => { console.error("[verify] FATAL:", (e && e.stack) || e); process.exit(1); });

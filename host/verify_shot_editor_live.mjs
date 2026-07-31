#!/usr/bin/env node
// verify_shot_editor_live.mjs — screenshot_editor against a REAL GPU (session 147).
//
// WHY THIS EXISTS. screenshot_editor's only live coverage is the AUTH_SHOT_* family
// in test-integration/authoring-plane.integration.mjs, which runs under Xvfb + Mesa
// llvmpipe. That proves the capture path executes on a rasterizer that draws — but
// an Xvfb screen is ALWAYS content-scale 1.0. Two properties of this tool are
// therefore untestable in CI by construction:
//
//   1. Whether img.get_width() reports LOGICAL or PHYSICAL pixels on a HiDPI
//      display. The addon takes the dims straight off the captured Image, and the
//      host's viewport_not_rendered guard compares THOSE numbers against
//      MIN_RENDERED_VIEWPORT_PX = 8. If the dims are physical, the guard's margin
//      is multiplied by the display scale — and the 2x2 collapsed placeholder it
//      exists to reject grows with it.
//   2. Whether SubViewport.get_texture().get_image() reads back at all under
//      Metal, which is what every macOS user is on and no CI job touches.
//
// This harness answers both on real hardware. It is READ-ONLY and fully
// idempotent — screenshot_editor mutates nothing, so unlike the authoring probe
// this leaves example/ clean and can be re-run without a git checkout.
//
// NO privileged groups needed: screenshot_editor and godot_launch_editor are both
// in the 276-tool secure default (checked against TOOL_CAPABILITIES, session 147).
// Do NOT add BREAKPOINT_PRIVILEGED_GROUPS here — if a call ever reports
// "-32602 ... not found", re-check capabilities.ts before believing it (146 §5).
//
// Run from host/:  GODOT_BIN=/Applications/Godot.app/Contents/MacOS/Godot \
//                  node verify_shot_editor_live.mjs
// A real editor window WILL open. That is the point.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { decodePng, sampleDistinctColours } from "./test-integration/_png.mjs";

const HOST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HOST_DIR, "..");
const DIST = path.join(HOST_DIR, "dist", "index.js");
const GODOT_PROJECT = process.env.GODOT_PROJECT || path.join(REPO, "example");
const GODOT_BIN = process.env.GODOT_BIN || "godot";
const MIN_RENDERED_VIEWPORT_PX = 8; // mirrors host/src/tools/editor/introspection.ts
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = { pass: [], fail: [] };
const pass = (m, d = "") => { results.pass.push(m); console.log(`SHOT_LIVE_${m} ok ${d}`); };
const fail = (m, d = "") => { results.fail.push(m); console.log(`SHOT_LIVE_${m} FAIL ${d}`); };

/** Pull "measured WxH" out of a viewport_not_rendered message. */
function measuredFromError(text) {
  const m = /measured (\d+)x(\d+)/.exec(text || "");
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
}

async function shoot(client, viewport) {
  const raw = await client.callTool(
    { name: "screenshot_editor", arguments: { viewport } }, undefined, { timeout: 60000 });
  const text = (raw.content || []).find((c) => c.type === "text")?.text || "";
  const img = (raw.content || []).find((c) => c.type === "image");
  const dims = /\((\d+)x(\d+)\)/.exec(text);
  return {
    isError: !!raw.isError,
    text,
    img,
    reported: dims ? { w: Number(dims[1]), h: Number(dims[2]) } : null,
    bytes: img ? Buffer.from(img.data || "", "base64") : null,
  };
}

async function main() {
  const transport = new StdioClientTransport({
    command: "node", args: [DIST], cwd: HOST_DIR,
    env: { ...process.env, GODOT_BIN, GODOT_PROJECT }, stderr: "inherit",
  });
  const client = new Client({ name: "gcb-shot-live", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  console.log("# launching the editor (real window, real GPU) …");
  await client.callTool({ name: "godot_launch_editor", arguments: {} }, undefined, { timeout: 60000 });
  let up = false;
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    try {
      const r = await client.callTool({ name: "editor_ping", arguments: {} }, undefined, { timeout: 5000 });
      if (r.structuredContent?.pong) { up = true; break; }
    } catch { /* not up yet */ }
  }
  if (!up) {
    console.log("!! editor bridge never answered on :9080 — another editor open, or plugin disabled? Aborting.");
    await client.close();
    process.exit(1);
  }
  const state = await client.callTool({ name: "editor_get_state", arguments: {} }, undefined, { timeout: 15000 });
  console.log(`# bridge ready · godot ${state.structuredContent?.godot || "?"}`);

  // Let the viewport draw a few frames before reading it back.
  await sleep(2000);

  // ---- Which tab is live? On CI a fresh editor boots on 3D; on a developer's
  // machine the SAVED LAYOUT decides, so we must not assume. Capture both and let
  // the results say which one rendered.
  const shot3d = await shoot(client, "3d");
  const shot2d = await shoot(client, "2d");
  console.log(`#   3d -> ${shot3d.isError ? "ERROR " + shot3d.text.slice(0, 90) : `ok ${shot3d.reported?.w}x${shot3d.reported?.h}`}`);
  console.log(`#   2d -> ${shot2d.isError ? "ERROR " + shot2d.text.slice(0, 90) : `ok ${shot2d.reported?.w}x${shot2d.reported?.h}`}`);

  const live = !shot3d.isError && shot3d.img ? shot3d : (!shot2d.isError && shot2d.img ? shot2d : null);
  const liveName = live === shot3d ? "3d" : "2d";
  const dead = live === shot3d ? shot2d : shot3d;
  const deadName = liveName === "3d" ? "2d" : "3d";

  if (!live) {
    fail("CAPTURE", `NEITHER viewport returned a frame — 3d: ${shot3d.text.slice(0, 80)} | 2d: ${shot2d.text.slice(0, 80)}`);
    console.log("\n!! Under Metal the capture path did not execute at all. This is the finding.");
  } else {
    pass("CAPTURE", `${liveName} viewport ${live.reported?.w}x${live.reported?.h} png_bytes=${live.bytes.length}`);

    live.img.mimeType === "image/png"
      ? pass("MIME", live.img.mimeType) : fail("MIME", String(live.img.mimeType));

    live.bytes.length > 1024
      ? pass("BYTES", `${live.bytes.length}B`)
      : fail("BYTES", `${live.bytes.length}B — too small to be a real frame`);

    const isPng = live.bytes[0] === 0x89 && live.bytes[1] === 0x50 &&
                  live.bytes[2] === 0x4e && live.bytes[3] === 0x47;
    isPng ? pass("MAGIC") : fail("MAGIC", `first bytes ${[...live.bytes.slice(0, 4)].join(",")}`);

    (live.reported && live.reported.w >= 64 && live.reported.h >= 64)
      ? pass("DIMS", `${live.reported.w}x${live.reported.h}`)
      : fail("DIMS", `${live.text || "(no note)"} — not a rendered viewport`);

    // Below this line the payload is actually opened. Same two assertions the
    // AUTH_SHOT family makes in CI, deliberately sharing _png.mjs so the Metal run
    // and the llvmpipe run are comparable rather than merely both green.
    const decoded = decodePng(live.bytes);
    if (!decoded) {
      fail("IHDR", `payload did not decode as an 8-bit PNG (${live.bytes.length}B)`);
      fail("DRAWN", "no decode, so the frame's content is unknown");
    } else {
      (live.reported && decoded.width === live.reported.w && decoded.height === live.reported.h)
        ? pass("IHDR", `payload ${decoded.width}x${decoded.height} matches the reported dims`)
        : fail("IHDR", `payload is ${decoded.width}x${decoded.height} but the tool reported ${live.reported?.w}x${live.reported?.h}`);
      // A correctly-sized, correctly-labelled, entirely BLACK frame satisfies every
      // assertion above. Under Metal that is the plausible failure — a driver that
      // initialises and hands back an empty texture — so this is the one that makes
      // the run worth doing.
      const shades = sampleDistinctColours(decoded);
      shades.distinct > 1
        ? pass("DRAWN", `${shades.distinct} distinct colours over ${shades.sampled} sampled px`)
        : fail("DRAWN", `the frame is a single flat colour over ${shades.sampled} sampled px — the rasterizer drew nothing`);
    }
  }

  // ---- THE HiDPI / GUARD-MARGIN QUESTION, which llvmpipe cannot pose.
  // The inactive tab's viewport is Godot's minimum-size placeholder. On an Xvfb
  // screen (scale 1.0) that measures 2x2 and the 8px guard rejects it with 4x of
  // headroom. If these dims are PHYSICAL pixels, the same placeholder measures
  // 2*scale — and the headroom shrinks by exactly that factor.
  if (dead.isError) {
    const m = measuredFromError(dead.text);
    if (/viewport_not_rendered/.test(dead.text)) {
      pass("INACTIVE_REFUSED", `${deadName} tab · ${dead.text.match(/measured \d+x\d+/)?.[0] || "(dims not named)"}`);
    } else {
      fail("INACTIVE_REFUSED", `${deadName} errored, but not with viewport_not_rendered: ${dead.text.slice(0, 120)}`);
    }
    if (m) {
      const worst = Math.max(m.w, m.h);
      const headroom = MIN_RENDERED_VIEWPORT_PX / worst;
      console.log(`SHOT_LIVE_GUARD_MARGIN placeholder=${m.w}x${m.h} threshold=${MIN_RENDERED_VIEWPORT_PX} headroom=${headroom.toFixed(2)}x`);
      worst < MIN_RENDERED_VIEWPORT_PX
        ? pass("GUARD_BITES", `${worst}px < ${MIN_RENDERED_VIEWPORT_PX}px · headroom ${headroom.toFixed(2)}x`)
        : fail("GUARD_BITES", `placeholder measured ${worst}px, at or above the ${MIN_RENDERED_VIEWPORT_PX}px threshold`);
    } else {
      fail("GUARD_BITES", "the error did not name the measured dims — cannot size the margin");
    }
  } else if (dead.img) {
    // Both tabs live is legitimate (a split layout, or the editor drew both).
    pass("INACTIVE_REFUSED", `${deadName} tab was ALSO live — real frame ${dead.reported?.w}x${dead.reported?.h}`);
    console.log("SHOT_LIVE_GUARD_MARGIN not measurable — no collapsed viewport on this layout");
  } else {
    fail("INACTIVE_REFUSED", `${deadName}: neither a frame nor viewport_not_rendered: ${dead.text.slice(0, 120)}`);
  }

  const total = results.pass.length + results.fail.length;
  console.log(`\nSHOT_LIVE_SUMMARY pass=${results.pass.length}/${total} fail=${results.fail.length}${results.fail.length ? " -> " + results.fail.join(", ") : ""}`);
  await client.close();
  process.exit(results.fail.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

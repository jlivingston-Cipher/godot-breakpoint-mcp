// Runtime-render-plane integration probe — drives `runtime_screenshot` and
// `runtime_screenshot_diff` against a REAL running game rendered by a REAL
// rasterizer (Xvfb + Mesa llvmpipe in CI; Metal/Vulkan on a maintainer's Mac).
//
// WHY THIS EXISTS
// ---------------
// Until this probe, the three pixel-producing tools had zero live coverage
// (RENDER_PATH_COVERAGE_GAP_2026-07-30 §1). #138 closed the EDITOR half by
// running the addon unit suite under Xvfb + llvmpipe instead of `--headless`.
// This is the other half: `runtime_screenshot_diff` needs a *running game*, not
// a `--script` run, so it cannot ride on that job.
//
// The handoffs recorded this as "the one thing CI structurally cannot do". That
// was the same error the coverage-gap doc's §2 made and #138 disproved: what
// blocks the capture is the DUMMY DRIVER selected by `--headless`, not the
// absent GPU. Drop `--headless`, keep `LIBGL_ALWAYS_SOFTWARE=1`, and get_image()
// works. This probe is that correction, executed.
//
// WHAT MAKES IT COVERAGE RATHER THAN GREEN
// ----------------------------------------
// A diff of a uniform frame against a uniform reference returns 0 whether or not
// the comparison ever reads a pixel. res://main.tscn produces exactly that (its
// Sprite2D has no texture), so this probe boots res://tests/render_probe.tscn —
// a 400x400 opaque red patch on the default clear colour — and toggles
// `Patch.visible` to move a KNOWN, BOUNDED set of pixels:
//
//   full frame, patch hidden -> 0 < diff_ratio < 1        (a PART of the frame moved)
//   region inside the patch  -> diff_ratio == 1.0         (all of it moved)
//   region outside the patch -> diff_ratio == 0.0         (none of it moved)
//
// Those three cannot all hold for an implementation that returns a constant, and
// the last one cannot hold for one that reports everything as different. Every
// assertion here fails loudly rather than skipping: a degraded capture is the
// defect this job exists to catch, so `no_image` / `no_texture` is an ERROR, not
// a SKIP — the same premise-assertion the `render-plane` job makes.
//
// Markers (grep-able): RENDER_LIVE_PING / _SCENE / _CAPTURE / _SELF / _CHANGE /
// _REGION_IN / _REGION_OUT / _RESTORE / _MISMATCH / _BADREF / _RESULT.
//
// Requires the render-probe scene running with GODOT_PROJECT set. Not part of
// `npm test` (Godot-free); invoked directly by integration.yml.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { BridgeClient } from "../dist/bridge.js";
import { loadConfig } from "../dist/config.js";
import { registerRuntimeTools } from "../dist/tools/runtime.js";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const cfg = loadConfig();
const PROJECT = cfg.projectPath;
const REF = path.join(PROJECT, "_render_probe_ref.png");
const REF_SMALL = path.join(PROJECT, "_render_probe_ref_small.png");
const REF_RES = "res://_render_probe_ref.png";
const REF_SMALL_RES = "res://_render_probe_ref_small.png";
const MISSING_RES = "res://_render_probe_no_such_reference_9137.png";

console.log(`render-runtime probe -> runtime bridge ${cfg.runtimeHost}:${cfg.runtimePort}  project=${PROJECT}`);

// ---------------------------------------------------------------- helpers ---

/** Minimal dependency-free PNG writer (solid colour) for the dimension-mismatch reference. */
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function makePng(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // 8-bit RGBA
  const row = Buffer.alloc(1 + w * 4);
  for (let x = 0; x < w; x++) {
    row[1 + x * 4] = rgba[0];
    row[2 + x * 4] = rgba[1];
    row[3 + x * 4] = rgba[2];
    row[4 + x * 4] = rgba[3];
  }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}

/**
 * Read width/height straight out of the PNG header. Deliberately NOT a decode:
 * the point is to check the returned bytes really are a PNG whose own header
 * agrees with the dimensions the tool reported, independently of the engine.
 */
function pngHeader(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(buf.length > 24, "returned image is too short to be a PNG");
  assert.ok(buf.subarray(0, 8).equals(sig), "returned image does not start with the PNG signature");
  assert.equal(buf.subarray(12, 16).toString("ascii"), "IHDR", "first PNG chunk is not IHDR");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function cleanup() {
  for (const f of [REF, REF_SMALL]) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
}

/** Fail the job with a GitHub-annotated message and leave no reference files behind. */
function die(message) {
  cleanup();
  console.error(`::error::${message}`);
  try {
    runtime.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
}

// -------------------------------------------------------------- the wiring ---

// Register the runtime tools against a live runtime BridgeClient, exactly the way
// index.ts wires Plane C — so the host<->engine path is exercised end to end, not
// just the raw socket. elicitInput is never reached (every mutation passes confirm).
const runtime = new BridgeClient(cfg.runtimeHost, cfg.runtimePort, 15000, "runtime bridge", "Is the render probe scene running?");
const tools = new Map();
const server = {
  registerTool: (name, _c, handler) => tools.set(name, handler),
  registerResource: () => {},
  server: { elicitInput: async () => ({ action: "decline" }) },
};
// Single-game by construction: no call below passes `peer`, so a registry that
// refuses to be reached turns a later edit that forgets that into a sentence
// naming the cause rather than a TypeError on `undefined`.
const noPeers = Object.fromEntries(
  ["clientFor", "spawn", "stop", "stopAll", "live", "all"].map((m) => [
    m,
    () => {
      throw new Error(`this probe is single-game: peers.${m}() must not be reached (no call here passes 'peer')`);
    },
  ]),
);
registerRuntimeTools(server, runtime, noPeers);

const raw = async (name, args = {}) => {
  const h = tools.get(name);
  if (!h) throw new Error(`tool not registered: ${name}`);
  return h(args, {});
};
const call = async (name, args = {}) => {
  const res = await raw(name, args);
  if (res.isError) throw new Error(res.content?.[0]?.text ?? `tool ${name} failed`);
  return res.structuredContent ?? {};
};
const diff = (args) => call("runtime_screenshot_diff", args);

// ------------------------------------------------------------------- gate ---

try {
  await runtime.ensureConnected();
  const pong = await runtime.request("ping", {}, 20000);
  console.log(`RENDER_LIVE_PING ok runtime=${pong?.runtime} godot=${pong?.godot ?? "?"}`);
} catch (err) {
  die(`could not reach the runtime bridge: ${err?.message ?? String(err)}`);
}

// The premise of every later assertion: the RENDER PROBE scene is what booted,
// not res://main.tscn. main.tscn renders one flat colour, against which a diff
// of 0 would be meaningless — so a wrong scene must fail here, not pass quietly
// three assertions later.
const structure = await call("runtime_assert_scene_structure", {
  expect: [
    { path: ".", type: "Node2D" },
    { path: "Patch", type: "ColorRect" },
  ],
});
if (structure.ok !== true) {
  die(
    `the render probe scene is not the running scene (${JSON.stringify(structure.failures)}) — ` +
      `boot with 'res://tests/render_probe.tscn'; a diff against a uniform frame proves nothing`,
  );
}
console.log("RENDER_LIVE_SCENE ok render_probe.tscn is live");

// ---------------------------------------------------- 1. capture a frame ---

// THE assertion this whole job exists for. Under `--headless` the dummy driver
// has no viewport texture and this errors with no_texture / no_image — which is
// a graceful degradation everywhere else in the repo and a HARD FAILURE here.
const shotRes = await raw("runtime_screenshot", {});
if (shotRes.isError) {
  const text = shotRes.content?.[0]?.text ?? "(no text)";
  if (/no_image|no_texture/.test(text)) {
    die(`the capture path did not execute (${text}) — this job proved nothing. Booted with --headless?`);
  }
  die(`runtime_screenshot failed: ${text}`);
}
const image = (shotRes.content ?? []).find((c) => c.type === "image");
if (!image?.data) die("runtime_screenshot returned no image content — this job proved nothing");
assert.equal(image.mimeType, "image/png", "runtime_screenshot should return image/png");

const bytes = Buffer.from(image.data, "base64");
const header = pngHeader(bytes);
const { width: W, height: H } = header;

// #139 shipped because a 2x2 placeholder counted as a successful capture. A frame
// that small is not a frame, whatever the tool says about it.
assert.ok(W > 2 && H > 2, `captured frame is ${W}x${H} — a degenerate placeholder, not a rendered frame`);
// The regions below are computed from W/H rather than hardcoded, but they still
// need a frame large enough to hold a 200px probe region outside a 400px patch.
assert.ok(W >= 640 && H >= 480, `captured frame is ${W}x${H}; this probe's regions assume at least 640x480`);
const reported = (shotRes.content ?? []).find((c) => c.type === "text")?.text ?? "";
assert.ok(reported.includes(`${W}x${H}`), `the tool reported "${reported}" but the PNG header says ${W}x${H}`);
console.log(`RENDER_LIVE_CAPTURE ok ${W}x${H} png_bytes=${bytes.length}`);

// Establish the reference from the frame just captured. res:// maps to the
// project directory in a run-from-source project, so the addon's Image.load()
// reads exactly these bytes back.
fs.writeFileSync(REF, bytes);
fs.writeFileSync(REF_SMALL, makePng(2, 2, [255, 0, 0, 255]));

try {
  // ------------------------------------------- 2. diff a frame with itself ---

  // The scene is static (no _process animation, no script at all), so successive
  // frames are pixel-identical and tolerance 0 is the honest assertion.
  const self = await diff({ reference: REF_RES, tolerance: 0 });
  assert.equal(self.ok, true, `a static frame should match its own reference exactly, got ${JSON.stringify(self)}`);
  assert.equal(self.differing_pixels, 0, "a static frame should have zero differing pixels against itself");
  assert.equal(self.diff_ratio, 0, "a static frame should diff at ratio 0 against itself");
  assert.equal(self.total_pixels, W * H, `total_pixels should be ${W * H} for a ${W}x${H} frame`);
  assert.equal(self.width, W, "diff width should match the captured frame");
  assert.equal(self.height, H, "diff height should match the captured frame");
  console.log(`RENDER_LIVE_SELF ok ratio=${self.diff_ratio} total=${self.total_pixels}`);

  // ------------------------------------ 3. change known pixels, diff again ---

  await call("runtime_set_property", { path: "Patch", property: "visible", value: false, confirm: true });

  // Poll rather than sleep: llvmpipe's frame rate is not something to guess at,
  // and a fixed delay is the usual source of a flaky render test.
  let changed = null;
  for (let i = 0; i < 40; i++) {
    await delay(250);
    changed = await diff({ reference: REF_RES, tolerance: 0 });
    if (changed.differing_pixels > 0) break;
  }
  if (!changed || changed.differing_pixels === 0) {
    die("hiding the 400x400 patch changed no pixels — the diff is not reading the live frame");
  }
  // A 400x400 patch inside the frame: some of it moved, not all of it. Both
  // bounds matter — "everything differs" is the signature of a broken capture,
  // not of a hidden patch.
  const expected = (400 * 400) / (W * H);
  assert.equal(changed.ok, false, "a changed frame must not pass at tolerance 0");
  assert.ok(changed.diff_ratio > 0 && changed.diff_ratio < 1, `expected a partial-frame change, got ratio ${changed.diff_ratio}`);
  assert.ok(
    Math.abs(changed.diff_ratio - expected) < 0.02,
    `hiding a 400x400 patch in a ${W}x${H} frame should move ~${expected.toFixed(4)} of the pixels, got ${changed.diff_ratio}`,
  );
  console.log(`RENDER_LIVE_CHANGE ok ratio=${changed.diff_ratio.toFixed(4)} expected~${expected.toFixed(4)} differing=${changed.differing_pixels}`);

  // ------------------------------------------------- 4. region cropping ------

  // Fully inside the patch: every pixel in the region changed.
  const inside = await diff({ reference: REF_RES, tolerance: 0, region: { x: 0, y: 0, w: 200, h: 200 } });
  assert.equal(inside.total_pixels, 200 * 200, "a 200x200 region should compare 40000 pixels");
  assert.equal(inside.diff_ratio, 1, `every pixel inside the hidden patch should differ, got ${inside.diff_ratio}`);
  assert.equal(inside.ok, false, "a fully-changed region must not pass at tolerance 0");
  console.log(`RENDER_LIVE_REGION_IN ok ratio=${inside.diff_ratio} total=${inside.total_pixels}`);

  // Fully outside the patch, in the opposite corner: nothing there changed.
  // THIS is the assertion a constant-returning diff cannot satisfy alongside the
  // one above — one demands 1.0 and the other 0.0 from the same call shape.
  const outside = await diff({ reference: REF_RES, tolerance: 0, region: { x: W - 200, y: H - 200, w: 200, h: 200 } });
  assert.equal(outside.total_pixels, 200 * 200, "a 200x200 region should compare 40000 pixels");
  assert.equal(outside.differing_pixels, 0, `no pixel outside the patch should differ, got ${outside.differing_pixels}`);
  assert.equal(outside.diff_ratio, 0, "a region outside the change should diff at ratio 0");
  assert.equal(outside.ok, true, "an unchanged region should pass at tolerance 0");
  console.log(`RENDER_LIVE_REGION_OUT ok ratio=${outside.diff_ratio} total=${outside.total_pixels}`);

  // ------------------------------------------------- 5. restore and re-diff --

  await call("runtime_set_property", { path: "Patch", property: "visible", value: true, confirm: true });
  let restored = null;
  for (let i = 0; i < 40; i++) {
    await delay(250);
    restored = await diff({ reference: REF_RES, tolerance: 0 });
    if (restored.differing_pixels === 0) break;
  }
  assert.equal(restored?.differing_pixels, 0, "restoring the patch should return the frame to the reference exactly");
  assert.equal(restored.ok, true, "the restored frame should pass at tolerance 0");
  console.log(`RENDER_LIVE_RESTORE ok ratio=${restored.diff_ratio}`);

  // ------------------------------------------- 6. the documented sad paths ---

  const mismatch = await diff({ reference: REF_SMALL_RES });
  assert.equal(mismatch.ok, false, "a 2x2 reference must not pass against a full frame");
  assert.equal(mismatch.reason, "dimension_mismatch", `expected dimension_mismatch, got ${JSON.stringify(mismatch)}`);
  assert.equal(mismatch.total_pixels, 0, "a dimension mismatch compares no pixels");
  assert.equal(mismatch.width, W, "a dimension mismatch still reports the frame's own width");
  console.log(`RENDER_LIVE_MISMATCH ok reason=${mismatch.reason}`);

  const badRef = await raw("runtime_screenshot_diff", { reference: MISSING_RES });
  assert.equal(badRef.isError, true, "diffing against a missing reference should be an error, not a pass");
  assert.match(
    badRef.content?.[0]?.text ?? "",
    /bad_reference/,
    `a missing reference should report bad_reference, got ${badRef.content?.[0]?.text}`,
  );
  console.log("RENDER_LIVE_BADREF ok bad_reference");

  console.log(`RENDER_LIVE_RESULT frame=${W}x${H} self=0 changed=${changed.diff_ratio.toFixed(4)} region_in=1 region_out=0`);
  console.log("✔ runtime_screenshot + runtime_screenshot_diff verified against a real rasterizer");
} catch (err) {
  cleanup();
  console.error(`::error::render probe failed: ${err?.message ?? String(err)}`);
  console.error(err?.stack ?? "");
  runtime.close();
  process.exit(1);
}

cleanup();
runtime.close();
console.log("✔ runtime-render-plane integration OK");

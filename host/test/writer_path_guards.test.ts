import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerEditorTools } from "../src/tools/editor.js";
import { registerAssetGenTools } from "../src/tools/assetgen.js";
import { registerBackendTools } from "../src/tools/backend.js";
import { registerNetcodeTools } from "../src/tools/netcode.js";
import { makeRecordingServer, type ElicitFn } from "./helpers/recording-server.js";
import type { Config } from "../src/config.js";

/**
 * Session 164 — the `to_path` writer family (163 §8 item 5's sharpest cluster).
 *
 * MEASURED FIRST, against a real 4.7 editor with the addon live: TWENTY-ONE writers
 * created files OUTSIDE the project root through `res://../`, and the verdict came
 * from `stat`, not from the tools' replies — all twenty-one answered `ok` and echoed
 * the escaping path back. `filesystem_move` additionally MOVED a project file out.
 *
 * 🔴 WHY THE GUARD IS REACHABLE WITHOUT AN EDITOR: every one of these refuses BEFORE
 * the confirmation gate and before the bridge (163 §3's shape). A fake bridge that
 * THROWS on contact is therefore the sharpest possible assertion — if a guard were
 * moved behind the transport, the test would see the throw instead of the refusal.
 */

const EVIL = "example_evil"; // shares the root's name PREFIX — the sibling trap

function tmpRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "g164-"));
  const root = path.join(dir, "example");
  fs.mkdirSync(root);
  fs.mkdirSync(path.join(dir, EVIL));
  fs.mkdirSync(path.join(dir, "elsewhere"));
  return root;
}

/** A bridge that EXPLODES on contact: reaching it at all is the failure. */
const explodingBridge = {
  async request(method: string) {
    throw new Error(`the guard let ${method} reach the bridge`);
  },
};

const acceptAll: ElicitFn = async () => ({ action: "accept", content: { proceed: true } });

function harness(root: string) {
  const rec = makeRecordingServer(acceptAll);
  const cfg = { projectPath: root, assetGenBackend: "placeholder" } as unknown as Config;
  const srv = rec.server as unknown as Parameters<typeof registerEditorTools>[0];
  const br = explodingBridge as unknown as Parameters<typeof registerEditorTools>[1];
  registerEditorTools(srv, br, cfg);
  registerAssetGenTools(srv, br, cfg);
  registerBackendTools(srv, br, cfg);
  return rec;
}

const textOf = (r: { content?: Array<{ text?: string }> }) => String(r?.content?.[0]?.text ?? "");

/**
 * Every writer, with arguments that REACH the guard. 🔴 The `.gd` extension on the
 * backend four is load-bearing: `runScaffold` rejects a non-`.gd` path BEFORE the
 * guard, so a `.tres` here would assert the wrong refusal and pass for the wrong
 * reason — the shape of mistake 163 §2 spent a session's time on.
 */
const WRITERS: Array<[tool: string, param: string, mk: (p: string) => Record<string, unknown>]> = [
  // editor plane — 11 tools, 14 guarded parameters
  ["resource_create", "to_path", (p) => ({ class_name: "StyleBoxFlat", to_path: p })],
  ["resource_save", "to_path", (p) => ({ from_path: "res://a.tres", to_path: p })],
  ["resource_save", "from_path", (p) => ({ from_path: p, to_path: "res://a.tres" })],
  ["resource_duplicate", "to_path", (p) => ({ path: "res://a.tres", to_path: p })],
  ["resource_duplicate", "path", (p) => ({ path: p, to_path: "res://a.tres" })],
  ["filesystem_move", "to_path", (p) => ({ from_path: "res://a.tres", to_path: p })],
  ["filesystem_move", "from_path", (p) => ({ from_path: p, to_path: "res://a.tres" })],
  ["scene_pack", "to_path", (p) => ({ path: ".", to_path: p })],
  ["shader_create", "to_path", (p) => ({ to_path: p })],
  ["theme_create", "to_path", (p) => ({ to_path: p })],
  ["tileset_create", "to_path", (p) => ({ to_path: p })],
  ["primitive_mesh_create", "to_path", (p) => ({ to_path: p })],
  ["environment_create", "to_path", (p) => ({ to_path: p })],
  ["audio_set_bus_layout", "to_path", (p) => ({ to_path: p })],
  // assetgen — 6 tools, one shared choke point
  ["asset_gen_icon", "to_path", (p) => ({ prompt: "x", to_path: p })],
  ["asset_gen_sprite", "to_path", (p) => ({ prompt: "x", to_path: p })],
  ["asset_gen_texture", "to_path", (p) => ({ prompt: "x", to_path: p })],
  ["asset_gen_audio_sfx", "to_path", (p) => ({ prompt: "x", to_path: p })],
  ["asset_gen_model", "to_path", (p) => ({ prompt: "x", to_path: p })],
  ["asset_gen_placeholder", "to_path", (p) => ({ kind: "icon", to_path: p })],
  // backend — 4 tools, one shared scaffolder. `.gd` or the guard is never reached.
  ["backend_configure", "to_path", (p) => ({ sdk: "silentwolf", to_path: p })],
  ["leaderboard_scaffold", "to_path", (p) => ({ sdk: "silentwolf", to_path: p })],
  ["cloudsave_scaffold", "to_path", (p) => ({ sdk: "silentwolf", to_path: p })],
  ["auth_scaffold", "to_path", (p) => ({ sdk: "silentwolf", to_path: p })],
];

const ext = (tool: string) => (tool.endsWith("_scaffold") || tool === "backend_configure" ? ".gd" : ".tres");

test("every measured writer refuses a res://.. escape BY REASON, before the bridge", async () => {
  const root = tmpRoot();
  const rec = harness(root);
  for (const [tool, param, mk] of WRITERS) {
    const spelling = `res://../${EVIL}/esc${ext(tool)}`;
    const r = await rec.handler(tool)({ ...mk(spelling), confirm: true });
    assert.equal(r.isError, true, `${tool}.${param} must refuse ${spelling}`);
    assert.match(textOf(r), /outside the Godot project root/, `${tool}.${param} must refuse BY REASON`);
    assert.match(textOf(r), /path_outside_project/, `${tool}.${param} must carry the shared refusal code`);
    // The refusal names the PARAMETER, so a two-parameter tool says which one.
    assert.match(textOf(r), new RegExp(`Refusing ${param}\\b`), `${tool} must name ${param}`);
  }
});

test("the guard is INERT on every legal spelling — nothing that worked stops working", async () => {
  const root = tmpRoot();
  const rec = harness(root);
  // A bridge that RECORDS instead of exploding: a legal path must reach it, and must
  // reach it with the caller's ORIGINAL spelling — the guard rewrites nothing.
  const seen: Array<{ method: string; params: Record<string, unknown> }> = [];
  const recording = {
    async request(method: string, params: Record<string, unknown> = {}) {
      seen.push({ method, params });
      return { ok: true };
    },
  };
  const rec2 = makeRecordingServer(acceptAll);
  const cfg = { projectPath: root, assetGenBackend: "none" } as unknown as Config;
  registerEditorTools(
    rec2.server as unknown as Parameters<typeof registerEditorTools>[0],
    recording as unknown as Parameters<typeof registerEditorTools>[1],
    cfg,
  );
  void rec;

  for (const spelling of ["res://ok.tres", "res://deep/nested/ok.tres", path.join(root, "abs.tres")]) {
    seen.length = 0;
    const r = await rec2.handler("resource_create")({ class_name: "StyleBoxFlat", to_path: spelling, confirm: true });
    assert.notEqual(r.isError, true, `${spelling} must stay legal`);
    assert.equal(seen.length, 1, `${spelling} must reach the bridge`);
    assert.equal(seen[0].params.to_path, spelling, "the ORIGINAL spelling goes on the wire, unrewritten");
  }
});

test("an ABSOLUTE path inside the root stays legal; the prefix-sharing sibling does not", async () => {
  const root = tmpRoot();
  const rec = harness(root);
  // 🔴 `<root>_evil` shares the root's PREFIX. A bare startsWith(root) would pass it.
  const sibling = path.join(path.dirname(root), EVIL, "esc.tres");
  const r = await rec.handler("resource_create")({ class_name: "StyleBoxFlat", to_path: sibling, confirm: true });
  assert.equal(r.isError, true, "the prefix-sharing sibling must be refused");
  assert.match(textOf(r), /outside the Godot project root/);
});

test("an omitted OPTIONAL to_path is not refused — it has nothing to escape", async () => {
  const root = tmpRoot();
  const seen: string[] = [];
  const recording = { async request(method: string) { seen.push(method); return { ok: true }; } };
  const rec = makeRecordingServer(acceptAll);
  registerEditorTools(
    rec.server as unknown as Parameters<typeof registerEditorTools>[0],
    recording as unknown as Parameters<typeof registerEditorTools>[1],
    { projectPath: root } as unknown as Config,
  );
  const r = await rec.handler("audio_set_bus_layout")({ confirm: true });
  assert.notEqual(r.isError, true, "an omitted to_path takes the addon's default");
  assert.deepEqual(seen, ["audio.set_bus_layout"]);
});

test("the refusal is NOT dressed as a Bridge error — the bridge was never reached", async () => {
  const root = tmpRoot();
  const rec = harness(root);
  const r = await rec.handler("theme_create")({ to_path: `res://../${EVIL}/esc.tres`, confirm: true });
  assert.match(textOf(r), /^Path error \[path_outside_project\]/, "a path refusal has its own envelope");
  assert.doesNotMatch(textOf(r), /Bridge error/, "'Bridge error' means the editor is unreachable — a different repair");
});

test("EVERY writer refuses BEFORE the confirmation prompt — no approval is sought for a doomed write", async () => {
  // 🔴 THIS TEST USED TO CHECK ONE TOOL, AND THE MUTATION SWEEP CAUGHT THAT: moving
  // `theme_create`'s guard behind its gate SURVIVED, because only `resource_create`
  // was asserted. Placement is a per-call-site property, so it is asserted at every
  // call site — the "a guard is not wired until every call site is wired" rule
  // applied to the sweep's own coverage rather than only to the source.
  const root = tmpRoot();
  const asked: unknown[] = [];
  const rec = makeRecordingServer(async (req) => { asked.push(req); return { action: "accept", content: { proceed: true } }; });
  const cfg = { projectPath: root, assetGenBackend: "placeholder" } as unknown as Config;
  const srv = rec.server as unknown as Parameters<typeof registerEditorTools>[0];
  const br = explodingBridge as unknown as Parameters<typeof registerEditorTools>[1];
  registerEditorTools(srv, br, cfg);
  registerAssetGenTools(srv, br, cfg);
  registerBackendTools(srv, br, cfg);

  for (const [tool, param, mk] of WRITERS) {
    asked.length = 0;
    // No `confirm`, so a tool that reached its gate WOULD elicit.
    const r = await rec.handler(tool)(mk(`res://../${EVIL}/esc${ext(tool)}`));
    assert.equal(r.isError, true, `${tool}.${param} must refuse`);
    assert.match(textOf(r), /outside the Godot project root/, `${tool}.${param} must refuse BY REASON`);
    assert.equal(asked.length, 0, `${tool}.${param} must not ask approval for a write that can never happen`);
  }
});

test("asset_gen refuses an escape even with NO backend configured", async () => {
  // 🔴 THE ONE BEHAVIOUR CHANGE, pinned. With backend "none" an escaping to_path used
  // to answer `no_backend` carrying a `request` spec — an instruction to the CALLER to
  // write outside the project. Guarding before the backend check is also what makes
  // the refusal measurable without a generation backend at all.
  const root = tmpRoot();
  const rec = makeRecordingServer(acceptAll);
  registerAssetGenTools(
    rec.server as unknown as Parameters<typeof registerAssetGenTools>[0],
    explodingBridge as unknown as Parameters<typeof registerAssetGenTools>[1],
    { projectPath: root, assetGenBackend: "none" } as unknown as Config,
  );
  const r = await rec.handler("asset_gen_icon")({ prompt: "x", to_path: `res://../${EVIL}/esc.tres`, confirm: true });
  assert.equal(r.isError, true, "an escaping path is refused whether or not a backend exists");
  assert.match(textOf(r), /outside the Godot project root/);
  assert.doesNotMatch(textOf(r), /no_backend/, "the path is the answer, not the missing backend");
});

test("backend scaffolds refuse the escape BEFORE the SDK detector runs", async () => {
  // 🔴 The first run of this session's live probe measured `sdk_missing` sixteen times
  // and the path zero times. A guard behind a feature gate is a guard nobody can
  // measure — so the exploding bridge (which `detect()` would hit) pins the order.
  const root = tmpRoot();
  const rec = makeRecordingServer(acceptAll);
  registerBackendTools(
    rec.server as unknown as Parameters<typeof registerBackendTools>[0],
    explodingBridge as unknown as Parameters<typeof registerBackendTools>[1],
    { projectPath: root } as unknown as Config,
  );
  const r = await rec.handler("auth_scaffold")({ sdk: "silentwolf", to_path: `res://../${EVIL}/esc.gd`, confirm: true });
  assert.equal(r.isError, true);
  assert.match(textOf(r), /outside the Godot project root/);
  assert.doesNotMatch(textOf(r), /sdk_missing|not installed/, "the path is refused before the SDK is even looked up");
});

test("CARRIED — 161's netcode to_path guards are still wired, at all three call sites", async () => {
  // 🔴 FOUND BY THIS SESSION'S SWEEP, NOT BY THE MEASUREMENT. Unwiring all three of
  // netcode's `resolveInsideProject` calls left the unit suite GREEN — 161 shipped
  // those guards with live-gate coverage only, so a refactor could have deleted them
  // and no test would have said so. The gap is older than this change and is closed
  // here because the sweep is what exposed it.
  const root = tmpRoot();
  const rec = makeRecordingServer(acceptAll);
  registerNetcodeTools(
    rec.server as unknown as Parameters<typeof registerNetcodeTools>[0],
    explodingBridge as unknown as Parameters<typeof registerNetcodeTools>[1],
    { projectPath: root } as unknown as Config,
  );
  for (const tool of ["mp_setup_enet_peer", "mp_setup_webrtc_peer", "mp_scaffold_lobby"]) {
    const r = await rec.handler(tool)({ to_path: `res://../${EVIL}/esc.gd`, confirm: true });
    assert.equal(r.isError, true, `${tool} must refuse an escaping to_path`);
    assert.match(textOf(r), /outside the Godot project root/, `${tool} must refuse BY REASON`);
    assert.match(textOf(r), /path_outside_project/, `${tool} must carry the shared refusal code`);
  }
});

test("a bare relative and an absolute elsewhere are ALSO refused, by the host now rather than the addon", async () => {
  // Before this change the addon refused these two on its `begins_with("res://")`
  // check, so they were self-announcing; only `res://../` was silent. The host now
  // refuses all three uniformly, and it does so without an editor running.
  const root = tmpRoot();
  const rec = harness(root);
  for (const spelling of [`../${EVIL}/esc.tres`, path.join(path.dirname(root), "elsewhere", "esc.tres")]) {
    const r = await rec.handler("tileset_create")({ to_path: spelling, confirm: true });
    assert.equal(r.isError, true, `${spelling} must be refused`);
    assert.match(textOf(r), /outside the Godot project root/, `${spelling} must be refused BY REASON`);
  }
});

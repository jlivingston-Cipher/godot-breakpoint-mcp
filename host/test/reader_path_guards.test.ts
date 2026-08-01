import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerEditorTools } from "../src/tools/editor.js";
import { registerTabletopTools } from "../src/tools/tabletop.js";
import { registerNetcodeTools } from "../src/tools/netcode.js";
import { registerCliTools } from "../src/tools/cli.js";
import { registerProcessTools } from "../src/tools/processes.js";
import { registerRuntimeTools } from "../src/tools/runtime.js";
import { makeRecordingServer, type ElicitFn, type ToolResultLike } from "./helpers/recording-server.js";
import type { Config } from "../src/config.js";

/**
 * Session 165 — the READER family, 164 §8 item 5's other half.
 *
 * MEASURED FIRST, against a real 4.7 editor with the addon live and (for the runtime
 * rows) a game actually hosting the runtime bridge: of 35 measured parameters,
 * TWENTY-NINE reached outside the project root. Five were already guarded.
 *
 * 🔴 A READER LEAVES NO FILE TO `stat`, so 164's verdict channel does not exist here.
 * What was measured instead was a DIFFERENTIAL: the same escaping spelling pointed at
 * a file that exists out there and at one that does not. A tool that answers
 * differently has opened the outside file; a tool that answers IDENTICALLY never
 * reached the read and measured something else (a degrade path). Four rows needed a
 * channel of their own — an executed script's marker file, a launched process's argv,
 * a listing that named the outside directory's contents, and a path STORED verbatim
 * into a generated scene.
 *
 * 🔴🔴 THE SHARPEST ROW: `godot_run_headless_script` EXECUTED a script outside the
 * root. Its reply said `exit_code: 0` for the real script AND for a nonexistent one,
 * so the reply channel carried literally zero information.
 *
 * 🔴 WHY THIS IS REACHABLE WITHOUT AN EDITOR: every guard refuses before the
 * confirmation gate and before the transport, so a bridge that THROWS on contact is
 * the sharpest assertion available — reaching it at all is the failure.
 */

const EVIL = "example_evil"; // shares the root's name PREFIX — the sibling trap

function tmpRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "g165-"));
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
const textOf = (r: { content?: Array<{ text?: string }> }) => String(r?.content?.[0]?.text ?? "");

/**
 * 🔴 `godot_export` and `godot_run_headless_script` are MCP TASK tools, so they
 * register through `experimental.tasks.registerToolTask` and their handler is a
 * `{createTask,…}` object rather than a callable. `cli.test.ts` stubs that away and
 * replaces the handler with a no-op — which means the two tools' BODIES have never
 * had unit coverage, and a guard inside one of them would be untestable.
 *
 * This shim drives the REAL worker instead: `createTask` runs it and stores its
 * settled result, and the returned callable waits for that store. Without this, the
 * sharpest defect of the session (`script_path` executing an outside script) would
 * ship with live-gate coverage only — the exact gap 164 §4.2 found in the netcode
 * guards, avoided here rather than discovered two sessions later.
 */
function taskAwareServer(rec: ReturnType<typeof makeRecordingServer>) {
  const settled = new Map<string, ToolResultLike>();
  let n = 0;
  const store = {
    async createTask() { return { taskId: `t${++n}` }; },
    async storeTaskResult(taskId: string, _s: string, result: ToolResultLike) { settled.set(taskId, result); },
  };
  const srv = rec.server as unknown as Record<string, unknown>;
  srv.experimental = {
    tasks: {
      registerToolTask(name: string, _cfg: unknown, h: { createTask: (a: unknown, e: unknown) => Promise<{ task: { taskId: string } }> }) {
        rec.server.registerTool(name, {}, async (args) => {
          const { task } = await h.createTask(args, { taskStore: store });
          for (let i = 0; i < 200 && !settled.has(task.taskId); i++) await new Promise((r) => setImmediate(r));
          return settled.get(task.taskId) ?? { isError: true, content: [{ type: "text", text: "task never settled" }] };
        });
      },
    },
  };
  return rec;
}

function harness(root: string, elicit: ElicitFn = acceptAll) {
  const rec = taskAwareServer(makeRecordingServer(elicit));
  const cfg = { projectPath: root, runtimeHost: "127.0.0.1", runtimePort: 9081 } as unknown as Config;
  const srv = rec.server as unknown as Parameters<typeof registerEditorTools>[0];
  const br = explodingBridge as unknown as Parameters<typeof registerEditorTools>[1];
  registerEditorTools(srv, br, cfg);
  registerTabletopTools(srv, br, cfg);
  registerNetcodeTools(srv, br, cfg);
  registerCliTools(srv, cfg);
  registerProcessTools(srv, cfg);
  registerRuntimeTools(
    srv,
    explodingBridge as unknown as Parameters<typeof registerRuntimeTools>[1],
    { clientFor: () => explodingBridge } as unknown as Parameters<typeof registerRuntimeTools>[2],
    cfg,
  );
  return rec;
}

/**
 * Every measured-escaping reader, with arguments that REACH the guard.
 *
 * 🔴 The extensions are load-bearing in three families, the same way `.gd` was for
 * 164's backend four: `card_*`/`piece_*` reject a non-`.tscn` `path` before the
 * guard, and `test_list` takes a directory rather than a file.
 */
const READERS: Array<[tool: string, param: string, mk: (p: string) => Record<string, unknown>]> = [
  // ---- editor plane: 17 parameters across 14 tools ----
  ["audio_player_create", "stream_path", (p) => ({ parent_path: ".", stream_path: p })],
  ["audio_set_stream", "stream_path", (p) => ({ path: "./A", stream_path: p })],
  ["control_set_theme", "theme_path", (p) => ({ path: "./C", theme_path: p })],
  ["theme_set_font", "font_path", (p) => ({ path: "res://t.tres", name: "font", theme_type: "Label", font_path: p })],
  ["theme_set_stylebox", "stylebox_path", (p) => ({ path: "res://t.tres", name: "panel", theme_type: "Panel", stylebox_path: p })],
  ["meshinstance_create", "mesh_path", (p) => ({ parent_path: ".", mesh_path: p })],
  ["mesh_set_surface_material", "material_path", (p) => ({ path: "./M", material_path: p })],
  ["particles_set_texture", "texture_path", (p) => ({ path: "./P", texture_path: p })],
  ["shadermaterial_create", "shader_path", (p) => ({ path: "./N", shader_path: p })],
  ["shadermaterial_set_shader", "shader_path", (p) => ({ path: "./N", shader_path: p })],
  ["tilemaplayer_create", "tileset_path", (p) => ({ parent_path: ".", tileset_path: p })],
  ["tileset_add_source", "tileset_path", (p) => ({ tileset_path: p, texture_path: "res://x.tres" })],
  ["tileset_add_source", "texture_path", (p) => ({ tileset_path: "res://x.tres", texture_path: p })],
  ["tileset_add_tile", "tileset_path", (p) => ({ tileset_path: p, source_id: 0, atlas_coords: [0, 0] })],
  ["tileset_set_tile_collision", "tileset_path", (p) => ({ tileset_path: p, source_id: 0, atlas_coords: [0, 0], polygon: [[0, 0], [8, 0], [8, 8]] })],
  ["node_instantiate_scene", "scene_path", (p) => ({ parent_path: ".", scene_path: p })],
  ["test_list", "dir", (p) => ({ dir: p })],
  // ---- tabletop: the four template readers ----
  ["card_instance", "template_path", (p) => ({ template_path: p, parent: ".", data: {} })],
  ["card_hand_layout", "template_path", (p) => ({ template_path: p, parent: ".", cards: [{ data: {} }], mode: "row" })],
  ["card_deck_from_table", "template_path", (p) => ({ template_path: p, parent: ".", table_path: "res://t.csv", column_map: { a: "a" } })],
  ["piece_instance", "template_path", (p) => ({ template_path: p, parent: ".", data: {} })],
  ["piece_template_create", "art", (p) => ({ path: "res://pt.tscn", size: { width: 10, height: 10 }, art: p })],
  // ---- netcode: an ARRAY parameter, every element a path ----
  ["mp_add_spawner", "spawnable_scenes", (p) => ({ parent_path: ".", spawnable_scenes: [p] })],
  // ---- cli / processes: the launchers and the export ----
  ["godot_run_headless_script", "script_path", (p) => ({ script_path: p })],
  ["godot_run_project", "scene", (p) => ({ scene: p })],
  ["godot_run_managed", "scene", (p) => ({ scene: p })],
  ["godot_export", "output_path", (p) => ({ preset: "Linux/X11", output_path: p })],
  // ---- runtime: measured against a game that was actually hosting the bridge ----
  ["runtime_node_add", "scene", (p) => ({ parent: ".", scene: p })],
  ["runtime_screenshot_diff", "reference", (p) => ({ reference: p })],
  ["runtime_spawn_peers", "scene", (p) => ({ count: 1, scene: p })],
];

const ext = (tool: string) =>
  tool === "test_list" ? "" :
  /card|piece|scene|spawn|instantiate|run_project|run_managed|node_add/.test(tool) ? ".tscn" :
  tool === "godot_run_headless_script" ? ".gd" :
  tool === "runtime_screenshot_diff" ? ".png" :
  ".tres";

test("every measured reader refuses a res://.. escape BY REASON, before the transport", async () => {
  const root = tmpRoot();
  const rec = harness(root);
  for (const [tool, param, mk] of READERS) {
    const spelling = `res://../${EVIL}/esc${ext(tool)}`;
    const r = await rec.handler(tool)({ ...mk(spelling), confirm: true });
    assert.equal(r.isError, true, `${tool}.${param} must refuse ${spelling}`);
    assert.match(textOf(r), /outside the Godot project root/, `${tool}.${param} must refuse BY REASON`);
    assert.match(textOf(r), /path_outside_project/, `${tool}.${param} must carry the shared refusal code`);
    // The refusal names the PARAMETER, so a two-parameter tool says which one.
    assert.match(textOf(r), new RegExp(`Refusing ${param}\\b`), `${tool} must name ${param}`);
  }
});

test("EVERY reader refuses BEFORE the confirmation prompt — no approval for a doomed read", async () => {
  // 🔴 164 §4.1's LESSON, APPLIED FROM THE START RATHER THAN AFTER A SURVIVOR.
  // Placement is a PER-CALL-SITE property: pinning it on one tool leaves every other
  // guard free to drift behind its gate. So it is asserted at all of them.
  const root = tmpRoot();
  const asked: unknown[] = [];
  const rec = harness(root, async (req) => { asked.push(req); return { action: "accept", content: { proceed: true } }; });
  for (const [tool, param, mk] of READERS) {
    asked.length = 0;
    // No `confirm`, so a tool that reached its gate WOULD elicit.
    const r = await rec.handler(tool)(mk(`res://../${EVIL}/esc${ext(tool)}`));
    assert.equal(r.isError, true, `${tool}.${param} must refuse`);
    assert.match(textOf(r), /outside the Godot project root/, `${tool}.${param} must refuse BY REASON`);
    assert.equal(asked.length, 0, `${tool}.${param} must not ask approval for a read that can never happen`);
  }
});

test("all three spellings are refused, not just the one the addon let through", async () => {
  // The addon's only check is `begins_with("res://")`, so a bare relative and an
  // absolute elsewhere were already self-announcing for WRITERS. 🔴 FOR READERS THEY
  // WERE NOT: all three spellings reached outside on 19 of the first probe's rows.
  const root = tmpRoot();
  const rec = harness(root);
  for (const spelling of [`../${EVIL}/esc.tres`, path.join(path.dirname(root), "elsewhere", "esc.tres")]) {
    const r = await rec.handler("control_set_theme")({ path: "./C", theme_path: spelling });
    assert.equal(r.isError, true, `${spelling} must be refused`);
    assert.match(textOf(r), /outside the Godot project root/, `${spelling} must be refused BY REASON`);
  }
});

test("the refusal is NOT dressed as a Bridge error — the transport was never reached", async () => {
  const root = tmpRoot();
  const rec = harness(root);
  const r = await rec.handler("node_instantiate_scene")({ parent_path: ".", scene_path: `res://../${EVIL}/esc.tscn` });
  assert.match(textOf(r), /^Path error \[path_outside_project\]/, "a path refusal has its own envelope");
  assert.doesNotMatch(textOf(r), /Bridge error/, "'Bridge error' means the editor is unreachable — a different repair");
});

test("the guard is INERT on legal spellings, and the ORIGINAL spelling goes on the wire", async () => {
  const root = tmpRoot();
  const seen: Array<{ method: string; params: Record<string, unknown> }> = [];
  const recording = {
    async request(method: string, params: Record<string, unknown> = {}) {
      seen.push({ method, params });
      return { ok: true };
    },
  };
  const rec = makeRecordingServer(acceptAll);
  registerEditorTools(
    rec.server as unknown as Parameters<typeof registerEditorTools>[0],
    recording as unknown as Parameters<typeof registerEditorTools>[1],
    { projectPath: root } as unknown as Config,
  );
  for (const spelling of ["res://ok.tres", "res://deep/nested/ok.tres", path.join(root, "abs.tres")]) {
    seen.length = 0;
    const r = await rec.handler("shadermaterial_set_shader")({ path: "./N", shader_path: spelling });
    assert.notEqual(r.isError, true, `${spelling} must stay legal`);
    assert.equal(seen.length, 1, `${spelling} must reach the bridge`);
    assert.equal(seen[0].params.shader_path, spelling, "the ORIGINAL spelling goes on the wire, unrewritten");
  }
});

test("an omitted OPTIONAL reader path is not refused — it has nothing to escape", async () => {
  // Every one of these documents a default that is REACHED by omitting the path:
  // `tilemaplayer_create` makes an unbound layer, `test_list` searches res://test,
  // `godot_run_project` runs the main scene. Refusing `undefined` would break all three.
  const root = tmpRoot();
  const seen: string[] = [];
  const recording = { async request(method: string) { seen.push(method); return { ok: true }; } };
  const rec = makeRecordingServer(acceptAll);
  registerEditorTools(
    rec.server as unknown as Parameters<typeof registerEditorTools>[0],
    recording as unknown as Parameters<typeof registerEditorTools>[1],
    { projectPath: root } as unknown as Config,
  );
  for (const [tool, args, method] of [
    ["tilemaplayer_create", { parent_path: "." }, "tilemaplayer.create"],
    ["test_list", {}, "test.list"],
    ["meshinstance_create", { parent_path: "." }, "meshinstance.create"],
    ["shadermaterial_create", { path: "./N" }, "shadermaterial.create"],
  ] as Array<[string, Record<string, unknown>, string]>) {
    seen.length = 0;
    const r = await rec.handler(tool)({ ...args, confirm: true });
    assert.notEqual(r.isError, true, `${tool} with the path omitted must take its documented default`);
    assert.deepEqual(seen, [method], `${tool} must still reach the bridge`);
  }
});

test("`user://` stays legal for runtime_screenshot_diff — the documented mainline is preserved", async () => {
  // 🔴 `reference` documents "res:// OR user:// path". `toFsPath` has no `user://`
  // case, so it joins the spelling under the root and it resolves INSIDE — the guard
  // passes it through. That is load-bearing behaviour, not an accident, so it is
  // pinned: a guard tightened to demand `res://` would break the documented spelling.
  const root = tmpRoot();
  const seen: Array<Record<string, unknown>> = [];
  const recording = {
    async request(_m: string, params: Record<string, unknown> = {}) { seen.push(params); return { ok: true }; },
  };
  const rec = makeRecordingServer(acceptAll);
  registerRuntimeTools(
    rec.server as unknown as Parameters<typeof registerRuntimeTools>[0],
    recording as unknown as Parameters<typeof registerRuntimeTools>[1],
    { clientFor: () => recording } as unknown as Parameters<typeof registerRuntimeTools>[2],
    { projectPath: root } as unknown as Config,
  );
  const r = await rec.handler("runtime_screenshot_diff")({ reference: "user://ref.png" });
  assert.notEqual(r.isError, true, "user:// must stay legal");
  assert.equal(seen[0]?.reference, "user://ref.png", "and reach the runtime unrewritten");
});

test("EVERY element of an array path parameter is guarded, not just the first", async () => {
  // 🔴 `spawnable_scenes` is an array. A guard on `[0]` is not a guard — it is a
  // guard with an off-by-one exploit, and nothing else in the tree would have said so.
  const root = tmpRoot();
  const rec = harness(root);
  const r = await rec.handler("mp_add_spawner")({
    parent_path: ".",
    spawnable_scenes: ["res://legal.tscn", `res://../${EVIL}/esc.tscn`],
  });
  assert.equal(r.isError, true, "an escape in a LATER element must still be refused");
  assert.match(textOf(r), /outside the Godot project root/);
});

test("the launchers refuse BEFORE claiming the runtime port", async () => {
  // 🔴 ORDER MATTERS AND IS MEASURABLE. `godot_run_project` checked the port first;
  // a scene that can never legally run should not first take a port from a game that
  // could. The probe hit exactly this: round A's escaping launch held :9081 and every
  // later row answered "already bound" instead of measuring anything.
  const root = tmpRoot();
  const rec = harness(root);
  for (const tool of ["godot_run_project", "godot_run_managed"]) {
    const r = await rec.handler(tool)({ scene: `res://../${EVIL}/esc.tscn` });
    assert.equal(r.isError, true, `${tool} must refuse an escaping scene`);
    assert.match(textOf(r), /path_outside_project/, `${tool} must refuse BY REASON`);
    assert.doesNotMatch(textOf(r), /already bound|port/i, "the PATH is the answer, not the port");
  }
});

test("registerRuntimeTools refuses to register without its Config — a .mjs call site is a call site", async () => {
  // 🔴 THE REGRESSION THIS SESSION SHIPPED TO CI AND HAD TO CHASE BACK. Nine
  // `test-integration/*.mjs` probes call this registrar DIRECTLY, so adding a fourth
  // parameter compiled clean, passed 655 unit tests, and then failed six CI jobs at
  // runtime with "Cannot read properties of undefined (reading 'projectPath')" —
  // raised inside a guard, naming neither the parameter nor the caller.
  //
  // TypeScript is not the roster of call sites. Failing loudly at registration is,
  // and this pins it so the next parameter added here cannot repeat the trip.
  const rec = makeRecordingServer(acceptAll);
  assert.throws(
    () => registerRuntimeTools(
      rec.server as unknown as Parameters<typeof registerRuntimeTools>[0],
      explodingBridge as unknown as Parameters<typeof registerRuntimeTools>[1],
      {} as unknown as Parameters<typeof registerRuntimeTools>[2],
      undefined as unknown as Config,
    ),
    /FOURTH argument/,
    "a missing Config must fail at registration, naming the parameter and the callers",
  );
});

test("CARRIED — 164's to_path writer guards are still wired at a sample of call sites", async () => {
  // A carried mutation per shipped guard, the rule 164 §4.2 paid for twice. These are
  // 1.42.0's, re-asserted here so a refactor of the reader guards cannot quietly
  // unwire the writer ones sharing the same helper.
  const root = tmpRoot();
  const rec = harness(root);
  for (const [tool, args] of [
    ["theme_create", { to_path: `res://../${EVIL}/esc.tres` }],
    ["tileset_create", { to_path: `res://../${EVIL}/esc.tres` }],
    ["resource_create", { class_name: "StyleBoxFlat", to_path: `res://../${EVIL}/esc.tres` }],
  ] as Array<[string, Record<string, unknown>]>) {
    const r = await rec.handler(tool)({ ...args, confirm: true });
    assert.equal(r.isError, true, `${tool} must still refuse an escaping to_path`);
    assert.match(textOf(r), /path_outside_project/, `${tool} must still carry the shared refusal code`);
  }
});

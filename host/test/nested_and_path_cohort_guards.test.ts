import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { registerEditorTools } from "../src/tools/editor.js";
import { registerTabletopTools } from "../src/tools/tabletop.js";
import { registerKnowledgeTools } from "../src/tools/knowledge.js";
import { makeRecordingServer, type ElicitFn } from "./helpers/recording-server.js";
import type { Config } from "../src/config.js";

/**
 * Session 166 — THE CORRECTION. Not an extension of "the 78": a repudiation of it.
 *
 * 🔴 THE ENUMERATOR THAT PRODUCED "78" WAS BLIND THREE WAYS, and three sessions scoped
 * their work against its output:
 *   1. it walks TOP-LEVEL `inputSchema.properties` only, so nested path parameters
 *      appear in NO count (165 §5 D5 predicted three of them);
 *   2. it DISCARDS every parameter literally named `path` — 124 of them — on the
 *      standing belief that "162 already swept these" (165 §5 D6 disproved that);
 *   3. its name hint is an ANCHORED EXACT-WORD list, so a compound name like
 *      `font_path` only ever matched via its DESCRIPTION — and
 *      `card_template_create.theme.font_path` has NO description, making it invisible
 *      to both hints at once.
 * Corrected, the enumeration is 258 rows, not 78.
 *
 * MEASURED against a real 4.7 editor: TWENTY-FOUR parameters reached outside the
 * project root, and SIX of them WROTE there — all four `theme_set_*` rewrote a Theme,
 * `resource_set_property` rewrote a resource's bytes, `resource_set_import_settings`
 * rewrote an asset's `.import` sidecar, `filesystem_create_dir` created directories,
 * and `scene_save_as`/`scene_new` wrote scenes. Verdicts came from the FILESYSTEM
 * (hashes and directory snapshots), never from the reply.
 *
 * 🔴 `theme_set_font` and `theme_set_stylebox` had guarded their SECOND parameter
 * since #175 and left `path` — the file they load AND RE-SAVE — wide open. Sixth
 * consecutive session where the interesting defect is the other parameter.
 *
 * 🔴 WHY THIS IS REACHABLE WITHOUT AN EDITOR: every guard refuses before the
 * confirmation gate and before the transport, so a bridge that THROWS on contact is
 * the sharpest assertion available — reaching it at all is the failure.
 */

const EVIL = "example_evil"; // shares the root's name PREFIX — the sibling trap

function tmpRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "g166-"));
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

function harness(root: string, elicit: ElicitFn = acceptAll) {
  const rec = makeRecordingServer(elicit);
  const cfg = { projectPath: root, runtimeHost: "127.0.0.1", runtimePort: 9081 } as unknown as Config;
  const srv = rec.server as unknown as Parameters<typeof registerEditorTools>[0];
  const br = explodingBridge as unknown as Parameters<typeof registerEditorTools>[1];
  registerEditorTools(srv, br, cfg);
  registerTabletopTools(srv, br, cfg);
  registerKnowledgeTools(srv as unknown as Parameters<typeof registerKnowledgeTools>[0], cfg);
  return rec;
}

/**
 * The 24 measured-escaping parameters, with arguments that REACH the guard.
 *
 * 🔴 Extensions are load-bearing: the tabletop template writers reject a non-`.tscn`
 * `path` BEFORE the guard runs, so a row spelled with the wrong suffix would assert
 * against the wrong refusal and pass for the wrong reason.
 */
const ROWS: Array<[tool: string, param: string, mk: (p: string) => Record<string, unknown>]> = [
  // ---- the theme_set_* family: `path` is LOADED AND RE-SAVED, so it is a WRITE ----
  ["theme_set_color", "path", (p) => ({ path: p, name: "font_color", theme_type: "Button", color: [1, 0, 0, 1] })],
  ["theme_set_constant", "path", (p) => ({ path: p, name: "h_separation", theme_type: "HBoxContainer", value: 4 })],
  ["theme_set_font", "path", (p) => ({ path: p, name: "font", theme_type: "Button", font_path: "res://f.tres" })],
  ["theme_set_stylebox", "path", (p) => ({ path: p, name: "panel", theme_type: "Panel", stylebox_path: "res://s.tres" })],
  // ---- the resource plane ----
  ["resource_load", "path", (p) => ({ path: p })],
  ["resource_get_property", "path", (p) => ({ path: p, property: "resource_name" })],
  ["resource_set_property", "path", (p) => ({ path: p, property: "resource_name", value: "x" })],
  ["resource_get_import_settings", "path", (p) => ({ path: p })],
  ["resource_set_import_settings", "path", (p) => ({ path: p, settings: { "compress/mode": 1 } })],
  // ---- the scene plane ----
  ["scene_open", "path", (p) => ({ path: p })],
  ["scene_new", "path", (p) => ({ root_type: "Node2D", path: p })],
  ["scene_reload", "path", (p) => ({ path: p })],
  ["scene_get_dependencies", "path", (p) => ({ path: p })],
  ["scene_save_as", "path", (p) => ({ path: p })],
  // ---- shader / spatial / project ----
  ["shader_set_code", "path", (p) => ({ path: p, code: "shader_type canvas_item;" })],
  ["environment_set_sky", "path", (p) => ({ path: p })],
  ["project_add_autoload", "path", (p) => ({ name: "A", path: p })],
  ["project_set_main_scene", "path", (p) => ({ path: p })],
  // ---- the filesystem dock ----
  ["filesystem_list", "path", (p) => ({ path: p })],
  ["filesystem_create_dir", "path", (p) => ({ path: p })],
  // ---- host-side search: never touches the bridge, so the host is the ONLY guard ----
  ["project_search", "path", (p) => ({ query: "extends", path: p })],
  // ---- 🔴 THE NESTED FOUR — one level down, invisible to every enumeration to date ----
  ["board_create", "background.art", (p) => ({ path: "res://b.tscn", layout: { mode: "grid", rows: 2, cols: 2 }, background: { art: p } })],
  ["card_template_create", "back.art", (p) => ({ path: "res://c.tscn", size: { width: 10, height: 10 }, slots: [{ name: "t", kind: "label" }], back: { art: p } })],
  ["card_template_create", "theme.font_path", (p) => ({ path: "res://c2.tscn", size: { width: 10, height: 10 }, slots: [{ name: "t", kind: "label" }], theme: { font_path: p } })],
  ["piece_template_create", "back.art", (p) => ({ path: "res://p.tscn", size: { width: 10, height: 10 }, back: { art: p } })],
];

const ext = (tool: string, param: string) =>
  param.endsWith("art") ? ".tres" :
  tool === "filesystem_list" || tool === "filesystem_create_dir" || tool === "project_search" ? "" :
  /scene_open|scene_new|scene_reload|scene_get_dependencies|scene_save_as|project_set_main_scene/.test(tool) ? ".tscn" :
  tool === "shader_set_code" ? ".gdshader" :
  tool === "project_add_autoload" ? ".gd" :
  ".tres";

test("all 24 measured parameters refuse a res://.. escape BY REASON, before the transport", async () => {
  const root = tmpRoot();
  const rec = harness(root);
  for (const [tool, param, mk] of ROWS) {
    const spelling = `res://../${EVIL}/esc${ext(tool, param)}`;
    const r = await rec.handler(tool)({ ...mk(spelling), confirm: true });
    assert.equal(r.isError, true, `${tool}.${param} must refuse ${spelling}`);
    assert.match(textOf(r), /outside the Godot project root/, `${tool}.${param} must refuse BY REASON`);
    assert.match(textOf(r), /path_outside_project/, `${tool}.${param} must carry the shared refusal code`);
    // The refusal NAMES the parameter, so a two-parameter tool says which one failed.
    assert.match(textOf(r), new RegExp(`Refusing ${param.replace(".", "\\.")}\\b`), `${tool} must name ${param}`);
  }
});

test("a bare relative and an absolute elsewhere are refused too — by the HOST", async () => {
  // 🔴 THE SPELLINGS ARE NOT INTERCHANGEABLE. For the editor writers the addon's own
  // `begins_with("res://")` refuses the other two, so only `res://../` was ever silent.
  // For readers and for the host-side `project_search` the addon is not in the path at
  // all, and the measurement showed all three escaping. The host refuses all three.
  const root = tmpRoot();
  const outside = path.join(path.dirname(root), EVIL, "esc.tres");
  const rec = harness(root);
  for (const [tool, param, mk] of ROWS) {
    for (const spelling of [`../${EVIL}/esc${ext(tool, param)}`, outside]) {
      const r = await rec.handler(tool)({ ...mk(spelling), confirm: true });
      assert.equal(r.isError, true, `${tool}.${param} must refuse ${spelling}`);
      assert.match(textOf(r), /path_outside_project/, `${tool}.${param} must refuse ${spelling} by code`);
    }
  }
});

test("EVERY parameter refuses BEFORE the confirmation prompt — no approval for a doomed call", async () => {
  // 163 §3's ordering, re-pinned: a call that can never legally proceed must not first
  // ask the user to approve it. `elicit` throwing is the assertion.
  const root = tmpRoot();
  const rec = harness(root, async () => { throw new Error("the guard ran AFTER the prompt"); });
  for (const [tool, param, mk] of ROWS) {
    const r = await rec.handler(tool)({ ...mk(`res://../${EVIL}/esc${ext(tool, param)}`), confirm: undefined });
    assert.equal(r.isError, true, `${tool}.${param} must refuse without prompting`);
    assert.match(textOf(r), /path_outside_project/, `${tool}.${param} must refuse before the prompt`);
  }
});

test("the guard REWRITES NOTHING — a legal res:// spelling reaches the bridge verbatim", async () => {
  // 🔴 The guard returns nothing and normalises nothing: the caller's ORIGINAL spelling
  // still goes on the wire. An over-eager mutation that returns the resolved absolute
  // path instead is caught here.
  const root = tmpRoot();
  const seen: string[] = [];
  const rec = harness(root);
  const recording = {
    async request(_m: string, params: { path?: string }) {
      seen.push(String(params?.path));
      throw new Error("stop after capture");
    },
  };
  const cfg = { projectPath: root } as unknown as Config;
  const rec2 = makeRecordingServer(acceptAll);
  registerEditorTools(
    rec2.server as unknown as Parameters<typeof registerEditorTools>[0],
    recording as unknown as Parameters<typeof registerEditorTools>[1],
    cfg,
  );
  await rec2.handler("resource_load")({ path: "res://inside/thing.tres" });
  assert.deepEqual(seen, ["res://inside/thing.tres"]);
  assert.ok(rec);
});

test("an OMITTED optional path stays legal — the default is only reachable by omission", async () => {
  // O01/O02 from 165's sweep, carried. `scene_reload`, `scene_get_dependencies`,
  // `filesystem_list` and `project_search` all document a default that ONLY omission
  // reaches, so a guard that refuses `undefined` breaks a documented spelling.
  const root = tmpRoot();
  const rec = harness(root);
  for (const [tool, args] of [
    ["scene_reload", { confirm: true }],
    ["scene_get_dependencies", {}],
    ["filesystem_list", {}],
  ] as Array<[string, Record<string, unknown>]>) {
    const r = await rec.handler(tool)(args);
    // 🔴 ASSERT REACHING THE BRIDGE, NOT THE ABSENCE OF A STRING. An earlier version of
    // this test only checked that `path_outside_project` was missing, and a mutation
    // that made the guard refuse `undefined` SURVIVED it — refusing `undefined` raises a
    // TypeError, which is not that string either. The only honest proof that the guard
    // let the call through is that the call reached the (exploding) bridge.
    assert.match(textOf(r), /the guard let .* reach the bridge/, `${tool} must let an omitted path reach the bridge`);
  }
  // project_search does not use the bridge at all, so an omitted path SUCCEEDS outright.
  const s = await rec.handler("project_search")({ query: "nothing-matches-this-g166" });
  assert.notEqual(s.isError, true, `project_search must SUCCEED with an omitted path, got: ${textOf(s)}`);
});

test("an OMITTED NESTED object is legal — `back`/`background`/`theme` are all optional", async () => {
  // 🔴 THE NESTED GUARDS ARE THE EASIEST PLACE TO BE OVER-EAGER: `a.back.art` without
  // the `!== undefined` check throws on every call that simply has no card back, which
  // is the common case. 164 §4.1's survivor pre-empted rather than rediscovered.
  const root = tmpRoot();
  const rec = harness(root);
  for (const [tool, args] of [
    ["board_create", { path: "res://b.tscn", layout: { mode: "grid", rows: 2, cols: 2 }, confirm: true }],
    ["card_template_create", { path: "res://c.tscn", size: { width: 10, height: 10 }, slots: [{ name: "t", kind: "label" }], confirm: true }],
    ["piece_template_create", { path: "res://p.tscn", size: { width: 10, height: 10 }, confirm: true }],
  ] as Array<[string, Record<string, unknown>]>) {
    const r = await rec.handler(tool)(args);
    // Same discipline: prove it REACHED the bridge rather than that some string is absent.
    assert.match(textOf(r), /the guard let .* reach the bridge/, `${tool} must let an omitted nested object through`);
  }
  // …and a nested object PRESENT but with the path key absent is legal too.
  const r = await rec.handler("card_template_create")({
    path: "res://c3.tscn", size: { width: 10, height: 10 },
    slots: [{ name: "t", kind: "label" }], back: { color: "#112233" }, confirm: true,
  });
  assert.match(textOf(r), /the guard let .* reach the bridge/, "back without art must reach the bridge");
});

test("an ABSOLUTE path INSIDE the project root stays legal", async () => {
  // Documented behaviour (`paths.ts`): what is refused is the resolved LOCATION, not
  // the spelling. A caller passing a full path to a file in their own project is fine.
  const root = tmpRoot();
  const rec = harness(root);
  const inside = path.join(root, "sub", "thing.tres");
  const r = await rec.handler("resource_load")({ path: inside });
  assert.doesNotMatch(textOf(r), /path_outside_project/, "an absolute path inside the root must stay legal");
});

test("the project root ITSELF is legal for a directory parameter", async () => {
  const root = tmpRoot();
  const rec = harness(root);
  const r = await rec.handler("project_search")({ query: "nothing-matches-this-g166", path: "res://" });
  assert.doesNotMatch(textOf(r), /path_outside_project/, "res:// is the root and must stay legal");
});

test("the prefix-sharing sibling is refused — `example_evil` is not inside `example`", async () => {
  // The trap the fixture is built around: a naive `startsWith(root)` accepts
  // `/tmp/x/example_evil` as inside `/tmp/x/example`. `escapesProject` compares with a
  // separator, and this row is what proves it.
  const root = tmpRoot();
  const rec = harness(root);
  const sibling = path.join(path.dirname(root), EVIL, "esc.tres");
  const r = await rec.handler("resource_load")({ path: sibling });
  assert.equal(r.isError, true);
  assert.match(textOf(r), /path_outside_project/);
});

// Authoring-plane integration probe (EXPERIMENTAL) — drives the Group A (scene
// graph: nodes, scenes, signals), Group B (resources & filesystem), Group C
// (animation), Group D (TileSet / TileMapLayer), Group E (physics & collision),
// and Group F (VFX & audio) authoring mutators against a REAL running Godot
// editor's Breakpoint MCP addon (:9080) and asserts each mutation INDEPENDENTLY by
// reading the live edited scene / project filesystem back through separate read
// tools. This is the one thing the mocked-bridge unit suite cannot do: prove the
// mutator actually changes the edited scene (or writes the resource) inside a real
// editor, not just that the host emits the right bridge request.
//
// Coverage — the authoring surface across Groups A–F:
//   A · scene graph (nodes): node_add, node_duplicate, node_add_to_group,
//       node_remove_from_group, node_move_child, node_change_type, node_set_owner,
//       node_find, node_get_path, node_list_properties, node_list_groups.
//   A · scenes: scene_pack, node_instantiate_scene, scene_list_open,
//       scene_get_dependencies, scene_reload (at startup — see AUTH_SCENE_PRISTINE).
//   A · signals: signal_connect, signal_disconnect, signal_add_user_signal,
//       signal_list, signal_list_connections, signal_emit.
//   B · resources/filesystem: resource_create, resource_load, resource_save,
//       resource_duplicate, resource_set_property, resource_get_property,
//       resource_get_import_settings, filesystem_create_dir, filesystem_list,
//       filesystem_scan, filesystem_move.
//   C · animation: anim_player_create, anim_create, anim_set_length, anim_set_loop,
//       anim_add_track, anim_insert_key, anim_get_track_keys, anim_remove_key,
//       anim_list, anim_tree_create, anim_tree_add_node, anim_statemachine_add_state,
//       anim_statemachine_add_transition, anim_delete.
//   D · tiles: tileset_create, tileset_add_source, tileset_add_tile,
//       tileset_set_tile_collision, tilemaplayer_create, tilemap_set_cell,
//       tilemap_set_cells_rect, tilemap_get_cell, tilemap_clear.
//   E · physics/collision (12) and F · particles/shaders/audio (17) — see markers.
//
// How it asserts (independent read-back, not just the mutator's own echo):
//   * node creators  -> node_get_children(parent) shows the new node at the returned
//                       path with the expected class.
//   * scalar setters -> node_get_property(path, prop) re-reads the applied value.
//   * resource setters-> node_get_property/resource_get_property comes back Codec-tagged.
//   * groups/signals -> node_list_groups / signal_list(_connections) re-read the state.
//   * anim mutators  -> anim_list / anim_get_track_keys re-read the library/tracks.
//   * tile mutators  -> tilemap_get_cell re-reads a painted cell; resource_load reopens
//                       the written TileSet/.tres.
//   * disk writers   -> resource_load / filesystem_list re-open / re-list what was written.
//   * project gravity -> project_get_setting re-reads the ProjectSettings value.
//   * global bus tools-> AudioServer has no editor read tool; we assert the live
//                       values the mutator read back from AudioServer post-commit.
//
// Undo/redo IS asserted per plane. editor_undo / editor_redo drive the edited scene's
// EditorUndoRedoManager history (resolved via get_object_history_id on the edited
// root), so every in-scene family round-trips a representative undoable archetype
// (creator / property / connection / cell paint): mutate -> undo -> revert -> redo ->
// restore. The dedicated AUTH_UNDO family additionally proves the mechanism across
// the creator / property / resource archetypes, a 3-deep LIFO stack, and a redo
// no-op guard. Disk-backed writers (Group B, TileSet .tres writers, project gravity,
// the global AudioServer tools) are NOT scene-undoable and are asserted forward only.
//
// Assets: the example project ships no texture/audio, so the probe MINTS its own
// (PlaceholderTexture2D, AudioStreamWAV, StyleBoxFlat via resource_create; two
// .gdshader files via shader_create; a PackedScene via scene_pack; a TileSet via
// tileset_create) — no committed binary fixtures.
//
// Markers (grep-able): AUTH_NODE_* / AUTH_SCENE_* / AUTH_SIGNAL_* / AUTH_RESOURCE_* /
// AUTH_ANIM_* / AUTH_TILESET_* / AUTH_TILEMAP_* / AUTH_PHYS_* / AUTH_VFX_PARTICLES_* /
// AUTH_VFX_SHADER_* / AUTH_AUDIO_* / AUTH_UI_* / AUTH_3D_* / AUTH_GROUPI_* / AUTH_K_* (Group K
// knowledge & search: read-only host-side + ClassDB) / AUTH_ASSETGEN_* (Group J asset generation:
// placeholder mint+import, degrade, command backend) / AUTH_MP_* (Group M netcode scaffolding: spawner /
// synchronizer / authority node authoring + undo/redo, enet/lobby codegen, @rpc wiring, WebRTC feature-detect) /
// AUTH_BACKEND_* (Group M backend-SDK scaffolding: detect, unsupported_feature + sdk_missing degrades, and the
// real write path via an in-memory autoload simulating an installed SDK) / AUTH_UNDO_* / AUTH_REDO_* /
// AUTH_SCENE_PRISTINE (the edited scene started from disk, not from the previous run — see the
// idempotency section below) /
// AUTH_CLEAN (the probe put GODOT_PROJECT back byte-for-byte — see the cleanup section). Every marker prints
// "OK" or "FAIL"; a trailing AUTH_SUMMARY line reports the tally and the process exits
// non-zero if any assertion failed. The reachability check is the gate (exit 1 if the
// addon is unreachable).
//
// Side effects — ALL OF THEM UNDONE BEFORE EXIT as of session 148; see the cleanup
// section at the bottom and the AUTH_CLEAN marker. Listed here because knowing WHAT the
// probe writes is still how you reason about it; you no longer have to clean it up.
//   * unsaved in-memory edits to res://main.tscn (never saved -> vanish on close, and
//     discarded up-front by the startup scene_reload so they cannot reach the NEXT run);
//   * written files under res://_auth_probe_* : _auth_probe_tex.tres,
//     _auth_probe_audio.tres, _auth_probe_a.gdshader, _auth_probe_b.gdshader,
//     _auth_probe_bus_layout.tres, _auth_probe_branch.tscn, _auth_probe_style*.tres,
//     _auth_probe_tiletex.tres, _auth_probe_tileset.tres, the Group G theme files
//     (_auth_probe.theme.tres, _auth_probe_sbox.tres, _auth_probe_font.tres), the Group H
//     3D resources (_auth_probe_box.mesh.tres, _auth_probe_mat3d.tres, _auth_probe_env.tres),
//     and the _auth_probe_dir/
//     directory (with moved.tres) — plus their .uid/.import siblings;
//   * an extra AudioServer bus on the running editor. GLOBAL to the process and NOT undone
//     by the restore below — there is no audio_bus_remove tool — so consecutive runs against
//     one live editor accumulate AuthBus, AuthBus 2, AuthBus 3... The AUTH_AUDIO_BUS_ADD
//     assertion accounts for that (see its comment); a restart resets it.
//   * Group I: in-memory ProjectSettings edits (input/autoload/main_scene, save:false ->
//     vanish on close), a net-zero EditorSettings write, and res://export_presets.cfg on disk.
//   * Group J: written files under res://_asset_probe_* (sprite/texture/icon/forced/det_*/model/
//     cmd .tres native resources, sfx.tres) plus their .uid siblings, and a fixture generator script
//     under the OS temp dir. asset_gen_configure state is restored to the default "none" backend at the end.
//   * Group M: written GDScript files res://_auth_probe_enet.gd (also mutated by mp_wire_rpc),
//     _auth_probe_lobby.gd, and (only where the WebRTC module is present) _auth_probe_webrtc.gd; the
//     backend half writes res://_auth_probe_backend_{config,leaderboard,save,auth}.gd (and adds/removes an
//     in-memory "SilentWolf" autoload, save:false) — plus their .uid siblings. Nothing in this
//     list needs naming anywhere for cleanup: the snapshot below discovers it.
//   Cleanup is no longer yours to type. The probe snapshots GODOT_PROJECT before it
//   connects and restores it on the way out — on success, on assertion failure, and on a
//   fatal throw — so a local run leaves the tree byte-identical to how it found it and
//   re-runs with no `git checkout`. AUTH_CLEAN then re-hashes every snapshotted file and
//   FAILS if anything survived, which is what stops the restore rotting the way the old
//   hand-maintained `rm -rf` glob did every time a family was added to the probe. Because
//   the snapshot is taken at startup, files that were already there — including your own
//   untracked scratch — are not "new" and are never touched; the old glob would have
//   happily matched a real file named _auth_probe_*.
//   NOT restored: .godot/, the engine's own import cache. Gitignored, rewritten by the
//   editor for reasons unrelated to the probe, and restoring it would fight the editor.
//   NOT restored either: the two extra AudioServer buses and the in-memory ProjectSettings
//   edits — neither is on disk, and both die with the editor process — and the Group J
//   fixture generator, which is written under the OS temp dir, not under GODOT_PROJECT.
//
// Requires the editor up (booted under Xvfb by the workflow) with GODOT_PROJECT set.
// Run from host/:  node test-integration/authoring-plane.integration.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { decodePng, sampleDistinctColours } from "./_png.mjs";
import { snapshotDir, restoreDir, diffDir, describeDiff } from "./_workspace.mjs";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url)); // host/test-integration
const HOST_DIR = path.resolve(THIS_DIR, "..");                 // host/ (the package root)
const REPO = path.resolve(HOST_DIR, "..");                     // repo root
const DIST = path.join(HOST_DIR, "dist", "index.js");
const GODOT_PROJECT = process.env.GODOT_PROJECT || path.join(REPO, "example");
const GODOT_BIN = process.env.GODOT_BIN || "godot";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The scene every in-scene family mutates. Named because the idempotency reload below
// has to open, reload and assert against the same one.
const MAIN_SCENE = "res://main.tscn";

// Pre-probe state of GODOT_PROJECT. Module-scoped rather than a local in main() so the
// FATAL handler can restore too — a crash is precisely when the tree is most likely to
// be left dirty, and that is the run whose leftovers a developer least expects.
let workspace = null;

// Tools gated behind a confirmation prompt — pass confirm:true so we exercise the
// action rather than the decline path.
const GATED = new Set([
  "physics_set_gravity", "shader_create", "shader_set_code", "resource_create",
  "audio_bus_add", "audio_bus_add_effect", "audio_bus_set_volume", "audio_set_bus_layout",
  // Group A/B/C/D destructive writers exercised below:
  // (scene_reload discards unsaved edits, so it is gated like any other destructive tool —
  // it runs once at startup for idempotency, not as part of a family.)
  "scene_pack", "scene_reload", "signal_emit", "resource_save", "resource_duplicate",
  "resource_set_property", "filesystem_move", "anim_delete",
  "tileset_create", "tileset_add_source", "tileset_add_tile", "tileset_set_tile_collision",
  // Group G theme file-writers (Theme .tres on disk):
  "theme_create", "theme_set_color", "theme_set_font", "theme_set_stylebox", "theme_set_constant",
  // Group H resource file-writers (PrimitiveMesh / Environment .tres on disk):
  "primitive_mesh_create", "environment_create", "environment_set_sky",
  // Group I ProjectSettings / editor-config writers (in-memory input/autoload/main-scene
  // with save:false, export_presets.cfg on disk, EditorSettings on set):
  "inputmap_add_action", "inputmap_add_event", "inputmap_erase_action",
  "project_add_autoload", "project_remove_autoload", "project_add_export_preset",
  "project_set_main_scene", "editorsettings_get_set",
  // Group J asset-generation writers (asset_gen_configure is read/session-only, not gated):
  "asset_gen_placeholder", "asset_gen_sprite", "asset_gen_texture", "asset_gen_icon",
  "asset_gen_audio_sfx", "asset_gen_model",
  // Group M netcode codegen writers (the three node authoring tools are ungated/undoable):
  "mp_setup_enet_peer", "mp_setup_webrtc_peer", "mp_wire_rpc", "mp_scaffold_lobby",
  // Group M backend-SDK codegen writers (backend_detect is read-only, ungated):
  "backend_configure", "leaderboard_scaffold", "cloudsave_scaffold", "auth_scaffold",
]);

const results = { pass: [], fail: [] };
function pass(marker, detail = "") { results.pass.push(marker); console.log(`${marker} OK ${detail}`.trimEnd()); }
function fail(marker, detail = "") { results.fail.push(marker); console.log(`${marker} FAIL ${detail}`.trimEnd()); }

const near = (a, b) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-3;

async function main() {
  // Taken BEFORE anything connects: every file the probe goes on to write is therefore
  // "new" relative to it, and every file already present — including a developer's own
  // untracked scratch — is not, so cleanup can never reach beyond what this run created.
  // Reading ~560KB of example/ is noise next to the ~120s software editor boot.
  workspace = snapshotDir(GODOT_PROJECT);
  console.log(`AUTH_CLEAN_SNAPSHOT ${workspace.files.size} file(s) / ${workspace.dirs.size} dir(s) under ${GODOT_PROJECT} (.godot/ skipped)`);

  const transport = new StdioClientTransport({
    command: "node", args: [DIST], cwd: HOST_DIR,
    // This probe exercises the full tool surface, including the asset_gen_* and
    // node_call_method (code-execution) and backend_* (network) families that the
    // secure-default DROPS at registration since 1.18.0. Opt into all privileged
    // groups so those tools register and the AUTH_ASSETGEN / AUTH_MP / AUTH_BACKEND
    // families run their assertions instead of throwing "unknown tool".
    env: { ...process.env, GODOT_BIN, GODOT_PROJECT, BREAKPOINT_PRIVILEGED_GROUPS: "all" }, stderr: "inherit",
  });
  const client = new Client({ name: "gcb-authoring", version: "1.0.0" }, { capabilities: { elicitation: {} } });
  // Auto-approve any confirmation prompt (belt-and-suspenders with GATED/confirm:true).
  client.setRequestHandler(ElicitRequestSchema, async () => ({ action: "accept", content: { proceed: true } }));
  await client.connect(transport);

  // ---- low-level call: returns structuredContent, throws on bridge/schema error ----
  async function call(name, args = {}) {
    const a = GATED.has(name) ? { confirm: true, ...args } : args;
    const r = await client.callTool({ name, arguments: a }, undefined, { timeout: 60000 });
    if (r.isError) throw new Error(`${name}: ${(r.content?.[0]?.text || "").slice(0, 200)}`);
    if (!r.structuredContent) throw new Error(`${name}: no structuredContent`);
    return r.structuredContent;
  }
  // ---- read-back helpers ----
  const childList = async (p) => (await call("node_get_children", { path: p })).children || [];
  const hasChild = async (parent, childPath, type) =>
    (await childList(parent)).some((c) => c.path === childPath && (!type || c.type === type));
  const propVal = async (p, property) => (await call("node_get_property", { path: p, property })).value;
  const propResClass = async (p, property) => { const v = await propVal(p, property); return v && typeof v === "object" ? v.class : undefined; };
  const propNodePath = async (p, property) => { const v = await propVal(p, property); return v && typeof v === "object" ? v.path : v; };
  const settingVal = async (name) => (await call("project_get_setting", { name })).value;
  const groupsOf = async (p) => (await call("node_list_groups", { path: p })).groups || [];
  const connsOf = async (p, signal) => (await call("signal_list_connections", signal ? { path: p, signal } : { path: p })).connections || [];
  const sigNames = async (p) => ((await call("signal_list", { path: p })).signals || []).map((s) => s.name);
  const animOf = async (pl, nm) => ((await call("anim_list", { player_path: pl })).animations || []).find((a) => a.name === nm);
  const nodeIndex = async (p) => (await call("node_get_path", { path: p })).index;

  // Run one family; a throw inside marks a fail but never aborts the other families.
  // 🔴 THE FAMILY IS THE POPULATION UNIT, AND IT NOW REPORTS ITS OWN SIZE (169 §4).
  //
  // 168 §8.5 asked for a floor on the AUTH_SUMMARY total. A bare total turned out to be
  // the weaker half of the answer: this catch means a family that throws HALFWAY files
  // one `_THREW` and silently drops every claim it had not yet reached, and the run
  // still ends "pass=N/N fail=0" for a smaller N — 168 §5's disease exactly, one organ
  // over. Measured during that session: a family throwing early took AUTH_SUMMARY from
  // 207 to 189 and nothing said so.
  //
  // Instrumenting `family()` rather than listing 203 marker names is deliberate. A
  // hand-maintained manifest of every marker is 168 §6's 149-row exception table with a
  // different label on it — the thing that was MEASURED and thrown away. The family
  // label is already written at each call site, so the manifest maintains itself.
  const families = [];
  async function family(label, fn) {
    const before = results.pass.length + results.fail.length;
    let threw = null;
    try { await fn(); } catch (e) { threw = String(e?.message || e).slice(0, 200); fail(`${label}_THREW`, threw); }
    // -1 for the _THREW claim itself, so "claims the body actually made" is honest.
    const made = results.pass.length + results.fail.length - before - (threw ? 1 : 0);
    families.push({ label, made, threw });
  }

  // ---------------------------------------------------------------- gate ----
  console.log(`authoring-plane probe -> host stdio, GODOT_PROJECT=${GODOT_PROJECT}`);
  let up = false;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await client.callTool({ name: "editor_ping", arguments: {} }, undefined, { timeout: 5000 });
      if (r.structuredContent?.pong) {
        up = true;
        console.log(`AUTH_GATE_PING OK addon=${r.structuredContent.addon_version} godot=${r.structuredContent.godot}`);
        break;
      }
    } catch { /* not up yet */ }
    await sleep(1500);
  }
  if (!up) {
    console.error("AUTH_GATE_PING FAIL — editor bridge never answered on :9080 (editor not up, or plugin disabled)");
    await client.close();
    process.exit(1);
  }
  // A known edited scene root must exist for the in-scene mutators.
  await call("scene_open", { path: MAIN_SCENE });

  // ------------------------------------------------------- scene idempotency ----
  // #144 made the probe re-runnable by restoring GODOT_PROJECT on disk. The edited scene is
  // the other half, and no disk restore can reach it: node_add and friends mutate the
  // editor's IN-MEMORY tree, which is never saved, so it does not appear in the snapshot
  // diff and dies only with the editor process. Against one long-lived editor, run N
  // therefore used to start from run N-1's tree — measured at 22 leftover Auth* nodes under
  // the root after a single run, with the editor reporting main.tscn unsaved.
  //
  // Nothing was failing: every family asserts against the path a tool RETURNED, so Godot's
  // deduped names (AuthNodeRoot2, AuthNodeRoot3, ...) were followed correctly. That is
  // exactly the shape of #144 §3's AudioServer bug, though — there the same "assert against
  // what came back" habit held for the creator and broke for the two calls that addressed
  // the bus by literal name, which passed while measuring the PREVIOUS run's object. The
  // difference between latent and biting is one future family written with a literal name.
  //
  // Reloading from disk costs ~120ms and makes the starting tree the committed main.tscn.
  // The discarded edits were never going to be saved, so on a fresh editor this is a no-op.
  await call("scene_reload", { path: MAIN_SCENE });

  await family("AUTH_SCENE_PRISTINE", async () => {
    // Two independent oracles, in the spirit of #144 §2 — a single one here would be the
    // reload grading its own homework. The editor's own dirty set is the stronger claim but
    // needs 4.4+ (get_unsaved_scenes; the addon reports unsaved_supported=false on 4.3, and
    // 4.3 is still in this repo's matrix). The Auth* footprint check knows nothing about the
    // editor's bookkeeping, works on every version, and is the one the families care about.
    const open = await call("scene_list_open");
    const leftovers = ((await call("node_get_children", { path: "." })).children || [])
      .filter((c) => String(c.name ?? "").startsWith("Auth"));
    const dirty = open.unsaved_supported ? (open.unsaved || []).includes(MAIN_SCENE) : null;
    // dirty === null is "cannot know" on 4.3, which must not read as "clean" — hence
    // `!== true` rather than `=== false`; the footprint oracle carries the check there.
    (leftovers.length === 0 && dirty !== true)
      ? pass("AUTH_SCENE_PRISTINE", `unsaved=${dirty === null ? "n/a(<4.4)" : dirty} auth_leftovers=0`)
      : fail("AUTH_SCENE_PRISTINE", `unsaved=${dirty} auth_leftovers=${leftovers.length} :: ${leftovers.map((c) => c.name).join(",")}`);
  });

  // ---------------------------------------------------------------- fixtures ----
  const TEX = "res://_auth_probe_tex.tres";
  const AUDIO = "res://_auth_probe_audio.tres";
  const SHADER_A = "res://_auth_probe_a.gdshader";
  const SHADER_B = "res://_auth_probe_b.gdshader";
  const BUS_LAYOUT = "res://_auth_probe_bus_layout.tres";
  const CODE_A = "shader_type canvas_item;\nuniform float amount = 1.0;\nvoid fragment() { COLOR.a *= amount; }\n";
  const CODE_A2 = "shader_type canvas_item;\nuniform float amount = 1.0;\nuniform vec4 tint : source_color = vec4(1.0);\nvoid fragment() { COLOR *= tint; COLOR.a *= amount; }\n";
  const CODE_B = "shader_type canvas_item;\nuniform float amount = 0.5;\nvoid fragment() { COLOR.rgb *= amount; }\n";

  await family("AUTH_FIXTURES", async () => {
    await call("resource_create", { class_name: "PlaceholderTexture2D", to_path: TEX });
    await call("resource_create", { class_name: "AudioStreamWAV", to_path: AUDIO });
    await call("shader_create", { to_path: SHADER_A, code: CODE_A });
    await call("shader_create", { to_path: SHADER_B, code: CODE_B });
    // Prove the minted assets are real & the right type via an independent load.
    const okTex = (await call("resource_load", { path: TEX })).type;
    const okAudio = (await call("resource_load", { path: AUDIO })).type;
    const okShader = (await call("resource_load", { path: SHADER_A })).type;
    if (okTex && okAudio && okShader === "Shader") pass("AUTH_FIXTURES_MINTED", `tex=${okTex} audio=${okAudio} shader=${okShader}`);
    else fail("AUTH_FIXTURES_MINTED", `tex=${okTex} audio=${okAudio} shader=${okShader}`);
  });

  // ---------------------------------------------------------------- Group A: node depth ----
  await family("AUTH_NODE", async () => {
    const rootc = (await call("node_add", { parent_path: ".", type: "Node2D", name: "AuthNodeRoot" })).path;
    (await hasChild(".", rootc, "Node2D")) ? pass("AUTH_NODE_ADD_CONTAINER", rootc) : fail("AUTH_NODE_ADD_CONTAINER", rootc);

    const child = (await call("node_add", { parent_path: rootc, type: "Sprite2D", name: "AuthChild" })).path;
    (await hasChild(rootc, child, "Sprite2D")) ? pass("AUTH_NODE_ADD_CHILD", child) : fail("AUTH_NODE_ADD_CHILD", child);

    // node_duplicate (undoable) — forward + undo + redo
    const dup = (await call("node_duplicate", { path: child })).path;
    const dupMade = await hasChild(rootc, dup, "Sprite2D");
    const du = await call("editor_undo");
    const dupGone = !(await hasChild(rootc, dup, "Sprite2D"));
    (dupMade && du.performed === true && dupGone)
      ? pass("AUTH_NODE_DUPLICATE", `dup=${dup}`) : fail("AUTH_NODE_DUPLICATE", `made=${dupMade} performed=${du.performed} gone=${dupGone}`);
    const dr = await call("editor_redo");
    (dr.performed === true && (await hasChild(rootc, dup, "Sprite2D")))
      ? pass("AUTH_NODE_DUPLICATE_REDO") : fail("AUTH_NODE_DUPLICATE_REDO", `performed=${dr.performed}`);

    // node_add_to_group / node_list_groups (undoable) — forward + undo + redo
    await call("node_add_to_group", { path: child, group: "auth_group" });
    const inGrp = (await groupsOf(child)).includes("auth_group");
    const gu = await call("editor_undo");
    const outGrp = !(await groupsOf(child)).includes("auth_group");
    (inGrp && gu.performed === true && outGrp)
      ? pass("AUTH_NODE_ADD_TO_GROUP") : fail("AUTH_NODE_ADD_TO_GROUP", `in=${inGrp} performed=${gu.performed} out=${outGrp}`);
    await call("editor_redo");
    (await groupsOf(child)).includes("auth_group")
      ? pass("AUTH_NODE_ADD_TO_GROUP_REDO") : fail("AUTH_NODE_ADD_TO_GROUP_REDO");

    // node_remove_from_group (undoable) — forward
    await call("node_remove_from_group", { path: child, group: "auth_group" });
    !(await groupsOf(child)).includes("auth_group")
      ? pass("AUTH_NODE_REMOVE_FROM_GROUP") : fail("AUTH_NODE_REMOVE_FROM_GROUP");

    // node_move_child (undoable) — reorder AuthChild to the last sibling index
    await call("node_add", { parent_path: rootc, type: "Node2D", name: "AuthSibling" });
    await call("node_move_child", { path: child, to_index: -1 });
    const sibCount = (await childList(rootc)).length;
    (await nodeIndex(child)) === sibCount - 1
      ? pass("AUTH_NODE_MOVE_CHILD", `index=${await nodeIndex(child)}/${sibCount}`) : fail("AUTH_NODE_MOVE_CHILD", `index=${await nodeIndex(child)} of ${sibCount}`);

    // node_change_type (undoable) — Node2D -> Sprite2D, carrying name/children
    const morph = (await call("node_add", { parent_path: rootc, type: "Node2D", name: "AuthMorph" })).path;
    const ct = await call("node_change_type", { path: morph, type: "Sprite2D" });
    ((await call("node_get_path", { path: morph })).type === "Sprite2D" && ct.old_type === "Node2D")
      ? pass("AUTH_NODE_CHANGE_TYPE", `old=${ct.old_type}`) : fail("AUTH_NODE_CHANGE_TYPE", `type=${(await call("node_get_path", { path: morph })).type} old=${ct.old_type}`);

    // node_set_owner (undoable) — reassert AuthChild's owner to the scene root
    const so = await call("node_set_owner", { path: child, owner_path: "." });
    so.path === child ? pass("AUTH_NODE_SET_OWNER", `owner=${JSON.stringify(so.owner)}`) : fail("AUTH_NODE_SET_OWNER", JSON.stringify(so));

    // node_find (read) — Sprite2D descendants of the container
    const found = await call("node_find", { root_path: rootc, type: "Sprite2D" });
    (found.count >= 1 && found.matches.some((m) => m.path === child))
      ? pass("AUTH_NODE_FIND", `count=${found.count}`) : fail("AUTH_NODE_FIND", `count=${found.count}`);

    // node_get_path (read)
    const gp = await call("node_get_path", { path: child });
    (gp.parent === rootc && typeof gp.index === "number" && typeof gp.child_count === "number")
      ? pass("AUTH_NODE_GET_PATH", `parent=${gp.parent} idx=${gp.index}`) : fail("AUTH_NODE_GET_PATH", JSON.stringify(gp));

    // node_list_properties (read) — a Sprite2D exposes "position"
    const lp = await call("node_list_properties", { path: child });
    lp.properties.some((p) => p.name === "position")
      ? pass("AUTH_NODE_LIST_PROPERTIES", `n=${lp.properties.length}`) : fail("AUTH_NODE_LIST_PROPERTIES", `n=${lp.properties.length}`);
  });

  // ---------------------------------------------------------------- Group A: scenes ----
  await family("AUTH_SCENE", async () => {
    const BRANCH = "res://_auth_probe_branch.tscn";
    // scene_pack: save an owned node as a PackedScene (disk-backed, gated), then load it back.
    const packSrc = (await call("node_add", { parent_path: ".", type: "Node2D", name: "AuthPackMe" })).path;
    const packed = await call("scene_pack", { path: packSrc, to_path: BRANCH });
    (packed.packed === BRANCH && (await call("resource_load", { path: BRANCH })).type === "PackedScene")
      ? pass("AUTH_SCENE_PACK", BRANCH) : fail("AUTH_SCENE_PACK", `packed=${packed.packed}`);

    // node_instantiate_scene (undoable): instance the just-packed scene under the root.
    const inst = await call("node_instantiate_scene", { parent_path: ".", scene_path: BRANCH, name: "AuthInstanced" });
    ((await hasChild(".", inst.path)) && inst.scene === BRANCH)
      ? pass("AUTH_SCENE_INSTANTIATE", inst.path) : fail("AUTH_SCENE_INSTANTIATE", JSON.stringify(inst).slice(0, 120));

    // scene_list_open (read) — main.tscn is open
    const open = await call("scene_list_open");
    (Array.isArray(open.scenes) && open.scenes.includes("res://main.tscn"))
      ? pass("AUTH_SCENE_LIST_OPEN", `current=${open.current}`) : fail("AUTH_SCENE_LIST_OPEN", JSON.stringify(open.scenes).slice(0, 120));

    // scene_get_dependencies (read) — main.tscn references player.gd
    //
    // 🔴 WAS `Array.isArray(deps.dependencies)`, which the comment on this very line
    // already contradicted: it names res://player.gd and the claim never looked. A
    // resolver that found NOTHING answers `[]`, which is an array, so the claim was
    // green for the one failure worth catching. The correct pattern was FOUR LINES UP
    // the whole time — AUTH_SCENE_LIST_OPEN asserts isArray AND includes.
    //
    // 🔴🔴 AND THE REPLACEMENT WENT RED ON ITS FIRST RUN (169 §5). The tautology was not
    // merely weak, it was CONCEALING A LIVE DEFECT: the tool answered
    // `["uid://ccgi4n26nbyku::::res://player.gd"]` — the engine's internal encoding —
    // and that exact string is the one spelling resource_load refuses, while both of
    // its halves load. Fixed addon-side in 1.9.7; `dependencies` now carries loadable
    // paths and `dependencies_raw` preserves the engine form.
    const deps = await call("scene_get_dependencies", { path: "res://main.tscn" });
    // 🔴 NOT `includes("res://player.gd")` ALONE. That would pass again the moment the
    // splitter regressed to emitting both forms. Every entry must be loadable.
    const depsClean = Array.isArray(deps.dependencies)
      && deps.dependencies.includes("res://player.gd")
      && deps.dependencies.every((d) => typeof d === "string" && !d.includes("::::") && d.startsWith("res://"));
    const depsAligned = Array.isArray(deps.dependencies_raw) && Array.isArray(deps.dependency_uids)
      && deps.dependencies_raw.length === deps.dependencies.length
      && deps.dependency_uids.length === deps.dependencies.length;
    depsClean && depsAligned
      ? pass("AUTH_SCENE_DEPENDENCIES", `n=${deps.dependencies.length} — every entry is a loadable res:// path, raw + uids index-aligned`)
      : fail("AUTH_SCENE_DEPENDENCIES", `clean=${depsClean} aligned=${depsAligned} ${JSON.stringify(deps).slice(0, 180)}`);

    // 🔴 THE CLAIM THAT WOULD HAVE CAUGHT THIS ALL ALONG: what the tool hands back must
    // WORK when used for the thing it is named for. An echo is not a report (168 §5's
    // D5 sibling) — feed the first dependency straight back to resource_load.
    const depLoad = await call("resource_load", { path: deps.dependencies[0] });
    depLoad.path === deps.dependencies[0]
      ? pass("AUTH_SCENE_DEPENDENCIES_LOADABLE", `the first dependency round-trips through resource_load (${deps.dependencies[0]})`)
      : fail("AUTH_SCENE_DEPENDENCIES_LOADABLE", `scene_get_dependencies returned a string resource_load will not take: ${JSON.stringify(depLoad).slice(0, 140)}`);
  });

  // ---------------------------------------------------------------- Group A: signals ----
  await family("AUTH_SIGNAL", async () => {
    const a = (await call("node_add", { parent_path: ".", type: "Node2D", name: "AuthSigA" })).path;
    const b = (await call("node_add", { parent_path: ".", type: "Node2D", name: "AuthSigB" })).path;

    // signal_connect (undoable): AuthSigA.visibility_changed -> AuthSigB.queue_free
    await call("signal_connect", { path: a, signal: "visibility_changed", target_path: b, method: "queue_free" });
    const wired = (await connsOf(a, "visibility_changed")).some((c) => c.method === "queue_free");
    const su = await call("editor_undo");
    const unwired = !(await connsOf(a, "visibility_changed")).some((c) => c.method === "queue_free");
    (wired && su.performed === true && unwired)
      ? pass("AUTH_SIGNAL_CONNECT") : fail("AUTH_SIGNAL_CONNECT", `wired=${wired} performed=${su.performed} unwired=${unwired}`);
    await call("editor_redo");
    (await connsOf(a, "visibility_changed")).some((c) => c.method === "queue_free")
      ? pass("AUTH_SIGNAL_CONNECT_REDO") : fail("AUTH_SIGNAL_CONNECT_REDO");

    // signal_disconnect (undoable) — forward
    await call("signal_disconnect", { path: a, signal: "visibility_changed", target_path: b, method: "queue_free" });
    !(await connsOf(a, "visibility_changed")).some((c) => c.method === "queue_free")
      ? pass("AUTH_SIGNAL_DISCONNECT") : fail("AUTH_SIGNAL_DISCONNECT");

    // signal_add_user_signal (undoable) — forward + undo + redo
    await call("signal_add_user_signal", { path: a, signal: "auth_evt", args: [{ name: "amount", type: 2 }] });
    const declared = (await sigNames(a)).includes("auth_evt");
    const uu = await call("editor_undo");
    const undeclared = !(await sigNames(a)).includes("auth_evt");
    (declared && uu.performed === true && undeclared)
      ? pass("AUTH_SIGNAL_ADD_USER_SIGNAL") : fail("AUTH_SIGNAL_ADD_USER_SIGNAL", `declared=${declared} performed=${uu.performed} undeclared=${undeclared}`);
    await call("editor_redo");
    (await sigNames(a)).includes("auth_evt")
      ? pass("AUTH_SIGNAL_ADD_USER_SIGNAL_REDO") : fail("AUTH_SIGNAL_ADD_USER_SIGNAL_REDO");

    // signal_list (read) — a Sprite2D... here Node2D... exposes built-in visibility_changed
    (await sigNames(a)).includes("visibility_changed")
      ? pass("AUTH_SIGNAL_LIST") : fail("AUTH_SIGNAL_LIST");

    // signal_emit (gated, edit-time) — fires now, returns emitted:true (no connections left)
    const em = await call("signal_emit", { path: a, signal: "auth_evt", args: [7] });
    em.emitted === true ? pass("AUTH_SIGNAL_EMIT") : fail("AUTH_SIGNAL_EMIT", JSON.stringify(em));
  });

  // ---------------------------------------------------------------- Group B: resources & filesystem ----
  // Disk-backed (ResourceSaver / DirAccess), NOT scene-undoable — asserted forward only,
  // like physics_set_gravity and the global AudioServer bus tools.
  await family("AUTH_RESOURCE", async () => {
    const RES = "res://_auth_probe_style.tres";
    const RES_SAVED = "res://_auth_probe_style_saved.tres";
    const RES_DUP = "res://_auth_probe_style_dup.tres";
    const DIR = "res://_auth_probe_dir";

    await call("resource_create", { class_name: "StyleBoxFlat", to_path: RES });
    (await call("resource_load", { path: RES })).type === "StyleBoxFlat"
      ? pass("AUTH_RESOURCE_CREATE", RES) : fail("AUTH_RESOURCE_CREATE", RES);

    await call("resource_set_property", { path: RES, property: "content_margin_left", value: 12 });
    near((await call("resource_get_property", { path: RES, property: "content_margin_left" })).value, 12)
      ? pass("AUTH_RESOURCE_SET_GET_PROPERTY") : fail("AUTH_RESOURCE_SET_GET_PROPERTY", `got ${(await call("resource_get_property", { path: RES, property: "content_margin_left" })).value}`);

    const sv = await call("resource_save", { from_path: RES, to_path: RES_SAVED });
    (sv.saved === RES_SAVED && (await call("resource_load", { path: RES_SAVED })).type === "StyleBoxFlat")
      ? pass("AUTH_RESOURCE_SAVE", RES_SAVED) : fail("AUTH_RESOURCE_SAVE", JSON.stringify(sv));

    const dp = await call("resource_duplicate", { path: RES, to_path: RES_DUP, deep: true });
    (dp.deep === true && (await call("resource_load", { path: RES_DUP })).type === "StyleBoxFlat")
      ? pass("AUTH_RESOURCE_DUPLICATE", RES_DUP) : fail("AUTH_RESOURCE_DUPLICATE", JSON.stringify(dp));

    // resource_get_import_settings — a .tres is not an imported asset (degrade path -> imported:false)
    //
    // 🔴 168: this claim used to be `typeof imp.imported === "boolean"`, which is true for
    // EVERY possible reply this tool can produce — including the one it produced for a file
    // that did not exist. It is the reason 166 §5 D3 had to be found by hand and then
    // survived two more releases. A tautology in a green suite is worse than no claim: it
    // reads as coverage. Replaced with claims that name the reply they demand.
    const imp = await call("resource_get_import_settings", { path: RES });
    (imp.imported === false && imp.importer === "" && imp.path === RES)
      ? pass("AUTH_RESOURCE_IMPORT_SETTINGS", `imported=${imp.imported}`) : fail("AUTH_RESOURCE_IMPORT_SETTINGS", JSON.stringify(imp));

    // 🔴 THE D3 CLAIM. A path that is not a file must REFUSE, not answer imported:false —
    // otherwise a caller cannot tell "not imported" from "not there". `call` throws on
    // isError, so the refusal is the success condition here and a reply is the failure.
    const ABSENT_ASSET = "res://_auth_probe_no_such_asset_qwerty.png";
    let absentRefused = null;
    try {
      const bad = await call("resource_get_import_settings", { path: ABSENT_ASSET });
      absentRefused = `ANSWERED ${JSON.stringify(bad)}`;
    } catch (e) {
      absentRefused = /not_found/.test(String(e.message)) ? null : `wrong code: ${e.message}`;
    }
    absentRefused === null
      ? pass("AUTH_RESOURCE_IMPORT_ABSENT", "not_found for a path that is not a file")
      : fail("AUTH_RESOURCE_IMPORT_ABSENT", absentRefused);

    // 🔴 THE D4 CLAIM, against a REAL imported asset (the addon's own icon — the only
    // committed asset in the project with a .import sidecar). `reimport: false` keeps this
    // off the editor's reimport queue; the sidecar is restored by the workspace snapshot.
    // 🔴 THE TRY/CATCH IS LOAD-BEARING, AND IT WAS ADDED BECAUSE A MUTATION EXPOSED IT.
    // Run against the pre-fix addon, the reply has no `changed` field at all, so the
    // host's structured-output validation THREW before this claim could speak: the run
    // reported the generic AUTH_RESOURCE_THREW and aborted the remaining Group B claims,
    // and the marker that exists to name this exact defect never printed. A claim that
    // cannot fail BY NAME is 167 §4's manufactured verdict wearing a different hat.
    // Catching here keeps the failure attributable and lets the rest of the family run.
    const ICON = "res://addons/breakpoint_mcp/icon.png";
    try {
      const iconGet = await call("resource_get_import_settings", { path: ICON });
      const curMode = iconGet.settings?.["compress/mode"];
      const flipped = (typeof curMode === "number" ? curMode : 0) === 1 ? 0 : 1;
      const setReal = await call("resource_set_import_settings", { path: ICON, settings: { "compress/mode": flipped }, reimport: false, confirm: true });
      const setNoop = await call("resource_set_import_settings", { path: ICON, settings: { "compress/mode": flipped }, reimport: false, confirm: true });
      // A real edit names the key; re-setting the same value names nothing. BOTH halves are
      // asserted — a `changed` hard-wired to [] would satisfy the second one on its own.
      (Array.isArray(setReal.changed) && setReal.changed.includes("compress/mode")
        && Array.isArray(setNoop.changed) && setNoop.changed.length === 0
        && setNoop.settings.includes("compress/mode"))
        ? pass("AUTH_RESOURCE_IMPORT_NOOP", `real=${JSON.stringify(setReal.changed)} noop=${JSON.stringify(setNoop.changed)}`)
        : fail("AUTH_RESOURCE_IMPORT_NOOP", `real=${JSON.stringify(setReal)} noop=${JSON.stringify(setNoop)}`);
      if (typeof curMode === "number") await call("resource_set_import_settings", { path: ICON, settings: { "compress/mode": curMode }, reimport: false, confirm: true });
    } catch (e) {
      fail("AUTH_RESOURCE_IMPORT_NOOP", `threw: ${String(e.message).slice(0, 160)}`);
    }

    // filesystem_create_dir + filesystem_list (dirs/files are bare names)
    const cd = await call("filesystem_create_dir", { path: DIR });
    const listRoot = await call("filesystem_list", { path: "res://" });
    (cd.created && listRoot.dirs.some((d) => d === "_auth_probe_dir"))
      ? pass("AUTH_RESOURCE_CREATE_DIR", DIR) : fail("AUTH_RESOURCE_CREATE_DIR", `dirs=${JSON.stringify(listRoot.dirs).slice(0, 120)}`);

    // filesystem_scan
    (await call("filesystem_scan")).scanning === true
      ? pass("AUTH_RESOURCE_FS_SCAN") : fail("AUTH_RESOURCE_FS_SCAN");

    // filesystem_move (gated): move the duplicate into the new dir
    const MOVED = DIR + "/moved.tres";
    const mv = await call("filesystem_move", { from_path: RES_DUP, to_path: MOVED });
    const listDir = await call("filesystem_list", { path: DIR });
    (mv.moved === MOVED && listDir.files.some((f) => f === "moved.tres"))
      ? pass("AUTH_RESOURCE_FS_MOVE", MOVED) : fail("AUTH_RESOURCE_FS_MOVE", `files=${JSON.stringify(listDir.files).slice(0, 120)}`);
  });

  // ---------------------------------------------------------------- Group C: animation ----
  await family("AUTH_ANIM", async () => {
    const player = (await call("anim_player_create", { parent_path: ".", name: "AuthAnimPlayer" })).path;
    (await hasChild(".", player, "AnimationPlayer")) ? pass("AUTH_ANIM_PLAYER_CREATE", player) : fail("AUTH_ANIM_PLAYER_CREATE", player);

    await call("anim_create", { player_path: player, name: "walk" });
    (await animOf(player, "walk")) ? pass("AUTH_ANIM_CREATE") : fail("AUTH_ANIM_CREATE");

    const sl = await call("anim_set_length", { player_path: player, name: "walk", length: 2.5 });
    near((await animOf(player, "walk"))?.length, 2.5)
      ? pass("AUTH_ANIM_SET_LENGTH", `prev=${sl.previous}`) : fail("AUTH_ANIM_SET_LENGTH", `got ${(await animOf(player, "walk"))?.length}`);

    const lo = await call("anim_set_loop", { player_path: player, name: "walk", mode: "linear" });
    ((await animOf(player, "walk"))?.loop_mode === "linear")
      ? pass("AUTH_ANIM_SET_LOOP", `prev=${lo.previous}`) : fail("AUTH_ANIM_SET_LOOP", `got ${(await animOf(player, "walk"))?.loop_mode}`);

    const tr = await call("anim_add_track", { player_path: player, name: "walk", path: "Sprite2D:rotation", type: "value" });
    const trackIdx = tr.track;
    (typeof trackIdx === "number" && tr.type === "value")
      ? pass("AUTH_ANIM_ADD_TRACK", `track=${trackIdx}`) : fail("AUTH_ANIM_ADD_TRACK", JSON.stringify(tr));

    const ik = await call("anim_insert_key", { player_path: player, name: "walk", track: trackIdx, time: 0.5, value: 1.5 });
    ik.key_count >= 1 ? pass("AUTH_ANIM_INSERT_KEY", `keys=${ik.key_count}`) : fail("AUTH_ANIM_INSERT_KEY", JSON.stringify(ik));

    const keys = await call("anim_get_track_keys", { player_path: player, name: "walk", track: trackIdx });
    (keys.keys.length >= 1 && near(keys.keys[0].time, 0.5))
      ? pass("AUTH_ANIM_GET_TRACK_KEYS", `n=${keys.keys.length}`) : fail("AUTH_ANIM_GET_TRACK_KEYS", JSON.stringify(keys.keys).slice(0, 120));

    await call("anim_remove_key", { player_path: player, name: "walk", track: trackIdx, key: 0 });
    (await call("anim_get_track_keys", { player_path: player, name: "walk", track: trackIdx })).keys.length === 0
      ? pass("AUTH_ANIM_REMOVE_KEY") : fail("AUTH_ANIM_REMOVE_KEY");

    // anim_list (read) — track_count reflects the added track
    ((await animOf(player, "walk"))?.track_count >= 1)
      ? pass("AUTH_ANIM_LIST") : fail("AUTH_ANIM_LIST", `track_count=${(await animOf(player, "walk"))?.track_count}`);

    // AnimationTree + blend-tree graph node (undoable in-scene)
    const bt = (await call("anim_tree_create", { parent_path: ".", name: "AuthBlendTree", root_type: "blend_tree" })).path;
    (await hasChild(".", bt, "AnimationTree")) ? pass("AUTH_ANIM_TREE_CREATE", bt) : fail("AUTH_ANIM_TREE_CREATE", bt);

    const an = await call("anim_tree_add_node", { tree_path: bt, node_name: "clipA", node_type: "AnimationNodeAnimation", animation: "walk" });
    an.node_name === "clipA" ? pass("AUTH_ANIM_TREE_ADD_NODE") : fail("AUTH_ANIM_TREE_ADD_NODE", JSON.stringify(an));

    // AnimationTree state machine + states + transition
    const sm = (await call("anim_tree_create", { parent_path: ".", name: "AuthStateMachine", root_type: "state_machine" })).path;
    await call("anim_statemachine_add_state", { tree_path: sm, state_name: "idle", animation: "walk" });
    const st2 = await call("anim_statemachine_add_state", { tree_path: sm, state_name: "run", animation: "walk" });
    st2.state_name === "run" ? pass("AUTH_ANIM_SM_ADD_STATE") : fail("AUTH_ANIM_SM_ADD_STATE", JSON.stringify(st2));

    const trn = await call("anim_statemachine_add_transition", { tree_path: sm, from_state: "idle", to_state: "run" });
    trn.transition_count >= 1 ? pass("AUTH_ANIM_SM_ADD_TRANSITION", `n=${trn.transition_count}`) : fail("AUTH_ANIM_SM_ADD_TRANSITION", JSON.stringify(trn));

    // anim_delete (gated): remove "walk"
    await call("anim_delete", { player_path: player, name: "walk" });
    !(await animOf(player, "walk")) ? pass("AUTH_ANIM_DELETE") : fail("AUTH_ANIM_DELETE");

    // undo/redo round-trip on a throwaway player (creator archetype -> scene history)
    const up = (await call("anim_player_create", { parent_path: ".", name: "AuthAnimUndoP" })).path;
    const made = await hasChild(".", up, "AnimationPlayer");
    const au = await call("editor_undo");
    const gone = !(await hasChild(".", up, "AnimationPlayer"));
    (made && au.performed === true && gone)
      ? pass("AUTH_ANIM_UNDO_CREATE") : fail("AUTH_ANIM_UNDO_CREATE", `made=${made} performed=${au.performed} gone=${gone}`);
    await call("editor_redo");
    (await hasChild(".", up, "AnimationPlayer")) ? pass("AUTH_ANIM_REDO_CREATE") : fail("AUTH_ANIM_REDO_CREATE");
  });

  // ---------------------------------------------------------------- Group D: TileSet / TileMapLayer ----
  await family("AUTH_TILEMAP", async () => {
    const TILETEX = "res://_auth_probe_tiletex.tres";
    const TILESET = "res://_auth_probe_tileset.tres";

    // atlas texture minted with a real 64x64 size so 16x16 tiles fit the grid
    await call("resource_create", { class_name: "PlaceholderTexture2D", to_path: TILETEX, properties: { size: { __type__: "Vector2", x: 64, y: 64 } } });

    // TileSet writers (disk-backed .tres, gated) — forward only
    const tc = await call("tileset_create", { to_path: TILESET, tile_size: [16, 16] });
    (tc.created === TILESET && (await call("resource_load", { path: TILESET })).type === "TileSet")
      ? pass("AUTH_TILESET_CREATE", TILESET) : fail("AUTH_TILESET_CREATE", JSON.stringify(tc));

    const src = await call("tileset_add_source", { tileset_path: TILESET, texture_path: TILETEX, texture_region_size: [16, 16] });
    const sourceId = src.source_id;
    (src.source_count >= 1 && typeof sourceId === "number")
      ? pass("AUTH_TILESET_ADD_SOURCE", `id=${sourceId}`) : fail("AUTH_TILESET_ADD_SOURCE", JSON.stringify(src));

    const at = await call("tileset_add_tile", { tileset_path: TILESET, source_id: sourceId, atlas_coords: [0, 0] });
    at.tiles_count >= 1 ? pass("AUTH_TILESET_ADD_TILE", `tiles=${at.tiles_count}`) : fail("AUTH_TILESET_ADD_TILE", JSON.stringify(at));

    const col = await call("tileset_set_tile_collision", { tileset_path: TILESET, source_id: sourceId, atlas_coords: [0, 0], polygon: [[-8, -8], [8, -8], [8, 8], [-8, 8]], physics_layer: 0 });
    (col.points >= 3 && col.physics_layer === 0)
      ? pass("AUTH_TILESET_SET_TILE_COLLISION", `points=${col.points}`) : fail("AUTH_TILESET_SET_TILE_COLLISION", JSON.stringify(col));

    // TileMapLayer (in-scene, undoable)
    const layer = (await call("tilemaplayer_create", { parent_path: ".", name: "AuthTileLayer", tileset_path: TILESET })).path;
    (await hasChild(".", layer, "TileMapLayer")) ? pass("AUTH_TILEMAP_LAYER_CREATE", layer) : fail("AUTH_TILEMAP_LAYER_CREATE", layer);

    // tilemap_set_cell (undoable) — forward + undo + redo
    await call("tilemap_set_cell", { path: layer, coords: [3, 3], source_id: sourceId, atlas_coords: [0, 0] });
    const painted = !(await call("tilemap_get_cell", { path: layer, coords: [3, 3] })).empty;
    const tu = await call("editor_undo");
    const cleared = (await call("tilemap_get_cell", { path: layer, coords: [3, 3] })).empty;
    (painted && tu.performed === true && cleared)
      ? pass("AUTH_TILEMAP_SET_CELL") : fail("AUTH_TILEMAP_SET_CELL", `painted=${painted} performed=${tu.performed} cleared=${cleared}`);
    await call("editor_redo");
    !(await call("tilemap_get_cell", { path: layer, coords: [3, 3] })).empty
      ? pass("AUTH_TILEMAP_SET_CELL_REDO") : fail("AUTH_TILEMAP_SET_CELL_REDO");

    // tilemap_set_cells_rect (undoable) — forward
    const rc = await call("tilemap_set_cells_rect", { path: layer, rect: [0, 0, 2, 2], source_id: sourceId, atlas_coords: [0, 0] });
    (rc.cells === 4 && !(await call("tilemap_get_cell", { path: layer, coords: [0, 0] })).empty)
      ? pass("AUTH_TILEMAP_SET_CELLS_RECT", `cells=${rc.cells}`) : fail("AUTH_TILEMAP_SET_CELLS_RECT", JSON.stringify(rc));

    // tilemap_get_cell (read) — the [3,3] cell reports the painted source
    ((await call("tilemap_get_cell", { path: layer, coords: [3, 3] })).source_id === sourceId)
      ? pass("AUTH_TILEMAP_GET_CELL") : fail("AUTH_TILEMAP_GET_CELL");

    // tilemap_clear (undoable) — forward
    const cl = await call("tilemap_clear", { path: layer });
    (cl.cleared_cells >= 1 && (await call("tilemap_get_cell", { path: layer, coords: [3, 3] })).empty)
      ? pass("AUTH_TILEMAP_CLEAR", `cleared=${cl.cleared_cells}`) : fail("AUTH_TILEMAP_CLEAR", JSON.stringify(cl));
  });

  // ---------------------------------------------------------------- Group E ----
  await family("AUTH_PHYS", async () => {
    const body = (await call("body_create", { parent_path: ".", type: "static", dim: "2d", name: "AuthBody" })).path;
    (await hasChild(".", body, "StaticBody2D")) ? pass("AUTH_PHYS_BODY_CREATE", body) : fail("AUTH_PHYS_BODY_CREATE", body);

    const cs = (await call("collisionshape_add", { parent_path: body, shape: "rect", dim: "2d", size: [40, 20] })).path;
    (await hasChild(body, cs, "CollisionShape2D")) ? pass("AUTH_PHYS_COLLISIONSHAPE", cs) : fail("AUTH_PHYS_COLLISIONSHAPE", cs);

    const cp = (await call("collisionpolygon_add", { parent_path: body, points: [[0, 0], [16, 0], [16, 16]], dim: "2d" })).path;
    (await hasChild(body, cp, "CollisionPolygon2D")) ? pass("AUTH_PHYS_COLLISIONPOLYGON", cp) : fail("AUTH_PHYS_COLLISIONPOLYGON", cp);

    await call("body_set_collision_layer", { path: body, layer: 5 });
    (await propVal(body, "collision_layer")) === 5 ? pass("AUTH_PHYS_LAYER") : fail("AUTH_PHYS_LAYER", `got ${await propVal(body, "collision_layer")}`);

    await call("body_set_collision_mask", { path: body, mask: 3 });
    (await propVal(body, "collision_mask")) === 3 ? pass("AUTH_PHYS_MASK") : fail("AUTH_PHYS_MASK", `got ${await propVal(body, "collision_mask")}`);

    const area = (await call("body_create", { parent_path: ".", type: "area", dim: "2d", name: "AuthArea" })).path;
    (await hasChild(".", area, "Area2D")) ? pass("AUTH_PHYS_AREA_CREATE", area) : fail("AUTH_PHYS_AREA_CREATE", area);

    await call("area_set_monitoring", { path: area, monitoring: false });
    (await propVal(area, "monitoring")) === false ? pass("AUTH_PHYS_AREA_MONITORING") : fail("AUTH_PHYS_AREA_MONITORING", `got ${await propVal(area, "monitoring")}`);

    await call("area_set_gravity", { path: area, gravity: 250 });
    near(await propVal(area, "gravity"), 250) ? pass("AUTH_PHYS_AREA_GRAVITY") : fail("AUTH_PHYS_AREA_GRAVITY", `got ${await propVal(area, "gravity")}`);

    const rigid = (await call("body_create", { parent_path: ".", type: "rigid", dim: "2d", name: "AuthRigid" })).path;
    (await hasChild(".", rigid, "RigidBody2D")) ? pass("AUTH_PHYS_RIGID_CREATE", rigid) : fail("AUTH_PHYS_RIGID_CREATE", rigid);

    await call("rigidbody_set_properties", { path: rigid, mass: 4, gravity_scale: 2 });
    near(await propVal(rigid, "mass"), 4) ? pass("AUTH_PHYS_RIGID_PROPS") : fail("AUTH_PHYS_RIGID_PROPS", `mass=${await propVal(rigid, "mass")}`);

    await call("body_set_physics_material", { path: rigid, friction: 0.3, bounce: 0.8 });
    (await propResClass(rigid, "physics_material_override")) === "PhysicsMaterial"
      ? pass("AUTH_PHYS_MATERIAL") : fail("AUTH_PHYS_MATERIAL", `class=${await propResClass(rigid, "physics_material_override")}`);

    const joint = (await call("joint_create", { parent_path: ".", type: "pin", dim: "2d", name: "AuthJoint" })).path;
    (await hasChild(".", joint, "PinJoint2D")) ? pass("AUTH_PHYS_JOINT_CREATE", joint) : fail("AUTH_PHYS_JOINT_CREATE", joint);

    await call("joint_set_bodies", { path: joint, node_a: "../AuthBody" });
    (await propNodePath(joint, "node_a")) === "../AuthBody" ? pass("AUTH_PHYS_JOINT_BODIES") : fail("AUTH_PHYS_JOINT_BODIES", `node_a=${await propNodePath(joint, "node_a")}`);

    await call("physics_set_gravity", { dim: "2d", magnitude: 137 });
    near(await settingVal("physics/2d/default_gravity"), 137) ? pass("AUTH_PHYS_PROJECT_GRAVITY") : fail("AUTH_PHYS_PROJECT_GRAVITY", `got ${await settingVal("physics/2d/default_gravity")}`);
  });

  // ---------------------------------------------------------------- Group F: particles ----
  await family("AUTH_VFX_PARTICLES", async () => {
    const p = (await call("particles_create", { parent_path: ".", dim: "2d", name: "AuthParticles", amount: 16, lifetime: 1 })).path;
    (await hasChild(".", p, "GPUParticles2D")) && (await propVal(p, "amount")) === 16
      ? pass("AUTH_VFX_PARTICLES_CREATE", p) : fail("AUTH_VFX_PARTICLES_CREATE", `${p} amount=${await propVal(p, "amount")}`);

    await call("particles_set_amount", { path: p, amount: 48 });
    (await propVal(p, "amount")) === 48 ? pass("AUTH_VFX_PARTICLES_AMOUNT") : fail("AUTH_VFX_PARTICLES_AMOUNT", `got ${await propVal(p, "amount")}`);

    await call("particles_set_lifetime", { path: p, lifetime: 3 });
    near(await propVal(p, "lifetime"), 3) ? pass("AUTH_VFX_PARTICLES_LIFETIME") : fail("AUTH_VFX_PARTICLES_LIFETIME", `got ${await propVal(p, "lifetime")}`);

    await call("particles_set_emitting", { path: p, emitting: false });
    (await propVal(p, "emitting")) === false ? pass("AUTH_VFX_PARTICLES_EMITTING") : fail("AUTH_VFX_PARTICLES_EMITTING", `got ${await propVal(p, "emitting")}`);

    await call("particles_set_process_material", { path: p, color: [1, 0, 0, 1], gravity: [0, -98, 0] });
    (await propResClass(p, "process_material")) === "ParticleProcessMaterial"
      ? pass("AUTH_VFX_PARTICLES_PROCESS_MATERIAL") : fail("AUTH_VFX_PARTICLES_PROCESS_MATERIAL", `class=${await propResClass(p, "process_material")}`);

    await call("particles_set_texture", { path: p, texture_path: TEX });
    (await propResClass(p, "texture")) === "PlaceholderTexture2D"
      ? pass("AUTH_VFX_PARTICLES_TEXTURE") : fail("AUTH_VFX_PARTICLES_TEXTURE", `class=${await propResClass(p, "texture")}`);
  });

  // ---------------------------------------------------------------- Group F: shaders ----
  await family("AUTH_VFX_SHADER", async () => {
    // shader_create already exercised in fixtures; assert it independently here too.
    (await call("resource_load", { path: SHADER_A })).type === "Shader"
      ? pass("AUTH_VFX_SHADER_CREATE", SHADER_A) : fail("AUTH_VFX_SHADER_CREATE", SHADER_A);

    const before = (await call("resource_load", { path: SHADER_A })); // Shader present
    const setRes = await call("shader_set_code", { path: SHADER_A, code: CODE_A2 });
    setRes.code_length === CODE_A2.length && before
      ? pass("AUTH_VFX_SHADER_SET_CODE", `len=${setRes.code_length}`) : fail("AUTH_VFX_SHADER_SET_CODE", `len=${setRes.code_length} want=${CODE_A2.length}`);

    await call("shadermaterial_create", { path: "Sprite2D", shader_path: SHADER_A });
    (await propResClass("Sprite2D", "material")) === "ShaderMaterial"
      ? pass("AUTH_VFX_SHADERMATERIAL_CREATE") : fail("AUTH_VFX_SHADERMATERIAL_CREATE", `class=${await propResClass("Sprite2D", "material")}`);

    const ss = await call("shadermaterial_set_shader", { path: "Sprite2D", shader_path: SHADER_B });
    ss.shader_path === SHADER_B ? pass("AUTH_VFX_SHADERMATERIAL_SET_SHADER") : fail("AUTH_VFX_SHADERMATERIAL_SET_SHADER", `shader_path=${ss.shader_path}`);

    const sp = await call("shadermaterial_set_param", { path: "Sprite2D", param: "amount", value: 0.25 });
    near(sp.value, 0.25) ? pass("AUTH_VFX_SHADERMATERIAL_SET_PARAM") : fail("AUTH_VFX_SHADERMATERIAL_SET_PARAM", `value=${JSON.stringify(sp.value)}`);
  });

  // ---------------------------------------------------------------- Group F: audio ----
  await family("AUTH_AUDIO", async () => {
    const player = (await call("audio_player_create", { parent_path: ".", dim: "none", name: "AuthAudio", volume_db: -6 })).path;
    (await hasChild(".", player, "AudioStreamPlayer")) && near(await propVal(player, "volume_db"), -6)
      ? pass("AUTH_AUDIO_PLAYER_CREATE", player) : fail("AUTH_AUDIO_PLAYER_CREATE", `${player} vol=${await propVal(player, "volume_db")}`);

    await call("audio_set_stream", { path: player, stream_path: AUDIO });
    (await propResClass(player, "stream")) === "AudioStreamWAV"
      ? pass("AUTH_AUDIO_SET_STREAM") : fail("AUTH_AUDIO_SET_STREAM", `class=${await propResClass(player, "stream")}`);

    // THE AUDIOSERVER IS GLOBAL TO THE EDITOR PROCESS, and nothing here removes a bus —
    // there is no audio_bus_remove tool, and adding one would be new tool surface for a
    // test's convenience. So on a SECOND run against the same live editor the name is
    // already taken and Godot dedupes it to "AuthBus 2". That is correct engine
    // behaviour, but the old `add.name === "AuthBus"` rejected it.
    //
    // Nobody had ever seen this, because until session 148 a re-run also needed a
    // `git checkout` to undo the filesystem side, and in practice that meant restarting
    // the editor — which reset the AudioServer and hid the collision. Making the disk
    // side idempotent is what made this observable: the same shape as 147, where the
    // finding came from the tooling the errand forced rather than the errand's result.
    const add = await call("audio_bus_add", { name: "AuthBus" });
    const BUS = add.name;
    // Accept the requested name or Godot's deduped variant; assert the things that are
    // true either way — a bus was added, and the index addresses a real non-Master slot.
    ((BUS === "AuthBus" || /^AuthBus \d+$/.test(BUS)) && add.count >= 2 && Number.isInteger(add.index) && add.index >= 1)
      ? pass("AUTH_AUDIO_BUS_ADD", `name=${BUS} idx=${add.index} count=${add.count}`)
      : fail("AUTH_AUDIO_BUS_ADD", JSON.stringify(add));

    // Drive the rest off the name the tool RETURNED, not the one we asked for. On a
    // re-run the literal "AuthBus" is the bus the PREVIOUS run created, so the old code
    // added a second reverb to a stale bus and asserted against it — passing (effect_count
    // rose to 2) while measuring the wrong object entirely.
    const fx = await call("audio_bus_add_effect", { bus: BUS, effect: "AudioEffectReverb" });
    fx.effect_count >= 1 ? pass("AUTH_AUDIO_BUS_ADD_EFFECT", `count=${fx.effect_count}`) : fail("AUTH_AUDIO_BUS_ADD_EFFECT", JSON.stringify(fx));

    const vol = await call("audio_bus_set_volume", { bus: BUS, volume_db: -12 });
    near(vol.volume_db, -12) ? pass("AUTH_AUDIO_BUS_SET_VOLUME") : fail("AUTH_AUDIO_BUS_SET_VOLUME", `got ${vol.volume_db}`);

    await call("audio_set_bus_layout", { to_path: BUS_LAYOUT });
    (await call("resource_load", { path: BUS_LAYOUT })).type === "AudioBusLayout"
      ? pass("AUTH_AUDIO_SET_BUS_LAYOUT", BUS_LAYOUT) : fail("AUTH_AUDIO_SET_BUS_LAYOUT", BUS_LAYOUT);
  });

  // ---------------------------------------------------------------- Group G: UI / control / theming ----
  // control_* + container_add_child mutate the edited scene (undoable, ungated); theme_* write a
  // Theme .tres on disk (gated, asserted forward via the mutator echo + an independent Theme reload).
  const THEME = "res://_auth_probe.theme.tres";
  const SBOX = "res://_auth_probe_sbox.tres";
  const FONT = "res://_auth_probe_font.tres";
  await family("AUTH_UI", async () => {
    const uiroot = (await call("control_create", { parent_path: ".", type: "Control", name: "AuthUIRoot" })).path;
    const btn = (await call("control_create", { parent_path: uiroot, type: "Button", name: "AuthButton", text: "Hi" })).path;
    ((await hasChild(uiroot, btn, "Button")) && (await propVal(btn, "text")) === "Hi")
      ? pass("AUTH_UI_CONTROL_CREATE", `${btn} text=${await propVal(btn, "text")}`)
      : fail("AUTH_UI_CONTROL_CREATE", `${btn} text=${await propVal(btn, "text")}`);

    const vbox = (await call("control_create", { parent_path: uiroot, type: "VBoxContainer", name: "AuthVBox" })).path;
    const lbl = (await call("container_add_child", { container_path: vbox, type: "Label", name: "AuthLabel" })).path;
    (await hasChild(vbox, lbl, "Label"))
      ? pass("AUTH_UI_CONTAINER_ADD_CHILD", lbl) : fail("AUTH_UI_CONTAINER_ADD_CHILD", lbl);

    await call("control_set_anchors", { path: btn, right: 1, bottom: 1 });
    (near(await propVal(btn, "anchor_right"), 1) && near(await propVal(btn, "anchor_bottom"), 1))
      ? pass("AUTH_UI_SET_ANCHORS") : fail("AUTH_UI_SET_ANCHORS", `r=${await propVal(btn, "anchor_right")} b=${await propVal(btn, "anchor_bottom")}`);

    const lp = await call("control_set_layout_preset", { path: btn, preset: "full_rect" });
    (lp.preset_name === "full_rect" && near(await propVal(btn, "anchor_left"), 0) && near(await propVal(btn, "anchor_right"), 1))
      ? pass("AUTH_UI_SET_LAYOUT_PRESET", `preset=${lp.preset}`) : fail("AUTH_UI_SET_LAYOUT_PRESET", JSON.stringify(lp));

    await call("control_set_size_flags", { path: btn, horizontal: 3 });
    (await propVal(btn, "size_flags_horizontal")) === 3
      ? pass("AUTH_UI_SET_SIZE_FLAGS") : fail("AUTH_UI_SET_SIZE_FLAGS", `got ${await propVal(btn, "size_flags_horizontal")}`);

    await call("theme_create", { to_path: THEME });
    (await call("resource_load", { path: THEME })).type === "Theme"
      ? pass("AUTH_UI_THEME_CREATE", THEME) : fail("AUTH_UI_THEME_CREATE", THEME);

    const tcol = await call("theme_set_color", { path: THEME, name: "font_color", theme_type: "Button", color: [1, 0, 0, 1] });
    (tcol.color[0] === 1 && (await call("resource_load", { path: THEME })).type === "Theme")
      ? pass("AUTH_UI_THEME_SET_COLOR") : fail("AUTH_UI_THEME_SET_COLOR", JSON.stringify(tcol));

    const tconst = await call("theme_set_constant", { path: THEME, name: "h_separation", theme_type: "HBoxContainer", value: 7 });
    tconst.value === 7 ? pass("AUTH_UI_THEME_SET_CONSTANT") : fail("AUTH_UI_THEME_SET_CONSTANT", JSON.stringify(tconst));

    await call("resource_create", { class_name: "StyleBoxFlat", to_path: SBOX });
    const tsb = await call("theme_set_stylebox", { path: THEME, name: "normal", theme_type: "Button", stylebox_path: SBOX });
    tsb.stylebox_path === SBOX ? pass("AUTH_UI_THEME_SET_STYLEBOX") : fail("AUTH_UI_THEME_SET_STYLEBOX", JSON.stringify(tsb));

    await call("resource_create", { class_name: "SystemFont", to_path: FONT });
    const tfont = await call("theme_set_font", { path: THEME, name: "font", theme_type: "Label", font_path: FONT });
    tfont.font_path === FONT ? pass("AUTH_UI_THEME_SET_FONT") : fail("AUTH_UI_THEME_SET_FONT", JSON.stringify(tfont));

    await call("control_set_theme", { path: btn, theme_path: THEME });
    (await propResClass(btn, "theme")) === "Theme"
      ? pass("AUTH_UI_SET_THEME") : fail("AUTH_UI_SET_THEME", `class=${await propResClass(btn, "theme")}`);

    // Undo round-trip proves the control mutators push a reversible EditorUndoRedoManager action.
    const panel = (await call("control_create", { parent_path: uiroot, type: "Panel", name: "AuthUndoPanel" })).path;
    const pmade = await hasChild(uiroot, panel, "Panel");
    const pu = await call("editor_undo");
    const pgone = !(await hasChild(uiroot, panel, "Panel"));
    (pmade && pu.performed === true && pgone)
      ? pass("AUTH_UI_UNDO_CREATE", `action=${JSON.stringify(pu.action)}`) : fail("AUTH_UI_UNDO_CREATE", `made=${pmade} performed=${pu.performed} gone=${pgone}`);
    const pr = await call("editor_redo");
    (pr.performed === true && (await hasChild(uiroot, panel, "Panel")))
      ? pass("AUTH_UI_REDO_CREATE") : fail("AUTH_UI_REDO_CREATE", `performed=${pr.performed}`);
  });

  // ---------------------------------------------------------------- Group H: 3D & navigation ----
  // meshinstance/mesh/light/camera/csg/navregion/navagent mutate the edited scene (undoable, ungated);
  // primitive_mesh_create + environment_* write a resource .tres on disk (gated, asserted via the
  // mutator echo + an independent resource_load). A creator undo/redo round-trip proves reversibility.
  const BOXMESH = "res://_auth_probe_box.mesh.tres";
  const MAT3D = "res://_auth_probe_mat3d.tres";
  const ENV = "res://_auth_probe_env.tres";
  await family("AUTH_3D", async () => {
    const d3root = (await call("meshinstance_create", { parent_path: ".", name: "Auth3DRoot" })).path;
    (await hasChild(".", d3root, "MeshInstance3D"))
      ? pass("AUTH_3D_MESHINSTANCE_CREATE", d3root) : fail("AUTH_3D_MESHINSTANCE_CREATE", d3root);

    const pm = await call("primitive_mesh_create", { to_path: BOXMESH, shape: "box" });
    (pm.type === "BoxMesh" && (await call("resource_load", { path: BOXMESH })).type === "BoxMesh")
      ? pass("AUTH_3D_PRIMITIVE_MESH_CREATE", pm.type) : fail("AUTH_3D_PRIMITIVE_MESH_CREATE", JSON.stringify(pm));

    const boxmi = (await call("meshinstance_create", { parent_path: d3root, name: "AuthBox", mesh_path: BOXMESH })).path;
    (await propResClass(boxmi, "mesh")) === "BoxMesh"
      ? pass("AUTH_3D_MESHINSTANCE_WITH_MESH", boxmi) : fail("AUTH_3D_MESHINSTANCE_WITH_MESH", `class=${await propResClass(boxmi, "mesh")}`);

    await call("resource_create", { class_name: "StandardMaterial3D", to_path: MAT3D });
    const sm = await call("mesh_set_surface_material", { path: boxmi, material_path: MAT3D });
    (sm.material_path === MAT3D && (await propResClass(boxmi, "material_override")) === "StandardMaterial3D")
      ? pass("AUTH_3D_MESH_SET_SURFACE_MATERIAL", `surface=${sm.surface}`) : fail("AUTH_3D_MESH_SET_SURFACE_MATERIAL", JSON.stringify(sm));

    const light = (await call("light_create", { parent_path: d3root, kind: "spot", name: "AuthSpot" })).path;
    (await hasChild(d3root, light, "SpotLight3D"))
      ? pass("AUTH_3D_LIGHT_CREATE", light) : fail("AUTH_3D_LIGHT_CREATE", light);

    const cam = await call("camera_create", { parent_path: d3root, name: "AuthCam", current: true });
    ((await hasChild(d3root, cam.path, "Camera3D")) && (await propVal(cam.path, "current")) === true)
      ? pass("AUTH_3D_CAMERA_CREATE", cam.path) : fail("AUTH_3D_CAMERA_CREATE", `current=${await propVal(cam.path, "current")}`);

    const csg = (await call("csg_create", { parent_path: d3root, shape: "sphere", name: "AuthCSG" })).path;
    (await hasChild(d3root, csg, "CSGSphere3D"))
      ? pass("AUTH_3D_CSG_CREATE", csg) : fail("AUTH_3D_CSG_CREATE", csg);

    const nav = await call("navregion_create", { parent_path: d3root, name: "AuthNavRegion" });
    ((await hasChild(d3root, nav.path, "NavigationRegion3D")) && nav.has_navmesh === true)
      ? pass("AUTH_3D_NAVREGION_CREATE", nav.path) : fail("AUTH_3D_NAVREGION_CREATE", JSON.stringify(nav));

    const agent = await call("navagent_configure", { parent_path: boxmi, name: "AuthAgent", radius: 1.5, max_speed: 8 });
    ((await hasChild(boxmi, agent.path, "NavigationAgent3D")) && near(await propVal(agent.path, "radius"), 1.5) && near(await propVal(agent.path, "max_speed"), 8))
      ? pass("AUTH_3D_NAVAGENT_CONFIGURE", `r=${agent.config.radius} v=${agent.config.max_speed}`) : fail("AUTH_3D_NAVAGENT_CONFIGURE", JSON.stringify(agent.config));

    const env = await call("environment_create", { to_path: ENV, background: "clear_color" });
    (env.type === "Environment" && (await call("resource_load", { path: ENV })).type === "Environment")
      ? pass("AUTH_3D_ENVIRONMENT_CREATE", env.background_mode) : fail("AUTH_3D_ENVIRONMENT_CREATE", JSON.stringify(env));

    const sky = await call("environment_set_sky", { path: ENV, sky_material: "procedural" });
    (sky.sky_material === "procedural" && sky.background_mode === "sky" && (await call("resource_load", { path: ENV })).type === "Environment")
      ? pass("AUTH_3D_ENVIRONMENT_SET_SKY") : fail("AUTH_3D_ENVIRONMENT_SET_SKY", JSON.stringify(sky));

    // Creator undo/redo round-trip proves the 3D scene mutators push a reversible action.
    const tmp = (await call("light_create", { parent_path: d3root, kind: "omni", name: "AuthUndoLight" })).path;
    const lmade = await hasChild(d3root, tmp, "OmniLight3D");
    const lu = await call("editor_undo");
    const lgone = !(await hasChild(d3root, tmp, "OmniLight3D"));
    (lmade && lu.performed === true && lgone)
      ? pass("AUTH_3D_UNDO_CREATE") : fail("AUTH_3D_UNDO_CREATE", `made=${lmade} performed=${lu.performed} gone=${lgone}`);
    const lr = await call("editor_redo");
    (lr.performed === true && (await hasChild(d3root, tmp, "OmniLight3D")))
      ? pass("AUTH_3D_REDO_CREATE") : fail("AUTH_3D_REDO_CREATE", `performed=${lr.performed}`);
  });

  // ---------------------------------------------------------------- Group I: input / project config / testing ----
  // inputmap_* / project_* / editorsettings_* mutate ProjectSettings or the editor config
  // (gated, NOT the scene undo history) — asserted forward-only via a read-back tool
  // (inputmap_list / project_get_setting / project_list_settings / project_get_info) or the
  // mutator echo. ProjectSettings writers run with save:false (in-memory, vanish on close);
  // project_add_export_preset writes res://export_presets.cfg (cleaned up out-of-band);
  // editorsettings_get_set is exercised get-then-set-to-the-same-value (net-zero on disk).
  await family("AUTH_GROUPI", async () => {
    const ACT = "auth_probe_action";

    const iaa = await call("inputmap_add_action", { name: ACT, deadzone: 0.3 });
    (iaa.action === ACT && near(iaa.deadzone, 0.3))
      ? pass("AUTH_GROUPI_INPUTMAP_ADD_ACTION", `deadzone=${iaa.deadzone}`) : fail("AUTH_GROUPI_INPUTMAP_ADD_ACTION", JSON.stringify(iaa));

    const iae = await call("inputmap_add_event", { name: ACT, event: { type: "key", keycode: "A" } });
    (iae.event_count === 1 && iae.event_class === "InputEventKey")
      ? pass("AUTH_GROUPI_INPUTMAP_ADD_EVENT", `class=${iae.event_class}`) : fail("AUTH_GROUPI_INPUTMAP_ADD_EVENT", JSON.stringify(iae));

    const listed = ((await call("inputmap_list")).actions || []).find((a) => a.name === ACT);
    (listed && listed.events.length === 1 && listed.events[0].class === "InputEventKey")
      ? pass("AUTH_GROUPI_INPUTMAP_LIST", `events=${listed ? listed.events.length : "?"}`) : fail("AUTH_GROUPI_INPUTMAP_LIST", JSON.stringify(listed));

    const era = await call("inputmap_erase_action", { name: ACT });
    const actGone = !((await call("inputmap_list")).actions || []).some((a) => a.name === ACT);
    (era.erased === true && actGone)
      ? pass("AUTH_GROUPI_INPUTMAP_ERASE_ACTION") : fail("AUTH_GROUPI_INPUTMAP_ERASE_ACTION", `erased=${era.erased} gone=${actGone}`);

    const ala = await call("project_add_autoload", { name: "AuthProbeAuto", path: "res://gcb_smoke.gd" });
    (ala.autoload === "AuthProbeAuto" && ala.enabled === true && (await settingVal("autoload/AuthProbeAuto")) === "*res://gcb_smoke.gd")
      ? pass("AUTH_GROUPI_PROJECT_ADD_AUTOLOAD", ala.path) : fail("AUTH_GROUPI_PROJECT_ADD_AUTOLOAD", JSON.stringify(ala));

    const alr = await call("project_remove_autoload", { name: "AuthProbeAuto" });
    const autoGone = !((await call("project_list_settings", { prefix: "autoload/" })).settings || []).some((s) => s.name === "autoload/AuthProbeAuto");
    (alr.removed === true && autoGone)
      ? pass("AUTH_GROUPI_PROJECT_REMOVE_AUTOLOAD") : fail("AUTH_GROUPI_PROJECT_REMOVE_AUTOLOAD", `removed=${alr.removed} gone=${autoGone}`);

    const sms = await call("project_set_main_scene", { path: "res://main.tscn" });
    (sms.main_scene === "res://main.tscn" && (await call("project_get_info")).main_scene === "res://main.tscn")
      ? pass("AUTH_GROUPI_PROJECT_SET_MAIN_SCENE", sms.main_scene) : fail("AUTH_GROUPI_PROJECT_SET_MAIN_SCENE", JSON.stringify(sms));

    const pep = await call("project_add_export_preset", { name: "AuthProbePreset", platform: "Windows Desktop" });
    (pep.preset === "AuthProbePreset" && typeof pep.index === "number" && pep.path === "res://export_presets.cfg")
      ? pass("AUTH_GROUPI_PROJECT_ADD_EXPORT_PRESET", `index=${pep.index}`) : fail("AUTH_GROUPI_PROJECT_ADD_EXPORT_PRESET", JSON.stringify(pep));

    const pls = await call("project_list_settings", { prefix: "application/config/" });
    (pls.count > 0 && (pls.settings || []).some((s) => s.name === "application/config/name"))
      ? pass("AUTH_GROUPI_PROJECT_LIST_SETTINGS", `count=${pls.count}`) : fail("AUTH_GROUPI_PROJECT_LIST_SETTINGS", JSON.stringify(pls).slice(0, 120));

    const esg = await call("editorsettings_get_set", { name: "interface/editor/code_font_size" });
    (esg.mode === "get" && typeof esg.value === "number")
      ? pass("AUTH_GROUPI_EDITORSETTINGS_GET", `v=${esg.value}`) : fail("AUTH_GROUPI_EDITORSETTINGS_GET", JSON.stringify(esg));
    // set the same value back (net-zero) to exercise the write path without changing config.
    const ess = await call("editorsettings_get_set", { name: "interface/editor/code_font_size", value: esg.value });
    (ess.mode === "set" && ess.value === esg.value)
      ? pass("AUTH_GROUPI_EDITORSETTINGS_SET") : fail("AUTH_GROUPI_EDITORSETTINGS_SET", JSON.stringify(ess));

    const td = await call("test_detect");
    (td.framework === "none")
      ? pass("AUTH_GROUPI_TEST_DETECT", td.framework) : fail("AUTH_GROUPI_TEST_DETECT", JSON.stringify(td));

    const tl = await call("test_list");
    (tl.count === 0 && Array.isArray(tl.tests))
      ? pass("AUTH_GROUPI_TEST_LIST", `count=${tl.count}`) : fail("AUTH_GROUPI_TEST_LIST", JSON.stringify(tl));
  });

  // ---------------------------------------------------------------- Group K: knowledge & search ----
  // Read-only. Four host-side project-index tools search the example project's files; two
  // ClassDB-backed tools query the live editor's ClassDB. No mutations, so nothing to undo.
  await family("AUTH_K", async () => {
    // project_search: example/player.gd declares take_damage().
    const ps = await call("project_search", { query: "take_damage" });
    (Array.isArray(ps.matches) && ps.count >= 1 && ps.matches.some((m) => String(m.file).includes("player.gd") && m.line >= 1 && m.column >= 1))
      ? pass("AUTH_K_PROJECT_SEARCH", `count=${ps.count}`)
      : fail("AUTH_K_PROJECT_SEARCH", JSON.stringify(ps).slice(0, 200));

    const psr = await call("project_search", { query: "func\\s+\\w+", regex: true });
    (psr.regex === true && psr.count >= 1)
      ? pass("AUTH_K_PROJECT_SEARCH_REGEX", `count=${psr.count}`)
      : fail("AUTH_K_PROJECT_SEARCH_REGEX", JSON.stringify(psr).slice(0, 200));

    // find_symbol: take_damage is a func declaration.
    const fsym = await call("find_symbol", { name: "take_damage", kinds: ["func"] });
    (fsym.count >= 1 && fsym.matches.some((m) => m.symbol === "take_damage" && m.kind === "func"))
      ? pass("AUTH_K_FIND_SYMBOL", `count=${fsym.count}`)
      : fail("AUTH_K_FIND_SYMBOL", JSON.stringify(fsym).slice(0, 200));

    // find_usages: counter is referenced several times in player.gd (word-boundary).
    const fu = await call("find_usages", { name: "counter" });
    (fu.count >= 2 && fu.usages.every((u) => u.line >= 1 && u.column >= 1))
      ? pass("AUTH_K_FIND_USAGES", `count=${fu.count}`)
      : fail("AUTH_K_FIND_USAGES", JSON.stringify(fu).slice(0, 200));

    // example_snippet: keyword match + full topic listing when queried.
    const es = await call("example_snippet", { query: "connect signal" });
    (es.count >= 1 && Array.isArray(es.available) && es.available.length >= 10 && es.snippets[0] && typeof es.snippets[0].code === "string")
      ? pass("AUTH_K_EXAMPLE_SNIPPET", `id=${es.snippets[0] && es.snippets[0].id}`)
      : fail("AUTH_K_EXAMPLE_SNIPPET", JSON.stringify(es).slice(0, 200));

    // class_reference: Node2D via ClassDB — typed signatures, parent, docs URL.
    const cr = await call("class_reference", { class_name: "Node2D" });
    (cr.class === "Node2D" && typeof cr.parent === "string" && cr.parent.length > 0
      && Array.isArray(cr.methods) && cr.methods.every((m) => typeof m.return_type === "string" && Array.isArray(m.args))
      && Array.isArray(cr.properties) && (cr.methods.length + cr.properties.length) > 0
      && String(cr.docs_url).includes("class_node2d"))
      ? pass("AUTH_K_CLASS_REFERENCE", `parent=${cr.parent} methods=${cr.methods.length} props=${cr.properties.length}`)
      : fail("AUTH_K_CLASS_REFERENCE", JSON.stringify({ class: cr.class, parent: cr.parent, m: (cr.methods || []).length, p: (cr.properties || []).length }).slice(0, 200));

    // class_reference member filter narrows to a single method.
    const crm = await call("class_reference", { class_name: "Node", member: "add_child" });
    (Array.isArray(crm.methods) && crm.methods.some((m) => m.name === "add_child"))
      ? pass("AUTH_K_CLASS_REFERENCE_MEMBER", `methods=${crm.methods.length}`)
      : fail("AUTH_K_CLASS_REFERENCE_MEMBER", JSON.stringify((crm.methods || []).map((m) => m.name)).slice(0, 200));

    // docs_search: class-name hit + scoped member hit, each with a canonical docs URL.
    const dc = await call("docs_search", { query: "Node2D", kind: "class" });
    (dc.count >= 1 && dc.results.some((r) => r.class === "Node2D" && r.kind === "class" && String(r.docs_url).includes("class_node2d")))
      ? pass("AUTH_K_DOCS_SEARCH_CLASS", `count=${dc.count}`)
      : fail("AUTH_K_DOCS_SEARCH_CLASS", JSON.stringify(dc).slice(0, 200));

    const dm = await call("docs_search", { query: "add_child", class_name: "Node", kind: "method" });
    (dm.results.some((r) => r.member === "add_child" && r.kind === "method" && String(r.docs_url).includes("#class-node-method-add-child")))
      ? pass("AUTH_K_DOCS_SEARCH_MEMBER", `count=${dm.count}`)
      : fail("AUTH_K_DOCS_SEARCH_MEMBER", JSON.stringify(dm).slice(0, 200));
  });

  // ---------------------------------------------------------------- Group J ----
  // Asset generation. The placeholder path mints deterministic in-engine assets and
  // imports them (proving the real editor import pipeline); the degrade path returns a
  // request spec with no file; the command backend round-trips a fixture generator's
  // output through the editor import. asset_gen_configure is host-side session state.
  await family("AUTH_ASSETGEN", async () => {
    const resType = async (p) => (await call("resource_load", { path: p })).type;

    // configure: default is the "none" backend (off by default).
    const cfg0 = await call("asset_gen_configure");
    (cfg0.backend === "none" && cfg0.configured === false && Array.isArray(cfg0.supported_kinds) && cfg0.supported_kinds.length === 5)
      ? pass("AUTH_ASSETGEN_CONFIGURE_DEFAULT", `kinds=${cfg0.supported_kinds.length}`)
      : fail("AUTH_ASSETGEN_CONFIGURE_DEFAULT", JSON.stringify(cfg0).slice(0, 200));

    // degrade: with no backend a typed generator writes nothing and returns a request spec.
    const deg = await call("asset_gen_sprite", { prompt: "a hero", to_path: "res://_asset_probe_degrade.png", width: 16 });
    (deg.status === "no_backend" && deg.path === null && deg.request && deg.request.kind === "sprite" && deg.request.to_path === "res://_asset_probe_degrade.png")
      ? pass("AUTH_ASSETGEN_DEGRADE", "status=no_backend")
      : fail("AUTH_ASSETGEN_DEGRADE", JSON.stringify(deg).slice(0, 200));

    // placeholder image kinds: minted as native ImageTexture .tres the editor loads back.
    for (const [kind, p, w] of [["sprite", "res://_asset_probe_sprite.tres", 32], ["texture", "res://_asset_probe_texture.tres", 32], ["icon", "res://_asset_probe_icon.tres", 32]]) {
      const r = await call("asset_gen_placeholder", { kind, to_path: p, prompt: "coin", width: w, height: w });
      const loadedType = await resType(p).catch(() => undefined);
      (r.status === "placeholder" && r.kind === kind && r.bytes > 0 && String(r.imported_type || "").includes("Texture") && String(loadedType || "").includes("Texture"))
        ? pass(`AUTH_ASSETGEN_PLACEHOLDER_${kind.toUpperCase()}`, `type=${r.imported_type} bytes=${r.bytes}`)
        : fail(`AUTH_ASSETGEN_PLACEHOLDER_${kind.toUpperCase()}`, JSON.stringify({ r, loadedType }).slice(0, 220));
    }

    // placeholder audio: an AudioStreamWAV .tres, loadable.
    const au = await call("asset_gen_placeholder", { kind: "audio_sfx", to_path: "res://_asset_probe_sfx.tres", prompt: "blip", duration_ms: 120 });
    const auType = await resType("res://_asset_probe_sfx.tres").catch(() => undefined);
    (au.status === "placeholder" && au.imported_type === "AudioStreamWAV" && auType === "AudioStreamWAV")
      ? pass("AUTH_ASSETGEN_PLACEHOLDER_AUDIO", `type=${au.imported_type}`)
      : fail("AUTH_ASSETGEN_PLACEHOLDER_AUDIO", JSON.stringify({ au, auType }).slice(0, 220));

    // placeholder model: a primitive mesh .tres, loadable.
    const md = await call("asset_gen_placeholder", { kind: "model", to_path: "res://_asset_probe_model.tres", prompt: "rock", shape: "box" });
    const mdType = await resType("res://_asset_probe_model.tres").catch(() => undefined);
    (md.status === "placeholder" && String(md.imported_type || "").includes("Mesh") && String(mdType || "").includes("Mesh"))
      ? pass("AUTH_ASSETGEN_PLACEHOLDER_MODEL", `type=${md.imported_type}`)
      : fail("AUTH_ASSETGEN_PLACEHOLDER_MODEL", JSON.stringify({ md, mdType }).slice(0, 220));

    // placeholder:true forces the in-engine path on a typed generator (no backend needed).
    const forced = await call("asset_gen_texture", { prompt: "brick wall", to_path: "res://_asset_probe_forced.tres", placeholder: true, width: 24 });
    (forced.status === "placeholder" && forced.kind === "texture" && forced.bytes > 0)
      ? pass("AUTH_ASSETGEN_PLACEHOLDER_FORCE", `bytes=${forced.bytes}`)
      : fail("AUTH_ASSETGEN_PLACEHOLDER_FORCE", JSON.stringify(forced).slice(0, 200));

    // determinism: the same prompt+size yields byte-identical PIXELS (the generator is a
    // pure function of the prompt hash). The only variation between two saves is the random
    // uid / sub-resource id ResourceSaver stamps into the .tres header (≤ a couple bytes) —
    // different pixels would differ by hundreds of bytes, so a tight tolerance still catches it.
    const d1 = await call("asset_gen_placeholder", { kind: "sprite", to_path: "res://_asset_probe_det_a.tres", prompt: "gem", width: 20 });
    const d2 = await call("asset_gen_placeholder", { kind: "sprite", to_path: "res://_asset_probe_det_b.tres", prompt: "gem", width: 20 });
    (d1.bytes > 0 && Math.abs(d1.bytes - d2.bytes) <= 8)
      ? pass("AUTH_ASSETGEN_DETERMINISTIC", `bytes≈${d1.bytes}`)
      : fail("AUTH_ASSETGEN_DETERMINISTIC", JSON.stringify({ a: d1.bytes, b: d2.bytes }).slice(0, 120));

    // command backend: a fixture generator writes a resource; the host imports it end-to-end
    // (a native .tres so the round-trip is synchronous — external formats import asynchronously).
    const fixture = path.join(os.tmpdir(), "breakpoint_assetgen_fixture.cjs");
    fs.writeFileSync(fixture, `const fs=require('fs');fs.writeFileSync(process.argv[2],'[gd_resource type="Resource" format=3]\\n\\n[resource]\\n');\n`);
    const cfgc = await call("asset_gen_configure", { backend: "command", command: `node ${fixture} {output}`, provider: "fixture" });
    if (cfgc.backend !== "command") {
      fail("AUTH_ASSETGEN_COMMAND_CONFIGURE", JSON.stringify(cfgc).slice(0, 160));
    } else {
      pass("AUTH_ASSETGEN_COMMAND_CONFIGURE", `provider=${cfgc.provider}`);
      const gen = await call("asset_gen_model", { prompt: "backend rock", to_path: "res://_asset_probe_cmd.tres" });
      const cmdType = await resType("res://_asset_probe_cmd.tres").catch(() => undefined);
      (gen.status === "generated" && gen.backend === "command" && gen.bytes > 0 && gen.imported_type === "Resource" && cmdType === "Resource")
        ? pass("AUTH_ASSETGEN_COMMAND", `type=${gen.imported_type} bytes=${gen.bytes}`)
        : fail("AUTH_ASSETGEN_COMMAND", JSON.stringify({ gen, cmdType }).slice(0, 220));
    }
    // Restore the default backend so nothing leaks into other state.
    await call("asset_gen_configure", { backend: "none" });
  });

  // ---------------------------------------------------------------- Group M: netcode scaffolding ----
  // mp_add_spawner / mp_add_synchronizer / mp_set_authority mutate the edited scene (undoable, ungated);
  // the four codegen tools write a res:// .gd (gated) — asserted via an independent resource_load
  // (a written .gd loads back as a GDScript). mp_setup_webrtc_peer is feature-detected: on a build
  // without the WebRTC module it degrades to status:"unsupported" (nothing written) — accepted either way.
  await family("AUTH_MP", async () => {
    const ENET = "res://_auth_probe_enet.gd";
    const WEBRTC = "res://_auth_probe_webrtc.gd";
    const LOBBY = "res://_auth_probe_lobby.gd";
    const authorityOf = async (p) => (await call("node_call_method", { path: p, method: "get_multiplayer_authority", confirm: true })).result;

    // mp_add_spawner (undoable) — forward + undo + redo; spawn_path + a spawnable scene echo.
    const spawner = (await call("mp_add_spawner", { parent_path: ".", name: "AuthSpawner", spawn_path: "../AuthSpawnRoot", spawnable_scenes: ["res://main.tscn"] }));
    const spMade = await hasChild(".", spawner.path, "MultiplayerSpawner");
    const su = await call("editor_undo");
    const spGone = !(await hasChild(".", spawner.path, "MultiplayerSpawner"));
    (spMade && spawner.spawnable_scenes.includes("res://main.tscn") && su.performed === true && spGone)
      ? pass("AUTH_MP_ADD_SPAWNER", `spawn_path=${spawner.spawn_path}`)
      : fail("AUTH_MP_ADD_SPAWNER", `made=${spMade} scenes=${JSON.stringify(spawner.spawnable_scenes)} performed=${su.performed} gone=${spGone}`);
    const sr = await call("editor_redo");
    (sr.performed === true && (await hasChild(".", spawner.path, "MultiplayerSpawner")))
      ? pass("AUTH_MP_ADD_SPAWNER_REDO") : fail("AUTH_MP_ADD_SPAWNER_REDO", `performed=${sr.performed}`);

    // mp_add_synchronizer (undoable) — a SceneReplicationConfig is built from the property list.
    const sync = (await call("mp_add_synchronizer", { parent_path: ".", name: "AuthSync", properties: [".:position", ".:rotation"] }));
    const syncMade = await hasChild(".", sync.path, "MultiplayerSynchronizer");
    const cfgClass = await propResClass(sync.path, "replication_config");
    (syncMade && cfgClass === "SceneReplicationConfig" && sync.properties.length === 2)
      ? pass("AUTH_MP_ADD_SYNCHRONIZER", `cfg=${cfgClass} props=${sync.properties.length}`)
      : fail("AUTH_MP_ADD_SYNCHRONIZER", `made=${syncMade} cfg=${cfgClass} props=${JSON.stringify(sync.properties)}`);

    // mp_set_authority (undoable) — set to 42, read back via get_multiplayer_authority, undo -> previous, redo -> 42.
    const anode = (await call("node_add", { parent_path: ".", type: "Node2D", name: "AuthMPAuthority" })).path;
    const setA = await call("mp_set_authority", { path: anode, peer_id: 42, recursive: false });
    const gotA = await authorityOf(anode);
    const au = await call("editor_undo");
    const backA = await authorityOf(anode);
    (Number(gotA) === 42 && au.performed === true && Number(backA) === Number(setA.previous))
      ? pass("AUTH_MP_SET_AUTHORITY", `set=${gotA} previous=${setA.previous} back=${backA}`)
      : fail("AUTH_MP_SET_AUTHORITY", `set=${gotA} performed=${au.performed} back=${backA} prev=${setA.previous}`);
    await call("editor_redo");
    Number(await authorityOf(anode)) === 42
      ? pass("AUTH_MP_SET_AUTHORITY_REDO") : fail("AUTH_MP_SET_AUTHORITY_REDO", `got ${await authorityOf(anode)}`);

    // mp_setup_enet_peer (gated codegen) — write + load back as a GDScript.
    const enet = await call("mp_setup_enet_peer", { to_path: ENET, port: 5555, overwrite: true });
    (enet.status === "written" && (await call("resource_load", { path: ENET })).type === "GDScript")
      ? pass("AUTH_MP_SETUP_ENET_PEER", `path=${enet.path}`)
      : fail("AUTH_MP_SETUP_ENET_PEER", JSON.stringify(enet).slice(0, 160));

    // mp_setup_webrtc_peer (gated codegen, feature-detected) — unsupported (degrade) OR written+loadable.
    const webrtc = await call("mp_setup_webrtc_peer", { to_path: WEBRTC, overwrite: true });
    if (webrtc.status === "unsupported" && webrtc.path === null) {
      pass("AUTH_MP_SETUP_WEBRTC_PEER", "degrade=unsupported (no WebRTC module)");
    } else if (webrtc.status === "written" && (await call("resource_load", { path: WEBRTC })).type === "GDScript") {
      pass("AUTH_MP_SETUP_WEBRTC_PEER", "written (WebRTC module present)");
    } else {
      fail("AUTH_MP_SETUP_WEBRTC_PEER", JSON.stringify(webrtc).slice(0, 160));
    }

    // mp_wire_rpc (gated) — append a stub for an absent function, then annotate an existing one; the
    // rewritten file must still load as a valid GDScript (proves the codegen did not corrupt it).
    const wrStub = await call("mp_wire_rpc", { path: ENET, function: "sync_state", mode: "any_peer", transfer_mode: "reliable" });
    (wrStub.status === "written" && wrStub.stub_created === true && wrStub.annotation === '@rpc("any_peer", "call_remote", "reliable", 0)' && (await call("resource_load", { path: ENET })).type === "GDScript")
      ? pass("AUTH_MP_WIRE_RPC_STUB", `annotation=${wrStub.annotation}`)
      : fail("AUTH_MP_WIRE_RPC_STUB", JSON.stringify(wrStub).slice(0, 160));
    const wrExisting = await call("mp_wire_rpc", { path: ENET, function: "host_game", call_local: true });
    (wrExisting.status === "written" && wrExisting.stub_created === false && (await call("resource_load", { path: ENET })).type === "GDScript")
      ? pass("AUTH_MP_WIRE_RPC_EXISTING", `stub_created=${wrExisting.stub_created}`)
      : fail("AUTH_MP_WIRE_RPC_EXISTING", JSON.stringify(wrExisting).slice(0, 160));

    // mp_scaffold_lobby (gated codegen) — write + load back as a GDScript.
    const lobby = await call("mp_scaffold_lobby", { to_path: LOBBY, max_players: 6, overwrite: true });
    (lobby.status === "written" && (await call("resource_load", { path: LOBBY })).type === "GDScript")
      ? pass("AUTH_MP_SCAFFOLD_LOBBY", `path=${lobby.path}`)
      : fail("AUTH_MP_SCAFFOLD_LOBBY", JSON.stringify(lobby).slice(0, 160));
  });

  // ---------------------------------------------------------------- backend ----
  // Group M second half: backend-SDK scaffolding. The example ships no SDK, so the codegen
  // tools first prove BOTH degrades — unsupported_feature (Photon has no leaderboard) and
  // sdk_missing (nothing installed) — writing nothing. Then an in-memory autoload (save:false)
  // simulates an installed SilentWolf so the real write path runs against a real editor; the
  // autoload is removed afterward. Written files res://_auth_probe_backend_* hit the cleanup glob.
  await family("AUTH_BACKEND", async () => {
    const CFG = "res://_auth_probe_backend_config.gd";
    const LB = "res://_auth_probe_backend_leaderboard.gd";
    const SAVE = "res://_auth_probe_backend_save.gd";
    const AUTHF = "res://_auth_probe_backend_auth.gd";
    const loadsAsGd = async (p) => (await call("resource_load", { path: p })).type === "GDScript";

    // backend_detect over the clean example: all four known SDKs listed, SilentWolf not installed.
    const det0 = await call("backend_detect", {});
    const sw0 = (det0.backends || []).find((b) => b.sdk === "silentwolf");
    (Array.isArray(det0.backends) && det0.backends.length === 4 && sw0 && sw0.installed === false)
      ? pass("AUTH_BACKEND_DETECT", `backends=${det0.backends.length} detected=${JSON.stringify(det0.detected)}`)
      : fail("AUTH_BACKEND_DETECT", JSON.stringify(det0).slice(0, 160));

    // Degrade (1) — unsupported_feature: Photon has no leaderboard API; nothing written.
    const unsupported = await call("leaderboard_scaffold", { sdk: "photon", to_path: LB, overwrite: true });
    (unsupported.status === "unsupported_feature" && unsupported.path === null)
      ? pass("AUTH_BACKEND_UNSUPPORTED", `msg=${String(unsupported.message).slice(0, 48)}`)
      : fail("AUTH_BACKEND_UNSUPPORTED", JSON.stringify(unsupported).slice(0, 160));

    // Degrade (2) — sdk_missing: SilentWolf not installed yet; nothing written.
    const missing = await call("leaderboard_scaffold", { sdk: "silentwolf", to_path: LB, overwrite: true });
    (missing.status === "sdk_missing" && missing.path === null)
      ? pass("AUTH_BACKEND_SDK_MISSING", `msg=${String(missing.message).slice(0, 48)}`)
      : fail("AUTH_BACKEND_SDK_MISSING", JSON.stringify(missing).slice(0, 160));

    // Simulate an installed SilentWolf via an in-memory autoload (save:false — no disk write).
    await call("project_add_autoload", { name: "SilentWolf", path: "res://gcb_smoke.gd", save: false });
    const det1 = await call("backend_detect", { sdk: "silentwolf" });
    const sw1 = (det1.backends || []).find((b) => b.sdk === "silentwolf");
    (det1.detected.includes("silentwolf") && sw1 && sw1.installed === true && sw1.method === "autoload")
      ? pass("AUTH_BACKEND_DETECT_AUTOLOAD", `method=${sw1 && sw1.method}`)
      : fail("AUTH_BACKEND_DETECT_AUTOLOAD", JSON.stringify(det1).slice(0, 160));

    // Written path — now capable + installed. Each writer lands a loadable GDScript.
    const cfg = await call("backend_configure", { sdk: "silentwolf", api_key: "K", game_id: "G", to_path: CFG, overwrite: true });
    (cfg.status === "written" && (await loadsAsGd(CFG)))
      ? pass("AUTH_BACKEND_CONFIGURE", `path=${cfg.path}`) : fail("AUTH_BACKEND_CONFIGURE", JSON.stringify(cfg).slice(0, 160));

    const lb = await call("leaderboard_scaffold", { sdk: "silentwolf", leaderboard_name: "weekly", to_path: LB, overwrite: true });
    (lb.status === "written" && (await loadsAsGd(LB)))
      ? pass("AUTH_BACKEND_LEADERBOARD", `path=${lb.path}`) : fail("AUTH_BACKEND_LEADERBOARD", JSON.stringify(lb).slice(0, 160));

    const save = await call("cloudsave_scaffold", { sdk: "silentwolf", to_path: SAVE, overwrite: true });
    (save.status === "written" && (await loadsAsGd(SAVE)))
      ? pass("AUTH_BACKEND_CLOUDSAVE", `path=${save.path}`) : fail("AUTH_BACKEND_CLOUDSAVE", JSON.stringify(save).slice(0, 160));

    const auth = await call("auth_scaffold", { sdk: "silentwolf", to_path: AUTHF, overwrite: true });
    (auth.status === "written" && (await loadsAsGd(AUTHF)))
      ? pass("AUTH_BACKEND_AUTH", `path=${auth.path}`) : fail("AUTH_BACKEND_AUTH", JSON.stringify(auth).slice(0, 160));

    // Remove the simulated autoload (in-memory; save:false).
    await call("project_remove_autoload", { name: "SilentWolf", save: false });
  });

  // ---------------------------------------------------------------- undo / redo ----
  // editor_undo / editor_redo drive the edited scene's EditorUndoRedoManager history.
  // Round-trip each undo archetype on a throwaway node, then a 3-deep LIFO stack test
  // and a redo no-op guard. Only touches actions pushed here (the top of the stack).
  await family("AUTH_UNDO", async () => {
    const undo = () => call("editor_undo");
    const redo = () => call("editor_redo");

    // (1) creator (add_do_reference): body_create -> undo removes the node -> redo restores it.
    const ub = (await call("body_create", { parent_path: ".", type: "static", dim: "2d", name: "AuthUndoBody" })).path;
    const made = await hasChild(".", ub, "StaticBody2D");
    const u1 = await undo();
    const gone = !(await hasChild(".", ub, "StaticBody2D"));
    (made && u1.performed === true && u1.scope === "scene" && u1.history_id >= 0 && gone)
      ? pass("AUTH_UNDO_CREATE_REVERT", `action=${JSON.stringify(u1.action)} hid=${u1.history_id}`)
      : fail("AUTH_UNDO_CREATE_REVERT", `made=${made} performed=${u1.performed} hid=${u1.history_id} gone=${gone}`);
    const r1 = await redo();
    (r1.performed === true && (await hasChild(".", ub, "StaticBody2D")))
      ? pass("AUTH_REDO_CREATE_RESTORE") : fail("AUTH_REDO_CREATE_RESTORE", `performed=${r1.performed}`);

    // (2) scalar property (add_do_property): set collision_layer -> undo reverts to prior value -> redo re-applies.
    const layer0 = await propVal(ub, "collision_layer");
    await call("body_set_collision_layer", { path: ub, layer: 7 });
    const layerSet = await propVal(ub, "collision_layer");
    const u2 = await undo();
    const layerBack = await propVal(ub, "collision_layer");
    (layerSet === 7 && u2.performed === true && layerBack === layer0)
      ? pass("AUTH_UNDO_PROPERTY_REVERT", `set=${layerSet} back=${layerBack}`)
      : fail("AUTH_UNDO_PROPERTY_REVERT", `set=${layerSet} performed=${u2.performed} back=${layerBack} want=${layer0}`);
    await redo();
    (await propVal(ub, "collision_layer")) === 7
      ? pass("AUTH_REDO_PROPERTY_RESTORE") : fail("AUTH_REDO_PROPERTY_RESTORE", `got ${await propVal(ub, "collision_layer")}`);

    // (3) resource assignment: body_set_physics_material -> undo drops the override -> redo re-adds it.
    await call("body_set_physics_material", { path: ub, friction: 0.4, bounce: 0.6 });
    const matSet = await propResClass(ub, "physics_material_override");
    const u3 = await undo();
    const matBack = await propResClass(ub, "physics_material_override");
    (matSet === "PhysicsMaterial" && u3.performed === true && !matBack)
      ? pass("AUTH_UNDO_RESOURCE_REVERT", `set=${matSet} back=${matBack}`)
      : fail("AUTH_UNDO_RESOURCE_REVERT", `set=${matSet} performed=${u3.performed} back=${matBack}`);
    await redo();
    (await propResClass(ub, "physics_material_override")) === "PhysicsMaterial"
      ? pass("AUTH_REDO_RESOURCE_RESTORE") : fail("AUTH_REDO_RESOURCE_RESTORE");

    // (4) LIFO depth: 3 stacked edits (add child + 2 props) undo x3 -> full revert, redo x3 -> restore.
    const cs = (await call("collisionshape_add", { parent_path: ub, shape: "circle", dim: "2d", radius: 12 })).path;
    await call("body_set_collision_mask", { path: ub, mask: 6 });
    await call("body_set_collision_layer", { path: ub, layer: 9 });
    const stacked = (await hasChild(ub, cs, "CollisionShape2D")) && (await propVal(ub, "collision_mask")) === 6 && (await propVal(ub, "collision_layer")) === 9;
    const dz = await undo(), dy = await undo(), dx = await undo();
    const reverted = !(await hasChild(ub, cs, "CollisionShape2D")) && (await propVal(ub, "collision_mask")) !== 6 && (await propVal(ub, "collision_layer")) === 7;
    (stacked && dz.performed && dy.performed && dx.performed && reverted)
      ? pass("AUTH_UNDO_DEPTH3_REVERT") : fail("AUTH_UNDO_DEPTH3_REVERT", `stacked=${stacked} reverted=${reverted}`);
    await redo(); await redo(); await redo();
    ((await hasChild(ub, cs, "CollisionShape2D")) && (await propVal(ub, "collision_mask")) === 6 && (await propVal(ub, "collision_layer")) === 9)
      ? pass("AUTH_REDO_DEPTH3_RESTORE") : fail("AUTH_REDO_DEPTH3_RESTORE");

    // (5) no-op guard: with the head fully redone, another editor_redo is a graceful no-op (not an error).
    const noop = await redo();
    (noop.performed === false && noop.has_redo === false)
      ? pass("AUTH_UNDO_NOOP_GUARD", `performed=${noop.performed} has_redo=${noop.has_redo}`)
      : fail("AUTH_UNDO_NOOP_GUARD", `performed=${noop.performed} has_redo=${noop.has_redo}`);
  });

  // -------------------------------------------------- screenshot_editor (render path) ----
  // The ONLY pixel-producing tool this probe touches, and the only one that cannot go
  // through call() — screenshot_editor returns IMAGE content and no structuredContent,
  // so call() would throw "no structuredContent" before any assertion ran. Until this
  // family landed, no CI job in this repo exercised a pixel-producing tool at all.
  //
  // #138 closed the runtime half (ops_unit_test.gd captures under Xvfb + llvmpipe and
  // FAILS if it cannot). This is the editor half: the same rasterizer, but going through
  // EditorInterface.get_editor_viewport_2d() on a booted editor rather than a SceneTree
  // root viewport. Nothing else covers it.
  await family("AUTH_SHOT", async () => {
    // WHICH VIEWPORT, AND WHY 3D. Measured on Godot 4.7 across four editor boots
    // (session 144): a fresh editor with no saved layout — exactly what a CI runner
    // has — boots on the 3D main-screen tab, and opening main.tscn does NOT switch
    // it despite the root being a Node2D. The 3D viewport is therefore the one that
    // is actually rendered here. Capturing 2d instead would assert against a
    // collapsed 2x2 viewport and tell us nothing about the capture path.
    const raw = await client.callTool(
      { name: "screenshot_editor", arguments: { viewport: "3d" } }, undefined, { timeout: 60000 });
    if (raw.isError) { fail("AUTH_SHOT_CAPTURE", (raw.content?.[0]?.text || "").slice(0, 200)); return; }
    const img = (raw.content || []).find((c) => c.type === "image");
    const note = (raw.content || []).find((c) => c.type === "text")?.text || "";
    if (!img) { fail("AUTH_SHOT_CAPTURE", `no image block: ${JSON.stringify(raw.content).slice(0, 200)}`); return; }
    img.mimeType === "image/png" ? pass("AUTH_SHOT_MIME", img.mimeType) : fail("AUTH_SHOT_MIME", String(img.mimeType));
    // Decode rather than trust the label: a base64 string of the right shape can
    // still be an error page, an empty buffer, or a 1x1 placeholder.
    const bytes = Buffer.from(img.data || "", "base64");
    bytes.length > 1024
      ? pass("AUTH_SHOT_BYTES", `${bytes.length}B`)
      : fail("AUTH_SHOT_BYTES", `${bytes.length}B — too small to be a real frame`);
    // PNG magic 89 50 4E 47 — proves the payload really is an image.
    (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
      ? pass("AUTH_SHOT_MAGIC")
      : fail("AUTH_SHOT_MAGIC", `first bytes ${[...bytes.slice(0, 4)].join(",")}`);
    // MEASURE the dimensions, do not merely match their SHAPE. The first draft of
    // this assertion tested /\(\d+x\d+\)/, which passes cheerfully on "(2x2)" — it
    // would have certified the exact placeholder frame this family exists to reject.
    const dims = /\((\d+)x(\d+)\)/.exec(note);
    const w = dims ? Number(dims[1]) : 0, h = dims ? Number(dims[2]) : 0;
    (w >= 64 && h >= 64)
      ? pass("AUTH_SHOT_DIMS", `${w}x${h}`)
      : fail("AUTH_SHOT_DIMS", `${note || "(no note)"} — not a rendered viewport`);

    // Everything above this line reads the tool's LABEL. These two open the payload.
    const decoded = decodePng(bytes);
    // The dims asserted above come from the note, which the addon builds from the
    // Image it measured. These come from the bytes that actually crossed
    // Marshalls.raw_to_base64 -> JSON -> stdio. A disagreement means the frame
    // delivered is not the frame that was measured.
    if (!decoded) {
      fail("AUTH_SHOT_IHDR", `payload did not decode as an 8-bit PNG (${bytes.length}B)`);
      fail("AUTH_SHOT_DRAWN", "no decode, so the frame's content is unknown");
    } else {
      (decoded.width === w && decoded.height === h)
        ? pass("AUTH_SHOT_IHDR", `payload ${decoded.width}x${decoded.height} matches the reported dims`)
        : fail("AUTH_SHOT_IHDR", `payload is ${decoded.width}x${decoded.height} but the tool reported ${w}x${h}`);
      // THE ONE THAT IS NOT ABOUT SHAPE AT ALL. Every other assertion in this
      // family is satisfied by a correctly-sized, correctly-labelled, entirely
      // BLACK frame — a rasterizer that initialised and then drew nothing. That is
      // the editor-side twin of the defect #141 built render_probe.tscn to reject
      // on the runtime side ("a job that is green without comparing anything"),
      // and until now nothing here would have caught it. A live 3D viewport draws
      // the grid, the three axis gizmos and the sky gradient, so it is far from
      // uniform; measured 1106 distinct colours on Metal and 774 here under
      // llvmpipe (session 147). Deliberately asserts >1, not a floor near either
      // figure: the bar is "the rasterizer drew something", and the two drivers
      // legitimately disagree on the count, so pinning one would be brittle for
      // no gain.
      const shades = sampleDistinctColours(decoded);
      shades.distinct > 1
        ? pass("AUTH_SHOT_DRAWN", `${shades.distinct} distinct colours over ${shades.sampled} sampled px`)
        : fail("AUTH_SHOT_DRAWN", `the frame is a single flat colour over ${shades.sampled} sampled px — the rasterizer drew nothing`);
    }

    // THE OTHER HALF: the tab that is NOT active must REFUSE, not return a
    // placeholder. Before the host-side guard this returned ok + a 2x2 81-byte PNG,
    // with correct mime and correct PNG magic — success-shaped and empty, which an
    // assistant would have looked at and reasoned from. A skip is not a pass, and a
    // 2x2 is not a screenshot.
    const raw2d = await client.callTool(
      { name: "screenshot_editor", arguments: { viewport: "2d" } }, undefined, { timeout: 60000 });
    const txt2d = (raw2d.content?.[0]?.text || "").slice(0, 200);
    const img2d = (raw2d.content || []).find((c) => c.type === "image");
    if (raw2d.isError && /viewport_not_rendered/.test(txt2d)) {
      pass("AUTH_SHOT_INACTIVE_REFUSED", txt2d.slice(0, 80));
      // Record how much room the MIN_RENDERED_VIEWPORT_PX = 8 heuristic actually has,
      // rather than leaving it an assumption. The guard compares the addon's IMAGE
      // dims against 8, so on a display where those dims scaled with the backing
      // store the placeholder would grow and the margin would shrink. Measured on
      // Metal at 2880x1864 Retina AND here under llvmpipe (session 147): 2x2 in
      // BOTH, so the dims are LOGICAL and the margin is independent of display
      // scale and rasterizer alike. Logged, not asserted — Godot's minimum
      // SubViewport size is not ours to pin.
      const m = /measured (\d+)x(\d+)/.exec(txt2d);
      console.log(m
        ? `AUTH_SHOT_GUARD_MARGIN placeholder=${m[1]}x${m[2]} threshold=8 headroom=${(8 / Math.max(Number(m[1]), Number(m[2]))).toFixed(2)}x`
        : "AUTH_SHOT_GUARD_MARGIN not measurable — the error did not name the dims");
    } else if (!raw2d.isError && img2d) {
      // Legitimate on a machine where the 2D tab happens to be active (a developer
      // running this locally). Assert it is a REAL frame, not the placeholder.
      const d2 = /\((\d+)x(\d+)\)/.exec((raw2d.content || []).find((c) => c.type === "text")?.text || "");
      const w2 = d2 ? Number(d2[1]) : 0, h2 = d2 ? Number(d2[2]) : 0;
      (w2 >= 64 && h2 >= 64)
        ? pass("AUTH_SHOT_INACTIVE_REFUSED", `2D tab was active — real frame ${w2}x${h2}`)
        : fail("AUTH_SHOT_INACTIVE_REFUSED", `returned ok with a ${w2}x${h2} placeholder — the guard did not bite`);
    } else {
      fail("AUTH_SHOT_INACTIVE_REFUSED", `neither a real frame nor viewport_not_rendered: ${txt2d}`);
    }
  });

  // ------------------------------------------------- main-screen tab (1.9.3) ----
  // The family AUTH_SHOT could not have: it proves the caller can RECOVER. Until
  // 1.9.3 the viewport_not_rendered error said "switch to the 2D tab" and there was
  // no tool that could — a dead end for the assistant this addon exists to serve.
  // The assertions below walk that loop end to end: observe the tab, watch a capture
  // be refused, switch, and watch the SAME capture succeed.
  await family("AUTH_MAINSCREEN", async () => {
    const before = await call("main_screen_get");
    const avail = before.available || [];
    (typeof before.active === "string" && avail.includes(before.active) && avail.length >= 2)
      ? pass("AUTH_MAINSCREEN_GET", `active=${before.active} available=[${avail.join(",")}]`)
      : fail("AUTH_MAINSCREEN_GET", JSON.stringify(before).slice(0, 160));

    // An unknown tab must be refused BY NAME and hand back the live list, rather than
    // silently doing nothing — the caller's whole problem is not knowing what exists.
    const bogus = await client.callTool(
      { name: "main_screen_set", arguments: { name: "NoSuchTab" } }, undefined, { timeout: 30000 });
    const btxt = (bogus.content?.[0]?.text || "");
    (bogus.isError && /not_found/.test(btxt) && avail.some((n) => btxt.includes(n)))
      ? pass("AUTH_MAINSCREEN_UNKNOWN", btxt.slice(0, 90))
      : fail("AUTH_MAINSCREEN_UNKNOWN", `expected not_found naming the available tabs, got: ${btxt.slice(0, 160)}`);

    // The improved guard message must name the tab that is ACTUALLY active. Only
    // meaningful while the 2D tab is inactive, which is the CI condition (a fresh
    // editor boots on 3D); skipped rather than faked if a developer is already on 2D.
    if (before.active !== "2D") {
      const refused = await client.callTool(
        { name: "screenshot_editor", arguments: { viewport: "2d" } }, undefined, { timeout: 60000 });
      const rtxt = (refused.content?.[0]?.text || "");
      (refused.isError && rtxt.includes(`"${before.active}"`) && /main_screen_set/.test(rtxt))
        ? pass("AUTH_MAINSCREEN_ERROR_NAMES_TAB", `error names "${before.active}" and the tool that fixes it`)
        : fail("AUTH_MAINSCREEN_ERROR_NAMES_TAB", rtxt.slice(0, 200));
    } else {
      pass("AUTH_MAINSCREEN_ERROR_NAMES_TAB", "skipped — 2D already active, nothing would be refused");
    }

    // Lower-case on purpose: the engine spells it "2D", and the tool is documented
    // as case-insensitive, so this asserts that contract rather than assuming it.
    const set = await call("main_screen_set", { name: "2d" });
    (set.active === "2D" && set.requested === "2D")
      ? pass("AUTH_MAINSCREEN_SET", `active=${set.active} (requested via "2d")`)
      : fail("AUTH_MAINSCREEN_SET", JSON.stringify(set).slice(0, 160));

    // THE POINT OF THE FEATURE. The same call that was refused moments ago must now
    // return a real frame — not a placeholder, and not merely a non-error.
    const shot = await client.callTool(
      { name: "screenshot_editor", arguments: { viewport: "2d" } }, undefined, { timeout: 60000 });
    const dims = /\((\d+)x(\d+)\)/.exec((shot.content || []).find((c) => c.type === "text")?.text || "");
    const sw = dims ? Number(dims[1]) : 0, sh = dims ? Number(dims[2]) : 0;
    (!shot.isError && sw >= 64 && sh >= 64)
      ? pass("AUTH_MAINSCREEN_RECOVERS_SHOT", `2d captured ${sw}x${sh} after the switch`)
      : fail("AUTH_MAINSCREEN_RECOVERS_SHOT", `expected a real 2d frame after switching; got ${shot.isError ? (shot.content?.[0]?.text || "").slice(0, 140) : `${sw}x${sh}`}`);

    // Leave the editor on the tab we found it on. #146 made the probe idempotent for
    // the edited scene; the main-screen tab is process state in exactly the same way.
    const restored = await call("main_screen_set", { name: before.active });
    (restored.active === before.active)
      ? pass("AUTH_MAINSCREEN_RESTORED", `back to ${restored.active}`)
      : fail("AUTH_MAINSCREEN_RESTORED", `wanted ${before.active}, got ${restored.active}`);
  });

  // ------------------------------------------------- AUTH_WRITE_PATH (164) ----
  //
  // 163 §8 item 5's sharpest cluster, measured and then pinned. Against a REAL editor
  // on a temp project copy with a prefix-sharing sibling, TWENTY-ONE writers created
  // files OUTSIDE the project root through `res://../` — every one answering `ok` and
  // echoing the escaping path back, so the tool's own reply could never have revealed
  // it. The verdict came from `stat`, and so does the last claim in this section.
  //
  // 🔴 NO FIXTURE, ON PURPOSE: these refusals resolve the path and stop, without
  // touching the filesystem or the bridge, so the escape target NEED NOT EXIST. That
  // is what lets this run against the repo's own `example/` — 163 §6 could not put a
  // prefix-sharing sibling anywhere inside the repo, and this section does not need
  // one. It is also the claim: a guard that needed the target to exist would be a
  // guard an attacker could dodge by naming a file that does not.
  //
  // 🔴 AND NO 27th CI JOB. This strengthens a REQUIRED gate that already boots the
  // editor these tools drive, exactly as 163 strengthened `gdscript-dap-plane`.
  await family("AUTH_WRITE_PATH", async () => {
    const EVIL = `${path.basename(GODOT_PROJECT.replace(/\/$/, ''))}_evil`; // shares the root's NAME PREFIX
    const escapeOf = (ext) => `res://../${EVIL}/auth_esc${ext}`;
    // Every writer MEASURED escaping, with args that reach the guard. The `.gd` on the
    // backend four is load-bearing — a non-.gd path is refused earlier, for the wrong
    // reason, and would pass this section without asserting anything.
    const WRITERS = [
      ["resource_create", "to_path", { class_name: "StyleBoxFlat", to_path: escapeOf(".tres") }],
      ["resource_save", "to_path", { from_path: MAIN_SCENE, to_path: escapeOf(".tres") }],
      ["resource_save", "from_path", { from_path: escapeOf(".tres"), to_path: "res://auth_ok.tres" }],
      ["resource_duplicate", "to_path", { path: MAIN_SCENE, to_path: escapeOf(".tres") }],
      ["resource_duplicate", "path", { path: escapeOf(".tres"), to_path: "res://auth_ok.tres" }],
      ["filesystem_move", "to_path", { from_path: MAIN_SCENE, to_path: escapeOf(".tscn") }],
      ["filesystem_move", "from_path", { from_path: escapeOf(".tscn"), to_path: "res://auth_ok.tscn" }],
      ["scene_pack", "to_path", { path: ".", to_path: escapeOf(".tscn") }],
      ["shader_create", "to_path", { to_path: escapeOf(".gdshader") }],
      ["theme_create", "to_path", { to_path: escapeOf(".tres") }],
      ["tileset_create", "to_path", { to_path: escapeOf(".tres") }],
      ["primitive_mesh_create", "to_path", { to_path: escapeOf(".tres") }],
      ["environment_create", "to_path", { to_path: escapeOf(".tres") }],
      ["audio_set_bus_layout", "to_path", { to_path: escapeOf(".tres") }],
      ["asset_gen_icon", "to_path", { prompt: "x", to_path: escapeOf(".tres") }],
      ["asset_gen_sprite", "to_path", { prompt: "x", to_path: escapeOf(".tres") }],
      ["asset_gen_texture", "to_path", { prompt: "x", to_path: escapeOf(".tres") }],
      ["asset_gen_audio_sfx", "to_path", { prompt: "x", to_path: escapeOf(".tres") }],
      ["asset_gen_model", "to_path", { prompt: "x", to_path: escapeOf(".tres") }],
      ["asset_gen_placeholder", "to_path", { kind: "icon", to_path: escapeOf(".tres") }],
      ["backend_configure", "to_path", { sdk: "silentwolf", to_path: escapeOf(".gd") }],
      ["leaderboard_scaffold", "to_path", { sdk: "silentwolf", to_path: escapeOf(".gd") }],
      ["cloudsave_scaffold", "to_path", { sdk: "silentwolf", to_path: escapeOf(".gd") }],
      ["auth_scaffold", "to_path", { sdk: "silentwolf", to_path: escapeOf(".gd") }],
    ];
    let refused = 0;
    for (const [tool, param, args] of WRITERS) {
      const r = await client.callTool({ name: tool, arguments: { ...args, confirm: true } }, undefined, { timeout: 60000 });
      const txt = (r.content?.[0]?.text || "").replace(/\s+/g, " ");
      const good = r.isError === true
        && /path_outside_project/.test(txt)
        && /outside the Godot project root/.test(txt)
        && new RegExp(`Refusing ${param}\\b`).test(txt);
      good
        ? refused++
        : fail("AUTH_WRITE_PATH", `${tool}.${param} did not refuse BY REASON -> ${r.isError ? txt.slice(0, 140) : `ok ${txt.slice(0, 120)}`}`);
    }
    refused === WRITERS.length
      ? pass("AUTH_WRITE_PATH", `${refused}/${WRITERS.length} measured writer parameters refuse res://.. by reason, naming the parameter`)
      : fail("AUTH_WRITE_PATH", `only ${refused}/${WRITERS.length} refused`);

    // 🔴 A path refusal is NOT a bridge error. `Bridge error` means "the editor could
    // not be reached" and sends the caller to restart Godot over their own typo.
    const one = await client.callTool({ name: "theme_create", arguments: { to_path: escapeOf(".tres"), confirm: true } }, undefined, { timeout: 60000 });
    /^Path error \[path_outside_project\]/.test((one.content?.[0]?.text || ""))
      ? pass("AUTH_WRITE_PATH_ENVELOPE", "a path refusal carries its own envelope, not the bridge's")
      : fail("AUTH_WRITE_PATH_ENVELOPE", (one.content?.[0]?.text || "").slice(0, 140));

    // 🔴 THE CLAIM THAT MATTERS, AND IT ASKS THE FILESYSTEM RATHER THAN THE TOOL.
    // Every reply above said "refused"; this checks that nothing appeared where the
    // replies said nothing would. It is the only assertion here the host cannot fake.
    const evilDir = path.join(path.dirname(GODOT_PROJECT.replace(/\/$/, '')), EVIL);
    const landed = fs.existsSync(evilDir) ? fs.readdirSync(evilDir).filter((f) => f.startsWith("auth_esc")) : [];
    landed.length === 0
      ? pass("AUTH_WRITE_PATH_NOTHING_LANDED", `nothing exists under ${evilDir} — asked the filesystem, not the tools`)
      : fail("AUTH_WRITE_PATH_NOTHING_LANDED", `${landed.length} file(s) escaped: ${landed.join(", ")}`);

    // …and the legal side still writes where it names, through the same tool, in the
    // same run. A guard that refused everything would pass every claim above.
    const okRes = await call("resource_create", { class_name: "StyleBoxFlat", to_path: "res://_auth_probe_guard_ok.tres" });
    String(okRes.created) === "res://_auth_probe_guard_ok.tres"
      ? pass("AUTH_WRITE_PATH_LEGAL", "a legal res:// destination still writes, unrewritten")
      : fail("AUTH_WRITE_PATH_LEGAL", JSON.stringify(okRes).slice(0, 140));
  });

  // ------------------------------------------------- AUTH_READ_PATH (165) ----
  //
  // 164 §8 item 5's OTHER half. Against a real editor — and, for the runtime rows, a
  // game actually hosting the runtime bridge — 29 of 35 measured reader parameters
  // reached OUTSIDE the project root, through ALL THREE spellings rather than only
  // `res://../`. A reader leaves no file to `stat`, so the measurement was a
  // DIFFERENTIAL: the same escaping path pointed at a file that exists and one that
  // does not. A tool that answers differently has opened the outside file.
  //
  // 🔴 THE SHARPEST ROW WAS `godot_run_headless_script`, WHICH EXECUTED AN OUTSIDE
  // SCRIPT — proven by a marker file the script wrote, because the reply said
  // `exit_code: 0` for the real script AND for one that did not exist.
  //
  // Same no-fixture property as the section above: these refusals resolve and stop,
  // so the escape target need not exist and this runs against the repo's own
  // `example/`. Still no 27th CI job.
  await family("AUTH_READ_PATH", async () => {
    const EVIL = `${path.basename(GODOT_PROJECT.replace(/\/$/, ''))}_evil`;
    const esc = (ext) => `res://../${EVIL}/auth_rd${ext}`;
    // Every reader MEASURED escaping, with args that reach the guard. The extensions
    // are load-bearing in the tabletop family the same way `.gd` is for the backend
    // four above: a non-`.tscn` `path` is refused earlier, for the wrong reason.
    const READERS = [
      ["audio_player_create", "stream_path", { parent_path: ".", stream_path: esc(".tres") }],
      ["audio_set_stream", "stream_path", { path: ".", stream_path: esc(".tres") }],
      ["control_set_theme", "theme_path", { path: ".", theme_path: esc(".tres") }],
      ["theme_set_font", "font_path", { path: "res://auth_t.tres", name: "font", theme_type: "Label", font_path: esc(".tres") }],
      ["theme_set_stylebox", "stylebox_path", { path: "res://auth_t.tres", name: "panel", theme_type: "Panel", stylebox_path: esc(".tres") }],
      ["meshinstance_create", "mesh_path", { parent_path: ".", mesh_path: esc(".tres") }],
      ["mesh_set_surface_material", "material_path", { path: ".", material_path: esc(".tres") }],
      ["particles_set_texture", "texture_path", { path: ".", texture_path: esc(".tres") }],
      ["shadermaterial_create", "shader_path", { path: ".", shader_path: esc(".gdshader") }],
      ["shadermaterial_set_shader", "shader_path", { path: ".", shader_path: esc(".gdshader") }],
      ["tilemaplayer_create", "tileset_path", { parent_path: ".", tileset_path: esc(".tres") }],
      ["tileset_add_source", "tileset_path", { tileset_path: esc(".tres"), texture_path: "res://icon.svg" }],
      ["tileset_add_source", "texture_path", { tileset_path: "res://auth_ts.tres", texture_path: esc(".png") }],
      ["tileset_add_tile", "tileset_path", { tileset_path: esc(".tres"), source_id: 0, atlas_coords: [0, 0] }],
      ["tileset_set_tile_collision", "tileset_path", { tileset_path: esc(".tres"), source_id: 0, atlas_coords: [0, 0], polygon: [[0, 0], [8, 0], [8, 8]] }],
      ["node_instantiate_scene", "scene_path", { parent_path: ".", scene_path: esc(".tscn") }],
      ["test_list", "dir", { dir: `res://../${EVIL}` }],
      ["card_instance", "template_path", { template_path: esc(".tscn"), parent: ".", data: {} }],
      ["card_hand_layout", "template_path", { template_path: esc(".tscn"), parent: ".", cards: [{ data: {} }], mode: "row" }],
      ["card_deck_from_table", "template_path", { template_path: esc(".tscn"), parent: ".", table_path: "res://auth.csv", column_map: { a: "a" } }],
      ["piece_instance", "template_path", { template_path: esc(".tscn"), parent: ".", data: {} }],
      ["piece_template_create", "art", { path: "res://auth_pt.tscn", size: { width: 10, height: 10 }, art: esc(".png") }],
      ["mp_add_spawner", "spawnable_scenes", { parent_path: ".", spawnable_scenes: [esc(".tscn")] }],
      ["godot_run_headless_script", "script_path", { script_path: esc(".gd") }],
      ["godot_run_project", "scene", { scene: esc(".tscn") }],
      ["godot_run_managed", "scene", { scene: esc(".tscn") }],
      ["godot_export", "output_path", { preset: "Linux/X11", output_path: esc(".bin") }],
      ["runtime_node_add", "scene", { parent: ".", scene: esc(".tscn") }],
      ["runtime_screenshot_diff", "reference", { reference: esc(".png") }],
      ["runtime_spawn_peers", "scene", { count: 1, scene: esc(".tscn") }],
    ];
    let refused = 0;
    for (const [tool, param, args] of READERS) {
      const r = await client.callTool({ name: tool, arguments: { ...args, confirm: true } }, undefined, { timeout: 60000 });
      const txt = (r.content?.[0]?.text || "").replace(/\s+/g, " ");
      const good = r.isError === true
        && /path_outside_project/.test(txt)
        && /outside the Godot project root/.test(txt)
        && new RegExp(`Refusing ${param}\\b`).test(txt);
      good
        ? refused++
        : fail("AUTH_READ_PATH", `${tool}.${param} did not refuse BY REASON -> ${r.isError ? txt.slice(0, 140) : `ok ${txt.slice(0, 120)}`}`);
    }
    refused === READERS.length
      ? pass("AUTH_READ_PATH", `${refused}/${READERS.length} measured reader parameters refuse res://.. by reason, naming the parameter`)
      : fail("AUTH_READ_PATH", `only ${refused}/${READERS.length} refused`);

    // 🔴 ALL THREE SPELLINGS. For WRITERS the addon's `begins_with("res://")` already
    // refused a bare relative and an absolute elsewhere, so those two were
    // self-announcing. FOR READERS THEY WERE NOT — 19 of the first probe's rows
    // reached outside through every spelling. This claim is the one that would have
    // failed before this change and passes only because the host now refuses all three.
    const root = GODOT_PROJECT.replace(/\/$/, "");
    const three = [`res://../${EVIL}/x.tres`, `../${EVIL}/x.tres`, path.join(path.dirname(root), "elsewhere", "x.tres")];
    let spelled = 0;
    for (const p of three) {
      const r = await client.callTool({ name: "control_set_theme", arguments: { path: ".", theme_path: p } }, undefined, { timeout: 60000 });
      if (r.isError === true && /path_outside_project/.test(r.content?.[0]?.text || "")) spelled++;
    }
    spelled === 3
      ? pass("AUTH_READ_PATH_SPELLINGS", "res://.. , a bare relative, and an absolute elsewhere are all refused by the HOST")
      : fail("AUTH_READ_PATH_SPELLINGS", `only ${spelled}/3 spellings refused`);

    // 🔴 THE EXECUTION ROW, ASSERTED SEPARATELY BECAUSE IT IS THE WORST ONE. Before
    // this change `-s res://../<evil>/x.gd` RAN. The refusal must not be dressed as a
    // task failure — a caller who sees `exit_code` looks for a bug in their script.
    const ex = await client.callTool({ name: "godot_run_headless_script", arguments: { script_path: esc(".gd") } }, undefined, { timeout: 60000 });
    const exTxt = (ex.content?.[0]?.text || "").replace(/\s+/g, " ");
    (ex.isError === true && /^Path error \[path_outside_project\]/.test(exTxt) && !/exit_code/.test(exTxt))
      ? pass("AUTH_READ_PATH_NO_EXEC", "an outside script is refused by PATH, never run and never reported as an exit code")
      : fail("AUTH_READ_PATH_NO_EXEC", exTxt.slice(0, 160));

    // …and the legal side still reads. A guard that refused everything would pass
    // every claim above.
    //
    // 🔴🔴 THIS CONTROL WAS THE ONE CLAIM THAT COULD NOT DO THAT JOB, AND ITS LIVE
    // READING WAS ALREADY THE FAILURE SIGNATURE (169 §3). It asserted
    // `typeof okList.count === "number"` against `test_list` on its DOCUMENTED DEFAULT
    // — and the documented default is `res://test`, while the example project ships
    // `res://tests`. Measured on a healthy tree: {"count":0,"dir":"res://test","tests":[]}.
    // Zero. The reading this control produced when everything worked was
    // byte-identical to the reading it would produce if the guard had refused every
    // read on the plane. It could never have been anything but green.
    //
    // Two changes, and the second is the one that matters:
    //   1. point it at the directory that HAS tests, measured: count=1,
    //      tests=["res://tests/ops_unit_test.gd"];
    //   2. assert a NON-EMPTY result and the echoed dir. `count > 0` is what an
    //      over-refusing guard cannot fake — a refusal has nothing to count.
    // The default-dir reading is kept as a SEPARATE, non-vacuous claim below rather
    // than deleted: that the default answers `count:0` for a project with no
    // `res://test` is correct behaviour, and it is worth pinning as correct rather
    // than leaving as an accident that once masqueraded as coverage.
    const okList = await call("test_list", { dir: "res://tests" });
    (okList.count > 0 && Array.isArray(okList.tests) && okList.tests.length === okList.count && okList.dir === "res://tests")
      ? pass("AUTH_READ_PATH_LEGAL", `a legal read still returns CONTENT (test_list res://tests -> ${okList.count} test script(s)); an over-refusing guard has nothing to count`)
      : fail("AUTH_READ_PATH_LEGAL", JSON.stringify(okList).slice(0, 140));

    // The documented default, pinned as a real claim instead of an accidental one: a
    // project with no res://test answers an EMPTY list rather than erroring or
    // inventing the sibling directory that does exist.
    const defList = await call("test_list", {});
    (defList.dir === "res://test" && defList.count === 0 && Array.isArray(defList.tests) && defList.tests.length === 0)
      ? pass("AUTH_READ_PATH_LEGAL_DEFAULT", "the documented default res://test is absent here and answers an empty list — it does not silently fall back to res://tests")
      : fail("AUTH_READ_PATH_LEGAL_DEFAULT", JSON.stringify(defList).slice(0, 140));
  });

  // ------------------------------------------------ AUTH_NESTED_PATH (166) ----
  //
  // 🔴 THIS SECTION EXISTS BECAUSE THE ENUMERATOR WAS WRONG, NOT BECAUSE A TOOL WAS.
  // Three sessions scoped their work against "78 path-like parameters". The script
  // that produced 78 walks TOP-LEVEL `inputSchema.properties` only, DISCARDS the 124
  // parameters literally named `path` on the belief that 162 swept them, and matches
  // names by an ANCHORED EXACT-WORD list so a compound like `font_path` is only ever
  // found via its description — and `card_template_create.theme.font_path` has no
  // description at all. Corrected, the enumeration is 258 rows.
  //
  // Re-measured against a real editor, TWENTY-FOUR parameters reached outside the
  // root and SIX of them WROTE there. The verdicts came from the filesystem — file
  // hashes and directory snapshots — never from the reply, because all four
  // `theme_set_*` answered `ok` while rewriting a Theme outside the project.
  //
  // Same no-fixture property as the two sections above: these refusals resolve the
  // path and stop, so the escape target need not exist. Still no 27th CI job.
  await family("AUTH_NESTED_PATH", async () => {
    const EVIL = `${path.basename(GODOT_PROJECT.replace(/\/$/, ''))}_evil`;
    const esc = (ext) => `res://../${EVIL}/auth_np${ext}`;
    const ROWS = [
      ["theme_set_color", "path", { path: esc(".tres"), name: "font_color", theme_type: "Button", color: [1, 0, 0, 1] }],
      ["theme_set_constant", "path", { path: esc(".tres"), name: "h_separation", theme_type: "HBoxContainer", value: 4 }],
      ["theme_set_font", "path", { path: esc(".tres"), name: "font", theme_type: "Button", font_path: "res://auth_f.tres" }],
      ["theme_set_stylebox", "path", { path: esc(".tres"), name: "panel", theme_type: "Panel", stylebox_path: "res://auth_s.tres" }],
      ["resource_load", "path", { path: esc(".tres") }],
      ["resource_get_property", "path", { path: esc(".tres"), property: "resource_name" }],
      ["resource_set_property", "path", { path: esc(".tres"), property: "resource_name", value: "x" }],
      ["resource_get_import_settings", "path", { path: esc(".png") }],
      ["resource_set_import_settings", "path", { path: esc(".png"), settings: { "compress/mode": 1 } }],
      ["scene_open", "path", { path: esc(".tscn") }],
      ["scene_new", "path", { root_type: "Node2D", path: esc(".tscn") }],
      ["scene_reload", "path", { path: esc(".tscn") }],
      ["scene_get_dependencies", "path", { path: esc(".tscn") }],
      ["scene_save_as", "path", { path: esc(".tscn") }],
      ["shader_set_code", "path", { path: esc(".gdshader"), code: "shader_type canvas_item;" }],
      ["environment_set_sky", "path", { path: esc(".tres") }],
      ["project_add_autoload", "path", { name: "AuthNp", path: esc(".gd") }],
      ["project_set_main_scene", "path", { path: esc(".tscn") }],
      ["filesystem_list", "path", { path: `res://../${EVIL}` }],
      ["filesystem_create_dir", "path", { path: `res://../${EVIL}/auth_np_dir` }],
      ["project_search", "path", { query: "extends", path: `res://../${EVIL}` }],
      // 🔴 THE NESTED FOUR — one level down, in NO count this project has ever produced.
      ["board_create", "background.art", { path: "res://auth_np_b.tscn", layout: { mode: "grid", rows: 2, cols: 2 }, background: { art: esc(".png") } }],
      ["card_template_create", "back.art", { path: "res://auth_np_c.tscn", size: { width: 10, height: 10 }, slots: [{ name: "t", kind: "label" }], back: { art: esc(".png") } }],
      ["card_template_create", "theme.font_path", { path: "res://auth_np_c2.tscn", size: { width: 10, height: 10 }, slots: [{ name: "t", kind: "label" }], theme: { font_path: esc(".tres") } }],
      ["piece_template_create", "back.art", { path: "res://auth_np_p.tscn", size: { width: 10, height: 10 }, back: { art: esc(".png") } }],
    ];
    let refused = 0;
    for (const [tool, param, args] of ROWS) {
      const r = await client.callTool({ name: tool, arguments: { ...args, confirm: true } }, undefined, { timeout: 60000 });
      const txt = (r.content?.[0]?.text || "").replace(/\s+/g, " ");
      const good = r.isError === true
        && /path_outside_project/.test(txt)
        && /outside the Godot project root/.test(txt)
        && new RegExp(`Refusing ${param.replace(".", "\\.")}\\b`).test(txt);
      good
        ? refused++
        : fail("AUTH_NESTED_PATH", `${tool}.${param} did not refuse BY REASON -> ${r.isError ? txt.slice(0, 140) : `ok ${txt.slice(0, 120)}`}`);
    }
    refused === ROWS.length
      ? pass("AUTH_NESTED_PATH", `${refused}/${ROWS.length} measured parameters refuse res://.. by reason, naming the parameter (incl. 4 NESTED)`)
      : fail("AUTH_NESTED_PATH", `only ${refused}/${ROWS.length} refused`);

    // 🔴 THE CLAIM THAT COULD NOT HAVE PASSED BEFORE THIS CHANGE. `theme_set_font` and
    // `theme_set_stylebox` guarded their SECOND parameter since #175 and left `path` —
    // the Theme they LOAD AND RE-SAVE — open. Both parameters must refuse now, and the
    // refusal must NAME the one that failed so a caller can tell them apart.
    let both = 0;
    for (const [tool, operand, name] of [["theme_set_font", "font_path", "font"], ["theme_set_stylebox", "stylebox_path", "panel"]]) {
      const a = await client.callTool({ name: tool, arguments: { path: esc(".tres"), name, theme_type: "Button", [operand]: "res://auth_ok.tres", confirm: true } }, undefined, { timeout: 60000 });
      const b = await client.callTool({ name: tool, arguments: { path: "res://auth_t.tres", name, theme_type: "Button", [operand]: esc(".tres"), confirm: true } }, undefined, { timeout: 60000 });
      const at = (a.content?.[0]?.text || ""), bt = (b.content?.[0]?.text || "");
      if (a.isError && /Refusing path\b/.test(at) && b.isError && new RegExp(`Refusing ${operand}\\b`).test(bt)) both++;
    }
    both === 2
      ? pass("AUTH_NESTED_PATH_BOTH_PARAMS", "theme_set_font / theme_set_stylebox refuse BOTH `path` and their operand, naming which one")
      : fail("AUTH_NESTED_PATH_BOTH_PARAMS", `only ${both}/2 tools refused both parameters by name`);

    // 🔴 ALL THREE SPELLINGS on a host-side tool the addon never sees. `project_search`
    // does not touch the editor bridge, so the addon's `begins_with("res://")` check was
    // never in front of it — measured returning MATCHES from files outside the root.
    const root = GODOT_PROJECT.replace(/\/$/, "");
    const three = [`res://../${EVIL}`, `../${EVIL}`, path.join(path.dirname(root), "elsewhere")];
    let spelled = 0;
    for (const p of three) {
      const r = await client.callTool({ name: "project_search", arguments: { query: "extends", path: p } }, undefined, { timeout: 60000 });
      if (r.isError === true && /path_outside_project/.test(r.content?.[0]?.text || "")) spelled++;
    }
    spelled === 3
      ? pass("AUTH_NESTED_PATH_SPELLINGS", "project_search refuses res://.. , a bare relative and an absolute elsewhere — host-side, no addon in the path")
      : fail("AUTH_NESTED_PATH_SPELLINGS", `only ${spelled}/3 spellings refused`);

    // …and the legal side still works, including an OMITTED optional and an omitted
    // NESTED object. A guard that refused everything would pass every claim above.
    //
    // 🔴 THE SAME VACUOUS CONTROL AS AUTH_READ_PATH_LEGAL, IN THE SAME SENTENCE'S
    // SERVICE (169 §2). `typeof okSearch.count === "number" && Array.isArray(okList.files)`
    // is green for `count:0` and `files:[]` — which is precisely what a guard that
    // resolved every legal path to nothing would answer. Measured on a healthy tree:
    // project_search "extends" -> count=51; filesystem_list at res:// -> 6 files
    // including main.tscn and player.gd.
    //
    // The replacement names CONTENT, not shape: a non-zero count whose matches array
    // agrees with it, and two files that are definitely there. `truncated` is read
    // too — a search that silently capped would otherwise report a count that means
    // something different from the one this claim thinks it is reading.
    const okSearch = await call("project_search", { query: "extends" });
    const okList = await call("filesystem_list", {});
    const searchOk = okSearch.count > 0 && Array.isArray(okSearch.matches) && okSearch.matches.length > 0
      && okSearch.truncated !== true && okSearch.matches.every((m) => typeof m.file === "string" && m.file.startsWith("res://"));
    const listOk = Array.isArray(okList.files) && okList.files.includes("main.tscn") && okList.files.includes("player.gd");
    (searchOk && listOk)
      ? pass("AUTH_NESTED_PATH_LEGAL", `legal reads still return CONTENT (project_search -> ${okSearch.count} match(es) all under res://; filesystem_list -> ${okList.files.length} file(s) incl. main.tscn + player.gd)`)
      : fail("AUTH_NESTED_PATH_LEGAL", `searchOk=${searchOk} listOk=${listOk} | ${JSON.stringify(okSearch).slice(0, 90)} | ${JSON.stringify(okList).slice(0, 90)}`);
  });

  // ------------------------------------------------ AUTH_PATH_LEDGER (167) ----
  //
  // 🔴 THE SECTION ABOVE PINS PARAMETERS SOMEBODY ALREADY MEASURED. THIS ONE PINS THE
  // ONES NOBODY HAS.
  //
  // Six consecutive sessions found the same shape of defect: a path parameter that no
  // enumeration had ever asked about — `theme_set_*.path` survived four releases
  // because #175 guarded the SECOND parameter and nobody looked at the first. The root
  // cause was never a missing guard. It was that a parameter could enter the surface
  // and never appear in anyone's list.
  //
  // So the ledger is a GATE, not a note. `host/path-cohort-ledger.tsv` classifies all
  // 258 path-like parameters, and this claim fails when the live cohort and the ledger
  // disagree IN EITHER DIRECTION:
  //
  //   · a row in the surface with no ledger entry  -> a parameter nobody classified,
  //     named in the failure, so the next session cannot not-see it;
  //   · a ledger entry with no matching row        -> a classification that outlived
  //     the thing it classified.
  //
  // 🔴 THE SECOND HALF IS THE POINT AND IT IS WHY THIS IS NOT JUST A SNAPSHOT TEST.
  // 162's finding ("I swept the `path` params") became `if (prop === "path") continue;`
  // in the enumerator, and that filter kept asserting a conclusion for three sessions
  // after 165 disproved it — because nothing could ever notice it had gone stale. An
  // entry here cannot outlive its row.
  //
  // No fixture, no editor state, no new CI job: it reads the tool list and a file.
  await family("AUTH_PATH_LEDGER", async () => {
    const LEDGER = path.join(HOST_DIR, "path-cohort-ledger.tsv");
    const { enumeratePathCohort, summarisePathCohort } = await import("../dist/path-cohort.js");

    const tools = [];
    let cursor;
    do {
      const page = await client.listTools(cursor ? { cursor } : {});
      tools.push(...page.tools);
      cursor = page.nextCursor;
    } while (cursor);

    const live = enumeratePathCohort(tools);
    const sum = summarisePathCohort(live);
    const liveKeys = new Set(live.map((r) => `${r.tool}\t${r.param}`));

    const CLASSES = new Set([
      "guarded", "node-path", "not-a-path", "capability-gated", "do-not-reopen", "backend-absent", "stores-only",
    ]);
    const ledger = new Map();
    const badClass = [];
    for (const line of fs.readFileSync(LEDGER, "utf8").split("\n")) {
      if (!line.trim() || line.startsWith("#")) continue;
      const [tool, param, cls, ...reason] = line.split("\t");
      if (!CLASSES.has(cls)) { badClass.push(`${tool}.${param} -> ${cls}`); continue; }
      // a classification with no reason is a classification nobody has to defend
      if (!reason.join(" ").trim()) { badClass.push(`${tool}.${param} -> no reason given`); continue; }
      ledger.set(`${tool}\t${param}`, cls);
    }

    const unclassified = [...liveKeys].filter((k) => !ledger.has(k));
    const stale = [...ledger.keys()].filter((k) => !liveKeys.has(k));

    unclassified.length === 0
      ? pass("AUTH_PATH_LEDGER", `all ${live.length} path-like parameters in the live surface are classified (${sum.topLevelNamedPath} named \`path\`, ${sum.nested} nested)`)
      : fail("AUTH_PATH_LEDGER", `${unclassified.length} path-like parameter(s) entered the surface unclassified -> ${unclassified.map((k) => k.replace("\t", ".")).slice(0, 8).join(", ")}${unclassified.length > 8 ? " …" : ""} — measure them, then add a line to host/path-cohort-ledger.tsv`);

    stale.length === 0
      ? pass("AUTH_PATH_LEDGER_NO_STALE", `no ledger entry outlives its parameter (${ledger.size} entries, all live)`)
      : fail("AUTH_PATH_LEDGER_NO_STALE", `${stale.length} ledger entr(ies) name a parameter that no longer exists -> ${stale.map((k) => k.replace("\t", ".")).slice(0, 8).join(", ")}`);

    badClass.length === 0
      ? pass("AUTH_PATH_LEDGER_WELLFORMED", `every entry carries a known class and a reason (${[...CLASSES].join("/")})`)
      : fail("AUTH_PATH_LEDGER_WELLFORMED", `${badClass.length} malformed entr(ies) -> ${badClass.slice(0, 5).join("; ")}`);

    // 🔴 THE ENUMERATOR'S OWN REGRESSION ROW. `card_template_create.theme.font_path` is
    // the parameter that was invisible to BOTH hints at once: a compound name that an
    // exact-word list cannot match, and NO description for a description test to read.
    // If a future edit reintroduces either blindness, this row disappears and says so.
    //
    // 🔴 TWO CANARIES, ONE PER HISTORICAL BLINDNESS, AND THEY ARE NOT REDUNDANT WITH
    // THE TWO CLAIMS ABOVE. A blind enumerator SHRINKS the live set, so nothing reads
    // as unclassified — `AUTH_PATH_LEDGER` stays green through it. Measured, not
    // reasoned: reintroducing `if (prop === "path") continue;` left AUTH_PATH_LEDGER
    // saying "all 133 parameters classified" while 125 entries went stale.
    //
    // NO_STALE catches that today only because the ledger still holds the 124 rows. A
    // session that regenerated the ledger FROM a blind enumerator would take both
    // claims green together — which is precisely 162's failure mode one level up. The
    // canaries name specific parameters, so they survive a regeneration.
    const canaries = [
      // the nested compound name with NO description: invisible to an exact-word name
      // test AND to a description test, simultaneously. Blindnesses 1 + 3.
      ["card_template_create", "theme.font_path", "nested, compound name, no description"],
      // the parameter that survived FOUR releases because the enumerator discarded
      // every name equal to `path`. Blindness 2.
      ["theme_set_font", "path", "literally named `path` — the discarded cohort"],
    ];
    const lost = canaries.filter(([t, p]) => !live.some((r) => r.tool === t && r.param === p));
    lost.length === 0
      ? pass("AUTH_PATH_LEDGER_CANARY", `both blindness canaries are still enumerated (${canaries.map(([t, p]) => `${t}.${p}`).join(", ")})`)
      : fail("AUTH_PATH_LEDGER_CANARY", `the enumerator lost ${lost.map(([t, p, why]) => `${t}.${p} (${why})`).join("; ")} — a blindness has been reintroduced`);
  });

  // ---------------------------------------------------------------- cleanup ----
  // Put example/ back the way we found it. Until now this was a `rm -rf` glob a
  // developer typed by hand from the header comment, which meant (a) every local run
  // started from a tree the previous one had polluted, and (b) the glob only knew about
  // the families that existed when it was last edited — nothing ever checked it was
  // still complete. The snapshot inverts that: the artefact list is derived from what
  // actually appeared, so a family added tomorrow is covered without anyone remembering.
  //
  // The settle wait is not superstition: filesystem_scan and the editor's own watcher
  // both write asynchronously, and deleting a file the editor is mid-way through
  // minting produces a .uid with no owner. Waiting lets those land so restore removes
  // them rather than racing them.
  await sleep(1500);
  const restored = restoreDir(workspace);
  console.log(`AUTH_CLEAN_ACTION removed=${restored.removed.length} restored=${restored.rewritten.length} rmdir=${restored.rmdir.length}`
    + (restored.failed.length ? ` failed=${restored.failed.map((f) => `${f.path} (${f.why})`).join("; ")}` : ""));
  // AND THEN CHECK. restoreDir() reports what it DID; diffDir() re-walks the tree and
  // re-hashes every snapshotted file to establish what is actually TRUE — which is the
  // whole difference between this and a cleanup that merely runs. A restore that silently
  // misses a path is the same failure shape as #143's all-black frame passing on its
  // label: the step reports success and nothing ever compares the result to the claim.
  const residue = diffDir(workspace);
  residue.clean
    ? pass("AUTH_CLEAN", `example/ byte-identical to the pre-probe snapshot (${workspace.files.size} file(s) re-hashed; ${restored.removed.length + restored.rmdir.length} artefact(s) removed, ${restored.rewritten.length} restored)`)
    : fail("AUTH_CLEAN", `residue survived the restore -> ${describeDiff(residue)}`);

  // ------------------------------------------------------------ population ----
  //
  // 🔴 168 §8.5, ANSWERED: `T` in `AUTH_SUMMARY pass=P/T` was never compared to
  // anything, so a family that threw early shrank the suite and the pass RATE stayed
  // 100%. Three gates, cheapest first, each catching a shrink the previous one cannot.
  //
  // Measured baselines, session 169, local headless run against the g169 fixture:
  // 26 families, 203 claims, pass=200/203 (the three AUTH_SHOT_* / AUTH_MAINSCREEN_*
  // failures are the documented local-only viewport gap; CI under Xvfb reads 209).
  //
  // 🔴 THE FLOOR IS THE **LOCAL** TOTAL, NOT CI'S. A floor set to CI's 209 would fail
  // every local run, which is how floors get deleted rather than maintained.
  const AUTH_FAMILY_FLOOR = 26;
  const AUTH_CLAIM_FLOOR = 195;

  const emptyFamilies = families.filter((f) => f.made === 0);
  const partialFamilies = families.filter((f) => f.threw && f.made > 0);
  console.log(`AUTH_POPULATION families=${families.length}/${AUTH_FAMILY_FLOOR} claims=${results.pass.length + results.fail.length}/${AUTH_CLAIM_FLOOR} empty=${emptyFamilies.length} partial=${partialFamilies.length}`);

  // 1. every family that ran must have SAID something. A family whose body threw on its
  //    first call contributes one `_THREW` and nothing else — one failure standing in
  //    for however many claims it was going to make.
  emptyFamilies.length === 0
    ? pass("AUTH_POPULATION_SPOKE", `all ${families.length} famil(ies) made at least one claim`)
    : fail("AUTH_POPULATION_SPOKE", `${emptyFamilies.length} famil(ies) made NO claim: ${emptyFamilies.map((f) => f.label).join(", ")}`);

  // 2. 🔴 THE ONE THAT WOULD HAVE CAUGHT 168's 207 -> 189. A family that throws PART WAY
  //    through is the silent case: it files one `_THREW`, keeps the claims it already
  //    made, and drops the rest with no marker naming what went missing.
  partialFamilies.length === 0
    ? pass("AUTH_POPULATION_COMPLETE", "no family threw part way through, so no family dropped claims it had not yet reached")
    : fail("AUTH_POPULATION_COMPLETE", `${partialFamilies.length} famil(ies) threw AFTER claiming — claims were dropped, not failed: ${partialFamilies.map((f) => `${f.label}(made ${f.made}, then threw: ${f.threw?.slice(0, 60)})`).join(" | ")}`);

  // 3. the coarse backstop, and the scope check on the gate itself (168 §6): a floor
  //    whose expected family count silently drifted to zero would pass while covering
  //    nothing, so the family count is asserted before the claim count.
  const totalNow = results.pass.length + results.fail.length;
  (families.length >= AUTH_FAMILY_FLOOR && totalNow >= AUTH_CLAIM_FLOOR)
    ? pass("AUTH_POPULATION_FLOOR", `${families.length} famil(ies) / ${totalNow} claim(s) — at or above the measured floor`)
    : fail("AUTH_POPULATION_FLOOR", `THE SUITE GOT SMALLER, NOT GREENER: ${families.length} famil(ies) (floor ${AUTH_FAMILY_FLOOR}) / ${totalNow} claim(s) (floor ${AUTH_CLAIM_FLOOR})`);

  // ---------------------------------------------------------------- summary ----
  console.log("AUTH_UNDO_ASSERTED note=undo/redo round-tripped via editor_undo/editor_redo (see AUTH_UNDO_* / AUTH_REDO_* markers)");
  const total = results.pass.length + results.fail.length;
  console.log(`\nAUTH_SUMMARY pass=${results.pass.length}/${total} fail=${results.fail.length}${results.fail.length ? " -> " + results.fail.join(", ") : ""}`);
  await client.close();
  process.exit(results.fail.length ? 1 : 0);
}

main().catch((e) => {
  console.error("[authoring] FATAL:", (e && e.stack) || e);
  // Restore on the way out of a crash too. Deliberately NOT asserted and never allowed
  // to throw: the run has already failed, the exit code already says so, and a cleanup
  // error here would replace the stack trace that explains the actual failure.
  if (workspace) {
    try {
      const r = restoreDir(workspace);
      console.error(`[authoring] cleanup after FATAL: removed=${r.removed.length} restored=${r.rewritten.length} rmdir=${r.rmdir.length} failed=${r.failed.length}`);
    } catch (ce) {
      console.error("[authoring] cleanup after FATAL did not complete:", (ce && ce.message) || ce);
    }
  }
  process.exit(1);
});

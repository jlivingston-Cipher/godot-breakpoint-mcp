// Tabletop-plane gate — the `card_* / board_* / piece_* / interact_*` family
// (14 tools) against a REAL running Godot editor's Breakpoint MCP addon (:9080).
//
// WHY THIS EXISTS. Session 160 §8.19 left `tabletop` as the last substantial
// lead: 14 tools, no live gate, and a read path that five consecutive sessions
// had READ and described wrongly in two directions. Session 161 measured it
// instead, and the measurement found FIVE defects where the handoff predicted
// one — including two nobody had proposed:
//
//   D1  card_deck_from_table READ a file outside the project root through all
//       three spellings (absolute, res://../, bare ../) and stamped its rows
//       into the scene. Not just a read: content crossing the project boundary.
//   D2  "" from readFileText conflated FOUR causes — missing, a real but EMPTY
//       file, a DIRECTORY, and the project root itself — and answered
//       "(does it exist?)" to all four. Three of them existed.
//   D3  FOUR scene creators WROTE outside the root through res://../, which
//       satisfies their startsWith("res://") pre-guard. Seven files created
//       outside a real project root, every call answering isError:false.
//   D4  mp_wire_rpc REWROTE a .gd file outside the root, 3/3. Its own pre-guard
//       does stop an absolute path and a bare ../, so 160 §8.4's "same root
//       cause, two families" was half right — the helper is shared, the
//       reachable escape set is not.
//   D5  `overwrite` was declared in four schemas, documented, and never read.
//       A second create APPENDED to the existing scene (5 nodes on disk became
//       9), answered saved:true, and reported the node_count it INTENDED.
//
// Every claim below is one of those, pinned. The unit suite proves the guards
// and that they are wired; this proves it against an engine that actually
// resolves res:// and actually saves scenes.
//
// HOW IT ASSERTS. Two oracles, deliberately with different blind spots:
//   * the tool's ANSWER — the refusal code and message, asserted BY REASON
//     (a refusal for the right reason with the wrong name is still a defect);
//   * the FILESYSTEM beside the project root — a sibling `<root>_evil/`
//     directory whose contents are diffed before and after. The answer oracle
//     can be fooled by a tool that refuses and writes anyway; the directory
//     cannot. D3 was found by the second one.
//
// The sibling directory is also the point of the temp copy: `<root>_evil`
// SHARES the root's string prefix, so a guard written as a bare
// startsWith(root) passes it. That is the case a guard rooted at the repo's own
// example/ could not express (160 §5 — and booting --editor damages
// example/project.godot besides).
//
// Markers (grep-able): TT_GATE_* / TT_LIVE_* / TT_READ_* / TT_WRITE_* /
// TT_OVERWRITE_* / TT_RPC_*. Every marker prints OK or FAIL; a trailing
// TT_SUMMARY reports the tally and the process exits non-zero if any failed.
//
// Requires the editor up with GODOT_PROJECT pointing at a TEMP COPY of example/
// that has a sibling <root>_evil/ directory. Run from host/:
//   GODOT_PROJECT=/tmp/tt/example node test-integration/tabletop-plane.integration.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { Population } from "./_population.mjs";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const HOST_DIR = path.resolve(THIS_DIR, "..");
const DIST = path.join(HOST_DIR, "dist", "index.js");
const GODOT_PROJECT = process.env.GODOT_PROJECT || path.join(path.resolve(HOST_DIR, ".."), "example");
const GODOT_BIN = process.env.GODOT_BIN || "godot";
const ROOT = GODOT_PROJECT.replace(/\/$/, "");
const EVIL = `${ROOT}_evil`;
const EVIL_BASE = path.basename(EVIL);
const MAIN = "res://main.tscn";

const GATED = new Set([
  "card_template_create", "piece_template_create", "board_create", "board_tile_create",
  "interact_make_draggable", "interact_add_drop_zone", "mp_wire_rpc", "scene_open", "scene_close",
]);

const results = { pass: [], fail: [] };
// The five families this probe must always run. 🔴 `TT_GATE_PING` is deliberately
// absent: it is the reachability banner, made outside any family.
const population = new Population("TT", {
  families: ["TT_LIVE", "TT_READ", "TT_WRITE", "TT_OVERWRITE", "TT_RPC"],
  scope: 5,
  claims: 50,         // 🔴 EXACT — 50 locally and in CI
  // 🔴 184 §3: THE COMMENT ABOVE WAS THE ONLY THING SAYING THIS, AND A COMMENT IS NOT A
  // GATE. Both banner claims are made before the first family opens, so they land in the
  // unattributed bucket, print as `unsealed=`, and were read by nothing — while counting
  // toward `claims: 50`. Declared, so the count is re-measured every run and a third one
  // appearing is a failure rather than a number in a line nobody reads.
  unsealed: 2,
  unsealedWhy: "TT_GATE_PING is the reachability banner and TT_GATE_SURFACE the registration "
             + "banner; both are made before the first family opens, on purpose, because "
             + "neither describes a plane behaviour and a run that fails them never reaches "
             + "a family at all",
});
function pass(marker, detail = "") { population.claim(); results.pass.push(marker); console.log(`${marker} OK ${detail}`.trimEnd()); }
function fail(marker, detail = "") { population.claim(); results.fail.push(marker); console.log(`${marker} FAIL ${detail}`.trimEnd()); }

/**
 * Assert a refusal BY REASON, and quote what actually came back when it does
 * not hold. 160 §7: "a gate's failure message is part of the gate" — the DAP
 * gate's bare "not accepted" cost a CI round-trip to diagnose something the
 * probe already knew.
 */
function expectRefusal(marker, r, code, extra = "") {
  if (!r.isError && !r.threw) return fail(marker, `expected refusal ${code}, got SUCCESS ${JSON.stringify(r.sc).slice(0, 200)} ${extra}`);
  const text = r.threw ?? r.text;
  if (!text.includes(code)) return fail(marker, `expected refusal ${code}, got: ${text.slice(0, 200)} ${extra}`);
  pass(marker, `${code} ${extra}`.trim());
}
function expectOk(marker, r, detail = "") {
  if (r.threw) return fail(marker, `threw: ${r.threw.slice(0, 200)}`);
  if (r.isError) return fail(marker, `refused: ${r.text.slice(0, 200)}`);
  pass(marker, detail);
}

/** Files under the sibling directory — the oracle the answer cannot fake. */
const evilFiles = () => (fs.existsSync(EVIL) ? fs.readdirSync(EVIL).sort() : []);
const sceneNodeCount = (resPath) => {
  const f = path.join(ROOT, resPath.replace("res://", ""));
  if (!fs.existsSync(f)) return -1;
  return (fs.readFileSync(f, "utf8").match(/^\[node /gm) || []).length;
};

async function main() {
  if (!fs.existsSync(EVIL)) {
    console.log(`TT_GATE_FIXTURE FAIL no sibling directory at ${EVIL} — the escape claims cannot be expressed without one`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(EVIL, "outside.csv"), "name,cost\nOUTSIDE_LEAK,99\n");
  fs.writeFileSync(path.join(EVIL, "outside.gd"), "extends Node\nfunc ping():\n\tpass\n");
  const baseline = evilFiles();

  // The probe MINTS its own fixtures, the way the authoring plane mints its
  // textures: nothing is committed to example/, so §5's standing consequence
  // holds — the tracked-file count does not move and there is no new .uid
  // sidecar to commit. GODOT_PROJECT is a temp copy, so this is safe to write.
  //
  // Its own prior outputs are cleared below, AFTER the client connects — see
  // resetOwnArtifacts(). Deleting them from here would delete files that are
  // still open in the editor, and a scene tab outlives its file.

  const transport = new StdioClientTransport({
    command: "node", args: [DIST], cwd: HOST_DIR,
    env: { ...process.env, GODOT_BIN, GODOT_PROJECT, BREAKPOINT_PRIVILEGED_GROUPS: "all" },
    stderr: "inherit",
  });
  const client = new Client({ name: "gcb-tabletop", version: "1.0.0" }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async () => ({ action: "accept", content: { proceed: true } }));
  await client.connect(transport);

  async function call(name, args = {}) {
    const a = GATED.has(name) ? { confirm: true, ...args } : args;
    try {
      const r = await client.callTool({ name, arguments: a }, undefined, { timeout: 60000 });
      return { isError: !!r.isError, text: (r.content?.[0]?.text || "").replace(/\s+/g, " "), sc: r.structuredContent ?? null };
    } catch (e) { return { threw: String(e?.message || e).replace(/\s+/g, " ") }; }
  }
  // 🔴 THE FAMILY IS THE POPULATION UNIT, AND IT NOW REPORTS ITS OWN SIZE (169 §4).
  // `TT_SUMMARY 15/15 ok` printed a total that was never compared to anything: a
  // family throwing halfway keeps the claims it made, drops the rest, and the run
  // still reads 100% for a smaller number. Delegated to `_population.mjs` rather
  // than open-coded so this probe and the eleven others share one gate.
  const family = (label, fn) =>
    population.family(label, fn, (l, threw) => fail(`${l}_THREW`, threw));

  // ------------------------------------------------------------- gate ----
  console.log(`tabletop-plane gate -> host stdio, GODOT_PROJECT=${GODOT_PROJECT}, sibling=${EVIL}`);
  let up = false;
  for (let i = 0; i < 40; i++) {
    const r = await call("editor_ping");
    if (r.sc?.pong) {
      up = true;
      pass("TT_GATE_PING", `addon=${r.sc.addon_version} godot=${r.sc.godot}`);
      break;
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  if (!up) { console.log("TT_GATE_PING FAIL addon unreachable on :9080"); process.exit(1); }

  // ------------------------------------------------- reset, re-runnably ----
  // The gate asserts that a create REFUSES an existing path, so a second run
  // against a project it already wrote would fail its own happy path for the
  // exact reason it is testing for. Scenes are CLOSED through the editor before
  // their files are removed: a tab outlives its file, and a create that lands on
  // a stale tab appends to it — which is how the first draft of this probe
  // produced a "fresh" 2×2 board with nine nodes in it. Only `_tt_*` is touched,
  // so a developer's own scratch is never in range.
  async function resetOwnArtifacts() {
    // EVERY open scene except main, not just `_tt_*`. Narrowing it to the
    // probe's own names looked tidier and was wrong: a create appends to
    // whatever stale tab the editor reuses, and the editor does not care whose
    // scene it is. Measured — a run that closed only `_tt_*` still produced a
    // "fresh" 2×2 board with nine nodes, and the run after it passed, which is
    // exactly the shape of 160 §4's "green by timing accident".
    for (let sweep = 0; sweep < 12; sweep++) {
      const open = ((await call("scene_list_open")).sc?.scenes ?? []).map(String);
      const target = open.find((s) => s !== MAIN);
      if (!target) break;
      await call("scene_open", { path: target });
      const closed = await call("scene_close", { path: target });
      if (closed.isError || closed.threw) break;   // unclosable: stop rather than spin
    }
    await call("scene_open", { path: MAIN });
    for (const f of fs.readdirSync(ROOT)) {
      if (f.startsWith("_tt_")) fs.rmSync(path.join(ROOT, f), { recursive: true, force: true });
    }
    fs.writeFileSync(path.join(ROOT, "_tt_cards.csv"), "name,cost\nAlpha,1\nBeta,2\nGamma,3\n");
    fs.writeFileSync(path.join(ROOT, "_tt_empty.csv"), "");           // real, reachable, 0 bytes
    fs.mkdirSync(path.join(ROOT, "_tt_adir"), { recursive: true });   // a directory, not a file
  }
  await resetOwnArtifacts();

  const FOURTEEN = [
    "card_template_create", "card_instance", "card_hand_layout", "card_deck_from_table",
    "card_set_face", "board_create", "board_place", "board_tile_create", "board_tile_place",
    "piece_template_create", "piece_instance", "piece_move",
    "interact_make_draggable", "interact_add_drop_zone",
  ];
  const listed = (await client.listTools()).tools.map((t) => t.name);
  const missing = FOURTEEN.filter((t) => !listed.includes(t));
  if (missing.length) fail("TT_GATE_SURFACE", `not registered: ${missing.join(", ")}`);
  else pass("TT_GATE_SURFACE", "14/14 registered");

  // ------------------------------------------ 1 · the plane actually works ----
  // A gate that only proves refusals would go green on a plane that refuses
  // EVERYTHING. These claims are the counterweight: the 14 tools still do their
  // job on legal input. ORDER MATTERS — every *_create decomposes onto
  // scene.new → … → scene.save, which SWITCHES the edited scene, so the four
  // disk writers run first and the in-scene work follows one scene_open.
  await family("TT_LIVE", async () => {
    const T = "res://_tt_card.tscn", P = "res://_tt_piece.tscn";
    const B = "res://_tt_board.tscn", TB = "res://_tt_tileboard.tscn";
    expectOk("TT_LIVE_CARD_TEMPLATE", await call("card_template_create", {
      path: T, size: { width: 120, height: 180 },
      slots: [{ name: "title", kind: "label" }, { name: "cost", kind: "badge" }],
    }), `nodes_on_disk=${sceneNodeCount(T)}`);
    expectOk("TT_LIVE_PIECE_TEMPLATE", await call("piece_template_create", {
      path: P, size: { width: 48, height: 48 }, color: "#3366cc", hit_area: { shape: "rectangle" },
    }), `nodes_on_disk=${sceneNodeCount(P)}`);
    expectOk("TT_LIVE_BOARD_CREATE", await call("board_create", {
      path: B, layout: { mode: "grid", rows: 3, cols: 3 },
    }), `nodes_on_disk=${sceneNodeCount(B)}`);
    expectOk("TT_LIVE_TILE_CREATE", await call("board_tile_create", {
      path: TB, rows: 2, cols: 2, tile_size: [32, 32],
    }), `nodes_on_disk=${sceneNodeCount(TB)}`);

    // A template is only a template if it survives the round trip to disk: the
    // measurement's first false alarm was an instance that worked ONLY because
    // the template scene was still the edited one in memory.
    const nodes = sceneNodeCount(T);
    if (nodes >= 5) pass("TT_LIVE_TEMPLATE_PERSISTED", `${nodes} nodes saved`);
    else fail("TT_LIVE_TEMPLATE_PERSISTED", `only ${nodes} node(s) on disk — the slots did not survive the save`);

    expectOk("TT_LIVE_SCENE_OPEN", await call("scene_open", { path: MAIN }));
    const inst = await call("card_instance", {
      template_path: T, parent: ".", name: "TTCard", data: { title: "Solo", cost: 7 },
    });
    // The central promise of a template: an instance binds data through the
    // GENERATED set_data(). If the script did not persist, this is where it shows.
    if (!inst.isError && !inst.threw && Array.isArray(inst.sc?.bound) && inst.sc.bound.length === 2) {
      pass("TT_LIVE_CARD_INSTANCE", `bound=${JSON.stringify(inst.sc.bound)}`);
    } else {
      fail("TT_LIVE_CARD_INSTANCE", `expected both slots bound, got ${inst.threw ?? inst.text ?? JSON.stringify(inst.sc)}`.slice(0, 220));
    }
    expectOk("TT_LIVE_HAND_LAYOUT", await call("card_hand_layout", {
      template_path: T, parent: ".", mode: "fan", fan_angle: 30,
      cards: [{ data: { title: "A" } }, { data: { title: "B" } }],
    }));
    expectOk("TT_LIVE_CARD_SET_FACE", await call("card_set_face", { node: "TTCard", face_up: false }));
    expectOk("TT_LIVE_BOARD_INSTANCE", await call("node_instantiate_scene", { scene_path: B, parent_path: ".", name: "TTBoard" }));
    expectOk("TT_LIVE_BOARD_PLACE", await call("board_place", { board: "TTBoard", node: "TTCard", cell: "0_0" }));
    expectOk("TT_LIVE_TILE_INSTANCE", await call("node_instantiate_scene", { scene_path: TB, parent_path: ".", name: "TTTiles" }));
    expectOk("TT_LIVE_PIECE_INSTANCE", await call("piece_instance", {
      template_path: P, parent: ".", name: "TTPiece", data: { label: "P1", color: "#cc3366" },
    }));
    expectOk("TT_LIVE_TILE_PLACE", await call("board_tile_place", {
      layer: "TTTiles/Cells", node: "TTPiece", coord: [1, 1], tile_size: [32, 32],
    }));
    expectOk("TT_LIVE_BOARD_PLACE_2", await call("board_place", { board: "TTBoard", node: "TTTiles/Cells/TTPiece", cell: "0_1" }));
    expectOk("TT_LIVE_PIECE_MOVE", await call("piece_move", { board: "TTBoard", node: "TTBoard/cell_0_1/TTPiece", to: "1_1" }));
    // `hit_area` is REQUIRED here and that is not a workaround: node2d drag is
    // driven by Area2D.input_event, and a Node2D root has no such signal. The
    // piece template mints the Area2D as "HitArea" when hit_area is requested.
    // Without it the tool refuses with no_signal — a correct, well-named refusal,
    // asserted as such below rather than papered over.
    expectOk("TT_LIVE_DRAGGABLE", await call("interact_make_draggable", {
      node: "TTBoard/cell_1_1/TTPiece", script_path: "res://_tt_drag.gd", mode: "node2d",
      hit_area: "HitArea", payload: { kind: "piece" },
    }));
    expectRefusal("TT_LIVE_DRAGGABLE_NO_SIGNAL", await call("interact_make_draggable", {
      node: "TTBoard", script_path: "res://_tt_drag2.gd", mode: "node2d",
    }), "no_signal", "a Node2D with no Area2D cannot drive a node2d drag");
    expectOk("TT_LIVE_DROP_ZONE", await call("interact_add_drop_zone", {
      node: "TTBoard", script_path: "res://_tt_drop.gd", mode: "node2d",
    }));
  });

  // ------------------------------- 2 · D1 — the read path may not escape ----
  const deck = (table_path) => ({
    template_path: "res://_tt_card.tscn", parent: ".", table_path,
    column_map: { title: "{name}" }, limit: 1,
  });
  await family("TT_READ", async () => {
    for (const [marker, spelling] of [
      ["TT_READ_ESCAPE_ABS", path.join(EVIL, "outside.csv")],
      ["TT_READ_ESCAPE_RES", `res://../${EVIL_BASE}/outside.csv`],
      ["TT_READ_ESCAPE_REL", `../${EVIL_BASE}/outside.csv`],
    ]) {
      const r = await call("card_deck_from_table", deck(spelling));
      expectRefusal(marker, r, "path_outside_project", `spelling=${JSON.stringify(spelling)}`);
    }

    // D2 — four causes, four ANSWERS. Three of these paths exist; the old
    // refusal asked "does it exist?" about all four.
    for (const [marker, table_path, code] of [
      ["TT_READ_CAUSE_MISSING", "res://__tt_nope.csv", "not_found"],
      ["TT_READ_CAUSE_DIR", "res://_tt_adir", "not_a_file"],
      ["TT_READ_CAUSE_ROOT", "", "not_a_file"],
      ["TT_READ_CAUSE_EMPTY", "res://_tt_empty.csv", "empty_table"],
    ]) {
      expectRefusal(marker, await call("card_deck_from_table", deck(table_path)), code, `path=${JSON.stringify(table_path)}`);
    }

    // ...and the legal spellings still READ. An absolute path that lands INSIDE
    // the root stays legal by decision (session 161): `table_path` is documented
    // as "res:// or absolute" and narrowing it would break real callers.
    for (const [marker, table_path] of [
      ["TT_READ_LEGAL_RES", "res://_tt_cards.csv"],
      ["TT_READ_LEGAL_REL", "_tt_cards.csv"],
      ["TT_READ_LEGAL_ABS_INSIDE", path.join(ROOT, "_tt_cards.csv")],
    ]) {
      const r = await call("card_deck_from_table", deck(table_path));
      if (!r.isError && !r.threw && r.sc?.rows_read === 3) pass(marker, `rows_read=3`);
      else fail(marker, `expected a 3-row read, got ${r.threw ?? r.text ?? JSON.stringify(r.sc)}`.slice(0, 200));
    }
  });

  // ---------------------------- 3 · D3 — the write paths may not escape ----
  // The second oracle carries this one. Each tool's answer is asserted, and
  // then the sibling DIRECTORY is diffed: a tool that refuses and writes anyway
  // passes the first check and fails the second, which is the failure mode the
  // answer oracle cannot see. Before the fix these four created seven files here.
  await family("TT_WRITE", async () => {
    const esc = (ext) => `res://../${EVIL_BASE}/tt_esc${ext}`;
    for (const [marker, tool, args] of [
      ["TT_WRITE_ESCAPE_CARD", "card_template_create", { path: esc("_card.tscn"), size: { width: 10, height: 10 }, slots: [{ name: "t", kind: "label" }] }],
      ["TT_WRITE_ESCAPE_PIECE", "piece_template_create", { path: esc("_piece.tscn"), size: { width: 10, height: 10 } }],
      ["TT_WRITE_ESCAPE_BOARD", "board_create", { path: esc("_board.tscn"), layout: { mode: "grid", rows: 1, cols: 1 } }],
      ["TT_WRITE_ESCAPE_TILE", "board_tile_create", { path: esc("_tile.tscn"), rows: 1, cols: 1 }],
      ["TT_WRITE_ESCAPE_DRAG", "interact_make_draggable", { node: "TTBoard", script_path: esc("_drag.gd"), mode: "node2d" }],
      ["TT_WRITE_ESCAPE_DROP", "interact_add_drop_zone", { node: "TTBoard", script_path: esc("_drop.gd"), mode: "node2d" }],
    ]) {
      expectRefusal(marker, await call(tool, args), "path_outside_project");
    }
    // A supplied tileset is READ rather than written, and escapes just the same.
    expectRefusal("TT_WRITE_ESCAPE_TILESET", await call("board_tile_create", {
      path: "res://_tt_fresh.tscn", rows: 1, cols: 1, tileset: `res://../${EVIL_BASE}/tt_esc.tres`,
    }), "path_outside_project");

    const leaked = evilFiles().filter((f) => !baseline.includes(f));
    if (leaked.length === 0) pass("TT_WRITE_NO_LEAK", `sibling directory unchanged (${baseline.length} file(s))`);
    else fail("TT_WRITE_NO_LEAK", `${leaked.length} file(s) created OUTSIDE the project root: ${JSON.stringify(leaked)}`);
  });

  // ------------------------------------- 4 · D5 — overwrite means overwrite ----
  await family("TT_OVERWRITE", async () => {
    const P = "res://_tt_ovr.tscn";
    const mk = (extra = {}) => call("board_create", { path: P, layout: { mode: "grid", rows: 2, cols: 2 }, ...extra });
    // The expected count is ABSOLUTE — root + 4 cells for a 2×2 grid — not
    // "whatever the first create produced". Comparing against the first result
    // would bake a corrupt baseline in as correct: the first run of this very
    // assertion passed while the file held NINE nodes, because the earlier run's
    // scene was still open and the create appended to it.
    const CLEAN = 5;
    expectOk("TT_OVERWRITE_FIRST", await mk(), `nodes_on_disk=${sceneNodeCount(P)}`);
    const first = sceneNodeCount(P);
    if (first === CLEAN) pass("TT_OVERWRITE_FIRST_CLEAN", `${CLEAN} nodes`);
    else fail("TT_OVERWRITE_FIRST_CLEAN", `a fresh 2x2 board must be ${CLEAN} nodes, got ${first} — it appended to a stale editor tab`);

    // The ordinary accident: the same call again. It used to answer saved:true
    // and take the file from 5 nodes to 9 while reporting a node_count of 5.
    expectRefusal("TT_OVERWRITE_REFUSES", await mk(), "exists");
    if (sceneNodeCount(P) === first) pass("TT_OVERWRITE_UNCHANGED", `still ${first} node(s) — the refusal did not write`);
    else fail("TT_OVERWRITE_UNCHANGED", `refused but the scene changed: ${first} -> ${sceneNodeCount(P)} node(s)`);

    // ...and the documented opt-in REPLACES rather than appends. This is the
    // claim that needs a live editor: the append came from the editor reusing an
    // already-open tab whose in-memory tree was stale, which no unit test sees.
    const over = await mk({ overwrite: true });
    if (over.isError || over.threw) {
      // Godot < 4.4 cannot close a scene; the tool must REFUSE, never append.
      expectRefusal("TT_OVERWRITE_TRUE", over, "overwrite_unsupported", "(Godot < 4.4 — refusing is correct here)");
      if (sceneNodeCount(P) === first) pass("TT_OVERWRITE_NO_APPEND", `still ${first} node(s)`);
      else fail("TT_OVERWRITE_NO_APPEND", `refused but appended anyway: ${first} -> ${sceneNodeCount(P)}`);
    } else {
      pass("TT_OVERWRITE_TRUE", `replaced, nodes_on_disk=${sceneNodeCount(P)}`);
      const after = sceneNodeCount(P);
      if (after === CLEAN) pass("TT_OVERWRITE_NO_APPEND", `${after} node(s) — replaced, not appended`);
      else fail("TT_OVERWRITE_NO_APPEND", `expected ${CLEAN} node(s) after an overwrite, got ${after} — this is the append defect`);
    }
  });

  // ------------------------- 5 · D4 — mp_wire_rpc shares the read helper ----
  // 160 §8.4 called netcode "the same root cause". The helper is shared; the
  // reachable escape set is NOT — mp_wire_rpc's own res:// + .gd pre-guard
  // already refused an absolute path and a bare ../, and only res://../ got
  // through. Asserted per spelling so the distinction cannot rot back.
  await family("TT_RPC", async () => {
    const gd = path.join(EVIL, "outside.gd");
    const before = fs.readFileSync(gd, "utf8");
    for (const [marker, p, code] of [
      ["TT_RPC_ESCAPE_ABS", gd, "bad_params"],
      ["TT_RPC_ESCAPE_REL", `../${EVIL_BASE}/outside.gd`, "bad_params"],
      ["TT_RPC_ESCAPE_RES", `res://../${EVIL_BASE}/outside.gd`, "path_outside_project"],
    ]) {
      expectRefusal(marker, await call("mp_wire_rpc", { path: p, function: "ping", mode: "any_peer" }), code);
    }
    if (fs.readFileSync(gd, "utf8") === before) pass("TT_RPC_NO_MUTATION", "the file outside the root is byte-identical");
    else fail("TT_RPC_NO_MUTATION", "mp_wire_rpc REWROTE a file outside the project root");

    // ...and it still refuses a missing in-project script by the right name.
    expectRefusal("TT_RPC_MISSING", await call("mp_wire_rpc", { path: "res://__tt_nope.gd", function: "ping" }), "not_found");
  });

  // ----------------------------------------------------- population + summary ----
  // 🔴 THE GATE, BEFORE THE TALLY. `TT_SUMMARY` reports a rate; the rate stays 100%
  // when the denominator shrinks, which is the only failure mode it cannot show.
  for (const f of population.report()) results.fail.push(f.split(" — ")[0]);

  const total = results.pass.length + results.fail.length;
  console.log(`\nTT_SUMMARY ${results.pass.length}/${total} ok` +
    (results.fail.length ? ` — FAILED: ${results.fail.join(", ")}` : ""));
  if (results.fail.length === 0) console.log("TT_ALL ok — every claim held");
  await client.close();
  process.exit(results.fail.length ? 1 : 0);
}

main().catch((e) => {
  console.error("TT_FATAL", e);
  process.exit(1);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerTabletopTools } from "../src/tools/tabletop.js";
import type { Config } from "../src/config.js";

/**
 * The guards as the REGISTERED TOOLS expose them.
 *
 * paths_guard.test.ts proves the helpers. This file proves they are actually
 * WIRED — a mutation that deletes the guard call from a handler leaves every
 * helper test green and would sail through, which is 160 §6's "aimed at the
 * wrong layer" trap read from the other side. Each assertion here fails if the
 * guard stops being reachable through the tool a caller actually invokes.
 *
 * The bridge is a recorder: `calls.length === 0` is how each test proves the
 * refusal happened BEFORE anything was written, not after.
 */

type Handler = (args: Record<string, unknown>) => Promise<{
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content?: Array<{ type: string; text?: string }>;
}>;

interface BridgeCall { method: string; params: Record<string, unknown> }

function workspace(): { root: string; evil: string; cleanup: () => void } {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gcb-tt-")));
  const root = path.join(base, "proj");
  const evil = `${root}_evil`;              // shares the prefix on purpose
  fs.mkdirSync(root);
  fs.mkdirSync(evil);
  fs.writeFileSync(path.join(root, "cards.csv"), "name,cost\nAlpha,1\n");
  fs.writeFileSync(path.join(root, "empty.csv"), "");
  fs.mkdirSync(path.join(root, "adir"));
  fs.writeFileSync(path.join(root, "taken.tscn"), "[gd_scene format=3]\n");
  fs.writeFileSync(path.join(evil, "outside.csv"), "name,cost\nLEAK,99\n");
  return { root, evil, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}

function setup(root: string, responses: Record<string, Record<string, unknown>> = {}) {
  const handlers: Record<string, Handler> = {};
  const calls: BridgeCall[] = [];
  const server = {
    registerTool(name: string, _c: unknown, handler: Handler) { handlers[name] = handler; },
    server: { elicitInput: async () => ({ action: "accept", content: { proceed: true } }) },
  };
  const bridge = {
    async request(method: string, params: Record<string, unknown> = {}) {
      calls.push({ method, params });
      if (method in responses) return responses[method];
      if (method === "scene.list_open") return { scenes: [], current: null };
      if (method === "node.call_method" && params.method === "set_data") return { result: { bound: [], unbound: [] } };
      return {};
    },
  };
  registerTabletopTools(
    server as never,
    bridge as never,
    { projectPath: root } as Config,
  );
  return { handlers, calls };
}

const textOf = (r: { content?: Array<{ text?: string }> }) => String(r.content?.[0]?.text ?? "");

// ------------------------------------- card_deck_from_table: the READ path ----

const deck = (table_path: string) => ({
  template_path: "res://card.tscn", parent: ".", table_path,
  column_map: { title: "{name}" },
});

test("card_deck_from_table REFUSES all three escape spellings, with no bridge call", async () => {
  const { root, evil } = workspace();
  const base = path.basename(evil);
  for (const spelling of [
    path.join(evil, "outside.csv"),
    `res://../${base}/outside.csv`,
    `../${base}/outside.csv`,
  ]) {
    const { handlers, calls } = setup(root);
    const r = await handlers.card_deck_from_table(deck(spelling));
    assert.equal(r.isError, true, spelling);
    assert.match(textOf(r), /path_outside_project/, spelling);
    // The measured defect was not merely a lenient read: card_deck_from_table
    // STAMPS what it reads into the scene, so a leak is content crossing the
    // project boundary. Nothing may reach the bridge.
    assert.equal(calls.length, 0, `${spelling} reached the bridge`);
  }
});

test("card_deck_from_table distinguishes missing / directory / project-root / EMPTY", async () => {
  const { root } = workspace();
  for (const [table_path, code] of [
    ["res://__nope.csv", "not_found"],
    ["res://adir", "not_a_file"],
    ["", "not_a_file"],
    ["res://empty.csv", "empty_table"],
  ] as const) {
    const { handlers } = setup(root);
    const r = await handlers.card_deck_from_table(deck(table_path));
    assert.equal(r.isError, true, table_path);
    assert.match(textOf(r), new RegExp(code), `${JSON.stringify(table_path)} should answer ${code}`);
  }
});

test("card_deck_from_table still READS a legal table (res://, relative, absolute-inside)", async () => {
  const { root } = workspace();
  for (const table_path of ["res://cards.csv", "cards.csv", path.join(root, "cards.csv")]) {
    const { handlers } = setup(root);
    const r = await handlers.card_deck_from_table(deck(table_path));
    assert.notEqual(r.isError, true, `${table_path}: ${textOf(r)}`);
    assert.equal(r.structuredContent?.rows_read, 1, table_path);
  }
});

// -------------------------------------- the four creators: the WRITE path ----

const CREATORS: Array<[string, (p: string) => Record<string, unknown>]> = [
  ["card_template_create", (p) => ({ path: p, size: { width: 10, height: 10 }, slots: [{ name: "t", kind: "label" }], confirm: true })],
  ["piece_template_create", (p) => ({ path: p, size: { width: 10, height: 10 }, confirm: true })],
  ["board_create", (p) => ({ path: p, layout: { mode: "grid", rows: 1, cols: 1 }, confirm: true })],
  ["board_tile_create", (p) => ({ path: p, rows: 1, cols: 1, confirm: true })],
];

test("every scene creator REFUSES res://../ — the spelling their pre-guard let through", async () => {
  const { root, evil } = workspace();
  const escape = `res://../${path.basename(evil)}/esc.tscn`;
  for (const [name, args] of CREATORS) {
    const { handlers, calls } = setup(root);
    const r = await handlers[name](args(escape));
    assert.equal(r.isError, true, name);
    assert.match(textOf(r), /path_outside_project/, name);
    // Measured before the fix: these four created SEVEN files outside the root.
    assert.equal(calls.length, 0, `${name} reached the bridge`);
  }
});

test("every scene creator REFUSES an existing path when overwrite is absent or false", async () => {
  const { root } = workspace();
  for (const [name, args] of CREATORS) {
    for (const overwrite of [undefined, false]) {
      const { handlers, calls } = setup(root);
      const a = args("res://taken.tscn");
      if (overwrite !== undefined) a.overwrite = overwrite;
      const r = await handlers[name](a);
      assert.equal(r.isError, true, `${name} overwrite=${overwrite}`);
      assert.match(textOf(r), /exists/, name);
      // Before the fix this APPENDED to the existing scene and answered
      // saved:true with the node_count it INTENDED, not the one on disk.
      assert.equal(calls.length, 0, `${name} wrote over an existing path`);
    }
  }
});

test("overwrite:true proceeds, and closes a STALE editor tab first — in ALL FOUR creators", async () => {
  // Parameterised over all four deliberately. The first version of this test
  // covered board_create alone, and the mutation sweep caught that immediately:
  // deleting the clearStaleTab call from card_template_create SURVIVED, because
  // nothing looked at the other three. Four call sites, four assertions.
  for (const [name, args] of CREATORS) {
    const { root } = workspace();
    // The scene is open AND current: the editor would otherwise reuse that tab's
    // old in-memory tree and append to it.
    const { handlers, calls } = setup(root, {
      "scene.list_open": { scenes: ["res://taken.tscn"], current: "res://taken.tscn" },
    });
    const a = args("res://taken.tscn");
    a.overwrite = true;
    const r = await handlers[name](a);
    assert.notEqual(r.isError, true, `${name}: ${textOf(r)}`);
    const methods = calls.map((c) => c.method);
    assert.ok(methods.includes("scene.close"), `${name}: expected a scene.close, got ${methods.join(" → ")}`);
    // ORDER is the whole point: closing after scene.new would throw the fresh
    // scene away instead of the stale one.
    assert.ok(
      methods.indexOf("scene.close") < methods.indexOf("scene.new"),
      `${name}: scene.close must precede scene.new, got ${methods.join(" → ")}`,
    );
  }
});

test("overwrite:true does NOT close anything when the target is not open", async () => {
  const { root } = workspace();
  const { handlers, calls } = setup(root, { "scene.list_open": { scenes: ["res://other.tscn"], current: "res://other.tscn" } });
  const r = await handlers.board_create({ path: "res://taken.tscn", layout: { mode: "grid", rows: 1, cols: 1 }, overwrite: true, confirm: true });
  assert.notEqual(r.isError, true, textOf(r));
  // scene.new reopens it from disk anyway; closing an unrelated scene would be
  // a side effect on someone else's tab.
  assert.ok(!calls.map((c) => c.method).includes("scene.close"), "closed a scene it had no business closing");
});

test("overwrite:true REFUSES rather than appends when the editor cannot close (Godot < 4.4)", async () => {
  const { root } = workspace();
  const handlersOnly = setup(root, { "scene.list_open": { scenes: ["res://taken.tscn"], current: "res://taken.tscn" } });
  // Re-register with a bridge that fails scene.close the way the addon does on
  // 4.3 — EditorInterface.close_scene is 4.4+.
  const calls: BridgeCall[] = [];
  const handlers: Record<string, Handler> = {};
  registerTabletopTools(
    {
      registerTool(name: string, _c: unknown, h: Handler) { handlers[name] = h; },
      server: { elicitInput: async () => ({ action: "accept", content: { proceed: true } }) },
    } as never,
    {
      async request(method: string, params: Record<string, unknown> = {}) {
        calls.push({ method, params });
        if (method === "scene.list_open") return { scenes: ["res://taken.tscn"], current: "res://taken.tscn" };
        if (method === "scene.close") throw Object.assign(new Error("scene_close requires Godot 4.4+"), { code: "unsupported" });
        return {};
      },
    } as never,
    { projectPath: root } as Config,
  );
  void handlersOnly;
  const r = await handlers.board_create({ path: "res://taken.tscn", layout: { mode: "grid", rows: 1, cols: 1 }, overwrite: true, confirm: true });
  assert.equal(r.isError, true, "an unclosable stale tab must refuse, not append");
  assert.match(textOf(r), /overwrite_unsupported/);
  assert.match(textOf(r), /4\.4/);
  // The refusal must land BEFORE the scene is rewritten.
  assert.ok(!calls.map((c) => c.method).includes("scene.new"), "wrote the scene despite refusing");
});

test("a free path still creates normally — the guard is not a blanket refusal", async () => {
  const { root } = workspace();
  for (const [name, args] of CREATORS) {
    const { handlers, calls } = setup(root);
    const r = await handlers[name](args("res://brand_new.tscn"));
    assert.notEqual(r.isError, true, `${name}: ${textOf(r)}`);
    assert.ok(calls.some((c) => c.method === "scene.new"), `${name} never created the scene`);
  }
});

// ------------------------------------------------- the interact_* scripts ----

test("interact_make_draggable / interact_add_drop_zone refuse an escaping script_path", async () => {
  const { root, evil } = workspace();
  const escape = `res://../${path.basename(evil)}/esc.gd`;
  for (const [name, args] of [
    ["interact_make_draggable", { node: "N", script_path: escape, mode: "node2d", confirm: true }],
    ["interact_add_drop_zone", { node: "N", script_path: escape, mode: "node2d", confirm: true }],
  ] as const) {
    const { handlers, calls } = setup(root);
    const r = await handlers[name](args as Record<string, unknown>);
    assert.equal(r.isError, true, name);
    assert.match(textOf(r), /path_outside_project/, name);
    assert.equal(calls.length, 0, `${name} reached the bridge`);
  }
});

test("board_tile_create refuses an escaping `tileset`, which is READ not written", async () => {
  const { root, evil } = workspace();
  const { handlers, calls } = setup(root);
  const r = await handlers.board_tile_create({
    path: "res://fresh.tscn", rows: 1, cols: 1,
    tileset: `res://../${path.basename(evil)}/t.tres`, confirm: true,
  });
  assert.equal(r.isError, true);
  assert.match(textOf(r), /tileset/);
  assert.equal(calls.length, 0);
});

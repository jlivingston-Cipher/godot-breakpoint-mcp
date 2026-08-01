import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { registerDapTools } from "../src/tools/dap.js";

/**
 * Session 163 — `dbg_launch` / `dbg_restart`'s `scene`, the path parameter that is
 * not called `path`.
 *
 * 🔴 EVERY CLAIM IN THIS FILE WAS MEASURED AGAINST A REAL 4.7 ADAPTER FIRST, by
 * launching the scene and reading the game's console back over the DAP `output`
 * event. 162 §8 item 5 measured this ONCE with no adapter listening and recorded the
 * answer as NOT evidence; these tests exist because that measurement was then done
 * properly, and it did not say what the item guessed it would:
 *
 *   · NOTHING ESCAPES. An out-of-project scene never ran, whichever way it was spelled.
 *   · What was broken is the ANSWER. All four escapes, plus `""`, answered
 *     `ok {"state":"running"}`; the escapes left a live sceneless game and a session
 *     that stayed `running`, and `dbg_stack_trace` then returned `{"frames":[]}` —
 *     byte-identical to a healthy session.
 *   · `uid://<known>` RAN ITS SCENE, so uid:// must stay legal. The obvious "must
 *     exist on disk" rule would have refused a working spelling.
 *
 * The file is split the same way `plane_path_guards.test.ts` is: what the guard
 * REFUSES, what it must NOT refuse, and — the half that actually catches regressions
 * — that both call sites are wired to it.
 */

type Handler = (args: Record<string, unknown>, extra: unknown) => Promise<{ isError?: boolean; content?: Array<{ text?: string }> }>;
const textOf = (r: { content?: Array<{ text?: string }> }) => r.content?.[0]?.text ?? "";

/** A root with a real prefix-sharing sibling, a subdir scene, and a non-scene file. */
function workspace(): { root: string; cleanup: () => void } {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gcb-scene-")));
  const root = path.join(base, "proj");
  fs.mkdirSync(path.join(root, "demo"), { recursive: true });
  fs.mkdirSync(`${root}_evil`);
  fs.mkdirSync(path.join(base, "elsewhere"));
  fs.mkdirSync(path.join(root, "adir"));
  fs.writeFileSync(path.join(root, "main.tscn"), "[gd_scene format=3]\n");
  fs.writeFileSync(path.join(root, "demo", "demo.tscn"), "[gd_scene format=3]\n");
  fs.writeFileSync(path.join(`${root}_evil`, "outside.tscn"), "[gd_scene format=3]\n");
  fs.writeFileSync(path.join(base, "elsewhere", "outside.tscn"), "[gd_scene format=3]\n");
  return { root, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}

/** Registers the real dap tool family against a recording stub. */
function planeFor(root: string, runtimePort = 0) {
  const wire: string[] = [];
  const dap = {
    state: "running",
    hasSession: true,
    threadId: () => 1,
    capabilities: {},
    droppedBreakpointModifiers: () => [],
    start: async (mode: string, args: Record<string, unknown>) => {
      wire.push(`start ${mode} ${JSON.stringify(args.scene)}`);
      return { entryStopSeen: false };
    },
    restart: async (override: Record<string, unknown>) => {
      wire.push(`restart ${JSON.stringify(override.scene ?? null)}`);
      return { method: "restart", state: "running", reason: null, scene: (override.scene as string) ?? null };
    },
  };
  const handlers = new Map<string, Handler>();
  registerDapTools(
    { registerTool: (n: string, _c: unknown, h: Handler) => handlers.set(n, h),
      registerResource: () => {},
      server: { elicitInput: async () => ({ action: "accept", content: {} }) } } as never,
    dap as never,
    { projectPath: root, projectUri: `file://${root}`, runtimeHost: "127.0.0.1", runtimePort } as never,
  );
  return { handlers, wire };
}

/** The four escape spellings 162 §5 pinned, plus the two nothing-there cases. */
const REFUSED: Array<[string, (root: string) => string, RegExp]> = [
  ["res:// with ..", (r) => "res://../proj_evil/outside.tscn", /outside the Godot project root/],
  ["bare relative ..", (r) => "../proj_evil/outside.tscn", /outside the Godot project root/],
  ["absolute prefix-sharing sibling", (r) => `${r}_evil/outside.tscn`, /outside the Godot project root/],
  ["absolute elsewhere", (r) => path.join(path.dirname(r), "elsewhere", "outside.tscn"), /outside the Godot project root/],
  ["missing inside the root", () => "res://NoSuchScene.tscn", /no such file/],
  ["a directory", () => "res://adir", /is not a file/],
  ["the empty scene", () => "", /project root/],
];

test("dbg_launch refuses every scene that cannot run, and none reaches the adapter", async () => {
  const { root, cleanup } = workspace();
  try {
    for (const [label, spell, reason] of REFUSED) {
      const { handlers, wire } = planeFor(root);
      const r = await handlers.get("dbg_launch")!({ scene: spell(root) }, {});
      assert.equal(r.isError, true, `${label} must be refused`);
      // BY REASON. The first four targets are REAL FILES, so only the escape guard can
      // be what refused them; a test that merely checks isError cannot tell the two
      // guards apart, which is how `dbg_goto` read as guarded for five sessions.
      assert.match(textOf(r), reason, `${label}: refused for the right reason`);
      // The host's own answer, not a backend failure the caller would go debug.
      assert.doesNotMatch(textOf(r), /^DAP error/, `${label}: a refusal is not an adapter error`);
      assert.deepEqual(wire, [], `${label}: must never reach the adapter`);
    }
  } finally { cleanup(); }
});

test("dbg_launch still passes every spelling that MEASURABLY ran, unchanged", async () => {
  const { root, cleanup } = workspace();
  try {
    // 🔴 Each of these was launched against a real 4.7 adapter and the game printed
    // from the scene that was asked for. The last three are the load-bearing rows:
    // they name a scene that is NOT the main scene, so they prove the spelling is
    // honoured rather than silently falling back to main.
    const legal = [
      undefined,
      "main",
      "current",
      "uid://bq3k7x2yv8n1a",
      "res://demo/demo.tscn",
      path.join(root, "demo", "demo.tscn"),
    ];
    for (const scene of legal) {
      const { handlers, wire } = planeFor(root);
      const r = await handlers.get("dbg_launch")!(scene === undefined ? {} : { scene }, {});
      assert.notEqual(r.isError, true, `${String(scene)} must stay legal`);
      // 🔴 The ORIGINAL SPELLING must reach the adapter, not a resolved path: what
      // works today works because Godot resolved it, and rewriting it would change
      // behaviour the measurement never covered. `undefined` still defaults to "main".
      assert.deepEqual(wire, [`start launch ${JSON.stringify(scene ?? "main")}`], `${String(scene)} unchanged on the wire`);
    }
  } finally { cleanup(); }
});

test("dbg_restart is wired to the same guard — the second call site", async () => {
  const { root, cleanup } = workspace();
  try {
    // 162 §8 item 5 named dbg_launch alone. Guarding only the first call site leaves a
    // plane guarded in name only — §7's standing rule, and 161 §4's `clearStaleTab`.
    for (const [label, spell, reason] of REFUSED) {
      const { handlers, wire } = planeFor(root);
      const r = await handlers.get("dbg_restart")!({ scene: spell(root) }, {});
      assert.equal(r.isError, true, `dbg_restart: ${label} must be refused`);
      assert.match(textOf(r), reason, `dbg_restart: ${label} refused for the right reason`);
      assert.deepEqual(wire, [], `dbg_restart: ${label} must never reach the adapter`);
    }
    // …and a legal override still restarts, so the second guard is not over-eager.
    const { handlers, wire } = planeFor(root);
    const okr = await handlers.get("dbg_restart")!({ scene: "res://demo/demo.tscn" }, {});
    assert.notEqual(okr.isError, true);
    assert.deepEqual(wire, ['restart "res://demo/demo.tscn"']);
  } finally { cleanup(); }
});

test("the scene guard refuses BEFORE the runtime-bridge port check", async () => {
  const { root, cleanup } = workspace();
  const held = net.createServer();
  try {
    await new Promise<void>((r) => held.listen(0, "127.0.0.1", r));
    const port = (held.address() as net.AddressInfo).port;
    const { handlers, wire } = planeFor(root, port);

    // 🔴 The ordering is deliberate and this pins it. A guard that refuses before it
    // touches any transport is measurable with no backend at all (162 §2) — that is
    // the whole reason these tests need no editor. It also means a caller with BOTH a
    // bad scene and a bound port is told about the scene, which is the one they can
    // act on. Measured while writing this: with the port bound and the guard AFTER the
    // check, every escape row came back as a port-conflict message instead.
    const r = await handlers.get("dbg_launch")!({ scene: "res://../proj_evil/outside.tscn" }, {});
    assert.equal(r.isError, true);
    assert.match(textOf(r), /outside the Godot project root/, "the scene, not the port, is what is named");
    assert.doesNotMatch(textOf(r), /already bound/);
    assert.deepEqual(wire, []);

    // The port check itself is untouched: a LEGAL scene still hits it.
    const p = await handlers.get("dbg_launch")!({ scene: "main" }, {});
    assert.equal(p.isError, true);
    assert.match(textOf(p), /already bound/, "a legal scene still reaches the port gate");
  } finally {
    held.close();
    cleanup();
  }
});

// Tree-shape integration probe — drives the last two structural runtime tools against a
// REAL running game over the in-game runtime autoload:
//
//   runtime_get_tree      (_serialize: the depth bound, the three-way `visible` branch, _path_of)
//   runtime_emit_signal   (the no_signal guard, Codec.decode'd args, and the arity verdict)
//
// WHY THIS EXISTS
// ---------------
// Handoff 153 §2 left three runtime tools with no live coverage. These are the two that
// have GDScript reachable only against a running game; the third (runtime_await_condition)
// has zero, being host-side polling over runtime.get_property, which IS covered.
//
// The host unit tests prove both tools FORWARD their request and stop there. _serialize's
// recursion, its `depth < max_depth` bound and its CanvasItem/Node3D/neither branch had
// never executed in CI; neither had emit_signal's has_signal guard or its callv over
// decoded args.
//
// THE FIXTURE QUESTION, ASKED FIRST — AND NO FOR THE FIFTH SESSION RUNNING
// -----------------------------------------------------------------------
// 153 §2 guessed verify_probe.tscn "may already be deep enough". It is not: it has more
// SIBLINGS, not more depth. Every fixture in the repo is at most one level deep, and
// nothing shallower than depth 3 can show the bound truncating in the MIDDLE of a tree —
// which is the only place it is observable as a bound rather than as an absent root. No
// fixture contained a Node3D or a bare Node either, so two of the three `visible` arms had
// nowhere to run. res://tests/tree_probe.tscn is depth 4 and mixes all three node classes;
// tree_probe.gd is INERT with respect to shape (see §0).
//
// WHAT MAKES IT COVERAGE RATHER THAN GREEN
// ----------------------------------------
// Six claims here are unsatisfiable by an implementation that returns a plausible tree or
// a bare {"emitted": true}, and each was established against a live engine BEFORE being
// written down:
//
//   1. At max_depth 2, Limb reports child_count 1 with NO `children` key, while Bare
//      reports child_count 0 with no `children` key. Truncation and leafness are
//      distinguishable ONLY by child_count, and both are asserted in the same response.
//   2. `visible` is ABSENT on a plain Node, PRESENT on a Node3D, PRESENT on a CanvasItem.
//      Absence is an assertion here, not an omission.
//   3. Hidden reports visible:false, so the value is read rather than hardcoded.
//   4. An emit whose `args` count does not match the signal's arity is an ERROR. Godot
//      returns it from emit_signal and the tool used to discard it (fixed in this PR);
//      `two_seen` proves no handler ran.
//   5. A Vector2 arg arrives INSIDE the engine as TYPE_VECTOR2, checked via typeof() —
//      because runtime_get_property re-encodes it to the same JSON either way, the wire
//      cannot see the difference and typeof is the only instrument that can.
//   6. probe_none() emitted with zero args SUCCEEDS. The arity guard rejects a mismatch,
//      not every argument-less emission.
//
// NOT ASSERTED, DELIBERATELY: that a wrong-TYPE argument fails. Measured — Godot does not
// type-check signal arguments; typed_sig(n: int) accepted a String and the handler ran.
// The guard is arity only, and an assertion claiming otherwise would be false.

import assert from "node:assert/strict";
import { BridgeClient } from "../dist/bridge.js";
import { loadConfig } from "../dist/config.js";
import { registerRuntimeTools } from "../dist/tools/runtime.js";

const cfg = loadConfig();
console.log(`tree-shape probe -> runtime bridge ${cfg.runtimeHost}:${cfg.runtimePort}  project=${cfg.projectPath}`);

// Mirrors example/tests/tree_probe.tscn. If the fixture and this table drift apart, the
// assertions name the node that moved instead of failing as a surprise three sections on.
const TREE = [
  { path: ".", name: "TreeProbe", type: "Node2D", children: 3, visible: true },
  { path: "Branch", name: "Branch", type: "Node", children: 1, visible: undefined },
  { path: "Branch/Limb", name: "Limb", type: "Node3D", children: 1, visible: true },
  { path: "Branch/Limb/Twig", name: "Twig", type: "Node2D", children: 1, visible: true },
  { path: "Branch/Limb/Twig/Leaf", name: "Leaf", type: "Label", children: 0, visible: true },
  { path: "Hidden", name: "Hidden", type: "Node2D", children: 0, visible: false },
  { path: "Bare", name: "Bare", type: "Node", children: 0, visible: undefined },
];

const TYPE_VECTOR2 = 5; // Godot's Variant.Type — TYPE_DICTIONARY is 27
const VEC = { __type__: "Vector2", x: 3, y: 4 };

const runtime = new BridgeClient(cfg.runtimeHost, cfg.runtimePort, 15000, "runtime bridge", "Is the tree probe scene running?");
const tools = new Map();
const server = {
  registerTool: (name, _c, handler) => tools.set(name, handler),
  registerResource: () => {},
  server: { elicitInput: async () => ({ action: "decline" }) },
};
// Single-game by construction: no call below passes `peer`, so a registry that refuses to
// be reached turns a later edit that forgets that into a sentence naming the cause.
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
const errText = (res) => res.content?.[0]?.text ?? "(no text)";

/** runtime_get_property on the fixture root — a COVERED instrument (#152, #155). */
const read = async (property) => (await call("runtime_get_property", { path: ".", property })).value;

/** Walk a serialized tree to the node at `path` ("." is the root). Returns undefined if absent. */
function at(tree, path) {
  if (path === ".") return tree;
  let node = tree;
  for (const seg of path.split("/")) {
    const kids = node?.children;
    if (!Array.isArray(kids)) return undefined;
    node = kids.find((k) => k.name === seg);
    if (node === undefined) return undefined;
  }
  return node;
}

/** Emit through the registered tool. */
const emit = (signal, args) => raw("runtime_emit_signal", { path: ".", signal, args, confirm: true });

/** Fail the job with a GitHub-annotated message. */
function die(message) {
  console.error(`::error::${message}`);
  try {
    runtime.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
}

// ------------------------------------------------------------------- gate ---

try {
  await runtime.ensureConnected();
  const pong = await runtime.request("ping", {}, 20000);
  console.log(`TREE_LIVE_PING ok runtime=${pong?.runtime} godot=${pong?.godot ?? "?"}`);
} catch (err) {
  die(`could not reach the runtime bridge: ${err?.message ?? String(err)}`);
}

try {
  // ================================== 0. the fixture is the fixture, at depth ===
  // Asserted BEFORE anything is emitted, which is what holds tree_probe.gd's claim of
  // being inert with respect to shape to account: a _ready() that added, removed or
  // reparented a node fails HERE, by name, rather than corrupting a later reading.
  const boot = await raw("runtime_assert_scene_structure", {
    expect: TREE.map((n) => ({ path: n.path === "." ? "." : n.path, type: n.type })),
  });
  if (boot.isError || boot.structuredContent?.ok !== true) {
    die(
      `not the tree-shape fixture (${boot.isError ? errText(boot) : JSON.stringify(boot.structuredContent?.failures)}) — ` +
        `boot with 'res://tests/tree_probe.tscn'; every assertion below assumes that scene`,
    );
  }

  // ============================================ 1. full depth, every field ===
  const full = await call("runtime_get_tree", {});
  for (const want of TREE) {
    const got = at(full, want.path);
    assert.ok(got, `the default depth must reach ${want.path} — the fixture is 4 levels deep and the default bound is 64`);
    assert.equal(got.name, want.name, `${want.path}: name`);
    assert.equal(got.type, want.type, `${want.path}: type must be the ENGINE class, not the script's`);
    assert.equal(got.path, want.path, `${want.path}: path must be relative to the base ('.' for the root)`);
    assert.equal(got.child_count, want.children, `${want.path}: child_count`);
  }
  console.log(`TREE_LIVE_DEPTH ok all ${TREE.length} nodes reached at the default bound, Leaf at depth 4`);

  // ====================================== 2. `visible`, all THREE branches ===
  // The ABSENT case is the one no fixture could reach before this one existed. Asserting
  // `undefined` rather than skipping is the whole point: an implementation that added
  // `visible` to every node would otherwise pass unnoticed.
  for (const want of TREE) {
    const got = at(full, want.path);
    if (want.visible === undefined) {
      assert.ok(
        !("visible" in got),
        `${want.path} is a plain ${want.type} — _serialize must NOT report 'visible' for it, but got ${JSON.stringify(got.visible)}`,
      );
    } else {
      assert.equal(
        got.visible,
        want.visible,
        `${want.path} is a ${want.type} — 'visible' must be present and must be the node's OWN value`,
      );
    }
  }
  console.log("TREE_LIVE_VISIBLE ok absent on Node, present on Node3D and CanvasItem, false on Hidden");

  // ============ 3. THE DEPTH BOUND — truncation distinguished from leafness ===
  const d2 = await call("runtime_get_tree", { max_depth: 2 });

  const limb = at(d2, "Branch/Limb");
  assert.ok(limb, "max_depth 2 must still REACH Branch/Limb — it sits exactly at the bound");
  assert.equal(limb.child_count, 1, "a truncated node must still report its real child_count — that is the only truncation tell");
  assert.ok(
    !("children" in limb),
    `Branch/Limb sits AT the bound (depth 2), so it must carry no 'children' key — got ${JSON.stringify(limb.children)}`,
  );
  assert.equal(at(d2, "Branch/Limb/Twig"), undefined, "max_depth 2 must NOT serialize below the bound");

  const bare = at(d2, "Bare");
  assert.equal(bare.child_count, 0, "Bare is a leaf");
  assert.ok(!("children" in bare), "a leaf carries no 'children' key either");

  // The claim, stated as the comparison it actually is.
  assert.notEqual(
    limb.child_count,
    bare.child_count,
    "TRUNCATED and LEAF are both 'no children key' — child_count is the ONLY field that separates them, so it must differ",
  );

  // And the bound is a BOUND, not a constant: one level shallower stops one level sooner.
  const d1 = await call("runtime_get_tree", { max_depth: 1 });
  assert.ok(at(d1, "Branch"), "max_depth 1 reaches Branch");
  assert.equal(at(d1, "Branch/Limb"), undefined, "max_depth 1 must stop ABOVE Branch/Limb — the bound must track the argument");
  assert.equal(at(d1, "Branch").child_count, 1, "Branch is truncated at max_depth 1 and must still report child_count 1");
  console.log("TREE_LIVE_BOUND ok max_depth 2 truncates at Limb (child_count 1, no children); max_depth 1 truncates at Branch");

  // ============================== 4. emit_signal — the guards, both operands ===
  const unknown = await emit("no_such_signal", []);
  assert.ok(unknown.isError, "emitting a signal the node does not declare must be an error");
  assert.match(errText(unknown), /no_signal/, "…and it must be no_signal");

  const blank = await emit("", []);
  assert.ok(blank.isError, "an omitted signal name arrives as '' and must be rejected by the same guard");
  assert.match(errText(blank), /no_signal/, "…as no_signal");

  const badPath = await raw("runtime_emit_signal", { path: "NoSuchNode", signal: "probe_two", args: [], confirm: true });
  assert.ok(badPath.isError, "emitting from a node that does not exist must be an error");
  assert.match(errText(badPath), /bad_path/, "…and it must be bad_path");
  console.log("TREE_LIVE_GUARDS ok no_signal covers both a typo and an omitted name; bad_path covers a missing node");

  // ================== 5. THE ARITY VERDICT — success is not a foregone reply ===
  // probe_two takes exactly 2. Every mismatch must be an error AND must leave two_seen
  // untouched, because the two claims are independent: reporting an error while the
  // handler ran, or reporting success while it did not, are both defects.
  const before = await read("two_seen");
  for (const [label, args] of [
    ["zero", []],
    ["one", [VEC]],
    ["three", [VEC, 7, 99]],
  ]) {
    const res = await emit("probe_two", args);
    assert.ok(
      res.isError,
      `emitting probe_two (arity 2) with ${label} argument(s) must be an ERROR — the engine refuses it and no handler runs, ` +
        `so answering {"emitted": true} strands the caller at its next assertion`,
    );
    assert.match(errText(res), /emit_failed/, `${label}: the arity failure must surface as emit_failed`);
    assert.equal(await read("two_seen"), before, `${label}: no handler may have run — two_seen must not move`);
  }
  console.log("TREE_LIVE_ARITY ok 0, 1 and 3 args on an arity-2 signal all rejected, handler never ran");

  // ================================== 6. the correct arity, and the DECODE ===
  const ok2 = await emit("probe_two", [VEC, 7]);
  assert.ok(!ok2.isError, `the DECLARED arity must succeed: ${errText(ok2)}`);
  assert.equal(ok2.structuredContent?.emitted, true, "a successful emit reports emitted:true");
  assert.equal(await read("two_seen"), before + 1, "the handler must have run exactly once");
  assert.equal(await read("two_b"), 7, "the second argument must arrive unchanged");

  // The decode claim. Reading two_a back gives {"__type__":"Vector2",...} whether decode
  // built a Vector2 or passed the dictionary through untouched — the wire is blind to it.
  // typeof(), recorded inside the engine at receipt, is the only instrument that is not.
  assert.equal(
    await read("two_a_type"),
    TYPE_VECTOR2,
    "a {__type__:'Vector2'} argument must reach the handler as a REAL Vector2 (typeof 5), not as the Dictionary it was sent as (27) — " +
      "runtime_get_property re-encodes both to identical JSON, so this type is the only place the difference is visible",
  );
  console.log("TREE_LIVE_DECODE ok arity-2 emit ran the handler once and delivered a real Vector2 (typeof 5)");

  // ============================ 7. zero args is not itself the failure mode ===
  const noneBefore = await read("none_seen");
  const ok0 = await emit("probe_none", []);
  assert.ok(!ok0.isError, `probe_none() declares zero arguments, so emitting it with none must SUCCEED: ${errText(ok0)}`);
  assert.equal(await read("none_seen"), noneBefore + 1, "…and its handler must have run");
  const none1 = await emit("probe_none", [1]);
  assert.ok(none1.isError, "…while giving probe_none() an argument it does not declare must fail");
  assert.equal(await read("none_seen"), noneBefore + 1, "…without running the handler");
  console.log("TREE_LIVE_ZEROARG ok probe_none() succeeds on 0 args and fails on 1 — the guard checks the MATCH, not the count");

  console.log("TREE_LIVE_ALL ok every claim held");
  runtime.close();
} catch (err) {
  die(err?.message ?? String(err));
}

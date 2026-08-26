// Node-lifecycle integration probe — drives the two runtime node-mutation tools against
// a REAL running game over the in-game runtime autoload:
//
//   runtime_node_add · runtime_node_remove
//
// WHY THIS EXISTS
// ---------------
// The §6.5 audit in handoff 151 walked all 27 tools in host/src/tools/runtime.ts against
// host/test-integration/ and ranked what was left. This pair came out #1: ~44 lines of
// GDScript with the densest error paths in the plane, and no live coverage at all. The
// host unit tests (test/runtime.test.ts) prove exactly one thing — that the tool forwards
// `runtime.node_add` with the right params once confirmed. Not one line of _node_add or
// _node_remove runs in them.
//
// THE FIXTURE QUESTION, ASKED FIRST
// ---------------------------------
// Handoff 151 §7.3 made this the gate on scoping the session, because it is the question
// that found the last two gaps: what does the tool need to be POINTED AT? _node_add's
// `scene:` branch needs a res:// PackedScene to instantiate, and no usable one existed —
// all seven scenes in example/ are probe fixtures whose _ready() builds state for their
// own lane, so instantiating one here would mutate the very tree this probe asserts on.
// Hence res://tests/node_payload.tscn, which is inert by construction.
//
// WHAT MAKES IT COVERAGE RATHER THAN GREEN
// ----------------------------------------
// Every behaviour is asserted in BOTH directions, and the mutations are read back through
// tools that are themselves already live-covered (#152: assert_scene_structure,
// assert_node_state, get_property, call_method) rather than through the tools under test.
// Four checks are unsatisfiable by a static implementation:
//
//   * The `scene:` branch must deliver the AUTHORED SUBTREE. Host/Payload/Cargo is only
//     resolvable if a real PackedScene was instantiated; ClassDB.instantiate produces
//     exactly one node and cannot bring a child with it.
//   * The instantiated node must have ENTERED THE TREE. node_payload.gd sets ready_ran in
//     _ready(), which the engine calls only on tree entry — so an implementation that
//     instantiated and described the node without parenting it fails here and nowhere else.
//   * The three-way error split is REACHED SEPARATELY: a class that does not exist, a
//     class that exists but cannot be instantiated (Viewport is abstract), and a class
//     that instantiates to something that is not a Node (Resource). An implementation
//     checking only `class_exists` passes the first and fails the second.
//   * Removal must take the WHOLE SUBTREE, including a child added after instantiation —
//     proved by a node the probe itself parented under the payload.
//
// Markers (grep-able): NODE_LIVE_PING / _FIXTURE / _ADD_ERRORS / _TYPE / _AUTONAME /
// _SCENE / _NESTED / _REMOVE_ERRORS / _ROOT_GUARD / _SUBTREE / _NO_LEAK / _PRISTINE /
// _RESULT.
//
// Requires res://tests/node_probe.tscn running with GODOT_PROJECT set and
// BREAKPOINT_RUNTIME_PORT pointing at its bridge. Fully headless — nothing here reads a
// pixel. Not part of `npm test` (Godot-free); invoked directly by integration.yml.
import { Population } from "./_population.mjs";

// 🔴 THE CLAIM POPULATION, COUNTED (169 §10 item 2). This probe used to end with a
// bare ✔ having counted nothing — a line that reads as coverage and is true of the
// empty set. A section skipped by a conditional, or one whose assertions are deleted
// while its marker survives, left the run green and smaller with nothing to say so.
//
// The manifest is the marker names this probe ALREADY printed, so it costs no new
// maintenance surface: `population.seal()` prints each marker exactly as before and
// attributes to it every claim made since the previous one. See `_population.mjs`.
//
// 🔴 THE REACHABILITY BANNER (`NODE_LIVE_PING`) IS DELIBERATELY NOT A FAMILY. It
// asserts nothing — the gate is a throw — so sealing it would fire VACUOUS on a
// healthy run, and a gate that cries wolf on green is a gate that gets deleted.
const population = new Population("NODE_LIVE", {
  families: [
    "NODE_LIVE_FIXTURE", "NODE_LIVE_ADD_ERRORS", "NODE_LIVE_NO_LEAK", "NODE_LIVE_TYPE",
    "NODE_LIVE_AUTONAME", "NODE_LIVE_NESTED", "NODE_LIVE_REMOVE_ERRORS", "NODE_LIVE_ROOT_GUARD",
    "NODE_LIVE_SUBTREE", "NODE_LIVE_PRISTINE",
  ],
  scope: 10,
  claims: 124,        // 🔴 EXACT — 124 on local 4.7 and CI 4.3 / 4.5 / 4.7, four environments, one number
});
const assert = population.assert;
import { BridgeClient } from "../dist/bridge.js";
import { loadConfig } from "../dist/config.js";
import { registerRuntimeTools } from "../dist/tools/runtime.js";

const cfg = loadConfig();
console.log(`node-lifecycle probe -> runtime bridge ${cfg.runtimeHost}:${cfg.runtimePort}  project=${cfg.projectPath}`);

// Mirrors example/tests/node_payload.tscn. If those drift apart the assertions below name
// the field that moved rather than failing as an arithmetic surprise three sections later.
const PAYLOAD_SCENE = "res://tests/node_payload.tscn";
const PAYLOAD_ROOT = "Payload"; // the AUTHORED root name — preserved by instantiate()
const PAYLOAD_CARGO = "Cargo"; // the AUTHORED child — proof the subtree came with it
const PAYLOAD_POS = { __type__: "Vector2", x: 137, y: 91 };
const CARGO_POS = { __type__: "Vector2", x: 11, y: 13 };

// A script resource, not a PackedScene: load() SUCCEEDS and returns the wrong type, which
// is the second operand of _node_add's `ps == null or not (ps is PackedScene)` guard.
const NOT_A_SCENE = "res://tests/node_payload.gd";

// Register the runtime tools against a live runtime BridgeClient, exactly the way index.ts
// wires Plane C — so the host<->engine path is exercised end to end, not just the raw
// socket. elicitInput is never reached (every mutating call passes confirm).
const runtime = new BridgeClient(cfg.runtimeHost, cfg.runtimePort, 15000, "runtime bridge", "Is the node probe scene running?");
const tools = new Map();
const server = {
  registerTool: (name, _c, handler) => tools.set(name, handler),
  registerResource: () => {},
  server: { elicitInput: async () => ({ action: "decline" }) },
};
// Single-game by construction: no call below passes `peer`, so a registry that refuses to
// be reached turns a later edit that forgets that into a sentence naming the cause rather
// than a TypeError on `undefined`.
const noPeers = Object.fromEntries(
  ["clientFor", "spawn", "stop", "stopAll", "live", "all"].map((m) => [
    m,
    () => {
      throw new Error(`this probe is single-game: peers.${m}() must not be reached (no call here passes 'peer')`);
    },
  ]),
);
// 🔴 `cfg` IS THE FOURTH ARGUMENT AS OF 1.43.0. These probes call the registrar
// DIRECTLY, so TypeScript cannot see them: adding a parameter compiled clean and
// broke six CI jobs at runtime with "Cannot read properties of undefined". A .mjs
// call site is a call site.
registerRuntimeTools(server, runtime, noPeers, cfg);

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** runtime_assert_scene_structure over one or more entries — a COVERED instrument (#152). */
const structure = (expect) => call("runtime_assert_scene_structure", { expect });

/** Assert every path is present (optionally as a given class), via that instrument. */
async function expectPresent(entries, why) {
  const r = await structure(entries);
  assert.equal(r.ok, true, `${why} — structure failures: ${JSON.stringify(r.failures)}`);
  assert.equal(r.checked, entries.length, `${why} — expected ${entries.length} checks, got ${r.checked}`);
}

/** Assert every path is absent, via the same instrument's `absent` mode. */
async function expectAbsent(paths, why) {
  const r = await structure(paths.map((path) => ({ path, absent: true })));
  assert.equal(r.ok, true, `${why} — still present: ${JSON.stringify(r.failures)}`);
}

/** Node.get_child_count() through runtime_call_method — the pristine anchor. */
const childCount = async (path) =>
  (await call("runtime_call_method", { path, method: "get_child_count", confirm: true })).return ?? -1;

/**
 * Wait for a path to stop resolving.
 *
 * _node_remove calls queue_free(), which is DEFERRED: the node is released at the end of
 * the frame, not when the reply is written. Polling here is that deferral made explicit,
 * not a flake workaround — and note what it means for what this probe can claim. Whether
 * the call was queue_free() or free() is NOT observable over the socket, because idle
 * frames keep processing between one request and the next (the same property handoff 151
 * notes for the frozen-clock window). So the assertion is that removal HAPPENS, and the
 * mechanism behind it is left to the GDScript.
 */
async function waitAbsent(path, why) {
  for (let i = 0; i < 40; i++) {
    const r = await structure([{ path, absent: true }]);
    if (r.ok) return i;
    await sleep(50);
  }
  assert.fail(`${why} — '${path}' still resolves 2s after queue_free()`);
}

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
  console.log(`NODE_LIVE_PING ok runtime=${pong?.runtime} godot=${pong?.godot ?? "?"}`);
} catch (err) {
  die(`could not reach the runtime bridge: ${err?.message ?? String(err)}`);
}

// Everything the probe creates carries this suffix. Nothing in node_probe.tscn does, so
// the pristine check at the end can be stated as "none of these, and Host is empty".
const MADE = [];

try {
  // ============================================ 0. the fixture is the fixture ===
  // node_probe.tscn is SCRIPTLESS on purpose: every node that appears under this root
  // during the run was put there by node_add and every one that vanishes was taken by
  // node_remove. If the wrong scene is booted, say so by name here rather than letting a
  // later assertion fail for a reason that reads like a tool defect.
  const boot = await raw("runtime_assert_scene_structure", {
    expect: [
      { path: ".", type: "Node2D" },
      { path: "Host", type: "Node2D" },
    ],
  });
  if (boot.isError || boot.structuredContent?.ok !== true) {
    die(
      `not the node-lifecycle fixture (${boot.isError ? errText(boot) : JSON.stringify(boot.structuredContent?.failures)}) — ` +
        `boot with 'res://tests/node_probe.tscn'; every assertion below assumes that scene`,
    );
  }
  const hostAtBoot = await childCount("Host");
  const rootAtBoot = await childCount(".");
  assert.equal(hostAtBoot, 0, `Host must start empty so the pristine check means something, got ${hostAtBoot}`);
  assert.equal(rootAtBoot, 1, `the root must start with exactly Host beneath it, got ${rootAtBoot}`);
  population.seal("NODE_LIVE_FIXTURE", `ok root=Node2D host=Node2D children root=${rootAtBoot} host=${hostAtBoot}`);

  // ================================== 1. node_add — every rejection, separately ===
  // Five distinct `reason` values across four guards. They are checked one at a time
  // because they are NOT interchangeable: an implementation that collapsed them into a
  // single "bad request" would satisfy a test that only asserted isError.

  // (a) the parent must resolve. _resolve returns null; nothing is instantiated at all.
  const noParent = await raw("runtime_node_add", { parent: "NoSuchParent9137", type: "Node2D", confirm: true });
  assert.equal(noParent.isError, true, "adding under a parent that does not exist must be an error");
  assert.match(errText(noParent), /bad_path/, `expected bad_path, got ${errText(noParent)}`);

  // (b) neither `scene` nor `type`. Both are optional in the host schema, so this reaches
  // the engine as a genuinely empty request rather than being rejected by zod.
  const noArgs = await raw("runtime_node_add", { parent: "Host", confirm: true });
  assert.equal(noArgs.isError, true, "node_add with neither scene nor type must be an error");
  assert.match(errText(noArgs), /bad_args/, `expected bad_args, got ${errText(noArgs)}`);

  // (c) THE THREE-WAY SPLIT. This is the check that separates a real guard from one that
  // only tests its first operand, and each arm was verified against a live engine before
  // being written down here:
  //
  //   NoSuchClass9137 -> ClassDB.class_exists false        -> bad_type
  //   Viewport        -> exists, can_instantiate FALSE     -> bad_type   (abstract in 4.x;
  //                                                           SubViewport/Window are the
  //                                                           instantiable subclasses)
  //   Resource        -> exists, instantiable, NOT a Node  -> not_a_node
  //
  // `Resource` rather than `Object` for the last one deliberately: Resource is RefCounted
  // and is released when the branch returns, whereas a bare Object is not — see the
  // handoff. This probe does not leak to make its point.
  const noClass = await raw("runtime_node_add", { parent: "Host", type: "NoSuchClass9137", confirm: true });
  assert.equal(noClass.isError, true, "a class that does not exist must be an error");
  assert.match(errText(noClass), /bad_type/, `expected bad_type for a missing class, got ${errText(noClass)}`);

  const abstract = await raw("runtime_node_add", { parent: "Host", type: "Viewport", confirm: true });
  assert.equal(abstract.isError, true, "an abstract class must be an error even though it EXISTS");
  assert.match(
    errText(abstract),
    /bad_type/,
    `Viewport exists but cannot be instantiated — the guard must test can_instantiate, not just ` +
      `class_exists; got ${errText(abstract)}`,
  );

  const notNode = await raw("runtime_node_add", { parent: "Host", type: "Resource", confirm: true });
  assert.equal(notNode.isError, true, "instantiating a non-Node class must be an error");
  assert.match(
    errText(notNode),
    /not_a_node/,
    `Resource instantiates fine but is not a Node — expected not_a_node (a DIFFERENT reason from ` +
      `bad_type), got ${errText(notNode)}`,
  );

  // (d) the `scene:` guard has TWO operands and they fail differently. A missing path
  // makes load() return null; a path that loads to the wrong resource type does not.
  // An implementation that only checked `ps == null` passes the first and fails the second.
  const noScene = await raw("runtime_node_add", { parent: "Host", scene: "res://tests/no_such_scene_9137.tscn", confirm: true });
  assert.equal(noScene.isError, true, "a res:// path that does not exist must be an error");
  assert.match(errText(noScene), /bad_scene/, `expected bad_scene for a missing path, got ${errText(noScene)}`);

  const wrongRes = await raw("runtime_node_add", { parent: "Host", scene: NOT_A_SCENE, confirm: true });
  assert.equal(wrongRes.isError, true, "a resource that loads but is not a PackedScene must be an error");
  assert.match(
    errText(wrongRes),
    /bad_scene/,
    `${NOT_A_SCENE} LOADS (it is a GDScript) — the guard must test the type too, not just null; ` +
      `got ${errText(wrongRes)}`,
  );

  // Nothing above may have left anything behind. Five rejected adds that each silently
  // parented something would be invisible to every assertion so far.
  assert.equal(await childCount("Host"), 0, "a rejected node_add must not add anything");
  population.seal("NODE_LIVE_ADD_ERRORS", "ok bad_path / bad_args / bad_type x2 / not_a_node / bad_scene x2, nothing added");

  // ======================== 1b. the `not_a_node` branch must not LEAK ===
  // 🔴 Added session 153, with the fix it guards.
  //
  // ClassDB.instantiate hands back an UNOWNED instance. The branch above used to return
  // its error without freeing it, which is invisible for a RefCounted subclass (Resource
  // releases itself) and leaks exactly one instance per call for anything else — reported
  // by the engine only at exit, as "N ObjectDB instances were leaked", in a log for a
  // backgrounded game nobody reaps. That is why it survived to be found by hand.
  //
  // `object/count` is the total ObjectDB population and the only monitor that can see a
  // leaked non-Node (node_count and resource_count both miss it by construction); it was
  // added to the allow-list in the same commit for this check. Measured headless: idle
  // drift over seconds is ZERO, the unfixed branch grows the count by exactly one per
  // call, and the fixed branch by none. The threshold is therefore generous rather than
  // tight — 60 calls must not add 60 objects, and anything under 10 is comfortably noise.
  const objectCount = async () =>
    (await call("runtime_get_monitors", { keys: ["object/count"] })).monitors["object/count"];
  const LEAK_CALLS = 60;
  const countBefore = await objectCount();
  assert.equal(typeof countBefore, "number", `object/count must be served by the monitor allow-list, got ${countBefore}`);
  for (let i = 0; i < LEAK_CALLS; i++) {
    // `Object` specifically: it is the class that is NOT RefCounted, so it is the one the
    // engine will not clean up. (Resource, used above for the reason assertion, cannot
    // demonstrate this — which is exactly why the bug hid.)
    const r = await raw("runtime_node_add", { parent: "Host", type: "Object", confirm: true });
    assert.equal(r.isError, true, `instantiating Object must still be not_a_node on call ${i}`);
  }
  await sleep(250);
  const grew = (await objectCount()) - countBefore;
  assert.ok(
    grew < 10,
    `the not_a_node branch LEAKS: ${LEAK_CALLS} rejected adds grew object/count by ${grew}. ` +
      `ClassDB.instantiate returns an unowned instance and a bare Object is not RefCounted, so the ` +
      `branch must free() it before returning the error.`,
  );
  assert.equal(await childCount("Host"), 0, "and none of those rejected adds may have parented anything");
  population.seal("NODE_LIVE_NO_LEAK", `ok ${LEAK_CALLS} not_a_node rejections grew object/count by ${grew}`);

  // ======================================= 2. the `type:` branch, proved by class ===
  // Timer rather than Node2D on purpose: it is not in the fixture's own class hierarchy,
  // so "the reply says Timer" can be cross-examined against a tree that agrees, and
  // against a method only a real Timer has.
  const TIMER = "AddedTimer9137";
  const added = await call("runtime_node_add", { parent: "Host", type: "Timer", name: TIMER, confirm: true });
  MADE.push(`Host/${TIMER}`);
  // 🔴 `added` IS A HARD-WIRED `true` on `_node_add`'s only `_ok` path, and `call()`
  // throws on isError, so every `_err` path escapes before this line: the claim's two
  // outcomes were "true" and "never reached". The two lines below are the real evidence
  // and always were — `path` is COMPUTED by `_path_of` from the node the addon actually
  // parented, and `type` is `child.get_class()` off the instance it built. This line is
  // now a SHAPE pin over a documented constant, which is the drift it is exposed to.
  assert.equal(typeof added.added, "boolean", "the reply must carry an `added` flag");
  assert.equal(added.path, `Host/${TIMER}`, `the reply must give the SCENE-RELATIVE path of the new node, got ${added.path}`);
  assert.equal(added.type, "Timer", `the reply must name the instantiated class, got ${added.type}`);

  // The tree agrees, through a different tool — and `type` is checked with is_class(), so
  // a Node merely NAMED AddedTimer9137 fails here.
  await expectPresent([{ path: `Host/${TIMER}`, type: "Timer" }], "the added node must be in the live tree as a Timer");

  // And it is a real Timer rather than a node wearing the name: get_time_left() exists
  // only on Timer, so a generic Node would come back no_method.
  const timeLeft = await call("runtime_call_method", { path: `Host/${TIMER}`, method: "get_time_left", confirm: true });
  assert.equal(typeof timeLeft.return, "number", `a real Timer answers get_time_left(), got ${JSON.stringify(timeLeft)}`);
  assert.equal(await childCount("Host"), 1, "exactly one node should have been added");
  population.seal("NODE_LIVE_TYPE", `ok ${added.path} is a live Timer (get_time_left=${timeLeft.return})`);

  // ========================== 3. no `name` — the engine names it, and the path works ===
  // 🔴 283 — THIS BLOCK USED TO ASSERT THE DEFECT, AND IT WAS RIGHT TO, AT THE TIME. It
  // read: *a node added with no name does NOT get the bare class name; Godot assigns an
  // auto-unique name of the form @Class@N* — verified against a live engine, and true for
  // as long as this plane called `add_child` at Godot's default of
  // `force_readable_name: false`. That default is what 283 measured as a user-facing
  // defect: a caller that asked for a name twice got `@Type@N` the second time with no
  // error and no flag, and could not address the node it had just made. The plane now
  // passes `true`, the way the editor's own Add Node does, so the engine's answer is the
  // readable name — and the assertion moves WITH the behaviour rather than outliving it.
  //
  // 🔵 AND THE SECOND CALL IS THE ONE THAT MATTERS, which is 283's whole finding: nothing
  // in this tree called an authoring tool TWICE and compared, which is exactly where the
  // defect lived. Both calls are asserted here, and the collision report with them.
  const autoNamed = await call("runtime_node_add", { parent: "Host", type: "Marker2D", confirm: true });
  MADE.push(autoNamed.path);
  assert.equal(
    autoNamed.path,
    "Host/Marker2D",
    `an unnamed add takes the readable class name the editor's own Add Node gives it, so the ` +
      `reply path must be scene-relative and class-named, got ${autoNamed.path}`,
  );
  assert.equal(autoNamed.type, "Marker2D", `the reply must still name the class, got ${autoNamed.type}`);
  assert.equal(autoNamed.coerced, undefined, "nothing collided, so no coercion is reported");
  await expectPresent(
    [{ path: autoNamed.path, type: "Marker2D" }],
    "the returned path must resolve — it is the only handle the caller gets for an unnamed add",
  );

  // The SECOND unnamed one collides and gets a NUMBER, not the machine form — and it is
  // still not `coerced`, because a caller that named nothing had nothing taken from it.
  const collided = await call("runtime_node_add", { parent: "Host", type: "Marker2D", confirm: true });
  MADE.push(collided.path);
  assert.equal(
    collided.path,
    "Host/Marker2D2",
    `a colliding add gets a NUMBER appended, not the machine form — got ${collided.path}`,
  );
  assert.equal(collided.coerced, undefined, "no name was asked for, so nothing was coerced");

  // 🔵 AND HERE IS THE CASE THE REPORT EXISTS FOR: a caller that DID name its node, twice.
  const named = await call("runtime_node_add", { parent: "Host", type: "Marker2D", name: "Spawn", confirm: true });
  MADE.push(named.path);
  assert.equal(named.path, "Host/Spawn", `an available name is kept, got ${named.path}`);
  assert.equal(named.coerced, undefined, "the name was available, so nothing was coerced");
  const namedAgain = await call("runtime_node_add", { parent: "Host", type: "Marker2D", name: "Spawn", confirm: true });
  MADE.push(namedAgain.path);
  assert.equal(namedAgain.path, "Host/Spawn2", `a taken name gets a number, got ${namedAgain.path}`);
  assert.equal(namedAgain.coerced, true, "a name the engine changed must be reported as coerced");
  assert.equal(namedAgain.requested, "Spawn", `and the name that was asked for must ride with it, got ${namedAgain.requested}`);
  await expectPresent(
    [{ path: namedAgain.path, type: "Marker2D" }],
    "the coerced path must resolve — a reported rename is worthless if the path it names does not work",
  );
  population.seal(
    "NODE_LIVE_AUTONAME",
    `ok ${autoNamed.path} then ${collided.path} unnamed (no coercion claimed), ` +
      `and ${named.path} then ${namedAgain.path} coerced from ${namedAgain.requested}`,
  );

  // ================= 4. the `scene:` branch — authored name, values and SUBTREE ===
  // The branch that a mocked test cannot touch and that a type: add cannot fake.
  const inst = await call("runtime_node_add", { parent: "Host", scene: PAYLOAD_SCENE, confirm: true });
  MADE.push(`Host/${PAYLOAD_ROOT}`);
  assert.equal(typeof inst.added, "boolean", "the reply must carry an `added` flag");   // SHAPE, not VALUE — see §2
  assert.equal(
    inst.path,
    `Host/${PAYLOAD_ROOT}`,
    `no 'name' was given, so the AUTHORED root name must survive instantiate() — contrast the ` +
      `class-named node above, which is what an engine-created node gets; got ${inst.path}`,
  );
  assert.equal(inst.type, "Node2D", `the reply reports the payload root's class, got ${inst.type}`);

  // (i) the SUBTREE. Host/Payload/Cargo is only resolvable if a real PackedScene was
  // instantiated — ClassDB.instantiate produces exactly one node and cannot bring a child.
  await expectPresent(
    [
      { path: `Host/${PAYLOAD_ROOT}`, type: "Node2D" },
      { path: `Host/${PAYLOAD_ROOT}/${PAYLOAD_CARGO}`, type: "Node2D" },
    ],
    "the payload's AUTHORED CHILD must come with it — this is the `scene:` branch's whole distinction",
  );

  // (ii) the AUTHORED VALUES. A PackedScene carries serialised state, not just classes.
  // Both nodes are checked, because a root-only match could be a coincidence of defaults.
  const rootState = await call("runtime_assert_node_state", {
    path: `Host/${PAYLOAD_ROOT}`,
    expect: { position: PAYLOAD_POS },
  });
  assert.equal(
    rootState.ok,
    true,
    `the payload root's AUTHORED position must survive instantiation: ${JSON.stringify(rootState.mismatches)}`,
  );
  const cargoState = await call("runtime_assert_node_state", {
    path: `Host/${PAYLOAD_ROOT}/${PAYLOAD_CARGO}`,
    expect: { position: CARGO_POS },
  });
  assert.equal(
    cargoState.ok,
    true,
    `the payload CHILD's authored position must survive too: ${JSON.stringify(cargoState.mismatches)}`,
  );

  // (iii) it ENTERED THE TREE. node_payload.gd sets ready_ran in _ready(), which the
  // engine calls only on tree entry — so this is positive evidence that add_child() ran,
  // as opposed to an instantiate whose result was described in the reply and dropped.
  const readyRan = await call("runtime_get_property", { path: `Host/${PAYLOAD_ROOT}`, property: "ready_ran" });
  assert.equal(
    readyRan.value,
    true,
    `_ready() fires only on entry to the SceneTree — a false here means the node was instantiated ` +
      `but never PARENTED, got ${JSON.stringify(readyRan.value)}`,
  );
  console.log(
    `NODE_LIVE_SCENE ok ${inst.path} authored name+values, child ${PAYLOAD_CARGO} came with it, ready_ran=true`,
  );

  // ================================ 5. an ADDED node is itself a valid parent ===
  // Adds under Host prove _resolve on an authored node. This proves it on a node that did
  // not exist when the scene was loaded, and gives the removal below a descendant that is
  // NOT part of the payload's authored subtree.
  const DEEP = "Deep9137";
  const deep = await call("runtime_node_add", { parent: `Host/${PAYLOAD_ROOT}`, type: "Timer", name: DEEP, confirm: true });
  assert.equal(
    deep.path,
    `Host/${PAYLOAD_ROOT}/${DEEP}`,
    `_path_of must report the full scene-relative path two levels down, got ${deep.path}`,
  );
  await expectPresent([{ path: deep.path, type: "Timer" }], "a node added under an added node must be in the tree");
  population.seal("NODE_LIVE_NESTED", `ok ${deep.path} — an added node accepts children of its own`);

  // ==================================== 6. node_remove — the rejections ===
  const goneParent = await raw("runtime_node_remove", { path: "NoSuchNode9137", confirm: true });
  assert.equal(goneParent.isError, true, "removing a node that does not exist must be an error");
  assert.match(errText(goneParent), /bad_path/, `expected bad_path, got ${errText(goneParent)}`);
  population.seal("NODE_LIVE_REMOVE_ERRORS", "ok bad_path on a node that does not exist");

  // =============================== 7. the root guard, in BOTH its spellings ===
  // _resolve maps two different inputs onto the current scene — "." and "" — so the guard
  // is attacked through both. And the assertion is not that the call was refused: it is
  // that the ROOT SURVIVED. A guard that returned the error and freed the node anyway
  // passes a reply-only check and takes the whole game with it.
  for (const spelling of [".", ""]) {
    const attack = await raw("runtime_node_remove", { path: spelling, confirm: true });
    assert.equal(attack.isError, true, `removing the scene root ('${spelling}') must be refused`);
    assert.match(
      errText(attack),
      /cannot_remove_root/,
      `'${spelling}' resolves to the current scene — expected cannot_remove_root, got ${errText(attack)}`,
    );
  }
  // ...and the game is still there, with everything built so far still under it.
  await expectPresent(
    [
      { path: ".", type: "Node2D" },
      { path: "Host", type: "Node2D" },
      { path: `Host/${PAYLOAD_ROOT}`, type: "Node2D" },
    ],
    "the refused root removal must leave the scene completely intact",
  );
  population.seal("NODE_LIVE_ROOT_GUARD", `ok refused as '.' and as '', and the root SURVIVED both`);

  // ============================= 8. removal takes the WHOLE SUBTREE ===
  // Payload holds an AUTHORED child (Cargo) and an ADDED one (Deep9137). Removing the
  // parent must take both — a remove that detached only the named node would leave two
  // orphans resolvable at their old paths.
  const removed = await call("runtime_node_remove", { path: `Host/${PAYLOAD_ROOT}`, confirm: true });
  // 🔴 `removed` is `_node_remove`'s hard-wired `true`, same shape as `added` above. The
  // claim that the removal HAPPENED is the `waitAbsent` + `expectAbsent` pair below, and
  // `path` is computed BEFORE the free, which is the one thing a caller cannot recompute.
  assert.equal(typeof removed.removed, "boolean", "the reply must carry a `removed` flag");
  assert.equal(
    removed.path,
    `Host/${PAYLOAD_ROOT}`,
    `the reply must echo the path that was removed, computed BEFORE the free, got ${removed.path}`,
  );
  const frames = await waitAbsent(`Host/${PAYLOAD_ROOT}`, "the removed node must actually leave the tree");
  await expectAbsent(
    [`Host/${PAYLOAD_ROOT}`, `Host/${PAYLOAD_ROOT}/${PAYLOAD_CARGO}`, `Host/${PAYLOAD_ROOT}/${DEEP}`],
    "removing a parent must take its authored AND its added descendants",
  );

  // Removing it AGAIN is now bad_path, not a second success. That is the other direction
  // of the same claim: the node is gone from _resolve's point of view, not merely hidden.
  const reRemove = await raw("runtime_node_remove", { path: `Host/${PAYLOAD_ROOT}`, confirm: true });
  assert.equal(reRemove.isError, true, "re-removing an already-removed node must be bad_path, not a second success");
  assert.match(errText(reRemove), /bad_path/, `expected bad_path on re-remove, got ${errText(reRemove)}`);

  // The siblings are untouched: removal is scoped to the subtree, not to Host.
  await expectPresent(
    [
      { path: `Host/${TIMER}`, type: "Timer" },
      { path: autoNamed.path, type: "Marker2D" },
    ],
    "removing one child must not disturb its siblings",
  );
  population.seal("NODE_LIVE_SUBTREE", `ok parent + authored child + added child all gone after ${frames} poll(s), siblings intact`);

  // ================================================ 9. leave it pristine ===
  // #146's rule: state left behind by a probe is a defect even when nothing is currently
  // failing. This lane is the only DESTRUCTIVE one in the runtime plane, so it is also the
  // only one where "pristine" is a claim worth checking rather than an assumption — and
  // the scriptless fixture is what makes it checkable at all.
  // 🔴 283 — THIS LIST USED TO BE TYPED BY HAND AND IT LEAKED THE MOMENT A CASE WAS
  // ADDED. It read `[Host/${TIMER}, autoNamed.path]` while `MADE` — the list the pristine
  // check below judges against — had grown three more entries, so the probe created nodes
  // it never removed and blamed the tree for holding them. That is this session's own
  // finding wearing different clothes: a roster somebody has to keep true, beside a
  // derived population that is always right. Cleanup is now derived from `MADE`, and a
  // path already removed by §8 is skipped rather than removed twice.
  let cleaned = 0;
  for (const path of MADE) {
    if ((await structure([{ path, absent: true }])).ok) continue;   // §8 already took it
    // call() throws on isError, so a cleanup that cannot run says so by name rather than
    // leaving the tree dirty for a pristine check that would then blame the wrong thing.
    const r = await call("runtime_node_remove", { path, confirm: true });
    // call() already threw if the cleanup could not run, so `r.removed === true` asserted
    // nothing this line reaches; `waitAbsent` below is what proves the node left the tree.
    assert.equal(typeof r.removed, "boolean", `the reply must carry a \`removed\` flag: ${JSON.stringify(r)}`);
    await waitAbsent(path, "the probe's own cleanup must complete");
    cleaned++;
  }
  assert.ok(cleaned > 0, "a cleanup that removed nothing has not proved it can remove anything");
  await expectAbsent(MADE, "the probe must leave nothing it created behind");

  const hostAtEnd = await childCount("Host");
  const rootAtEnd = await childCount(".");
  assert.equal(hostAtEnd, hostAtBoot, `Host must end as it started: ${hostAtBoot} children, got ${hostAtEnd}`);
  assert.equal(rootAtEnd, rootAtBoot, `the root must end as it started: ${rootAtBoot} children, got ${rootAtEnd}`);
  await expectPresent(
    [
      { path: ".", type: "Node2D" },
      { path: "Host", type: "Node2D" },
    ],
    "and the fixture itself must have survived the whole run",
  );
  population.seal("NODE_LIVE_PRISTINE", `ok created ${MADE.length}, removed ${cleaned} here + the rest in §8, host=${hostAtEnd} root=${rootAtEnd}`);

  console.log(
    `NODE_LIVE_RESULT add=type+scene+nested errors=7reasons remove=subtree+root_guard pristine=restored`,
  );
  console.log("✔ node lifecycle verified against a real running game");
  runtime.close();
} catch (err) {
  console.error(`::error::node-lifecycle probe failed: ${err?.message ?? String(err)}`);
  console.error(err?.stack ?? "");
  runtime.close();
  process.exit(1);
}

// 🔴 THE POPULATION GATE, before the ✔ that used to be unconditional.
population.reportOrDie();
console.log("✔ node-lifecycle integration OK");

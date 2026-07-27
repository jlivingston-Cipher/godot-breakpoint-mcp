import { test } from "node:test";
import assert from "node:assert/strict";
import { registerRuntimeTools } from "../src/tools/runtime.js";
import { BridgeError } from "../src/bridge.js";
import {
  makeRecordingServer,
  type ElicitFn,
  type ToolResultLike,
} from "./helpers/recording-server.js";

/**
 * Behavior tests for the runtime plane (tools/runtime.ts). Same two invariants
 * as the editor plane — destructive tools are confirmation-gated, and an
 * unreachable runtime bridge degrades to a friendly isError — but this plane
 * mutates the LIVE running game, so its four mutators are the ones gated.
 */

// The destructive runtime tools (mutate the running game) that MUST gate.
const GATED = [
  "runtime_call_method",
  "runtime_emit_signal",
  "runtime_inject_input",
  "runtime_set_property",
  // F8 additions — animation + node lifecycle drive the running game.
  "runtime_anim_play",
  "runtime_anim_stop",
  "runtime_node_add",
  "runtime_node_remove",
  // F4 additions — time control / frame stepping / RNG seed drive the running game.
  "runtime_time_scale",
  "runtime_step_frames",
  "runtime_seed_rng",
].sort();

// Valid-enough args per tool so that gate summaries (some read args, e.g.
// `event.kind`) evaluate. Non-gated tools default to {}.
const ARGS: Record<string, Record<string, unknown>> = {
  runtime_set_property: { path: "/root/Player", property: "hp", value: 1 },
  runtime_call_method: { path: "/root/Player", method: "take_damage", args: [1] },
  runtime_emit_signal: { path: "/root/Player", signal: "died", args: [] },
  runtime_inject_input: { event: { kind: "action", action: "jump", pressed: true } },
  // F8: read-only await + animation state, gated animation + node lifecycle.
  runtime_await_condition: { path: "/root/Player", property: "hp", value: 0, timeout_ms: 30, poll_interval_ms: 5 },
  runtime_anim_play: { path: "/root/Anim", animation: "walk" },
  runtime_anim_stop: { path: "/root/Anim" },
  runtime_anim_get_state: { path: "/root/Anim" },
  runtime_node_add: { parent: "/root", type: "Node2D", name: "Spawned" },
  runtime_node_remove: { path: "/root/Spawned" },
  // F4: gated time/frame/RNG mutators + read-only state digest.
  runtime_time_scale: { scale: 0 },
  runtime_step_frames: { frames: 2, kind: "idle" },
  runtime_state_digest: { root: "/root" },
  runtime_seed_rng: { seed: 42 },
  // F6: multi-peer. The stub registry below reports two live peers and hands
  // every one of them the same recording bridge.
  runtime_spawn_peers: { count: 2 },
  runtime_peer_stop: { all: true },
  runtime_peers_digest: { root: "/root" },
};

/**
 * F6 tools whose failure mode is process-level, not bridge-level: they never
 * reach the runtime bridge at all, so the "everything degrades to a
 * bridge_unavailable envelope" invariant below cannot apply to them. Listed
 * explicitly rather than filtered by prefix so a new tool cannot join them
 * silently — the whole point of that invariant is that nothing escapes it by
 * accident. Their own degradation is asserted separately.
 */
const NON_BRIDGE_TOOLS = ["runtime_peer_stop", "runtime_spawn_peers"].sort();

/**
 * Every runtime tool that forwards to the running game takes `peer` — the rule
 * is "if it talks to the running game, it can talk to a peer", with no subset.
 *
 * It was a subset once: F6 shipped `peer` on the seven tools a convergence run
 * obviously needs. Validating the build against real Godot 4.3 showed that
 * insufficient in a way only an engine could reveal — peers free-run for
 * different durations before you freeze them, so equalising their state first is
 * mandatory, and `runtime_set_property` was not on the list. Any subset has that
 * shape of hole; this one had it at the exact tool the documented sequence needs.
 */
const PEER_AWARE = [
  "runtime_anim_get_state",
  "runtime_anim_play",
  "runtime_anim_stop",
  "runtime_assert_node_state",
  "runtime_assert_perf",
  "runtime_assert_scene_structure",
  "runtime_assert_screen_text",
  "runtime_await_condition",
  "runtime_call_method",
  "runtime_emit_signal",
  "runtime_get_log",
  "runtime_get_monitors",
  "runtime_get_property",
  "runtime_get_tree",
  "runtime_inject_input",
  "runtime_node_add",
  "runtime_node_remove",
  "runtime_screenshot",
  "runtime_screenshot_diff",
  "runtime_seed_rng",
  "runtime_set_property",
  "runtime_state_digest",
  "runtime_step_frames",
  "runtime_time_scale",
].sort();

interface BridgeCall {
  method: string;
  params: Record<string, unknown>;
}

function makeHarness() {
  const calls: BridgeCall[] = [];
  const elicitReqs: unknown[] = [];
  let bridgeMode: "resolve" | "reject" = "resolve";
  let canned: Record<string, unknown> = { ok: true };
  let elicitImpl: ElicitFn = async () => ({ action: "decline" });

  const bridge = {
    async request(method: string, params: Record<string, unknown> = {}) {
      calls.push({ method, params });
      if (bridgeMode === "reject") {
        throw new BridgeError(
          "bridge_unavailable",
          "Cannot reach the Godot runtime bridge at 127.0.0.1:9081. Is the project running with the runtime autoload?",
        );
      }
      return canned;
    },
  };

  const elicit: ElicitFn = async (req) => {
    elicitReqs.push(req);
    return elicitImpl(req);
  };
  // Stub peer registry: two live peers, all resolving to the SAME recording
  // bridge, so a call carrying `peer` is observable in `calls` exactly like a
  // default-bridge call. Nothing here spawns a process.
  const peerIds = ["peer-1", "peer-2"];
  const stopped: string[] = [];
  const peers = {
    live: () => peerIds.map((id, i) => ({ id, port: 9082 + i, pid: 900 + i, role: null, ready: true })),
    all: () => peerIds.map((id, i) => ({ id, port: 9082 + i, pid: 900 + i, role: null, ready: true })),
    clientFor(id: string) {
      if (!peerIds.includes(id)) throw new BridgeError("unknown_peer", `No peer with id "${id}".`);
      return bridge;
    },
    async spawn() {
      throw new BridgeError("peer_not_ready", "stub registry never spawns a process");
    },
    stop(id?: string, all = false) {
      const out = all ? [...peerIds] : id ? [id] : [];
      stopped.push(...out);
      return out;
    },
    stopAll() {},
  };

  const rec = makeRecordingServer(elicit);
  registerRuntimeTools(
    rec.server as unknown as Parameters<typeof registerRuntimeTools>[0],
    bridge as unknown as Parameters<typeof registerRuntimeTools>[1],
    peers as unknown as Parameters<typeof registerRuntimeTools>[2],
  );

  return {
    tools: rec.tools,
    stopped,
    handler: (name: string) => rec.handler(name),
    calls,
    elicitReqs,
    setBridge(mode: "resolve" | "reject", c?: Record<string, unknown>) {
      bridgeMode = mode;
      if (c) canned = c;
    },
    setElicit(fn: ElicitFn) {
      elicitImpl = fn;
    },
  };
}

const text = (r: ToolResultLike): string => r.content?.[0]?.text ?? "";

// -------------------------------------------------------- confirmation gate ----

test("exactly the four runtime mutators are gated; each blocks on decline without touching the bridge", async () => {
  const h = makeHarness();
  h.setBridge("reject");
  h.setElicit(async () => ({ action: "decline" }));

  const discovered: string[] = [];
  for (const [name, t] of h.tools) {
    const bridgeBefore = h.calls.length;
    const elicitBefore = h.elicitReqs.length;
    let res: ToolResultLike | undefined;
    try {
      res = await t.handler(ARGS[name] ?? {});
    } catch {
      res = undefined;
    }
    if (h.elicitReqs.length === elicitBefore) continue;

    discovered.push(name);
    assert.equal(h.calls.length, bridgeBefore, `${name} must NOT reach the bridge when the user declines`);
    assert.ok(res, `${name} must return a blocking result, not throw`);
    assert.equal(res!.isError, true, `${name} decline result must be an error`);
    assert.match(text(res!), /did not approve/i, `${name} must report the action was not approved`);
  }

  assert.deepEqual(discovered.sort(), GATED, `gated set drifted: ${discovered.sort().join(", ")}`);
});

test("confirm:true skips the prompt and forwards each mutator to the runtime bridge", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { ok: true });
  h.setElicit(async () => {
    throw new Error("elicitInput must not be called when confirm:true");
  });

  for (const name of GATED) {
    const before = h.calls.length;
    const r = await h.handler(name)({ ...ARGS[name], confirm: true });
    assert.ok(h.calls.length > before, `${name} with confirm:true should forward to the bridge`);
    assert.notEqual(r.isError, true, `${name} should succeed when confirmed and the bridge resolves`);
  }
  assert.equal(h.elicitReqs.length, 0);
});

// ---------------------------------------------------- bridge-unreachable degrade ----

test("every bridge-backed runtime tool degrades to a friendly isError when the bridge is unreachable (never throws)", async () => {
  const h = makeHarness();
  h.setBridge("reject");
  const skip = new Set(NON_BRIDGE_TOOLS);
  let errored = 0;
  for (const [name, t] of h.tools) {
    if (skip.has(name)) continue;
    let r: ToolResultLike;
    try {
      r = await t.handler({ ...ARGS[name], confirm: true });
    } catch (e) {
      assert.fail(`${name} threw instead of returning an error envelope: ${(e as Error).message}`);
      return;
    }
    assert.ok(Array.isArray(r.content), `${name} must return a content array`);
    if (r.isError) {
      errored++;
      assert.match(text(r), /Runtime error \[bridge_unavailable\]/, `${name} should surface the runtime error prefix`);
    }
  }
  assert.equal(
    errored,
    h.tools.size - NON_BRIDGE_TOOLS.length,
    "every runtime tool except the two process-level ones forwards to the bridge and should error when it is down",
  );
});

test("the two process-level F6 tools also degrade to an isError envelope, never a throw", async () => {
  const h = makeHarness();
  h.setBridge("reject");
  // spawn: the stub registry rejects, which is the shape a real failed spawn has.
  const spawn = await h.handler("runtime_spawn_peers")({ count: 2 });
  assert.equal(spawn.isError, true);
  assert.match(text(spawn), /Runtime error \[peer_not_ready\]/);
  // stop: needs a target, and says so rather than silently succeeding.
  const noTarget = await h.handler("runtime_peer_stop")({});
  assert.equal(noTarget.isError, true);
  assert.match(text(noTarget), /Pass a peer `id`, or all:true/);
});

// ----------------------------------------------------------------- happy path ----

test("runtime_get_tree returns the ok() envelope when the bridge resolves", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { name: "root", children: [] });
  const r = await h.handler("runtime_get_tree")({});
  assert.notEqual(r.isError, true);
  assert.deepEqual(r.structuredContent, { name: "root", children: [] });
  assert.equal(h.calls[0].method, "runtime.get_tree");
});

test("runtime_call_method forwards runtime.call_method with args once confirmed", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { returned: null });
  const r = await h.handler("runtime_call_method")({
    path: "/root/Player",
    method: "take_damage",
    args: [5],
    confirm: true,
  });
  assert.notEqual(r.isError, true);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].method, "runtime.call_method");
  assert.deepEqual(h.calls[0].params, { path: "/root/Player", method: "take_damage", args: [5] });
});

test("runtime_assert_node_state forwards runtime.assert_node_state with path/expect/tolerance", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { path: "/root/Player", ok: true, checked: 1, mismatches: [] });
  const r = await h.handler("runtime_assert_node_state")({
    path: "/root/Player",
    expect: { hp: 100 },
    tolerance: 0,
  });
  assert.notEqual(r.isError, true);
  assert.deepEqual(r.structuredContent, { path: "/root/Player", ok: true, checked: 1, mismatches: [] });
  assert.equal(h.calls[0].method, "runtime.assert_node_state");
  assert.deepEqual(h.calls[0].params, { path: "/root/Player", expect: { hp: 100 }, tolerance: 0 });
});

test("runtime_assert_node_state omits tolerance when not supplied", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { path: "/root/Player", ok: true, checked: 1, mismatches: [] });
  await h.handler("runtime_assert_node_state")({ path: "/root/Player", expect: { hp: 100 } });
  assert.deepEqual(h.calls[0].params, { path: "/root/Player", expect: { hp: 100 } });
});

test("runtime_assert_scene_structure forwards the expectation list", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { ok: true, checked: 2, failures: [] });
  const expect = [{ path: "/root/Player" }, { path: "/root/HUD", type: "CanvasLayer" }];
  const r = await h.handler("runtime_assert_scene_structure")({ expect });
  assert.notEqual(r.isError, true);
  assert.deepEqual(r.structuredContent, { ok: true, checked: 2, failures: [] });
  assert.equal(h.calls[0].method, "runtime.assert_scene_structure");
  assert.deepEqual(h.calls[0].params, { expect });
});

test("runtime_assert_perf forwards baseline/tolerance/direction", async () => {
  const h = makeHarness();
  h.setBridge("resolve", {
    ok: true,
    checked: 2,
    regressions: [],
    monitors: { "time/fps": 60, "render/total_draw_calls": 40 },
  });
  const r = await h.handler("runtime_assert_perf")({
    baseline: { "time/fps": 60, "render/total_draw_calls": 50 },
    tolerance: 0.1,
    direction: { "time/fps": "higher_better" },
  });
  assert.notEqual(r.isError, true);
  assert.deepEqual(r.structuredContent, {
    ok: true,
    checked: 2,
    regressions: [],
    monitors: { "time/fps": 60, "render/total_draw_calls": 40 },
  });
  assert.equal(h.calls[0].method, "runtime.assert_perf");
  assert.deepEqual(h.calls[0].params, {
    baseline: { "time/fps": 60, "render/total_draw_calls": 50 },
    tolerance: 0.1,
    direction: { "time/fps": "higher_better" },
  });
});

test("runtime_assert_perf omits tolerance and direction when not supplied", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { ok: true, checked: 1, regressions: [], monitors: { "time/fps": 60 } });
  await h.handler("runtime_assert_perf")({ baseline: { "time/fps": 60 } });
  assert.deepEqual(h.calls[0].params, { baseline: { "time/fps": 60 } });
});

test("runtime_assert_screen_text forwards text and optional flags", async () => {
  const h = makeHarness();
  h.setBridge("resolve", {
    ok: true,
    matches: 2,
    present: true,
    samples: [{ path: "HUD/Score", text: "Score: 100" }],
  });
  const r = await h.handler("runtime_assert_screen_text")({
    text: "Score",
    regex: false,
    case_sensitive: false,
    min_count: 1,
  });
  assert.notEqual(r.isError, true);
  assert.deepEqual(r.structuredContent, {
    ok: true,
    matches: 2,
    present: true,
    samples: [{ path: "HUD/Score", text: "Score: 100" }],
  });
  assert.equal(h.calls[0].method, "runtime.assert_screen_text");
  assert.deepEqual(h.calls[0].params, { text: "Score", regex: false, case_sensitive: false, min_count: 1 });
});

test("runtime_assert_screen_text omits unset optionals (absence check)", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { ok: true, matches: 0, present: false, samples: [] });
  await h.handler("runtime_assert_screen_text")({ text: "Game Over", present: false });
  assert.deepEqual(h.calls[0].params, { text: "Game Over", present: false });
});

test("runtime_screenshot_diff forwards reference and optional params", async () => {
  const h = makeHarness();
  h.setBridge("resolve", {
    ok: true,
    diff_ratio: 0,
    differing_pixels: 0,
    total_pixels: 100,
    width: 10,
    height: 10,
    reference: "res://ref.png",
  });
  const r = await h.handler("runtime_screenshot_diff")({
    reference: "res://ref.png",
    tolerance: 0.01,
    per_channel_threshold: 8,
    region: { x: 0, y: 0, w: 10, h: 10 },
  });
  assert.notEqual(r.isError, true);
  assert.equal(h.calls[0].method, "runtime.screenshot_diff");
  assert.deepEqual(h.calls[0].params, {
    reference: "res://ref.png",
    tolerance: 0.01,
    per_channel_threshold: 8,
    region: { x: 0, y: 0, w: 10, h: 10 },
  });
});

test("runtime_screenshot_diff omits unset optionals", async () => {
  const h = makeHarness();
  h.setBridge("resolve", {
    ok: true,
    diff_ratio: 0,
    differing_pixels: 0,
    total_pixels: 100,
    width: 10,
    height: 10,
    reference: "res://ref.png",
  });
  await h.handler("runtime_screenshot_diff")({ reference: "res://ref.png" });
  assert.deepEqual(h.calls[0].params, { reference: "res://ref.png" });
});

// ----------------------------------------------------------- F8: await/anim/node ----

test("runtime_await_condition resolves met:true on the first matching poll (read-only, not gated)", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { path: "/root/Player", property: "hp", value: 0 });
  const r = await h.handler("runtime_await_condition")({ path: "/root/Player", property: "hp", value: 0 });
  assert.notEqual(r.isError, true);
  assert.equal(h.elicitReqs.length, 0, "await is read-only and must not prompt");
  assert.equal(h.calls[0].method, "runtime.get_property");
  assert.equal((r.structuredContent as { met: boolean }).met, true);
  assert.equal((r.structuredContent as { polls: number }).polls, 1);
});

test("runtime_await_condition polls to a fast timeout when the condition never holds", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { path: "/root/Player", property: "hp", value: 5 });
  const r = await h.handler("runtime_await_condition")({
    path: "/root/Player",
    property: "hp",
    value: 0,
    op: "le",
    timeout_ms: 25,
    poll_interval_ms: 5,
  });
  assert.notEqual(r.isError, true);
  const sc = r.structuredContent as { met: boolean; polls: number };
  assert.equal(sc.met, false);
  assert.ok(sc.polls >= 1, "should have polled at least once");
});

test("runtime_anim_play forwards runtime.anim_play once confirmed, omitting unset optionals", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { playing: true, current_animation: "walk", speed_scale: 1 });
  const r = await h.handler("runtime_anim_play")({ path: "/root/Anim", animation: "walk", confirm: true });
  assert.notEqual(r.isError, true);
  assert.equal(h.calls[0].method, "runtime.anim_play");
  assert.deepEqual(h.calls[0].params, { path: "/root/Anim", animation: "walk" });
});

test("runtime_anim_get_state forwards runtime.anim_get_state (read-only, not gated)", async () => {
  const h = makeHarness();
  h.setBridge("resolve", {
    playing: false,
    current_animation: "",
    position: 0,
    length: 0,
    speed_scale: 1,
    animations: ["walk", "idle"],
  });
  const r = await h.handler("runtime_anim_get_state")({ path: "/root/Anim" });
  assert.notEqual(r.isError, true);
  assert.equal(h.elicitReqs.length, 0);
  assert.equal(h.calls[0].method, "runtime.anim_get_state");
  assert.deepEqual(h.calls[0].params, { path: "/root/Anim" });
});

test("runtime_node_add forwards type/scene/name once confirmed", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { added: true, path: "/root/Spawned", type: "Node2D" });
  const r = await h.handler("runtime_node_add")({ parent: "/root", type: "Node2D", name: "Spawned", confirm: true });
  assert.notEqual(r.isError, true);
  assert.equal(h.calls[0].method, "runtime.node_add");
  assert.deepEqual(h.calls[0].params, { parent: "/root", type: "Node2D", name: "Spawned" });
});

test("runtime_node_remove forwards the node path once confirmed", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { removed: true, path: "/root/Spawned" });
  const r = await h.handler("runtime_node_remove")({ path: "/root/Spawned", confirm: true });
  assert.notEqual(r.isError, true);
  assert.equal(h.calls[0].method, "runtime.node_remove");
  assert.deepEqual(h.calls[0].params, { path: "/root/Spawned" });
});

// ------------------------------------------------ F4: deterministic playtesting ----

test("runtime_time_scale forwards runtime.time_scale with the scale once confirmed", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { previous: 1, current: 0 });
  const r = await h.handler("runtime_time_scale")({ scale: 0, confirm: true });
  assert.notEqual(r.isError, true);
  assert.equal(h.calls[0].method, "runtime.time_scale");
  assert.deepEqual(h.calls[0].params, { scale: 0 });
});

test("runtime_step_frames forwards frames + kind once confirmed", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { frames_advanced: 3, frame_index: 1234 });
  const r = await h.handler("runtime_step_frames")({ frames: 3, kind: "both", confirm: true });
  assert.notEqual(r.isError, true);
  assert.equal(h.calls[0].method, "runtime.step_frames");
  assert.deepEqual(h.calls[0].params, { frames: 3, kind: "both" });
});

test("runtime_step_frames omits kind when not supplied", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { frames_advanced: 1, frame_index: 1 });
  await h.handler("runtime_step_frames")({ frames: 1, confirm: true });
  assert.deepEqual(h.calls[0].params, { frames: 1 });
});

test("runtime_state_digest forwards runtime.state_digest (read-only, not gated)", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { digest: { ".": { visible: true } }, node_count: 1 });
  const r = await h.handler("runtime_state_digest")({ root: "/root" });
  assert.notEqual(r.isError, true);
  assert.equal(h.elicitReqs.length, 0);
  assert.equal(h.calls[0].method, "runtime.state_digest");
  assert.deepEqual(h.calls[0].params, { root: "/root" });
});

test("runtime_state_digest forwards optional fields/max_depth when supplied", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { digest: {}, node_count: 0 });
  await h.handler("runtime_state_digest")({ root: "/root", fields: ["position"], max_depth: 3 });
  assert.deepEqual(h.calls[0].params, { root: "/root", fields: ["position"], max_depth: 3 });
});

test("runtime_seed_rng forwards the seed once confirmed", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { seed: 42 });
  const r = await h.handler("runtime_seed_rng")({ seed: 42, confirm: true });
  assert.notEqual(r.isError, true);
  assert.equal(h.calls[0].method, "runtime.seed_rng");
  assert.deepEqual(h.calls[0].params, { seed: 42 });
});

// ------------------------------------------------------------- F6: peers ----

test("every peer-aware tool routes to the peer's bridge and never leaks `peer` into the payload", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { ok: true, value: 1, digest: {}, node_count: 0, base64: "", mime: "image/png", width: 1, height: 1 });

  const seen: string[] = [];
  for (const [name, t] of h.tools) {
    const shape = t.config.inputSchema as Record<string, unknown> | undefined;
    if (!shape || !Object.prototype.hasOwnProperty.call(shape, "peer")) continue;
    seen.push(name);
    const before = h.calls.length;
    const r = await t.handler({ ...ARGS[name], confirm: true, peer: "peer-2" });
    assert.notEqual(r.isError, true, `${name} should succeed against a live peer`);
    assert.ok(h.calls.length > before, `${name} should forward to the peer's bridge`);
    // `peer` is host-side addressing, not a bridge parameter — the addon has no
    // idea peers exist, which is exactly why F6 needed no protocol change.
    assert.ok(
      !Object.prototype.hasOwnProperty.call(h.calls[h.calls.length - 1].params, "peer"),
      `${name} must not forward \`peer\` to the bridge`,
    );
  }
  assert.deepEqual(seen.sort(), PEER_AWARE, `the peer-aware set drifted: ${seen.sort().join(", ")}`);
});

test("omitting `peer` addresses the default bridge, byte-identically to pre-F6", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { value: 7 });
  await h.handler("runtime_get_property")({ path: "/root/Player", property: "hp" });
  assert.equal(h.calls[0].method, "runtime.get_property");
  assert.deepEqual(h.calls[0].params, { path: "/root/Player", property: "hp" });
});

test("an unknown peer id fails with a message naming the live peers, not a generic bridge error", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { value: 1 });
  const r = await h.handler("runtime_get_property")({ path: "/root", property: "x", peer: "peer-9" });
  assert.equal(r.isError, true);
  assert.match(text(r), /Runtime error \[unknown_peer\]/);
  assert.equal(h.calls.length, 0, "an unknown peer must not reach any bridge");
});

test("runtime_await_condition resolves its peer once, before polling", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { value: 0 });
  const r = await h.handler("runtime_await_condition")({
    path: "/root/Player", property: "hp", value: 0, timeout_ms: 30, poll_interval_ms: 5, peer: "peer-1",
  });
  assert.notEqual(r.isError, true);
  assert.equal(h.calls[0].method, "runtime.get_property");
  assert.deepEqual(h.calls[0].params, { path: "/root/Player", property: "hp" });

  const bad = await h.handler("runtime_await_condition")({
    path: "/root/Player", property: "hp", value: 0, timeout_ms: 30, poll_interval_ms: 5, peer: "nope",
  });
  assert.equal(bad.isError, true);
  assert.match(text(bad), /Runtime error \[unknown_peer\]/);
});

test("a gated tool's confirmation prompt names the peer it will drive", async () => {
  const h = makeHarness();
  h.setBridge("resolve", { previous: 1, current: 0 });
  const prompts: string[] = [];
  h.setElicit(async (req) => {
    prompts.push(JSON.stringify(req));
    return { action: "decline" };
  });
  await h.handler("runtime_time_scale")({ scale: 0, peer: "peer-2" });
  await h.handler("runtime_time_scale")({ scale: 0 });
  assert.match(prompts[0], /peer peer-2/);
  assert.match(prompts[1], /the running game/);
});

test("runtime_peer_stop forwards id / all to the registry", async () => {
  const h = makeHarness();
  const one = await h.handler("runtime_peer_stop")({ id: "peer-1" });
  assert.notEqual(one.isError, true);
  const all = await h.handler("runtime_peer_stop")({ all: true });
  assert.notEqual(all.isError, true);
  assert.deepEqual(h.stopped, ["peer-1", "peer-1", "peer-2"]);
});

test("runtime_peers_digest converges when peers agree and names the paths when they do not", async () => {
  const h = makeHarness();
  // Same digest from both peers (the stub hands out one bridge) -> converged.
  h.setBridge("resolve", { digest: { ".": { visible: true }, "./Mover": { x: 1 } }, node_count: 2 });
  const same = await h.handler("runtime_peers_digest")({ root: "/root" });
  assert.notEqual(same.isError, true);
  assert.equal(same.structuredContent?.converged, true);
  assert.equal(same.structuredContent?.diverged_at, null);
  assert.equal((same.structuredContent?.digests as unknown[]).length, 2);
  assert.equal(h.calls[0].method, "runtime.state_digest");
  assert.deepEqual(h.calls[0].params, { root: "/root" });
});

test("runtime_peers_digest compares by content, not by key order", async () => {
  let n = 0;
  const bridge = {
    async request() {
      n++;
      // Same content, keys emitted in a different order per peer.
      return n === 1
        ? { digest: { "./A": { x: 1, y: 2 } }, node_count: 1 }
        : { digest: { "./A": { y: 2, x: 1 } }, node_count: 1 };
    },
  };
  const rec = makeRecordingServer(async () => ({ action: "decline" }));
  const peers = {
    live: () => [{ id: "p1" }, { id: "p2" }],
    clientFor: () => bridge,
  };
  registerRuntimeTools(
    rec.server as unknown as Parameters<typeof registerRuntimeTools>[0],
    bridge as unknown as Parameters<typeof registerRuntimeTools>[1],
    peers as unknown as Parameters<typeof registerRuntimeTools>[2],
  );
  const r = (await rec.handler("runtime_peers_digest")({ root: "/root" })) as ToolResultLike;
  assert.equal(r.structuredContent?.converged, true, "key order must not decide convergence");
});

test("runtime_peers_digest reports divergence per node path", async () => {
  let n = 0;
  const bridge = {
    async request() {
      n++;
      return {
        digest: { "./Same": { x: 1 }, "./Drifts": { x: n } },
        node_count: 2,
      };
    },
  };
  const rec = makeRecordingServer(async () => ({ action: "decline" }));
  const peers = { live: () => [{ id: "p1" }, { id: "p2" }], clientFor: () => bridge };
  registerRuntimeTools(
    rec.server as unknown as Parameters<typeof registerRuntimeTools>[0],
    bridge as unknown as Parameters<typeof registerRuntimeTools>[1],
    peers as unknown as Parameters<typeof registerRuntimeTools>[2],
  );
  const r = (await rec.handler("runtime_peers_digest")({ root: "/root" })) as ToolResultLike;
  assert.equal(r.structuredContent?.converged, false);
  assert.deepEqual(r.structuredContent?.diverged_at, ["./Drifts"]);
});

test("runtime_peers_digest refuses a convergence claim over fewer than two peers", async () => {
  const rec = makeRecordingServer(async () => ({ action: "decline" }));
  const bridge = { async request() { return { digest: {}, node_count: 0 }; } };
  const peers = { live: () => [{ id: "only" }], clientFor: () => bridge };
  registerRuntimeTools(
    rec.server as unknown as Parameters<typeof registerRuntimeTools>[0],
    bridge as unknown as Parameters<typeof registerRuntimeTools>[1],
    peers as unknown as Parameters<typeof registerRuntimeTools>[2],
  );
  const r = (await rec.handler("runtime_peers_digest")({ root: "/root" })) as ToolResultLike;
  assert.equal(r.isError, true);
  assert.match(text(r), /at least two peers/i);
  assert.match(text(r), /runtime_state_digest/, "should point at the single-target tool");
});

test("runtime_peers_digest states every measured precondition in its own description", async () => {
  const h = makeHarness();
  const d = (h.tools.get("runtime_peers_digest")!.config.description as string).toLowerCase();
  // Each of these was measured against real Godot 4.3, and a run that skips any
  // one of them diverges. They live in the DESCRIPTION because that is what an
  // agent reads at call time; the docs repeat them, they do not own them.
  assert.match(d, /fixed/, "1: scope the claim to the fixed timestep");
  assert.match(d, /physics/, "1: name the lane the caller has to step");
  assert.match(d, /idle/, "1+2: say what does NOT converge");
  assert.match(d, /one stream shared/, "2: the global RNG is one shared stream");
  assert.match(d, /freezing does not stop/, "2: freezing does not stop it being drawn");
  assert.match(d, /delta > 0/, "2: name the guard that makes it deterministic");
  assert.match(d, /freeze first/, "3: freeze before equalising state");
  assert.match(d, /runtime_set_property/, "3: name the tool that equalises state");
  assert.match(d, /same machine/, "4: keep the claim to one machine");
});

test("runtime_seed_rng warns that its stream is shared across both lanes", async () => {
  const h = makeHarness();
  const d = (h.tools.get("runtime_seed_rng")!.config.description as string).toLowerCase();
  assert.match(d, /one stream shared/, "must say the global RNG is one shared stream");
  assert.match(d, /idle/, "must name the lane that silently consumes it");
});

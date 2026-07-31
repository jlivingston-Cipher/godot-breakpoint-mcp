// Inject-input integration probe — drives the runtime input lane against a REAL running
// game over the in-game runtime autoload:
//
//   runtime_inject_input  (kind: action | key | mouse_button | mouse_motion, + bad_kind)
//
// WHY THIS EXISTS
// ---------------
// Handoff 152 §2 left a ranked backlog of runtime tools with no live coverage, and this
// one topped it: 39 lines of GDScript, four `kind` branches plus the reject arm, of which
// the host unit tests reach exactly zero — they prove the tool FORWARDS
// runtime.inject_input once confirmed and stop there. Input.action_press,
// Input.parse_input_event and the Codec.decode guards on `position` / `relative` had
// never run anywhere in CI.
//
// THE FIXTURE QUESTION, ASKED FIRST — AND NO FOR THE FOURTH SESSION RUNNING
// ------------------------------------------------------------------------
// example/project.godot had NO [input] section at all. Without one the `action` branch
// has nothing to be pointed at: Input.action_press on an unknown action is an engine
// error, not an injection. So the fixture work WAS the session, exactly as it was for
// #152 (no Control with text), #153 (no AnimationPlayer) and #154 (seven scenes, all
// unusable). Two actions were added for this probe and nothing else — bp_probe_bound
// (one event, KEY_K) and bp_probe_unbound (no events at all) — plus
// res://tests/input_probe.tscn, an OBSERVER that never synthesises input of its own.
//
// WHAT MAKES IT COVERAGE RATHER THAN GREEN
// ----------------------------------------
// Five claims here are unsatisfiable by an implementation that merely returns
// {"injected": true}, and each was verified against a live engine BEFORE being written
// down:
//
//   * `action` and `key` are observable through DIFFERENT instruments, and the difference
//     is itself asserted. Input.action_press generates NO InputEvent — measured at
//     exactly 0 across a press/release pair — so an implementation that faked the action
//     branch by synthesising a key event fails the total_events check and nothing else.
//   * A `key` injection on the BOUND keycode must move BOTH lanes: it arrives as an
//     InputEvent and it sets bp_probe_bound. That is what proves the event went through
//     the engine's real input pipeline rather than being handed to a listener directly.
//     The same injection on an UNBOUND keycode must move only the first. Two operands of
//     one claim, in the shape #154 §4 found the hard way.
//   * `strength` is forwarded, not defaulted. Pressed at 0.6, the action reads back 0.6
//     (to float32); an implementation that always passed 1.0 passes every other check here.
//   * The Codec.decode guards on `position` and `relative` are reached SEPARATELY, in
//     both directions. A motion event with only `relative` must leave position at (0,0)
//     and vice versa — an implementation that decoded one field into both, or that
//     applied a default when the caller sent nothing, fails exactly one of those.
//   * The event count is EXACT, not monotonic. Ten injections must produce ten events and
//     the three per-kind counters must sum to the total, so a duplicate delivery and a
//     stray engine-generated event are both failures rather than noise.
//
// Markers (grep-able): INPUT_LIVE_PING / _FIXTURE / _REJECT / _ACTION / _KEY / _BUTTON /
// _MOTION / _EXACT / _PRISTINE / _RESULT.
//
// Requires res://tests/input_probe.tscn running with GODOT_PROJECT set and
// BREAKPOINT_RUNTIME_PORT pointing at its bridge. Fully headless — nothing here reads a
// pixel. Not part of `npm test` (Godot-free); invoked directly by integration.yml.
import assert from "node:assert/strict";
import { BridgeClient } from "../dist/bridge.js";
import { loadConfig } from "../dist/config.js";
import { registerRuntimeTools } from "../dist/tools/runtime.js";

const cfg = loadConfig();
console.log(`inject-input probe -> runtime bridge ${cfg.runtimeHost}:${cfg.runtimePort}  project=${cfg.projectPath}`);

// Mirrors example/project.godot's [input] section and example/tests/input_probe.gd. If
// those drift apart the assertions below name the thing that moved rather than failing as
// a surprise three sections later.
const BOUND = "bp_probe_bound"; // one event: KEY_K
const UNBOUND = "bp_probe_unbound"; // no events at all — the control
const KEY_K = 75; // the keycode bp_probe_bound is bound to
const KEY_J = 74; // deliberately bound to NOTHING

// Godot stores action strength as float32, so 0.6 comes back as 0.60000002384186.
const near = (got, want, why) =>
  assert.ok(Math.abs(got - want) < 1e-4, `${why} — expected ~${want}, got ${got}`);

// Register the runtime tools against a live runtime BridgeClient, exactly the way index.ts
// wires Plane C — so the host<->engine path is exercised end to end, not just the raw
// socket. elicitInput is never reached (every mutating call passes confirm).
const runtime = new BridgeClient(cfg.runtimeHost, cfg.runtimePort, 15000, "runtime bridge", "Is the input probe scene running?");
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Inject one event through the registered tool. */
const inject = (event) => call("runtime_inject_input", { event, confirm: true });

/**
 * Send runtime.inject_input straight down the socket, bypassing the host tool.
 *
 * The host schema declares `kind` as a zod enum, so the GDScript `bad_kind` arm is
 * UNREACHABLE through runtime_inject_input — zod rejects the call before it leaves the
 * host. That does not make the guard dead code: the runtime bridge is a socket that
 * spawned peers and any direct client can write to, and an older or hand-rolled host can
 * send anything at all. Reaching it here is the only way it is ever executed, and the
 * error surfaces as a BridgeError carrying the engine's own `code`.
 */
async function socketReject(params, wantCode, why) {
  try {
    await runtime.request("runtime.inject_input", params, 15000);
    assert.fail(`${why} — the call SUCCEEDED; expected ${wantCode}`);
  } catch (err) {
    if (err?.code === undefined) throw err; // a real failure, not the rejection we wanted
    assert.equal(err.code, wantCode, `${why} — expected ${wantCode}, got ${err.code} (${err.message})`);
  }
}

/** runtime_get_property on the fixture root — a COVERED instrument (#152). */
const read = async (property) => (await call("runtime_get_property", { path: ".", property })).value;

/** Read several fixture counters at once, as a plain object. */
async function snap(...props) {
  const out = {};
  for (const p of props) out[p] = await read(p);
  return out;
}

/** Codec encodes Vector2 as {__type__, x, y}; compare as plain numbers. */
function v2(value, why) {
  assert.equal(value?.__type__, "Vector2", `${why} — expected a Vector2, got ${JSON.stringify(value)}`);
  return { x: value.x, y: value.y };
}

/**
 * Poll a fixture property until it satisfies `ok`, and return the number of polls.
 *
 * Injection is asynchronous by construction: Input.parse_input_event queues the event and
 * the engine delivers it on a later frame, while Input.action_press writes state the
 * fixture only samples in _process. Polling is that deferral made explicit, not a flake
 * workaround — and the poll COUNT is printed, so a lane that silently started needing
 * dozens of frames shows up as a number that moved rather than as nothing at all.
 */
async function waitFor(property, ok, why) {
  let last;
  for (let i = 0; i < 40; i++) {
    last = await read(property);
    if (ok(last)) return i;
    await sleep(50);
  }
  assert.fail(`${why} — '${property}' was still ${JSON.stringify(last)} after 2s`);
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
  console.log(`INPUT_LIVE_PING ok runtime=${pong?.runtime} godot=${pong?.godot ?? "?"}`);
} catch (err) {
  die(`could not reach the runtime bridge: ${err?.message ?? String(err)}`);
}

// Every injection this probe makes that should produce an InputEvent is counted here, and
// checked against the fixture at the end. Ten, and it must be exactly ten.
let injectedEvents = 0;

try {
  // ============================================ 0. the fixture is the fixture ===
  // If the wrong scene booted, say so by name here rather than letting a later assertion
  // fail for a reason that reads like a tool defect.
  const boot = await raw("runtime_assert_scene_structure", { expect: [{ path: ".", type: "Node2D" }] });
  if (boot.isError || boot.structuredContent?.ok !== true) {
    die(
      `not the inject-input fixture (${boot.isError ? errText(boot) : JSON.stringify(boot.structuredContent?.failures)}) — ` +
        `boot with 'res://tests/input_probe.tscn'; every assertion below assumes that scene`,
    );
  }
  const atBoot = await snap("total_events", "key_count", "button_count", "motion_count", "bound_press_edges");
  for (const [k, v] of Object.entries(atBoot)) {
    if (typeof v !== "number") {
      die(
        `res://tests/input_probe.tscn is running but '${k}' read back as ${JSON.stringify(v)} — ` +
          `input_probe.gd and this probe have drifted apart`,
      );
    }
    assert.equal(v, 0, `the fixture must start clean so every delta below is the probe's doing: ${k}=${v}`);
  }
  // Nothing may be pressed before the probe presses it, or the action lane proves nothing.
  assert.equal(await read("bound_pressed"), false, `${BOUND} must not be pressed at boot`);
  assert.equal(await read("unbound_pressed"), false, `${UNBOUND} must not be pressed at boot`);

  // 🔴 The BINDING is fixture setup, and it is checked here rather than assumed. The
  // routing assertion in section 3 is the probe's sharpest claim, and its most likely
  // false failure is a binding that never got built — which would read as "the tool did
  // not route a key to the InputMap" and send the next session after a tool that is fine.
  const bindings = await read("bound_event_count");
  assert.equal(
    bindings,
    1,
    `${BOUND} must be bound to exactly ONE event before the routing check means anything, got ${bindings} — ` +
      `input_probe.gd's _bind_probe_action() did not run or the action is missing from project.godot`,
  );
  const boundKeycode = await read("bound_keycode");
  assert.equal(
    boundKeycode,
    KEY_K,
    `the fixture and this probe must agree on the bound keycode: fixture says ${boundKeycode}, probe says ${KEY_K}`,
  );
  console.log(`INPUT_LIVE_FIXTURE ok counters 0, ${BOUND} bound to 1 event (keycode ${boundKeycode}), ${UNBOUND} released`);

  // ============================== 1. every rejection, separately, and INERT ===
  // bad_kind is reachable only over the socket (see socketReject). bad_action is the
  // guard added this session — before it, a typo'd action name returned
  // {"injected": true} while the engine logged an error nobody was reading.

  // (a) a kind the match statement has never heard of.
  await socketReject({ event: { kind: "telepathy" } }, "bad_kind", "an unknown input kind must be rejected");

  // (b) THE SECOND OPERAND: no `kind` at all. String(ev.get("kind","")) makes this "",
  // which reaches the same arm by a different route — an implementation that special-cased
  // a list of known-bad strings passes (a) and fails this.
  await socketReject({ event: {} }, "bad_kind", "an event with no kind at all must be rejected");

  // (c) no `event` either. params.get("event", {}) is the outermost default and nothing
  // above it is guarded, so this is the arm a caller reaches by sending nothing useful.
  await socketReject({}, "bad_kind", "inject_input with no event at all must be rejected");

  // (d) NEW THIS SESSION — an action the InputMap does not know. This goes through the
  // registered tool rather than the socket, because `action` IS a legal kind: the call is
  // well-formed all the way to the engine, which is exactly why the old behaviour
  // (injected: true, plus an engine error in a log nobody reads) was so easy to miss.
  const typo = await raw("runtime_inject_input", { event: { kind: "action", action: "bp_no_such_action_9137" }, confirm: true });
  assert.equal(typo.isError, true, "injecting a nonexistent InputMap action must be an error, not injected:true");
  assert.match(errText(typo), /bad_action/, `expected bad_action for a typo'd action name, got ${errText(typo)}`);

  // (e) and its second operand: no `action` key, which arrives as "".
  const noAction = await raw("runtime_inject_input", { event: { kind: "action" }, confirm: true });
  assert.equal(noAction.isError, true, "kind:action with no action name must be an error");
  assert.match(errText(noAction), /bad_action/, `expected bad_action for a missing action name, got ${errText(noAction)}`);

  // 🔴 The point of this section: five rejected injections must have injected NOTHING.
  // A guard that returned the error after already calling into Input would be invisible to
  // every check above and caught only here.
  const afterRejects = await snap("total_events", "bound_pressed", "unbound_pressed", "bound_press_edges");
  assert.equal(afterRejects.total_events, 0, `a rejected injection must not deliver an event, got ${afterRejects.total_events}`);
  assert.equal(afterRejects.bound_pressed, false, "a rejected injection must not press an action");
  assert.equal(afterRejects.unbound_pressed, false, "a rejected injection must not press the control action");
  assert.equal(afterRejects.bound_press_edges, 0, "a rejected injection must not produce a press edge");
  console.log("INPUT_LIVE_REJECT ok bad_kind x3 (unknown / absent kind / absent event) + bad_action x2, nothing injected");

  // ================== 2. the `action` branch — state, strength, and NO event ===
  // Pressed at 0.6 rather than the default, because `strength` is the one field of this
  // branch an implementation can silently drop: Input.action_press(action) with no
  // strength is a legal call that satisfies every check except the value itself.
  const pressed = await inject({ kind: "action", action: BOUND, pressed: true, strength: 0.6 });
  assert.equal(pressed.injected, true, "a successful injection reports injected:true");
  assert.equal(pressed.kind, "action", `the reply must echo the kind, got ${pressed.kind}`);
  const polls = await waitFor("bound_pressed", (v) => v === true, `${BOUND} must go pressed after an action injection`);
  near(await read("bound_strength"), 0.6, `${BOUND} must report the strength the caller SENT, not a default of 1.0`);
  assert.equal(await read("bound_press_edges"), 1, "the press must be seen as an edge exactly once");

  // 🔴 THE CROSS-LANE CLAIM. Input.action_press writes InputMap state and generates no
  // InputEvent at all — measured at exactly 0. So an implementation that faked this branch
  // by synthesising a key event would satisfy every assertion above and fail here alone.
  assert.equal(await read("total_events"), 0, "an `action` injection must generate NO InputEvent — it writes InputMap state directly");

  // The control must not have moved. bp_probe_unbound is a different action; pressing one
  // action may not press another.
  assert.equal(await read("unbound_pressed"), false, `pressing ${BOUND} must not press ${UNBOUND}`);

  // Release, and prove `pressed:false` is a distinct path rather than a no-op.
  await inject({ kind: "action", action: BOUND, pressed: false });
  await waitFor("bound_pressed", (v) => v === false, `${BOUND} must go released on pressed:false`);
  near(await read("bound_strength"), 0.0, "a released action must report zero strength");

  // The DEFAULT strength, on its own. ev.get("strength", 1.0) is only reachable by
  // omitting the field, and the 0.6 press above cannot tell us what it is.
  await inject({ kind: "action", action: BOUND, pressed: true });
  await waitFor("bound_pressed", (v) => v === true, `${BOUND} must go pressed with strength omitted`);
  near(await read("bound_strength"), 1.0, "omitting `strength` must default to 1.0");
  await inject({ kind: "action", action: BOUND, pressed: false });
  await waitFor("bound_pressed", (v) => v === false, `${BOUND} must release again`);

  // 🔴 And the control proves the branch is PURE InputMap state: bp_probe_unbound has no
  // events bound to it at all, so nothing a real keyboard could do would press it — yet
  // action injection must, because it never goes near an InputEvent.
  await inject({ kind: "action", action: UNBOUND, pressed: true });
  await waitFor("unbound_pressed", (v) => v === true, `${UNBOUND} has NO bound events — action injection must press it anyway`);
  assert.equal(await read("bound_pressed"), false, `pressing ${UNBOUND} must not press ${BOUND}`);
  await inject({ kind: "action", action: UNBOUND, pressed: false });
  await waitFor("unbound_pressed", (v) => v === false, `${UNBOUND} must release`);
  assert.equal(await read("total_events"), 0, "none of the six action injections may have produced an InputEvent");
  console.log(`INPUT_LIVE_ACTION ok press/release x3, strength 0.6 and default 1.0, 1 edge, 0 events (${polls} poll(s))`);

  // ============================ 3. the `key` branch — delivery AND the pipeline ===
  // (a) An UNBOUND keycode. The event must arrive, and no action may move: this is the
  // half of the claim that isolates event delivery from InputMap routing.
  await inject({ kind: "key", keycode: KEY_J, pressed: true });
  injectedEvents++;
  await waitFor("key_count", (v) => v === 1, "a key injection must arrive as an InputEventKey");
  assert.equal(await read("last_keycode"), KEY_J, "the keycode the caller sent must be the keycode delivered");
  assert.equal(await read("last_key_pressed"), true, "pressed:true must arrive as a pressed key event");
  assert.equal(await read("bound_pressed"), false, `KEY_J is bound to nothing — it must not press ${BOUND}`);
  assert.equal(await read("unbound_pressed"), false, `KEY_J must not press ${UNBOUND} either`);

  // (b) `pressed:false` on the same keycode — a distinct field, not a default.
  await inject({ kind: "key", keycode: KEY_J, pressed: false });
  injectedEvents++;
  await waitFor("key_count", (v) => v === 2, "a key RELEASE must arrive as its own event");
  assert.equal(await read("last_key_pressed"), false, "pressed:false must arrive as a released key event");

  // (c) 🔴 THE BOUND KEYCODE. This is the assertion that proves the injection went through
  // the engine's REAL input pipeline: KEY_K is bp_probe_bound's only binding, so the
  // action can only go pressed if Input.parse_input_event fed the event to the InputMap.
  // An implementation that delivered events straight to listeners passes (a) and (b) and
  // fails here.
  await inject({ kind: "key", keycode: KEY_K, pressed: true });
  injectedEvents++;
  await waitFor("key_count", (v) => v === 3, "the bound keycode must also arrive as an event");
  assert.equal(await read("last_keycode"), KEY_K, "the bound keycode must be delivered unchanged");
  await waitFor(
    "bound_pressed",
    (v) => v === true,
    `KEY_K is ${BOUND}'s binding — a key injection must reach the InputMap, not just the listener`,
  );
  assert.equal(await read("unbound_pressed"), false, `${UNBOUND} has no binding and must stay released`);

  // ...and releasing the key releases the action, through the same route.
  await inject({ kind: "key", keycode: KEY_K, pressed: false });
  injectedEvents++;
  await waitFor("bound_pressed", (v) => v === false, "releasing the bound key must release the action");
  assert.equal(await read("key_count"), 4, "four key injections, four key events");
  console.log(`INPUT_LIVE_KEY ok unbound KEY_J delivered in isolation, bound KEY_K delivered AND routed to ${BOUND}`);

  // ==================== 4. `mouse_button` — index, pressed, and the position guard ===
  // (a) Everything supplied. RIGHT rather than LEFT because LEFT is the branch's own
  // default for `button`, so a reply that ignored the field would still look right.
  await inject({ kind: "mouse_button", button: 2, pressed: true, position: { __type__: "Vector2", x: 137, y: 91 } });
  injectedEvents++;
  await waitFor("button_count", (v) => v === 1, "a mouse_button injection must arrive as an InputEventMouseButton");
  assert.equal(await read("last_button"), 2, "the button index the caller sent must be the one delivered");
  assert.equal(await read("last_button_pressed"), true, "pressed:true must arrive pressed");
  assert.deepEqual(
    v2(await read("last_button_position"), "the delivered button position"),
    { x: 137, y: 91 },
    "`position` must survive Codec.decode into the event",
  );

  // (b) 🔴 THE GUARD'S OTHER OPERAND: no `position` at all. _inject_input only assigns
  // when the decoded value `is Vector2`, so the event must arrive at (0,0) — and an
  // implementation that carried the PREVIOUS position forward, or invented a default,
  // fails here and nowhere else. MIDDLE + released, so every field differs from (a).
  await inject({ kind: "mouse_button", button: 3, pressed: false });
  injectedEvents++;
  await waitFor("button_count", (v) => v === 2, "a mouse_button with no position must still be delivered");
  assert.equal(await read("last_button"), 3, "the second button index must be delivered too");
  assert.equal(await read("last_button_pressed"), false, "pressed:false must arrive released");
  assert.deepEqual(
    v2(await read("last_button_position"), "the position of a button event sent without one"),
    { x: 0, y: 0 },
    "with no `position` the guard must leave it at (0,0) — not carry (137,91) over from the previous event",
  );

  // (c) the `button` default. ev.get("button", 1) is only reachable by omitting it.
  await inject({ kind: "mouse_button", pressed: true });
  injectedEvents++;
  await waitFor("button_count", (v) => v === 3, "a mouse_button with no index must still be delivered");
  assert.equal(await read("last_button"), 1, "omitting `button` must default to 1 (LEFT)");
  console.log("INPUT_LIVE_BUTTON ok index+pressed+position forwarded, absent position stays (0,0), absent index defaults to 1");

  // ================== 5. `mouse_motion` — two INDEPENDENT decode guards ===
  // This branch has the same two-operand shape #154 §4 found in _node_add, doubled:
  // `position` and `relative` are guarded separately, so each must be reached with the
  // other absent. An implementation that decoded one field into both, or that applied one
  // guard's result to the other, passes any test that always sends both.

  // (a) both fields.
  await inject({
    kind: "mouse_motion",
    position: { __type__: "Vector2", x: 11, y: 22 },
    relative: { __type__: "Vector2", x: 3, y: 4 },
  });
  injectedEvents++;
  await waitFor("motion_count", (v) => v === 1, "a mouse_motion injection must arrive as an InputEventMouseMotion");
  assert.deepEqual(v2(await read("last_motion_position"), "motion position"), { x: 11, y: 22 }, "`position` must be decoded");
  assert.deepEqual(v2(await read("last_motion_relative"), "motion relative"), { x: 3, y: 4 }, "`relative` must be decoded");

  // (b) 🔴 relative ONLY. position must stay (0,0) — not repeat (11,22), and not mirror
  // the relative that WAS sent.
  await inject({ kind: "mouse_motion", relative: { __type__: "Vector2", x: 7, y: 9 } });
  injectedEvents++;
  await waitFor("motion_count", (v) => v === 2, "a motion with only `relative` must still be delivered");
  assert.deepEqual(v2(await read("last_motion_relative"), "motion relative"), { x: 7, y: 9 }, "`relative` alone must be decoded");
  assert.deepEqual(
    v2(await read("last_motion_position"), "motion position"),
    { x: 0, y: 0 },
    "with no `position` the guard must leave it at (0,0) — the two fields are decoded independently",
  );

  // (c) 🔴 and position ONLY, the mirror image.
  await inject({ kind: "mouse_motion", position: { __type__: "Vector2", x: 55, y: 66 } });
  injectedEvents++;
  await waitFor("motion_count", (v) => v === 3, "a motion with only `position` must still be delivered");
  assert.deepEqual(v2(await read("last_motion_position"), "motion position"), { x: 55, y: 66 }, "`position` alone must be decoded");
  assert.deepEqual(
    v2(await read("last_motion_relative"), "motion relative"),
    { x: 0, y: 0 },
    "with no `relative` the guard must leave it at (0,0) — it must not fall back to `position`",
  );
  console.log("INPUT_LIVE_MOTION ok position+relative decoded independently, each proved with the other absent");

  // ================================ 6. the count is EXACT, not monotonic ===
  // 🔴 Ten injections, ten events, and the three per-kind counters must account for all of
  // them. This is what turns every "count went up" above into "exactly this happened":
  // a duplicated delivery, a stray event from somewhere else in the engine, and an
  // `action` injection that quietly synthesised a key event are all failures here.
  const totals = await snap("total_events", "key_count", "button_count", "motion_count");
  assert.equal(
    totals.total_events,
    injectedEvents,
    `exactly ${injectedEvents} events were injected — the fixture saw ${totals.total_events}, so something ` +
      `either duplicated a delivery or produced an event this probe did not send`,
  );
  assert.equal(
    totals.key_count + totals.button_count + totals.motion_count,
    totals.total_events,
    `the per-kind counters must account for every event: ${JSON.stringify(totals)}`,
  );
  assert.deepEqual(
    { key: totals.key_count, button: totals.button_count, motion: totals.motion_count },
    { key: 4, button: 3, motion: 3 },
    `each kind must have been delivered as ITS OWN class of event: ${JSON.stringify(totals)}`,
  );
  console.log(`INPUT_LIVE_EXACT ok ${injectedEvents} injected = ${totals.total_events} delivered (key 4 / button 3 / motion 3)`);

  // ================================================ 7. leave it pristine ===
  // #146's rule: state left behind by a probe is a defect even when nothing is currently
  // failing. Action state is PROCESS-WIDE and outlives this probe — a bp_probe_bound left
  // pressed would be inherited by anything that ran next against the same game, which is
  // exactly the kind of contamination #154 built a scriptless fixture to avoid.
  for (const action of [BOUND, UNBOUND]) {
    assert.equal(await read(action === BOUND ? "bound_pressed" : "unbound_pressed"), false, `${action} must be left released`);
    near(await read(action === BOUND ? "bound_strength" : "unbound_strength"), 0.0, `${action} must be left at zero strength`);
  }
  // The fixture itself survived, and is still the thing this probe thought it was.
  await call("runtime_assert_scene_structure", { expect: [{ path: ".", type: "Node2D" }] });
  console.log(`INPUT_LIVE_PRISTINE ok ${BOUND} and ${UNBOUND} both released at zero strength, fixture intact`);

  console.log(
    `INPUT_LIVE_RESULT kinds=action+key+mouse_button+mouse_motion rejects=bad_kind x3+bad_action x2 ` +
      `guards=position/relative independent routing=key->InputMap events=${injectedEvents}/${injectedEvents}`,
  );
  console.log("✔ input injection verified against a real running game");
  runtime.close();
} catch (err) {
  console.error(`::error::inject-input probe failed: ${err?.message ?? String(err)}`);
  console.error(err?.stack ?? "");
  runtime.close();
  process.exit(1);
}

console.log("✔ inject-input integration OK");

// Runtime-plane integration probe (D6) — connects to the REAL example GAME
// (booted headless by the workflow) via its in-game BreakpointRuntimeBridge autoload
// on :9081, and proves the one thing no unit test can: a live engine's print()
// is captured into runtime_get_log through the scriptable Logger (Godot 4.5+).
//
// It drives the host's OWN runtime tools (registerRuntimeTools) against the live
// game — the CLI-plane pattern, but for Plane C — so the host<->engine path is
// exercised end-to-end, not just the raw socket. A direct BridgeClient ping is
// used only for the reachability gate and to read the capture flag.
//
// Version-aware, so a single probe is correct across the whole matrix:
//   * Godot >= 4.5 (log_capture true)  — the print() MUST appear in runtime_get_log.
//   * Godot <  4.5 (log_capture false) — capture is a documented no-op: the print()
//     must NOT appear, but push_log() entries still must (runtime_get_log works).
//
// Markers (grep-able): D6_CAP_PING / D6_CAP_LOG / D6_CAP_CALL / D6_CAP_RESULT.
// The reachability check is the gate (exit 1 if the runtime bridge is unreachable).
//
// Requires the game running (booted by the workflow) with GODOT_PROJECT set. Not
// part of `npm test` (Godot-free); invoked directly by integration.yml.
import { Population } from "./_population.mjs";

// 🔴 THE CLAIM POPULATION, COUNTED (169 §10 item 2). Three assertions behind a ✔,
// and they live in a TWO-ARMED conditional: >=4.5 captures print(), <4.5 does not.
// Both arms make three claims, so one family and one floor cover both — and an arm
// that quietly stopped asserting is exactly what this catches.
// 🆕 209 — D1A_ECHO joins it. The engine-error echo has TWO arms of its own and
// they do not line up with D6's: `push_log` reaches the ring on EVERY version, so
// the "a call that provoked something carries it" claim is version-independent,
// while `push_error` reaches it only through the 4.5+ Logger — which is what makes
// the SAME probe able to assert the feature on new engines and its DELIBERATE
// silence on old ones. Both arms make five claims, so one floor covers both, and
// an arm that quietly stopped asserting is what that floor catches.
const population = new Population("D6_CAP", {
  families: ["D6_CAP_RESULT", "D1A_ECHO_RESULT"],
  scope: 1,
  claims: 8,
});
const assert = population.assert;
import { BridgeClient } from "../dist/bridge.js";
import { loadConfig } from "../dist/config.js";
import { registerRuntimeTools } from "../dist/tools/runtime.js";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const cfg = loadConfig();
console.log(`D6 runtime capture probe -> runtime bridge ${cfg.runtimeHost}:${cfg.runtimePort}  project=${cfg.projectPath}`);

// Register the runtime tools against a live runtime BridgeClient, exactly the way
// index.ts wires Plane C. elicitInput is never reached (we pass confirm:true).
const runtime = new BridgeClient(cfg.runtimeHost, cfg.runtimePort, 15000, "runtime bridge", "Is the example game running?");
const tools = new Map();
const server = {
  registerTool: (name, _c, handler) => tools.set(name, handler),
  registerResource: () => {},
  server: { elicitInput: async () => ({ action: "decline" }) },
};
// F6 gave registerRuntimeTools a third parameter — the PeerRegistry behind runtime_spawn_peers.
// This probe is single-game by construction (no call below passes `peer`), so it wires a registry
// that refuses to be reached rather than a real one: an edit that later adds a `peer` call here
// fails with a sentence naming the cause instead of a TypeError on `undefined`.
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
const call = async (name, args = {}) => {
  const h = tools.get(name);
  if (!h) throw new Error(`tool not registered: ${name}`);
  const res = await h(args, {});
  if (res.isError) throw new Error(res.content?.[0]?.text ?? `tool ${name} failed`);
  return res.structuredContent ?? {};
};

// Gate: the runtime bridge must be reachable. ensureConnected() retries and never
// rejects, so prove reachability with a real ping — and read the capture flag.
let capture = false;
try {
  await runtime.ensureConnected();
  const pong = await runtime.request("ping", {}, 20000);
  capture = pong?.log_capture === true;
  console.log(`D6_CAP_PING ok runtime=${pong?.runtime} godot=${pong?.godot ?? "?"} log_capture=${pong?.log_capture}`);
} catch (err) {
  console.error("✘ could not reach the runtime bridge:", err?.message ?? String(err));
  runtime.close();
  process.exit(1);
}

// Baseline the log (the autoload's startup + the scene's _ready already pushed a few).
const before = await call("runtime_get_log", { since_seq: 0 });
const baseSeq = Number(before.latest_seq ?? 0);
console.log(`D6_CAP_LOG capture=${before.capture} latest_seq=${baseSeq} entries=${before.entries?.length ?? 0}`);

// Actively drive a fresh print() through the live game. Main (player.gd) has
// take_damage(amount): it print()s "[example] took N damage, counter now M" (a
// print — captured only via the Logger) AND push_log()s a "took N damage"
// warning (present on every version). confirm:true bypasses the destructive gate.
const dmg = await call("runtime_call_method", { path: ".", method: "take_damage", args: [7], confirm: true });
console.log(`D6_CAP_CALL take_damage(7) -> ${JSON.stringify(dmg.return ?? dmg)}`);
await delay(400);

const after = await call("runtime_get_log", { since_seq: baseSeq });
const entries = after.entries ?? [];
const printLine = entries.find((e) => String(e.message).includes("took 7 damage, counter now"));
const pushLine = entries.find((e) => e.level === "warning" && String(e.message).includes("took 7 damage"));

population.open("D6_CAP_RESULT");
if (capture) {
  // Godot >= 4.5: the print() must have been captured into the runtime log.
  assert.equal(after.capture, true, "runtime_get_log should report capture=true on a >=4.5 engine");
  assert.ok(printLine, "expected the print() line to be captured into runtime_get_log");
  assert.equal(printLine.level, "info", "a captured print() should land at info level");
  console.log(`D6_CAP_RESULT engine=capture captured_print_seq=${printLine.seq}`);
  console.log("✔ live print() reached runtime_get_log via the D6 Logger capture");
} else {
  // Godot < 4.5: capture is a documented no-op. print() must NOT be captured,
  // but push_log() entries still must — runtime_get_log keeps working.
  assert.equal(after.capture, false, "runtime_get_log should report capture=false on a <4.5 engine");
  assert.ok(!printLine, "on <4.5 the print() must NOT be captured (no scriptable Logger)");
  assert.ok(pushLine, "the push_log() warning must still be present on <4.5");
  console.log(`D6_CAP_RESULT engine=no-capture push_log_seq=${pushLine.seq}`);
  console.log("✔ capture no-ops cleanly on <4.5; runtime_get_log still serves push_log entries");
}

// ── 🆕 209 — D1a: THE ENGINE-ERROR ECHO, BOTH DIRECTIONS ─────────────────────────────
// 🔴 THE SECOND CALL IS THE ONE THAT MATTERS. Asserting only that a provoking call
// carries an echo cannot tell attribution from "always attach the tail of the ring" —
// both look identical on a game that has logged anything at all. A call that provokes
// NOTHING must come back with the field ABSENT, and that pair is the whole claim.
const quiet = await call("runtime_get_monitors", { keys: ["time/fps"] });
const loud = await call("runtime_call_method", { path: ".", method: "take_damage", args: [3], confirm: true });
await delay(200);
const provoked = await call("runtime_call_method", { path: ".", method: "provoke_engine_error", confirm: true });

population.open("D1A_ECHO_RESULT");
// 1-2. Attribution, on every engine: `take_damage` push_log()s a WARNING, so its own
// response must carry it — while a monitor read, which provokes nothing, must not.
assert.equal(quiet.engine_log, undefined,
  "a call that provoked nothing must OMIT engine_log entirely — absent, not an empty list");
assert.ok(loud.engine_log, "take_damage push_log()s a warning, so its own response must carry engine_log");
const warned = (loud.engine_log.entries ?? []).find(
  (e) => e.level === "warning" && String(e.message).includes("took 3 damage"));
assert.ok(warned, "the echo must carry THIS call's warning, not some earlier entry");
// 3. `total` is not the capped list's length — it is what actually happened.
assert.ok(loud.engine_log.total >= loud.engine_log.entries.length,
  "total must be >= the capped entries it summarises");
// 4. The window is the caller's, stated: everything echoed was appended after it.
assert.ok(loud.engine_log.entries.every((e) => e.seq > loud.engine_log.since_seq),
  "every echoed entry must post-date the since_seq the response reports");

// 5. THE VERSION ARM. `push_error` is an ENGINE error, not a push_log, so it reaches
// the ring only through the 4.5+ scriptable Logger.
if (capture) {
  const err = (provoked.engine_log?.entries ?? []).find(
    (e) => e.level === "error" && String(e.message).includes("deliberate engine error"));
  assert.ok(err, "on >=4.5 a push_error during the call must reach that call's own engine_log");
  console.log(`D1A_ECHO_RESULT engine=capture provoked_seq=${err.seq} total=${provoked.engine_log.total}`);
  console.log("✔ a push_error reached the response of the call that caused it, and isError stayed false");
} else {
  assert.equal(provoked.engine_log, undefined,
    "on <4.5 there is no scriptable Logger, so a push_error reaches nothing and the field must be ABSENT");
  console.log(`D1A_ECHO_RESULT engine=no-capture provoked=${JSON.stringify(provoked.return ?? provoked)}`);
  console.log("✔ the echo degrades to silence on <4.5 rather than to something wrong");
}

runtime.close();
population.reportOrDie();
console.log("✔ runtime-plane integration OK");

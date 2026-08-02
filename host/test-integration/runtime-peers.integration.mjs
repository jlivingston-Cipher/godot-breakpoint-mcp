// Multi-peer convergence integration probe (F6) — spawns REAL headless Godot children through
// the shipped PeerRegistry and drives the shipped runtime tool handlers against them, so the
// convergence claim in runtime_peers_digest's description is CI-enforced rather than validated
// once by hand.
//
// This is the one probe with no game booted for it: runtime_spawn_peers boots its own children,
// each on an allocated loopback port, authenticating with the host-minted project secret against
// the real bridge_secret.gd. Nothing here is mocked below the tool handler.
//
// What it pins, in order:
//   1. runtime_spawn_peers{count:3} returns three READY peers on three distinct ports.
//   2. While frozen, `idle_ticks` keeps climbing and `ticks` holds — the mechanism behind
//      precondition 2. time_scale 0 zeroes delta; it does NOT stop callbacks firing, so the
//      `delta > 0` guard in the probe scene is what keeps the global RNG stream untouched.
//   3. Freeze -> equalise -> seed -> step{kind:"physics"} converges BYTE-EQUAL across three real
//      processes, under a deliberately adversarial stagger between each peer's seed and its step
//      (far worse than any real latency). This is the positive control, and it fails if the probe
//      scene ever loses its `delta > 0` guard or moves its idle lane onto the global stream.
//   4. The NEGATIVE control: skew one peer's state and runtime_peers_digest must report
//      converged:false with diverged_at naming exactly the node that disagrees. A convergence
//      check that cannot report divergence verifies nothing.
//   5. The ceiling holds against real processes, runtime_peer_stop kills a real child, a stopped
//      peer reports peer_stopped rather than a generic unreachable-bridge error, and stopping
//      twice is a no-op.
//
// Markers (grep-able): F6_PEERS_SPAWN / F6_PEERS_FROZEN / F6_PEERS_EQUALISE / F6_PEERS_STEP /
// F6_PEERS_CONVERGE / F6_PEERS_DIVERGE / F6_PEERS_CEILING / F6_PEERS_STOP / F6_PEERS_RESULT.
// Exit status is the gate (the peers-plane job in integration.yml).
//
// Requires GODOT_BIN and GODOT_PROJECT. Boots no game of its own and needs no editor.
// Not part of `npm test` (which is Godot-free).
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
// 🔴 THE REACHABILITY BANNER (`F6_PEERS_PING`) IS DELIBERATELY NOT A FAMILY. It
// asserts nothing — the gate is a throw — so sealing it would fire VACUOUS on a
// healthy run, and a gate that cries wolf on green is a gate that gets deleted.
const population = new Population("F6_PEERS", {
  families: [
    "F6_PEERS_EQUALISE", "F6_PEERS_STEP", "F6_PEERS_DIVERGE", "F6_PEERS_CEILING",
    "F6_PEERS_STOP",
  ],
  scope: 5,
  claims: 30,         // 🔴 EXACT — 30 on local 4.7 and CI 4.3 / 4.7
});
const assert = population.assert;
import { loadConfig } from "../dist/config.js";
import { PeerRegistry } from "../dist/peers.js";
import { registerRuntimeTools } from "../dist/tools/runtime.js";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/** How many peers to converge. Three, not two: two agreeing can be a coincidence of a shared
 *  default, three agreeing after independent stepping is the claim. */
const PEER_COUNT = 3;
/** Physics frames each peer steps. Enough draws off the global stream that an off-by-one in
 *  consumption is certain to show, small enough to stay quick on a runner. */
const FRAMES = 30;
const SEED = 12345;
/** Deliberately adversarial gap inserted between peers' seed calls, so each peer sits frozen for
 *  a DIFFERENT stretch between being seeded and being stepped. §4 of the session-126 handoff
 *  measured convergence surviving this; anything real latency produces is far smaller. */
const STAGGER_MS = 250;
const PROBE_SCENE = "res://tests/peer_converge_probe.tscn";

const cfg = loadConfig();
console.log(`F6 peers probe -> godot=${cfg.godotBin} project=${cfg.projectPath} base runtime port=${cfg.runtimePort}`);

// Register the runtime tools exactly the way toolsets.ts wires Plane C, but against a REAL
// PeerRegistry. The default-game client is a stub that is never dialled: every call below passes
// `peer`, and runtime_spawn_peers / runtime_peer_stop / runtime_peers_digest never touch it.
const peers = new PeerRegistry(cfg);
const unreachableDefaultGame = {
  request: async () => {
    throw new Error("the default running game must not be dialled by this probe — every call passes `peer`");
  },
  ensureConnected: async () => {},
  close: () => {},
};
const tools = new Map();
const server = {
  registerTool: (name, _c, handler) => tools.set(name, handler),
  registerResource: () => {},
  // Never reached: every gated call below passes confirm:true.
  server: { elicitInput: async () => ({ action: "decline" }) },
};
// 🔴 `cfg` IS THE FOURTH ARGUMENT AS OF 1.43.0. These probes call the registrar
// DIRECTLY, so TypeScript cannot see them: adding a parameter compiled clean and
// broke six CI jobs at runtime with "Cannot read properties of undefined". A .mjs
// call site is a call site.
registerRuntimeTools(server, unreachableDefaultGame, peers, cfg);

const raw = async (name, args = {}) => {
  const h = tools.get(name);
  if (!h) throw new Error(`tool not registered: ${name}`);
  return h(args, {});
};
const textOf = (res) => res?.content?.[0]?.text ?? "";
const call = async (name, args = {}) => {
  const res = await raw(name, args);
  if (res.isError) throw new Error(`tool ${name} failed: ${textOf(res)}`);
  return res.structuredContent ?? {};
};

/** Stable key-ordered JSON, so "byte-equal" is compared as a value rather than as whatever key
 *  order happened to come off the wire. */
const canonical = (v) => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
};

const vec2 = (x, y) => ({ __type__: "Vector2", x, y });
const propOf = async (peer, property, path = ".") =>
  Number((await call("runtime_get_property", { path, property, peer })).value);

let ids = [];
let failed = false;

try {
  // ---------------------------------------------------------------- 1. spawn
  const spawned = await call("runtime_spawn_peers", {
    count: PEER_COUNT,
    scene: PROBE_SCENE,
    role: "converge",
    // Three headless Godot boots on a cold CI runner are slower than a developer laptop.
    timeout_ms: 60000,
  });
  ids = spawned.peers.map((p) => p.id);
  const ports = spawned.peers.map((p) => p.port);
  console.log(`F6_PEERS_SPAWN count=${spawned.count} ids=${ids.join(",")} ports=${ports.join(",")}`);
  assert.equal(spawned.count, PEER_COUNT, `expected ${PEER_COUNT} peers, got ${spawned.count}`);
  assert.ok(spawned.peers.every((p) => p.ready), "every peer must have answered ping before spawn returned");
  assert.equal(new Set(ports).size, PEER_COUNT, `peers must hold distinct ports, got ${ports.join(",")}`);
  assert.ok(!ports.includes(cfg.runtimePort), "the allocator must skip the default runtime port");

  // ------------------------------------------- 2. FREEZE FIRST (precondition 3)
  for (const peer of ids) await call("runtime_time_scale", { scale: 0, confirm: true, peer });

  // The mechanism behind precondition 2, asserted rather than asserted-about: across a frozen
  // window the idle lane keeps firing (so anything it draws would come off the global stream at
  // wall-clock rate) while the delta-guarded physics lane records nothing.
  const before = [];
  for (const peer of ids) before.push({ ticks: await propOf(peer, "ticks"), idle: await propOf(peer, "idle_ticks") });
  await delay(400);
  for (let i = 0; i < ids.length; i++) {
    const ticks = await propOf(ids[i], "ticks");
    const idle = await propOf(ids[i], "idle_ticks");
    console.log(
      `F6_PEERS_FROZEN ${ids[i]} ticks ${before[i].ticks} -> ${ticks} (must hold) · idle_ticks ${before[i].idle} -> ${idle} (must climb)`,
    );
    assert.equal(ticks, before[i].ticks, `${ids[i]}: the delta-guarded physics lane advanced while frozen`);
    assert.ok(
      idle > before[i].idle,
      `${ids[i]}: idle callbacks stopped while frozen — the whole reason precondition 2 exists is that they do NOT`,
    );
  }

  // ------------------------------------------ 3. equalise, then seed + step
  // Peers free-ran for different durations between spawning and being frozen, so their state
  // already differs. runtime_set_property{peer} is what equalises it — the tool the originally
  // scoped seven-tool `peer` list omitted, which is why `peer` is accepted by all 24 instead.
  for (const peer of ids) {
    await call("runtime_set_property", { path: ".", property: "position", value: vec2(0, 0), confirm: true, peer });
    await call("runtime_set_property", { path: ".", property: "rotation", value: 0, confirm: true, peer });
    await call("runtime_set_property", { path: ".", property: "ticks", value: 0, confirm: true, peer });
    await call("runtime_set_property", { path: "Marker", property: "position", value: vec2(0, 0), confirm: true, peer });
  }
  population.seal("F6_PEERS_EQUALISE", `${ids.length} peer(s) reset to a common starting state while frozen`);

  for (const peer of ids) {
    await call("runtime_seed_rng", { seed: SEED, confirm: true, peer });
    await delay(STAGGER_MS);
  }
  for (const peer of ids) {
    const step = await call("runtime_step_frames", { frames: FRAMES, kind: "physics", confirm: true, peer });
    assert.equal(Number(step.frames_advanced), FRAMES, `${peer}: step_frames reported ${step.frames_advanced}`);
  }
  for (const peer of ids) {
    const ticks = await propOf(peer, "ticks");
    assert.equal(ticks, FRAMES, `${peer}: expected exactly ${FRAMES} guarded physics frames, got ${ticks}`);
  }
  population.seal("F6_PEERS_STEP", `each peer advanced exactly ${FRAMES} physics frames (seed ${SEED}, ${STAGGER_MS}ms stagger)`);

  // ------------------------------------------------- 4. the positive control
  const conv = await call("runtime_peers_digest", { root: "." });
  const shapes = conv.digests.map((d) => canonical(d.digest));
  console.log(
    `F6_PEERS_CONVERGE converged=${conv.converged} peers=${conv.digests.map((d) => d.id).join(",")} nodes=${conv.digests[0]?.node_count}`,
  );
  assert.equal(conv.digests.length, PEER_COUNT, "every live peer must appear in the digest");
  assert.equal(conv.converged, true, `peers diverged: ${JSON.stringify(conv.diverged_at)}`);
  assert.equal(conv.diverged_at, null, "converged runs must report diverged_at null");
  assert.equal(new Set(shapes).size, 1, "digests must be byte-equal, not merely reported as converged");
  assert.ok(Number(conv.digests[0]?.node_count) >= 2, "the probe scene must digest more than its root");

  // ------------------------------------------------- 5. the negative control
  // Skew ONE peer at ONE node. Everything else is untouched and still frozen, so the check has to
  // report divergence and name that node — and only that node.
  await call("runtime_set_property", {
    path: "Marker",
    property: "position",
    value: vec2(999, 0),
    confirm: true,
    peer: ids[0],
  });
  const div = await call("runtime_peers_digest", { root: "." });
  population.seal("F6_PEERS_DIVERGE", `converged=${div.converged} diverged_at=${JSON.stringify(div.diverged_at)}`);
  assert.equal(div.converged, false, "a skewed peer must NOT be reported as converged");
  assert.ok(Array.isArray(div.diverged_at) && div.diverged_at.includes("Marker"), "diverged_at must name the skewed node");
  assert.ok(!div.diverged_at.includes("."), "diverged_at must not name the nodes that still agree");

  // ------------------------------------------------------------ 6. the ceiling
  const over = await raw("runtime_spawn_peers", { count: PEER_COUNT, scene: PROBE_SCENE });
  population.seal("F6_PEERS_CEILING", `${PEER_COUNT} live + ${PEER_COUNT} more -> ${over.isError ? "refused" : "ALLOWED"}`);
  assert.ok(over.isError, `the ceiling must refuse a spawn past ${PEER_COUNT} live peers`);
  assert.match(textOf(over), /ceiling/i, "the refusal must explain the ceiling");

  // ------------------------------------- 7. stop a real child, then address it
  const stopped = await call("runtime_peer_stop", { id: ids[2] });
  assert.deepEqual(stopped.stopped, [ids[2]], `runtime_peer_stop returned ${JSON.stringify(stopped.stopped)}`);
  const dead = await raw("runtime_get_property", { path: ".", property: "ticks", peer: ids[2] });
  assert.ok(dead.isError, "a stopped peer must not answer");
  assert.match(textOf(dead), /stopped/i, "a stopped peer must say so, not report a generic unreachable bridge");
  const again = await call("runtime_peer_stop", { id: ids[2] });
  population.seal("F6_PEERS_STOP", `${ids[2]} stopped, reports "${textOf(dead).slice(0, 60)}…", repeat stop = no-op`);
  assert.ok(Array.isArray(again.stopped), "stopping an already-stopped peer must be a no-op, not an error");

  console.log(
    `F6_PEERS_RESULT ${PEER_COUNT} real peers converged byte-equal over ${FRAMES} physics frames under a ${STAGGER_MS}ms stagger; ` +
      `divergence detected and localised; ceiling, stop and idempotent-stop held`,
  );
  console.log("✔ multi-peer convergence integration OK");
} catch (err) {
  failed = true;
  console.error("✘ multi-peer convergence integration FAILED:", err?.message ?? String(err));
  // A peer that never became ready carries its own stderr; a peer that misbehaved has a log.
  for (const p of peers.all()) console.error(`   peer ${p.id} port=${p.port} pid=${p.pid} ready=${p.ready}`);
} finally {
  peers.stopAll();
}

// 🔴 THE POPULATION GATE, outside the try/catch: the run that shrank the suite is
// exactly the run that will not reach a check placed inside it. Only consulted on a
// run that otherwise passed — a failed run already exits non-zero and its population
// is not the interesting fact about it.
if (!failed) population.reportOrDie();

// Explicit: peer children hold piped stdio, so an unreaped one would otherwise keep the event
// loop — and a CI runner — alive long after the assertions are done.
process.exit(failed ? 1 : 0);

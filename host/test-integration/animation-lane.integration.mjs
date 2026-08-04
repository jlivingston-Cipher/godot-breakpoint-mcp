// Animation-lane integration probe — drives the three runtime animation tools against
// a REAL running game over the in-game runtime autoload:
//
//   runtime_anim_play · runtime_anim_stop · runtime_anim_get_state
//
// WHY THIS EXISTS
// ---------------
// The §6.5 audit that followed #152 walked all 27 tools in host/src/tools/runtime.ts
// against host/test-integration/ and found nine with no live coverage at all. This lane
// was the largest, and the reason it went unnoticed for so long is the same reason
// _assert_screen_text's positive path went unnoticed until #152: THE FIXTURE DID NOT
// EXIST. No scene in this repository contained an AnimationPlayer — not main.tscn, not
// render_probe, not frame_step_probe, not peer_converge_probe, not verify_probe — so
// _resolve_anim_player, _anim_state, _anim_play and _anim_stop had never executed
// anywhere, on any machine. A mocked-bridge unit test proves the host forwards
// runtime.anim_play and parses the reply; it cannot reach a single line of that.
//
// The authoring plane's AUTH_ANIM_* markers are a DIFFERENT lane — editor-side
// animation authoring against an edited scene — and are what makes this gap look
// covered to a grep.
//
// THE CLAIM THIS JOB IS HERE TO SETTLE
// ------------------------------------
// _anim_stop carries a comment justifying its API choice on cross-version grounds:
//
//     keep_state:true pauses in place; default stops. pause()/stop() with no args are
//     stable across Godot 4.2-4.5 (unlike stop()'s changing keep_state parameter).
//
// That is an assertion about three engine versions, written down and never executed on
// any of them. This probe runs on the runtime-plane matrix — 4.3, 4.5 and 4.7 — and the
// pause/stop contrast below is what turns the comment into a checked fact.
//
// WHAT MAKES IT COVERAGE RATHER THAN GREEN
// ----------------------------------------
// Every behaviour is asserted in BOTH directions; a tool hard-coded to a plausible
// reply passes a green-only suite completely. Four checks go further and are
// unsatisfiable by a static implementation at all:
//
//   * The animation MOVES A NODE. Marker's position is read through
//     runtime_get_property and must advance while drift plays — so "playing:true" in a
//     reply is not enough, the SceneTree has to actually change.
//   * pause vs stop is read off the POSITION the tool itself returns: pause must leave
//     it where it was (>0) and stop must reset it to 0. An implementation that ignored
//     keep_state and called stop() both times passes neither direction.
//   * custom_speed is measured, not trusted: the same animation over the same
//     wall-clock window at 8x must advance multiples further than at 1x.
//   * from_end is proved on the NON-LOOPING animation, where starting at the end is
//     observable as position==length with playing==false, against a normal play of the
//     same animation that sits at position 0 and playing==true.
//
// Markers (grep-able): ANIM_LIVE_PING / _STATE / _ERRORS / _PLAY / _DRIVES / _PAUSE /
// _RESUME / _STOP / _SWITCH / _SPEED / _FROM_END / _LEFT_CLEAN / _RESULT.
//
// Requires res://tests/anim_probe.tscn running with GODOT_PROJECT set and
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
// 🔴 THE REACHABILITY BANNER (`ANIM_LIVE_PING`) IS DELIBERATELY NOT A FAMILY. It
// asserts nothing — the gate is a throw — so sealing it would fire VACUOUS on a
// healthy run, and a gate that cries wolf on green is a gate that gets deleted.
const population = new Population("ANIM_LIVE", {
  families: [
    "ANIM_LIVE_STATE", "ANIM_LIVE_ERRORS", "ANIM_LIVE_PLAY", "ANIM_LIVE_DRIVES",
    "ANIM_LIVE_PAUSE", "ANIM_LIVE_RESUME", "ANIM_LIVE_STOP", "ANIM_LIVE_SWITCH",
    "ANIM_LIVE_SPEED", "ANIM_LIVE_FROM_END",
    // 🔴 184 §4: THE "LEFT CLEAN" SECTION WAS SEALED BY NOTHING, so its six claims — the
    // #146 restore check, the one that stops this probe leaving a frozen clock behind for
    // whatever runs next — belonged to no family, counted toward `claims: 61`, and were
    // reported only as an `unsealed=` number no gate read. Delete all six and the total
    // fell to 55 against a floor of 61, which the FLOOR would have caught; delete five of
    // six and nothing anywhere noticed. It is a section, so it is sealed like one.
    "ANIM_LIVE_LEFT_CLEAN",
  ],
  scope: 11,
  claims: 61,         // 🔴 EXACT — 61 on local 4.7 and CI 4.3 / 4.5 / 4.7, four environments, one number
});
const assert = population.assert;
import { BridgeClient } from "../dist/bridge.js";
import { loadConfig } from "../dist/config.js";
import { registerRuntimeTools } from "../dist/tools/runtime.js";

const cfg = loadConfig();
console.log(`animation-lane probe -> runtime bridge ${cfg.runtimeHost}:${cfg.runtimePort}  project=${cfg.projectPath}`);

// Mirrors example/tests/anim_probe.gd. If those drift apart the gate below says so by
// name rather than failing six sections later on an arithmetic surprise.
const DRIFT = "drift";
const STILL = "still";
const DRIFT_LENGTH = 8.0;
const STILL_LENGTH = 4.0;

// Register the runtime tools against a live runtime BridgeClient, exactly the way
// index.ts wires Plane C — so the host<->engine path is exercised end to end, not just
// the raw socket. elicitInput is never reached (every mutating call passes confirm).
const runtime = new BridgeClient(cfg.runtimeHost, cfg.runtimePort, 15000, "runtime bridge", "Is the anim probe scene running?");
const tools = new Map();
const server = {
  registerTool: (name, _c, handler) => tools.set(name, handler),
  registerResource: () => {},
  server: { elicitInput: async () => ({ action: "decline" }) },
};
// Single-game by construction: no call below passes `peer`, so a registry that refuses
// to be reached turns a later edit that forgets that into a sentence naming the cause
// rather than a TypeError on `undefined`.
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

/** Marker's x, through the read tool — the scene-side view of whether anything moved. */
const markerX = async () => (await call("runtime_get_property", { path: "Marker", property: "position" })).value?.x ?? 0;

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
  console.log(`ANIM_LIVE_PING ok runtime=${pong?.runtime} godot=${pong?.godot ?? "?"}`);
} catch (err) {
  die(`could not reach the runtime bridge: ${err?.message ?? String(err)}`);
}

try {
  // ============================================ 0. the fixture is the fixture ===
  // The runtime autoload opens its port in _ready(), which runs BEFORE the main
  // scene's _ready() builds the animation library. That is a real race on a fast
  // runner, so wait for the library rather than assuming it — and say which of the two
  // failures happened if it never arrives.
  let boot = null;
  for (let i = 0; i < 40; i++) {
    boot = await raw("runtime_anim_get_state", { path: "Anim" });
    if (!boot.isError && (boot.structuredContent?.animations?.length ?? 0) === 2) break;
    await sleep(250);
  }
  if (boot?.isError) {
    die(
      `no AnimationPlayer at 'Anim' (${errText(boot)}) — boot with 'res://tests/anim_probe.tscn'; ` +
        `every assertion below assumes that scene`,
    );
  }
  const atBoot = boot.structuredContent ?? {};
  if ((atBoot.animations?.length ?? 0) !== 2) {
    die(`anim_probe.gd never registered its library (animations=${JSON.stringify(atBoot.animations)})`);
  }

  // _anim_state reads the REAL library off the live player. A canned reply would not
  // know these two names, and an implementation that lost add_animation_library would
  // return an empty list while every other assertion here still passed.
  assert.deepEqual([...atBoot.animations].sort(), [DRIFT, STILL], "the fixture registers exactly drift and still");
  assert.equal(atBoot.playing, false, "nothing should be playing at boot");
  assert.equal(atBoot.current_animation, "", "no animation is assigned at boot");
  assert.equal(atBoot.position, 0, "position is 0 before anything plays");
  assert.equal(atBoot.length, 0, "length is 0 while no animation is assigned");
  assert.equal(await markerX(), 0, "Marker starts at x=0; the animation has not run");
  population.seal("ANIM_LIVE_STATE", `ok animations=[${[...atBoot.animations].sort().join(",")}] idle at 0`);

  // ==================================================== 1. the error branches ===
  // _resolve_anim_player has two rejections and they are NOT the same rejection: a
  // missing node is bad_path, a present-but-wrong node is not_animation_player. All
  // three tools go through it, so all three are checked — a guard added to one and
  // forgotten in another is exactly the kind of drift a single spot-check misses.
  for (const tool of ["runtime_anim_get_state", "runtime_anim_play", "runtime_anim_stop"]) {
    const missing = await raw(tool, { path: "NoSuchNode9137", confirm: true });
    assert.equal(missing.isError, true, `${tool} against a node that does not exist must be an error`);
    assert.match(errText(missing), /bad_path/, `${tool}: expected bad_path, got ${errText(missing)}`);

    // NotAPlayer exists and is a Node2D. If this came back bad_path the type guard is
    // not being reached at all; if it came back ok the guard is not there.
    const wrongType = await raw(tool, { path: "NotAPlayer", confirm: true });
    assert.equal(wrongType.isError, true, `${tool} against a non-AnimationPlayer must be an error`);
    assert.match(
      errText(wrongType),
      /not_animation_player/,
      `${tool}: a Node2D is present but is not an AnimationPlayer — expected not_animation_player, got ${errText(wrongType)}`,
    );
  }

  // has_animation() guards play. Without it Godot would accept the name silently and
  // play nothing, which reads as a green call that did nothing at all.
  const noAnim = await raw("runtime_anim_play", { path: "Anim", animation: "nope9137", confirm: true });
  assert.equal(noAnim.isError, true, "playing an animation the library does not hold must be an error");
  assert.match(errText(noAnim), /no_animation/, `expected no_animation, got ${errText(noAnim)}`);
  population.seal("ANIM_LIVE_ERRORS", "ok bad_path / not_animation_player on all three tools, no_animation on play");

  // ===================================== 2. play, and prove it actually plays ===
  const played = await call("runtime_anim_play", { path: "Anim", animation: DRIFT, confirm: true });
  assert.equal(played.playing, true, "the player should report playing after a successful play");
  assert.equal(played.current_animation, DRIFT, "the reply should name the animation that was started");

  const playing = await call("runtime_anim_get_state", { path: "Anim" });
  assert.equal(playing.playing, true, "get_state should agree that the animation is running");
  assert.equal(playing.current_animation, DRIFT, "get_state should name the running animation");
  assert.equal(playing.length, DRIFT_LENGTH, `length should be read off drift itself (${DRIFT_LENGTH}s)`);
  population.seal("ANIM_LIVE_PLAY", `ok ${DRIFT} playing length=${playing.length}`);

  // THE check a static implementation cannot satisfy. drift drives Marker:position:x
  // from 0 to 800 over 8s, so a running animation MOVES A NODE and the move is visible
  // through a completely different tool. A reply cached when the socket opened, or an
  // _anim_play whose ap.play() call was dropped, passes everything above and fails here.
  await sleep(400);
  const advanced = await call("runtime_anim_get_state", { path: "Anim" });
  assert.ok(
    advanced.position > playing.position,
    `the animation must ADVANCE while playing: position went ${playing.position} -> ${advanced.position}`,
  );
  const movedX = await markerX();
  assert.ok(movedX > 0, `drift animates Marker:position:x away from 0; the scene must actually change, got x=${movedX}`);
  population.seal("ANIM_LIVE_DRIVES", `ok position=${advanced.position.toFixed(3)}s marker.x=${movedX.toFixed(1)}`);

  // ======================================= 3. keep_state — pause versus stop ====
  // This is the cross-version claim in _anim_stop's own comment, checked on 4.3, 4.5
  // and 4.7 by the matrix this job runs under.
  //
  // POSITION is the discriminator and it is the only one that is safe to be: Godot
  // reports current_animation as "" whenever nothing is PLAYING, so it is "" after a
  // pause just as much as after a stop, and asserting on it would prove nothing while
  // looking like it proved something. pause() keeps the playhead; stop() rewinds it.
  const paused = await call("runtime_anim_stop", { path: "Anim", keep_state: true, confirm: true });
  assert.equal(paused.playing, false, "a paused player is not playing");
  assert.ok(
    paused.position > 0,
    `keep_state:true must PAUSE IN PLACE — position should stay where playback reached, got ${paused.position}`,
  );

  // ...and the pause must actually hold. Two reads across a real interval: a paused
  // animation does not creep, and the node it was driving does not move.
  const heldX = await markerX();
  assert.ok(heldX > 0, `pause must not rewind the animated node, got x=${heldX}`);
  await sleep(300);
  const stillPaused = await call("runtime_anim_get_state", { path: "Anim" });
  assert.equal(stillPaused.playing, false, "a paused player stays paused");
  assert.equal(
    stillPaused.position,
    paused.position,
    `a paused animation must not advance: ${paused.position} -> ${stillPaused.position}`,
  );
  assert.equal(await markerX(), heldX, "a paused animation must not keep moving the node it drives");
  population.seal("ANIM_LIVE_PAUSE", `ok held at ${paused.position.toFixed(3)}s marker.x=${heldX.toFixed(1)} across 300ms`);

  // Omitting `animation` replays the currently-assigned one — the documented behaviour
  // of the optional argument, and the reason pause is useful at all. It must RESUME
  // from the paused position rather than restart, so this also re-proves the pause.
  const resumed = await call("runtime_anim_play", { path: "Anim", confirm: true });
  assert.equal(resumed.playing, true, "omitting `animation` should replay the assigned one");
  assert.equal(resumed.current_animation, DRIFT, "the resumed animation should still be drift");
  await sleep(300);
  const afterResume = await call("runtime_anim_get_state", { path: "Anim" });
  assert.ok(
    afterResume.position > paused.position,
    `resume must continue from the paused position, got ${afterResume.position} vs ${paused.position}`,
  );
  population.seal("ANIM_LIVE_RESUME", `ok resumed ${paused.position.toFixed(3)}s -> ${afterResume.position.toFixed(3)}s`);

  // The other direction, and the whole point of the pair: a default stop REWINDS.
  const stopped = await call("runtime_anim_stop", { path: "Anim", confirm: true });
  assert.equal(stopped.playing, false, "a stopped player is not playing");
  assert.equal(stopped.position, 0, `a default stop must REWIND — expected position 0, got ${stopped.position}`);
  assert.equal(stopped.current_animation, "", "a stopped player has no current animation");
  const afterStop = await call("runtime_anim_get_state", { path: "Anim" });
  assert.equal(afterStop.position, 0, "get_state should agree the playhead was rewound");
  assert.equal(afterStop.length, 0, "with nothing assigned there is no current length");

  // Re-stopping an already-stopped player is a no-op, not an error (#146: a probe that
  // cannot safely repeat its own cleanup leaves state behind the moment anything fails).
  // 🔴 186 §3: THE SEAL USED TO SIT ABOVE THIS PARAGRAPH, so the idempotent-stop claim was
  // counted onto ANIM_LIVE_SWITCH — a marker about the animation library owning a claim
  // about stopping. 185's gate could not see it: a blank line separates them.
  const reStop = await call("runtime_anim_stop", { path: "Anim", confirm: true });
  assert.equal(reStop.playing, false, "re-stopping an idle player should be a quiet no-op");
  population.seal("ANIM_LIVE_STOP", `ok keep_state kept ${paused.position.toFixed(3)}s, default rewound to 0, re-stop a no-op`);

  // ============================== 4. the library holds more than one animation ===
  // `still` is 4s where drift is 8s, and that difference is the assertion: length and
  // current_animation are read off the animation actually assigned, not returned as a
  // constant that happens to match the one animation a single-animation fixture holds.
  const switched = await call("runtime_anim_play", { path: "Anim", animation: STILL, confirm: true });
  assert.equal(switched.current_animation, STILL, "playing still should switch the current animation");
  const stillState = await call("runtime_anim_get_state", { path: "Anim" });
  assert.equal(stillState.current_animation, STILL, "get_state should follow the switch");
  assert.equal(stillState.length, STILL_LENGTH, `length must track the assigned animation (${STILL_LENGTH}s, not ${DRIFT_LENGTH}s)`);
  assert.notEqual(STILL_LENGTH, DRIFT_LENGTH, "the two fixture animations must differ in length or this check proves nothing");
  await call("runtime_anim_stop", { path: "Anim", confirm: true });
  population.seal("ANIM_LIVE_SWITCH", `ok ${DRIFT}=${DRIFT_LENGTH}s ${STILL}=${stillState.length}s`);

  // ========================================================= 5. custom_speed ====
  // Measured, not trusted. The same animation over the same wall-clock window at 1x and
  // at 8x: if custom_speed never reached ap.play() the two windows advance identically
  // and the ratio is ~1. The bound is deliberately far below the true 8x so a loaded
  // runner cannot fail it, while an ignored custom_speed cannot pass it.
  const WINDOW_MS = 600;
  await call("runtime_anim_play", { path: "Anim", animation: DRIFT, custom_speed: 1.0, confirm: true });
  await sleep(WINDOW_MS);
  const slow = (await call("runtime_anim_get_state", { path: "Anim" })).position;
  await call("runtime_anim_stop", { path: "Anim", confirm: true });

  const fastReply = await call("runtime_anim_play", { path: "Anim", animation: DRIFT, custom_speed: 8.0, confirm: true });
  await sleep(WINDOW_MS);
  const fast = (await call("runtime_anim_get_state", { path: "Anim" })).position;
  await call("runtime_anim_stop", { path: "Anim", confirm: true });

  assert.ok(slow > 0, `the 1x window must advance at all, got ${slow}`);
  assert.ok(
    fast > slow * 2.5,
    `custom_speed:8 must advance multiples further than custom_speed:1 over the same ${WINDOW_MS}ms — ` +
      `got ${fast.toFixed(3)}s vs ${slow.toFixed(3)}s (ratio ${(fast / slow).toFixed(2)}, expected ~8)`,
  );

  // Documenting a real asymmetry rather than papering over it: the reply's `speed_scale`
  // is AnimationPlayer.speed_scale — the player's own multiplier — and play()'s
  // custom_speed argument does not write to it. So a caller that passes custom_speed:8
  // and reads speed_scale back sees 1, even though playback is measurably 8x (above).
  // Asserted so the asymmetry is pinned: if this ever starts reporting 8, the field's
  // meaning changed and the tool description should change with it.
  assert.equal(
    fastReply.speed_scale,
    1,
    "speed_scale reports AnimationPlayer.speed_scale, which play()'s custom_speed does not set — see the handoff",
  );
  population.seal("ANIM_LIVE_SPEED", `ok 1x=${slow.toFixed(3)}s 8x=${fast.toFixed(3)}s ratio=${(fast / slow).toFixed(2)}`);

  // ============================================================ 6. from_end ====
  // from_end starts playback at the END of the animation. It is NOT observable on
  // drift: drift loops, so a playhead placed at length wraps straight back to 0 on the
  // first process and looks exactly like a normal play. It IS observable on still,
  // which does not loop — placed at the end it finishes immediately and stays there.
  //
  // The clock is frozen for both halves so the two readings are exact rather than
  // "close to". runtime_time_scale is an instrument here, not the subject; it has its
  // own live coverage in runtime-frame-step.
  const froze = await call("runtime_time_scale", { scale: 0, confirm: true });
  assert.equal(froze.current, 0, "the clock must actually freeze for the from_end readings to be exact");
  try {
    await call("runtime_anim_play", { path: "Anim", animation: STILL, from_end: true, confirm: true });
    await sleep(200);
    const atEnd = await call("runtime_anim_get_state", { path: "Anim" });
    assert.equal(atEnd.position, STILL_LENGTH, `from_end:true must start at the end (${STILL_LENGTH}s), got ${atEnd.position}`);
    assert.equal(atEnd.playing, false, "a non-looping animation started at its end has nowhere left to run");

    // The same call without from_end, under the same frozen clock. If from_end were
    // dropped on the way to ap.play() these two readings would be identical.
    await call("runtime_anim_stop", { path: "Anim", confirm: true });
    await call("runtime_anim_play", { path: "Anim", animation: STILL, confirm: true });
    await sleep(200);
    const atStart = await call("runtime_anim_get_state", { path: "Anim" });
    assert.equal(atStart.position, 0, `without from_end the same animation must start at 0, got ${atStart.position}`);
    assert.equal(atStart.playing, true, "started at 0 with the clock frozen, still has 4s to run");
    assert.notEqual(atEnd.position, atStart.position, "from_end must change where playback begins or it is not implemented");
    population.seal("ANIM_LIVE_FROM_END", `ok from_end=${atEnd.position}s (finished) vs normal=${atStart.position}s (running)`);
  } finally {
    // Restore the clock whatever happened above, so a failure here cannot leave a
    // frozen game behind for anything that runs next against the same port.
    await call("runtime_anim_stop", { path: "Anim", confirm: true });
    await call("runtime_time_scale", { scale: 1, confirm: true });
  }

  // ------------------------------------------------------------- left clean ---
  // Re-assert the restore rather than assuming it, per #146: state left behind by a
  // probe is a defect even when nothing is currently failing. The clock was restored in
  // the finally above; this checks the animation state and the node it drives.
  const final = await call("runtime_anim_get_state", { path: "Anim" });
  assert.equal(final.playing, false, "the probe must leave nothing playing");
  assert.equal(final.position, 0, "the probe must leave the playhead rewound");
  assert.equal(final.current_animation, "", "the probe must leave no animation assigned");
  assert.deepEqual([...final.animations].sort(), [DRIFT, STILL], "the probe must not have altered the library");

  // The clock: frozen and not restored would be invisible here and fatal for anything
  // that ran next, so it is checked through a real observation rather than the setter's
  // own echo — drift is played briefly and must advance.
  await call("runtime_anim_play", { path: "Anim", animation: DRIFT, confirm: true });
  await sleep(250);
  const ticking = await call("runtime_anim_get_state", { path: "Anim" });
  assert.ok(ticking.position > 0, `the probe must leave the clock running, got position ${ticking.position} after 250ms`);
  await call("runtime_anim_stop", { path: "Anim", confirm: true });
  const settled = await call("runtime_anim_get_state", { path: "Anim" });
  assert.equal(settled.position, 0, "and it must still leave the playhead rewound");
  population.seal("ANIM_LIVE_LEFT_CLEAN", "ok nothing playing · playhead rewound · library intact · clock ticking");

  console.log(
    `ANIM_LIVE_RESULT play=drives_scene stop=pause_vs_rewind speed=${(fast / slow).toFixed(2)}x from_end=observable errors=3tools`,
  );
  console.log("✔ animation lane verified against a real running game");
  runtime.close();
} catch (err) {
  console.error(`::error::animation-lane probe failed: ${err?.message ?? String(err)}`);
  console.error(err?.stack ?? "");
  runtime.close();
  process.exit(1);
}

// 🔴 THE POPULATION GATE, before the ✔ that used to be unconditional.
population.reportOrDie();
console.log("✔ animation-lane integration OK");

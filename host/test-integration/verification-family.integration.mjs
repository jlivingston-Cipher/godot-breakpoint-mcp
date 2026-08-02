// Verification-family integration probe — drives the five verification tools against
// a REAL running game over the in-game runtime autoload:
//
//   runtime_assert_scene_structure · runtime_assert_node_state
//   runtime_assert_perf · runtime_assert_screen_text · runtime_state_digest
//
// WHY THIS EXISTS
// ---------------
// All five had host unit tests against a MOCKED bridge and zero live coverage. #141
// closed the live gap for runtime_screenshot_diff — and only for it. The handoffs then
// carried "runtime_screenshot_diff still has zero automated coverage" forward through
// four sessions (143 → 144 → 147 → 149) while the family AROUND it stayed untested and
// unmentioned. This probe is the correction: it covers what #141 did not.
//
// A mocked-bridge unit test can prove the host forwards a request and parses a reply.
// It cannot prove the GDScript on the other end reads the live SceneTree, and every
// interesting behaviour in this family lives there: the visibility filter in
// _assert_screen_text, the MONITORS allow-list in _assert_perf, the four distinct
// `reason` values in _assert_scene_structure, the depth bound in _digest_walk.
//
// WHAT MAKES IT COVERAGE RATHER THAN GREEN
// ----------------------------------------
// Every assertion here is made in BOTH directions. A tool that always returned
// ok:true would pass a green-only suite completely; each green check below is paired
// with a red one whose failure the tool must report, with the right reason, on the
// right path. Three checks go further and are unsatisfiable by a static
// implementation at all:
//
//   * counter is CHANGED live and the same assertion must flip green -> red -> green,
//     so a value cached when the socket opened cannot pass (the #146 failure mode).
//   * HiddenLabel holds text that MUST NOT be found while runtime_assert_node_state
//     proves that very node holds that very text — absence and invisibility are
//     told apart.
//   * assert_perf is driven past the bound in BOTH directions: time/fps is
//     higher_better and object/node_count is lower_better, so a comparison stuck on
//     one sign fails one of them.
//
// Markers (grep-able): VERIFY_LIVE_PING / _STRUCT / _STRUCT_RED / _NODE / _NODE_LIVE /
// _PERF / _PERF_RED / _TEXT / _TEXT_HIDDEN / _TEXT_OPTS / _DIGEST / _RESULT.
//
// Requires res://tests/verify_probe.tscn running with GODOT_PROJECT set and
// BREAKPOINT_RUNTIME_PORT pointing at its bridge. Fully headless — nothing here reads
// a pixel. Not part of `npm test` (Godot-free); invoked directly by integration.yml.
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
// 🔴 THE REACHABILITY BANNER (`VERIFY_LIVE_PING`) IS DELIBERATELY NOT A FAMILY. It
// asserts nothing — the gate is a throw — so sealing it would fire VACUOUS on a
// healthy run, and a gate that cries wolf on green is a gate that gets deleted.
const population = new Population("VERIFY_LIVE", {
  families: [
    "VERIFY_LIVE_STRUCT", "VERIFY_LIVE_STRUCT_RED", "VERIFY_LIVE_STRUCT_BASE", "VERIFY_LIVE_NODE",
    "VERIFY_LIVE_NODE_LIVE", "VERIFY_LIVE_NODE_BADPATH", "VERIFY_LIVE_PERF", "VERIFY_LIVE_PERF_RED",
    "VERIFY_LIVE_PERF_SKIP", "VERIFY_LIVE_TEXT", "VERIFY_LIVE_TEXT_HIDDEN", "VERIFY_LIVE_TEXT_REVEAL",
    "VERIFY_LIVE_TEXT_OPTS", "VERIFY_LIVE_DIGEST", "VERIFY_LIVE_DIGEST_OPTS",
  ],
  scope: 15,
  claims: 95,         // measured 100 locally, session 170
});
const assert = population.assert;
import { BridgeClient } from "../dist/bridge.js";
import { loadConfig } from "../dist/config.js";
import { registerRuntimeTools } from "../dist/tools/runtime.js";

const cfg = loadConfig();
console.log(`verification-family probe -> runtime bridge ${cfg.runtimeHost}:${cfg.runtimePort}  project=${cfg.projectPath}`);

// Register the runtime tools against a live runtime BridgeClient, exactly the way
// index.ts wires Plane C — so the host<->engine path is exercised end to end, not just
// the raw socket. elicitInput is never reached (the one mutating call passes confirm).
const runtime = new BridgeClient(cfg.runtimeHost, cfg.runtimePort, 15000, "runtime bridge", "Is the verify probe scene running?");
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
  console.log(`VERIFY_LIVE_PING ok runtime=${pong?.runtime} godot=${pong?.godot ?? "?"}`);
} catch (err) {
  die(`could not reach the runtime bridge: ${err?.message ?? String(err)}`);
}

try {
  // ============================ 1. runtime_assert_scene_structure ============
  // The green case is also the premise of everything below: if the wrong scene
  // booted, the screen-text and node-state assertions would be measuring
  // something else, so a wrong scene must fail HERE rather than three sections
  // later with a confusing message.
  const structOk = await call("runtime_assert_scene_structure", {
    expect: [
      { path: ".", type: "Node2D" },
      { path: "VisibleLabel", type: "Label" },
      { path: "HiddenLabel", type: "Label" },
      { path: "NoSuchNode9137", absent: true },
    ],
  });
  if (structOk.ok !== true) {
    die(
      `the verify probe scene is not the running scene (${JSON.stringify(structOk.failures)}) — ` +
        `boot with 'res://tests/verify_probe.tscn'; every assertion below assumes it`,
    );
  }
  assert.equal(structOk.checked, 4, "checked should count every expectation, including the absent one");
  assert.deepEqual(structOk.failures, [], "the fixture scene should produce no structure failures");
  population.seal("VERIFY_LIVE_STRUCT", `ok checked=${structOk.checked} failures=0`);

  // All three failure reasons the addon can emit, each against a real tree. None of
  // these has ever run live: the render probe uses this tool only as a green gate.
  const structRed = await call("runtime_assert_scene_structure", {
    expect: [
      { path: "NoSuchNode9137", type: "Label" }, // missing
      { path: "VisibleLabel", type: "Sprite2D" }, // type_mismatch
      { path: "VisibleLabel", absent: true }, // expected_absent_but_present
    ],
  });
  assert.equal(structRed.ok, false, "three broken expectations must not report ok");
  assert.equal(structRed.checked, 3, "checked counts expectations, not failures");
  const reasons = Object.fromEntries(structRed.failures.map((f) => [f.reason, f]));
  assert.ok(reasons.missing, `expected a 'missing' failure, got ${JSON.stringify(structRed.failures)}`);
  assert.equal(reasons.missing.path, "NoSuchNode9137", "the missing failure should name the path asked for");
  assert.ok(reasons.type_mismatch, `expected a 'type_mismatch' failure, got ${JSON.stringify(structRed.failures)}`);
  assert.equal(reasons.type_mismatch.expected, "Sprite2D", "type_mismatch should echo the expected class");
  assert.equal(reasons.type_mismatch.actual, "Label", "type_mismatch should report the class actually found");
  assert.ok(
    reasons.expected_absent_but_present,
    `expected an 'expected_absent_but_present' failure, got ${JSON.stringify(structRed.failures)}`,
  );
  population.seal("VERIFY_LIVE_STRUCT_RED", `ok reasons=[${Object.keys(reasons).sort().join(",")}]`);

  // A Label IS a CanvasItem IS a Node: is_class() must accept a base class, or every
  // polymorphic expectation a user writes would be a false failure.
  const structBase = await call("runtime_assert_scene_structure", {
    expect: [{ path: "VisibleLabel", type: "Control" }, { path: "VisibleLabel", type: "CanvasItem" }],
  });
  assert.equal(structBase.ok, true, `a Label should satisfy Control and CanvasItem, got ${JSON.stringify(structBase.failures)}`);
  population.seal("VERIFY_LIVE_STRUCT_BASE", "ok Label satisfies Control/CanvasItem");

  // ============================== 2. runtime_assert_node_state ===============

  const nodeOk = await call("runtime_assert_node_state", { path: ".", expect: { counter: 100 } });
  assert.equal(nodeOk.ok, true, `the fixture boots with counter=100, got ${JSON.stringify(nodeOk)}`);
  assert.equal(nodeOk.checked, 1, "checked should count the expectations supplied");
  assert.deepEqual(nodeOk.mismatches, [], "a matching property should produce no mismatch");
  assert.equal(nodeOk.path, ".", "the tool should echo the resolved path of the node it read");
  population.seal("VERIFY_LIVE_NODE", `ok path=${nodeOk.path} checked=${nodeOk.checked}`);

  const nodeRed = await call("runtime_assert_node_state", { path: ".", expect: { counter: 999 } });
  assert.equal(nodeRed.ok, false, "counter is 100, so expecting 999 must not pass");
  assert.equal(nodeRed.mismatches.length, 1, "one wrong expectation is one mismatch");
  assert.equal(nodeRed.mismatches[0].property, "counter", "the mismatch should name the property");
  assert.equal(nodeRed.mismatches[0].expected, 999, "the mismatch should echo what was expected");
  assert.equal(nodeRed.mismatches[0].actual, 100, "the mismatch should report the value actually read");

  // THE assertion a static implementation cannot satisfy. Change the property in the
  // live game and the SAME call must flip: green -> red on the old value, and green on
  // the new one. A reply cached when the socket opened passes the two checks above and
  // fails this one — which is exactly the bug #146 found in the authoring probe.
  await call("runtime_set_property", { path: ".", property: "counter", value: 250, confirm: true });
  const afterSet = await call("runtime_assert_node_state", { path: ".", expect: { counter: 100 } });
  assert.equal(afterSet.ok, false, "after setting counter=250 the old expectation must fail — the assert is not reading live state");
  assert.equal(afterSet.mismatches[0].actual, 250, `expected the assert to observe 250, got ${afterSet.mismatches[0].actual}`);
  const atNew = await call("runtime_assert_node_state", { path: ".", expect: { counter: 250 } });
  assert.equal(atNew.ok, true, "the new value should now pass");

  // Numeric tolerance: 251 is one away from 250, so it passes at tolerance 1 and fails
  // at tolerance 0. Both directions, because a tolerance that is ignored passes the
  // first check on its own.
  const tolPass = await call("runtime_assert_node_state", { path: ".", expect: { counter: 251 }, tolerance: 1 });
  assert.equal(tolPass.ok, true, "counter=250 should satisfy an expectation of 251 within tolerance 1");
  const tolFail = await call("runtime_assert_node_state", { path: ".", expect: { counter: 251 }, tolerance: 0 });
  assert.equal(tolFail.ok, false, "counter=250 must not satisfy an expectation of 251 at tolerance 0");
  population.seal("VERIFY_LIVE_NODE_LIVE", `ok 100->250 observed, tolerance 1 passes / 0 fails`);

  // Restore, and assert the restore rather than assuming it. #146's lesson: state left
  // behind by a probe is a defect even when nothing is currently failing.
  await call("runtime_set_property", { path: ".", property: "counter", value: 100, confirm: true });
  const restored = await call("runtime_assert_node_state", { path: ".", expect: { counter: 100 } });
  assert.equal(restored.ok, true, "the probe must leave counter back at 100");

  // A string property on a child, proving the path resolution is relative to the scene
  // root and that non-numeric comparison works — and establishing, for section 4, that
  // HiddenLabel really does hold the sentinel text.
  const hiddenHasText = await call("runtime_assert_node_state", {
    path: "HiddenLabel",
    expect: { text: "HIDDEN SENTINEL 9137", visible: false },
  });
  assert.equal(hiddenHasText.ok, true, `HiddenLabel should hold the sentinel text and be hidden, got ${JSON.stringify(hiddenHasText.mismatches)}`);
  assert.equal(hiddenHasText.checked, 2, "two expectations were supplied");
  assert.equal(hiddenHasText.path, "HiddenLabel", "the path should resolve relative to the scene root");

  const badPath = await raw("runtime_assert_node_state", { path: "NoSuchNode9137", expect: { counter: 1 } });
  assert.equal(badPath.isError, true, "asserting against a node that does not exist should be an error, not ok:false");
  assert.match(errText(badPath), /bad_path/, `expected bad_path, got ${errText(badPath)}`);
  population.seal("VERIFY_LIVE_NODE_BADPATH", "ok bad_path");

  // ==================================== 3. runtime_assert_perf ===============

  const mon = await call("runtime_get_monitors", {});
  const nodeCount = mon.monitors["object/node_count"];
  assert.ok(typeof nodeCount === "number" && nodeCount > 0, `object/node_count should be a positive number, got ${nodeCount}`);

  // The fixture has no _process and no _physics_process, so nothing in it creates or
  // frees a node. object/node_count is therefore a legitimate tolerance-0 baseline:
  // if this flakes, a node IS being created, which is a finding rather than noise.
  const perfOk = await call("runtime_assert_perf", { baseline: { "object/node_count": nodeCount }, tolerance: 0 });
  assert.equal(perfOk.ok, true, `a static scene should not regress its own node_count, got ${JSON.stringify(perfOk.regressions)}`);
  assert.equal(perfOk.checked, 1, "one known monitor was supplied");
  assert.equal(perfOk.monitors["object/node_count"], nodeCount, "the tool should report the monitor it compared");
  population.seal("VERIFY_LIVE_PERF", `ok node_count=${nodeCount} stable at tolerance 0`);

  // Both signs. time/fps is higher_better (an impossible floor must regress) and
  // object/node_count is lower_better (an impossible ceiling must regress). A
  // comparison stuck on one direction passes exactly one of these two.
  const perfHigher = await call("runtime_assert_perf", { baseline: { "time/fps": 100000 } });
  assert.equal(perfHigher.ok, false, "no game runs at 100000 fps; that baseline must regress");
  assert.equal(perfHigher.regressions.length, 1, "one baseline key, one regression");
  assert.equal(perfHigher.regressions[0].key, "time/fps", "the regression should name the monitor");
  assert.equal(perfHigher.regressions[0].direction, "higher_better", "fps is higher_better by default");
  assert.equal(perfHigher.regressions[0].baseline, 100000, "the regression should echo the baseline");

  const perfLower = await call("runtime_assert_perf", { baseline: { "object/node_count": 1 } });
  assert.equal(perfLower.ok, false, "the scene holds more than one node; a ceiling of 1 must regress");
  assert.equal(perfLower.regressions[0].direction, "lower_better", "node_count is lower_better by default");
  assert.ok(
    perfLower.regressions[0].current > perfLower.regressions[0].baseline,
    "a lower_better regression means current exceeded the baseline",
  );
  population.seal("VERIFY_LIVE_PERF_RED", `ok higher_better and lower_better both fire`);

  // The `direction` override flips the verdict on the SAME numbers — the cleanest
  // possible proof that the parameter is read rather than defaulted.
  const flipped = await call("runtime_assert_perf", {
    baseline: { "object/node_count": 1 },
    direction: { "object/node_count": "higher_better" },
  });
  assert.equal(flipped.ok, true, "current >= 1 passes once node_count is declared higher_better");
  assert.equal(flipped.checked, 1, "the override must not change what was checked");

  // Tolerance widens a real regression into a pass, on live numbers rather than a stub.
  // The floor matters: if halfCount ever equalled nodeCount the "tight" check below would
  // pass for the wrong reason and this section would silently stop testing anything.
  const halfCount = Math.max(1, Math.floor(nodeCount / 2));
  assert.ok(
    nodeCount > halfCount,
    `this section needs a baseline strictly below the live node_count; got node_count=${nodeCount}, baseline=${halfCount}`,
  );
  const tight = await call("runtime_assert_perf", { baseline: { "object/node_count": halfCount }, tolerance: 0 });
  assert.equal(tight.ok, false, `node_count ${nodeCount} must exceed a ceiling of ${halfCount} at tolerance 0`);
  const loose = await call("runtime_assert_perf", { baseline: { "object/node_count": halfCount }, tolerance: 5 });
  assert.equal(loose.ok, true, `a tolerance of 5x should absorb ${nodeCount} against ${halfCount}`);

  // An unrecognised monitor is SKIPPED, not invented: checked must fall to 0 rather
  // than the tool reporting a comparison it never made.
  const unknown = await call("runtime_assert_perf", { baseline: { "no/such/monitor_9137": 1 } });
  assert.equal(unknown.checked, 0, "an unknown monitor key must not be counted as checked");
  assert.deepEqual(unknown.regressions, [], "an unknown monitor key must not produce a regression");
  assert.equal(unknown.ok, true, "checking nothing is vacuously ok — but `checked` is what says so");
  population.seal("VERIFY_LIVE_PERF_SKIP", "ok unknown monitor key -> checked=0");

  // =============================== 4. runtime_assert_screen_text =============
  // The positive path here is running for the first time in this repository's life:
  // before verify_probe.tscn, no scene under example/ contained a single Control with
  // a `text` property, so only the absence form could ever execute — and absence
  // passes trivially against a tool that finds nothing, ever.

  const textOk = await call("runtime_assert_screen_text", { text: "READY PLAYER ONE" });
  assert.equal(textOk.ok, true, `the visible label's text should be found, got ${JSON.stringify(textOk)}`);
  assert.equal(textOk.matches, 1, "exactly one visible node carries that text");
  assert.equal(textOk.present, true, "present defaults to true");
  assert.equal(textOk.samples.length, 1, "a match should come back with a sample");
  assert.equal(textOk.samples[0].path, "VisibleLabel", `the sample should name the node, got ${textOk.samples[0].path}`);
  assert.equal(textOk.samples[0].text, "READY PLAYER ONE", "the sample should carry the text actually read off the node");
  population.seal("VERIFY_LIVE_TEXT", `ok matches=${textOk.matches} sample=${textOk.samples[0].path}`);

  const textAbsent = await call("runtime_assert_screen_text", { text: "ZZZ_NO_SUCH_TEXT_9137", present: false });
  assert.equal(textAbsent.ok, true, "text nothing carries should satisfy an absence assertion");
  assert.equal(textAbsent.matches, 0, "nothing should match");
  assert.equal(textAbsent.present, false, "the tool should echo the mode it ran in");

  // Absence asserted for text that IS on screen must fail — otherwise `present:false`
  // is a rubber stamp.
  const absentWrong = await call("runtime_assert_screen_text", { text: "READY PLAYER ONE", present: false });
  assert.equal(absentWrong.ok, false, "asserting the absence of text that is on screen must fail");
  assert.equal(absentWrong.matches, 1, "the match count is reported even when the verdict is a failure");

  // ---- THE visibility filter, which is the reason HiddenLabel exists -------------
  // Section 2 already proved, through a different tool, that HiddenLabel holds this
  // exact string. So a miss here can only mean the node was skipped for being
  // invisible — the one interpretation an "is it just not there?" reading cannot take.
  const hidden = await call("runtime_assert_screen_text", { text: "HIDDEN SENTINEL 9137" });
  assert.equal(hidden.matches, 0, "a hidden node's text must not count as on-screen text");
  assert.equal(hidden.ok, false, "a present-assertion for hidden text must fail");
  assert.deepEqual(hidden.samples, [], "a hidden node must not appear in the samples");
  population.seal("VERIFY_LIVE_TEXT_HIDDEN", "ok hidden node's text is not found, though the node holds it");

  // And the inverse, to prove the filter tracks the live flag rather than the scene
  // file: reveal it, find it, hide it again, lose it again.
  await call("runtime_set_property", { path: "HiddenLabel", property: "visible", value: true, confirm: true });
  const revealed = await call("runtime_assert_screen_text", { text: "HIDDEN SENTINEL 9137" });
  assert.equal(revealed.ok, true, "once visible, the same text must be found — the filter reads the live flag");
  assert.equal(revealed.samples[0].path, "HiddenLabel", "the revealed node should name itself in the samples");
  await call("runtime_set_property", { path: "HiddenLabel", property: "visible", value: false, confirm: true });
  const rehidden = await call("runtime_assert_screen_text", { text: "HIDDEN SENTINEL 9137" });
  assert.equal(rehidden.matches, 0, "the probe must leave HiddenLabel hidden");
  population.seal("VERIFY_LIVE_TEXT_REVEAL", "ok visible -> found, hidden -> not found, restored");

  // ---- the option surface, each proved by its own inverse ----------------------
  const insensitive = await call("runtime_assert_screen_text", { text: "ready player one" });
  assert.equal(insensitive.matches, 1, "matching is case-insensitive by default");
  const sensitive = await call("runtime_assert_screen_text", { text: "ready player one", case_sensitive: true });
  assert.equal(sensitive.matches, 0, "case_sensitive:true must reject the wrong case");
  const sensitiveExact = await call("runtime_assert_screen_text", { text: "READY PLAYER", case_sensitive: true });
  assert.equal(sensitiveExact.matches, 1, "case_sensitive:true must still match a correctly-cased substring");

  const re = await call("runtime_assert_screen_text", { text: "^READY .* ONE$", regex: true });
  assert.equal(re.matches, 1, "a regex should match the full label text");
  const reNo = await call("runtime_assert_screen_text", { text: "^NOPE .* ONE$", regex: true });
  assert.equal(reNo.matches, 0, "a non-matching regex should find nothing");
  const reInsensitive = await call("runtime_assert_screen_text", { text: "^ready .* one$", regex: true });
  assert.equal(reInsensitive.matches, 1, "regex matching is case-insensitive unless case_sensitive is set");
  const badRe = await raw("runtime_assert_screen_text", { text: "([unclosed", regex: true });
  assert.equal(badRe.isError, true, "an uncompilable regex should be an error, not a silent zero-match pass");
  assert.match(errText(badRe), /bad_regex/, `expected bad_regex, got ${errText(badRe)}`);

  const minOk = await call("runtime_assert_screen_text", { text: "READY PLAYER ONE", min_count: 1 });
  assert.equal(minOk.ok, true, "one match satisfies min_count 1");
  const minRed = await call("runtime_assert_screen_text", { text: "READY PLAYER ONE", min_count: 2 });
  assert.equal(minRed.ok, false, "one match must not satisfy min_count 2");
  assert.equal(minRed.matches, 1, "min_count changes the verdict, not the count");
  population.seal("VERIFY_LIVE_TEXT_OPTS", "ok case / regex / bad_regex / min_count all bite");

  // Change the text live: the same query must stop matching, then match again.
  await call("runtime_set_property", { path: "VisibleLabel", property: "text", value: "GAME OVER", confirm: true });
  const afterText = await call("runtime_assert_screen_text", { text: "READY PLAYER ONE" });
  assert.equal(afterText.matches, 0, "after retexting the label, the old string must no longer be found");
  const newText = await call("runtime_assert_screen_text", { text: "GAME OVER" });
  assert.equal(newText.matches, 1, "the new string must be found");
  await call("runtime_set_property", { path: "VisibleLabel", property: "text", value: "READY PLAYER ONE", confirm: true });
  const restoredText = await call("runtime_assert_screen_text", { text: "READY PLAYER ONE" });
  assert.equal(restoredText.matches, 1, "the probe must leave the label's text as it found it");

  // ==================================== 5. runtime_state_digest ==============

  const digest = await call("runtime_state_digest", { root: "." });
  assert.equal(digest.node_count, 3, `the fixture is root + two labels, got node_count=${digest.node_count}`);
  assert.deepEqual(
    Object.keys(digest.digest).sort(),
    [".", "HiddenLabel", "VisibleLabel"],
    "the digest should be keyed by scene-relative path, with '.' for the root",
  );
  // Default fields, and the one that distinguishes the two labels.
  assert.equal(digest.digest["VisibleLabel"].visible, true, "the visible label should digest as visible");
  assert.equal(digest.digest["HiddenLabel"].visible, false, "the hidden label should digest as hidden");
  assert.equal(
    digest.digest["."].position.__type__,
    "Vector2",
    `a Vector2 should survive as a tagged object, got ${JSON.stringify(digest.digest["."].position)}`,
  );
  population.seal("VERIFY_LIVE_DIGEST", `ok node_count=${digest.node_count} keys=[${Object.keys(digest.digest).sort().join(",")}]`);

  // Explicit fields replace the defaults rather than adding to them.
  const fielded = await call("runtime_state_digest", { root: ".", fields: ["text"] });
  assert.equal(fielded.digest["VisibleLabel"].text, "READY PLAYER ONE", "an explicit field should be digested");
  assert.equal(fielded.digest["HiddenLabel"].text, "HIDDEN SENTINEL 9137", "the hidden node is still digested — only screen_text filters on visibility");
  assert.deepEqual(
    Object.keys(fielded.digest["VisibleLabel"]),
    ["text"],
    "explicit fields should REPLACE the defaults, not extend them",
  );

  // The depth bound, in both directions: 0 stops at the root, 1 reaches the children.
  const shallow = await call("runtime_state_digest", { root: ".", max_depth: 0 });
  assert.equal(shallow.node_count, 1, `max_depth 0 should digest the root alone, got ${shallow.node_count}`);
  assert.deepEqual(Object.keys(shallow.digest), ["."], "max_depth 0 should yield only the root's entry");
  const deep = await call("runtime_state_digest", { root: ".", max_depth: 1 });
  assert.equal(deep.node_count, 3, `max_depth 1 should reach both children, got ${deep.node_count}`);

  // A subtree root: paths stay scene-relative, and the walk starts where it was told.
  const subtree = await call("runtime_state_digest", { root: "VisibleLabel" });
  assert.equal(subtree.node_count, 1, "the label has no children");
  assert.deepEqual(Object.keys(subtree.digest), ["VisibleLabel"], "a subtree digest is keyed by the same scene-relative paths");

  const digestBad = await raw("runtime_state_digest", { root: "NoSuchNode9137" });
  assert.equal(digestBad.isError, true, "digesting a root that does not exist should be an error");
  assert.match(errText(digestBad), /bad_path/, `expected bad_path, got ${errText(digestBad)}`);
  population.seal("VERIFY_LIVE_DIGEST_OPTS", "ok fields replace / max_depth bounds / subtree / bad_path");

  // ------------------------------------------------------------- left clean ---
  // Re-assert the whole fixture through the tool that gated it, so anything this
  // probe changed and failed to restore is a failure here rather than a surprise for
  // whatever runs next against the same game.
  const final = await call("runtime_assert_node_state", {
    path: ".",
    expect: { counter: 100 },
  });
  assert.equal(final.ok, true, "the probe must leave counter at 100");
  const finalText = await call("runtime_assert_screen_text", { text: "READY PLAYER ONE" });
  assert.equal(finalText.matches, 1, "the probe must leave VisibleLabel showing its original text");
  const finalHidden = await call("runtime_assert_node_state", { path: "HiddenLabel", expect: { visible: false } });
  assert.equal(finalHidden.ok, true, "the probe must leave HiddenLabel hidden");

  console.log(
    `VERIFY_LIVE_RESULT structure=4reasons node_state=live perf=both_directions screen_text=visibility_filter digest=${digest.node_count}nodes`,
  );
  console.log("✔ verification family verified against a real running game");
  runtime.close();
} catch (err) {
  console.error(`::error::verification-family probe failed: ${err?.message ?? String(err)}`);
  console.error(err?.stack ?? "");
  runtime.close();
  process.exit(1);
}

// 🔴 THE POPULATION GATE, before the ✔ that used to be unconditional.
population.reportOrDie();
console.log("✔ verification-family integration OK");

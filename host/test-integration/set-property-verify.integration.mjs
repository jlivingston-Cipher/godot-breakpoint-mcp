// Issue #327 — the write that reported success and did not happen.
//
// A reporter running addon 1.11.0 against Godot 4.7 found `runtime_set_property`
// answering `ok` with the property's OLD value for three different requests. Their
// diagnosis was a truthiness guard in the codec; measured on both sides of the wire at
// session 270, that is not what was happening and real `false` / `0` / `0.0` have always
// round-tripped. What they hit was a String reaching a bool property — Godot coerces any
// non-empty String to `true`, so `"false"` reads back as `true` — and the tool had no way
// to notice, because it answered with a FRESH READ-BACK it never compared to the request.
//
// This probe drives the host's OWN runtime tools against a live game (the D6 pattern) and
// asserts the comparison, not the guard. Three families:
//
//   327_APPLIED   the ordinary writes still work, including every falsy scalar the
//                 report accused us of dropping. A fix that made `false` refusable
//                 would be a worse bug than the one it replaced.
//   327_REFUSED   a write that does not land is an ERROR now. One row per measured
//                 cause: the String coercion, the untagged map, the untagged array,
//                 the absent `value`, and a property no node has.
//   327_INDEXED   `position:x` reads and writes, because the colon form is
//                 `get_indexed`'s vocabulary and the tool now uses it.
//
// Markers (grep-able): 327_APPLIED / 327_REFUSED / 327_INDEXED / 327_RESULT. Measured 30 claims.
// Requires the game running with BREAKPOINT_RUNTIME_PORT pointing at its bridge.
// Not part of `npm test` (Godot-free); invoked directly by integration.yml.
import { Population } from "./_population.mjs";

// 🔴 THE CLAIM POPULATION, COUNTED. Eight applied rows, five refusals and four indexed
// claims. The floor is what stops this probe going quiet: a rewrite that dropped the
// refusal family entirely would still print ✔ on the applied one, and the applied family
// alone is satisfied by the code that shipped the defect.
const population = new Population("327", {
  families: ["327_APPLIED", "327_REFUSED", "327_INDEXED"],
  scope: 1,
  claims: 30,
});
const assert = population.assert;
import { BridgeClient } from "../dist/bridge.js";
import { loadConfig } from "../dist/config.js";
import { resolveBridgeSecret } from "../dist/secret.js";
import { registerRuntimeTools } from "../dist/tools/runtime.js";

const cfg = loadConfig();
const NODE = process.env.PROBE_NODE ?? "Sprite2D";
console.log(`#327 set-property probe -> runtime bridge ${cfg.runtimeHost}:${cfg.runtimePort}  node=${NODE}`);

// 🔴 THE SECRET PROVIDER IS THE SIXTH ARGUMENT AND `index.ts` PASSES IT. Constructing
// without one reaches a game that has no secret and nothing else: the addon closes an
// unauthenticated connection and the caller reads `bridge_closed`, which looks like a
// game that is not running. Session 270 lost a probe run to exactly that.
const runtime = new BridgeClient(
  cfg.runtimeHost, cfg.runtimePort, 15000, "runtime bridge", "Is the example game running?",
  () => resolveBridgeSecret(cfg.projectPath, ["BREAKPOINT_RUNTIME_SECRET", "BREAKPOINT_BRIDGE_SECRET"]),
);

const tools = new Map();
const server = {
  registerTool: (name, _c, handler) => tools.set(name, handler),
  registerResource: () => {},
  server: { elicitInput: async () => ({ action: "decline" }) },
};
const noPeers = Object.fromEntries(
  ["clientFor", "spawn", "stop", "stopAll", "live", "all"].map((m) => [
    m,
    () => {
      throw new Error(`this probe is single-game: peers.${m}() must not be reached`);
    },
  ]),
);
registerRuntimeTools(server, runtime, noPeers, cfg);

const set = (property, value, extra = {}) =>
  tools.get("runtime_set_property")({ path: NODE, property, confirm: true, ...extra, ...(value === undefined ? {} : { value }) });
const read = async (property) => {
  const r = await tools.get("runtime_get_property")({ path: NODE, property });
  return JSON.parse(r.content[0].text).value;
};
const body = (r) => (r.isError ? r.content[0].text : JSON.parse(r.content[0].text));

try {
  // ── 1. THE WRITES THAT MUST STILL WORK, FALSY ONES FIRST ────────────────────────────
  population.open("327_APPLIED");
  const applied = [
    ["visible", true],
    ["visible", false],
    ["z_index", 0],
    ["z_index", 7],
    ["rotation", 0.0],
    ["rotation", 1.5],
    ["position", { __type__: "Vector2", x: 0, y: 0 }],
    ["position", { __type__: "Vector2", x: 11, y: 22 }],
  ];
  for (const [prop, value] of applied) {
    const r = await set(prop, value);
    const after = await read(prop);
    assert.ok(!r.isError, `327_APPLIED ${prop}=${JSON.stringify(value)} was refused: ${body(r)}`);
    assert.deepEqual(after, value, `327_APPLIED ${prop} holds ${JSON.stringify(after)}, asked for ${JSON.stringify(value)}`);
  }
  console.log(`327_APPLIED ${applied.length} writes landed, four of them falsy`);

  // ── 2. THE WRITES THAT MUST NOW BE ERRORS ───────────────────────────────────────────
  // Each row is a cause measured live at 270 that used to answer `ok` with the OLD value.
  population.open("327_REFUSED");
  await set("visible", true);
  await set("position", { __type__: "Vector2", x: 123, y: 456 });
  const refusals = [
    ["visible", "false", "a String reaching a bool — Godot coerces any non-empty String to true"],
    ["position", { x: 33, y: 44 }, "an UNTAGGED map — decodes to a Dictionary and stores (0,0)"],
    ["position", [55, 66], "an untagged array"],
    ["no_such_property_at_all", 5, "a property no node has"],
  ];
  for (const [prop, value, why] of refusals) {
    const before = await read(prop);
    const r = await set(prop, value);
    const after = await read(prop);
    assert.ok(r.isError, `327_REFUSED ${prop}=${JSON.stringify(value)} reported SUCCESS (${why}) — got ${JSON.stringify(body(r))}`);
    assert.deepEqual(after, before, `327_REFUSED ${prop} changed to ${JSON.stringify(after)} on a refused write (${why})`);
  }

  // The fifth cause has no `value` at all, which is the one the published schema used to
  // permit: `z.any()` is optional in zod, so a client omitting it was obeying us, and the
  // addon wrote the property type's ZERO over whatever was there.
  const rotBefore = await read("rotation");
  const missing = await set("rotation", undefined);
  assert.ok(missing.isError, `327_REFUSED an absent 'value' reported success — got ${JSON.stringify(body(missing))}`);
  assert.equal(await read("rotation"), rotBefore, "327_REFUSED an absent 'value' still moved the property");
  console.log(`327_REFUSED ${refusals.length + 1} silent no-ops are errors now`);

  // ── 3. THE COLON FORM, WHICH IS A DIFFERENT METHOD AND NOT A DIFFERENT SPELLING ─────
  population.open("327_INDEXED");
  await set("position", { __type__: "Vector2", x: 10, y: 20 });
  const x = await read("position:x");
  assert.equal(x, 10, `327_INDEXED position:x read ${JSON.stringify(x)}, expected 10 — Object.get() answers null for a sub-property`);
  const ix = await set("position:x", 99);
  assert.ok(!ix.isError, `327_INDEXED writing position:x was refused: ${body(ix)}`);
  assert.equal(await read("position:x"), 99, "327_INDEXED position:x did not take");
  assert.deepEqual(await read("position"), { __type__: "Vector2", x: 99, y: 20 },
    "327_INDEXED writing position:x must move only x");

  console.log("327_RESULT the read-back comparison holds on all three families");
  population.reportOrDie();
  console.log("✔ #327 set-property verification OK");
  runtime.close();
} catch (err) {
  console.error("✘ #327 set-property verification FAILED:", err?.message ?? String(err));
  runtime.close();
  process.exit(1);
}

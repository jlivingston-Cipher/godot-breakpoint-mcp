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
// Markers (grep-able): 327_APPLIED / 327_REFUSED / 327_INDEXED / 327_SCHEMA / 327_RESULT.
// Requires the game running with BREAKPOINT_RUNTIME_PORT pointing at its bridge.
// Not part of `npm test` (Godot-free); invoked directly by integration.yml.
//
// ── 🆕 272 — WHY THIS PROBE SPEAKS MCP AND NOT JavaScript ────────────────────────────
//
// It used to build `{ registerTool: (name, _c, handler) => tools.set(name, handler) }`
// and call the handler function directly. Sixteen of this tree's eighteen probes still
// do; only `authoring-plane` and `tabletop-plane` connect a real `Client`. That shortcut
// costs one specific thing, and 272 went looking for it while pricing
// `required-any-reachability`:
//
// 🔴 THE SDK VALIDATES `structuredContent` AGAINST `outputSchema` ON EVERY SUCCESS RESULT,
// AND IT DOES THAT IN THE TRANSPORT, NOT IN THE HANDLER. A handler invoked directly
// returns its object to the caller and nothing looks at it. So `runtime_set_property`,
// `runtime_get_property` and the rest of the runtime plane — SIX of the sixteen output
// keys the wire marks REQUIRED — passed through NO output validation anywhere in CI, on
// a plane whose tools had just shipped a defect about what they return.
//
// `contract_check.py` check 29 models that validator statically. This probe EXECUTES it:
// every `call()` below goes over stdio into a real host process, and a required key
// missing from `structuredContent` throws inside the SDK before this file sees a result.
// A model of a predicate and the predicate are not the same evidence, and this tree's own
// history is the argument — a unit test that pinned the viewport guard was structurally
// unable to observe the engine the branch was a model of, and stayed green over a live
// defect for forty-five releases.
import { Population } from "./_population.mjs";

// 🔴 THE CLAIM POPULATION, COUNTED. Eight applied rows, five refusals and four indexed
// claims, plus 272's schema family. The floor is what stops this probe going quiet: a
// rewrite that dropped the refusal family entirely would still print ✔ on the applied
// one, and the applied family alone is satisfied by the code that shipped the defect.
// Counted, not guessed: 8 applied rows × 2 + 4 refusal rows × 2 + the absent-`value` pair
// + 4 indexed + 272's 4 schema claims = 34, and the manifest is its own length now rather
// than the 1 it carried while it had three families.
const population = new Population("327", {
  families: ["327_APPLIED", "327_REFUSED", "327_INDEXED", "327_SCHEMA"],
  scope: 4,
  claims: 34,
});
const assert = population.assert;
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const HOST_DIR = path.resolve(THIS_DIR, "..");
const DIST = path.join(HOST_DIR, "dist", "index.js");
const NODE = process.env.PROBE_NODE ?? "Sprite2D";
console.log(`#327 set-property probe -> host over stdio, runtime bridge :${process.env.BREAKPOINT_RUNTIME_PORT ?? "9081"}  node=${NODE}`);

// The host process reads the same environment this step was given — the runtime port, the
// project path and the insecure-bridge opt-in — so no secret provider is constructed here.
// That was the sixth-argument trap 270 lost a run to; speaking MCP retires it, because
// `index.ts` is the thing that wires the bridge and it is now the thing under test.
const transport = new StdioClientTransport({
  command: "node", args: [DIST], cwd: HOST_DIR, env: { ...process.env }, stderr: "inherit",
});
const client = new Client({ name: "gcb-setprop", version: "1.0.0" }, { capabilities: { elicitation: {} } });
client.setRequestHandler(ElicitRequestSchema, async () => ({ action: "accept", content: { proceed: true } }));
await client.connect(transport);

// 🔴 A THROW OUT OF `callTool` IS NOT THE SAME EVENT AS `isError`. `isError` is the host
// answering "no"; a throw is the SDK refusing the answer's SHAPE, which is the thing this
// conversion bought. They are kept apart so a schema failure can never be read as a
// refusal the probe was expecting anyway.
const callRaw = async (name, args) => {
  try {
    return { r: await client.callTool({ name, arguments: args }, undefined, { timeout: 60000 }) };
  } catch (err) {
    return { schemaError: err?.message ?? String(err) };
  }
};
// 🔴 THESE THROW RATHER THAN CLAIM, and the reason is `_population.mjs`'s own rule: a
// claim is attributed to whichever family is OPEN, so asserting here would file the SDK's
// verdict under whatever section happened to be running and leave 327_SCHEMA vacuous. A
// schema refusal anywhere aborts into the catch below with the SDK's message intact; the
// family at the end is where the validator is asked ON PURPOSE and counted.
const set = async (property, value, extra = {}) => {
  const out = await callRaw("runtime_set_property",
    { path: NODE, property, confirm: true, ...extra, ...(value === undefined ? {} : { value }) });
  if (out.schemaError) throw new Error(`runtime_set_property(${property}) result failed OUTPUT-SCHEMA validation in the SDK: ${out.schemaError}`);
  return out.r;
};
const read = async (property) => {
  const out = await callRaw("runtime_get_property", { path: NODE, property });
  if (out.schemaError) throw new Error(`runtime_get_property(${property}) result failed OUTPUT-SCHEMA validation in the SDK: ${out.schemaError}`);
  // 261's idiom: one `any` cast costs fewer findings than the bare access on an
  // `unknown` reply, and lint_ceiling's job is to keep the remainder visible.
  return /** @type {any} */ (out.r.structuredContent)?.value;
};
const body = (r) => (r.isError ? (r.content?.[0]?.text ?? "") : (r.structuredContent ?? {}));

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

  // ── 4. 🆕 272 — THE OUTPUT SCHEMA, ASKED ON PURPOSE ─────────────────────────────────
  //
  // Everything above went over the same transport, so the validator has already run on
  // every one of those results. This family is where it is INTERROGATED rather than
  // merely survived: each runtime tool carrying an `any`-typed REQUIRED output key is
  // called once and the key is read off `structuredContent` — the field the SDK builds
  // only after `outputSchema` accepted it.
  //
  // 🔴 THREE OF THE SIX KEYS ARE UNREACHABLE FROM HERE AND THAT IS SAID RATHER THAN
  // QUIETLY SKIPPED. `runtime_call_method`'s `return` is code-execution-privileged and
  // this step does not opt in; `runtime_assert_node_state`'s `expected`/`actual` are
  // per-ELEMENT keys inside `mismatches`, so a passing assertion emits an empty array and
  // the keys are correctly absent — asserting on them would need a deliberate mismatch,
  // which is `verification-family`'s job and not this probe's.
  population.open("327_SCHEMA");
  await set("z_index", 3);
  const sc = await callRaw("runtime_set_property", { path: NODE, property: "z_index", value: 4, confirm: true });
  assert.ok(!sc.schemaError, `327_SCHEMA runtime_set_property was REFUSED BY ITS OWN OUTPUT SCHEMA: ${sc.schemaError}`);
  const scOut = /** @type {any} */ (sc.r.structuredContent);
  assert.ok(scOut && "value" in scOut,
    "327_SCHEMA runtime_set_property returned no `value` in structuredContent — check 29 joins that key statically and this is the same claim, executed");
  const gc = await callRaw("runtime_get_property", { path: NODE, property: "z_index" });
  assert.ok(!gc.schemaError, `327_SCHEMA runtime_get_property was REFUSED BY ITS OWN OUTPUT SCHEMA: ${gc.schemaError}`);
  const gcOut = /** @type {any} */ (gc.r.structuredContent);
  assert.ok(gcOut && "value" in gcOut,
    "327_SCHEMA runtime_get_property returned no `value` in structuredContent");
  console.log("327_SCHEMA the runtime plane's required-`any` keys survive the SDK's own output validation");

  console.log("327_RESULT the read-back comparison holds on all four families");
  population.reportOrDie();
  console.log("✔ #327 set-property verification OK");
  await client.close();
} catch (err) {
  console.error("✘ #327 set-property verification FAILED:", err?.message ?? String(err));
  await client.close().catch(() => {});
  process.exit(1);
}

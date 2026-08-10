import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { z as z4 } from "zod/v4";
import { containNonFinite, normaliseNonFinite, NON_FINITE_KEY } from "../src/finiteness.js";
import { outputSchemas } from "../src/schemas.js";

/**
 * 224 §7.3 — "can Godot's performance monitors emit INF through runtime_get_monitors?
 * That single question decides schemas.ts:541 and :580, and it is the only item that can
 * break a working tool silently in production rather than loudly in CI."
 *
 * The answer was measured on Godot 4.7 headless (session 225) and it is yes. This file
 * pins every hop of that measurement, because each one is a fact about somebody else's
 * software that could change under us:
 *
 *   - Godot emits `1e99999` for INF, which is VALID JSON. That is why Infinity reaches
 *     zod at all; an engine that emitted `inf` would fail at JSON.parse instead, loudly.
 *   - zod 3 ACCEPTS ±Infinity and zod 4 REFUSES it. That divergence IS the migration risk.
 *   - `JSON.stringify(Infinity)` is `null`, so even the accepting major loses the value.
 *
 * The zod-4 side is exercised through the `zod/v4` subpath of the installed zod 3.25.76 —
 * which is also the migration path the B3 spike recommended, so this file is the first
 * live evidence that the subpath resolves and behaves as the new major.
 */

test("Godot's INF literal is valid JSON and parses back to Infinity", () => {
  // The exact bytes `JSON.stringify(INF)` produces in Godot 4.7 (core/io/json.cpp).
  assert.equal(JSON.parse('{"m":1e99999}').m, Infinity);
  assert.equal(JSON.parse('{"m":-1e99999}').m, -Infinity);
  // And NAN's, which the engine replaces with null before it ever reaches us.
  assert.equal(JSON.parse('{"m":null}').m, null);
});

test("zod 3 accepts Infinity and zod 4 refuses it — the divergence the migration turns on", () => {
  const three = z.record(z.string(), z.number());
  const four = z4.record(z4.string(), z4.number());

  assert.equal(three.safeParse({ "time/fps": Infinity }).success, true,
    "zod 3 accepting Infinity is why this defect is invisible today");
  assert.equal(four.safeParse({ "time/fps": Infinity }).success, false,
    "zod 4 refusing it is why the migration would break a working tool");

  // NaN never reaches either — the engine already turned it into null — but both majors
  // refuse it, which is why the null case had to be admitted rather than the NaN case.
  assert.equal(three.safeParse({ "time/fps": NaN }).success, false);
  assert.equal(four.safeParse({ "time/fps": NaN }).success, false);
});

test("normaliseNonFinite replaces non-finite numbers and names where they were", () => {
  const { value, nonFinite } = normaliseNonFinite({
    monitors: { "time/fps": Infinity, "memory/static": 24090747, "audio/output_latency": -Infinity },
    regressions: [{ key: "time/fps", baseline: NaN, current: 1 }],
  });
  assert.deepEqual((value as any).monitors, {
    "time/fps": null,
    "memory/static": 24090747,
    "audio/output_latency": null,
  });
  assert.equal((value as any).regressions[0].baseline, null);
  assert.equal((value as any).regressions[0].current, 1);
  assert.deepEqual(nonFinite, [
    "monitors.time/fps",
    "monitors.audio/output_latency",
    "regressions[0].baseline",
  ]);
});

test("a reply with nothing non-finite is returned BY IDENTITY — the normal path allocates nothing", () => {
  const reply = { monitors: { "time/fps": 60 }, regressions: [] };
  const { value, nonFinite } = normaliseNonFinite(reply);
  assert.equal(value, reply, "the untouched path must not copy the tree on every bridge reply");
  assert.deepEqual(nonFinite, []);
  assert.equal(containNonFinite(reply), reply);
});

test("containNonFinite attaches the roster only when there is one", () => {
  const clean = containNonFinite({ monitors: { "time/fps": 60 } }) as Record<string, unknown>;
  assert.equal(NON_FINITE_KEY in clean, false, "an always-present empty array would be a new required field");

  const dirty = containNonFinite({ monitors: { "time/fps": Infinity } }) as Record<string, unknown>;
  assert.deepEqual(dirty[NON_FINITE_KEY], ["monitors.time/fps"]);
  assert.deepEqual(dirty.monitors, { "time/fps": null });
});

test("the walk terminates on a self-referential reply rather than recursing forever", () => {
  const cyclic: Record<string, unknown> = { a: 1 };
  cyclic.self = cyclic;
  const { nonFinite } = normaliseNonFinite(cyclic);   // must return, not blow the stack
  assert.deepEqual(nonFinite, []);
});

test("the shipped runtime_get_monitors schema accepts what the boundary now produces", () => {
  const schema = z.object(outputSchemas.runtime_get_monitors);
  const fromWire = JSON.parse('{"monitors":{"time/fps":1e99999,"memory/static":24090747.0}}');

  // 🔴 THE MUTATION, BOTH WAYS. Un-normalised, this is the payload that would sail through
  // zod 3 and be silently re-serialised to the client as `null` — success, no number.
  assert.equal(fromWire.monitors["time/fps"], Infinity);
  assert.equal(JSON.stringify(fromWire).includes("null"), true,
    "re-serialising the accepted value is where the reading is actually lost");

  const contained = containNonFinite(fromWire);
  const parsed = schema.safeParse(contained);
  assert.equal(parsed.success, true, "the contained reply must validate");
  assert.deepEqual((contained as any).monitors["time/fps"], null);
  assert.deepEqual((contained as any)[NON_FINITE_KEY], ["monitors.time/fps"]);
  // And the number that WAS finite is untouched — containment is not blanket nulling.
  assert.equal((contained as any).monitors["memory/static"], 24090747);
});

test("runtime_assert_perf's client-supplied baseline is contained too", () => {
  const schema = z.object(outputSchemas.runtime_assert_perf);
  // `"baseline": 1e999` in the REQUEST becomes `inf` in GDScript and `1e99999` on the way
  // back. No engine edge case is involved; this is a well-formed call.
  const fromWire = JSON.parse(
    '{"ok":false,"checked":1,"monitors":{"time/fps":60.0},' +
    '"regressions":[{"key":"time/fps","baseline":1e99999,"current":60.0,"direction":"higher_better"}]}',
  );
  const contained = containNonFinite(fromWire) as any;
  assert.equal(schema.safeParse(contained).success, true);
  assert.equal(contained.regressions[0].baseline, null);
  assert.equal(contained.regressions[0].current, 60);
  assert.deepEqual(contained[NON_FINITE_KEY], ["regressions[0].baseline"]);
});

test("runtime_screenshot_diff's ratio is division-guarded in the addon and stays a plain number", () => {
  // Measured, and recorded so a later session does not re-litigate it: `diff_ratio` is
  // `(float(differing) / float(total)) if total > 0 else 0.0` in runtime_bridge.gd, so it
  // cannot be NaN. It is deliberately NOT nullable — admitting a null it cannot produce
  // would be a schema claiming a case that does not exist.
  const shape = outputSchemas.runtime_screenshot_diff as Record<string, z.ZodTypeAny>;
  assert.equal(shape.diff_ratio.safeParse(null).success, false);
  assert.equal(shape.diff_ratio.safeParse(0.25).success, true);
});

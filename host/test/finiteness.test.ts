import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { z as z4 } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  findNonFinite,
  describeNonFinite,
  tolerate,
  pruneRecord,
  NON_FINITE_KEY,
  NON_FINITE_TOLERANT,
  TOLERANT_METHODS,
  MESSAGE_CAP,
} from "../src/finiteness.js";
import { outputSchemas } from "../src/schemas.js";
import { BridgeClient, BridgeError } from "../src/bridge.js";
import { startTcpServer, makeLineParser, type TcpServer } from "./helpers/tcp.js";

// 🔴 WALKED, NOT COUNTED IN `..`s — engine_log_echo.test.ts's note, and it caught this
// file on its first run. The suite executes COMPILED out of `dist-test/test/`, so a
// relative hop that is right in the source tree is wrong where it runs, and it fails as
// an ENOENT that reads like a broken test rather than a moved file.
function hostRoot(): string {
  let d = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(d, "src", "tools", "runtime.ts"))) return d;
    d = path.dirname(d);
  }
  throw new Error("could not locate host/ from " + path.dirname(fileURLToPath(import.meta.url)));
}

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
 *
 * 🔴 226 §2 — AND THE FIRST CONTAINMENT'S POLICY WAS WRONG FOR 91 OF THE 93 TOOLS IT
 * REACHED. Nulling a non-finite reading is only representable where a schema says so, and
 * two said so. The rest got a hard parse failure blaming the shape. The policy is now
 * per-method: prune-and-roster for the two tools that report partial readings, REFUSE
 * everywhere else with a message that names the path and the value.
 */

// ── The hops. Facts about the engine and about zod, not about this code. ─────────────

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

test("`.finite()` refuses 1e999 and emits the SAME JSON Schema — the input narrows, the wire does not move", async () => {
  const plain = z.record(z.string(), z.number());
  const finite = z.record(z.string(), z.number().finite());

  assert.equal(plain.safeParse({ "time/fps": Infinity }).success, true,
    "the pre-226 input schema is the door 1e999 walked through");
  assert.equal(finite.safeParse({ "time/fps": Infinity }).success, false);
  assert.equal(finite.safeParse({ "time/fps": 60 }).success, true,
    "narrowing must not cost a legitimate baseline");

  // 🔴 THE PROPERTY THE RELEASE TURNS ON, AND IT IS ASSERTED AGAINST THE REAL EMITTER
  // RATHER THAN A LIBRARY CALL. `wire_diff.mjs` classifies `tools/list`, so that is what
  // this reads: two tools registered side by side, listed through the SDK, and compared
  // as bytes. If `.finite()` ever started emitting a keyword, this narrowing would become
  // a wire change and the cut would reclassify — which is exactly the disagreement
  // between prose and classifier that 226 §2 exists to close.
  const server = new McpServer({ name: "finiteness-probe", version: "0" });
  server.registerTool("probe_plain", { description: "d", inputSchema: { baseline: plain } }, async () => ({ content: [] }));
  server.registerTool("probe_finite", { description: "d", inputSchema: { baseline: finite } }, async () => ({ content: [] }));
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await Promise.all([server.connect(b), client.connect(a)]);
  const listed = (await client.listTools()).tools;
  const byName = Object.fromEntries(listed.map((t) => [t.name, t.inputSchema]));
  assert.equal(JSON.stringify(byName.probe_finite), JSON.stringify(byName.probe_plain),
    "`.finite()` must be invisible on the wire, or this release is not a MINOR");
  await client.close();
});

// ── The finder. ──────────────────────────────────────────────────────────────────────

test("findNonFinite names every path and says which value it was", () => {
  const hits = findNonFinite({
    monitors: { "time/fps": Infinity, "memory/static": 24090747, "audio/output_latency": -Infinity },
    regressions: [{ key: "time/fps", baseline: NaN, current: 1 }],
  });
  assert.deepEqual(hits, [
    { path: "monitors.time/fps", value: "Infinity" },
    { path: "monitors.audio/output_latency", value: "-Infinity" },
    { path: "regressions[0].baseline", value: "NaN" },
  ]);
});

test("a clean reply produces no hits and is never copied", () => {
  const reply = { monitors: { "time/fps": 60 }, regressions: [] };
  assert.deepEqual(findNonFinite(reply), []);
  assert.equal(tolerate(reply), reply, "the untouched path must not copy the tree on every bridge reply");
});

test("the walk terminates on a self-referential reply rather than recursing forever", () => {
  const cyclic: Record<string, unknown> = { a: 1 };
  cyclic.self = cyclic;
  assert.deepEqual(findNonFinite(cyclic), []);   // must return, not blow the stack
});

test("the depth cap is a real cap, not a comment", () => {
  // 65 levels deep — one past MAX_DEPTH — so the Infinity at the bottom is NOT reported.
  let deep: Record<string, unknown> = { v: Infinity };
  for (let i = 0; i < 66; i++) deep = { d: deep };
  assert.deepEqual(findNonFinite(deep), [], "a runaway guard that never fires is not a guard");
  // And one comfortably inside it IS reported, so the cap is not simply swallowing input.
  let shallow: Record<string, unknown> = { v: Infinity };
  for (let i = 0; i < 4; i++) shallow = { d: shallow };
  assert.equal(findNonFinite(shallow).length, 1);
});

test("the refusal message names the path AND the value, and is capped", () => {
  const one = describeNonFinite([{ path: "current", value: "Infinity" }]);
  assert.match(one, /current=Infinity/);
  assert.match(one, /refused/, "the message must say what happened to the call, not just what was seen");

  const many = Array.from({ length: MESSAGE_CAP + 3 }, (_, i) => ({ path: `k${i}`, value: "NaN" }));
  const msg = describeNonFinite(many);
  assert.match(msg, new RegExp(`\\+3 more`));
  assert.equal(msg.includes(`k${MESSAGE_CAP}=`), false, "past the cap the paths must not be listed");
  assert.match(msg, new RegExp(`${many.length} non-finite`), "the TOTAL is stated even when the list is cut");
});

// ── The tolerant policy: prune and roster, never null. ────────────────────────────────

test("pruneRecord drops what is not a number and keeps what is", () => {
  const { kept, dropped } = pruneRecord({ a: 1, b: Infinity, c: 2.5, d: NaN, e: -Infinity });
  assert.deepEqual(kept, { a: 1, c: 2.5 });
  assert.deepEqual(dropped, ["b", "d", "e"]);
});

test("tolerate prunes monitors and rosters the key — ABSENT, not null", () => {
  const fromWire = JSON.parse('{"monitors":{"time/fps":1e99999,"memory/static":24090747.0}}');
  assert.equal(fromWire.monitors["time/fps"], Infinity);

  const out = tolerate(fromWire) as any;
  assert.equal("time/fps" in out.monitors, false, "a reading that is not a number must not be reported as null");
  assert.equal(out.monitors["memory/static"], 24090747, "containment is not blanket pruning");
  assert.deepEqual(out[NON_FINITE_KEY], ["time/fps"]);

  // 🔴 AND THE SHIPPED SCHEMA — the one whose value type did NOT move — accepts it.
  assert.equal(z.object(outputSchemas.runtime_get_monitors).safeParse(out).success, true);
});

test("the roster is attached only when there is one", () => {
  const clean = tolerate({ monitors: { "time/fps": 60 } }) as Record<string, unknown>;
  assert.equal(NON_FINITE_KEY in clean, false, "an always-present empty array would be a new required field");
});

test("tolerate drops a comparison it cannot make and leaves ok/checked to the addon", () => {
  const fromWire = JSON.parse(
    '{"ok":false,"checked":2,"monitors":{"time/fps":60.0},' +
    '"regressions":[{"key":"time/fps","baseline":1e99999,"current":60.0,"direction":"higher_better"},' +
    '{"key":"render/total_draw_calls","baseline":100.0,"current":140.0,"direction":"lower_better"}]}',
  );
  const out = tolerate(fromWire) as any;

  assert.equal(out.regressions.length, 1, "a row with a non-finite side cannot be a comparison");
  assert.equal(out.regressions[0].key, "render/total_draw_calls", "the comparable row survives untouched");
  assert.deepEqual(out[NON_FINITE_KEY], ["time/fps"]);
  assert.equal(out.ok, false, "this host does not re-decide the assertion");
  assert.equal(out.checked, 2, "…nor re-count it");

  assert.equal(z.object(outputSchemas.runtime_assert_perf).safeParse(out).success, true);
});

test("the two tolerant schemas still REFUSE null — the type did not move", () => {
  const monitors = z.object(outputSchemas.runtime_get_monitors);
  assert.equal(monitors.safeParse({ monitors: { "time/fps": null } }).success, false,
    "admitting null is exactly the MAJOR wire change 226 §2 backed out");
  const perf = z.object(outputSchemas.runtime_assert_perf);
  assert.equal(
    perf.safeParse({
      ok: true, checked: 1, monitors: {},
      regressions: [{ key: "k", baseline: null, current: 1, direction: "higher_better" }],
    }).success,
    false,
  );
});

// ── The derivation. The set exists in ONE place and is asserted against two readers. ──

test("NON_FINITE_TOLERANT equals the shipped schemas declaring non_finite, BOTH ways", () => {
  const declaring = Object.entries(outputSchemas)
    .filter(([, shape]) => NON_FINITE_KEY in shape)
    .map(([name]) => name)
    .sort();
  const tolerant = [...NON_FINITE_TOLERANT.keys()].sort();

  assert.deepEqual(tolerant, declaring,
    "a tool that prunes without declaring the roster loses it at the parse; a tool that " +
    "declares it without pruning never fills it. Neither half is allowed to move alone.");
  assert.ok(declaring.length >= 2, "a floor: an empty set would make this assertion vacuous");
});

test("every tolerant METHOD is actually called by tools/runtime.ts — a rename cannot orphan one", () => {
  const src = fs.readFileSync(path.join(hostRoot(), "src", "tools", "runtime.ts"), "utf8");
  for (const method of TOLERANT_METHODS) {
    assert.match(src, new RegExp(`["'\`]${method.replace(".", "\\.")}["'\`]`),
      `${method} is in the tolerant set but nothing in runtime.ts calls it`);
  }
  assert.equal(TOLERANT_METHODS.size, NON_FINITE_TOLERANT.size, "the method view must not collapse two tools onto one method");
});

// ── The boundary, end to end, through a real socket. ──────────────────────────────────

/**
 * 🔴 THE MOCK WRITES RAW BYTES, AND THAT IS THE WHOLE POINT. Replying through
 * `JSON.stringify` would turn the engine's `1e99999` back into `null` before it ever
 * left the fake addon — the test would then be measuring `JSON.stringify`, pass for the
 * wrong reason, and prove nothing about the boundary. `resultJson` is the literal Godot
 * emits.
 */
async function startBridge(resultJson: string): Promise<TcpServer> {
  return startTcpServer((s) => {
    const parse = makeLineParser((line) => {
      const req = JSON.parse(line) as { id: string };
      s.write(`{"id":${JSON.stringify(req.id)},"ok":true,"result":${resultJson}}\n`);
    });
    s.on("data", (c) => parse(Buffer.from(c)));
  });
}

test("a non-tolerant method REFUSES a non-finite reply, naming the path — it does not hand back null", async () => {
  const srv = await startBridge('{"previous":1.0,"current":1e99999}');
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  await assert.rejects(
    client.request("runtime.time_scale", {}),
    (e) =>
      e instanceof BridgeError &&
      e.code === "non_finite" &&
      /current=Infinity/.test(e.message),
    "before 226 this resolved, passed z.number() under zod 3, and reached the client as null",
  );
  client.close();
  await srv.close();
});

test("a tolerant method PRUNES the same reply instead of refusing", async () => {
  const srv = await startBridge('{"monitors":{"time/fps":1e99999,"memory/static":24090747.0}}');
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  const r = await client.request<any>("runtime.get_monitors", {});
  assert.deepEqual(r.monitors, { "memory/static": 24090747 });
  assert.deepEqual(r[NON_FINITE_KEY], ["time/fps"]);
  client.close();
  await srv.close();
});

test("a finite reply is untouched on BOTH policies — the guard costs the normal path nothing", async () => {
  for (const method of ["runtime.time_scale", "runtime.get_monitors"]) {
    const srv = await startBridge('{"monitors":{"time/fps":60},"previous":1,"current":1}');
    const client = new BridgeClient("127.0.0.1", srv.port, 5000);
    const r = await client.request<any>(method, {});
    assert.deepEqual(r, { monitors: { "time/fps": 60 }, previous: 1, current: 1 });
    assert.equal(NON_FINITE_KEY in r, false);
    client.close();
    await srv.close();
  }
});

// ── Recorded so a later session does not re-litigate it. ──────────────────────────────

test("runtime_screenshot_diff's ratio is division-guarded in the addon and stays a plain number", () => {
  // Measured: `diff_ratio` is `(float(differing) / float(total)) if total > 0 else 0.0` in
  // runtime_bridge.gd, so it cannot be NaN. It is deliberately NOT nullable — admitting a
  // null it cannot produce would be a schema claiming a case that does not exist.
  const shape = outputSchemas.runtime_screenshot_diff as Record<string, z.ZodTypeAny>;
  assert.equal(shape.diff_ratio.safeParse(null).success, false);
  assert.equal(shape.diff_ratio.safeParse(0.25).success, true);
});

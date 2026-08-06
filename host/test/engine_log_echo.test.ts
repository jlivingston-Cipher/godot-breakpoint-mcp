// D1a — the engine-error echo, host side.
//
// 🔴 THE ADDON DOES THE WORK AND NO UNIT TEST CAN SEE IT. `_attach_engine_log`
// runs inside a running Godot game; the host adds not one line to the request
// path, because the 22 tools in this roster resolve their reply as the bridge's
// `result` verbatim. That is exactly 208 §6's class — a test that builds its own
// subject cannot prove production is wired — so the LIVE proof lives in
// `test-integration/runtime-capture.integration.mjs`, which drives a real engine
// on 4.3, 4.5 and 4.7 and asserts both arms.
//
// What is provable HERE is the half that would otherwise be provable nowhere:
// the ROSTER. `structuredContent` is validated against `outputSchema` by both SDK
// clients, which THROW on a mismatch (208 §4). So a tool that receives the field
// and does not declare it breaks every conforming caller, and a tool that
// declares it and can never receive it lies in its own catalog entry. The split
// is 22 and 5, and it is derived from the handlers rather than typed twice.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { outputSchemas } from "../src/schemas.js";

// 🔴 WALKED, NOT COUNTED IN `..`s. This suite runs COMPILED, out of
// `dist-test/test/`, so a relative hop that is right in the source tree is wrong
// where it actually executes — and it fails as an ENOENT inside a helper rather
// than as a missing roster, which reads like a broken test instead of a moved
// file. Climbing to the directory that HAS the file is correct from both.
function hostRoot(): string {
  let d = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(d, "src", "tools", "runtime.ts"))) return d;
    d = dirname(d);
  }
  throw new Error("could not locate host/ from " + dirname(fileURLToPath(import.meta.url)));
}
const RUNTIME_TS = join(hostRoot(), "src", "tools", "runtime.ts");

/**
 * Every tool in tools/runtime.ts whose handler is a bare `call("runtime.…")`.
 * 🔴 READ FROM THE HANDLERS, NOT LISTED HERE. A roster typed into this file is a
 * second copy of a fact, and the copy nobody re-reads is the one that drifts —
 * the whole reason `engine_log` reaches these tools without a line of host code
 * is that their reply IS the bridge reply, which is a property of the handler.
 */
function forwardingTools(): { forwards: string[]; builds: string[] } {
  const src = readFileSync(RUNTIME_TS, "utf8");
  const parts = src.split(/server\.registerTool\(\s*"/).slice(1);
  const forwards: string[] = [];
  const builds: string[] = [];
  for (const p of parts) {
    const name = p.split('"')[0];
    const body = p.split("server.registerTool")[0];
    (/\bcall\(\s*"runtime\./.test(body) ? forwards : builds).push(name);
  }
  return { forwards, builds };
}

describe("D1a: the engine-error echo is declared exactly where it can arrive", () => {
  const { forwards, builds } = forwardingTools();

  it("the derived roster has not collapsed", () => {
    // 🔴 A FLOOR ON THE POPULATION, because every assertion below is a `for` loop
    // over it. A regex that stopped matching leaves them all vacuously true —
    // 172 §10.21's shape, and the reason this file is not just two loops.
    assert.ok(forwards.length >= 20, `forwarding roster collapsed to ${forwards.length}: ${forwards}`);
    assert.ok(builds.length >= 4, `the excluded set collapsed to ${builds.length}: ${builds}`);
    assert.equal(
      forwards.length + builds.length,
      new Set([...forwards, ...builds]).size,
      "a tool was counted twice — the split must be a partition",
    );
  });

  it("every forwarding tool DECLARES engine_log", () => {
    const missing = forwards.filter((n) => !(outputSchemas[n] as Record<string, unknown>)?.engine_log);
    assert.deepEqual(
      missing,
      [],
      `these tools return the bridge reply verbatim, so the addon's engine_log reaches their `
        + `structuredContent — and an undeclared field makes a conforming client throw: ${missing}`,
    );
  });

  it("no tool that BUILDS its reply declares it", () => {
    const overreach = builds.filter((n) => (outputSchemas[n] as Record<string, unknown>)?.engine_log);
    assert.deepEqual(
      overreach,
      [],
      `these tools construct their own result — screenshot builds an image, await_condition polls, `
        + `the peer tools fan out — so engine_log can never arrive and declaring it documents a `
        + `field that is always absent: ${overreach}`,
    );
  });

  it("the declared shape carries the count SEPARATELY from the capped list", () => {
    // 🔴 THE FIELD THE CAP MAKES NECESSARY. Twenty entries out of two hundred and
    // twenty out of twenty are the same list; only `total` tells them apart, and a
    // schema that dropped it would make the cap silently lossy.
    const shape = outputSchemas["runtime_call_method"] as Record<string, { safeParse?: unknown }>;
    const parsed = (shape.engine_log as unknown as {
      safeParse: (v: unknown) => { success: boolean };
    }).safeParse({
      entries: [{ seq: 7, level: "error", message: "boom" }],
      total: 41,
      since_seq: 6,
    });
    assert.equal(parsed.success, true, "a well-formed echo must validate against the declared shape");
  });

  it("is OPTIONAL, so a quiet call may omit it entirely", () => {
    // 208 §4: no SDK materialises a documented default, so absent and explicitly
    // empty are different values to a client. The addon sends nothing when there
    // is nothing, and this is what makes that legal.
    const shape = outputSchemas["runtime_get_property"] as Record<string, unknown>;
    const field = shape.engine_log as { safeParse: (v: unknown) => { success: boolean } };
    assert.equal(field.safeParse(undefined).success, true, "engine_log must accept being absent");
    assert.equal(
      field.safeParse({ entries: [], total: 0 }).success,
      false,
      "but a malformed one must still be rejected — optional is not unchecked",
    );
  });
});

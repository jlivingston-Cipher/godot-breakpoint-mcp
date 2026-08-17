import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { escapesProject, resolveSourceFile, type PlaneWording } from "../src/paths.js";
import { registerLspTools } from "../src/tools/lsp.js";
import { registerCsLspTools } from "../src/tools/cslsp.js";
import { registerDapTools } from "../src/tools/dap.js";
import { registerCsDapTools } from "../src/tools/csdap.js";

/**
 * Session 162 — the guard the four language/debug planes now SHARE, and the proof
 * that each of them is actually WIRED to it.
 *
 * 🔴 The file is split down the middle on purpose, the same way 161 split
 * `paths_guard` from `tabletop_guard`: the first half proves the helper, the second
 * proves the wiring. A helper can be perfect and still guard nothing. 161 §4 caught
 * exactly that — `clearStaleTab` was asserted on one of four call sites, and deleting
 * it from the other three survived the mutation sweep. This session's measurement
 * caught the same shape again: `dbg_goto` takes a `path`, and was the ONE path-taking
 * tool on its plane with no guard at all.
 */

const GD: PlaneWording = {
  root: "the Godot project root",
  escapeHint: "Pass a res:// path, or a path inside the project.",
  missingHint: "It was previously opened as an EMPTY document.",
};
const ANCHORED: PlaneWording = { ...GD, root: "the C# project root", anchoredOnly: true };

/** lsp · cslsp · dap · csdap. Pinned so the reachability floor below cannot be satisfied
 *  by a table that quietly lost a row — dbg_scene_guard's REFUSED_ROWS idiom. */
const PLANE_ROWS = 4;

/** A real root with a real sibling SHARING its string prefix — the sibling is the point. */
function workspace(): { root: string; evil: string; cleanup: () => void } {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gcb-plane-")));
  const root = path.join(base, "proj");
  const evil = `${root}_evil`;
  fs.mkdirSync(root);
  fs.mkdirSync(evil);
  fs.mkdirSync(path.join(root, "adir"));
  fs.writeFileSync(path.join(root, "inside.gd"), "extends Node\n");
  fs.writeFileSync(path.join(evil, "outside.gd"), "extends Node\n");
  return { root, evil, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}

const refusalOf = (fn: () => unknown): { code: string; message: string } => {
  try {
    fn();
  } catch (err) {
    const e = err as { code?: string; message?: string; refusal?: boolean };
    assert.equal(e.refusal, true, "a guard must raise a REFUSAL, not a bare Error");
    return { code: e.code ?? "", message: e.message ?? "" };
  }
  throw new Error("expected a refusal, got none");
};

// ------------------------------------------------------ half 1: the helper ----

test("escapesProject compares against root + sep, so a prefix-sharing sibling escapes", () => {
  const root = "/tmp/base/proj";
  assert.equal(escapesProject("/tmp/base/proj/a.gd", root), false);
  assert.equal(escapesProject(root, root), false, "the root itself is not an escape");
  // 🔴 The whole reason the comparison is not a bare startsWith(root).
  assert.equal(escapesProject("/tmp/base/proj_evil/outside.gd", root), true);
  assert.equal(escapesProject("/tmp/base/elsewhere/outside.gd", root), true);
});

test("resolveSourceFile refuses every escaping spelling and names the plane's root", () => {
  const { root, cleanup } = workspace();
  try {
    for (const spelling of ["res://../proj_evil/outside.gd", "../proj_evil/outside.gd", `${root}_evil/outside.gd`]) {
      const r = refusalOf(() => resolveSourceFile(spelling, root, GD));
      assert.equal(r.code, "path_outside_project", `${spelling} must be refused as an ESCAPE`);
      // BY REASON: the existence guard would also refuse a non-existent target, and a
      // test that only checks "it threw" cannot tell which guard fired. Every target
      // above is a REAL file, so only the escape guard can be what refused it.
      assert.match(r.message, /outside the Godot project root/);
    }
  } finally { cleanup(); }
});

test("resolveSourceFile separates missing from directory from empty", () => {
  const { root, cleanup } = workspace();
  try {
    assert.equal(refusalOf(() => resolveSourceFile("res://nope.gd", root, GD)).code, "file_not_found");
    assert.equal(refusalOf(() => resolveSourceFile("res://adir", root, GD)).code, "not_a_file");
    const empty = refusalOf(() => resolveSourceFile("", root, { ...GD, emptyNote: " (an empty path resolves to the project root)" }));
    assert.equal(empty.code, "not_a_file");
    assert.match(empty.message, /project root/, "an empty path must say WHERE it resolved");
    assert.equal(resolveSourceFile("res://inside.gd", root, GD), path.join(root, "inside.gd"));
  } finally { cleanup(); }
});

test("anchoredOnly leaves an ABSOLUTE path outside the root legal — csdap's documented mainline", () => {
  const { root, evil, cleanup } = workspace();
  try {
    const outside = path.join(evil, "outside.gd");
    // 🔴 MEASURED (162), not assumed: cs_dbg_launch documents debugging a different
    // .NET program, so an absolute path elsewhere must survive. The cs-dap gate's own
    // fixture source IS this case.
    assert.equal(resolveSourceFile(outside, root, ANCHORED), outside);
    // …but a project-anchored spelling reaching the same file is still refused.
    const r = refusalOf(() => resolveSourceFile("res://../proj_evil/outside.gd", root, ANCHORED));
    assert.equal(r.code, "path_outside_project");
    assert.match(r.message, /outside the C# project root/);
    // …and existence is still checked for the absolute form. Location-independent.
    assert.equal(refusalOf(() => resolveSourceFile(path.join(evil, "nope.gd"), root, ANCHORED)).code, "file_not_found");
  } finally { cleanup(); }
});

// ------------------------------------------------------ half 2: the WIRING ----
//
// A helper that refuses correctly guards nothing until every call site calls it.
// These register the real tool families against recording stubs and assert that the
// refusal reaches the CALLER — and, just as load-bearing, that the escaping path never
// reached the transport.

type Handler = (args: Record<string, unknown>, extra: unknown) => Promise<{ isError?: boolean; content?: Array<{ text?: string }> }>;

function collect(register: (s: unknown, c: unknown, cfg: unknown) => void, client: unknown, cfg: unknown) {
  const handlers = new Map<string, Handler>();
  register({
    registerTool: (name: string, _c: unknown, h: Handler) => handlers.set(name, h),
    registerResource: () => {},
    server: { elicitInput: async () => ({ action: "decline" }) },
  }, client, cfg);
  return handlers;
}

const textOf = (r: { content?: Array<{ text?: string }> }) => r.content?.[0]?.text ?? "";

test("all four planes REFUSE an escaping path, and none of them reaches its transport", async () => {
  const { root, cleanup } = workspace();
  const escape = "res://../proj_evil/outside.gd";
  try {
    const wire: string[] = [];
    const lspStub = {
      getServerCapabilities: async () => new Proxy({}, { get: () => true }),
      ensureOpen: async (uri: string) => { wire.push(`ensureOpen ${uri}`); },
      request: async (m: string) => { wire.push(`request ${m}`); return null; },
      waitForDiagnostics: async () => { wire.push("waitForDiagnostics"); return []; },
    };
    const dapStub = {
      hasSession: true, state: "stopped", isStopped: true, threadId: () => 1,
      // 🔴 supportsGotoTargetsRequest ADVERTISED on purpose. No real Godot build
      // advertises it, so `dbg_goto`'s capability check returns before the guard and
      // the live gate CANNOT reach this code at all — which is exactly how it went
      // unguarded through 1.39.0. The unit suite is the only place this is reachable.
      capabilities: { supportsGotoTargetsRequest: true },
      droppedBreakpointModifiers: () => [],
      setBreakpoints: async (p: string) => { wire.push(`setBreakpoints ${p}`); return { buffered: true, breakpoints: [] }; },
      request: async (m: string, params: unknown) => { wire.push(`request ${m} ${JSON.stringify(params)}`); return {}; },
    };
    const gdCfg = { projectPath: root, projectUri: `file://${root}`, runtimeHost: "127.0.0.1", runtimePort: 9081 };
    const csCfg = { ...gdCfg, csLspProjectPath: root, csDapProjectPath: root };

    const planes: Array<[string, Map<string, Handler>, string, RegExp]> = [
      ["lsp.ts", collect(registerLspTools as never, lspStub, gdCfg), "gd_document_symbols", /outside the Godot project root/],
      ["cslsp.ts", collect(registerCsLspTools as never, lspStub, csCfg), "cs_document_symbols", /outside the C# project root/],
      ["dap.ts", collect(registerDapTools as never, dapStub, gdCfg), "dbg_set_breakpoints", /outside the Godot project root/],
      ["csdap.ts", collect(registerCsDapTools as never, dapStub, csCfg), "cs_dbg_set_breakpoints", /outside the C# project root/],
    ];
    assert.equal(planes.length, PLANE_ROWS, "the plane table shrank — this test covers what it enumerates");
    for (const [plane, handlers, tool, reason] of planes) {
      const h = handlers.get(tool);
      assert.ok(h, `${plane} must register ${tool}`);
      const r = await h({ path: escape, lines: [1], line: 0, character: 0 }, {});
      assert.equal(r.isError, true, `${plane}: ${tool} must refuse an escaping path`);
      assert.match(textOf(r), reason, `${plane}: refused BY REASON, not by the existence guard`);
      // The refusal must be the HOST's, never dressed as a backend failure.
      assert.doesNotMatch(textOf(r), /^(LSP|DAP|C# DAP) error/, `${plane}: a refusal is not a backend error`);
    }
    assert.deepEqual(wire, [], "no escaping path may reach any transport");

    // …and every one of the four planes CAN reach its transport, so the emptiness above is
    // four guards doing their job and not a plane that is silently unreachable.
    // 🔴 214 §7.5: without this, `wire` is initialised to [] and NOTHING in this unit ever
    // showed it could fill — the assertion above would read green against a plane whose
    // handler never wires anything at all. This is :196's shape (refuse, assert empty, then
    // run the legal case and assert it filled), applied once PER PLANE rather than once for
    // the unit: a single legal call would floor the collection while leaving three of the
    // four transports exactly as unproven as before.
    const legal = "res://inside.gd";
    for (const [plane, handlers, tool] of planes) {
      const before = wire.length;
      await handlers.get(tool)!({ path: legal, lines: [1], line: 0, character: 0 }, {});
      assert.ok(
        wire.length > before,
        `${plane}: a path INSIDE the root must reach the transport — ${tool} wired nothing, so the refusal above proves nothing`,
      );
    }
    // 🔴 …and the same floor once more against a PINNED count rather than a running one.
    // 215: the per-plane check above compares `wire.length` to `before` — a variable — so
    // it is a floor a reader can follow and an instrument cannot: 214's finder resolves a
    // control by the literal or named constant a size is compared to, and `before` is
    // neither. That is a finder limitation, but `assert.equal(<boolean>, true)` was the
    // shape this line had first, and THAT was simply bad. Pinned against PLANE_ROWS it is
    // better code and readable by both.
    assert.ok(wire.length >= PLANE_ROWS, `all ${PLANE_ROWS} planes must be reachable, got ${wire.length} wire entries`);
  } finally { cleanup(); }
});

test("dbg_goto guards its path — the tool 161 §8 item 5 did not know was unguarded", async () => {
  const { root, cleanup } = workspace();
  try {
    const wire: string[] = [];
    const dapStub = {
      // 🔴 A STOPPED SESSION IS THE PREMISE NOW (262): `dbg_goto` moves the program
      // counter within the current stopped frame, so it refuses a running program before
      // it ever resolves a path. Without these two the path claims below would pass for
      // the wrong reason — the sharpest way a guard's test can rot.
      hasSession: true, state: "stopped", isStopped: true,
      capabilities: { supportsGotoTargetsRequest: true },
      threadId: () => 1,
      droppedBreakpointModifiers: () => [],
      request: async (m: string, params: unknown) => { wire.push(`${m} ${JSON.stringify(params)}`); return { targets: [] }; },
    };
    const handlers = collect(registerDapTools as never, dapStub, { projectPath: root, runtimeHost: "127.0.0.1", runtimePort: 9081 });
    const goto = handlers.get("dbg_goto");
    assert.ok(goto, "dbg_goto must be registered");

    const esc = await goto({ path: "res://../proj_evil/outside.gd", line: 1, confirm: true }, {});
    assert.equal(esc.isError, true);
    assert.match(textOf(esc), /outside the Godot project root/, "refused BY REASON — a REAL file outside the root");

    const missing = await goto({ path: "res://nope.gd", line: 1, confirm: true }, {});
    assert.match(textOf(missing), /no such file/, "dbg_goto also gained the existence check it never had");

    assert.deepEqual(wire, [], "neither call may reach the adapter");

    // …and the legal case still goes through, so the guard is not over-eager.
    await goto({ path: "res://inside.gd", line: 1, confirm: true }, {});
    assert.equal(wire.length, 1, "a path inside the root still reaches gotoTargets");
    assert.match(wire[0] ?? "", /^gotoTargets /);
  } finally { cleanup(); }
});

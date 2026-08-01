import { test, before } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DapClient } from "../src/dap.js";
import { registerDapTools } from "../src/tools/dap.js";
import { loadConfig, type Config } from "../src/config.js";
import { makeRecordingServer, type ToolResultLike } from "./helpers/recording-server.js";
import { startTcpServer, makeFrameParser, writeFrame, encodeFrame, type TcpServer } from "./helpers/tcp.js";

interface DapMsg { seq: number; type: string; command?: string; arguments?: Record<string, unknown>; request_seq?: number; success?: boolean; event?: string; body?: unknown }

function dapResponse(s: net.Socket, req: DapMsg, body: Record<string, unknown> = {}, success = true): void {
  writeFrame(s, { seq: 0, type: "response", request_seq: req.seq, success, command: req.command, body });
}
function dapEvent(s: net.Socket, event: string, body: Record<string, unknown> = {}): void {
  writeFrame(s, { seq: 0, type: "event", event, body });
}

/** Handle the initialize/launch/attach/configurationDone handshake. Returns true if consumed. */
function handshake(msg: DapMsg, s: net.Socket): boolean {
  switch (msg.command) {
    case "initialize":
      dapResponse(s, msg, { supportsConfigurationDoneRequest: true });
      dapEvent(s, "initialized", {});
      return true;
    case "launch":
    case "attach":
      dapResponse(s, msg, {});
      return true;
    case "configurationDone":
      dapResponse(s, msg, {});
      return true;
  }
  return false;
}

async function startDap(handle: (msg: DapMsg, s: net.Socket) => void): Promise<{ srv: TcpServer; received: DapMsg[] }> {
  const received: DapMsg[] = [];
  const srv = await startTcpServer((s) => {
    const parse = makeFrameParser((m) => { const msg = m as unknown as DapMsg; received.push(msg); handle(msg, s); });
    s.on("data", (c) => parse(Buffer.from(c)));
  });
  return { srv, received };
}

function makeConfig(projectPath: string): Config {
  const saved = process.env.GODOT_PROJECT;
  process.env.GODOT_PROJECT = projectPath;
  try { return loadConfig(); } finally {
    if (saved === undefined) delete process.env.GODOT_PROJECT; else process.env.GODOT_PROJECT = saved;
  }
}

/**
 * A temp project root — seeded with `player.gd`, because `dbg_set_breakpoints` now
 * refuses a source that names nothing (session 159). These tests have always MEANT
 * "a real script at player.gd:10"; before the refusal existed an empty temp dir
 * happened to be indistinguishable from one, which is precisely the defect. Same
 * correction #166 made to csdap.test.ts's fixture.
 */
function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gcb-dap-"));
  fs.writeFileSync(path.join(dir, "player.gd"), `${"\n".repeat(40)}# player.gd fixture\n`);
  return dir;
}


/**
 * The runtime bridge port the harness pretends is configured.
 *
 * It must be a port nothing holds: `dbg_launch` now probes it, so leaving the
 * real 9081 in place would make every launch test depend on whether a game
 * happens to be running on the machine — flaky in exactly the direction that
 * teaches people to ignore the suite. Taking one the kernel hands out and
 * releasing it beats guessing a number.
 */
let freeRuntimePort: number;

function squat(): Promise<{ srv: net.Server; port: number }> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => resolve({ srv, port: (srv.address() as net.AddressInfo).port }));
  });
}

before(async () => {
  const held = await squat();
  freeRuntimePort = held.port;
  await new Promise<void>((r) => held.srv.close(() => r()));
});

function dapHarness(port: number, elicit?: Parameters<typeof makeRecordingServer>[0], runtimePort?: number) {
  const cfg = { ...makeConfig(tmpDir()), runtimeHost: "127.0.0.1", runtimePort: runtimePort ?? freeRuntimePort };
  const dap = new DapClient("127.0.0.1", port, 3000);
  const rec = makeRecordingServer(elicit);
  registerDapTools(rec.server as unknown as Parameters<typeof registerDapTools>[0], dap, cfg);
  return { dap, rec, cfg };
}

test("dbg_launch runs the handshake and reports state 'running'", async () => {
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = dapHarness(srv.port);
  const res = (await rec.handler("dbg_launch")({ scene: "main" })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { session_id: "godot", state: "running", scene: "main" });
  dap.close();
  await srv.close();
});

test("dbg_continue waits for the next 'stopped' event and returns its reason", async () => {
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "continue") {
      dapResponse(s, m, {});
      dapEvent(s, "stopped", { reason: "breakpoint", threadId: 1 });
    }
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_continue")({})) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { state: "stopped", stopped_reason: "breakpoint" });
  dap.close();
  await srv.close();
});

test("dbg_step over issues 'next' and awaits the landing stop", async () => {
  const { srv, received } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "next") {
      dapResponse(s, m, {});
      dapEvent(s, "stopped", { reason: "step", threadId: 1 });
    }
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_step")({ kind: "over" })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { state: "stopped", stopped_reason: "step" });
  assert.ok(received.some((m) => m.command === "next"), "step:over must issue the DAP 'next' command");
  dap.close();
  await srv.close();
});

test("resume() resolves with state 'running' when nothing settles within the wait window", async () => {
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "continue") dapResponse(s, m, {}); // respond, but never emit stopped
  });
  const { dap } = dapHarness(srv.port);
  await dap.start("launch", { project: "/p", scene: "main" });
  const r = await dap.resume("continue", { threadId: 1 }, 80);
  assert.equal(r.state, "running");
  dap.close();
  await srv.close();
});

test("dbg_set_breakpoints buffers before a session is configured", async () => {
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = dapHarness(srv.port);
  const res = (await rec.handler("dbg_set_breakpoints")({ path: "player.gd", lines: [10, 20] })) as ToolResultLike;
  const sc = res.structuredContent as { buffered: boolean; breakpoints: unknown[] };
  assert.equal(sc.buffered, true);
  assert.deepEqual(sc.breakpoints, []);
  dap.close();
  await srv.close();
});

test("dbg_set_breakpoints applies immediately once the session is configured", async () => {
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "setBreakpoints") dapResponse(s, m, { breakpoints: [{ line: 10, verified: true }, { line: 20, verified: false }] });
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_set_breakpoints")({ path: "player.gd", lines: [10, 20] })) as ToolResultLike;
  const sc = res.structuredContent as { buffered: boolean; breakpoints: Array<{ line: number; verified: boolean }> };
  assert.equal(sc.buffered, false);
  assert.deepEqual(sc.breakpoints, [{ line: 10, verified: true }, { line: 20, verified: false }]);
  dap.close();
  await srv.close();
});

test("dbg_evaluate proceeds with confirm:true and returns the evaluated result", async () => {
  const { srv, received } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "evaluate") dapResponse(s, m, { result: "42", type: "int", variablesReference: 0 });
  });
  const { dap, rec } = dapHarness(srv.port, async () => ({ action: "decline" }));
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_evaluate")({ expression: "1 + 41", confirm: true })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { result: "42", type: "int", variables_ref: 0 });
  assert.ok(received.some((m) => m.command === "evaluate"));
  dap.close();
  await srv.close();
});

test("dbg_evaluate is blocked (and sends no evaluate) when the user declines confirmation", async () => {
  const { srv, received } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "evaluate") dapResponse(s, m, { result: "should-not-happen" });
  });
  const { dap, rec } = dapHarness(srv.port, async () => ({ action: "decline" }));
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_evaluate")({ expression: "delete_everything()" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.ok(!received.some((m) => m.command === "evaluate"), "a declined evaluate must never reach the adapter");
  dap.close();
  await srv.close();
});

test("dbg_stack_trace maps DAP stackFrames to the tool's frame shape", async () => {
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "stackTrace") dapResponse(s, m, { stackFrames: [{ id: 1, name: "_ready", source: { path: "/p/player.gd" }, line: 12 }] });
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_stack_trace")({})) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { frames: [{ id: 1, name: "_ready", source: "/p/player.gd", line: 12 }] });
  dap.close();
  await srv.close();
});

test("a failed DAP request surfaces as an isError result", async () => {
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "stackTrace") dapResponse(s, m, { message: "no stack while running" }, false);
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_stack_trace")({})) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /DAP error/);
  dap.close();
  await srv.close();
});

// ---- dbg_watch (watch expressions) ----------------------------------------

test("dbg_watch adds expressions, evaluates them in 'watch' context, and reports per-expression errors", async () => {
  const { srv, received } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "evaluate") {
      const expr = (m.arguments as { expression: string }).expression;
      // DAP error responses carry a TOP-LEVEL `message`, not one inside `body`.
      if (expr === "bogus") { writeFrame(s, { seq: 0, type: "response", request_seq: m.seq, success: false, command: m.command, message: "not in scope" }); return; }
      dapResponse(s, m, { result: `${expr}=7`, type: "int" });
    }
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_watch")({ add: ["hp", "bogus"] })) as ToolResultLike;
  const sc = res.structuredContent as { watches: Array<{ expression: string; value: string; type: string; error: string | null }> };
  assert.equal(sc.watches.length, 2);
  assert.deepEqual(sc.watches[0], { expression: "hp", value: "hp=7", type: "int", error: null });
  assert.equal(sc.watches[1].expression, "bogus");
  assert.match(sc.watches[1].error ?? "", /not in scope/);
  const ev = received.find((m) => m.command === "evaluate");
  assert.equal((ev!.arguments as { context: string }).context, "watch", "watches must evaluate in the side-effect-free 'watch' context");
  dap.close();
  await srv.close();
});

test("dbg_watch persists the set and re-evaluates on a bare call (after a step/continue)", async () => {
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "evaluate") dapResponse(s, m, { result: "v", type: "int" });
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  await rec.handler("dbg_watch")({ add: ["a", "b"] });
  const res = (await rec.handler("dbg_watch")({})) as ToolResultLike; // no mutation → re-read
  const sc = res.structuredContent as { watches: Array<{ expression: string }> };
  assert.deepEqual(sc.watches.map((w) => w.expression), ["a", "b"]);
  dap.close();
  await srv.close();
});

test("dbg_watch remove and clear mutate the persistent set", async () => {
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "evaluate") dapResponse(s, m, { result: "v", type: "T" });
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  await rec.handler("dbg_watch")({ add: ["a", "b", "c"] });
  let sc = ((await rec.handler("dbg_watch")({ remove: ["b"] })) as ToolResultLike).structuredContent as { watches: Array<{ expression: string }> };
  assert.deepEqual(sc.watches.map((w) => w.expression), ["a", "c"]);
  sc = ((await rec.handler("dbg_watch")({ clear: true, add: ["z"] })) as ToolResultLike).structuredContent as { watches: Array<{ expression: string }> };
  assert.deepEqual(sc.watches.map((w) => w.expression), ["z"]);
  dap.close();
  await srv.close();
});

test("dbg_set_breakpoints forwards conditions, hit conditions, and log messages when the adapter advertises support for them", async () => {
  let bpReq: DapMsg | undefined;
  const { srv } = await startDap((m, s) => {
    if (m.command === "initialize") {
      dapResponse(s, m, { supportsConfigurationDoneRequest: true, supportsConditionalBreakpoints: true, supportsHitConditionalBreakpoints: true, supportsLogPoints: true });
      dapEvent(s, "initialized", {});
      return;
    }
    if (m.command === "launch" || m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    if (m.command === "setBreakpoints") { bpReq = m; dapResponse(s, m, { breakpoints: [{ line: 10, verified: true }, { line: 20, verified: true }] }); }
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  await rec.handler("dbg_set_breakpoints")({
    path: "player.gd",
    lines: [10, 20],
    conditions: ["hp < 0"],
    hit_conditions: [null, ">3"],
    log_messages: [null, "hit {hp}"],
  });
  const bps = (bpReq!.arguments as { breakpoints: Array<Record<string, unknown>> }).breakpoints;
  assert.equal(bps[0].line, 10);
  assert.equal(bps[0].condition, "hp < 0");
  assert.equal(bps[0].hitCondition, undefined);
  assert.equal(bps[0].logMessage, undefined);
  assert.equal(bps[1].line, 20);
  assert.equal(bps[1].condition, undefined);
  assert.equal(bps[1].hitCondition, ">3");
  assert.equal(bps[1].logMessage, "hit {hp}");
  dap.close();
  await srv.close();
});

test("dbg_set_breakpoints drops condition/hitCondition/logMessage and warns when the adapter advertises them unsupported", async () => {
  // The default handshake advertises NONE of the modifier caps — like Godot 4.3, which
  // also IGNORES the fields (verified live), so a "conditional" breakpoint would halt every
  // time. The tool must drop the modifiers, send only plain line breakpoints, and warn.
  let bpReq: DapMsg | undefined;
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "setBreakpoints") { bpReq = m; dapResponse(s, m, { breakpoints: [{ line: 10, verified: true }, { line: 20, verified: true }] }); }
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_set_breakpoints")({
    path: "player.gd",
    lines: [10, 20],
    conditions: ["hp < 0"],
    hit_conditions: [null, ">3"],
    log_messages: [null, "hit {hp}"],
  })) as ToolResultLike;
  const sc = res.structuredContent as { unsupported_modifiers?: string[]; warning?: string; breakpoints: unknown[] };
  assert.deepEqual(sc.unsupported_modifiers, ["condition", "hitCondition", "logMessage"]);
  assert.match(sc.warning ?? "", /unsupported|halt unconditionally/i);
  // The dropped modifiers must NOT reach the adapter — only plain line breakpoints do.
  const bps = (bpReq!.arguments as { breakpoints: Array<Record<string, unknown>> }).breakpoints;
  assert.deepEqual(bps.map((b) => b.line), [10, 20]);
  assert.equal(bps[0].condition, undefined);
  assert.equal(bps[1].hitCondition, undefined);
  assert.equal(bps[1].logMessage, undefined);
  dap.close();
  await srv.close();
});

// ---- dbg_set_exception_breakpoints ----------------------------------------

test("dbg_set_exception_breakpoints forwards filters and reports the adapter's advertised available_filters", async () => {
  let bpReq: DapMsg | undefined;
  const { srv } = await startDap((m, s) => {
    if (m.command === "initialize") {
      dapResponse(s, m, { supportsConfigurationDoneRequest: true, exceptionBreakpointFilters: [
        { filter: "raise", label: "Runtime errors" }, { filter: "assert", label: "Assertion failures" },
      ] });
      dapEvent(s, "initialized", {});
      return;
    }
    if (m.command === "launch" || m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    if (m.command === "setExceptionBreakpoints") { bpReq = m; dapResponse(s, m, { breakpoints: [{ verified: true }] }); }
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_set_exception_breakpoints")({ filters: ["raise"] })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, {
    filters: ["raise"],
    available_filters: [{ filter: "raise", label: "Runtime errors" }, { filter: "assert", label: "Assertion failures" }],
    breakpoints: [{ verified: true }],
  });
  assert.deepEqual((bpReq!.arguments as { filters: string[] }).filters, ["raise"]);
  dap.close();
  await srv.close();
});

test("dbg_set_exception_breakpoints returns 'unsupported' without sending the request when the adapter advertises no filters", async () => {
  // The default handshake advertises NO exceptionBreakpointFilters (like Godot 4.3,
  // which also never answers setExceptionBreakpoints — it would time out). The tool
  // must short-circuit to a clear message instead of sending a request that hangs.
  const { srv, received } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "setExceptionBreakpoints") dapResponse(s, m, {});
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_set_exception_breakpoints")({ filters: ["raise"] })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  assert.ok(!received.some((m) => m.command === "setExceptionBreakpoints"), "must not send setExceptionBreakpoints when no filters are advertised");
  dap.close();
  await srv.close();
});

test("dbg_set_exception_breakpoints clears filters (filters: []) when the adapter advertises some", async () => {
  let bpReq: DapMsg | undefined;
  const { srv } = await startDap((m, s) => {
    if (m.command === "initialize") {
      dapResponse(s, m, { supportsConfigurationDoneRequest: true, exceptionBreakpointFilters: [
        { filter: "raise", label: "Runtime errors" },
      ] });
      dapEvent(s, "initialized", {});
      return;
    }
    if (m.command === "launch" || m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    if (m.command === "setExceptionBreakpoints") { bpReq = m; dapResponse(s, m, { breakpoints: [] }); }
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_set_exception_breakpoints")({})) as ToolResultLike;
  assert.deepEqual(res.structuredContent, {
    filters: [],
    available_filters: [{ filter: "raise", label: "Runtime errors" }],
    breakpoints: [],
  });
  assert.deepEqual((bpReq!.arguments as { filters: string[] }).filters, []);
  dap.close();
  await srv.close();
});

// ---- dbg_set_variable (gated) ---------------------------------------------

test("dbg_set_variable proceeds with confirm:true and returns the adapter's updated value", async () => {
  const { srv, received } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "setVariable") dapResponse(s, m, { value: "5", type: "int", variablesReference: 0 });
  });
  const { dap, rec } = dapHarness(srv.port, async () => ({ action: "decline" }));
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_set_variable")({ variables_ref: 1001, name: "hp", value: "5", confirm: true })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { name: "hp", value: "5", type: "int", variables_ref: 0 });
  const sv = received.find((m) => m.command === "setVariable");
  assert.deepEqual(sv!.arguments, { variablesReference: 1001, name: "hp", value: "5" });
  dap.close();
  await srv.close();
});

test("dbg_set_variable is blocked (and sends no setVariable) when the user declines confirmation", async () => {
  const { srv, received } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "setVariable") dapResponse(s, m, { value: "should-not-happen" });
  });
  const { dap, rec } = dapHarness(srv.port, async () => ({ action: "decline" }));
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_set_variable")({ variables_ref: 1001, name: "hp", value: "0" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.ok(!received.some((m) => m.command === "setVariable"), "a declined setVariable must never reach the adapter");
  dap.close();
  await srv.close();
});

test("dbg_set_variable returns 'unsupported' WITHOUT prompting when the adapter advertises supportsSetVariable:false", async () => {
  let elicited = 0;
  const { srv, received } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true, supportsSetVariable: false }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch" || m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    if (m.command === "setVariable") dapResponse(s, m, { value: "nope" });
  });
  const { dap, rec } = dapHarness(srv.port, async () => { elicited++; return { action: "accept", content: { proceed: true } }; });
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_set_variable")({ variables_ref: 1, name: "hp", value: "5" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  assert.equal(elicited, 0, "must not prompt when the capability is unsupported");
  assert.ok(!received.some((m) => m.command === "setVariable"));
  dap.close();
  await srv.close();
});

// Godot 4.3 advertises supportsSetVariable=true (so the caps short-circuit does NOT fire)
// but then never answers the setVariable request. Without a bounded deadline the tool would
// hang the full dapTimeoutMs; these assert the fast, clear failure via GODOT_DAP_*_TIMEOUT_MS.
test("dbg_set_variable fails fast with a clear message when the adapter advertises supportsSetVariable but never answers", async () => {
  const { srv, received } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true, supportsSetVariable: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch" || m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    // setVariable: deliberately never respond (mirrors Godot 4.3's advertised-but-unimplemented gap)
  });
  process.env.GODOT_DAP_SETVAR_TIMEOUT_MS = "200";
  const { dap, rec } = dapHarness(srv.port, async () => ({ action: "accept", content: { proceed: true } }));
  delete process.env.GODOT_DAP_SETVAR_TIMEOUT_MS;
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_set_variable")({ variables_ref: 1, name: "hp", value: "5", confirm: true })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /did not answer the setVariable request within 200ms/i);
  assert.match(res.content![0].text!, /no change was made/i);
  assert.ok(received.some((m) => m.command === "setVariable"), "the tool must actually send setVariable (caps advertise it) before the bounded deadline fires");
  dap.close();
  await srv.close();
});

test("dbg_evaluate fails fast with a clear message when the adapter never answers evaluate", async () => {
  const { srv, received } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    // evaluate: deliberately never respond
  });
  process.env.GODOT_DAP_EVALUATE_TIMEOUT_MS = "200";
  const { dap, rec } = dapHarness(srv.port, async () => ({ action: "accept", content: { proceed: true } }));
  delete process.env.GODOT_DAP_EVALUATE_TIMEOUT_MS;
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_evaluate")({ expression: "1 + 1", confirm: true })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /did not answer the evaluate request within 200ms/i);
  assert.ok(received.some((m) => m.command === "evaluate"), "the tool must send evaluate before the bounded deadline fires");
  dap.close();
  await srv.close();
});

// dbg_watch re-evaluates its whole watch set at every stop. A single watch expression the
// adapter never answers must fail fast on THAT entry (bounded by dapEvaluateTimeoutMs) rather
// than hanging the full dapTimeoutMs each stop — and must not fail the rest of the call.
test("dbg_watch fails fast per expression (bounded by dapEvaluateTimeoutMs) when the adapter never answers a watch evaluate", async () => {
  const { srv, received } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    // evaluate: deliberately never respond (a watch expression the adapter stalls on)
  });
  process.env.GODOT_DAP_EVALUATE_TIMEOUT_MS = "200";
  const { dap, rec } = dapHarness(srv.port);
  delete process.env.GODOT_DAP_EVALUATE_TIMEOUT_MS;
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_watch")({ add: ["hp"] })) as ToolResultLike;
  // A stalling watch does NOT error the whole call — it surfaces as a per-entry error…
  assert.notEqual(res.isError, true);
  const sc = res.structuredContent as { watches: Array<{ expression: string; value: string; type: string; error: string | null }> };
  assert.equal(sc.watches.length, 1);
  assert.equal(sc.watches[0].expression, "hp");
  // …and that error is the bounded 200 ms deadline, not the full 3 s client timeout.
  assert.match(sc.watches[0].error ?? "", /timed out after 200ms/i);
  // The watch evaluate must actually be sent (in watch context) before the bounded deadline fires.
  assert.ok(received.some((m) => m.command === "evaluate"), "dbg_watch must send the watch evaluate before failing fast");
  dap.close();
  await srv.close();
});

// ---- dbg_restart -----------------------------------------------------------

test("dbg_restart uses the DAP restart request when the adapter advertises supportsRestartRequest", async () => {
  let restarted = false;
  const { srv, received } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true, supportsRestartRequest: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch" || m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    if (m.command === "restart") { restarted = true; dapResponse(s, m, {}); dapEvent(s, "stopped", { reason: "entry", threadId: 1 }); }
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_restart")({})) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { session_id: "godot", method: "restart", state: "stopped", scene: "main" });
  assert.ok(restarted, "must issue the DAP 'restart' command");
  assert.ok(!received.some((m) => m.command === "terminate"), "a native restart must not terminate the session");
  dap.close();
  await srv.close();
});

test("dbg_restart falls back to terminate + relaunch when the adapter does not support restart (scene overridable)", async () => {
  let initializes = 0; let terminated = false;
  const { srv, received } = await startDap((m, s) => {
    if (m.command === "initialize") { initializes++; dapResponse(s, m, { supportsConfigurationDoneRequest: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch" || m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    if (m.command === "terminate") { terminated = true; dapResponse(s, m, {}); return; }
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_restart")({ scene: "current" })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { session_id: "godot", method: "relaunch", state: "running", scene: "current" });
  assert.ok(terminated, "the fallback must terminate the old session");
  assert.equal(initializes, 2, "the fallback must re-run the initialize handshake");
  assert.ok(!received.some((m) => m.command === "restart"), "must not send restart when unsupported");
  dap.close();
  await srv.close();
});

test("dbg_restart errors when there is no session to restart", async () => {
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = dapHarness(srv.port);
  const res = (await rec.handler("dbg_restart")({})) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /no debug session/i);
  dap.close();
  await srv.close();
});

// ---- dbg_goto (gotoTargets + goto, gated) ----------------------------------

test("dbg_goto lists gotoTargets and does not jump when the line has multiple targets", async () => {
  const { srv, received } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true, supportsGotoTargetsRequest: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch" || m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    if (m.command === "gotoTargets") { dapResponse(s, m, { targets: [{ id: 1, label: "line 12 a", line: 12 }, { id: 2, label: "line 12 b", line: 12 }] }); }
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_goto")({ path: "player.gd", line: 12 })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, {
    targets: [{ id: 1, label: "line 12 a", line: 12 }, { id: 2, label: "line 12 b", line: 12 }],
    jumped: false, target_id: null,
  });
  assert.ok(!received.some((m) => m.command === "goto"), "listing targets must not jump");
  dap.close();
  await srv.close();
});

test("dbg_goto jumps to the sole target with confirm:true and issues DAP goto", async () => {
  let gotoArgs: Record<string, unknown> | undefined;
  const { srv } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true, supportsGotoTargetsRequest: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch" || m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    if (m.command === "gotoTargets") { dapResponse(s, m, { targets: [{ id: 7, label: "line 20", line: 20 }] }); return; }
    if (m.command === "goto") { gotoArgs = m.arguments; dapResponse(s, m, {}); }
  });
  const { dap, rec } = dapHarness(srv.port, async () => ({ action: "decline" }));
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_goto")({ path: "player.gd", line: 20, confirm: true })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { targets: [{ id: 7, label: "line 20", line: 20 }], jumped: true, target_id: 7 });
  assert.deepEqual(gotoArgs, { threadId: 1, targetId: 7 });
  dap.close();
  await srv.close();
});

test("dbg_goto is blocked (and issues no goto) when the user declines confirmation", async () => {
  const { srv, received } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true, supportsGotoTargetsRequest: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch" || m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    if (m.command === "gotoTargets") { dapResponse(s, m, { targets: [{ id: 7, label: "line 20", line: 20 }] }); return; }
    if (m.command === "goto") { dapResponse(s, m, {}); }
  });
  const { dap, rec } = dapHarness(srv.port, async () => ({ action: "decline" }));
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_goto")({ path: "player.gd", line: 20 })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.ok(!received.some((m) => m.command === "goto"), "a declined goto must never reach the adapter");
  dap.close();
  await srv.close();
});

test("dbg_goto returns 'unsupported' WITHOUT prompting when the adapter lacks supportsGotoTargetsRequest", async () => {
  let elicited = 0;
  const { srv, received } = await startDap((m, s) => { if (handshake(m, s)) return; if (m.command === "gotoTargets") dapResponse(s, m, { targets: [] }); });
  const { dap, rec } = dapHarness(srv.port, async () => { elicited++; return { action: "accept", content: { proceed: true } }; });
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_goto")({ path: "player.gd", line: 20 })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  assert.equal(elicited, 0, "must not prompt when the capability is unsupported");
  assert.ok(!received.some((m) => m.command === "gotoTargets"), "must not query targets when unsupported");
  dap.close();
  await srv.close();
});

// ---- dbg_data_breakpoints (dataBreakpointInfo + setDataBreakpoints) --------

test("dbg_data_breakpoints resolves dataIds and arms them, reporting verified + unresolved", async () => {
  let setArgs: Record<string, unknown> | undefined;
  const { srv } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true, supportsDataBreakpoints: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch" || m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    if (m.command === "dataBreakpointInfo") {
      const name = (m.arguments as { name: string }).name;
      if (name === "hp") { dapResponse(s, m, { dataId: "hp@1", description: "hp" }); return; }
      dapResponse(s, m, { dataId: null, description: "not watchable" }); return;
    }
    if (m.command === "setDataBreakpoints") { setArgs = m.arguments; dapResponse(s, m, { breakpoints: [{ verified: true }] }); }
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_data_breakpoints")({ watch: [{ name: "hp", variables_ref: 1001, access_type: "write" }, { name: "nope" }] })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, {
    breakpoints: [{ name: "hp", data_id: "hp@1", verified: true }],
    unresolved: [{ name: "nope", reason: "not watchable" }],
  });
  assert.deepEqual(setArgs, { breakpoints: [{ dataId: "hp@1", accessType: "write" }] });
  dap.close();
  await srv.close();
});

test("dbg_data_breakpoints with no watches clears all data breakpoints", async () => {
  let setArgs: Record<string, unknown> | undefined;
  const { srv, received } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true, supportsDataBreakpoints: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch" || m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    if (m.command === "setDataBreakpoints") { setArgs = m.arguments; dapResponse(s, m, { breakpoints: [] }); }
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_data_breakpoints")({})) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { breakpoints: [], unresolved: [] });
  assert.deepEqual(setArgs, { breakpoints: [] });
  assert.ok(!received.some((m) => m.command === "dataBreakpointInfo"), "clearing needs no dataBreakpointInfo");
  dap.close();
  await srv.close();
});

test("dbg_data_breakpoints returns 'unsupported' without sending requests when the adapter lacks supportsDataBreakpoints", async () => {
  const { srv, received } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_data_breakpoints")({ watch: [{ name: "hp" }] })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  assert.ok(!received.some((m) => m.command === "dataBreakpointInfo" || m.command === "setDataBreakpoints"), "no DAP requests when unsupported");
  dap.close();
  await srv.close();
});

/**
 * The DAP plane's share of the port-collision class (1.24.0 closed the
 * godot_run_* half and named this one as still open).
 *
 * The editor launches the game here, so the failure is the same as on the run
 * plane — the new game's autoload cannot bind, keeps running bridgeless, and
 * every runtime_* call answers from whichever process already held the port —
 * but the remedy is different: attach to that process instead of starting a
 * second one.
 */
test("dbg_launch refuses a held runtime port and points at dbg_attach", async () => {
  const { srv: held, port } = await squat();
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = dapHarness(srv.port, undefined, port);
  try {
    const res = (await rec.handler("dbg_launch")({ scene: "main" })) as ToolResultLike;
    assert.equal(res.isError, true);
    const text = res.content?.[0]?.text ?? "";
    assert.match(text, new RegExp(`127\\.0\\.0\\.1:${port} is already bound`));
    assert.match(text, /silently address the process that already holds the port/);
    // EVERY remedy, each with the condition under which it applies. An earlier
    // draft named only dbg_attach and asserted "no tool here can stop it" — true
    // only if the holder is editor-owned, and false in the commonest case of all,
    // a godot_run_managed child that godot_stop clears. The probe cannot know
    // which it is, so the message must not pick one.
    assert.match(text, /dbg_attach/);
    assert.match(text, /godot_stop/);
    assert.match(text, /quit it in the/);
    assert.match(text, /BREAKPOINT_RUNTIME_PORT/);
    assert.match(text, /allow_port_conflict:true/);
    // And the honest reading of the override: dbg_* is unaffected, runtime_* is not.
    assert.match(text, /addressed by session rather than by port/);
    // dbg_attach must not be offered as if it always works.
    assert.match(text, /only if it is already under the/);
    assert.doesNotMatch(
      text,
      /no tool here can stop it/,
      "the probe learns only THAT the port is held, never by what — it must not assert the holder is unstoppable",
    );
  } finally {
    dap.close();
    srv.close();
    held.close();
  }
});

test("dbg_launch honours allow_port_conflict, and the override does not stick", async () => {
  const { srv: held, port } = await squat();
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = dapHarness(srv.port, undefined, port);
  try {
    const ok = (await rec.handler("dbg_launch")({ scene: "main", allow_port_conflict: true })) as ToolResultLike;
    assert.notEqual(ok.isError, true, "the override must actually launch");
    assert.equal((ok.structuredContent as Record<string, unknown>).state, "running");

    const again = (await rec.handler("dbg_launch")({ scene: "main" })) as ToolResultLike;
    assert.equal(again.isError, true, "allow_port_conflict must not persist across calls");
  } finally {
    dap.close();
    srv.close();
    held.close();
  }
});

test("dbg_attach and dbg_restart are NOT port-gated — attach is the remedy, restart would false-positive", async () => {
  // dbg_attach: gating it would close the exit dbg_launch's own message points at.
  // dbg_restart: at check time the session's own game still holds the port and is
  // about to be terminated, so a probe there fires on the process it is replacing —
  // every restart, on the happy path.
  const { srv: held, port } = await squat();
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "disconnect" || m.command === "terminate") dapResponse(s, m, {});
  });
  const { dap, rec } = dapHarness(srv.port, undefined, port);
  try {
    const attached = (await rec.handler("dbg_attach")({})) as ToolResultLike;
    assert.notEqual(attached.isError, true, "dbg_attach must never be port-gated");

    const restarted = (await rec.handler("dbg_restart")({})) as ToolResultLike;
    assert.notEqual(restarted.isError, true, "dbg_restart must never be port-gated");
  } finally {
    dap.close();
    srv.close();
    held.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Session 159 — the GDScript DAP plane's guards.
// ─────────────────────────────────────────────────────────────────────────────

test("dbg_launch REFUSES a launch the adapter rejected instead of reporting state 'running'", async () => {
  // Godot answers `wrong_path` to the launch REQUEST ITSELF when `project` is not the
  // project the editor has open — the opposite of netcoredbg, which answers
  // success=true and hides the failure in configurationDone (#166). Before the fix the
  // rejection was swallowed and the tool answered isError:false state:"running".
  const { srv } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch") { dapResponse(s, m, {}, false); return; }
    if (m.command === "configurationDone") { dapResponse(s, m, {}); return; }
  });
  const { dap, rec } = dapHarness(srv.port);
  const res = (await rec.handler("dbg_launch")({ scene: "main" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(String(res.content?.[0]?.text), /DAP error \[launch\]/);
  assert.equal(dap.hasSession, false, "a refused launch must not leave a session behind");
  dap.close();
  await srv.close();
});

test("a launch/attach rejection is NOT an unhandled rejection and NOT an 'error' emit", async () => {
  // 🔴 Two ways this used to be fatal, both measured against a real Godot 4.7:
  //   * the `.catch()` was attached on the LAST line of the handshake, so a rejection
  //     arriving DURING it was unhandled — Node terminates the process for that
  //     (exit code 1, twice: `wrong_path` on launch and `not_running` on attach);
  //   * and when it did land in time it emitted on `"error"`, and an unlistened
  //     `error` emit on an EventEmitter throws.
  // Both are pinned here because neither is reachable from the probe: the process
  // would simply die, taking the assertions with it.
  const unhandled: unknown[] = [];
  const uncaught: unknown[] = [];
  const onRejection = (e: unknown) => unhandled.push(e);
  const onException = (e: unknown) => uncaught.push(e);
  process.on("unhandledRejection", onRejection);
  process.on("uncaughtException", onException);
  try {
    const { srv } = await startDap((m, s) => {
      if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true }); dapEvent(s, "initialized", {}); return; }
      if (m.command === "attach") { dapResponse(s, m, {}, false); return; }
      if (m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    });
    const { dap, rec } = dapHarness(srv.port);
    const events: unknown[] = [];
    dap.on("start_failed", (e) => events.push(e));
    const res = (await rec.handler("dbg_attach")({})) as ToolResultLike;
    assert.equal(res.isError, true);
    await new Promise((r) => setTimeout(r, 30));
    assert.deepEqual(unhandled, [], "a rejected attach must not produce an unhandled rejection");
    assert.deepEqual(uncaught, [], "…nor an uncaught exception from an unlistened 'error' emit");
    assert.equal(events.length, 1, "the failure is announced on a distinct event name");
    dap.close();
    await srv.close();
  } finally {
    process.off("unhandledRejection", onRejection);
    process.off("uncaughtException", onException);
  }
});

test("a 'stopped' arriving mid-handshake is not clobbered by the state assignment", async () => {
  // The mirror of #166's CI-only race, pinned deterministically: the adapter sends
  // `stopped` BEFORE the configurationDone response, and the old unconditional
  // `state = "running"` overwrote it.
  const { srv } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch") { dapResponse(s, m, {}); return; }
    if (m.command === "configurationDone") {
      dapEvent(s, "stopped", { reason: "entry", threadId: 7 });
      dapResponse(s, m, {});
      return;
    }
  });
  const { dap, rec } = dapHarness(srv.port);
  const res = (await rec.handler("dbg_launch")({ scene: "main" })) as ToolResultLike;
  assert.equal((res.structuredContent as { state: string }).state, "stopped");
  assert.equal(dap.threadId(), 7, "the adapter's own thread id survives, not the ?? 1 fallback");
  dap.close();
  await srv.close();
});

test("dbg_launch reports stop_on_entry_honored, with a warning when the adapter ignores it", async () => {
  // Godot 4.7 ignores stopOnEntry outright — measured, the game ran to completion —
  // and the tool answered a bare `running` that reads exactly like a stop that had
  // not landed YET.
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = dapHarness(srv.port);
  const res = (await rec.handler("dbg_launch")({ scene: "main", stop_on_entry: true })) as ToolResultLike;
  const body = res.structuredContent as { state: string; stop_on_entry_honored?: boolean; warning?: string };
  assert.equal(body.stop_on_entry_honored, false);
  assert.equal(body.state, "running");
  assert.match(String(body.warning), /did not stop at entry/);
  dap.close();
  await srv.close();
});

test("dbg_launch reports stop_on_entry_honored: true on an adapter that DOES honour it", async () => {
  // The over-eager mirror: an adapter that stops at entry must not be told it didn't.
  const { srv } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch") { dapResponse(s, m, {}); return; }
    if (m.command === "configurationDone") {
      dapResponse(s, m, {});
      setTimeout(() => dapEvent(s, "stopped", { reason: "entry", threadId: 3 }), 10);
      return;
    }
  });
  const { dap, rec } = dapHarness(srv.port);
  const res = (await rec.handler("dbg_launch")({ scene: "main", stop_on_entry: true })) as ToolResultLike;
  const body = res.structuredContent as { state: string; stop_on_entry_honored?: boolean; warning?: string };
  assert.equal(body.stop_on_entry_honored, true);
  assert.equal(body.state, "stopped");
  assert.equal(body.warning, undefined, "an honoured stop must not carry the warning");
  dap.close();
  await srv.close();
});

test("the tools that need a debug session REFUSE without one, and none fabricates a state", async () => {
  const { srv, received } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = dapHarness(srv.port);
  const calls: Array<[string, Record<string, unknown>]> = [
    ["dbg_continue", {}],
    ["dbg_step", { kind: "over" }],
    ["dbg_stack_trace", {}],
    ["dbg_scopes", { frame_id: 0 }],
    ["dbg_variables", { variables_ref: 1 }],
    ["dbg_watch", { add: ["1+1"] }],
    ["dbg_evaluate", { expression: "1+1", confirm: true }],
    ["dbg_set_variable", { variables_ref: 1, name: "x", value: "1", confirm: true }],
  ];
  for (const [name, args] of calls) {
    const res = (await rec.handler(name)(args)) as ToolResultLike;
    assert.equal(res.isError, true, `${name} must refuse without a session`);
    assert.match(String(res.content?.[0]?.text), /needs a debug session/, `${name} must say why`);
  }
  // 🔴 The sharpest half: `resume()` optimistically sets state = "running", so the
  // FIRST such call used to leave the client looking live and every later answer
  // read as a genuine session.
  assert.equal(dap.state, "disconnected", "no refused call may fabricate a session state");
  assert.equal(dap.hasSession, false);
  // …and nothing was put on the wire — not one request reached the adapter.
  assert.deepEqual(received, [], "a refused call must not reach the adapter at all");
  dap.close();
  await srv.close();
});

test("the session guard runs BEFORE the confirmation prompt on the gated tools", async () => {
  // dbg_evaluate and dbg_set_variable are elicitation-gated. Prompting the operator to
  // approve arbitrary code execution against a session that does not exist is the
  // wrong order, so the guard is deliberately above the gate.
  let prompts = 0;
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = dapHarness(srv.port, async () => { prompts++; return { action: "accept" as const, content: {} }; });
  await rec.handler("dbg_evaluate")({ expression: "1+1" });
  await rec.handler("dbg_set_variable")({ variables_ref: 1, name: "x", value: "1" });
  assert.equal(prompts, 0, "no confirmation may be raised for a session that does not exist");
  dap.close();
  await srv.close();
});

test("dbg_* tools work normally once a session IS live — the guard is about absence", async () => {
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "continue") { dapResponse(s, m, {}); dapEvent(s, "stopped", { reason: "breakpoint", threadId: 1 }); return; }
    if (m.command === "stackTrace") { dapResponse(s, m, { stackFrames: [{ id: 1, name: "_ready", source: { path: "/p/player.gd" }, line: 13 }] }); return; }
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  assert.equal(dap.hasSession, true);
  const cont = (await rec.handler("dbg_continue")({})) as ToolResultLike;
  assert.equal(cont.isError, undefined);
  const st = (await rec.handler("dbg_stack_trace")({})) as ToolResultLike;
  assert.equal((st.structuredContent as { frames: unknown[] }).frames.length, 1);
  dap.close();
  await srv.close();
});

test("dbg_set_breakpoints REFUSES a source that can never bind, naming which guard fired", async () => {
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec, cfg } = dapHarness(srv.port);
  fs.mkdirSync(path.join(cfg.projectPath, "scenes"), { recursive: true });

  const missing = (await rec.handler("dbg_set_breakpoints")({ path: "res://NoSuchFile.gd", lines: [1] })) as ToolResultLike;
  assert.equal(missing.isError, true);
  assert.match(String(missing.content?.[0]?.text), /no such file/);

  const dir = (await rec.handler("dbg_set_breakpoints")({ path: "res://scenes", lines: [1] })) as ToolResultLike;
  assert.equal(dir.isError, true);
  assert.match(String(dir.content?.[0]?.text), /is not a file/);

  const empty = (await rec.handler("dbg_set_breakpoints")({ path: "", lines: [1] })) as ToolResultLike;
  assert.equal(empty.isError, true);
  assert.match(String(empty.content?.[0]?.text), /project root/);

  // 🔴 A host refusal is NOT dressed up as an adapter error — that would send the
  // caller off to debug an adapter that was never asked.
  assert.doesNotMatch(String(missing.content?.[0]?.text), /DAP error/);
  dap.close();
  await srv.close();
});

test("dbg_set_breakpoints refuses a path OUTSIDE the project root in all three spellings", async () => {
  // 🔴 Deliberately WIDER than cs_dbg_set_breakpoints. `cs_dbg_launch` documents
  // debugging a different .NET program, so #166 kept an outside absolute path legal.
  // Godot binds breakpoints only to scripts in the project it runs, so an outside
  // path can never bind here however it is spelled.
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec, cfg } = dapHarness(srv.port);
  // Every fixture below EXISTS, so only the escape guard can be what refused it — an
  // assertion that merely checked isError would be satisfied by the existence guard
  // instead, which is how a real gap survived a sweep in session 158.
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "gcb-dap-outside-"));
  const outsideFile = path.join(outside, "real.gd");
  fs.writeFileSync(outsideFile, "extends Node\n");
  // A SIBLING directory sharing the root's name prefix: the case a bare
  // startsWith(root) accepts and `root + path.sep` rejects.
  const sibling = `${cfg.projectPath}_evil`;
  fs.mkdirSync(sibling, { recursive: true });
  fs.writeFileSync(path.join(sibling, "real.gd"), "extends Node\n");

  for (const p of [outsideFile, `../${path.basename(sibling)}/real.gd`, `res://../${path.basename(sibling)}/real.gd`]) {
    const res = (await rec.handler("dbg_set_breakpoints")({ path: p, lines: [1] })) as ToolResultLike;
    assert.equal(res.isError, true, `${p} must be refused`);
    assert.match(String(res.content?.[0]?.text), /outside the Godot project root/, `${p} must be refused BY REASON`);
  }
  // …and the documented ABSOLUTE in-project form still works.
  const inside = (await rec.handler("dbg_set_breakpoints")({ path: path.join(cfg.projectPath, "player.gd"), lines: [1] })) as ToolResultLike;
  assert.notEqual(inside.isError, true, "an absolute path inside the project must stay legal");

  fs.rmSync(outside, { recursive: true, force: true });
  fs.rmSync(sibling, { recursive: true, force: true });
  dap.close();
  await srv.close();
});

test("an adapter failure with an EMPTY message is not rendered as a bare label and colon", async () => {
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "stackTrace") { writeFrame(s, { seq: 0, type: "response", request_seq: m.seq, success: false, command: "stackTrace", message: "" }); return; }
  });
  const { dap, rec } = dapHarness(srv.port);
  await rec.handler("dbg_launch")({ scene: "main" });
  const res = (await rec.handler("dbg_stack_trace")({})) as ToolResultLike;
  assert.equal(res.isError, true);
  const text = String(res.content?.[0]?.text);
  assert.doesNotMatch(text, /^DAP error \[\w+\]:\s*$/, "an empty message must not leave a label and a colon");
  assert.ok(text.length > "DAP error [stackTrace]: ".length, `got ${JSON.stringify(text)}`);
  dap.close();
  await srv.close();
});

test("a launch rejection arriving in the SAME read as configurationDone is still caught", async () => {
  // 🔴 A MUTATION SURVIVOR TAUGHT THIS ONE, and it is the sharpest thing the sweep
  // found. Both responses arrive in ONE TCP read, so the frame decoder handles them
  // synchronously: `configurationDone` resolves first, and the launch rejection's
  // `.catch()` microtask is queued AFTER the await continuation that follows it.
  // Without a turn of the event loop between the handshake and the decision, the
  // failure is missed by exactly one microtask and the tool reports a session that
  // never started. Deleting the `setImmediate` passed every other test in this file.
  let launchSeq = 0;
  const { srv } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch") { launchSeq = m.seq; return; }  // deliberately unanswered, for now
    if (m.command === "configurationDone") {
      // ONE write, two frames: the decoder sees both in a single `data` event.
      s.write(Buffer.concat([
        encodeFrame({ seq: 0, type: "response", request_seq: m.seq, success: true, command: "configurationDone", body: {} }),
        encodeFrame({ seq: 0, type: "response", request_seq: launchSeq, success: false, command: "launch", message: "wrong_path" }),
      ]));
      return;
    }
  });
  const { dap, rec } = dapHarness(srv.port);
  const res = (await rec.handler("dbg_launch")({ scene: "main" })) as ToolResultLike;
  assert.equal(res.isError, true, "the rejection must not be missed by one microtask");
  assert.match(String(res.content?.[0]?.text), /wrong_path/);
  assert.equal(dap.hasSession, false);
  dap.close();
  await srv.close();
});

test("a launch rejection arriving AFTER a stop still ends the session", async () => {
  // The other mutation survivor. A rejection that lands late sets state to
  // "terminated" — unless the adapter had already reported a stop, in which case the
  // stop is deliberately preserved and `sessionStarted = false` is the only thing
  // left saying the session is dead. Without it, the tools would keep answering from
  // a session the adapter had refused.
  let launchSeq = 0;
  let sock: net.Socket | null = null;
  const { srv } = await startDap((m, s) => {
    sock = s;
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch") { launchSeq = m.seq; return; }
    // The stop is reported BEFORE the configurationDone response, so `start()` sees
    // state === "stopped" and leaves it alone — the case the guarded assignment exists for.
    if (m.command === "configurationDone") { dapEvent(s, "stopped", { reason: "breakpoint", threadId: 4 }); dapResponse(s, m, {}); return; }
  });
  const { dap, rec } = dapHarness(srv.port);
  const res = (await rec.handler("dbg_launch")({ scene: "main" })) as ToolResultLike;
  assert.equal((res.structuredContent as { state: string }).state, "stopped");
  assert.equal(dap.hasSession, true, "the session is live until the adapter says otherwise");
  // …and now the launch request itself fails, well after the handshake returned.
  const failed = new Promise<void>((r) => dap.once("start_failed", () => r()));
  writeFrame(sock!, { seq: 0, type: "response", request_seq: launchSeq, success: false, command: "launch", message: "wrong_path" });
  await failed;
  assert.equal(dap.state, "stopped", "a reported stop is not overwritten by the late failure");
  assert.equal(dap.hasSession, false, "…but the session is over, and the tools must refuse");
  const after = (await rec.handler("dbg_stack_trace")({})) as ToolResultLike;
  assert.equal(after.isError, true);
  assert.match(String(after.content?.[0]?.text), /needs a debug session/);
  dap.close();
  await srv.close();
});

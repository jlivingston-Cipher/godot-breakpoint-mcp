import { test, before } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CsDapClient } from "../src/csdap.js";
import { FramedConnection } from "../src/framing.js";
import { StdioChannel } from "../src/stdio.js";
import { registerCsDapTools } from "../src/tools/csdap.js";
import { loadConfig, type Config } from "../src/config.js";
import { makeRecordingServer, type ToolResultLike, type ElicitFn } from "./helpers/recording-server.js";
import { startTcpServer, makeFrameParser, writeFrame, type TcpServer } from "./helpers/tcp.js";
import { structured } from "./helpers/structured.js";

interface DapMsg { seq: number; type: string; command?: string; arguments?: Record<string, unknown>; request_seq?: number; success?: boolean; event?: string; body?: unknown }

function dapResponse(s: net.Socket, req: DapMsg, body: Record<string, unknown> = {}, success = true): void {
  writeFrame(s, { seq: 0, type: "response", request_seq: req.seq, success, command: req.command, body });
}
function dapEvent(s: net.Socket, event: string, body: Record<string, unknown> = {}): void {
  writeFrame(s, { seq: 0, type: "event", event, body });
}

/** Handle the initialize/launch/attach/configurationDone handshake. Returns true if consumed. */
function handshake(msg: DapMsg, s: net.Socket, caps: Record<string, unknown> = { supportsConfigurationDoneRequest: true }): boolean {
  switch (msg.command) {
    case "initialize":
      dapResponse(s, msg, caps);
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

async function startDap(handle: (msg: DapMsg, s: net.Socket) => void): Promise<{ srv: TcpServer; received: DapMsg[]; stop: () => void }> {
  const received: DapMsg[] = [];
  let live: net.Socket | null = null;
  const srv = await startTcpServer((s) => {
    live = s;
    const parse = makeFrameParser((m) => { const msg = m as unknown as DapMsg; received.push(msg); handle(msg, s); });
    s.on("data", (c) => parse(Buffer.from(c)));
  });
  /**
   * Push a `stopped` event from the fake adapter, on demand.
   *
   * 🔴 THE FOURTEEN TESTS THIS CHANGED ARE THEMSELVES THE FINDING — the same shape
   * session 262 hit on the GDScript plane, where fifteen of them had to change. Each
   * launched a C# session and then asked a RUNNING program for a stack, a scope, a
   * variable or a step. They passed because the tools answered anyway. Against a real
   * netcoredbg that same sequence yields `Failed command 'stackTrace' : 0x80070057`
   * and a `cs_dbg_watch` whose every entry carries a raw hex code, so the suite was
   * pinning the shape of an answer nothing should have given.
   *
   * The thread id is deliberately NOT 1: `threadId()` falls back to 1 when nothing has
   * stopped, so a fixture stopping on thread 1 cannot tell a real stop from the
   * fallback — the distinction the live cohort next door already asserts.
   */
  return { srv, received, stop: () => { if (live) dapEvent(live, "stopped", { reason: "breakpoint", threadId: 4242 }); } };
}

/** Launch, then land the fake adapter's stop, so the frame readers are legal to call. */
async function launchAndStop(
  dap: CsDapClient,
  rec: { handler: (n: string) => (a: Record<string, unknown>) => unknown },
  stop: () => void,
  args: Record<string, unknown> = {},
): Promise<void> {
  await rec.handler("cs_dbg_launch")(args);
  const landed = new Promise<void>((resolve) => dap.once("stopped", () => resolve()));
  stop();
  await landed;
}

/** Full Config whose C# project root is a real temp dir (so toFsPath resolves). */
function makeConfig(projectPath: string): Config {
  const saved = process.env.GODOT_CSHARP_PROJECT;
  process.env.GODOT_CSHARP_PROJECT = projectPath;
  try { return loadConfig(); } finally {
    if (saved === undefined) delete process.env.GODOT_CSHARP_PROJECT; else process.env.GODOT_CSHARP_PROJECT = saved;
  }
}

/**
 * A temp C# project root — seeded with `Player.cs`, because `cs_dbg_set_breakpoints`
 * now refuses a source that names nothing (session 158). The tests below have always
 * MEANT "a real script at Player.cs:30"; before the refusal existed, an empty temp dir
 * happened to be indistinguishable from one, which is precisely the defect.
 */
function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gcb-csdap-"));
  fs.writeFileSync(path.join(dir, "Player.cs"), `${"\n".repeat(40)}// Player.cs fixture\n`);
  return dir;
}

/** Wire a CsDapClient (over a loopback TCP channel) to the cs_dbg_* tools on a recording server. */

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

function csDapHarness(port: number, elicit?: ElicitFn, runtimePort?: number) {
  const cfg = { ...makeConfig(tmpDir()), runtimeHost: "127.0.0.1", runtimePort: runtimePort ?? freeRuntimePort };
  const channel = new FramedConnection("127.0.0.1", port, "CS-DAP", "test channel");
  const dap = new CsDapClient(channel, 3000);
  const rec = makeRecordingServer(elicit);
  registerCsDapTools(rec.server as unknown as Parameters<typeof registerCsDapTools>[0], dap, cfg);
  return { dap, rec, cfg };
}

test("cs_dbg_launch runs the handshake and reports state 'running'", async () => {
  const { srv, received } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port);
  const res = (await rec.handler("cs_dbg_launch")({})) as ToolResultLike;
  // 🔴 `initialized_seen` ADDED AT 267 AND THESE SIX ASSERTIONS ARE PART OF THE FINDING.
    // Each pinned the WHOLE result object, so a key that ought to be there and is not
    // reads identically to one that ought not to be — which is why the deep-equal is kept
    // rather than loosened to a subset match. `true` here is a claim about the mock: it
    // DOES emit `initialized`, and a test asserting the false side is next door.
    assert.deepEqual(res.structuredContent, { session_id: "csharp", state: "running", initialized_seen: true });
  // Default launch config points at the C# project with the coreclr adapterID.
  const init = received.find((m) => m.command === "initialize");
  assert.equal((init!.arguments as { adapterID: string }).adapterID, "coreclr");
  const launch = received.find((m) => m.command === "launch");
  assert.ok(Array.isArray((launch!.arguments as { args: string[] }).args));
  dap.close();
  await srv.close();
});

test("cs_dbg_attach forwards the process id to the DAP attach request", async () => {
  const { srv, received } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port);
  // A pid that genuinely EXISTS — session 158 refuses one nothing runs under, and a
  // hard-coded 4242 is only ever a live process by luck.
  const pid = process.pid;
  const res = (await rec.handler("cs_dbg_attach")({ process_id: pid })) as ToolResultLike;
  // 🔴 `initialized_seen` ADDED AT 267 AND THESE SIX ASSERTIONS ARE PART OF THE FINDING.
    // Each pinned the WHOLE result object, so a key that ought to be there and is not
    // reads identically to one that ought not to be — which is why the deep-equal is kept
    // rather than loosened to a subset match. `true` here is a claim about the mock: it
    // DOES emit `initialized`, and a test asserting the false side is next door.
    assert.deepEqual(res.structuredContent, { session_id: "csharp", state: "running", initialized_seen: true });
  const attach = received.find((m) => m.command === "attach");
  assert.deepEqual(attach!.arguments, { processId: pid });
  dap.close();
  await srv.close();
});

test("cs_dbg_set_breakpoints buffers before a session is configured", async () => {
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port);
  const res = (await rec.handler("cs_dbg_set_breakpoints")({ path: "Player.cs", lines: [30] })) as ToolResultLike;
  const sc = structured<{ buffered: boolean; breakpoints: unknown[] }>(res);
  assert.equal(sc.buffered, true);
  assert.deepEqual(sc.breakpoints, []);
  dap.close();
  await srv.close();
});

test("cs_dbg_set_breakpoints applies immediately once the session is configured (Player.cs:30)", async () => {
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "setBreakpoints") dapResponse(s, m, { breakpoints: [{ line: 30, verified: true }] });
  });
  const { dap, rec } = csDapHarness(srv.port);
  await rec.handler("cs_dbg_launch")({});
  const res = (await rec.handler("cs_dbg_set_breakpoints")({ path: "Player.cs", lines: [30] })) as ToolResultLike;
  const sc = structured<{ buffered: boolean; breakpoints: Array<{ line: number; verified: boolean }> }>(res);
  assert.equal(sc.buffered, false);
  assert.deepEqual(sc.breakpoints, [{ line: 30, verified: true }]);
  dap.close();
  await srv.close();
});

test("cs_dbg_set_breakpoints forwards a condition when the adapter advertises supportsConditionalBreakpoints", async () => {
  let bpReq: DapMsg | undefined;
  const { srv } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true, supportsConditionalBreakpoints: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch" || m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    if (m.command === "setBreakpoints") { bpReq = m; dapResponse(s, m, { breakpoints: [{ line: 30, verified: true }] }); }
  });
  const { dap, rec } = csDapHarness(srv.port);
  await rec.handler("cs_dbg_launch")({});
  const res = (await rec.handler("cs_dbg_set_breakpoints")({ path: "Player.cs", lines: [30], conditions: ["Counter < 50"] })) as ToolResultLike;
  const sc = structured<{ unsupported_modifiers?: string[] }>(res);
  assert.equal(sc.unsupported_modifiers, undefined);
  const bps = (bpReq!.arguments as { breakpoints: Array<Record<string, unknown>> }).breakpoints;
  assert.equal(bps[0].line, 30);
  assert.equal(bps[0].condition, "Counter < 50");
  dap.close();
  await srv.close();
});

test("cs_dbg_set_breakpoints drops the condition and warns when the adapter does not advertise supportsConditionalBreakpoints", async () => {
  // Default handshake advertises no supportsConditionalBreakpoints.
  let bpReq: DapMsg | undefined;
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "setBreakpoints") { bpReq = m; dapResponse(s, m, { breakpoints: [{ line: 30, verified: true }] }); }
  });
  const { dap, rec } = csDapHarness(srv.port);
  await rec.handler("cs_dbg_launch")({});
  const res = (await rec.handler("cs_dbg_set_breakpoints")({ path: "Player.cs", lines: [30], conditions: ["Counter < 50"] })) as ToolResultLike;
  const sc = structured<{ unsupported_modifiers?: string[]; warning?: string }>(res);
  assert.deepEqual(sc.unsupported_modifiers, ["condition"]);
  assert.match(sc.warning ?? "", /halt unconditionally/i);
  const bps = (bpReq!.arguments as { breakpoints: Array<Record<string, unknown>> }).breakpoints;
  assert.equal(bps[0].condition, undefined);
  dap.close();
  await srv.close();
});

test("cs_dbg_continue waits for the next 'stopped' event and returns its reason", async () => {
  const { srv, stop } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "continue") { dapResponse(s, m, {}); dapEvent(s, "stopped", { reason: "breakpoint", threadId: 1 }); }
  });
  const { dap, rec } = csDapHarness(srv.port);
  await launchAndStop(dap, rec, stop);
  const res = (await rec.handler("cs_dbg_continue")({})) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { state: "stopped", stopped_reason: "breakpoint" });
  dap.close();
  await srv.close();
});

test("cs_dbg_step over issues 'next' and awaits the landing stop", async () => {
  const { srv, received, stop } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "next") { dapResponse(s, m, {}); dapEvent(s, "stopped", { reason: "step", threadId: 1 }); }
  });
  const { dap, rec } = csDapHarness(srv.port);
  await launchAndStop(dap, rec, stop);
  const res = (await rec.handler("cs_dbg_step")({ kind: "over" })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { state: "stopped", stopped_reason: "step" });
  assert.ok(received.some((m) => m.command === "next"), "step:over must issue the DAP 'next' command");
  dap.close();
  await srv.close();
});

test("cs_dbg_stack_trace maps DAP stackFrames to the tool's frame shape", async () => {
  const { srv, stop } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "stackTrace") dapResponse(s, m, { stackFrames: [{ id: 1000, name: "Player.TakeDamage", source: { path: "/p/Player.cs" }, line: 30 }] });
  });
  const { dap, rec } = csDapHarness(srv.port);
  await launchAndStop(dap, rec, stop);
  const res = (await rec.handler("cs_dbg_stack_trace")({})) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { frames: [{ id: 1000, name: "Player.TakeDamage", source: "/p/Player.cs", line: 30 }] });
  dap.close();
  await srv.close();
});

test("cs_dbg_scopes maps DAP scopes to name + variables_ref", async () => {
  const { srv, stop } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "scopes") dapResponse(s, m, { scopes: [{ name: "Locals", variablesReference: 1001 }] });
  });
  const { dap, rec } = csDapHarness(srv.port);
  await launchAndStop(dap, rec, stop);
  const res = (await rec.handler("cs_dbg_scopes")({ frame_id: 1000 })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { scopes: [{ name: "Locals", variables_ref: 1001 }] });
  dap.close();
  await srv.close();
});

test("cs_dbg_variables maps DAP variables (e.g. Counter) to the tool shape", async () => {
  const { srv, stop } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "variables") dapResponse(s, m, { variables: [{ name: "Counter", value: "95", type: "int", variablesReference: 0 }] });
  });
  const { dap, rec } = csDapHarness(srv.port);
  await launchAndStop(dap, rec, stop);
  const res = (await rec.handler("cs_dbg_variables")({ variables_ref: 1001 })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { variables: [{ name: "Counter", value: "95", type: "int", variables_ref: 0 }] });
  dap.close();
  await srv.close();
});

test("a failed DAP request surfaces as an isError result", async () => {
  const { srv, stop } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "stackTrace") dapResponse(s, m, { message: "no stack while running" }, false);
  });
  const { dap, rec } = csDapHarness(srv.port);
  await launchAndStop(dap, rec, stop);
  const res = (await rec.handler("cs_dbg_stack_trace")({})) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /C# DAP error/);
  dap.close();
  await srv.close();
});

// ---- cs_dbg_evaluate (gated) ----------------------------------------------

test("cs_dbg_evaluate proceeds with confirm:true and returns the evaluated result", async () => {
  const { srv, received, stop } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "evaluate") dapResponse(s, m, { result: "95", type: "int", variablesReference: 0 });
  });
  const { dap, rec } = csDapHarness(srv.port, async () => ({ action: "decline" }));
  await launchAndStop(dap, rec, stop);
  const res = (await rec.handler("cs_dbg_evaluate")({ expression: "Counter", confirm: true })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { result: "95", type: "int", variables_ref: 0 });
  assert.ok(received.some((m) => m.command === "evaluate"));
  dap.close();
  await srv.close();
});

test("cs_dbg_evaluate is blocked (and sends no evaluate) when the user declines confirmation", async () => {
  const { srv, received } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "evaluate") dapResponse(s, m, { result: "should-not-happen" });
  });
  const { dap, rec } = csDapHarness(srv.port, async () => ({ action: "decline" }));
  await rec.handler("cs_dbg_launch")({});
  const res = (await rec.handler("cs_dbg_evaluate")({ expression: "DeleteEverything()" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.ok(!received.some((m) => m.command === "evaluate"), "a declined evaluate must never reach the adapter");
  dap.close();
  await srv.close();
});

test("cs_dbg_evaluate fails fast with a clear message when the adapter never answers evaluate", async () => {
  const { srv, received, stop } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    // evaluate: deliberately never respond
  });
  process.env.GODOT_CSDAP_EVALUATE_TIMEOUT_MS = "200";
  const { dap, rec } = csDapHarness(srv.port, async () => ({ action: "accept", content: { proceed: true } }));
  delete process.env.GODOT_CSDAP_EVALUATE_TIMEOUT_MS;
  await launchAndStop(dap, rec, stop);
  const res = (await rec.handler("cs_dbg_evaluate")({ expression: "Counter", confirm: true })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /did not answer the evaluate request within 200ms/i);
  assert.ok(received.some((m) => m.command === "evaluate"), "the tool must send evaluate before the bounded deadline fires");
  dap.close();
  await srv.close();
});

// ---- cs_dbg_set_variable (gated) ------------------------------------------

test("cs_dbg_set_variable proceeds with confirm:true and returns the adapter's updated value", async () => {
  const { srv, received, stop } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "setVariable") dapResponse(s, m, { value: "0", type: "int", variablesReference: 0 });
  });
  const { dap, rec } = csDapHarness(srv.port, async () => ({ action: "decline" }));
  await launchAndStop(dap, rec, stop);
  const res = (await rec.handler("cs_dbg_set_variable")({ variables_ref: 1001, name: "Counter", value: "0", confirm: true })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { name: "Counter", value: "0", type: "int", variables_ref: 0 });
  const sv = received.find((m) => m.command === "setVariable");
  assert.deepEqual(sv!.arguments, { variablesReference: 1001, name: "Counter", value: "0" });
  dap.close();
  await srv.close();
});

test("cs_dbg_set_variable is blocked (and sends no setVariable) when the user declines confirmation", async () => {
  const { srv, received } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "setVariable") dapResponse(s, m, { value: "should-not-happen" });
  });
  const { dap, rec } = csDapHarness(srv.port, async () => ({ action: "decline" }));
  await rec.handler("cs_dbg_launch")({});
  const res = (await rec.handler("cs_dbg_set_variable")({ variables_ref: 1001, name: "Counter", value: "0" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.ok(!received.some((m) => m.command === "setVariable"), "a declined setVariable must never reach the adapter");
  dap.close();
  await srv.close();
});

test("cs_dbg_set_variable returns 'unsupported' WITHOUT prompting when the adapter advertises supportsSetVariable:false", async () => {
  let elicited = 0;
  const { srv, received, stop } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true, supportsSetVariable: false }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch" || m.command === "configurationDone") { dapResponse(s, m, {}); return; }
    if (m.command === "setVariable") dapResponse(s, m, { value: "nope" });
  });
  const { dap, rec } = csDapHarness(srv.port, async () => { elicited++; return { action: "accept", content: { proceed: true } }; });
  await launchAndStop(dap, rec, stop);
  const res = (await rec.handler("cs_dbg_set_variable")({ variables_ref: 1, name: "Counter", value: "0" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  assert.equal(elicited, 0, "must not prompt when the capability is unsupported");
  assert.ok(!received.some((m) => m.command === "setVariable"));
  dap.close();
  await srv.close();
});

test("cs_dbg_set_variable fails fast with a clear message when the adapter never answers setVariable", async () => {
  const { srv, received, stop } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    // setVariable: deliberately never respond
  });
  process.env.GODOT_CSDAP_SETVAR_TIMEOUT_MS = "200";
  const { dap, rec } = csDapHarness(srv.port, async () => ({ action: "accept", content: { proceed: true } }));
  delete process.env.GODOT_CSDAP_SETVAR_TIMEOUT_MS;
  await launchAndStop(dap, rec, stop);
  const res = (await rec.handler("cs_dbg_set_variable")({ variables_ref: 1, name: "Counter", value: "0", confirm: true })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /did not answer the setVariable request within 200ms/i);
  assert.match(res.content![0].text!, /no change was made/i);
  assert.ok(received.some((m) => m.command === "setVariable"), "the tool must send setVariable before the bounded deadline fires");
  dap.close();
  await srv.close();
});

// ---- cs_dbg_watch / cs_dbg_set_exception_breakpoints / cs_dbg_restart (extras) ----

test("cs_dbg_watch adds expressions and evaluates them in DAP 'watch' context", async () => {
  const seen: DapMsg[] = [];
  const { srv, stop } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "evaluate") {
      seen.push(m);
      const expr = (m.arguments as { expression: string }).expression;
      dapResponse(s, m, { result: expr === "Counter" ? "95" : "3", type: "int" });
    }
  });
  const { dap, rec } = csDapHarness(srv.port);
  await launchAndStop(dap, rec, stop);
  const res = (await rec.handler("cs_dbg_watch")({ add: ["Counter", "Lives"] })) as ToolResultLike;
  const sc = structured<{ watches: Array<{ expression: string; value: string; type: string; error: string | null }> }>(res);
  assert.deepEqual(sc.watches, [
    { expression: "Counter", value: "95", type: "int", error: null },
    { expression: "Lives", value: "3", type: "int", error: null },
  ]);
  // Watches must use the side-effect-free `watch` context, never `repl`.
  assert.ok(seen.length > 0 && seen.every((m) => (m.arguments as { context?: string }).context === "watch"));
  dap.close();
  await srv.close();
});

test("cs_dbg_watch reports a per-expression error without failing the call, and remove/clear mutate the set", async () => {
  const { srv, stop } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    if (m.command === "evaluate") {
      if ((m.arguments as { expression: string }).expression === "bogus") dapResponse(s, m, { message: "not in scope" }, false);
      else dapResponse(s, m, { result: "95", type: "int" });
    }
  });
  const { dap, rec } = csDapHarness(srv.port);
  await launchAndStop(dap, rec, stop);
  let res = (await rec.handler("cs_dbg_watch")({ add: ["Counter", "bogus"] })) as ToolResultLike;
  let sc = structured<{ watches: Array<{ expression: string; value: string; error: string | null }> }>(res);
  assert.equal(sc.watches.length, 2);
  assert.equal(sc.watches[0].error, null);
  // A failed evaluate yields a non-null error on that entry (the adapter's message is at the
  // DAP response top level, which the client surfaces; the whole call must still succeed).
  assert.ok(sc.watches[1].error, "a failed watch expression must carry an error");
  assert.equal(sc.watches[1].value, "");
  // remove drops one; a later call re-reads the remaining set
  res = (await rec.handler("cs_dbg_watch")({ remove: ["bogus"] })) as ToolResultLike;
  sc = res.structuredContent as { watches: Array<{ expression: string; value: string; error: string | null }> };
  assert.deepEqual(sc.watches.map((w) => w.expression), ["Counter"]);
  // clear empties the set
  const cleared = (await rec.handler("cs_dbg_watch")({ clear: true })) as ToolResultLike;
  assert.ok(cleared.structuredContent, `cs_dbg_watch_clear returned no structuredContent — ${JSON.stringify(cleared).slice(0, 400)}`);
  assert.deepEqual((cleared.structuredContent as { watches: unknown[] }).watches, []);
  dap.close();
  await srv.close();
});

test("cs_dbg_set_exception_breakpoints enables filters when the adapter advertises exceptionBreakpointFilters", async () => {
  let sebReq: DapMsg | undefined;
  const caps = { supportsConfigurationDoneRequest: true, exceptionBreakpointFilters: [{ filter: "all", label: "all exceptions" }, { filter: "user-unhandled", label: "user-unhandled exceptions" }] };
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s, caps)) return;
    if (m.command === "setExceptionBreakpoints") { sebReq = m; dapResponse(s, m, { breakpoints: [{ verified: true }] }); }
  });
  const { dap, rec } = csDapHarness(srv.port);
  await rec.handler("cs_dbg_launch")({});
  const res = (await rec.handler("cs_dbg_set_exception_breakpoints")({ filters: ["all"] })) as ToolResultLike;
  const sc = structured<{ filters: string[]; available_filters: Array<{ filter: string; label: string }>; breakpoints: Array<{ verified: boolean }> }>(res);
  assert.deepEqual(sc.filters, ["all"]);
  assert.deepEqual(sc.available_filters.map((f) => f.filter), ["all", "user-unhandled"]);
  assert.deepEqual(sc.breakpoints, [{ verified: true }]);
  assert.deepEqual((sebReq!.arguments as { filters: string[] }).filters, ["all"]);
  dap.close();
  await srv.close();
});

test("cs_dbg_set_exception_breakpoints returns 'unsupported' WITHOUT sending when no filters are advertised", async () => {
  const { srv, received } = await startDap((m, s) => {
    if (handshake(m, s)) return; // default caps advertise no exceptionBreakpointFilters
    if (m.command === "setExceptionBreakpoints") dapResponse(s, m, {});
  });
  const { dap, rec } = csDapHarness(srv.port);
  await rec.handler("cs_dbg_launch")({});
  const res = (await rec.handler("cs_dbg_set_exception_breakpoints")({ filters: ["all"] })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  assert.ok(!received.some((m) => m.command === "setExceptionBreakpoints"), "must not send setExceptionBreakpoints when unsupported");
  dap.close();
  await srv.close();
});

test("cs_dbg_restart falls back to terminate + relaunch when supportsRestartRequest is absent (netcoredbg)", async () => {
  const order: string[] = [];
  const { srv } = await startDap((m, s) => {
    if (m.command === "initialize") { order.push("initialize"); dapResponse(s, m, { supportsConfigurationDoneRequest: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch" || m.command === "configurationDone") { order.push(m.command!); dapResponse(s, m, {}); return; }
    if (m.command === "terminate") { order.push("terminate"); dapResponse(s, m, {}); return; }
  });
  const { dap, rec } = csDapHarness(srv.port);
  await rec.handler("cs_dbg_launch")({});
  const res = (await rec.handler("cs_dbg_restart")({})) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { session_id: "csharp", method: "relaunch", state: "running" });
  // relaunch = a terminate followed by a FRESH initialize/launch handshake.
  assert.ok(order.includes("terminate"));
  assert.ok(order.lastIndexOf("initialize") > order.indexOf("terminate"), "a fresh handshake must run after terminate");
  dap.close();
  await srv.close();
});

test("cs_dbg_restart uses the native DAP restart when the adapter advertises supportsRestartRequest", async () => {
  const caps = { supportsConfigurationDoneRequest: true, supportsRestartRequest: true };
  let restartReq: DapMsg | undefined;
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s, caps)) return;
    if (m.command === "restart") { restartReq = m; dapResponse(s, m, {}); dapEvent(s, "stopped", { reason: "entry", threadId: 1 }); }
  });
  const { dap, rec } = csDapHarness(srv.port);
  await rec.handler("cs_dbg_launch")({ stop_on_entry: true });
  const res = (await rec.handler("cs_dbg_restart")({ stop_on_entry: true })) as ToolResultLike;
  const sc = structured<{ session_id: string; method: string; state: string }>(res);
  assert.equal(sc.method, "restart");
  assert.equal(sc.session_id, "csharp");
  assert.ok(restartReq, "the native DAP restart request must be sent");
  dap.close();
  await srv.close();
});

test("cs_dbg_restart errors clearly when there is no session to restart", async () => {
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port);
  const res = (await rec.handler("cs_dbg_restart")({})) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /no C# debug session to restart/i);
  dap.close();
  await srv.close();
});

// ---- StdioChannel end-to-end (the transport netcoredbg actually uses) ------
// Drives CsDapClient through a REAL spawned subprocess speaking DAP over stdio,
// so the stdio framing/spawn path is exercised in the unit suite, not only in CI.

test("CsDapClient over StdioChannel: the launch handshake round-trips against a spawned stdio adapter", async () => {
  const mock = `
    let buf = Buffer.alloc(0);
    const send = (o) => { const b = JSON.stringify(o); process.stdout.write("Content-Length: " + Buffer.byteLength(b) + "\\r\\n\\r\\n" + b); };
    process.stdin.on("data", (c) => {
      buf = Buffer.concat([buf, c]);
      for (;;) {
        const i = buf.indexOf("\\r\\n\\r\\n");
        if (i === -1) break;
        const m = /Content-Length:\\s*(\\d+)/i.exec(buf.subarray(0, i).toString("ascii"));
        if (!m) { buf = buf.subarray(i + 4); continue; }
        const len = Number(m[1]); const start = i + 4;
        if (buf.length < start + len) break;
        const body = JSON.parse(buf.subarray(start, start + len).toString("utf8"));
        buf = buf.subarray(start + len);
        if (body.type === "request") {
          if (body.command === "initialize") {
            send({ seq: 0, type: "response", request_seq: body.seq, success: true, command: "initialize", body: { supportsConfigurationDoneRequest: true } });
            send({ seq: 0, type: "event", event: "initialized", body: {} });
          } else {
            send({ seq: 0, type: "response", request_seq: body.seq, success: true, command: body.command, body: {} });
          }
        }
      }
    });
  `;
  const channel = new StdioChannel(process.execPath, ["-e", mock], os.tmpdir(), "CS-DAP-stdio", "test");
  const dap = new CsDapClient(channel, 4000);
  await dap.start("launch", { program: "godot", args: ["--path", "."] });
  assert.equal(dap.state, "running");
  assert.equal(dap.capabilities?.supportsConfigurationDoneRequest, true);
  dap.close();
});

test("StdioChannel surfaces a spawn failure (bad command) as a clear error rather than hanging", async () => {
  const channel = new StdioChannel("gcb-nonexistent-netcoredbg-xyz", ["--interpreter=vscode"], os.tmpdir(), "CS-DAP-stdio", "Install netcoredbg.");
  const dap = new CsDapClient(channel, 2000);
  await assert.rejects(dap.start("launch", {}), (e) => /could not spawn/i.test((e as Error).message));
  dap.close();
});

/**
 * cs_dbg_launch is gated only when it is actually launching Godot.
 *
 * `program` exists so netcoredbg can debug an arbitrary .NET program, and such a
 * program has no Breakpoint autoload and no interest in the runtime port. A gate
 * that fired there would be a check going off when nothing is wrong — which is
 * how a check earns the reputation that gets it disabled.
 */
test("cs_dbg_launch refuses a held runtime port when launching the configured Godot binary", async () => {
  const { srv: held, port } = await squat();
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port, undefined, port);
  try {
    const res = (await rec.handler("cs_dbg_launch")({})) as ToolResultLike;
    assert.equal(res.isError, true);
    const text = res.content?.[0]?.text ?? "";
    assert.match(text, new RegExp(`127\\.0\\.0\\.1:${port} is already bound`));
    assert.match(text, /cs_dbg_attach/);
    assert.match(text, /addressed by session rather than by port/);
  } finally {
    dap.close();
    srv.close();
    held.close();
  }
});

test("cs_dbg_launch does NOT gate a non-Godot program — the false positive that would get the check disabled", async () => {
  const { srv: held, port } = await squat();
  const { srv, received } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port, undefined, port);
  try {
    // BOTH program and args: leaving args at their default would still carry
    // Godot's own `--path` flag, which is one of the two signals the gate reads.
    // A `program` override alone is not "debugging another program", it is an
    // incoherent combination, and testing it proved nothing.
    const res = (await rec.handler("cs_dbg_launch")({
      program: "/usr/bin/some-other-dotnet-app",
      args: ["--serve", "--port", "5000"],
    })) as ToolResultLike;
    assert.notEqual(res.isError, true, "debugging another .NET program must never be port-gated");
    const launch = received.find((m) => m.command === "launch");
    assert.equal((launch?.arguments as Record<string, unknown>)?.program, "/usr/bin/some-other-dotnet-app");
  } finally {
    dap.close();
    srv.close();
    held.close();
  }
});

test("cs_dbg_launch honours allow_port_conflict for the Godot binary", async () => {
  const { srv: held, port } = await squat();
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port, undefined, port);
  try {
    const res = (await rec.handler("cs_dbg_launch")({ allow_port_conflict: true })) as ToolResultLike;
    assert.notEqual(res.isError, true);
    assert.ok(res.structuredContent, `the launch returned no structuredContent — ${JSON.stringify(res).slice(0, 400)}`);
    assert.equal((res.structuredContent as Record<string, unknown>).state, "running");
  } finally {
    dap.close();
    srv.close();
    held.close();
  }
});

/**
 * The defect an adversarial review found in the first version of this gate.
 *
 * The condition was `resolvedProgram === cfg.csDapProgram` — equality against the
 * DEFAULT, not a question about Godot. `cfg.csDapProgram` is
 * `GODOT_CSHARP_BIN ?? GODOT_BIN ?? "godot"`, and `config.ts` documents the
 * per-call `program` argument as the way to point at the Mono binary. So the
 * documented mainline path — explicitly naming the real Godot Mono binary —
 * skipped the gate entirely, on exactly the launch this change exists to cover.
 */
test("cs_dbg_launch gates an EXPLICIT Godot Mono binary, not just the configured default", async () => {
  const { srv: held, port } = await squat();
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port, undefined, port);
  try {
    const res = (await rec.handler("cs_dbg_launch")({
      program: "/usr/local/bin/Godot_v4.3-stable_mono_linux.x86_64",
    })) as ToolResultLike;
    assert.equal(res.isError, true, "an explicitly-named Godot binary must still be gated");
    assert.match(res.content?.[0]?.text ?? "", new RegExp(`127\\.0\\.0\\.1:${port} is already bound`));
  } finally {
    dap.close();
    srv.close();
    held.close();
  }
});

test("cs_dbg_launch gates on Godot's --path flag even when the program is named oddly", async () => {
  // The second signal, independent of the binary's name: `--path <project>` is
  // Godot's own project flag and is what the default args carry.
  const { srv: held, port } = await squat();
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port, undefined, port);
  try {
    const res = (await rec.handler("cs_dbg_launch")({
      program: "/opt/engine/bin/renamed-engine",
      args: ["--path", "/tmp/proj"],
    })) as ToolResultLike;
    assert.equal(res.isError, true, "--path means a Godot project launch regardless of the binary name");
  } finally {
    dap.close();
    srv.close();
    held.close();
  }
});

// ---------------------------------------------------------------------------
// Session 158 — the cs_dbg_* plane, measured against a real netcoredbg 3.2.0-1092.
// Every state below is one this file's mock could always have produced; none of
// them was ever asserted, because the live probe next door is log-only past its
// `initialize` handshake and it sits inside a REQUIRED job.
// ---------------------------------------------------------------------------

/** A handshake whose `configurationDone` FAILS — what a bogus program really does. */
function handshakeConfigureFails(msg: DapMsg, s: net.Socket, caps: Record<string, unknown> = { supportsConfigurationDoneRequest: true }): boolean {
  switch (msg.command) {
    case "initialize":
      dapResponse(s, msg, caps);
      dapEvent(s, "initialized", {});
      return true;
    case "launch":
    case "attach":
      // 🔴 netcoredbg answers `launch` success=true even for a program that does
      // not exist. The failure lands on configurationDone, below.
      dapResponse(s, msg, {});
      return true;
    case "configurationDone":
      dapResponse(s, msg, {}, false);
      return true;
  }
  return false;
}

test("cs_dbg_launch reports a launch the adapter REJECTED, instead of state 'running'", async () => {
  // Measured live: `program: "/no/such/binary"` -> launch success=true, then
  // configurationDone success=false ("Failed command 'configurationDone' : 0x80070002",
  // ERROR_FILE_NOT_FOUND). That response was `.catch(() => undefined)`-swallowed
  // immediately before an unconditional `state = "running"`, so the tool answered
  // isError:false for a session that never existed and every later call failed with a
  // bare hex code against a phantom session.
  const { srv } = await startDap((m, s) => { handshakeConfigureFails(m, s); });
  const { dap, rec } = csDapHarness(srv.port);
  try {
    const res = (await rec.handler("cs_dbg_launch")({ program: "/no/such/binary", args: [] })) as ToolResultLike;
    assert.equal(res.isError, true, "a rejected launch must not be reported as a running session");
    assert.notEqual((res.structuredContent as { state?: string } | undefined)?.state, "running");
    assert.match(res.content?.[0]?.text ?? "", /did not start the session/);
    assert.equal(dap.state, "terminated", "the client must not be left believing a session is live");
  } finally { dap.close(); srv.close(); }
});

test("cs_dbg_launch reports a launch the adapter rejected OUTRIGHT, and never emits an unlistened 'error'", async () => {
  // 🔴 The other half of the same defect, and the live probe cannot reach it: netcoredbg
  // answers `launch` success=true even for a program that does not exist, so only an
  // adapter that rejects the request itself exercises this path. The rejection used to
  // go to `this.emit("error", err)` — and nothing registers an `error` listener, so an
  // unlistened `error` emit on an EventEmitter THROWS. The mutation sweep found this
  // gap: dropping the startFailure half survived the live probe untouched.
  const { srv } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch") { dapResponse(s, m, {}, false); return; }
    if (m.command === "configurationDone") { dapResponse(s, m, {}); return; }
  });
  const { dap, rec } = csDapHarness(srv.port);
  const uncaught: unknown[] = [];
  const onUncaught = (err: unknown) => uncaught.push(err);
  process.on("uncaughtException", onUncaught);
  // 🔴 214 §7.5 EXEMPTION + THE FLOOR IT NEEDS. `uncaught` is a PROCESS TRAP: it fills only
  // when Node is about to die, so it can never carry plane_path_guards:196's positive
  // control — proving it "can be non-empty" would mean injecting a real uncaughtException
  // into the shared test process. Its floor has to sit on a companion binding that proves
  // the failure path RAN, which is what dap.test.ts gets from `events.length === 1`. This
  // test had only `dap.state === "terminated"` for that, so the listener is added here to
  // make the floor the same kind of thing on both planes rather than an inference.
  const announced: unknown[] = [];
  dap.on("start_failed", (e) => announced.push(e));
  try {
    const res = (await rec.handler("cs_dbg_launch")({ program: "/no/such/binary" })) as ToolResultLike;
    assert.equal(res.isError, true, "a launch the adapter rejected is not a running session");
    assert.match(res.content?.[0]?.text ?? "", /did not start the session/);
    assert.equal(dap.state, "terminated");
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(announced.length, 1, "the rejection is announced on start_failed — the path the empty `uncaught` below is a claim about");
    assert.deepEqual(uncaught, [], "the rejection must not surface as an unlistened 'error' emit");
  } finally {
    process.removeListener("uncaughtException", onUncaught);
    dap.close();
    srv.close();
  }
});

test("cs_dbg_launch still succeeds when configurationDone fails on an adapter that never advertised it", async () => {
  // 🔴 The over-eager mirror. An adapter that does not advertise
  // supportsConfigurationDoneRequest may reject the request while the session is
  // perfectly alive — treating THAT as fatal would break every such adapter. The
  // failure is only fatal when the adapter claimed to implement the request.
  const { srv } = await startDap((m, s) => { handshakeConfigureFails(m, s, { supportsConfigurationDoneRequest: false }); });
  const { dap, rec } = csDapHarness(srv.port);
  try {
    const res = (await rec.handler("cs_dbg_launch")({ program: "/opt/app", args: [] })) as ToolResultLike;
    assert.notEqual(res.isError, true, "an unadvertised configurationDone failure is not evidence of a failed launch");
    // 🔴 `initialized_seen` ADDED AT 267 AND THESE SIX ASSERTIONS ARE PART OF THE FINDING.
    // Each pinned the WHOLE result object, so a key that ought to be there and is not
    // reads identically to one that ought not to be — which is why the deep-equal is kept
    // rather than loosened to a subset match. `true` here is a claim about the mock: it
    // DOES emit `initialized`, and a test asserting the false side is next door.
    assert.deepEqual(res.structuredContent, { session_id: "csharp", state: "running", initialized_seen: true });
  } finally { dap.close(); srv.close(); }
});

test("cs_dbg_launch with stop_on_entry waits for the entry stop and reports 'stopped'", async () => {
  // 🔴 It used to return before the entry stop, so the tool said "running" and
  // threadId() fell back to 1 while netcoredbg's real thread id is a large integer —
  // cs_dbg_stack_trace answered 0x80070057 immediately after launch and the IDENTICAL
  // call succeeded 1.5s later.
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s) && m.command === "configurationDone") {
      setTimeout(() => dapEvent(s, "stopped", { reason: "entry", threadId: 42618413, allThreadsStopped: true }), 5);
    }
  });
  const { dap, rec } = csDapHarness(srv.port);
  try {
    const res = (await rec.handler("cs_dbg_launch")({ program: "/opt/app", stop_on_entry: true })) as ToolResultLike;
    // 🔴 `initialized_seen` ADDED AT 267 AND THESE SIX ASSERTIONS ARE PART OF THE FINDING.
    // Each pinned the WHOLE result object, so a key that ought to be there and is not
    // reads identically to one that ought not to be — which is why the deep-equal is kept
    // rather than loosened to a subset match. `true` here is a claim about the mock: it
    // DOES emit `initialized`, and a test asserting the false side is next door.
    assert.deepEqual(res.structuredContent, { session_id: "csharp", state: "stopped", initialized_seen: true });
    assert.equal(dap.threadId(), 42618413, "the adapter's thread id, not the fallback 1");
  } finally { dap.close(); srv.close(); }
});

test("cs_dbg_launch with stop_on_entry survives a stop that lands BEFORE configurationDone answers", async () => {
  // 🔴 The race CI found and this Mac never did. The adapter may emit `stopped` between
  // the configurationDone RESPONSE and the line that sets the state, so the event
  // handler has already moved the state to "stopped" — and the first version of this
  // fix then wrote `state = "running"` over it unconditionally, with the awaited entry
  // stop already resolved and nothing left to wait for. Here the event is sent BEFORE
  // the response, which pins that ordering deterministically instead of by luck.
  const { srv } = await startDap((m, s) => {
    if (m.command === "initialize") { dapResponse(s, m, { supportsConfigurationDoneRequest: true }); dapEvent(s, "initialized", {}); return; }
    if (m.command === "launch") { dapResponse(s, m, {}); return; }
    if (m.command === "configurationDone") {
      dapEvent(s, "stopped", { reason: "entry", threadId: 42618413, allThreadsStopped: true });
      dapResponse(s, m, {});
    }
  });
  const { dap, rec } = csDapHarness(srv.port);
  try {
    const res = (await rec.handler("cs_dbg_launch")({ program: "/opt/app", stop_on_entry: true })) as ToolResultLike;
    // 🔴 `initialized_seen` ADDED AT 267 AND THESE SIX ASSERTIONS ARE PART OF THE FINDING.
    // Each pinned the WHOLE result object, so a key that ought to be there and is not
    // reads identically to one that ought not to be — which is why the deep-equal is kept
    // rather than loosened to a subset match. `true` here is a claim about the mock: it
    // DOES emit `initialized`, and a test asserting the false side is next door.
    assert.deepEqual(res.structuredContent, { session_id: "csharp", state: "stopped", initialized_seen: true });
    assert.equal(dap.threadId(), 42618413);
  } finally { dap.close(); srv.close(); }
});

test("cs_dbg_launch WITHOUT stop_on_entry does not wait for a stop", async () => {
  // The over-eager mirror: a plain launch must not block on a `stopped` event that
  // is never coming. The mock below never sends one.
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port);
  try {
    const res = (await rec.handler("cs_dbg_launch")({ program: "/opt/app" })) as ToolResultLike;
    // 🔴 `initialized_seen` ADDED AT 267 AND THESE SIX ASSERTIONS ARE PART OF THE FINDING.
    // Each pinned the WHOLE result object, so a key that ought to be there and is not
    // reads identically to one that ought not to be — which is why the deep-equal is kept
    // rather than loosened to a subset match. `true` here is a claim about the mock: it
    // DOES emit `initialized`, and a test asserting the false side is next door.
    // 🆕 285 — `cs-dap-launch-race-unrostered` (284). THE SHAPE IS ASSERTED BEFORE THE
    // FIELD, WHICH IS THE DIAGNOSTIC 275 SHIPPED AND THE ONLY THING THIS ROW ASKED FOR.
    // This test failed once on a loaded node-18 post-merge leg with `undefined` where the
    // session object belongs. `undefined` says the reply carried no `structuredContent`;
    // it does NOT say whether the tool refused, what it refused with, or whether the
    // handshake timed out — and the deep-equal below cannot say either, because it prints
    // the absence rather than the reply. The message here is what the next occurrence
    // will print, and fixing the flake needs it: nothing in this tree can produce that
    // sentence until it happens again (275's rule, and 273's session is the argument for
    // not guessing at it from here).
    assert.ok(res.structuredContent,
      `cs_dbg_launch returned no structuredContent — ${JSON.stringify(res).slice(0, 400)}`);
    assert.deepEqual(res.structuredContent, { session_id: "csharp", state: "running", initialized_seen: true });
  } finally { dap.close(); srv.close(); }
});

test("cs_dbg_set_breakpoints refuses a source that names nothing or names a directory", async () => {
  // Measured: `res://NoSuchFile.cs`, `res://demo` (a DIRECTORY) and `""` (which
  // path.join's down to the PROJECT ROOT) each answered {buffered:true,
  // breakpoints:[]} with isError:false — byte-identical to a real file.
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec, cfg } = csDapHarness(srv.port);
  try {
    fs.mkdirSync(path.join(cfg.csDapProjectPath, "demo"), { recursive: true });
    const missing = (await rec.handler("cs_dbg_set_breakpoints")({ path: "res://NoSuchFile.cs", lines: [1] })) as ToolResultLike;
    assert.equal(missing.isError, true);
    assert.match(missing.content?.[0]?.text ?? "", /no such file/);
    const dir = (await rec.handler("cs_dbg_set_breakpoints")({ path: "res://demo", lines: [1] })) as ToolResultLike;
    assert.equal(dir.isError, true);
    assert.match(dir.content?.[0]?.text ?? "", /is not a file/);
    const empty = (await rec.handler("cs_dbg_set_breakpoints")({ path: "", lines: [1] })) as ToolResultLike;
    assert.equal(empty.isError, true);
    assert.match(empty.content?.[0]?.text ?? "", /project root/);
    // A refusal is the HOST declining, not the adapter failing — it must not be
    // dressed as "C# DAP error [...]" and send the caller to debug netcoredbg.
    for (const r of [missing, dir, empty]) assert.doesNotMatch(r.content?.[0]?.text ?? "", /^C# DAP error/);
  } finally { dap.close(); srv.close(); }
});

test("cs_dbg_set_breakpoints refuses a project-anchored path that escapes the root, but NOT an absolute one", async () => {
  // 🔴 The escape check is deliberately narrower than the cs_* LSP plane's.
  // cs_dbg_launch documents debugging a different .NET program, whose sources live
  // outside the Godot project — refusing every outside path would break that
  // documented mainline. res:// and relative paths are project-anchored; absolute
  // ones are the caller explicitly naming a file elsewhere.
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec, cfg } = csDapHarness(srv.port);
  try {
    const escape = (await rec.handler("cs_dbg_set_breakpoints")({ path: "res://../../../etc/passwd", lines: [1] })) as ToolResultLike;
    assert.equal(escape.isError, true);
    assert.match(escape.content?.[0]?.text ?? "", /outside the C# project root/);

    // A sibling directory sharing the root's NAME PREFIX must not pass: the guard
    // compares against `root + path.sep`, never a bare startsWith(root).
    const siblingRoot = `${cfg.csDapProjectPath}-sibling`;
    fs.mkdirSync(siblingRoot, { recursive: true });
    fs.writeFileSync(path.join(siblingRoot, "X.cs"), "class X {}\n");
    const sibling = (await rec.handler("cs_dbg_set_breakpoints")({
      path: `res://../${path.basename(siblingRoot)}/X.cs`, lines: [1],
    })) as ToolResultLike;
    assert.equal(sibling.isError, true, "a sibling sharing the name prefix is still outside the root");

    // …and the legal cases survive.
    const outside = path.join(siblingRoot, "X.cs");
    const abs = (await rec.handler("cs_dbg_set_breakpoints")({ path: outside, lines: [1] })) as ToolResultLike;
    assert.notEqual(abs.isError, true, "an ABSOLUTE path outside the project is how you debug another program");
    fs.writeFileSync(path.join(cfg.csDapProjectPath, "Player.cs"), "class Player {}\n");
    const inside = (await rec.handler("cs_dbg_set_breakpoints")({ path: "res://Player.cs", lines: [1] })) as ToolResultLike;
    assert.notEqual(inside.isError, true);
  } finally { dap.close(); srv.close(); }
});

test("cs_dbg_attach's schema rejects a non-positive pid, and the tool refuses one nothing runs under", async () => {
  // 🔴 A HANDLER PULLED OUT OF A RECORDING SERVER NEVER SEES ITS zod SCHEMA, so the
  // schema half is asserted through the registered inputSchema directly — otherwise a
  // mutation that drops `.positive()` is invisible here.
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port);
  try {
    const shape = (rec.tools.get("cs_dbg_attach")!.config as { inputSchema: Record<string, z.ZodTypeAny> }).inputSchema;
    const schema = z.object(shape);
    for (const pid of [-1, 0]) {
      assert.equal(schema.safeParse({ process_id: pid }).success, false, `pid ${pid} is not a process id`);
    }
    assert.equal(schema.safeParse({ process_id: 4242 }).success, true, "a real pid must still parse");

    // 999999 parses, and is refused by the tool: `kill(pid, 0)` signals nothing, it
    // only asks the kernel. ESRCH means no such process.
    const gone = (await rec.handler("cs_dbg_attach")({ process_id: 999999 })) as ToolResultLike;
    assert.equal(gone.isError, true);
    assert.match(gone.content?.[0]?.text ?? "", /no such process/);
    assert.doesNotMatch(gone.content?.[0]?.text ?? "", /^C# DAP error/);

    // The over-eager mirror: our OWN pid exists, so it must reach the handshake.
    // (EPERM — a process owned by another user — is likewise NOT a refusal.)
    const self = (await rec.handler("cs_dbg_attach")({ process_id: process.pid })) as ToolResultLike;
    assert.doesNotMatch(self.content?.[0]?.text ?? "", /no such process/);
  } finally { dap.close(); srv.close(); }
});

test("cs_dbg_set_exception_breakpoints refuses a filter the adapter never advertised", async () => {
  // The EMPTY case was validated; membership was not, so an unknown id went to the
  // wire and came back `Failed command 'setExceptionBreakpoints' : 0x80070057` — a hex
  // code for a question the host already had the answer to.
  const caps = { supportsConfigurationDoneRequest: true, exceptionBreakpointFilters: [{ filter: "all", label: "all" }, { filter: "user-unhandled", label: "user-unhandled" }] };
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s, caps)) return;
    if (m.command === "setExceptionBreakpoints") dapResponse(s, m, { breakpoints: [{ verified: true }] });
  });
  const { dap, rec } = csDapHarness(srv.port);
  try {
    await rec.handler("cs_dbg_launch")({ program: "/opt/app" });
    const bad = (await rec.handler("cs_dbg_set_exception_breakpoints")({ filters: ["nonsense-filter"] })) as ToolResultLike;
    assert.equal(bad.isError, true);
    assert.match(bad.content?.[0]?.text ?? "", /does not advertise them/);
    assert.match(bad.content?.[0]?.text ?? "", /user-unhandled/, "the refusal must list the real filters");
    assert.doesNotMatch(bad.content?.[0]?.text ?? "", /^C# DAP error/);
    // The over-eager mirror: the advertised filters, and clearing, must still work.
    const good = (await rec.handler("cs_dbg_set_exception_breakpoints")({ filters: ["all"] })) as ToolResultLike;
    assert.notEqual(good.isError, true);
    const cleared = (await rec.handler("cs_dbg_set_exception_breakpoints")({})) as ToolResultLike;
    assert.notEqual(cleared.isError, true);
  } finally { dap.close(); srv.close(); }
});

test("an adapter failure carrying NO message never renders as a bare 'C# DAP error [cmd]: '", async () => {
  // Measured: netcoredbg advertises supportsSetVariable:true and answered a
  // setVariable failure with an empty `message`, so the tool's whole answer was
  // `C# DAP error [setVariable]: ` — text that says nothing about what went wrong.
  const { srv, stop } = await startDap((m, s) => {
    if (handshake(m, s)) return;
    // 🔴 `message: ""`, not an absent field. `onMessage` already substitutes
    // "C# DAP request failed" for an ABSENT message, so only an explicitly EMPTY one
    // reproduces what netcoredbg actually sent — and it is what reached the caller.
    if (m.command === "setVariable") writeFrame(s, { seq: 0, type: "response", request_seq: m.seq, success: false, command: "setVariable", message: "" });
  });
  const { dap, rec } = csDapHarness(srv.port, async () => ({ action: "accept", content: { proceed: true } }));
  try {
    await launchAndStop(dap, rec, stop, { program: "/opt/app" });
    const res = (await rec.handler("cs_dbg_set_variable")({ variables_ref: 1, name: "x", value: "1", confirm: true })) as ToolResultLike;
    assert.equal(res.isError, true);
    const text = (res.content?.[0]?.text ?? "").trim();
    assert.doesNotMatch(text, /^C# DAP error \[[a-zA-Z]+\]:$/, "an error whose text is only a label says nothing");
    assert.match(text, /reported a failure with no message/);
  } finally { dap.close(); srv.close(); }
});

// ---------------------------------------------------------------------------
// 263: the session/stop guards on the C# plane. Measured against a real
// netcoredbg 3.2.0-1092 before any of this existed — see `requireSession` /
// `requireStopped` in src/tools/csdap.ts for the two tables.
// ---------------------------------------------------------------------------

/** Every cs_dbg_* reader that must not answer without a session, with legal args. */
const CS_READER_CALLS: Array<[string, Record<string, unknown>]> = [
  ["cs_dbg_continue", {}],
  ["cs_dbg_step", { kind: "over" }],
  ["cs_dbg_stack_trace", {}],
  ["cs_dbg_scopes", { frame_id: 0 }],
  ["cs_dbg_variables", { variables_ref: 1 }],
  ["cs_dbg_evaluate", { expression: "1+1", confirm: true }],
  ["cs_dbg_set_variable", { variables_ref: 1, name: "x", value: "1", confirm: true }],
];

test("263: every cs_dbg_* reader refuses with NO session, and none reaches the adapter", async () => {
  // 🔴 Measured before the guard: seven of the nine answered with the adapter's own
  // hex — `Failed command 'stackTrace' : 0x80004005` — and `cs_dbg_watch` answered
  // isError:FALSE with a hex code inside every entry. Only cs_dbg_restart refused,
  // and only because it happens to read `lastStartMode`.
  const { srv, received } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port);
  for (const [name, args] of [...CS_READER_CALLS, ["cs_dbg_watch", { add: ["Counter"] }] as [string, Record<string, unknown>]]) {
    const res = (await rec.handler(name)(args)) as ToolResultLike;
    assert.equal(res.isError, true, `${name} must refuse without a session`);
    const text = String(res.content?.[0]?.text);
    assert.match(text, /needs a C# debug session/, `${name} must say why`);
    assert.match(text, /cs_dbg_launch or cs_dbg_attach/, `${name} must name both ways to open one`);
    assert.doesNotMatch(text, /DAP error/, `${name} is a host refusal, not an adapter failure`);
    assert.doesNotMatch(text, /0x[0-9A-Fa-f]{8}/, `${name} must not hand back a raw hex code`);
  }
  // The economic half: not one request may leave the host — the client never even
  // connects, so the adapter sees nothing at all.
  assert.equal(received.length, 0, "a refused call must not reach the adapter");
  dap.close();
  await srv.close();
});

test("263: every cs_dbg_* reader refuses while the program RUNS, above the round trip", async () => {
  const { srv, received } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port);
  await rec.handler("cs_dbg_launch")({});
  const handshakeCommands = received.length;
  for (const [name, args] of CS_READER_CALLS) {
    const started = Date.now();
    const res = (await rec.handler(name)(args)) as ToolResultLike;
    const elapsed = Date.now() - started;
    assert.equal(res.isError, true, `${name} must refuse while the program runs`);
    const text = String(res.content?.[0]?.text);
    assert.match(text, /needs the program stopped at a breakpoint/, `${name} must say why`);
    // 260's rule: name the state that was READ, not the one that was assumed.
    assert.match(text, /the program is running/, `${name} must name the state it read`);
    assert.doesNotMatch(text, /DAP error/, `${name} is a host refusal, not an adapter failure`);
    // 🔴 THE CLAIM THAT CANNOT BE MADE FROM THE TEXT. The measured cs_dbg_continue sat
    // for 15,000 ms before answering `{"state":"running"}`; a guard moved back below
    // the round trip would print exactly the same sentence.
    assert.ok(elapsed < 2000, `${name} must refuse before the round trip, not after (took ${elapsed}ms)`);
  }
  assert.equal(received.length, handshakeCommands, "a refused call must not reach the adapter at all");
  assert.equal(dap.hasSession, true, "refusing must not tear down the session");
  dap.close();
  await srv.close();
});

test("263: a refused call cannot poison the state the guard reads", async () => {
  // 🔴 THE REASON `sessionStarted` EXISTS ON THIS CLIENT. Measured against a real
  // netcoredbg: `cs_dbg_continue` on a never-launched client left `state = "running"`
  // behind — `resume()` assigns it optimistically before it waits — so a guard reading
  // `state` alone would have been unlocked by the very first call it refused.
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port);
  assert.equal(dap.hasSession, false, "a fresh client has no session");
  await rec.handler("cs_dbg_continue")({});
  assert.equal(dap.hasSession, false, "…and a refused continue must not create one");
  const res = (await rec.handler("cs_dbg_stack_trace")({})) as ToolResultLike;
  assert.match(String(res.content?.[0]?.text), /needs a C# debug session/, "the next call still refuses");
  dap.close();
  await srv.close();
});

test("263: cs_dbg_watch still manages the set while the program runs, and says why values are missing", async () => {
  // The one reader NOT refused, on purpose — the same call session 262 made on the
  // GDScript plane. What it replaces answered isError:false with `error: "error:
  // 0x80004005"` on every entry: a hex code offered as the reason a watch has no value.
  const { srv, received } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port);
  await rec.handler("cs_dbg_launch")({});
  const before = received.length;
  const res = (await rec.handler("cs_dbg_watch")({ add: ["Counter", "i"] })) as ToolResultLike;
  assert.equal(res.isError, undefined, "managing the set is not an error");
  assert.ok(res.structuredContent, `cs_dbg_watch returned no structuredContent — ${JSON.stringify(res).slice(0, 400)}`);
  const watches = (res.structuredContent as { watches: Array<{ expression: string; value: string; error: string | null }> }).watches;
  assert.deepEqual(watches.map((w) => w.expression), ["Counter", "i"], "the set change was applied");
  for (const w of watches) {
    assert.equal(w.value, "", "no value may be invented while the program runs");
    assert.match(String(w.error), /not stopped \(running\)/, "the entry names the state it read");
    assert.doesNotMatch(String(w.error), /0x[0-9A-Fa-f]{8}/, "…and never the hex code it used to");
  }
  assert.equal(received.length, before, "and it costs no adapter round trip");
  dap.close();
  await srv.close();
});

test("263: the stopped guard runs BEFORE the confirmation prompt on the gated C# tools", async () => {
  // Approving arbitrary code execution against a program with no frame to execute in
  // is a prompt that can only end in the adapter's silence.
  let prompts = 0;
  const { srv } = await startDap((m, s) => { handshake(m, s); });
  const { dap, rec } = csDapHarness(srv.port, async () => { prompts++; return { action: "accept" as const, content: { proceed: true } }; });
  await rec.handler("cs_dbg_launch")({});
  await rec.handler("cs_dbg_evaluate")({ expression: "1+1" });
  await rec.handler("cs_dbg_set_variable")({ variables_ref: 1, name: "x", value: "1" });
  assert.equal(prompts, 0, "no confirmation may be raised for a program that is not stopped");
  dap.close();
  await srv.close();
});

test("263: cs_dbg_set_exception_breakpoints requires a session but NOT a stop", async () => {
  // 🔴 THE MESSAGE THAT BLAMED THE ADAPTER FOR A HANDSHAKE THAT NEVER HAPPENED.
  // `capabilities` is null until `initialize`, so with no session this tool answered
  // "unsupported by the connected C# debug adapter (it advertises no
  // exceptionBreakpointFilters)" — about an adapter that advertises `all` and
  // `user-unhandled`, and that nothing had asked.
  const caps = { supportsConfigurationDoneRequest: true, exceptionBreakpointFilters: [{ filter: "all", label: "All exceptions" }] };
  const { srv } = await startDap((m, s) => {
    if (handshake(m, s, caps)) return;
    if (m.command === "setExceptionBreakpoints") dapResponse(s, m, { breakpoints: [{ verified: true }] });
  });
  const { dap, rec } = csDapHarness(srv.port);
  const cold = (await rec.handler("cs_dbg_set_exception_breakpoints")({ filters: ["all"] })) as ToolResultLike;
  assert.equal(cold.isError, true, "with no session it must refuse");
  const coldText = String(cold.content?.[0]?.text);
  assert.match(coldText, /needs a C# debug session/, "…naming the missing session");
  assert.doesNotMatch(coldText, /advertises no exceptionBreakpointFilters/, "…and never blaming the adapter for it");
  // NOT stop-guarded: filters are armed for the future, so a live running session is a
  // legitimate caller — the asymmetry dbg_data_breakpoints has one plane over.
  await rec.handler("cs_dbg_launch")({});
  const warm = (await rec.handler("cs_dbg_set_exception_breakpoints")({ filters: ["all"] })) as ToolResultLike;
  assert.equal(warm.isError, undefined, "a running session may still arm exception filters");
  assert.ok(warm.structuredContent, `the warm call returned no structuredContent — ${JSON.stringify(warm).slice(0, 400)}`);
  assert.deepEqual((warm.structuredContent as { filters: string[] }).filters, ["all"]);
  dap.close();
  await srv.close();
});

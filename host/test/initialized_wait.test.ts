import { test, before } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DapClient,
  DapError,
  DAP_TIMEOUT_CODE,
  DAP_UNANNOUNCED_CODE,
  unorderedHandshakeWarning,
  INITIALIZED_WAIT_CEILING_MS,
} from "../src/dap.js";
import { CsDapClient } from "../src/csdap.js";
import { registerDapTools } from "../src/tools/dap.js";
import { registerCsDapTools } from "../src/tools/csdap.js";
import { loadConfig, type Config } from "../src/config.js";
import { makeRecordingServer, type ToolResultLike } from "./helpers/recording-server.js";
import { startTcpServer, makeFrameParser, writeFrame, TIMER_SLACK_MS, type TcpServer } from "./helpers/tcp.js";
import { FramedConnection } from "../src/framing.js";

/**
 * 267 — the wait for `initialized` RESOLVES on timeout, and until this release both
 * outcomes were the same observable.
 *
 * 🔴 THE MEASUREMENT THAT OPENED THE ROW, reproduced here as the fixture. Driven at 266
 * against a stub adapter that answers `initialize` and never emits `initialized`,
 * `start()` returned after 5,003 ms having sent
 * `initialize -> launch -> setBreakpoints -> configurationDone` — the same order, in the
 * same shape, as a conformant run, with no complaint anywhere. `waitEvent` returned
 * `Promise<void>`, so *the adapter said it was ready* and *five seconds passed* arrived
 * at the caller as the identical value.
 *
 * The fixtures below use a 200 ms client deadline, so the silent case costs 200 ms rather
 * than five seconds, and every test asserts on the number actually waited, not on a literal.
 *
 * 🔴 268 SPLIT THIS FILE IN TWO, AND THE SPLIT IS THE POINT. 267's tests now run under
 * `GODOT_DAP_REQUIRE_INITIALIZED=0` — they are the OPT-OUT's contract, preserved exactly,
 * including the `min(timeoutMs, 5000)` window their warnings print. The 268 tests at the
 * foot of the file are the shipped default: the session is REFUSED, the wait runs to the
 * caller's own deadline instead of a five-second ceiling, and `configurationDone` is
 * asserted ABSENT rather than merely late.
 */

const WAIT_MS = 200;

/**
 * Run `body` and tear the sockets down UNCONDITIONALLY.
 *
 * 🔴 THIS EXISTS BECAUSE A POSITIVE CONTROL ON THIS SESSION'S OWN WORK FOUND THE DEFECT
 * 266 §4 had already written down, in the file written by the session that wrote it down.
 * The first draft closed the client and the server on the last lines of each test. Under
 * the control that makes `waitEvent` always resolve `true`, the false-direction assertion
 * throws, the closes never run, and the open server holds the event loop — so `node --test`
 * HANGS instead of failing. A test that cannot report its own failure is worth less than
 * no test, and a control that hangs reports nothing at all.
 */
async function withTeardown<T>(closers: Array<() => unknown>, body: () => Promise<T>): Promise<T> {
  try {
    return await body();
  } finally {
    for (const close of closers) {
      try { await close(); } catch { /* teardown must not mask the real failure */ }
    }
  }
}

interface DapMsg { seq: number; type: string; command?: string; arguments?: Record<string, unknown>; request_seq?: number; success?: boolean; event?: string; body?: unknown }

function dapResponse(s: net.Socket, req: DapMsg, body: Record<string, unknown> = {}): void {
  writeFrame(s, { seq: 0, type: "response", request_seq: req.seq, success: true, command: req.command, body });
}

/**
 * A fake adapter that answers every handshake request and emits `initialized` only when
 * `announce` is true.
 *
 * 🔴 THE `announce: false` ARM IS NOT A BROKEN ADAPTER, it is a SLOW one — this is what
 * the host sees from any adapter whose `initialized` lands after the window, and the
 * point of the row is that the host could not tell the two apart.
 */
async function adapter(announce: boolean): Promise<{ srv: TcpServer; order: string[] }> {
  const order: string[] = [];
  const srv = await startTcpServer((s) => {
    const parse = makeFrameParser((m) => {
      const msg = m as unknown as DapMsg;
      if (msg.type !== "request" || !msg.command) return;
      order.push(msg.command);
      switch (msg.command) {
        case "initialize":
          dapResponse(s, msg, { supportsConfigurationDoneRequest: true });
          if (announce) writeFrame(s, { seq: 0, type: "event", event: "initialized", body: {} });
          return;
        default:
          dapResponse(s, msg, {});
      }
    });
    s.on("data", (c) => parse(Buffer.from(c)));
  });
  return { srv, order };
}

let cfgDir: string;
/**
 * A runtime-bridge port nothing holds, taken from the kernel rather than assumed.
 *
 * 🔴 THIS IS A FINDING ABOUT THIS SESSION'S OWN TESTS AND IT IS THE SESSION'S OWN THEME.
 * The first draft spread `loadConfig()` and let `runtimePort` default. `dbg_launch` is
 * port-gated — it refuses when the runtime bridge port is already bound, and a refusal has
 * no `structuredContent` — so on a machine where something holds that port the two
 * `dbg_launch` tests read `undefined.initialized_seen` and threw. Measured: green in a
 * fresh container where nothing was listening, RED on the developer's Mac where something
 * was. The tests were asserting a property of the machine they ran on.
 *
 * `processes.test.ts` already solved this: bind an ephemeral port, release it, use the
 * number. Taking what the kernel hands out makes the free port a FACT of the test rather
 * than an assumption about the host — and `dbg_attach` and the C# pair, which are not
 * port-gated, passed on both machines and so proved nothing about the gate.
 */
let freeRuntimePort: number;

before(async () => {
  freeRuntimePort = await new Promise<number>((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
});

/**
 * 🔴 `requireInitialized` IS AN EXPLICIT ARGUMENT AT EVERY CALL BELOW, NEVER A DEFAULT.
 * 268 made refusal the shipped default, so a test that omits it is asserting whichever
 * behaviour `loadConfig()` happens to produce — which is exactly the shape of the defect
 * 267 §5 found one file over, where a fixture spread `loadConfig()` and inherited the
 * developer's machine. Each test below states which of the two contracts it is testing.
 */
function cfg(requireInitialized: boolean): Config {
  cfgDir ??= fs.mkdtempSync(path.join(os.tmpdir(), "gcb-init-"));
  fs.writeFileSync(path.join(cfgDir, "project.godot"), "config_version=5\n");
  return {
    ...loadConfig(),
    projectPath: cfgDir,
    csDapProjectPath: cfgDir,
    runtimeHost: "127.0.0.1",
    runtimePort: freeRuntimePort,
    dapRequireInitialized: requireInitialized,
  };
}

// ------------------------------------------------------------------- the sentence

test("267: unorderedHandshakeWarning names the window it was given and nothing else", () => {
  const a = unorderedHandshakeWarning(200);
  const b = unorderedHandshakeWarning(5000);
  assert.match(a, /within 200ms/);
  assert.match(b, /within 5000ms/);
  assert.notEqual(a, b);
  // It names the symptom a caller can act on, not just the protocol rule.
  assert.match(a, /breakpoint/i);
  // And it does NOT claim the session failed — it did not.
  assert.match(a, /the session is otherwise live/);
});

test("267: the shared ceiling is the number both planes were already using", () => {
  assert.equal(INITIALIZED_WAIT_CEILING_MS, 5000);
});

// ------------------------------------------------------- GDScript plane, both directions

test("267: dbg_launch reports initialized_seen true when the adapter announces itself", async () => {
  const { srv, order } = await adapter(true);
  const dap = new DapClient("127.0.0.1", srv.port, WAIT_MS);
  const rec = makeRecordingServer();
  registerDapTools(rec.server as unknown as Parameters<typeof registerDapTools>[0], dap, cfg(true));

  await withTeardown([() => dap.close(), () => srv.close()], async () => {
    const res = (await rec.handler("dbg_launch")({ scene: "main" })) as ToolResultLike;
    const out = res.structuredContent as Record<string, unknown>;
    assert.equal(out.initialized_seen, true);
    // No warning: nothing went wrong, and a warning on the healthy path is the defect that
    // makes every warning ignorable.
    assert.equal(out.warning, undefined);
    assert.deepEqual(order, ["initialize", "launch", "configurationDone"]);
  });
});

test("267: under the opt-out, dbg_launch reports initialized_seen FALSE and warns when the event never comes", async () => {
  const { srv, order } = await adapter(false);
  const dap = new DapClient("127.0.0.1", srv.port, WAIT_MS);
  const rec = makeRecordingServer();
  registerDapTools(rec.server as unknown as Parameters<typeof registerDapTools>[0], dap, cfg(false));

  await withTeardown([() => dap.close(), () => srv.close()], async () => {
    const began = Date.now();
    const res = (await rec.handler("dbg_launch")({ scene: "main" })) as ToolResultLike;
    const elapsed = Date.now() - began;
    const out = res.structuredContent as Record<string, unknown>;

    assert.equal(out.initialized_seen, false);
    assert.match(String(out.warning), /did not announce itself/);
    assert.match(String(out.warning), new RegExp(`within ${WAIT_MS}ms`));
    // 🔴 THE LAUNCH STILL SUCCEEDS **ON THIS PATH**, AND ONLY ON THIS PATH. 267 wrote
    // here that this assertion "stops a future session quietly turning the report into a
    // refusal without deciding to". It did its job: 268 turned it into a refusal, was
    // stopped by this line, and the refusal was DECIDED — he took it when it was offered
    // at pickup. The contract this test now defends is the opt-out, which exists to
    // reproduce 267's behaviour exactly, down to the window its warning prints.
    assert.notEqual(res.isError, true);
    // The handshake DID run out of order, and the order is asserted rather than described:
    // this is the defect, not the fix.
    assert.deepEqual(order, ["initialize", "launch", "configurationDone"]);
    // It waited the window rather than returning instantly. 🔴 THE SLACK IS THE TIMER'S,
    // NOT THIS TEST'S — a `setTimeout` may come back inside its own window and this line
    // reddened `main` at `4a718f7` over one millisecond of it. `TIMER_SLACK_MS` carries
    // the measurement and the reason; what is asserted here is unchanged, because a wait
    // that did not happen returns in single-digit milliseconds and not in 195.
    assert.ok(
      elapsed >= WAIT_MS - TIMER_SLACK_MS,
      `expected at least ${WAIT_MS - TIMER_SLACK_MS}ms (${WAIT_MS} less the timer's own ${TIMER_SLACK_MS}ms), waited ${elapsed}ms`,
    );
  });
});

test("267: under the opt-out, the two dbg_attach answers DIFFER — a constant true or false would pass one alone", async () => {
  const announced = await adapter(true);
  const silent = await adapter(false);
  const run = async (srv: TcpServer): Promise<unknown> => {
    const dap = new DapClient("127.0.0.1", srv.port, WAIT_MS);
    const rec = makeRecordingServer();
    registerDapTools(rec.server as unknown as Parameters<typeof registerDapTools>[0], dap, cfg(false));
    return withTeardown([() => dap.close()], async () => {
      const res = (await rec.handler("dbg_attach")({})) as ToolResultLike;
      return (res.structuredContent as Record<string, unknown>).initialized_seen;
    });
  };
  await withTeardown([() => announced.srv.close(), () => silent.srv.close()], async () => {
    const a = await run(announced.srv);
    const b = await run(silent.srv);
    assert.equal(a, true);
    assert.equal(b, false);
    assert.notEqual(a, b);
  });
});

// ------------------------------------------------------------ C# plane, both directions

test("267: under the opt-out, cs_dbg_attach reports initialized_seen in both directions", async () => {
  const announced = await adapter(true);
  const silent = await adapter(false);
  const run = async (srv: TcpServer): Promise<Record<string, unknown>> => {
    const conn = new FramedConnection("127.0.0.1", srv.port, "C# DAP", "hint");
    const cs = new CsDapClient(conn, WAIT_MS);
    const rec = makeRecordingServer();
    registerCsDapTools(rec.server as unknown as Parameters<typeof registerCsDapTools>[0], cs, cfg(false));
    return withTeardown([() => conn.close()], async () => {
      const res = (await rec.handler("cs_dbg_attach")({ process_id: process.pid })) as ToolResultLike;
      return res.structuredContent as Record<string, unknown>;
    });
  };
  await withTeardown([() => announced.srv.close(), () => silent.srv.close()], async () => {
    const good = await run(announced.srv);
    const bad = await run(silent.srv);

    assert.equal(good.initialized_seen, true);
    assert.equal(good.warning, undefined);
    assert.equal(bad.initialized_seen, false);
    assert.match(String(bad.warning), new RegExp(`within ${WAIT_MS}ms`));
    assert.notEqual(good.initialized_seen, bad.initialized_seen);
  });
});

// ------------------------------------------ 268: the refusal, which is now the default

/**
 * 🔴 268 — REFUSED, NOT REPORTED, AND THE OBJECTION 267 RAISED IS PAID RATHER THAN
 * ACCEPTED. 267 took the report because "refusing outright would have broken every
 * adapter in the field to fix a silence" — true of a refusal that kept the five-second
 * ceiling, and the ceiling is what 268 dropped. The wait now runs to the caller's OWN
 * declared `dapTimeoutMs`, so an adapter that is merely slow SUCCEEDS where it used to be
 * configured out of order at five seconds and told nobody. Only an adapter that never
 * announces itself at all is refused, and the sentence names both ways out.
 */

test("268: dbg_launch REFUSES a session whose adapter never announces itself", async () => {
  const { srv, order } = await adapter(false);
  const dap = new DapClient("127.0.0.1", srv.port, WAIT_MS);
  const rec = makeRecordingServer();
  registerDapTools(rec.server as unknown as Parameters<typeof registerDapTools>[0], dap, cfg(true));

  await withTeardown([() => dap.close(), () => srv.close()], async () => {
    const res = (await rec.handler("dbg_launch")({ scene: "main" })) as ToolResultLike;
    assert.equal(res.isError, true);
    const text = res.content![0].text!;
    assert.match(text, /never emitted `initialized`/);
    // The window named is the one actually waited — the caller's deadline, not the ceiling.
    assert.match(text, new RegExp(`within ${WAIT_MS}ms`));
    assert.doesNotMatch(text, /within 5000ms/);
    // Both ways out, because the host cannot tell a slow adapter from a silent one.
    assert.match(text, /GODOT_DAP_TIMEOUT_MS/);
    assert.match(text, /GODOT_DAP_REQUIRE_INITIALIZED=0/);
    // 🔴 AND THE HANDSHAKE STOPPED BEFORE THE DEFECT. `configurationDone` is the request
    // that completes a session the caller has just been told did not start; asserting its
    // ABSENCE is the difference between refusing and merely reporting late.
    assert.deepEqual(order, ["initialize", "launch"]);
  });
});

test("268: the refusal leaves no session behind — the tools' own guard refuses afterwards", async () => {
  const { srv } = await adapter(false);
  const dap = new DapClient("127.0.0.1", srv.port, WAIT_MS);
  const rec = makeRecordingServer();
  registerDapTools(rec.server as unknown as Parameters<typeof registerDapTools>[0], dap, cfg(true));

  await withTeardown([() => dap.close(), () => srv.close()], async () => {
    await rec.handler("dbg_launch")({ scene: "main" });
    // 263's rule: a state left reading `running` by a session that never started unlocks
    // every later tool. `dbg_continue` is the one that measured it.
    assert.equal(dap.state, "terminated");
    const after = (await rec.handler("dbg_continue")({})) as ToolResultLike;
    assert.equal(after.isError, true);
  });
});

test("268: a SLOW adapter now succeeds where the five-second ceiling used to configure it out of order", async () => {
  // Announces at 120 ms — past any ceiling this test could set below it, inside the
  // caller's own 400 ms deadline. This is the population 267 declined to break, and the
  // reason the refusal did not simply inherit the old window.
  const order: string[] = [];
  const srv = await startTcpServer((s) => {
    const parse = makeFrameParser((m) => {
      const msg = m as unknown as { seq: number; type: string; command?: string };
      if (msg.type !== "request" || !msg.command) return;
      order.push(msg.command);
      if (msg.command === "initialize") {
        dapResponse(s, msg as never, { supportsConfigurationDoneRequest: true });
        setTimeout(() => writeFrame(s, { seq: 0, type: "event", event: "initialized", body: {} }), 120);
        return;
      }
      dapResponse(s, msg as never, {});
    });
    s.on("data", (c) => parse(Buffer.from(c)));
  });
  const dap = new DapClient("127.0.0.1", srv.port, 400);
  const rec = makeRecordingServer();
  registerDapTools(rec.server as unknown as Parameters<typeof registerDapTools>[0], dap, cfg(true));

  await withTeardown([() => dap.close(), () => srv.close()], async () => {
    const res = (await rec.handler("dbg_launch")({ scene: "main" })) as ToolResultLike;
    assert.notEqual(res.isError, true);
    assert.equal((res.structuredContent as Record<string, unknown>).initialized_seen, true);
    assert.deepEqual(order, ["initialize", "launch", "configurationDone"]);
  });
});

test("268: cs_dbg_attach refuses on the same terms — the change names two planes", async () => {
  const { srv, order } = await adapter(false);
  const conn = new FramedConnection("127.0.0.1", srv.port, "C# DAP", "hint");
  const cs = new CsDapClient(conn, WAIT_MS);
  const rec = makeRecordingServer();
  registerCsDapTools(rec.server as unknown as Parameters<typeof registerCsDapTools>[0], cs, cfg(true));

  await withTeardown([() => conn.close(), () => srv.close()], async () => {
    const res = (await rec.handler("cs_dbg_attach")({ process_id: process.pid })) as ToolResultLike;
    assert.equal(res.isError, true);
    assert.match(res.content![0].text!, /The C# debug adapter answered `initialize`/);
    assert.match(res.content![0].text!, /GODOT_CSDAP_TIMEOUT_MS/);
    assert.deepEqual(order, ["initialize", "attach"]);
  });
});

test("268: the refusal carries the `unannounced` code, so a caller branches on a field", async () => {
  const { srv } = await adapter(false);
  const dap = new DapClient("127.0.0.1", srv.port, WAIT_MS);
  await withTeardown([() => dap.close(), () => srv.close()], async () => {
    const err = await dap.start("launch", { project: "x" }, 0, true).then(() => null, (e: unknown) => e);
    assert.ok(err instanceof DapError);
    assert.equal(err.code, DAP_UNANNOUNCED_CODE);
    // NOT the timeout code — `isDapTimeout` gates two tools' answers and a handshake
    // refusal is not a request deadline. Distinct causes get distinct codes, which is the
    // whole argument of the row this ships beside.
    assert.notEqual(err.code, DAP_TIMEOUT_CODE);
  });
});

test("268: GODOT_DAP_REQUIRE_INITIALIZED reads only recognised falsehoods, and a typo keeps the guard on", () => {
  const saved = process.env.GODOT_DAP_REQUIRE_INITIALIZED;
  try {
    for (const off of ["0", "false", "FALSE", "off", "no", " no "]) {
      process.env.GODOT_DAP_REQUIRE_INITIALIZED = off;
      assert.equal(loadConfig().dapRequireInitialized, false, `${off} must disable the refusal`);
    }
    // 🔴 THE TYPO KEEPS THE GUARD ON, which is the opposite of how this file reads a
    // malformed DEADLINE. A bad number falls back because both outcomes are ordinary; a
    // bad guard setting must not silently disable the guard.
    for (const on of ["", "1", "true", "yes", "no thanks", "disabled"]) {
      process.env.GODOT_DAP_REQUIRE_INITIALIZED = on;
      assert.equal(loadConfig().dapRequireInitialized, true, `${on} must NOT disable the refusal`);
    }
    delete process.env.GODOT_DAP_REQUIRE_INITIALIZED;
    assert.equal(loadConfig().dapRequireInitialized, true, "unset is the shipped default");
  } finally {
    if (saved === undefined) delete process.env.GODOT_DAP_REQUIRE_INITIALIZED;
    else process.env.GODOT_DAP_REQUIRE_INITIALIZED = saved;
  }
});

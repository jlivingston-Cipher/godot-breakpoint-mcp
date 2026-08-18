import { test, before } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DapClient, unorderedHandshakeWarning, INITIALIZED_WAIT_CEILING_MS } from "../src/dap.js";
import { CsDapClient } from "../src/csdap.js";
import { registerDapTools } from "../src/tools/dap.js";
import { registerCsDapTools } from "../src/tools/csdap.js";
import { loadConfig, type Config } from "../src/config.js";
import { makeRecordingServer, type ToolResultLike } from "./helpers/recording-server.js";
import { startTcpServer, makeFrameParser, writeFrame, type TcpServer } from "./helpers/tcp.js";
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
 * than five seconds: the window is `min(timeoutMs, 5000)` and the test asserts on the
 * number actually waited, not on a literal.
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

function cfg(): Config {
  cfgDir ??= fs.mkdtempSync(path.join(os.tmpdir(), "gcb-init-"));
  fs.writeFileSync(path.join(cfgDir, "project.godot"), "config_version=5\n");
  return { ...loadConfig(), projectPath: cfgDir, csDapProjectPath: cfgDir, runtimeHost: "127.0.0.1", runtimePort: freeRuntimePort };
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
  registerDapTools(rec.server as unknown as Parameters<typeof registerDapTools>[0], dap, cfg());

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

test("267: dbg_launch reports initialized_seen FALSE and warns when the event never comes", async () => {
  const { srv, order } = await adapter(false);
  const dap = new DapClient("127.0.0.1", srv.port, WAIT_MS);
  const rec = makeRecordingServer();
  registerDapTools(rec.server as unknown as Parameters<typeof registerDapTools>[0], dap, cfg());

  await withTeardown([() => dap.close(), () => srv.close()], async () => {
    const began = Date.now();
    const res = (await rec.handler("dbg_launch")({ scene: "main" })) as ToolResultLike;
    const elapsed = Date.now() - began;
    const out = res.structuredContent as Record<string, unknown>;

    assert.equal(out.initialized_seen, false);
    assert.match(String(out.warning), /did not announce itself/);
    assert.match(String(out.warning), new RegExp(`within ${WAIT_MS}ms`));
    // 🔴 THE LAUNCH STILL SUCCEEDS. Reported, not refused — an adapter that works today
    // keeps working, and this assertion is what stops a future session quietly turning the
    // report into a refusal without deciding to.
    assert.notEqual(res.isError, true);
    // The handshake DID run out of order, and the order is asserted rather than described:
    // this is the defect, not the fix.
    assert.deepEqual(order, ["initialize", "launch", "configurationDone"]);
    // It waited the window rather than returning instantly.
    assert.ok(elapsed >= WAIT_MS, `expected at least ${WAIT_MS}ms, waited ${elapsed}ms`);
  });
});

test("267: the two dbg_launch answers DIFFER — a constant true or false would pass one alone", async () => {
  const announced = await adapter(true);
  const silent = await adapter(false);
  const run = async (srv: TcpServer): Promise<unknown> => {
    const dap = new DapClient("127.0.0.1", srv.port, WAIT_MS);
    const rec = makeRecordingServer();
    registerDapTools(rec.server as unknown as Parameters<typeof registerDapTools>[0], dap, cfg());
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

test("267: cs_dbg_launch reports initialized_seen in both directions", async () => {
  const announced = await adapter(true);
  const silent = await adapter(false);
  const run = async (srv: TcpServer): Promise<Record<string, unknown>> => {
    const conn = new FramedConnection("127.0.0.1", srv.port, "C# DAP", "hint");
    const cs = new CsDapClient(conn, WAIT_MS);
    const rec = makeRecordingServer();
    registerCsDapTools(rec.server as unknown as Parameters<typeof registerCsDapTools>[0], cs, cfg());
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

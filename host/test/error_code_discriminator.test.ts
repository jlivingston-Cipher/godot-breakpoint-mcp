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
} from "../src/dap.js";
import { CsDapClient } from "../src/csdap.js";
import { registerDapTools } from "../src/tools/dap.js";
import { registerCsDapTools } from "../src/tools/csdap.js";
import { loadConfig, type Config } from "../src/config.js";
import { BridgeError, BRIDGE_TIMEOUT_CODE, bridgeErrorLabel } from "../src/bridge.js";
import { fail as bridgeFail } from "../src/tools/editor/common.js";
import { appendCaveat, CAVEAT_NON_IDEMPOTENT } from "../src/timeout-caveat.js";
import { makeRecordingServer, type ToolResultLike } from "./helpers/recording-server.js";
import { startTcpServer, makeFrameParser, writeFrame, type TcpServer } from "./helpers/tcp.js";
import { FramedConnection } from "../src/framing.js";

/**
 * 268 — `dap-timeout-predicate-reads-prose`.
 *
 * 🔴 THE ROW, IN ONE LINE: both DAP tool layers decided a shipped tool's answer with
 * `err instanceof DapError && /timed out after/.test(err.message)`, so which sentence
 * `dbg_evaluate` and `dbg_set_variable` returned was selected by a regex over English.
 * 267 found it while giving `DapError` a `remedy` field, declined to reword the messages
 * for exactly that reason, and asserted the wording instead — a test defending a defect
 * rather than a behaviour.
 *
 * 🔴 AND IT WAS NEVER ONLY A HAZARD. The regex matched the message body of ANY
 * `DapError`, including the one built at `dap.ts`'s adapter-reported-failure site, which
 * carries the ADAPTER'S OWN WORDS. An adapter answering `setVariable` with a failure
 * whose text happens to contain "timed out after" — its own inner deadline, say — was
 * told by this host that "Godot's GDScript debug adapter does not implement it", a
 * measured claim about a different build, invented over a reply that did arrive. The
 * two `still speaks for the adapter` tests below drive exactly that, and they fail
 * against the predicate this release removes.
 */

const WAIT_MS = 200;

interface DapMsg { seq: number; type: string; command?: string; arguments?: Record<string, unknown>; request_seq?: number; success?: boolean; event?: string; body?: unknown; message?: string }

function respond(s: net.Socket, req: DapMsg, body: Record<string, unknown> = {}): void {
  writeFrame(s, { seq: 0, type: "response", request_seq: req.seq, success: true, command: req.command, body });
}

/** A failure answered BY the adapter, carrying the adapter's own sentence. */
function respondFailure(s: net.Socket, req: DapMsg, message: string): void {
  writeFrame(s, { seq: 0, type: "response", request_seq: req.seq, success: false, command: req.command, message });
}

let cfgDir: string;

/**
 * A runtime-bridge port nothing holds, taken from the kernel rather than assumed.
 *
 * 🔴 THIS FILE SHIPPED 267 §5's DEFECT IN THE SESSION THAT CITED IT, AND A DRIVE CAUGHT
 * IT RATHER THAN A REVIEW. The first draft spread `loadConfig()` and let `runtimePort`
 * default to 9081. `dbg_launch` is port-gated and the tests below launch before they can
 * ask anything about `setVariable`. Squatting 9081 and re-running this file did not FAIL
 * it — **it HUNG**, because the launch refusal sends the rest of the test down a path that
 * never settles while an open server holds the event loop. Green on a machine where
 * nothing listens, a silent timeout on one where something does, and his editor holds that
 * port most of the time. 266 §4's shape and 267 §5's cause, in one file.
 *
 * `processes.test.ts` solved this before either of them: bind an ephemeral port, release
 * it, use the number. What the kernel hands out is a FACT of the test rather than an
 * assumption about the host.
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

function cfg(over: Partial<Config> = {}): Config {
  cfgDir ??= fs.mkdtempSync(path.join(os.tmpdir(), "gcb-code-"));
  fs.writeFileSync(path.join(cfgDir, "project.godot"), "config_version=5\n");
  return {
    ...loadConfig(),
    projectPath: cfgDir,
    csDapProjectPath: cfgDir,
    runtimeHost: "127.0.0.1",
    runtimePort: freeRuntimePort,
    dapSetVarTimeoutMs: WAIT_MS,
    dapEvaluateTimeoutMs: WAIT_MS,
    ...over,
  };
}

/** Tear the sockets down unconditionally — 266 §4: a socket test that closes after its
 * assertions HANGS the runner instead of failing when one of them throws. */
async function withTeardown<T>(closers: Array<() => unknown>, body: () => Promise<T>): Promise<T> {
  try {
    return await body();
  } finally {
    for (const close of closers) {
      try { await close(); } catch { /* teardown must not mask the real failure */ }
    }
  }
}

/**
 * An adapter that completes the handshake, stops on demand, and hands `onCommand` every
 * later request so a test can decide how `setVariable` / `evaluate` are answered.
 */
async function adapter(
  onCommand: (m: DapMsg, s: net.Socket) => void,
): Promise<{ srv: TcpServer; stop: () => void }> {
  let live: net.Socket | null = null;
  const srv = await startTcpServer((s) => {
    live = s;
    const parse = makeFrameParser((m) => {
      const msg = m as unknown as DapMsg;
      if (msg.type !== "request" || !msg.command) return;
      switch (msg.command) {
        case "initialize":
          respond(s, msg, { supportsConfigurationDoneRequest: true, supportsSetVariable: true });
          writeFrame(s, { seq: 0, type: "event", event: "initialized", body: {} });
          return;
        case "launch":
        case "attach":
        case "configurationDone":
        case "setBreakpoints":
          respond(s, msg, {});
          return;
        default:
          onCommand(msg, s);
      }
    });
    s.on("data", (c) => parse(Buffer.from(c)));
  });
  return { srv, stop: () => { if (live) writeFrame(live, { seq: 0, type: "event", event: "stopped", body: { reason: "breakpoint", threadId: 1 } }); } };
}

// ------------------------------------------------------ the raise site sets the code

test("268: a GDScript DAP request deadline raises code `timeout` AND keeps its wording", async () => {
  const { srv } = await adapter(() => { /* never answer */ });
  const dap = new DapClient("127.0.0.1", srv.port, WAIT_MS);
  await withTeardown([() => dap.close(), () => srv.close()], async () => {
    const err = await dap.request("threads", {}, WAIT_MS).then(() => null, (e: unknown) => e);
    assert.ok(err instanceof DapError, "the deadline must raise a DapError");
    assert.equal(err.code, DAP_TIMEOUT_CODE);
    // 🔴 THE WORDING SURVIVES AND IS NO LONGER LOAD-BEARING — those are different claims.
    // Nothing branches on this sentence any more, so it is free to be improved; asserting
    // it here records that 268 chose NOT to change it in the same release that made it
    // safe to change. A change of channel that is also a change of wording is two changes.
    assert.match(err.message, /timed out after 200ms/);
  });
});

test("268: a C# DAP request deadline raises the same code from the twin plane", async () => {
  const { srv } = await adapter(() => { /* never answer */ });
  const conn = new FramedConnection("127.0.0.1", srv.port, "C# DAP", "hint");
  const cs = new CsDapClient(conn, WAIT_MS);
  await withTeardown([() => conn.close(), () => srv.close()], async () => {
    const err = await cs.request("threads", {}, WAIT_MS).then(() => null, (e: unknown) => e);
    assert.ok(err instanceof DapError);
    assert.equal(err.code, DAP_TIMEOUT_CODE);
    assert.match(err.message, /C# DAP 'threads' timed out after 200ms/);
  });
});

test("268: the adapter-reported failure site carries NO code, because those are not the host's words", async () => {
  const { srv } = await adapter((m, s) => respondFailure(s, m, "the adapter is unhappy"));
  const dap = new DapClient("127.0.0.1", srv.port, WAIT_MS);
  await withTeardown([() => dap.close(), () => srv.close()], async () => {
    const err = await dap.request("threads", {}, WAIT_MS).then(() => null, (e: unknown) => e);
    assert.ok(err instanceof DapError);
    // Absent, not `"relayed"`: a code is a claim the HOST makes about why it failed, and
    // over somebody else's sentence the host has no claim to make. Same construction as
    // `remedy`, for the same reason 267 gave.
    assert.equal(err.code, undefined);
  });
});

// ------------------------- the false direction: the branch no longer answers to English

test("268: dbg_set_variable still speaks for the adapter when the ADAPTER's own words say 'timed out after'", async () => {
  const { srv, stop } = await adapter((m, s) => {
    if (m.command === "setVariable") respondFailure(s, m, "mono runtime timed out after 5ms waiting for the debuggee");
    else respond(s, m, {});
  });
  const dap = new DapClient("127.0.0.1", srv.port, 3000);
  const rec = makeRecordingServer(async () => ({ action: "accept", content: { proceed: true } }));
  registerDapTools(rec.server as unknown as Parameters<typeof registerDapTools>[0], dap, cfg());

  await withTeardown([() => dap.close(), () => srv.close()], async () => {
    await rec.handler("dbg_launch")({ scene: "main" });
    const landed = new Promise<void>((resolve) => dap.once("stopped", () => resolve()));
    stop();
    await landed;

    const res = (await rec.handler("dbg_set_variable")({ variables_ref: 1, name: "hp", value: "5", confirm: true })) as ToolResultLike;
    assert.equal(res.isError, true);
    const text = res.content![0].text!;
    // 🔴 THIS IS THE DEFECT THE OLD PREDICATE HAD, NOT A HYPOTHETICAL. `/timed out after/`
    // matched the ADAPTER's sentence, so this host answered a measured claim about a
    // different Godot build over a reply that had actually arrived.
    assert.doesNotMatch(text, /does not implement it/i);
    assert.doesNotMatch(text, /measured unanswered/i);
    // What the caller gets instead is what the adapter said.
    assert.match(text, /mono runtime timed out after 5ms/);
  });
});

test("268: dbg_evaluate likewise — an adapter failure mentioning a deadline is relayed, not reinterpreted", async () => {
  const { srv, stop } = await adapter((m, s) => {
    if (m.command === "evaluate") respondFailure(s, m, "expression host timed out after 9ms");
    else respond(s, m, {});
  });
  const dap = new DapClient("127.0.0.1", srv.port, 3000);
  const rec = makeRecordingServer(async () => ({ action: "accept", content: { proceed: true } }));
  registerDapTools(rec.server as unknown as Parameters<typeof registerDapTools>[0], dap, cfg());

  await withTeardown([() => dap.close(), () => srv.close()], async () => {
    await rec.handler("dbg_launch")({ scene: "main" });
    const landed = new Promise<void>((resolve) => dap.once("stopped", () => resolve()));
    stop();
    await landed;

    const res = (await rec.handler("dbg_evaluate")({ expression: "1 + 1", confirm: true })) as ToolResultLike;
    assert.equal(res.isError, true);
    const text = res.content![0].text!;
    assert.doesNotMatch(text, /no result was returned/i);
    assert.match(text, /expression host timed out after 9ms/);
  });
});

test("268: cs_dbg_set_variable makes the same distinction — the row named two planes", async () => {
  const { srv, stop } = await adapter((m, s) => {
    if (m.command === "setVariable") respondFailure(s, m, "netcoredbg timed out after 7ms");
    else respond(s, m, {});
  });
  const conn = new FramedConnection("127.0.0.1", srv.port, "C# DAP", "hint");
  const cs = new CsDapClient(conn, 3000);
  const rec = makeRecordingServer(async () => ({ action: "accept", content: { proceed: true } }));
  registerCsDapTools(rec.server as unknown as Parameters<typeof registerCsDapTools>[0], cs, cfg());

  await withTeardown([() => conn.close(), () => srv.close()], async () => {
    await rec.handler("cs_dbg_attach")({ process_id: process.pid });
    const landed = new Promise<void>((resolve) => cs.once("stopped", () => resolve()));
    stop();
    await landed;

    const res = (await rec.handler("cs_dbg_set_variable")({ variables_ref: 1, name: "hp", value: "5", confirm: true })) as ToolResultLike;
    assert.equal(res.isError, true);
    const text = res.content![0].text!;
    assert.doesNotMatch(text, /does not implement/i);
    assert.match(text, /netcoredbg timed out after 7ms/);
  });
});

// ------------------------------------- the third site: the caveat's mark, now derived

/**
 * 🔴 THE WIDEST OF THE THREE, AND IT WAS NOT IN THE ROW. `timeout-caveat.ts` decides
 * whether every mutating tool warns that a timed-out change MAY ALREADY HAVE LANDED, by
 * matching the literal `Bridge error [timeout]` — a string it spelled out itself, one file
 * away from the template that builds it and two from the code that names it. A reword of
 * `fail()`'s label would have silently ended the warning on every non-idempotent tool with
 * the whole suite green. Found by asking §1's question of the whole tree instead of the
 * two sites the row happened to name.
 */
test("268: the caveat marker is the label `fail()` actually builds, not a copy of it", () => {
  const built = bridgeFail(new BridgeError(BRIDGE_TIMEOUT_CODE, "Bridge request 'node.add' timed out after 15000ms"));
  const text = built.content[0].text;
  assert.ok(text.startsWith(bridgeErrorLabel(BRIDGE_TIMEOUT_CODE)), `fail() must render the derived label, got: ${text}`);

  const caveated = appendCaveat(built, CAVEAT_NON_IDEMPOTENT) as typeof built;
  assert.notEqual(caveated, built, "a bridge timeout envelope must be caveated");
  assert.match(caveated.content[0].text, /Retrying may apply it a SECOND time/);
});

test("268: and a bridge failure that is NOT a timeout is still returned by identity", () => {
  const built = bridgeFail(new BridgeError("bridge_closed", "Bridge connection closed"));
  assert.equal(appendCaveat(built, CAVEAT_NON_IDEMPOTENT), built, "only the timeout envelope is caveated");
});

// ------------------------------------------------------------------ the codes themselves

test("268: the two host-raised codes are distinct and neither is the empty string", () => {
  assert.notEqual(DAP_TIMEOUT_CODE, DAP_UNANNOUNCED_CODE);
  assert.ok(DAP_TIMEOUT_CODE.length > 0 && DAP_UNANNOUNCED_CODE.length > 0);
});

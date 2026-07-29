import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { LspClient } from "../src/lsp.js";
import { CsLspClient } from "../src/cslsp.js";
import { DapClient } from "../src/dap.js";
import { CsDapClient } from "../src/csdap.js";
import { BridgeClient } from "../src/bridge.js";
import { FramedConnection } from "../src/framing.js";
import { OverdueLedger } from "../src/late-reply.js";
import { startTcpServer, makeFrameParser, writeFrame, makeLineParser, writeLine, waitFor, type TcpServer } from "./helpers/tcp.js";

// §6.2 of the session-138 handoff: the four sibling clients carried the identical
// delete-then-drop shape the editor bridge had. The timer deleted the pending
// entry; the real reply then hit `if (!p) return` and vanished without a log line.
//
// The bridge's own justification (the addon polls from `_process`, so a frame can
// outlast any deadline) is bridge-specific, and the 250 ms floor stayed scoped to
// the two frame-polled deadlines for exactly that reason — see the scope control
// at the bottom of this file. But the DROP is not bridge-specific: an adapter that
// answers `setVariable` or `evaluate` 20 ms after its deadline mutated debuggee
// state, and the host reported that as a failure with nothing on stderr.
//
// Cleanup goes through `t.after`, never a trailing close(): a failing assertion
// returns first, leaks the listening socket, and makes `node --test` HANG rather
// than fail (session 138 §4).

/**
 * Reach a client's private ledger. Test-only: the alternative is four public
 * `overdueCount()` methods that exist solely so a test can look at them, which
 * grows the shipped surface to assert an internal invariant.
 */
function ledgerOf(client: unknown): OverdueLedger<number> {
  return (client as { ledger: OverdueLedger<number> }).ledger;
}

/** Collect stderr while `fn` runs, so "was it logged?" is asserted, not assumed. */
async function captureStderr(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const real = process.stderr.write.bind(process.stderr);
  (process.stderr as { write: unknown }).write = (chunk: unknown, ...rest: unknown[]) => {
    lines.push(String(chunk).trimEnd());
    return (real as (...a: unknown[]) => boolean)(chunk, ...rest);
  };
  try {
    await fn();
  } finally {
    (process.stderr as { write: unknown }).write = real;
  }
  return lines;
}

// ---- the shared ledger itself ----------------------------------------------

test("OverdueLedger reconciles a noted id once, and ignores an unknown one", () => {
  const ledger = new OverdueLedger<number>("LSP", "the language server", "GODOT_LSP_TIMEOUT_MS");
  assert.equal(ledger.reconcile(1, true), false, "an id that never timed out is not a late reply");
  ledger.note(1, "textDocument/hover", 40);
  assert.equal(ledger.overdueSize(), 1);
  assert.equal(ledger.reconcile(1, true), true, "the noted id reconciles");
  assert.equal(ledger.overdueSize(), 0, "reconciling evicts the id — the map is empty in steady state");
  assert.equal(ledger.reconcile(1, true), false, "and it does not reconcile a second time");
  assert.equal(ledger.recent().length, 1);
});

test("OverdueLedger names the client's OWN deadline knob, not the bridge's", async () => {
  const ledger = new OverdueLedger<number>("C# DAP", "the debug adapter", "GODOT_CSDAP_TIMEOUT_MS");
  ledger.note(7, "setVariable", 8000);
  const lines = await captureStderr(async () => {
    ledger.reconcile(7, true);
  });
  const line = lines.find((l) => /late C# DAP reply/.test(l));
  assert.ok(line, `expected a C# DAP late-reply line, got: ${JSON.stringify(lines)}`);
  assert.match(line!, /'setVariable' answered \d+ms AFTER its 8000ms deadline/);
  assert.match(line!, /the call DID complete in the debug adapter/);
  assert.match(line!, /Raise GODOT_CSDAP_TIMEOUT_MS above \d+ms/);
  assert.ok(
    !/BREAKPOINT_BRIDGE_TIMEOUT_MS/.test(line!),
    "naming the bridge's variable here would send the operator to a knob that cannot move this deadline",
  );
});

// The ledger is diagnostics, so it must not become a leak.
test("OverdueLedger bounds the overdue map at 64 and the reply ring at 32", () => {
  const ledger = new OverdueLedger<number>("DAP", "the debug adapter", "GODOT_DAP_TIMEOUT_MS");
  for (let i = 0; i < 100; i++) ledger.note(i, `c${i}`, 40);
  assert.equal(ledger.overdueSize(), 64, "the overdue map caps at 64 for replies that never arrive");
  for (let i = 100 - 64; i < 100; i++) ledger.reconcile(i, true);
  const recent = ledger.recent();
  assert.equal(recent.length, 32, "the reply ring caps at 32");
  assert.equal(recent[recent.length - 1].method, "c99", "the newest entry is retained");
  assert.ok(!recent.some((r) => r.method === "c36"), "the oldest entries are evicted, not the newest");
});

// ---- the LSP family --------------------------------------------------------

/** A mock language server that answers `initialize` at once and everything else LATE. */
async function startLateLsp(delayMs: number): Promise<TcpServer> {
  return startTcpServer((s) => {
    const parse = makeFrameParser((m) => {
      const msg = m as { id?: number; method?: string };
      if (msg.method === "initialize") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: { capabilities: {} } });
        return;
      }
      if (msg.id !== undefined) {
        setTimeout(() => writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: { late: true } }), delayMs);
      }
    });
    s.on("data", (c) => parse(Buffer.from(c)));
  });
}

test("LSP: a response arriving after its deadline is reconciled and logged", async (t) => {
  const srv = await startLateLsp(150);
  const client = new LspClient("127.0.0.1", srv.port, "file:///proj", 5000);
  t.after(async () => { client.close(); await srv.close(); });

  const lines = await captureStderr(async () => {
    await assert.rejects(client.request("textDocument/hover", {}, 40), /timed out after 40ms/);
    assert.deepEqual(client.recentLateReplies(), [], "nothing to reconcile until the response lands");
    await waitFor(() => client.recentLateReplies().length === 1);
  });

  const [late] = client.recentLateReplies();
  assert.equal(late.method, "textDocument/hover");
  assert.equal(late.deadlineMs, 40);
  assert.equal(late.ok, true, "the server answered successfully — the reported failure was wrong");
  assert.ok(
    lines.some((l) => /late LSP reply: 'textDocument\/hover' answered \d+ms AFTER its 40ms deadline/.test(l)),
    `expected an LSP late-reply line, got: ${JSON.stringify(lines)}`,
  );
  assert.ok(
    lines.some((l) => /Raise GODOT_LSP_TIMEOUT_MS above \d+ms/.test(l)),
    "the advice must name the LSP's own knob",
  );
});

// The control. A reconciler that fired on EVERY response would pass the test
// above and be meaningless; this is what makes it mean something.
test("LSP: a response answered INSIDE its deadline is not a late reply", async (t) => {
  const srv = await startLateLsp(0);
  const client = new LspClient("127.0.0.1", srv.port, "file:///proj", 5000);
  t.after(async () => { client.close(); await srv.close(); });

  const lines = await captureStderr(async () => {
    await client.request("textDocument/hover", {}, 2000);
    await client.request("textDocument/definition", {}, 2000);
  });
  assert.deepEqual(client.recentLateReplies(), [], "an answered-in-time request is not a late reply");
  assert.equal(lines.filter((l) => /late LSP reply/.test(l)).length, 0, "and nothing is logged");
  // `recentLateReplies()` alone does NOT pin this down: a client that noted
  // EVERY request (rather than only the timeout path) would still show zero late
  // replies here, because an in-time response is found in `pending` and never
  // reaches reconcile — the overdue entry would simply sit there, unevicted,
  // quietly breaking "empty in steady state". A mutation proved exactly that
  // survived until this assertion existed. The ledger is private, so the test
  // reaches it by cast rather than by growing the client's public surface.
  assert.equal(ledgerOf(client).overdueSize(), 0, "an in-time request leaves nothing in the overdue map");
});

test("C# LSP: a late response is reconciled and names GODOT_CSLSP_TIMEOUT_MS", async (t) => {
  const srv = await startLateLsp(150);
  const client = new CsLspClient(new FramedConnection("127.0.0.1", srv.port, "CS-LSP", "test"), "file:///proj", 5000);
  t.after(async () => { client.close(); await srv.close(); });

  const lines = await captureStderr(async () => {
    await assert.rejects(client.request("textDocument/definition", {}, 40), /timed out after 40ms/);
    await waitFor(() => client.recentLateReplies().length === 1);
  });

  assert.equal(client.recentLateReplies()[0].method, "textDocument/definition");
  assert.ok(
    lines.some((l) => /late C# LSP reply: 'textDocument\/definition' answered \d+ms AFTER its 40ms deadline/.test(l)),
    `expected a C# LSP late-reply line, got: ${JSON.stringify(lines)}`,
  );
  assert.ok(lines.some((l) => /Raise GODOT_CSLSP_TIMEOUT_MS above \d+ms/.test(l)));
});

// ---- the DAP family --------------------------------------------------------

/** A mock debug adapter that answers every request `delayMs` after receiving it. */
async function startLateDap(delayMs: number): Promise<TcpServer> {
  return startTcpServer((s) => {
    const parse = makeFrameParser((m) => {
      const msg = m as { seq?: number; type?: string; command?: string };
      if (msg.type !== "request") return;
      setTimeout(() => {
        writeFrame(s, {
          type: "response",
          request_seq: msg.seq,
          success: true,
          command: msg.command,
          body: { late: true },
        });
      }, delayMs);
    });
    s.on("data", (c) => parse(Buffer.from(c)));
  });
}

// setVariable is the case that matters: a response landing after the deadline
// means the debuggee's state WAS mutated while the host reported a failure.
test("DAP: a response arriving after its deadline is reconciled and logged", async (t) => {
  const srv = await startLateDap(150);
  const dap = new DapClient("127.0.0.1", srv.port, 5000);
  t.after(async () => { dap.close(); await srv.close(); });

  const lines = await captureStderr(async () => {
    await assert.rejects(dap.request("setVariable", {}, 40), /timed out after 40ms/);
    assert.deepEqual(dap.recentLateReplies(), [], "nothing to reconcile until the response lands");
    await waitFor(() => dap.recentLateReplies().length === 1);
  });

  const [late] = dap.recentLateReplies();
  assert.equal(late.method, "setVariable");
  assert.equal(late.deadlineMs, 40);
  assert.equal(late.ok, true, "the adapter applied it — the reported failure was wrong");
  assert.ok(
    lines.some((l) => /late DAP reply: 'setVariable' answered \d+ms AFTER its 40ms deadline/.test(l)),
    `expected a DAP late-reply line, got: ${JSON.stringify(lines)}`,
  );
  assert.ok(lines.some((l) => /Raise GODOT_DAP_TIMEOUT_MS above \d+ms/.test(l)));
});

test("DAP: a response answered INSIDE its deadline is not a late reply", async (t) => {
  const srv = await startLateDap(0);
  const dap = new DapClient("127.0.0.1", srv.port, 5000);
  t.after(async () => { dap.close(); await srv.close(); });

  const lines = await captureStderr(async () => {
    await dap.request("threads", {}, 2000);
    await dap.request("stackTrace", {}, 2000);
  });
  assert.deepEqual(dap.recentLateReplies(), [], "an answered-in-time request is not a late reply");
  assert.equal(lines.filter((l) => /late DAP reply/.test(l)).length, 0, "and nothing is logged");
  // See the LSP control above: this is the assertion that kills "note on every
  // request" rather than only on the timeout path.
  assert.equal(ledgerOf(dap).overdueSize(), 0, "an in-time request leaves nothing in the overdue map");
});

test("C# DAP: a late response is reconciled and names GODOT_CSDAP_TIMEOUT_MS", async (t) => {
  const srv = await startLateDap(150);
  const dap = new CsDapClient(new FramedConnection("127.0.0.1", srv.port, "CS-DAP", "test"), 5000);
  t.after(async () => { dap.close(); await srv.close(); });

  const lines = await captureStderr(async () => {
    await assert.rejects(dap.request("setVariable", {}, 40), /timed out after 40ms/);
    await waitFor(() => dap.recentLateReplies().length === 1);
  });

  assert.equal(dap.recentLateReplies()[0].method, "setVariable");
  assert.ok(
    lines.some((l) => /late C# DAP reply: 'setVariable' answered \d+ms AFTER its 40ms deadline/.test(l)),
    `expected a C# DAP late-reply line, got: ${JSON.stringify(lines)}`,
  );
  assert.ok(lines.some((l) => /Raise GODOT_CSDAP_TIMEOUT_MS above \d+ms/.test(l)));
});

// ---- the runtime bridge names its OWN knob ---------------------------------
//
// index.ts builds TWO BridgeClients. #129 shipped the ledger with the editor
// bridge's variable hard-coded into the log line, so a late reply on the runtime
// bridge — whose deadline is BREAKPOINT_RUNTIME_TIMEOUT_MS — advised raising a
// variable that cannot move it. The knob is a constructor argument now.

async function startLateBridge(delayMs: number): Promise<TcpServer> {
  return startTcpServer((s) => {
    const parse = makeLineParser((line) => {
      const req = JSON.parse(line) as { id?: string };
      if (!req.id) return;
      setTimeout(() => writeLine(s, { id: req.id, ok: true, result: {} }), delayMs);
    });
    s.on("data", (c) => parse(Buffer.from(c)));
  });
}

test("the runtime bridge's late reply names BREAKPOINT_RUNTIME_TIMEOUT_MS, not the editor's", async (t) => {
  const srv = await startLateBridge(150);
  const runtime = new BridgeClient(
    "127.0.0.1", srv.port, 5000, "runtime bridge", "hint", undefined,
    "BREAKPOINT_RUNTIME_TIMEOUT_MS", "the running game",
  );
  t.after(async () => { runtime.close(); await srv.close(); });

  const lines = await captureStderr(async () => {
    await assert.rejects(runtime.request("runtime.get_tree", {}, 40), /timed out after 40ms/);
    await waitFor(() => runtime.recentLateReplies().length === 1);
  });

  const line = lines.find((l) => /late bridge reply/.test(l));
  assert.ok(line, `expected a late-reply line, got: ${JSON.stringify(lines)}`);
  assert.match(line!, /Raise BREAKPOINT_RUNTIME_TIMEOUT_MS above \d+ms/);
  assert.match(line!, /DID complete in the running game/);
  assert.ok(
    !/BREAKPOINT_BRIDGE_TIMEOUT_MS/.test(line!),
    "the editor bridge's variable cannot move the runtime bridge's deadline",
  );
});

test("the editor bridge's default wording is unchanged by the knob becoming a parameter", async (t) => {
  const srv = await startLateBridge(150);
  const editor = new BridgeClient("127.0.0.1", srv.port, 5000);
  t.after(async () => { editor.close(); await srv.close(); });

  const lines = await captureStderr(async () => {
    await assert.rejects(editor.request("node.add", {}, 40), /timed out after 40ms/);
    await waitFor(() => editor.recentLateReplies().length === 1);
  });

  const line = lines.find((l) => /late bridge reply/.test(l));
  assert.ok(line, `expected a late-reply line, got: ${JSON.stringify(lines)}`);
  assert.match(line!, /DID complete in the editor/);
  assert.match(line!, /Raise BREAKPOINT_BRIDGE_TIMEOUT_MS above \d+ms/);
});

// ---- scope control: the ledger spreads, the FLOOR does not ------------------
//
// Session 138 §3: the first cut of the 250 ms floor covered all eleven timeouts
// and two csdap tests failed, correctly — the floor's justification is the frame
// poll, and only the editor and runtime bridges are frame-polled. LSP, DAP and
// the asset-gen backend are ordinary request/response, where 200 ms is a
// reasonable deadline a test is entitled to set.
//
// Porting the LEDGER to those clients must not quietly drag the FLOOR along with
// it. That control already exists and still passes unchanged:
// config.test.ts:290, "the floor does NOT touch the non-bridge timeouts — the
// scope control", added with the floor in #129. It is not duplicated here.
//
// What keeps it true for THIS change is simpler than a test: porting the ledger
// touched no timeout resolution at all. `config.ts` is not in this commit's
// diff, and the ledger is constructed with a knob NAME — a string used only in
// a log line — never with a deadline value. The floor cannot travel along a
// path that carries no numbers.

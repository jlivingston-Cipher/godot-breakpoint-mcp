import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { BridgeClient, BridgeError } from "../src/bridge.js";
import { startTcpServer, makeLineParser, writeLine, waitFor, type TcpServer } from "./helpers/tcp.js";

interface BridgeReq { id: string; method: string; params: Record<string, unknown> }

/** Start a mock editor-bridge server that runs `handler` for each request line. */
async function startBridge(handler: (req: BridgeReq, socket: net.Socket) => void): Promise<TcpServer> {
  return startTcpServer((s) => {
    const parse = makeLineParser((line) => handler(JSON.parse(line) as BridgeReq, s));
    s.on("data", (c) => parse(Buffer.from(c)));
  });
}

const isBridgeError = (code: string) => (e: unknown) =>
  e instanceof BridgeError && e.code === code;

test("request() resolves with the correlated result on ok:true", async () => {
  const srv = await startBridge((req, s) => writeLine(s, { id: req.id, ok: true, result: { echo: req.method, params: req.params } }));
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  const r = await client.request<{ echo: string; params: unknown }>("editor.ping", { x: 1 });
  assert.deepEqual(r, { echo: "editor.ping", params: { x: 1 } });
  client.close();
  await srv.close();
});

test("request() defaults a missing result to {}", async () => {
  const srv = await startBridge((req, s) => writeLine(s, { id: req.id, ok: true }));
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  assert.deepEqual(await client.request("noop"), {});
  client.close();
  await srv.close();
});

test("request() rejects with a coded BridgeError on ok:false", async () => {
  const srv = await startBridge((req, s) => writeLine(s, { id: req.id, ok: false, error: { code: "bad_path", message: "no such node" } }));
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  await assert.rejects(client.request("node.delete"), (e) => isBridgeError("bad_path")(e) && /no such node/.test((e as Error).message));
  client.close();
  await srv.close();
});

test("concurrent requests are correlated by id even when answered out of order", async () => {
  const pending: Array<{ req: BridgeReq; s: net.Socket }> = [];
  const srv = await startBridge((req, s) => {
    pending.push({ req, s });
    if (pending.length === 2) {
      // Answer the SECOND request first to prove id-correlation, not ordering.
      writeLine(pending[1].s, { id: pending[1].req.id, ok: true, result: { tag: pending[1].req.method } });
      writeLine(pending[0].s, { id: pending[0].req.id, ok: true, result: { tag: pending[0].req.method } });
    }
  });
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  const [r1, r2] = await Promise.all([
    client.request<{ tag: string }>("m1"),
    client.request<{ tag: string }>("m2"),
  ]);
  assert.equal(r1.tag, "m1");
  assert.equal(r2.tag, "m2");
  client.close();
  await srv.close();
});

test("request() rejects with code 'timeout' when no response arrives", async () => {
  const srv = await startBridge(() => { /* never respond */ });
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  await assert.rejects(client.request("hang", {}, 60), isBridgeError("timeout"));
  client.close();
  await srv.close();
});

test("a non-JSON line from the bridge is ignored; a following valid line still resolves", async () => {
  const srv = await startBridge((req, s) => {
    s.write("this-is-not-json\n");
    writeLine(s, { id: req.id, ok: true, result: { recovered: true } });
  });
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  assert.deepEqual(await client.request("x"), { recovered: true });
  client.close();
  await srv.close();
});

test("a response split across TCP chunks is buffered until the newline", async () => {
  const srv = await startBridge((req, s) => {
    const resp = JSON.stringify({ id: req.id, ok: true, result: { chunked: true } });
    s.write(resp.slice(0, 6));
    setTimeout(() => s.write(resp.slice(6) + "\n"), 10);
  });
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  assert.deepEqual(await client.request("x"), { chunked: true });
  client.close();
  await srv.close();
});

test("pending requests reject with 'bridge_closed' if the connection drops first", async () => {
  const srv = await startBridge((_req, s) => s.destroy());
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  await assert.rejects(client.request("x"), isBridgeError("bridge_closed"));
  client.close();
  await srv.close();
});

test("request() rejects with 'bridge_unavailable' when nothing is listening", async () => {
  const tmp = await startTcpServer(() => {});
  const deadPort = tmp.port;
  await tmp.close();
  const client = new BridgeClient("127.0.0.1", deadPort, 5000);
  await assert.rejects(client.request("x"), isBridgeError("bridge_unavailable"));
});

// ---- loopback-auth handshake (host side) -----------------------------------

test("prepends an auth line as the FIRST frame when a secret provider returns one", async () => {
  const seen: BridgeReq[] = [];
  const srv = await startBridge((req, s) => {
    seen.push(req);
    // The real addon marks the peer authed on a valid secret and awaits no reply
    // for the auth line; only the following request gets a response.
    if (req.method === "auth") return;
    writeLine(s, { id: req.id, ok: true, result: {} });
  });
  const client = new BridgeClient("127.0.0.1", srv.port, 5000, "editor bridge", undefined, () => "hex-secret");
  await client.request("editor.ping");
  assert.equal(seen[0].method, "auth", "the auth line must precede the first request");
  assert.deepEqual(seen[0].params, { secret: "hex-secret" });
  assert.equal(seen[1].method, "editor.ping");
  client.close();
  await srv.close();
});

test("sends NO auth line when the secret provider yields null (backward-compatible)", async () => {
  const seen: BridgeReq[] = [];
  const srv = await startBridge((req, s) => {
    seen.push(req);
    writeLine(s, { id: req.id, ok: true, result: {} });
  });
  const client = new BridgeClient("127.0.0.1", srv.port, 5000, "editor bridge", undefined, () => null);
  await client.request("editor.ping");
  assert.equal(seen.length, 1, "no auth line should be sent when there is no secret");
  assert.equal(seen[0].method, "editor.ping");
  client.close();
  await srv.close();
});

// ---- late-reply reconciliation ---------------------------------------------
//
// A deadline that fires before the addon can answer used to end the story: the
// timer deleted the pending entry, and the real reply — a complete, correct
// {id, ok, result} — hit `!this.pending.has(id)` and was dropped WITHOUT A LOG
// LINE. Measured against the real client: one stderr line in the whole run, and
// it was "bridge connected". The host held the proof its own error was wrong and
// discarded it.
//
// It still cannot un-reject the settled promise, and it cannot stop the agent's
// retry (a fresh tool call with a fresh randomUUID — nothing here can recognise
// it). What it can do is keep the evidence and say the overshoot out loud.

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

test("a reply arriving after its deadline is reconciled, not dropped, and says so", async () => {
  const srv = await startBridge((req, s) => {
    // The addon polls from _process and cannot answer inside the deadline.
    setTimeout(() => writeLine(s, { id: req.id, ok: true, result: { added: "Enemy" } }), 150);
  });
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);

  const lines = await captureStderr(async () => {
    await assert.rejects(client.request("node.add", { name: "Enemy" }, 40), isBridgeError("timeout"));
    // Nothing is reconciled at rejection time — the reply is still in flight.
    assert.deepEqual(client.recentLateReplies(), [], "nothing to reconcile until the reply lands");
    await waitFor(() => client.recentLateReplies().length === 1);
  });

  const [late] = client.recentLateReplies();
  assert.equal(late.method, "node.add");
  assert.equal(late.deadlineMs, 40);
  assert.equal(late.ok, true, "the addon reported success — the reported failure was wrong");
  assert.ok(late.overshootMs >= 0, `overshootMs must be a real measurement, got ${late.overshootMs}`);
  assert.ok(
    lines.some((l) => /late bridge reply: 'node\.add' answered \d+ms AFTER its 40ms deadline/.test(l)),
    `expected a log line naming the method and the overshoot, got: ${JSON.stringify(lines)}`,
  );
  client.close();
  await srv.close();
});

// The control. Without it, a reconciler that fired on EVERY reply would pass the
// test above and be badly wrong.
test("an on-time reply reconciles nothing and logs nothing — the control", async () => {
  const srv = await startBridge((req, s) => writeLine(s, { id: req.id, ok: true, result: { ok: 1 } }));
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  const lines = await captureStderr(async () => {
    await client.request("node.add", {}, 5000);
  });
  assert.deepEqual(client.recentLateReplies(), [], "an answered-in-time request is not a late reply");
  assert.equal(
    lines.filter((l) => /late bridge reply/.test(l)).length,
    0,
    `no late-reply line should be logged, got: ${JSON.stringify(lines)}`,
  );
  client.close();
  await srv.close();
});

// A reply we never asked for stays ignored exactly as before — the reconciler
// only recognises ids IT timed out. Otherwise the addon's auth reply, or a frame
// from a previous connection, would be reported as a premature deadline.
test("a reply for an id we never sent is still ignored and reconciles nothing", async () => {
  const srv = await startBridge((req, s) => {
    writeLine(s, { id: "11111111-2222-4333-8444-555555555555", ok: true, result: { bogus: true } });
    writeLine(s, { id: req.id, ok: true, result: { real: true } });
  });
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  assert.deepEqual(await client.request("x"), { real: true }, "the real reply still correlates");
  assert.deepEqual(client.recentLateReplies(), []);
  client.close();
  await srv.close();
});

// tools/dap.ts:29 and tools/csdap.ts:31 branch on /timed out after/, and
// dap.test.ts asserts /timed out after 200ms/i. The caveat layer APPENDS for
// exactly this reason; if the sentence is ever rewritten instead, this fails.
test("the timeout message keeps its exact 'timed out after <n>ms' phrasing", async () => {
  const srv = await startBridge(() => { /* never respond */ });
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  await assert.rejects(
    client.request("hang", {}, 60),
    (e: unknown) => e instanceof BridgeError && /timed out after 60ms/.test(e.message),
  );
  client.close();
  await srv.close();
});

// The ledger is diagnostics, so it must not become a leak. 40 late replies land;
// the ring keeps the most recent 32 and drops the oldest.
test("the late-reply ledger is bounded and keeps the most recent entries", async () => {
  const srv = await startBridge((req, s) => {
    setTimeout(() => writeLine(s, { id: req.id, ok: true, result: {} }), 140);
  });
  const client = new BridgeClient("127.0.0.1", srv.port, 5000);
  const sent = Array.from({ length: 40 }, (_, i) => client.request(`m${i}`, {}, 40).catch(() => undefined));
  await Promise.all(sent);
  await waitFor(() => client.recentLateReplies().length >= 32);
  const late = client.recentLateReplies();
  assert.equal(late.length, 32, "the ring caps at 32");
  assert.equal(late[late.length - 1].method, "m39", "the newest entry is retained");
  assert.ok(!late.some((l) => l.method === "m0"), "the oldest entries are evicted, not the newest");
  client.close();
  await srv.close();
});

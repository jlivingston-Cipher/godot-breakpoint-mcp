import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { BridgeClient } from "../src/bridge.js";
import { waitForBridge, waitForRuntimeBridge, notReadyRemedy, READY_POLL_INTERVAL_MS } from "../src/readiness.js";
import type { Config } from "../src/config.js";
import { TIMER_SLACK_MS } from "./helpers/tcp.js";

/**
 * 🔴 THE HALF THAT MUST BE PROVEN IS THE ONE THAT SUCCEEDS.
 *
 * `run-project-returns-before-bridge` (249) was a launcher answering before the thing it
 * launched came up. The obvious rows — nothing listening, so `bridge_ready` is false —
 * would all stay green if `waitForBridge` were replaced by `return false`, which is the
 * defect back with a wait in front of it. So the row that carries this file is the one
 * where a bridge appears LATE and the wait catches it.
 */

/** A loopback server that starts answering `ping` only after `delayMs`. */
async function lateBridge(delayMs: number): Promise<{ port: number; close: () => void }> {
  let answering = false;
  setTimeout(() => { answering = true; }, delayMs);
  const srv = net.createServer((sock) => {
    sock.on("data", (chunk) => {
      for (const line of chunk.toString().split("\n")) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line) as { id?: string; method?: string };
        if (msg.method === "auth" || !msg.id) continue;
        if (!answering) { sock.destroy(); return; }
        sock.write(JSON.stringify({ id: msg.id, ok: true, result: { pong: true } }) + "\n");
      }
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const port = (srv.address() as net.AddressInfo).port;
  return { port, close: () => srv.close() };
}

const client = (port: number) =>
  new BridgeClient("127.0.0.1", port, 1000, "runtime bridge", "Is the project running?");

test("waitForBridge answers true once a late bridge starts responding", async () => {
  const late = await lateBridge(READY_POLL_INTERVAL_MS * 3);
  const c = client(late.port);
  try {
    const ready = await waitForBridge(c, Date.now() + 5000);
    assert.equal(ready, true, "a bridge that binds late must still be caught");
  } finally {
    c.close();
    late.close();
  }
});

test("waitForBridge gives up at the deadline rather than hanging", async () => {
  // Nothing is listening on this port at all — the pre-257 state of the world.
  const c = client(1);
  const started = Date.now();
  try {
    const ready = await waitForBridge(c, started + 250);
    assert.equal(ready, false);
    // 🔴 THE SAME TIMER SLACK AS `initialized_wait.test.ts`, AND IT IS HERE BEFORE IT
    // COSTS A RUN. This is the second of the two lower-bound duration assertions in the
    // suite; the other one reddened `main` at `4a718f7` on a one-millisecond shortfall,
    // and this line asserts the identical shape against a poll loop with the identical
    // exposure. Fixing only the one that had already failed would have left the family
    // half repaired and the next red indistinguishable from a real regression.
    assert.ok(Date.now() - started >= 250 - TIMER_SLACK_MS, "it must actually have waited its deadline");
    assert.ok(Date.now() - started < 5000, "and it must not have waited past it");
  } finally {
    c.close();
  }
});

const cfg = (port: number): Config =>
  ({ runtimeHost: "127.0.0.1", runtimePort: port, projectPath: "/tmp", runtimeTimeoutMs: 1000 } as unknown as Config);

test("waitForRuntimeBridge distinguishes not-waited from waited-and-lost", async () => {
  const optedOut = await waitForRuntimeBridge(cfg(1), 0);
  assert.deepEqual(optedOut, { ready: false, waited_ms: 0 }, "zero means no socket was opened");

  const lost = await waitForRuntimeBridge(cfg(1), 200);
  assert.equal(lost.ready, false);
  assert.ok(lost.waited_ms >= 200, "a real wait must report a real duration");
});

test("the two not-ready sentences say different things, because they are different facts", () => {
  const c = cfg(9081);
  // 🔴 BOTH SENTENCES WERE REWRITTEN AT 267 AND THIS TEST IS PART OF THE FINDING. It
  // asserted the sentence the code produced — `/no wait was requested/` and
  // `/Breakpoint MCP.*plugin enabled/` — and both of those spans were the DEFECT: the
  // first was a description standing where the next action belongs, and the second was a
  // question pasted over two causes, the one 266 removed one file away. A green assertion
  // on a message body is indistinguishable from a green assertion on a correct one.
  //
  // What is asserted now is the SHAPE the whole population answers to: an imperative at
  // the head, the fact after the dash.
  assert.match(notReadyRemedy(c, 0), /^Call `runtime_get_tree`/);
  assert.match(notReadyRemedy(c, 0), /wait_timeout_ms 0 asked for no wait/);
  assert.match(notReadyRemedy(c, 15000), /^Raise wait_timeout_ms/);
  assert.match(notReadyRemedy(c, 15000), /answered no ping in 15000 ms/);
  // Both causes are NAMED and each gets an action; neither is asked about.
  assert.match(notReadyRemedy(c, 15000), /slow to boot/);
  assert.match(notReadyRemedy(c, 15000), /Breakpoint MCP/);
  assert.doesNotMatch(notReadyRemedy(c, 15000), /\?/);
  assert.notEqual(notReadyRemedy(c, 0), notReadyRemedy(c, 15000));
});

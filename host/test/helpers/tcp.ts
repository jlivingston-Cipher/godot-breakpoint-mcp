import net from "node:net";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { after } from "node:test";

/**
 * How far short of its own window a `setTimeout` is allowed to come back, for a test that
 * asserts a wait ACTUALLY HAPPENED.
 *
 * 🔴 SESSION 273, AND THE FIRST FIX FOR IT WAS WRONG. `initialized_wait.test.ts` read
 * `expected at least 200ms, waited 199ms` on `main` at `4a718f7` — a green tree, a timer
 * that had in fact waited, and a red default branch. The obvious diagnosis is that
 * `Date.now()` is the WALL clock while `setTimeout` runs on another one, so the bracket
 * was comparing two clocks; the obvious fix is to bracket with `performance.now()`
 * instead. **Both are wrong, and the measurement says so.** Bracketing `setTimeout(200)`
 * two thousand times:
 *
 *     Date.now()          early    0/2000
 *     performance.now()   early   24/2000   worst shortfall 0.609 ms
 *
 * The monotonic clock is not less accurate here, it is more HONEST. Node schedules a timer
 * against libuv's loop clock, which is cached at the top of each iteration, so a timer
 * really can fire before its window has elapsed on any clock a test is able to read.
 * `Date.now()` scored zero only because truncating to whole milliseconds rounds that away
 * on an idle machine — and on a loaded CI runner it rounded the other way, which is the
 * failure above. No choice of clock removes this. The assertion has to admit it.
 *
 * 🔴 THE SLACK IS A MEASUREMENT PLUS HEADROOM, NOT A ROUND NUMBER THAT MADE THE RED GO
 * AWAY. Worst observed shortfall is 0.609 ms from the timer and up to one millisecond more
 * from truncation; five is that, with room for a runner slower than the one it was measured
 * on. It is also one fortieth of the smallest window any caller here guards, so the thing
 * these assertions exist to catch — a wait that never happened, returning in single-digit
 * milliseconds — remains far outside the tolerance. A wait that is genuinely broken does
 * not come back one millisecond early. It comes back immediately.
 */
export const TIMER_SLACK_MS = 5;

/** Resolve after `ms` milliseconds. */
export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Poll `cond` until true, or reject after `timeoutMs`. Keeps socket tests deterministic without arbitrary sleeps. */
export async function waitFor(cond: () => boolean, timeoutMs = 1500): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor: condition not met before timeout");
    await delay(5);
  }
}

/** A loopback TCP server bound to an ephemeral port, with clean teardown. */
export interface TcpServer {
  port: number;
  /** Sockets accepted so far (for assertions / manual writes). */
  sockets: net.Socket[];
  close(): Promise<void>;
}

/**
 * Every server `startTcpServer` opened that its test has not closed, closed once the
 * file's tests are done.
 *
 * 🔴 BP-0069 (337) — A FAILED ASSERTION SKIPS THE CLOSE ON A TEST'S LAST LINE, AND AN
 * OPEN SERVER HOLDS THE EVENT LOOP, SO THE FILE'S PROCESS NEVER EXITS AND `node --test`
 * WAITS ON IT. #441's post-merge `ci` (run 42187077817, node 18) is the measurement:
 * `csdap.test.ts`'s fourth test failed at 08:22:05Z, its fiftieth and last passed at
 * 08:22:06Z, and nothing else printed until GitHub cancelled the job at 14:22Z. 268 found
 * this class in `initialized_wait.test.ts` and wrote `withTeardown` into that file and
 * one sibling; sixteen files open servers through this helper, so the teardown lives
 * HERE, where one edit covers all of them.
 *
 * It closes leftovers AFTER the file rather than after each test, because a file may
 * share one server across several tests; a server its test did close is not in the set.
 */
const unclosed = new Set<() => Promise<void>>();
after(async () => {
  for (const close of [...unclosed]) await close();
});

/**
 * Start a TCP server on 127.0.0.1:<ephemeral>. `onConnection` runs for each
 * accepted socket. close() destroys any live sockets and stops listening, and is
 * safe to call twice; a server a failed test never closed is closed after the file
 * (see `unclosed`), so a red test is reported instead of hanging the runner.
 */
export function startTcpServer(onConnection: (socket: net.Socket) => void): Promise<TcpServer> {
  return new Promise((resolve, reject) => {
    const sockets: net.Socket[] = [];
    const server = net.createServer((socket) => {
      sockets.push(socket);
      socket.on("error", () => {});
      onConnection(socket);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      let closing: Promise<void> | null = null;
      const close = (): Promise<void> =>
        (closing ??= new Promise<void>((res) => {
          unclosed.delete(close);
          for (const s of sockets) s.destroy();
          server.close(() => res());
        }));
      unclosed.add(close);
      resolve({ port, sockets, close });
    });
  });
}

/**
 * The lowest port this machine's kernel hands out on its own (to a bind to port 0, or
 * as an outbound connection's source port). Linux says so in /proc; macOS in a sysctl;
 * elsewhere the IANA dynamic range's floor, which is also Windows' default.
 */
function ephemeralFloor(): number {
  try {
    if (process.platform === "linux") {
      const first = Number(fs.readFileSync("/proc/sys/net/ipv4/ip_local_port_range", "utf8").trim().split(/\s+/)[0]);
      if (Number.isInteger(first) && first > 0) return first;
    } else if (process.platform === "darwin") {
      const first = Number(execFileSync("sysctl", ["-n", "net.inet.ip.portrange.first"], { encoding: "utf8" }).trim());
      if (Number.isInteger(first) && first > 0) return first;
    }
  } catch { /* fall through to the IANA floor */ }
  return 49152;
}

/**
 * A loopback port that nothing holds now and that nothing on this machine will be
 * handed later: for a config field a tool only CHECKS, such as the runtime bridge port
 * `dbg_launch` and `cs_dbg_launch` probe before they start a game.
 *
 * 🔴 BP-0069 (337) — "BIND PORT 0, RELEASE IT, USE THE NUMBER" PICKS FROM THE ONE RANGE
 * THE KERNEL GOES ON HANDING OUT. Six files took their "free" runtime port that way, and
 * every later bind to port 0 on the machine, the suite's own mock servers included, draws
 * from the same pool. Measured on a Linux 6.8 kernel: a released port came back to 8 of
 * 60,000 binds to port 0, about one in 7,500. When one of them is holding it at the
 * moment a test's launch checks it, the launch is refused as a port conflict before it
 * dials the adapter. That is #441's post-merge failure
 * exactly: the fourth test in `csdap.test.ts` read `buffered: true`, in 32 ms, with no
 * `CS-DAP connected` line where every launching test prints one, and 284's sibling read
 * `undefined` where a session object belonged, which is the refusal's empty envelope.
 *
 * A port below the floor is one no bind to port 0 and no outbound connection can be
 * given, so only a test that binds that exact number could take it, and none does.
 * Checked free before it is returned; never held, because the tools must find it free.
 */
export async function quietPort(host = "127.0.0.1"): Promise<number> {
  const floor = ephemeralFloor();
  const lo = Math.max(1024, floor - 12000);
  const hi = floor - 2000;
  if (hi <= lo) throw new Error(`no room below this machine's ephemeral ports (they start at ${floor})`);
  for (let attempt = 0; attempt < 32; attempt++) {
    const port = lo + Math.floor(Math.random() * (hi - lo));
    const free = await new Promise<boolean>((resolve) => {
      const srv = net.createServer();
      srv.once("error", () => resolve(false));
      srv.listen(port, host, () => srv.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw new Error(`no free port in ${lo}..${hi - 1} on ${host} after 32 tries`);
}

// ---- Content-Length (LSP/DAP) framing -------------------------------------

/** Serialize an object as an LSP/DAP `Content-Length` frame. */
export function encodeFrame(obj: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii");
  return Buffer.concat([header, body]);
}

/** Write one `Content-Length` frame to a socket. */
export function writeFrame(socket: net.Socket, obj: unknown): void {
  socket.write(encodeFrame(obj));
}

/**
 * Return a data-handler that parses accumulated `Content-Length` frames and
 * invokes `onMessage` for each complete JSON body. Deliberately independent of
 * the production framing.ts so framing tests aren't circular.
 */
export function makeFrameParser(onMessage: (msg: Record<string, unknown>) => void): (chunk: Buffer) => void {
  let buffer = Buffer.alloc(0);
  return (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const header = buffer.subarray(0, headerEnd).toString("ascii");
      const m = /Content-Length:\s*(\d+)/i.exec(header);
      if (!m) {
        buffer = buffer.subarray(headerEnd + 4);
        continue;
      }
      const len = Number.parseInt(m[1], 10);
      const start = headerEnd + 4;
      if (buffer.length < start + len) return;
      const body = buffer.subarray(start, start + len).toString("utf8");
      buffer = buffer.subarray(start + len);
      onMessage(JSON.parse(body) as Record<string, unknown>);
    }
  };
}

// ---- Newline-delimited JSON (editor/runtime bridge) framing ----------------

/** Write one newline-delimited JSON message to a socket. */
export function writeLine(socket: net.Socket, obj: unknown): void {
  socket.write(JSON.stringify(obj) + "\n");
}

/** Return a data-handler that splits on "\n" and invokes onLine for each line. */
export function makeLineParser(onLine: (line: string) => void): (chunk: Buffer) => void {
  let buffer = "";
  return (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    let nl = buffer.indexOf("\n");
    while (nl !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onLine(line);
      nl = buffer.indexOf("\n");
    }
  };
}

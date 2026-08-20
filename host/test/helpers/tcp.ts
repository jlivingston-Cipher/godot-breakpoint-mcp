import net from "node:net";

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
 * Start a TCP server on 127.0.0.1:<ephemeral>. `onConnection` runs for each
 * accepted socket. close() destroys any live sockets and stops listening, so a
 * test never leaks a handle that keeps the runner alive.
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
      resolve({
        port,
        sockets,
        close: () =>
          new Promise<void>((res) => {
            for (const s of sockets) s.destroy();
            server.close(() => res());
          }),
      });
    });
  });
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

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { FrameDecoder, encodeFrame, type FramedMessage, type JsonRpcChannel } from "./framing.js";
import { log } from "./logger.js";

/**
 * A `JsonRpcChannel` backed by a spawned subprocess speaking LSP over stdio —
 * the transport OmniSharp (and other CLI language servers) use, unlike Godot's
 * TCP LSP. Frames are `Content-Length`-delimited on the child's stdin/stdout
 * (reusing `FrameDecoder`/`encodeFrame`), so a protocol client written against
 * `JsonRpcChannel` works over stdio exactly as it does over TCP.
 *
 * The process is spawned LAZILY on the first `send()` — like `FramedConnection`
 * connects lazily — so a host with no C# language server installed pays nothing
 * and never fails at startup; only a cs_* tool call actually launches it. A spawn
 * failure (e.g. the binary isn't on PATH) rejects the send with an actionable
 * hint rather than hanging, and — like the TCP sibling's dropped connection —
 * fires `onClose`, so a client caching an initialize handshake drops it: install
 * the language server afterwards and the next cs_* call picks it up, with no
 * host restart.
 */
export class StdioChannel implements JsonRpcChannel {
  private child: ChildProcessWithoutNullStreams | null = null;
  private starting: Promise<ChildProcessWithoutNullStreams> | null = null;
  private decoder: FrameDecoder;
  private messageCb: (msg: FramedMessage) => void = () => {};
  private closeCb: () => void = () => {};

  constructor(
    private readonly command: string,
    private readonly args: string[],
    private readonly cwd: string,
    private readonly label: string,
    private readonly unavailableHint: string,
  ) {
    this.decoder = new FrameDecoder((m) => this.messageCb(m), label);
  }

  onMessage(cb: (msg: FramedMessage) => void): void {
    this.messageCb = cb;
  }

  onClose(cb: () => void): void {
    this.closeCb = cb;
  }

  private start(): Promise<ChildProcessWithoutNullStreams> {
    if (this.child && this.child.exitCode === null && !this.child.killed) return Promise.resolve(this.child);
    if (this.starting) return this.starting;

    let threwSynchronously = false;
    const starting = new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(this.command, this.args, { cwd: this.cwd, stdio: ["pipe", "pipe", "pipe"] });
      } catch (err) {
        // Nulling `this.starting` here would be undone by the assignment below —
        // the executor runs synchronously, BEFORE that assignment — so a synchronous
        // throw (bad spawn options, not a missing binary) would cache the rejected
        // promise forever. Flag it and let the assignment skip instead.
        threwSynchronously = true;
        reject(new Error(`${this.label} could not spawn '${this.command}'. ${this.unavailableHint} (${(err as Error).message})`));
        return;
      }

      child.once("spawn", () => {
        this.child = child;
        this.starting = null;
        log(`${this.label} spawned '${this.command} ${this.args.join(" ")}' (cwd=${this.cwd})`);
        resolve(child);
      });
      child.once("error", (err) => {
        this.starting = null;
        this.child = null;
        reject(new Error(`${this.label} could not spawn '${this.command}'. ${this.unavailableHint} (${err.message})`));
      });
      child.stdout.on("data", (chunk: Buffer) => this.decoder.push(chunk));
      // The server's own logging goes to stderr (LSP frames are stdout-only); surface
      // it in the host log, trimmed, so a misbehaving server is diagnosable.
      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8").trimEnd();
        if (text) log(`${this.label} stderr: ${text.length > 500 ? text.slice(0, 500) + "…" : text}`);
      });
      child.on("exit", (code, signal) => {
        log(`${this.label} exited (code=${code ?? "null"} signal=${signal ?? "null"})`);
      });
      // Reset on `close`, NOT `exit` — the one event name that separated this from
      // its TCP sibling, which hooks `close` and self-heals. A spawn failure (ENOENT:
      // no OmniSharp on PATH) emits `error` + `close` and NEVER `exit`, so an
      // exit-only hook never ran `closeCb()`, and the client's cached `initialized`
      // promise stayed rejected for the process's lifetime: install the language
      // server afterwards and every cs_* call still returned the stale spawn error
      // until the host restarted. `close` is a strict superset — a process that
      // really ran emits `spawn` -> `exit` -> `close` — so the normal path still
      // notifies exactly once and nothing double-fires.
      //
      // Do NOT move this into the `error` handler to notify a turn sooner. `close`
      // lands after the microtask that settles the rejected send, and that lateness
      // is load-bearing: a client's onClose rejects every still-pending request with
      // its own generic "connection closed", so notifying synchronously would
      // overwrite the actionable `${this.unavailableHint}` above with it and the
      // caller would never learn which binary to install. The heal is therefore one
      // turn behind the rejection the caller sees, which no real second tool call
      // can observe.
      child.on("close", () => {
        this.child = null;
        this.decoder.reset();
        this.closeCb();
      });
    });
    this.starting = threwSynchronously ? null : starting;
    return starting;
  }

  async send(msg: FramedMessage): Promise<void> {
    const child = await this.start();
    child.stdin.write(encodeFrame(msg));
  }

  close(): void {
    if (this.child) {
      try {
        this.child.kill();
      } catch {
        /* already gone */
      }
    }
    this.child = null;
  }
}

import net from "node:net";
import { randomUUID } from "node:crypto";
import { log } from "./logger.js";
import { OverdueLedger, type LateReply } from "./late-reply.js";
import { findNonFinite, describeNonFinite, tolerate, TOLERANT_METHODS } from "./finiteness.js";

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
  /** The method this reply answers — read only to pick the non-finite policy. */
  method: string;
}

/**
 * Re-exported so callers keep importing `LateReply` from here. The type and the
 * ledger that produces it now live in ./late-reply.ts, shared with the LSP and
 * DAP families — see that file for why the silence was the whole problem.
 *
 * The bridge's specific version of it: the addon polls its socket from
 * `_process`, once per frame, so a deadline shorter than a frame (or a frame
 * longer than the deadline — a `scene.save` triggering a rescan/reimport can do
 * it at ANY deadline) reports a failure for work that in fact completed.
 */
export type { LateReply } from "./late-reply.js";

/** Notified with the changed resource URI when the addon pushes a change event. */
export type ResourceChangedListener = (uri: string) => void;

export class BridgeError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
  }
}

/**
 * TCP client for the in-editor Breakpoint MCP addon. Speaks newline-delimited
 * JSON. Requests are correlated to responses by `id`. Connects lazily and
 * transparently reconnects on the next request after a drop.
 *
 * D3: the addon may also PUSH unsolicited change events — lines carrying an
 * `event` field and no request `id` — so a subscribed MCP host can emit
 * notifications/resources/updated. Those are routed to onResourceChanged
 * listeners. For that push channel to stay live even when the host isn't
 * actively issuing requests, ensureConnected() holds an open connection and
 * transparently re-dials after a drop (e.g. an editor restart).
 */
export class BridgeClient {
  private socket: net.Socket | null = null;
  private connecting: Promise<net.Socket> | null = null;
  private buffer = "";
  private pending = new Map<string, Pending>();
  /** Ids whose deadline fired, so a reply arriving later is recognised, not dropped. */
  private readonly ledger: OverdueLedger<string>;
  private eventListeners = new Set<ResourceChangedListener>();
  private wantConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly defaultTimeoutMs: number,
    private readonly label = "editor bridge",
    // 🔴 THE SECOND SENTENCE IS THE ONE THAT EARNS ITS PLACE. The first asks a
    // question whose answer, for the user most likely to be reading this line,
    // is YES: the editor IS open and the plugin IS listed in project.godot.
    // Godot reads `[editor_plugins]` at project load and never re-reads it, so
    // an editor that was already running when `init` wrote the section keeps
    // the plugin disabled — the bridge never starts, every editor-plane tool is
    // dark, and the remedy agrees with everything the user can see. `init` now
    // warns at the point it writes; this is the same fact told to the person
    // who did not read that line, or who read it a week ago.
    private readonly hint = 'Is the editor open with the "Breakpoint MCP" plugin enabled? If it was ALREADY open when you ran `breakpoint-mcp init`, close and reopen the project — Godot reads the enabled-plugin list only at project load.',
    /**
     * Loopback-auth secret provider, read lazily on each connect. When it
     * returns a non-empty string the client sends it as the FIRST line on the
     * connection (see connect()); null/undefined → no auth line, matching an
     * insecure or not-yet-provisioned bridge. Lazy so a secret minted after the
     * host started (editor launched later) is picked up on the next (re)connect.
     */
    private readonly secretProvider?: () => string | null,
    /**
     * The env var that widens THIS instance's deadline, and the noun for what
     * answered it. Per-INSTANCE, not per-class: index.ts builds two
     * BridgeClients — the editor bridge and the runtime bridge — and they are
     * configured by different variables (BREAKPOINT_BRIDGE_TIMEOUT_MS vs
     * BREAKPOINT_RUNTIME_TIMEOUT_MS). A late-reply line that names the wrong one
     * sends the operator to a knob that cannot move the deadline they just hit,
     * which is worse than saying nothing. Defaults keep the editor bridge's
     * wording byte-identical to what shipped.
     */
    deadlineKnob = "BREAKPOINT_BRIDGE_TIMEOUT_MS",
    peerNoun = "the editor",
  ) {
    this.ledger = new OverdueLedger<string>("bridge", peerNoun, deadlineKnob);
  }

  /** Register a listener for addon-pushed resource-change events. */
  onResourceChanged(cb: ResourceChangedListener): void {
    this.eventListeners.add(cb);
  }

  /**
   * The last socket-level error, held so the close path can name it.
   *
   * `socket.once("error")` below only rejects the CONNECT promise. Once the
   * connection is up that handler is still armed, so a mid-flight ECONNRESET /
   * EPIPE fires it, calls reject() on an already-settled promise — a silent
   * no-op — and then `close` rejects every pending request with a generic
   * "connection closed". The specific errno never reached the caller, which is
   * the difference between "the editor crashed" and "something else is on that
   * port". Cleared on a successful connect so a stale errno cannot be blamed
   * for a later, unrelated drop.
   */
  private lastSocketError: Error | null = null;

  private connect(): Promise<net.Socket> {
    if (this.socket && !this.socket.destroyed) return Promise.resolve(this.socket);
    if (this.connecting) return this.connecting;

    this.connecting = new Promise<net.Socket>((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });

      socket.setNoDelay(true);
      socket.once("connect", () => {
        this.socket = socket;
        this.connecting = null;
        this.lastSocketError = null;
        this.clearReconnect();
        // Loopback-auth handshake: if a secret is available it MUST be the first
        // line on the connection. TCP preserves order and the addon drains lines
        // sequentially, so this is guaranteed to be processed before any request
        // line — no await needed. With no secret we send nothing and behave
        // exactly as before (backward-compatible with an insecure bridge). The
        // addon's auth reply carries no id, so onMessage() ignores it; on a
        // failed handshake the addon closes the socket and onClose() reconnects.
        const secret = this.secretProvider?.() ?? null;
        if (secret) {
          socket.write(JSON.stringify({ method: "auth", params: { secret } }) + "\n");
        }
        log(`bridge connected to ${this.host}:${this.port}`);
        resolve(socket);
      });
      socket.once("error", (err) => {
        this.connecting = null;
        // Recorded for onClose(): if the connection was already up, this reject()
        // is a no-op on a settled promise and the errno would otherwise be lost.
        this.lastSocketError = err;
        reject(
          new BridgeError(
            "bridge_unavailable",
            `Cannot reach the Godot ${this.label} at ${this.host}:${this.port}. ${this.hint} (${err.message})`,
          ),
        );
      });
      socket.on("data", (chunk) => this.onData(chunk));
      socket.on("close", () => this.onClose());
    });

    return this.connecting;
  }

  /**
   * Hold an open connection so addon-pushed change events are received even
   * without an in-flight request. Idempotent; re-dials after a drop until
   * close() is called. Never rejects — a not-yet-running editor just retries.
   */
  ensureConnected(): Promise<void> {
    this.wantConnected = true;
    return this.connect().then(
      () => {},
      () => {
        this.scheduleReconnect();
      },
    );
  }

  private scheduleReconnect(): void {
    if (!this.wantConnected || this.reconnectTimer) return;
    if (this.socket && !this.socket.destroyed) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.wantConnected) return;
      this.connect().then(
        () => {},
        () => this.scheduleReconnect(),
      );
    }, 1000);
    // Don't keep the event loop alive just for reconnect attempts.
    this.reconnectTimer.unref?.();
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private onData(chunk: Buffer | string): void {
    this.buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    let nl = this.buffer.indexOf("\n");
    while (nl !== -1) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (line) this.onMessage(line);
      nl = this.buffer.indexOf("\n");
    }
  }

  private onMessage(line: string): void {
    let msg: {
      id?: string;
      ok?: boolean;
      result?: unknown;
      error?: { code: string; message: string };
      event?: string;
      uri?: string;
    };
    try {
      msg = JSON.parse(line);
    } catch {
      log("bridge sent non-JSON line:", line);
      return;
    }
    // D3: unsolicited change events carry an `event` field and no request id.
    if (msg.event === "resource.changed" && typeof msg.uri === "string") {
      const uri = msg.uri;
      for (const cb of this.eventListeners) {
        try {
          cb(uri);
        } catch (err) {
          log("resource-changed listener threw:", err instanceof Error ? err.message : String(err));
        }
      }
      return;
    }
    const id = msg.id;
    if (!id) return;
    if (!this.pending.has(id)) {
      // Not pending: either a reply we already gave up on (reconcile + log it), or
      // a genuinely unknown id (the addon's auth reply, a stale frame) — ignored
      // exactly as before. Ids are randomUUID() and never reused, so a late reply
      // can only ever be its OWN request's; misattribution is impossible here.
      this.ledger.reconcile(id, msg.ok === true);
      return;
    }
    const p = this.pending.get(id)!;
    this.pending.delete(id);
    clearTimeout(p.timer);
    if (msg.ok) {
      // 🔴 THE ONE PLACE A NON-FINITE ENGINE FLOAT CAN ENTER THE HOST. Godot stringifies
      // INF as `1e99999`, which is valid JSON, so `JSON.parse` above hands back a real
      // `Infinity` — accepted by zod 3, refused by zod 4, and turned into `null` by our
      // own re-serialisation to the client either way.
      //
      // 🔴 226 §2: THE POLICY IS PER-METHOD AND IT IS NOT A NULL. Two methods report a
      // partial reading and prune; every other method REFUSES, naming the path and the
      // value. Writing `null` into a `z.number()` slot — which is what the first
      // containment did on 91 tools that never declared it — fails the schema with a
      // message about the shape, and takes the roster that would have explained it down
      // with the parse. See finiteness.ts for the population and the measurement.
      const result = msg.result ?? {};
      if (TOLERANT_METHODS.has(p.method)) {
        p.resolve(tolerate(result));
      } else {
        const hits = findNonFinite(result);
        if (hits.length) p.reject(new BridgeError("non_finite", describeNonFinite(hits)));
        else p.resolve(result);
      }
    } else {
      const e = msg.error ?? { code: "unknown", message: "Unknown bridge error" };
      p.reject(new BridgeError(e.code, e.message));
    }
  }

  /**
   * Snapshot of replies that arrived after their deadline, oldest first.
   * Diagnostics only — nothing in the request path reads this.
   */
  recentLateReplies(): readonly LateReply[] {
    return this.ledger.recent();
  }

  private onClose(): void {
    this.socket = null;
    // Name the transport error when there was one. The CODE stays `bridge_closed`
    // — callers and tests branch on it — but the message carries the errno.
    const cause = this.lastSocketError;
    this.lastSocketError = null;
    const detail = cause ? ` (${cause.message})` : "";
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(
        new BridgeError("bridge_closed", `Bridge connection closed before a response arrived${detail}`),
      );
    }
    this.pending.clear();
    // Keep the push channel alive across editor restarts while subscriptions want it.
    if (this.wantConnected) this.scheduleReconnect();
  }

  /** Send one request and await its correlated response. */
  async request<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = this.defaultTimeoutMs,
  ): Promise<T> {
    const socket = await this.connect();
    const id = randomUUID();
    const payload = JSON.stringify({ id, method, params }) + "\n";

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // Remember the id BEFORE rejecting, so a reply already in flight is
        // reconciled rather than dropped as anonymous. The message keeps the
        // exact `timed out after <n>ms` phrasing — tools/dap.ts:29 and
        // tools/csdap.ts:31 branch on that substring.
        this.ledger.note(id, method, timeoutMs);
        reject(new BridgeError("timeout", `Bridge request '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer, method });
      socket.write(payload, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(new BridgeError("write_failed", err.message));
        }
      });
    });
  }

  close(): void {
    this.wantConnected = false;
    this.clearReconnect();
    if (this.socket) this.socket.destroy();
    this.socket = null;
  }
}

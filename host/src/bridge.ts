import net from "node:net";
import { randomUUID } from "node:crypto";
import { log } from "./logger.js";

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

/** A request whose deadline has fired, kept only so a later reply can be recognised. */
interface Overdue {
  method: string;
  deadlineMs: number;
  timedOutAt: number;
}

/**
 * A reply that arrived AFTER its deadline had already been reported as a timeout.
 *
 * Before this existed the host received one of these — a complete, correct
 * `{id, ok, result}` — found no pending entry, and dropped it without so much as
 * a log line. That silence is the whole problem: the addon polls its socket from
 * `_process`, once per frame, so a deadline shorter than a frame (or a frame
 * longer than the deadline — a `scene.save` triggering a rescan/reimport can do
 * it at ANY deadline) reports a failure for work that in fact completed. An agent
 * that retries a reported failure applies a non-idempotent mutation twice.
 *
 * The host cannot prevent that retry — it is a fresh MCP tool call with a fresh
 * `randomUUID()`, so no id bookkeeping here can recognise it. What it CAN do is
 * stop throwing away the evidence, and say the overshoot out loud so the operator
 * has the one number that fixes their configuration.
 */
export interface LateReply {
  /** Bridge method whose reply came back after the deadline. */
  method: string;
  /** The deadline that had already been reported, in ms. */
  deadlineMs: number;
  /** How long after that deadline the reply actually arrived, in ms. */
  overshootMs: number;
  /** Whether the addon reported the call as having succeeded. */
  ok: boolean;
}

/**
 * Bounds on the overdue ledger. Both are belt-and-braces: an id is normally
 * evicted the moment its late reply lands, so the map is empty in steady state.
 * These only matter for deadlines whose reply NEVER arrives (editor killed
 * mid-request), which would otherwise accumulate one small record each.
 */
const OVERDUE_MAX = 64;
const OVERDUE_MAX_AGE_MS = 5 * 60_000;
/** How many late replies to retain for `recentLateReplies()`. Diagnostics only. */
const LATE_REPLY_MAX = 32;

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
  private overdue = new Map<string, Overdue>();
  /** Ring of reconciled late replies, oldest first. Diagnostics; never load-bearing. */
  private lateReplies: LateReply[] = [];
  private eventListeners = new Set<ResourceChangedListener>();
  private wantConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly defaultTimeoutMs: number,
    private readonly label = "editor bridge",
    private readonly hint = 'Is the editor open with the "Breakpoint MCP" plugin enabled?',
    /**
     * Loopback-auth secret provider, read lazily on each connect. When it
     * returns a non-empty string the client sends it as the FIRST line on the
     * connection (see connect()); null/undefined → no auth line, matching an
     * insecure or not-yet-provisioned bridge. Lazy so a secret minted after the
     * host started (editor launched later) is picked up on the next (re)connect.
     */
    private readonly secretProvider?: () => string | null,
  ) {}

  /** Register a listener for addon-pushed resource-change events. */
  onResourceChanged(cb: ResourceChangedListener): void {
    this.eventListeners.add(cb);
  }

  private connect(): Promise<net.Socket> {
    if (this.socket && !this.socket.destroyed) return Promise.resolve(this.socket);
    if (this.connecting) return this.connecting;

    this.connecting = new Promise<net.Socket>((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });

      socket.setNoDelay(true);
      socket.once("connect", () => {
        this.socket = socket;
        this.connecting = null;
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
      this.reconcileLate(id, msg.ok === true);
      return;
    }
    const p = this.pending.get(id)!;
    this.pending.delete(id);
    clearTimeout(p.timer);
    if (msg.ok) {
      p.resolve(msg.result ?? {});
    } else {
      const e = msg.error ?? { code: "unknown", message: "Unknown bridge error" };
      p.reject(new BridgeError(e.code, e.message));
    }
  }

  /**
   * Record that `id`'s deadline fired, so a reply arriving afterwards is
   * recognisable rather than anonymous. Called ONLY from the timeout path —
   * `write_failed` and `bridge_closed` requests never reached, or can never be
   * answered by, the addon, so a "late reply" for them is not a thing.
   */
  private noteOverdue(id: string, method: string, deadlineMs: number): void {
    this.overdue.set(id, { method, deadlineMs, timedOutAt: Date.now() });
    const cutoff = Date.now() - OVERDUE_MAX_AGE_MS;
    for (const [k, v] of this.overdue) {
      if (v.timedOutAt < cutoff) this.overdue.delete(k);
    }
    // Map iterates in insertion order, so the first key is always the oldest.
    while (this.overdue.size > OVERDUE_MAX) {
      const oldest = this.overdue.keys().next();
      if (oldest.done) break;
      this.overdue.delete(oldest.value);
    }
  }

  /**
   * A reply landed for an id that is no longer pending. If we timed that id out,
   * this is the proof the deadline was premature — record it and SAY SO. The
   * caller's promise is already settled and cannot be un-rejected; the value here
   * is the overshoot number, which is exactly what the operator needs to fix the
   * deadline, and which the host previously discarded in silence.
   */
  private reconcileLate(id: string, ok: boolean): void {
    const o = this.overdue.get(id);
    if (!o) return; // genuinely unknown id — ignored, as it always was
    this.overdue.delete(id);
    const overshootMs = Date.now() - o.timedOutAt;
    this.lateReplies.push({ method: o.method, deadlineMs: o.deadlineMs, overshootMs, ok });
    if (this.lateReplies.length > LATE_REPLY_MAX) this.lateReplies.shift();
    log(
      `late bridge reply: '${o.method}' answered ${overshootMs}ms AFTER its ${o.deadlineMs}ms deadline — ` +
        `the call ${ok ? "DID complete in the editor" : "reached the editor and failed there"}, ` +
        `so the reported timeout was premature. Raise BREAKPOINT_BRIDGE_TIMEOUT_MS above ${o.deadlineMs + overshootMs}ms.`,
    );
  }

  /**
   * Snapshot of replies that arrived after their deadline, oldest first.
   * Diagnostics only — nothing in the request path reads this.
   */
  recentLateReplies(): readonly LateReply[] {
    return [...this.lateReplies];
  }

  private onClose(): void {
    this.socket = null;
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new BridgeError("bridge_closed", "Bridge connection closed before a response arrived"));
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
        this.noteOverdue(id, method, timeoutMs);
        reject(new BridgeError("timeout", `Bridge request '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
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

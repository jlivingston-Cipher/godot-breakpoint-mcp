import net from "node:net";
import { randomUUID } from "node:crypto";
import { log } from "./logger.js";
import { OverdueLedger, type LateReply } from "./late-reply.js";
import { findNonFinite, describeNonFinite, tolerate, TOLERANT_METHODS, nonFiniteRemedy } from "./finiteness.js";
import { remedyForWireError } from "./remedies.js";
import { closeDetail, closeRemedy } from "./close-cause.js";
import { connectHint, connectRemedy } from "./connect-cause.js";

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
  /**
   * The next action the addon attached to this code (254). Optional by
   * construction: the addon omits it for codes it has nothing to say about.
   *
   * 🔴 THE REST OF THIS SENTENCE WAS WRONG FOR TWO SESSIONS, AND 264 MEASURED IT. It
   * read: *every failure the host raises itself — timeout, closed socket, non-finite —
   * arrives without one, because the remedy for those is not the addon's to give.* The
   * because-clause is true and the claim does not follow from it. 262 answered `timeout`;
   * 264 answered `bridge_closed` off an errno that had been in hand at the close site the
   * whole time. The census counted the rest: of 25 host-raised failures about the world,
   * ONE carried a remedy in this field, SEVEN named a next action in their message where
   * no reader counts it, and SEVENTEEN said nothing while holding an errno, a state
   * machine or a registry the host owns. **Absent here means nobody has answered it yet,
   * not that it is unanswerable.**
   */
  remedy?: string;
  constructor(code: string, message: string, remedy?: string) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
    if (remedy) this.remedy = remedy;
  }
}

/**
 * The code `connect()` raises when nothing is listening on the bridge port.
 *
 * Spelled once, because two callers now branch on it — `connect()` which raises
 * it and `runtime_await_condition` which retries past it — and a string literal
 * in two files is a rename away from a waiting tool that silently stops waiting.
 */
export const BRIDGE_UNAVAILABLE = "bridge_unavailable";

/**
 * Is this the transport saying *not yet*, rather than the peer saying *no*?
 *
 * 🔴 THE DISTINCTION IS THE WHOLE OF 249's REMEDY C. A caller that asked to wait
 * should keep waiting through an unbound port, and should NOT keep waiting
 * through a missing node or an unknown property — those are answers, and
 * retrying an answer only makes it slower.
 */
export function isTransportUnavailable(err: unknown): boolean {
  return (err as Partial<BridgeError> | null | undefined)?.code === BRIDGE_UNAVAILABLE;
}

/**
 * The remedy clause every plane's `fail()` appends, rendered once.
 *
 * 🔴 FIVE RENDERERS, ONE CLAUSE. `tools/editor/common.ts`, `tools/runtime.ts`,
 * `tools/tabletop.ts`, `tools/netcode.ts` and `tools/backend.ts` each turn a
 * `Partial<BridgeError>` into MCP text under their own label. A remedy pasted into
 * five templates is five places to drift; this is the one place it is spelled, and
 * contract_check check 26 asserts every renderer of a `Partial<BridgeError>` calls
 * it — a sixth plane added without it would ship a silent failure message again.
 */
export function remedyClause(err: unknown): string {
  const r = (err as Partial<BridgeError> | null | undefined)?.remedy;
  return typeof r === "string" && r !== "" ? ` — ${r}` : "";
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
    /**
     * The env var that names THIS instance's HOST, for the same per-INSTANCE reason
     * `deadlineKnob` exists (265). The editor bridge takes its address from
     * BREAKPOINT_BRIDGE_HOST and the runtime bridge and its peers from
     * BREAKPOINT_RUNTIME_HOST; an unresolved-host remedy naming the wrong one sends the
     * operator to a knob that cannot move the address they just failed to reach — the
     * identical defect the late-reply line was given its own knob to avoid. Defaults keep
     * the editor bridge's wording byte-identical to what shipped.
     */
    hostKnob = "BREAKPOINT_BRIDGE_HOST",
  ) {
    this.ledger = new OverdueLedger<string>("bridge", peerNoun, deadlineKnob);
    // 🔴 KEPT, not just handed to the ledger (264). A dropped connection names the same
    // peer a late reply does, and the two sentences drifting apart would be a bug nobody
    // could see from either side.
    this.peerNoun = peerNoun;
    this.hostKnob = hostKnob;
  }

  /** Who answers this client — read by the close path and the late-reply ledger alike. */
  private readonly peerNoun: string;

  /** The env var that moves this client's host — read by the connect path (265). */
  private readonly hostKnob: string;

  /**
   * A cause this client cannot see, supplied by whoever CAN, as the remedy on a timeout.
   *
   * 🔴 WHY THIS EXISTS AT ALL — the eighth session of "the host's own failures carry no
   * remedy" (254 §4.6 → 261 §4.4), answered for the one case a walk actually produced.
   * `BridgeError.remedy` was documented as "the addon's to give, and a host-raised
   * timeout arrives without one". 🔴 264 DISPROVED THE "TRUE FOR A CLOSED SOCKET" HALF —
   * `onClose` had the errno in hand and read only its `message`, so a killed peer and an
   * orderly shutdown arrived as one code and one sentence. NOT true here either, and USER_GUIDE
   * §10 B's own step 5 walks the reader straight into it: the addon services `runtime_*`
   * from `_process`, so a breakpoint inside the method being called halts the very frame
   * that owes the reply. Measured — the stop's stack trace is `compute` on top of
   * `_call_method` → `_dispatch` → `_handle_line` → `_drain_lines` → `_process`, five
   * frames of the addon's own dispatch — and the caller got
   * `Bridge request 'runtime.call_method' timed out after 15000ms` and nothing else,
   * EVERY TIME THE RECIPE WORKED. The deadlock is a fact about the debugger, which lives
   * in the host, three modules away from the socket that gave up.
   *
   * 🔴 A HOOK RATHER THAN A CONSTRUCTOR PARAMETER, and that is not laziness: nine `.mjs`
   * integration probes construct these registrars directly where TypeScript cannot see
   * them, and 257 spent six red CI jobs learning what adding a parameter costs. A probe
   * that never sets a probe gets exactly today's behaviour.
   *
   * Wired on the RUNTIME client only. A game halted at a breakpoint does not hold the
   * editor bridge, and the sentence would be a confident lie on plane A.
   */
  setHoldProbe(probe: () => string | undefined): void {
    this.holdProbe = probe;
  }

  private holdProbe: (() => string | undefined) | null = null;

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
        // 🔴 THE ERRNO WAS ALREADY HERE AND ONLY ITS `message` WAS READ (265), which is
        // 264's close-family finding one step earlier in the same file. `err.code`
        // separates a port nothing is listening on from a host name that never resolved,
        // and the hint below was appended to BOTH — telling a caller whose
        // BREAKPOINT_*_HOST is a typo to go and look at Godot, for a connect where no
        // packet ever left this machine. `connectHint` suppresses the hint in exactly
        // that case and returns it untouched otherwise, so every other message a caller
        // reads is byte-identical to what shipped. See connect-cause.ts.
        const hint = connectHint(err, this.hint);
        reject(
          new BridgeError(
            BRIDGE_UNAVAILABLE,
            `Cannot reach the Godot ${this.label} at ${this.host}:${this.port}.${hint ? ` ${hint}` : ""} (${err.message})`,
            connectRemedy(err, this.peerNoun, this.hostKnob),
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
      error?: { code: string; message: string; remedy?: string };
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
        if (hits.length) p.reject(new BridgeError("non_finite", describeNonFinite(hits), nonFiniteRemedy(hits)));
        else p.resolve(result);
      }
    } else {
      const e = msg.error ?? { code: "unknown", message: "Unknown bridge error" };
      // 🔴 THE FALLBACK IS FOR THE ADDON THAT CANNOT ANSWER FOR ITSELF (258 §2).
      // A current addon attaches its own remedy and wins outright; an addon old
      // enough to raise `unknown_method` predates `error_remedies.gd` entirely,
      // so the only side that can name its next action is the host it is skewed
      // against. See remedies.ts for why that table has exactly one row.
      const wire = typeof e.remedy === "string" ? e.remedy : undefined;
      p.reject(new BridgeError(e.code, e.message, remedyForWireError(e.code, wire)));
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
    const cause = this.lastSocketError ?? undefined;
    this.lastSocketError = null;
    const detail = closeDetail(cause);
    // 🔴 THE ERRNO WAS ALREADY HERE AND ONLY ITS `message` WAS READ (264 §3). A peer that
    // was killed and a peer that shut down cleanly produced the SAME code and the SAME
    // sentence, differing by one parenthetical nothing instructed the caller to act on.
    // `cause.code` separates them, and this is the one close site whose class has a field
    // to put the answer in — see close-cause.ts for the four that do not.
    const remedy = closeRemedy(cause, this.peerNoun);
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(
        new BridgeError("bridge_closed", `Bridge connection closed before a response arrived${detail}`, remedy),
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
        // 🔴 262 §2 CALLED THIS "THE ONE HOST-RAISED FAILURE THAT HAS A KNOWABLE CAUSE",
        // and said everything else this class raises — "a closed socket, a peer that never
        // answered" — is genuinely opaque from here. 264 MEASURED THAT AND IT IS FALSE FOR
        // THE CLOSED SOCKET: `onClose` holds the socket `Error` and its errno separates a
        // peer that was killed from one that shut down cleanly. It stays TRUE for this
        // line — a peer that never answered really does leave nothing behind — which is
        // why the one cause the host can supply comes from outside the socket: its own
        // debugger holding the game. See `setHoldProbe`, and 264's census for the rest.
        reject(new BridgeError("timeout", `Bridge request '${method}' timed out after ${timeoutMs}ms`, this.holdProbe?.() ?? undefined));
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

import { EventEmitter } from "node:events";
import type { FramedMessage, JsonRpcChannel } from "./framing.js";
import { DapError, type DapState, type WatchResult } from "./dap.js";
import { OverdueLedger, type LateReply } from "./late-reply.js";

interface Pending {
  command: string;
  resolve: (value: Record<string, unknown>) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

interface BufferedBreakpoints {
  path: string;
  lines: number[];
  /** Per-line condition expressions (DAP `condition`), aligned to `lines`. */
  conditions?: (string | null)[];
}

/**
 * How long `start()` waits for the entry `stopped` event when `stopAtEntry` was
 * requested. Bounded so an adapter that ignores stop-on-entry reports `running`
 * rather than hanging the launch. Measured: netcoredbg emits it well inside a
 * second on a local program, after its `configurationDone` response.
 */
const ENTRY_STOP_WAIT_MS = 10000;

/**
 * Minimal DAP client for the C#/.NET debugging plane (D4 C3) — the debugger
 * analogue of the C2 `CsLspClient`. Transport-agnostic: it drives any
 * `JsonRpcChannel`, so production spawns **netcoredbg** (Samsung, MIT) over
 * stdio (`StdioChannel`) while unit tests point it at a loopback TCP mock
 * (`FramedConnection`) — exactly the way the GDScript `DapClient` tests and the
 * `CsLspClient` tests do.
 *
 * It is deliberately a sibling of `DapClient` rather than a shared base class —
 * matching the codebase's one-client-per-protocol precedent (dap.ts / lsp.ts,
 * and now cslsp.ts) — but reuses `DapError` / `DapState` and the framing
 * primitives so the protocol plumbing isn't re-invented. The only C#-specific
 * behaviors are the `coreclr` adapterID and pointing launch/attach at a .NET
 * program/process; everything else is standard DAP the same way Godot's built-in
 * debug adapter is. On top of read/inspect + a gated `setVariable`, it carries the
 * GDScript extras netcoredbg actually backs — persistent watches and a `restart()`
 * (terminate + relaunch, since netcoredbg advertises no `supportsRestartRequest`).
 * The exception-breakpoint extra needs no client method (the tool drives `request`
 * + capabilities directly). `goto` / data breakpoints are intentionally NOT ported:
 * netcoredbg advertises neither `supportsGotoTargetsRequest` nor
 * `supportsDataBreakpoints`, so those tools would be dead surface here.
 */
export class CsDapClient extends EventEmitter {
  private seq = 1;
  private pending = new Map<number, Pending>();
  private breakpoints = new Map<string, BufferedBreakpoints>();
  /**
   * Seqs whose deadline fired, so a response arriving later is recognised, not
   * dropped. `seq` is monotonic and is never reset, so a seq is never reused and
   * a late response can only be its own request's.
   */
  private readonly ledger = new OverdueLedger<number>("C# DAP", "the debug adapter", "GODOT_CSDAP_TIMEOUT_MS");
  private configured = false;
  /** Persistent watch expressions, re-evaluated at each stop (see evaluateWatches). */
  private watches: string[] = [];
  private lastStartMode: "launch" | "attach" | null = null;
  private lastStartArgs: Record<string, unknown> | null = null;
  /**
   * The launch/attach rejection, when one arrives. Set by `start()`; read there and
   * kept afterwards so a rejection that lands late is still visible rather than
   * being emitted as an unlistened `error` event (which throws).
   */
  private startFailure: unknown = null;
  /**
   * Whether a launch/attach this client sent was accepted. Tracked SEPARATELY from
   * `state` for the reason `DapClient` tracks it separately, measured here on this
   * plane against a real netcoredbg: `cs_dbg_continue` on a client that had never
   * launched anything left `state = "running"` behind — `resume()` assigns it
   * optimistically before it waits — so every call after it read as a live session.
   * A guard built on `state` alone would be poisoned by the very call it exists to
   * refuse.
   */
  private sessionStarted = false;

  capabilities: Record<string, unknown> | null = null;
  state: DapState = "disconnected";
  lastStoppedThreadId: number | null = null;
  lastStoppedReason: string | null = null;

  /**
   * Whether a launch/attach the adapter accepted is still in force. The `cs_dbg_*`
   * tools that can only answer from a live session consult this instead of asking
   * netcoredbg and reporting whatever came back.
   *
   * 🔴 Measured against a real netcoredbg 3.2.0-1092 on a client that had never
   * launched anything: seven of the nine readers answered with a raw hex code —
   * `Failed command 'stackTrace' : 0x80004005` (E_FAIL), `0x80070057` (E_INVALIDARG)
   * — `cs_dbg_set_variable` reported "the debug adapter reported a failure with no
   * message", and `cs_dbg_watch` answered `isError:false` with every entry carrying
   * `error: "error: 0x80004005"`. Only `cs_dbg_restart` refused, and only because it
   * happens to read `lastStartMode`. That is the same single exception session 259
   * measured one plane over, for the same accidental reason.
   */
  get hasSession(): boolean {
    return this.sessionStarted && this.state !== "terminated" && this.state !== "disconnected";
  }

  /**
   * Whether the adapter has reported a stop, read through a call so TypeScript's
   * control-flow narrowing does not collapse it — `state` is mutated by the event
   * handler across every `await` in `start()`, so a literal comparison after an
   * assignment is (wrongly) an impossible one to tsc. `DapClient.stoppedNow()`
   * carries the same note for the same reason.
   */
  private stoppedNow(): boolean {
    return this.state === "stopped";
  }

  /**
   * Whether there is a FRAME to answer from — the public half of `stoppedNow()`.
   *
   * 🔴 `hasSession` IS NOT THIS, and session 262 spent a whole session on the
   * difference on the GDScript plane. Measured here with a session live and the
   * program merely RUNNING: `stackTrace` 0x80070057, `scopes` / `variables` /
   * `step` 0x80004005, `evaluate` 0x80070057, `set_variable` blaming the adapter,
   * `watch` an `isError:false` answer whose every entry carried a hex code, and
   * `cs_dbg_continue` waiting the full 15 s to answer `{"state":"running"}` —
   * about 45 s of adapter round trips for a question answerable here in none.
   */
  get isStopped(): boolean {
    return this.stoppedNow();
  }

  constructor(
    private readonly channel: JsonRpcChannel,
    private readonly timeoutMs: number,
  ) {
    super();
    this.channel.onMessage((m) => this.onMessage(m));
    this.channel.onClose((cause) => {
      this.state = "terminated";
      this.configured = false;
      this.sessionStarted = false;
      const detail = cause ? ` (${cause.message})` : "";
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new DapError(p.command, `C# DAP connection closed${detail}`));
      }
      this.pending.clear();
      this.emit("closed");
    });
  }

  private onMessage(msg: FramedMessage): void {
    const type = msg["type"];
    if (type === "response") {
      const reqSeq = msg["request_seq"] as number;
      const p = this.pending.get(reqSeq);
      if (!p) {
        // Not pending: either a response we already gave up on (reconcile + log
        // the overshoot), or a genuinely unknown seq — ignored exactly as before.
        this.ledger.reconcile(reqSeq, msg["success"] === true);
        return;
      }
      this.pending.delete(reqSeq);
      clearTimeout(p.timer);
      if (msg["success"]) {
        p.resolve((msg["body"] ?? {}) as Record<string, unknown>);
      } else {
        p.reject(new DapError(String(msg["command"] ?? p.command), String(msg["message"] ?? "C# DAP request failed")));
      }
    } else if (type === "event") {
      this.onEvent(String(msg["event"]), (msg["body"] ?? {}) as Record<string, unknown>);
    } else if (type === "request") {
      // Reverse request (e.g. runInTerminal). Ack success so the adapter never stalls.
      void this.channel.send({
        seq: this.seq++,
        type: "response",
        request_seq: msg["seq"],
        success: true,
        command: msg["command"],
      });
    }
  }

  private onEvent(event: string, body: Record<string, unknown>): void {
    switch (event) {
      case "initialized":
        this.emit("initialized");
        break;
      case "stopped":
        this.state = "stopped";
        this.lastStoppedThreadId = (body["threadId"] as number) ?? this.lastStoppedThreadId ?? 1;
        this.lastStoppedReason = (body["reason"] as string) ?? null;
        this.emit("stopped", body);
        break;
      case "continued":
        this.state = "running";
        break;
      case "terminated":
      case "exited":
        this.state = "terminated";
        this.emit("terminated", body);
        break;
      case "output":
        this.emit("output", body);
        break;
      default:
        break;
    }
  }

  /**
   * Snapshot of responses that arrived after their deadline, oldest first.
   * Diagnostics only — nothing in the request path reads this.
   */
  recentLateReplies(): readonly LateReply[] {
    return this.ledger.recent();
  }

  request<T extends Record<string, unknown> = Record<string, unknown>>(
    command: string,
    args: unknown = {},
    timeoutMs = this.timeoutMs,
  ): Promise<T> {
    const seq = this.seq++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        // Remember the seq BEFORE rejecting, so a response already in flight is
        // reconciled rather than dropped as anonymous.
        this.ledger.note(seq, command, timeoutMs);
        reject(new DapError(command, `C# DAP '${command}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(seq, { command, resolve: resolve as (v: Record<string, unknown>) => void, reject, timer });
      this.channel.send({ seq, type: "request", command, arguments: args }).catch((err: Error) => {
        clearTimeout(timer);
        this.pending.delete(seq);
        reject(err);
      });
    });
  }

  private waitEvent(name: string, timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.removeListener(name, onEvent);
        resolve();
      }, timeoutMs);
      const onEvent = () => {
        clearTimeout(timer);
        resolve();
      };
      this.once(name, onEvent);
    });
  }

  /** Store breakpoints; apply immediately if the session is already configured, else buffer until launch/attach. */
  async setBreakpoints(path: string, lines: number[], conditions?: (string | null)[]): Promise<Record<string, unknown>> {
    this.breakpoints.set(path, { path, lines, conditions });
    if (this.configured) return this.applyBreakpoints(path);
    return { buffered: true, path, lines };
  }

  private applyBreakpoints(path: string): Promise<Record<string, unknown>> {
    const bp = this.breakpoints.get(path);
    if (!bp) return Promise.resolve({});
    return this.request("setBreakpoints", {
      source: { path },
      breakpoints: bp.lines.map((line, i) => {
        const b: { line: number; condition?: string } = { line };
        const condition = bp.conditions?.[i];
        if (condition) b.condition = condition;
        return b;
      }),
    });
  }

  // ---- Watch expressions ---------------------------------------------------

  /** Add expressions to the persistent watch set (deduped, order-preserving). */
  addWatches(expressions: string[]): void {
    for (const e of expressions) if (e && !this.watches.includes(e)) this.watches.push(e);
  }

  /** Remove specific expressions from the watch set. */
  removeWatches(expressions: string[]): void {
    const drop = new Set(expressions);
    this.watches = this.watches.filter((e) => !drop.has(e));
  }

  /** Clear all watch expressions. */
  clearWatches(): void {
    this.watches = [];
  }

  /** The current watch set (a copy). */
  listWatches(): string[] {
    return [...this.watches];
  }

  /**
   * Evaluate every watch expression in the context of a stopped frame and return
   * the results. Each is evaluated with DAP `context: "watch"` (the side-effect-free
   * context IDEs use for watch panels). A single bad expression yields an `error` on
   * that entry instead of failing the whole call. `timeoutMs` bounds each individual
   * `evaluate` (callers pass the shorter `csDapEvaluateTimeoutMs`) so a watch the
   * adapter never answers fails fast on that entry rather than hanging the full DAP
   * timeout at every stop — mirroring `cs_dbg_evaluate` and the GDScript `DapClient`.
   */
  async evaluateWatches(frameId?: number, timeoutMs = this.timeoutMs): Promise<WatchResult[]> {
    const results: WatchResult[] = [];
    for (const expression of this.watches) {
      try {
        const body = await this.request("evaluate", { expression, frameId, context: "watch" }, timeoutMs);
        results.push({ expression, value: String(body["result"] ?? ""), type: String(body["type"] ?? ""), error: null });
      } catch (err) {
        const e = err as { message?: string };
        results.push({ expression, value: "", type: "", error: e.message ?? String(err) });
      }
    }
    return results;
  }

  private async applyAllBreakpoints(): Promise<void> {
    for (const path of this.breakpoints.keys()) {
      await this.applyBreakpoints(path).catch(() => undefined);
    }
  }

  /**
   * Full handshake: initialize → launch/attach → (breakpoints) → configurationDone.
   *
   * 🔴 The handshake used to declare success unconditionally. Measured against a
   * real netcoredbg 3.2.0-1092 with `program: "/no/such/binary"`:
   *
   *     >> launch             << success=true
   *     >> configurationDone  << success=false
   *                              "Failed command 'configurationDone' : 0x80070002"
   *
   * `0x80070002` is ERROR_FILE_NOT_FOUND — the adapter DOES report the failure, and it
   * reports it on `configurationDone`, which was `.catch(() => undefined)`-swallowed
   * immediately before `state = "running"`. So `cs_dbg_launch` answered
   * `isError:false state:"running"` for a session that never existed, and every tool
   * afterwards failed with a bare hex code against a phantom session. The same held
   * for `program: ""` and for `cs_dbg_attach` on a process id that does not exist.
   */
  async start(mode: "launch" | "attach", args: Record<string, unknown>): Promise<void> {
    this.lastStartMode = mode;
    this.lastStartArgs = args;
    this.sessionStarted = false;
    // Listen for `initialized` before we ask, so we cannot miss it.
    const onInit = this.waitEvent("initialized", Math.min(this.timeoutMs, 5000));
    this.capabilities = await this.request("initialize", {
      clientID: "breakpoint-mcp",
      clientName: "Godot Breakpoint MCP",
      adapterID: "coreclr",
      pathFormat: "path",
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsRunInTerminalRequest: false,
    });
    this.state = "initialized";

    // Send launch/attach but don't await it yet — many adapters (netcoredbg included)
    // only resolve it after configurationDone.
    //
    // 🔴 A rejection used to be routed to `this.emit("error", err)`. Nothing in the
    // host registers an `error` listener, and an unlistened `error` emit on an
    // EventEmitter is an UNCAUGHT THROW — a failing launch could take the MCP server
    // down. It is captured instead, and recorded on the client so a rejection that
    // lands after `start()` has returned still puts the session in `terminated`
    // rather than leaving it reading `running`.
    this.startFailure = null;
    const startReq = this.request(mode, args).then(
      () => undefined,
      (err: unknown) => {
        this.startFailure = err;
        this.configured = false;
        // A rejection arriving after `start()` returned ends the session, so the
        // tools' session guard refuses from then on rather than reading `running`.
        this.sessionStarted = false;
        this.state = "terminated";
        // A DISTINCT event name, deliberately: `error` is special-cased by
        // EventEmitter and throws when unlistened. This one is safe to ignore.
        this.emit("start_failed", err);
      },
    );
    await onInit;
    await this.applyAllBreakpoints();

    // Arm the entry-stop wait BEFORE configurationDone is sent: netcoredbg can emit
    // `stopped` before its configurationDone response lands, and a listener attached
    // afterwards would miss it.
    const wantsEntryStop = mode === "launch" && args["stopAtEntry"] === true;
    const entryStop = wantsEntryStop ? this.waitEvent("stopped", ENTRY_STOP_WAIT_MS) : null;

    let configureFailure: unknown = null;
    await this.request("configurationDone", {}).catch((err: unknown) => {
      configureFailure = err;
    });

    // 🔴 Only treat a configurationDone failure as fatal when the adapter ADVERTISED
    // the request. An adapter that never claimed `supportsConfigurationDoneRequest`
    // may legitimately reject it while the session is perfectly alive — refusing
    // there would be the over-eager mirror of the bug being fixed. netcoredbg
    // advertises it (measured: `supportsConfigurationDoneRequest = true`), so its
    // 0x80070002 is a real answer, not an unimplemented request.
    const configureDoneAdvertised = this.capabilities?.["supportsConfigurationDoneRequest"] === true;
    const fatal = this.startFailure ?? (configureDoneAdvertised ? configureFailure : null);
    if (fatal) {
      this.configured = false;
      this.sessionStarted = false;
      this.state = "terminated";
      void startReq;
      const detail = (fatal as { message?: string })?.message ?? String(fatal);
      throw new DapError(
        mode,
        `the C# debug adapter did not start the session: ${detail}. No debug session is ` +
          `running — check that the program exists and is a .NET assembly (${mode} args: ` +
          `${JSON.stringify(args).slice(0, 200)}).`,
      );
    }

    this.configured = true;
    this.sessionStarted = true;
    // 🔴 ONLY from `initialized`, never unconditionally. The adapter can emit `stopped`
    // (or `terminated`) between the configurationDone RESPONSE and this line, and the
    // event handler has already moved the state — a blind `= "running"` clobbers it and
    // the awaited entry stop below then has nothing left to wait for. The first version
    // of this fix wrote it unconditionally and passed locally for exactly that reason:
    // the race window is small, and CI is where it opened.
    if (this.state === "initialized") this.state = "running";

    // 🔴 `stop_on_entry` used to return before the entry stop, so the tool reported
    // `running` and `threadId()` fell back to 1 while netcoredbg's real thread id is a
    // large integer — cs_dbg_stack_trace answered `0x80070057` immediately after
    // launch, and the IDENTICAL call succeeded 1.5s later. Waiting here is what makes
    // stop-on-entry work end to end. Bounded: an adapter that ignores stopAtEntry
    // simply reports `running`, as before.
    if (entryStop) await entryStop;
  }

  threadId(): number {
    return this.lastStoppedThreadId ?? 1;
  }

  /**
   * Issue a resume command (continue / next / stepIn / stepOut) and wait for the
   * program to settle again — the next `stopped` (hit a breakpoint / step landed)
   * or `terminated` event — before returning. The stop listener is armed BEFORE
   * the command is sent so a fast stop can't be missed. If nothing settles within
   * `waitMs` (e.g. `continue` runs on with no further breakpoint), it resolves with
   * the current state ("running").
   */
  async resume(
    command: string,
    args: Record<string, unknown>,
    waitMs: number,
  ): Promise<{ state: DapState; reason: string | null }> {
    const settled = new Promise<{ state: DapState; reason: string | null }>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        this.removeListener("stopped", onStop);
        this.removeListener("terminated", onTerm);
        resolve({ state: this.state, reason: this.lastStoppedReason });
      };
      const onStop = () => finish();
      const onTerm = () => finish();
      const timer = setTimeout(() => {
        this.removeListener("stopped", onStop);
        this.removeListener("terminated", onTerm);
        resolve({ state: this.state, reason: this.lastStoppedReason });
      }, waitMs);
      this.once("stopped", onStop);
      this.once("terminated", onTerm);
    });
    // Optimistically mark running so a stale "stopped" isn't reported back.
    this.state = "running";
    await this.request(command, args);
    return settled;
  }

  /**
   * Resolve when the program next settles (`stopped`/`terminated`) or `waitMs`
   * elapses — the shared wait used after a restart. Listeners are armed by the
   * caller BEFORE the triggering request is sent so a fast settle can't be missed.
   */
  private settle(waitMs: number): Promise<{ state: DapState; reason: string | null }> {
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        this.removeListener("stopped", onStop);
        this.removeListener("terminated", onTerm);
        resolve({ state: this.state, reason: this.lastStoppedReason });
      };
      const onStop = () => finish();
      const onTerm = () => finish();
      const timer = setTimeout(() => {
        this.removeListener("stopped", onStop);
        this.removeListener("terminated", onTerm);
        resolve({ state: this.state, reason: this.lastStoppedReason });
      }, waitMs);
      this.once("stopped", onStop);
      this.once("terminated", onTerm);
    });
  }

  /**
   * Restart the debug session. If the adapter advertises `supportsRestartRequest`,
   * issue a single DAP `restart` (carrying the launch/attach args); otherwise fall
   * back to `terminate` + a fresh handshake, so restart works on every adapter.
   * netcoredbg advertises no `supportsRestartRequest`, so in practice the relaunch
   * path runs. Reuses the last cs_dbg_launch/cs_dbg_attach params; `overrideArgs`
   * (e.g. a new `stopAtEntry`) are merged over them. `method` tells the caller which
   * path ran. C# sessions have no scene, so — unlike the GDScript `DapClient` — this
   * returns no `scene`.
   */
  async restart(
    overrideArgs: Record<string, unknown> = {},
    waitMs = 15000,
  ): Promise<{ method: "restart" | "relaunch"; state: DapState; reason: string | null }> {
    if (!this.lastStartMode || !this.lastStartArgs) {
      throw new DapError("restart", "no C# debug session to restart — call cs_dbg_launch or cs_dbg_attach first");
    }
    const args = { ...this.lastStartArgs, ...overrideArgs };
    if (this.capabilities?.["supportsRestartRequest"] === true) {
      // Arm the settle listener before issuing restart so a fast stop isn't missed.
      const settled = this.settle(waitMs);
      this.state = "running";
      await this.request("restart", { arguments: args });
      this.lastStartArgs = args;
      const r = await settled;
      return { method: "restart", state: r.state, reason: r.reason };
    }
    // Fallback: ask the debuggee to terminate (best-effort), then re-run the full
    // initialize → launch/attach → configurationDone handshake with the same args.
    await this.request("terminate", {}).catch(() => undefined);
    await this.start(this.lastStartMode, args);
    return { method: "relaunch", state: this.state, reason: this.lastStoppedReason };
  }

  close(): void {
    this.channel.close();
    this.state = "disconnected";
    this.configured = false;
    this.sessionStarted = false;
  }
}

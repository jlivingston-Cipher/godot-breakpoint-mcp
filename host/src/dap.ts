import { EventEmitter } from "node:events";
import { FramedConnection, type FramedMessage } from "./framing.js";
import { OverdueLedger, type LateReply } from "./late-reply.js";
import { closeDetail, closeRemedy } from "./close-cause.js";
import { timeoutRemedy, unannouncedRemedy } from "./timeout-cause.js";

/**
 * Who answers this plane, in the words its late-reply ledger already uses.
 *
 * 🔴 ONE CONSTANT, THREE READERS (264, 267). The ledger names this peer when a reply
 * arrives late, `closeRemedy` names it when the connection drops, and `timeoutRemedy`
 * names it when a deadline fires. Two literals would let the same peer acquire two names
 * on the same run, which is the class of drift 257's per-instance deadline noun was
 * written to stop.
 */
const DAP_PEER = "the debug adapter";

/**
 * The environment variable this plane's deadline comes from.
 *
 * 🔴 ONE CONSTANT, TWO READERS, FOR THE REASON DIRECTLY ABOVE. The ledger prints it on a
 * late reply and `timeoutRemedy` tells the caller to raise it; a knob renamed in
 * `config.ts` and updated in one of the two would send an operator to export a variable
 * nothing reads, which is worse than saying nothing.
 */
const DAP_TIMEOUT_KNOB = "GODOT_DAP_TIMEOUT_MS";

/**
 * The reasons a `DapError` can be raised BY THE HOST, as opposed to relayed from the
 * adapter — the discriminator a caller is allowed to branch on.
 *
 * 🔴 **A UNION, NOT A `string`, AND THAT IS THE POINT OF THE ROW THIS CLOSES (268).**
 * `dap-timeout-predicate-reads-prose` was open because both DAP tool layers decided a
 * shipped tool's answer with `/timed out after/.test(err.message)`, and
 * `timeout-caveat.ts` said out loud that the phrasing "must not be disturbed" — a
 * comment doing a type's job. A comment cannot fail a build; this can.
 *
 * Absent means RELAYED: the adapter's own words, which the host has no business
 * classifying. Exactly as `remedy` is absent when nobody has answered a site.
 */
export type DapErrorCode = "timeout" | "unannounced";

/** This request hit its own deadline. The only code `isDapTimeout` answers to. */
export const DAP_TIMEOUT_CODE: DapErrorCode = "timeout";

/**
 * The adapter answered `initialize` and never emitted `initialized`, so the handshake
 * was refused rather than continued out of order. See `start()`.
 */
export const DAP_UNANNOUNCED_CODE: DapErrorCode = "unannounced";

export class DapError extends Error {
  /**
   * The next action — the same field `BridgeError` has carried since 254, for the same
   * reason, and 🔴 **ITS ABSENCE WAS THE WHOLE OF THE ROW THIS CLOSES.** 264's census
   * found 13 of 25 host-raised failures sitting on classes with nowhere to put an answer;
   * this class was two of the four. Worse than nowhere: three of the raise sites below
   * DID know the next action and pasted it into the MESSAGE, where nothing structural can
   * read it — no gate can join it, `fail()` cannot render it under one clause with the
   * rest, and a reword drops it with no test able to tell.
   *
   * Optional by construction, exactly as on `BridgeError`: a rejection RELAYING the
   * adapter's own words has no business inventing a next action on its behalf. Absent
   * here means nobody has answered that site yet, not that it is unanswerable.
   */
  remedy?: string;
  /**
   * Why the host raised this, for callers that branch — `undefined` on the six sites
   * that relay the adapter's own failure.
   *
   * 🔴 **`LspError` HAS CARRIED ONE SINCE IT WAS WRITTEN AND THIS CLASS DID NOT, FOR NO
   * REASON ANYBODY DECIDED.** `LspError`'s first constructor argument happens to be a
   * code, so its two timeout sites pass `"timeout"` and every LSP caller branches on a
   * field. This class's first argument is `command`, so its two timeout sites had
   * nowhere to put one — and the tool layer read the message body instead. The shape of
   * a constructor decided whether a shipped branch was structural or textual, and
   * nothing ever asked.
   */
  code?: DapErrorCode;
  constructor(
    public command: string,
    message: string,
    remedy?: string,
    code?: DapErrorCode,
  ) {
    super(message);
    this.name = "DapError";
    if (remedy) this.remedy = remedy;
    if (code) this.code = code;
  }
}

/**
 * The ceiling on the wait for `initialized`, shared by both DAP planes.
 *
 * Not a new number — both clients have used `Math.min(timeoutMs, 5000)` since their
 * handshakes were written. It is named here because 267 made the OUTCOME of that wait
 * something a caller reads, and a window reported in a warning has to be the window that
 * was actually waited.
 */
export const INITIALIZED_WAIT_CEILING_MS = 5000;

/**
 * The message both planes raise when the adapter never announces itself.
 *
 * 🔴 ONE BUILDER, TWO PLANES — the same discipline `timeoutRemedy` and `closeRemedy`
 * already follow, and the reason is 267's finding one file over: the SAME question was
 * pasted into `peers.ts` and `readiness.ts`, 266 fixed one, and the other survived the
 * session that fixed it because nothing joined the two sites. A sentence shipped twice
 * is a sentence that will be corrected once.
 *
 * `waitedMs` is the window ACTUALLY waited, not the ceiling — a refusal naming a wait
 * that did not happen sends an operator to the wrong knob, which is exactly why 267
 * captured the window instead of recomputing it at the report site.
 */
export function unannouncedMessage(peer: string, mode: string, waitedMs: number): string {
  return (
    `${peer} answered \`initialize\` for this ${mode} and never emitted \`initialized\` ` +
    `within ${waitedMs}ms, so the session was refused rather than configured out of order. ` +
    `No breakpoints were applied and no program was left running by this host.`
  );
}

/**
 * What a launch/attach result says when the adapter never announced itself.
 *
 * 🔴 REPORTED, NOT REFUSED, AND THE CHOICE IS THE WHOLE OF THE ROW. The wait has resolved
 * on its own timer since the handshake was written, so every adapter in the field has
 * been launching through this path; refusing outright would break working setups to fix a
 * silence. The shape is the one this tool already ships for `stop_on_entry_honored`: name
 * what did not happen, name the symptom to expect, leave the session alone. A stricter
 * refusal remains available and is a separate decision.
 */
export function unorderedHandshakeWarning(waitedMs: number): string {
  return (
    `The debug adapter did not announce itself with an initialized event within ${waitedMs}ms. ` +
    `Breakpoints were applied outside the order the DAP specification requires, so a breakpoint ` +
    `that silently fails to bind is the symptom to expect; the session is otherwise live.`
  );
}

/**
 * The next action when `restart` is called with no launch behind it.
 *
 * A `*_REMEDY` const rather than a literal at the throw site because check 28's grammar
 * reader finds host-side remedies by that naming convention — a sentence spelled inline
 * is a sentence no gate reads, which is the defect this whole change is about.
 */
export const DAP_RESTART_REMEDY =
  "Call `dbg_launch` or `dbg_attach` first — a restart reuses the parameters of a launch that already happened, and none has.";

interface Pending {
  command: string;
  resolve: (value: Record<string, unknown>) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

export type DapState = "disconnected" | "initialized" | "running" | "stopped" | "terminated";

/**
 * Per-line breakpoint modifier fields, each gated by an adapter capability. Godot
 * advertises all three false AND ignores them — a "conditional" breakpoint halts
 * unconditionally (measured live on 4.3 and 4.7), so an undropped modifier is not a
 * no-op, it is the opposite of what the caller asked for.
 */
export const BREAKPOINT_MODIFIER_CAPS: Record<string, string> = {
  condition: "supportsConditionalBreakpoints",
  hitCondition: "supportsHitConditionalBreakpoints",
  logMessage: "supportsLogPoints",
};

/**
 * Which of condition/hitCondition/logMessage the connected adapter does NOT support, out
 * of the ones actually requested.
 *
 * `caps === null` returns [] — nothing can be feature-detected before the adapter has
 * advertised anything. 🔴 That branch is DEFENSIVE TYPING, NOT A LIVE PATH, and the
 * mutation sweep proved it by surviving a mutation that made it drop everything: the
 * only caller is `applyBreakpoints`, a response body is normalised to `{}` before it is
 * ever assigned, and the handshake sets `capabilities` before it applies any breakpoint.
 * Recorded rather than deleted because the field's TYPE is nullable and a future caller
 * could reach it; what IS reachable — an adapter answering `initialize` with an empty
 * body, so `caps` is `{}` and advertises nothing — is pinned by a unit test instead.
 *
 * 🔴 CAPABILITIES ARE UNKNOWN UNTIL `initialize` ANSWERS, AND BREAKPOINTS ARE ORDINARILY
 * BUFFERED BEFORE THAT. That is why this is called from `applyBreakpoints` — the moment
 * the modifiers are actually put on the wire — and not only from the tool layer at set
 * time. Detecting at set time alone left the buffered path, which is the documented and
 * overwhelmingly common one, sending modifiers to an adapter that ignores them with no
 * warning: the caller asked for "break when counter < 0" and got a breakpoint that halts
 * every frame, reported as success. Measured, D1 of this release.
 */
export function unsupportedBreakpointModifiers(
  caps: Record<string, unknown> | null,
  requested: { condition: boolean; hitCondition: boolean; logMessage: boolean },
): string[] {
  if (!caps) return [];
  const out: string[] = [];
  for (const field of ["condition", "hitCondition", "logMessage"] as const) {
    if (requested[field] && caps[BREAKPOINT_MODIFIER_CAPS[field]] !== true) out.push(field);
  }
  return out;
}

/** True when a per-line modifier array carries at least one non-null, non-empty entry. */
export function hasModifier(arr?: (string | null)[]): boolean {
  return Array.isArray(arr) && arr.some((v) => v != null && v !== "");
}

interface BufferedBreakpoints {
  path: string;
  lines: number[];
  conditions?: (string | null)[];
  /** Per-line hit expressions (DAP `hitCondition`, e.g. ">3", "%5"), aligned to `lines`. */
  hitConditions?: (string | null)[];
  /** Per-line log messages (DAP `logMessage` → logpoint; no actual break), aligned to `lines`. */
  logMessages?: (string | null)[];
}

export interface WatchResult {
  expression: string;
  value: string;
  type: string;
  /** Non-null when evaluating this expression failed (e.g. not in scope). */
  error: string | null;
}

/**
 * Minimal DAP client for Godot's Debug Adapter (raw TCP + DAP framing). Runs the
 * initialize → (breakpoints) → configurationDone → launch/attach handshake, and
 * tracks execution state from `stopped`/`terminated` events. One session.
 */
export class DapClient extends EventEmitter {
  private conn: FramedConnection;
  private seq = 1;
  private pending = new Map<number, Pending>();
  private breakpoints = new Map<string, BufferedBreakpoints>();
  /** Modifier fields dropped at apply time this session; reset by `start()`. */
  private droppedModifiers = new Set<string>();
  /**
   * Seqs whose deadline fired, so a response arriving later is recognised, not
   * dropped. `seq` is monotonic and is never reset, so a seq is never reused and
   * a late response can only be its own request's.
   */
  private readonly ledger = new OverdueLedger<number>("DAP", DAP_PEER, DAP_TIMEOUT_KNOB);
  private configured = false;
  /** Persistent watch expressions, re-evaluated at each stop (see evaluateWatches). */
  private watches: string[] = [];
  /**
   * True only between a launch/attach the adapter ACCEPTED and the session ending.
   *
   * 🔴 Before this existed, exactly one of the fifteen `dbg_*` tools (`dbg_restart`)
   * knew whether a session had ever been started, and it knew by accident — it reads
   * `lastStartMode`. Everything else fired its request at the adapter and reported the
   * answer, so `dbg_continue` on a never-launched client returned
   * `{"state":"running"}` with `isError:false` AND left `state = "running"` behind
   * (see `resume()`'s optimistic assignment), which made every later answer read as if
   * a session existed. Measured live against Godot 4.7.
   */
  private sessionStarted = false;
  /** The mode + args of the last start(), so restart() can reuse/override them. */
  private lastStartMode: "launch" | "attach" | null = null;
  private lastStartArgs: Record<string, unknown> | null = null;

  capabilities: Record<string, unknown> | null = null;
  state: DapState = "disconnected";
  lastStoppedThreadId: number | null = null;
  lastStoppedReason: string | null = null;

  /**
   * Whether a launch/attach the adapter accepted is still in force. The `dbg_*` tools
   * that can only answer from a live session consult this instead of asking the
   * adapter and reporting whatever came back.
   */
  get hasSession(): boolean {
    return this.sessionStarted && this.state !== "terminated" && this.state !== "disconnected";
  }

  /**
   * Whether the adapter has reported a stop, read through a call so TypeScript's
   * control-flow narrowing does not collapse it: `state` is mutated by the event
   * handler across every `await` in `start()`, and a literal `this.state === "stopped"`
   * after a `this.state = "running"` is (wrongly) an impossible comparison to tsc.
   */
  private stoppedNow(): boolean {
    return this.state === "stopped";
  }

  /**
   * Whether there is a FRAME to answer from — the public half of `stoppedNow()`.
   *
   * 🔴 `hasSession` IS NOT THIS, AND THE DIFFERENCE IS A WHOLE FAMILY OF DEFECTS (262 §1).
   * The `dbg_*` tools consulted `hasSession` — *did a launch succeed* — and then asked the
   * adapter for a stack, a scope, a variable or a step. With a session live and the program
   * RUNNING, measured against a real 4.7 adapter, that produced eight different answers to
   * one question: `{"frames":[]}` and `{"scopes":[]}` (empty successes), a `dbg_watch` entry
   * carrying a fabricated `error:"timeout"` after 5 s, a 15 s wait per `dbg_step` /
   * `dbg_continue` ending in `{"state":"running"}`, and a `dbg_set_variable` refusal blaming
   * the user's Godot build. ~48 s of adapter round trips for a question answerable here in
   * none. A session existing is a PROXY for a frame existing, and the two part company the
   * moment the program is not at a stop — 261's rule, one plane over.
   */
  get isStopped(): boolean {
    return this.stoppedNow();
  }

  constructor(
    host: string,
    port: number,
    private readonly timeoutMs: number,
  ) {
    super();
    this.conn = new FramedConnection(
      host,
      port,
      "DAP",
      "Is the editor running with the Debug Adapter enabled (Editor Settings → Network → Debug Adapter, port 6006)?",
    );
    this.conn.onMessage((m) => this.onMessage(m));
    this.conn.onClose((cause) => {
      this.state = "terminated";
      this.configured = false;
      // `cause` is the socket-level error when the drop had one (ECONNRESET, EPIPE).
      // Without it every pending request reported a generic close and the operator
      // could not tell a crashed server from something else holding the port.
      const detail = closeDetail(cause);
      // 🔴 THE SAME ERRNO SPLIT `bridge.ts` GOT (264 §3), NOW ON THE FIELD RATHER THAN IN
      // THE MESSAGE (267). The comment that stood here said `DapError` "carries no
      // `remedy` field, and the plane's `fail()` renders no `remedyClause`, so the next
      // action goes where the caller will actually read it" — true when it was written,
      // and the reason 264's census counted this site among the SEVEN that named an
      // action nothing structural could read. Both halves are gone: the field exists and
      // `fail()` appends the clause. **What a caller receives is byte-identical**, which
      // is asserted rather than assumed — the message ended in ` — ${remedy}` and the
      // renderer appends exactly that, so this is a change of channel, not of wording.
      const remedy = closeRemedy(cause, DAP_PEER);
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new DapError(p.command, `DAP connection closed${detail}`, remedy));
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
        p.reject(new DapError(String(msg["command"] ?? p.command), String(msg["message"] ?? "DAP request failed")));
      }
    } else if (type === "event") {
      this.onEvent(String(msg["event"]), (msg["body"] ?? {}) as Record<string, unknown>);
    } else if (type === "request") {
      // Reverse request (e.g. runInTerminal). Ack success so we don't stall.
      void this.conn.send({
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
        // 🔴 THE WORDING IS NO LONGER LOAD-BEARING, AND THAT IS 268's CHANGE. It used to
        // be: `tools/dap.ts`'s `isDapTimeout` regexed `/timed out after/` against this
        // string, so a copy edit here silently changed which answer `dbg_evaluate` and
        // `dbg_set_variable` gave, with every test green. The code below is what those
        // branches read now; the sentence is free to be improved.
        reject(
          new DapError(
            command,
            `DAP '${command}' timed out after ${timeoutMs}ms`,
            timeoutRemedy(DAP_PEER, DAP_TIMEOUT_KNOB),
            DAP_TIMEOUT_CODE,
          ),
        );
      }, timeoutMs);
      this.pending.set(seq, { command, resolve: resolve as (v: Record<string, unknown>) => void, reject, timer });
      this.conn.send({ seq, type: "request", command, arguments: args }).catch((err: Error) => {
        clearTimeout(timer);
        this.pending.delete(seq);
        reject(err);
      });
    });
  }

  /**
   * Snapshot of responses that arrived after their deadline, oldest first.
   * Diagnostics only — nothing in the request path reads this.
   */
  recentLateReplies(): readonly LateReply[] {
    return this.ledger.recent();
  }

  /**
   * Wait for `name`, bounded — resolving **`true` when the event arrived and `false` when
   * the timer fired**.
   *
   * 🔴 THE RETURN VALUE IS THE FIX (267), AND THE OLD SIGNATURE IS WHY THE DEFECT COULD
   * NOT BE SEEN. `Promise<void>` gave both outcomes the same shape, so `await onInit` in
   * `start()` below could not distinguish *the adapter said it was ready* from *five
   * seconds passed*, and the handshake carried on either way — sending `setBreakpoints`
   * ahead of the event the DAP specification says must precede it, and telling nobody.
   * Driven against a stub adapter that answers `initialize` and never emits
   * `initialized`, `start()` returned after 5,003 ms having sent
   * `initialize -> launch -> setBreakpoints -> configurationDone` in exactly the order a
   * conformant run sends them, with no complaint anywhere.
   *
   * 262's rule, one instance further in: a guard that asks whether the container exists
   * has not asked whether the content is there. A resolve is not an answer.
   */
  private waitEvent(name: string, timeoutMs: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.removeListener(name, onEvent);
        resolve(false);
      }, timeoutMs);
      const onEvent = () => {
        clearTimeout(timer);
        resolve(true);
      };
      this.once(name, onEvent);
    });
  }

  /** Store breakpoints; apply immediately if the session is already configured. */
  async setBreakpoints(
    path: string,
    lines: number[],
    conditions?: (string | null)[],
    hitConditions?: (string | null)[],
    logMessages?: (string | null)[],
  ): Promise<Record<string, unknown>> {
    this.breakpoints.set(path, { path, lines, conditions, hitConditions, logMessages });
    if (this.configured) {
      return this.applyBreakpoints(path);
    }
    // 🔴 Buffered: capabilities are still unknown, so the modifiers CANNOT be
    // feature-detected yet. Say so rather than let the caller read a bare
    // `buffered: true` as "your condition was accepted" — detection happens in
    // `applyBreakpoints` during the handshake, and `dbg_launch` reports the result.
    const deferred = hasModifier(conditions) || hasModifier(hitConditions) || hasModifier(logMessages);
    return deferred ? { buffered: true, path, lines, modifier_detection_deferred: true } : { buffered: true, path, lines };
  }

  /**
   * Modifier fields dropped because the connected adapter does not support them,
   * accumulated across every `applyBreakpoints` since the last `start()`. Read by
   * `dbg_launch` / `dbg_attach` so a buffered modifier's fate is reported to the
   * caller that buffered it.
   */
  droppedBreakpointModifiers(): string[] {
    return [...this.droppedModifiers];
  }

  private applyBreakpoints(path: string): Promise<Record<string, unknown>> {
    const bp = this.breakpoints.get(path);
    if (!bp) return Promise.resolve({});
    // 🔴 Feature-detect HERE, where the modifiers actually go on the wire. This is the
    // only point that sees both the modifiers and the adapter's capabilities on every
    // path — the buffered one included. See `unsupportedBreakpointModifiers`.
    const dropped = unsupportedBreakpointModifiers(this.capabilities, {
      condition: hasModifier(bp.conditions),
      hitCondition: hasModifier(bp.hitConditions),
      logMessage: hasModifier(bp.logMessages),
    });
    for (const d of dropped) this.droppedModifiers.add(d);
    const drop = new Set(dropped);
    return this.request("setBreakpoints", {
      source: { path },
      // DAP SourceBreakpoint: line + optional condition / hitCondition / logMessage.
      // A logMessage turns the breakpoint into a logpoint (adapter logs, doesn't halt).
      breakpoints: bp.lines.map((line, i) => {
        const b: { line: number; condition?: string; hitCondition?: string; logMessage?: string } = { line };
        const condition = drop.has("condition") ? null : bp.conditions?.[i];
        const hit = drop.has("hitCondition") ? null : bp.hitConditions?.[i];
        const log = drop.has("logMessage") ? null : bp.logMessages?.[i];
        if (condition) b.condition = condition;
        if (hit) b.hitCondition = hit;
        if (log) b.logMessage = log;
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
   * the results. Each expression is evaluated with DAP `context: "watch"` (the
   * side-effect-free evaluation context IDEs use for watch panels). A single bad
   * expression yields an `error` on that entry instead of failing the whole call.
   *
   * `timeoutMs` bounds each individual `evaluate` request (defaults to the client's full
   * `timeoutMs`). Callers pass the shorter `dapEvaluateTimeoutMs` so a watch expression the
   * adapter never answers fails fast on that entry — mirroring `dbg_evaluate` — instead of
   * hanging the full 20 s DAP timeout per stalling expression at every stop.
   */
  async evaluateWatches(frameId?: number, timeoutMs = this.timeoutMs): Promise<WatchResult[]> {
    const results: WatchResult[] = [];
    for (const expression of this.watches) {
      try {
        const body = await this.request("evaluate", { expression, frameId, context: "watch" }, timeoutMs);
        results.push({
          expression,
          value: String(body["result"] ?? ""),
          type: String(body["type"] ?? ""),
          error: null,
        });
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
   * 🔴 THREE THINGS HERE WERE WRONG AT ONCE, and Godot's adapter reaches all three.
   *
   * 1. `startReq.catch(...)` was attached on the LAST line of the handshake. Godot
   *    rejects the `launch`/`attach` request ITSELF — `wrong_path` when `project`
   *    does not match the editor's open project (trivially reachable on macOS, where
   *    `/tmp` realpaths to `/private/tmp`), `not_running` when nothing is running to
   *    attach to. That rejection lands DURING the handshake, before the `.catch()`
   *    existed, so it was an UNHANDLED REJECTION — which Node terminates the process
   *    for. Measured twice, exit code 1. The handler is now attached at creation.
   * 2. It emitted on `"error"`. An unlistened `error` emit on an EventEmitter THROWS
   *    (158 §1). The notification goes out on a distinct name, `start_failed`.
   * 3. `state = "running"` was unconditional, so a session the adapter refused was
   *    reported as running. It is now only set from `initialized`, which also stops
   *    it clobbering a `stopped` that arrives mid-handshake (the race CI found in
   *    #166 and this Mac never did).
   *
   * `entryStopWaitMs > 0` additionally waits, bounded, for the entry `stopped` event
   * before returning — see `dbg_launch`'s `stop_on_entry`. Godot 4.7 does not honour
   * `stopOnEntry` at all, so this wait times out there and the caller is told so
   * rather than being handed a bare `running` that reads like it worked.
   *
   * 🆕 `initializedSeen` (267) is the SAME DISCIPLINE applied to the wait one line up.
   * The `initialized` wait had been resolving on its own timer since this handshake was
   * written, so a five-second silence and a prompt event were the same observable and the
   * caller was handed a session that read exactly like a conformant one. It is reported,
   * not refused: every adapter that works today keeps working, and the four launch tools
   * say which of the two happened — the shape `stop_on_entry_honored` already ships in.
   */
  async start(
    mode: "launch" | "attach",
    args: Record<string, unknown>,
    entryStopWaitMs = 0,
    requireInitialized = true,
  ): Promise<{ entryStopSeen: boolean; initializedSeen: boolean; initializedWaitMs: number }> {
    // Remember how we started so restart() can reuse (or override) these params.
    this.lastStartMode = mode;
    this.lastStartArgs = args;
    this.sessionStarted = false;
    // A fresh session re-detects against whatever adapter answers this time — a
    // restart may reach a different build than the one that dropped last time.
    this.droppedModifiers.clear();
    // Listen for `initialized` before we ask, so we cannot miss it. The window is
    // captured rather than recomputed at the report site, so a warning or refusal names
    // the wait that actually happened rather than the one the code would compute later.
    //
    // 🔴 TWO WINDOWS, AND WHICH ONE APPLIES IS THE WHOLE OF 268's DECISION. Refusing is
    // the default now, so the ceiling that made a longer wait pointless has gone with it:
    // when nothing is going to proceed regardless, the honest bound is the deadline the
    // CALLER declared. A conformant adapter that takes six seconds used to be configured
    // out of order at five and told nobody; it now simply succeeds. The five-second
    // ceiling survives only on the opt-out path, where it must, because that path exists
    // to reproduce 267's behaviour exactly — including the number its warning prints.
    const initializedWaitMs = requireInitialized
      ? this.timeoutMs
      : Math.min(this.timeoutMs, INITIALIZED_WAIT_CEILING_MS);
    const onInit = this.waitEvent("initialized", initializedWaitMs);
    this.capabilities = await this.request("initialize", {
      clientID: "breakpoint-mcp",
      clientName: "Godot Breakpoint MCP",
      adapterID: "godot",
      pathFormat: "path",
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsRunInTerminalRequest: false,
    });
    this.state = "initialized";

    // Send launch/attach but don't await it yet — many adapters only resolve it
    // after configurationDone. The rejection handler is attached HERE, on the same
    // tick the promise is created: see (1) above. It records rather than throws, so
    // a rejection arriving at any point is observable and never unhandled.
    let startFailure: unknown = null;
    const startReq = this.request(mode, args);
    startReq.catch((err) => {
      startFailure = err;
      this.sessionStarted = false;
      // Only the handshake's own window may report `running`; a failure arriving
      // later ends the session so the tools' session guard refuses from then on.
      if (!this.stoppedNow()) this.state = "terminated";
      this.emit("start_failed", err);
    });
    // An entry stop can arrive before configurationDone answers — arm first.
    const entryStop = entryStopWaitMs > 0 ? this.waitEvent("stopped", entryStopWaitMs) : null;
    // 🔴 CAPTURED, NOT DISCARDED (267). `await onInit` threw this away for as long as the
    // handshake has existed, which is why `setBreakpoints` going out ahead of the event
    // that licenses it was invisible: the failing case and the succeeding case returned
    // the same `undefined`.
    const initializedSeen = await onInit;
    // 🔴 THE REFUSAL GOES HERE AND NOWHERE LATER (268), because the next line is the
    // defect. `applyAllBreakpoints()` is `setBreakpoints` going out ahead of the event
    // the DAP specification says must precede it — the thing 266 measured against a stub
    // adapter and 267 made observable without stopping. Refusing after it would leave the
    // adapter holding breakpoints from a session the caller was told did not start.
    if (!initializedSeen && requireInitialized) {
      this.state = "terminated";
      this.sessionStarted = false;
      throw new DapError(
        mode,
        unannouncedMessage("The debug adapter", mode, initializedWaitMs),
        unannouncedRemedy(DAP_PEER, DAP_TIMEOUT_KNOB),
        DAP_UNANNOUNCED_CODE,
      );
    }
    await this.applyAllBreakpoints();
    await this.request("configurationDone", {}).catch(() => undefined);
    // 🔴 By the time we get here an already-arrived rejection has ALREADY run its
    // `.catch()`: the `.catch(() => undefined)` on the configurationDone request adds
    // a microtask hop, so the recorder is queued ahead of this continuation even when
    // both responses land in a single TCP read. A `setImmediate` here looked like
    // prudence and was measurably dead code — a mutation deleting it survived every
    // test in the suite, including one written specifically to catch it. The
    // same-read ordering is pinned by a unit test instead, which is the thing that
    // would actually notice if that hop were ever removed.
    // A rejection arriving LATER than this ends the session via the handler above.
    if (startFailure) throw startFailure;
    this.configured = true;
    this.sessionStarted = true;
    // Guarded, not unconditional: a `stopped` that landed mid-handshake stays.
    if (this.state === "initialized") this.state = "running";
    if (entryStop) {
      await entryStop;
      if (startFailure) throw startFailure;
    }
    return { entryStopSeen: this.stoppedNow(), initializedSeen, initializedWaitMs };
  }

  threadId(): number {
    return this.lastStoppedThreadId ?? 1;
  }

  /**
   * Issue a resume command (continue / next / stepIn / stepOut) and wait for the
   * program to settle again — i.e. the next `stopped` (hit a breakpoint / step
   * landed) or `terminated` event — before returning. Without this, step/continue
   * returned instantly with a stale "running"/"stopped" state and no location.
   *
   * The stop listener is armed BEFORE the command is sent so a fast stop can't be
   * missed. If nothing settles within `waitMs` (e.g. `continue` runs on with no
   * further breakpoint), it resolves with the current state ("running").
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
   * Resolve when the program next settles (a `stopped` or `terminated` event) or
   * `waitMs` elapses, whichever comes first — the shared wait used after a resume
   * or a restart. Listeners are armed by the caller BEFORE the triggering request
   * is sent so a fast settle can't be missed.
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
   * Reuses the last dbg_launch/dbg_attach params; `overrideArgs` (e.g. a new scene
   * or stopOnEntry) are merged over them. `method` tells the caller which path ran.
   */
  async restart(
    overrideArgs: Record<string, unknown> = {},
    waitMs = 15000,
  ): Promise<{ method: "restart" | "relaunch"; state: DapState; reason: string | null; scene: string | null }> {
    if (!this.lastStartMode || !this.lastStartArgs) {
      throw new DapError("restart", "no debug session to restart", DAP_RESTART_REMEDY);
    }
    const args = { ...this.lastStartArgs, ...overrideArgs };
    const scene = typeof args["scene"] === "string" ? (args["scene"] as string) : null;
    if (this.capabilities?.["supportsRestartRequest"] === true) {
      // Arm the settle listener before issuing restart so a fast stop isn't missed.
      const settled = this.settle(waitMs);
      this.state = "running";
      await this.request("restart", { arguments: args });
      this.lastStartArgs = args;
      const r = await settled;
      return { method: "restart", state: r.state, reason: r.reason, scene };
    }
    // Fallback: ask the debuggee to terminate (best-effort), then re-run the full
    // initialize → launch/attach → configurationDone handshake with the same args.
    await this.request("terminate", {}).catch(() => undefined);
    await this.start(this.lastStartMode, args);
    return { method: "relaunch", state: this.state, reason: this.lastStoppedReason, scene };
  }

  close(): void {
    this.conn.close();
    this.state = "disconnected";
    this.configured = false;
    this.sessionStarted = false;
  }
}

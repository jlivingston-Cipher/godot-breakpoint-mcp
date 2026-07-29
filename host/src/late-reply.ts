import { log } from "./logger.js";

/**
 * A reply that arrived AFTER its deadline had already been reported as a timeout.
 *
 * Before this existed a client received one of these — a complete, correct
 * response — found no pending entry, and dropped it without so much as a log
 * line. That silence is the whole problem: a deadline that fires while the peer
 * is still working reports a failure for work that in fact completed, and an
 * agent that retries a reported failure applies a non-idempotent mutation twice.
 *
 * No client can PREVENT that retry — it arrives as a fresh call carrying a fresh
 * id, so no id bookkeeping here can recognise it. What a client CAN do is stop
 * throwing away the evidence, and say the overshoot out loud so the operator has
 * the one number that fixes their configuration.
 *
 * Extracted from BridgeClient (shipped in #129) so the four sibling clients —
 * LSP, C# LSP, DAP, C# DAP — share ONE implementation instead of five copies of
 * a bounded map that would drift apart. The bridge's own late-reply tests are
 * the regression proof for the extraction: not one of them was edited.
 */
export interface LateReply {
  /** Protocol method / command whose reply came back after the deadline. */
  method: string;
  /** The deadline that had already been reported, in ms. */
  deadlineMs: number;
  /** How long after that deadline the reply actually arrived, in ms. */
  overshootMs: number;
  /** Whether the peer reported the call as having succeeded. */
  ok: boolean;
}

/** A request whose deadline has fired, kept only so a later reply can be recognised. */
interface Overdue {
  method: string;
  deadlineMs: number;
  timedOutAt: number;
}

/**
 * Bounds on the overdue ledger. Both are belt-and-braces: an id is normally
 * evicted the moment its late reply lands, so the map is empty in steady state.
 * These only matter for deadlines whose reply NEVER arrives (peer killed
 * mid-request), which would otherwise accumulate one small record each.
 */
export const OVERDUE_MAX = 64;
export const OVERDUE_MAX_AGE_MS = 5 * 60_000;
/** How many late replies to retain for `recent()`. Diagnostics only. */
export const LATE_REPLY_MAX = 32;

/**
 * Per-client ledger of ids whose deadline fired, plus the late replies that
 * later reconciled against them.
 *
 * Generic in the id type because the clients disagree on it and both are safe:
 * `BridgeClient` correlates on `randomUUID()` strings, while the LSP/DAP family
 * uses a monotonic per-instance counter (`nextId++` / `seq++`) that is never
 * reset — not even by `onClose()`, which clears `pending` but deliberately
 * leaves the counter alone. Either way an id is never reused within the
 * instance that owns the ledger, so a late reply can only ever be its OWN
 * request's and misattribution is impossible.
 */
export class OverdueLedger<K> {
  private overdue = new Map<K, Overdue>();
  private lateReplies: LateReply[] = [];

  /**
   * @param kind  names the channel in the log line ("bridge", "LSP", "C# DAP").
   * @param peer  what answered, as a noun phrase ("the editor", "the debug adapter").
   * @param knob  the env var that widens THIS client's deadline. Per-instance,
   *              not per-class: the editor and runtime bridges are both
   *              `BridgeClient` but are configured by different variables, and
   *              naming the wrong one sends the operator to a knob that cannot
   *              move the deadline they just hit.
   */
  constructor(
    private readonly kind: string,
    private readonly peer: string,
    private readonly knob: string,
  ) {}

  /**
   * Record that `id`'s deadline fired, so a reply arriving afterwards is
   * recognisable rather than anonymous. Call ONLY from the timeout path — a
   * request that was never written, or whose connection closed, can never be
   * answered by the peer, so a "late reply" for it is not a thing.
   */
  note(id: K, method: string, deadlineMs: number): void {
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
   * caller's promise is already settled and cannot be un-rejected; the value
   * here is the overshoot number, which is exactly what the operator needs to
   * fix the deadline, and which the client previously discarded in silence.
   *
   * @returns true if this was a reconciled late reply, false for a genuinely
   *          unknown id (a handshake ack, a stale frame) — ignored as ever.
   */
  reconcile(id: K, ok: boolean): boolean {
    const o = this.overdue.get(id);
    if (!o) return false;
    this.overdue.delete(id);
    const overshootMs = Date.now() - o.timedOutAt;
    this.lateReplies.push({ method: o.method, deadlineMs: o.deadlineMs, overshootMs, ok });
    if (this.lateReplies.length > LATE_REPLY_MAX) this.lateReplies.shift();
    log(
      `late ${this.kind} reply: '${o.method}' answered ${overshootMs}ms AFTER its ${o.deadlineMs}ms deadline — ` +
        `the call ${ok ? `DID complete in ${this.peer}` : `reached ${this.peer} and failed there`}, ` +
        `so the reported timeout was premature. Raise ${this.knob} above ${o.deadlineMs + overshootMs}ms.`,
    );
    return true;
  }

  /**
   * Snapshot of replies that arrived after their deadline, oldest first.
   * Diagnostics only — nothing in any request path reads this.
   */
  recent(): readonly LateReply[] {
    return [...this.lateReplies];
  }

  /**
   * How many timed-out ids are still awaiting a reply. Empty in steady state;
   * exposed so a test can assert the ledger does not leak rather than trusting
   * the bounds by inspection.
   */
  overdueSize(): number {
    return this.overdue.size;
  }
}

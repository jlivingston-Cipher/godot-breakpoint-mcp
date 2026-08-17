/**
 * What a dropped connection's errno discriminates, and the next action for each.
 *
 * 🔴 WHY THIS EXISTS — 264's census, which is the answer to a row nine sessions old.
 * `BridgeError`'s own doc said every failure the host raises "arrives without one,
 * because the remedy for those is not the addon's to give", and `setHoldProbe`'s said
 * that was "true for a closed socket". **It is not true for a closed socket.** Measured
 * against real sockets, three ways a peer can go:
 *
 * ```
 * peer resetAndDestroy    code=ECONNRESET  syscall=read  message="read ECONNRESET"
 * peer end()   cleanly    NULL — no socket error at all
 * peer destroy()          NULL — no socket error at all
 * ```
 *
 * and what a caller received for the last two was the SAME code and the SAME sentence,
 * separated by a parenthesis:
 *
 * ```
 * B  peer reset mid-request   bridge_closed  Bridge connection closed before a response arrived (read ECONNRESET)
 * C  peer closed cleanly      bridge_closed  Bridge connection closed before a response arrived
 * ```
 *
 * An editor that was killed and an addon that shut its socket on purpose are different
 * next actions. The `Error` that tells them apart was already in hand at all five close
 * sites — `framing.ts` hands the whole object to every one of them — and every one read
 * `cause.message` and threw the rest away.
 *
 * 🔴 ONE MODULE, FIVE CALLERS, BECAUSE THE ALTERNATIVE IS FIVE COPIES OF A JUDGEMENT.
 * `bridge.ts`, `dap.ts`, `csdap.ts`, `lsp.ts` and `cslsp.ts` each drop a connection the
 * same way for the same reasons. A sentence pasted into five close handlers is five
 * places for the errno list to drift.
 *
 * 🔴 AND WHAT IT DELIBERATELY DOES NOT DO. An errno outside the abrupt family gets NO
 * remedy — not a hedge, not a generic one. 264 measured two families and can speak for
 * two; `classifyClose` returns `"unclassified"` for the rest so a future session can find
 * the population it did not cover instead of inheriting a sentence nobody measured.
 * 260's rule: a diagnostic that names a state is not a diagnosis of its cause.
 */

/**
 * Errnos that mean the peer went away WITHOUT closing the connection.
 *
 * ECONNRESET: the peer's stack sent RST — the process died or was killed mid-stream.
 * EPIPE: we wrote to a connection the peer had already torn down.
 * ECONNABORTED: the local stack aborted an established connection.
 *
 * All three say the same thing about the world — nobody hung up, somebody vanished —
 * and none of them can be produced by an orderly shutdown.
 */
export const ABRUPT_CLOSE_CODES = new Set(["ECONNRESET", "EPIPE", "ECONNABORTED"]);

export type CloseKind = "abrupt" | "deliberate" | "unclassified";

/**
 * Which of the three a close was. `undefined` means the socket ended with no error at
 * all, which is what an orderly `end()` or `destroy()` looks like from this side.
 */
export function classifyClose(cause: Error | undefined): CloseKind {
  if (!cause) return "deliberate";
  const code = (cause as NodeJS.ErrnoException).code;
  if (typeof code === "string" && ABRUPT_CLOSE_CODES.has(code)) return "abrupt";
  return "unclassified";
}

/**
 * The next action, given who the peer was — or `undefined` when the errno does not
 * determine one.
 *
 * Written to the grammar check 28 enforces on `error_remedies.gd`: one imperative at the
 * head, a full stop at the end, and nothing named that does not resolve. `peer` is the
 * noun each client already uses for whoever answers it — "the editor", "the running
 * game", "the debug adapter", "the language server" — so the sentence names the thing the
 * caller was actually talking to rather than a socket.
 */
export function closeRemedy(cause: Error | undefined, peer: string): string | undefined {
  switch (classifyClose(cause)) {
    case "abrupt":
      // The errno is NOT repeated here: `closeDetail` has already put it in the sentence
      // immediately to the left, and a caller reading `(read ECONNRESET) — … (ECONNRESET)`
      // learns nothing from the second one.
      return (
        `Restart ${peer} and retry — it went away without closing the connection, ` +
        `so nothing here says whether this request ran.`
      );
    case "deliberate":
      return (
        `Check whether ${peer} is still running — it closed the connection in an orderly way ` +
        `rather than dropping it, which is what a shutdown looks like from here.`
      );
    default:
      return undefined;
  }
}

/**
 * The parenthetical the five close handlers already built by hand, spelled once.
 *
 * Kept byte-identical to what shipped — ` (read ECONNRESET)` — because tests and users
 * read it, and this change is about adding the next action, not about rewording the
 * detail that was already right.
 */
export function closeDetail(cause: Error | undefined): string {
  return cause ? ` (${cause.message})` : "";
}

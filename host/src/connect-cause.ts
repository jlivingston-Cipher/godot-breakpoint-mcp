/**
 * What a FAILED CONNECT's errno discriminates, and the next action for each.
 *
 * 🔴 WHY THIS EXISTS — 264 answered the CLOSE family and left the CONNECT site in the
 * census's silent bucket. They are the same shape one step apart: `close-cause.ts` was
 * written because five close handlers read `cause.message` and threw `cause.code` away,
 * and `bridge.ts`'s connect handler does exactly that too. Measured at 265 against real
 * sockets, two families:
 *
 * ```
 * nothing bound the port       code=ECONNREFUSED  syscall=connect      "connect ECONNREFUSED 127.0.0.1:43305"
 * host name does not resolve   code=ENOTFOUND     syscall=getaddrinfo  "getaddrinfo ENOTFOUND not-a-real-host.invalid"
 * ```
 *
 * and what a caller received for BOTH was one code and one hint:
 *
 * ```
 * [bridge_unavailable] Cannot reach the Godot editor bridge at 127.0.0.1:43305.
 *                      Is the editor open with the "Breakpoint MCP" plugin enabled? (connect ECONNREFUSED …)
 * [bridge_unavailable] Cannot reach the Godot editor bridge at not-a-real-host.invalid:6010.
 *                      Is the editor open with the "Breakpoint MCP" plugin enabled? (getaddrinfo ENOTFOUND …)
 * ```
 *
 * 🔴 AND THE SECOND ONE IS NOT MERELY UNHELPFUL, IT IS WRONG ABOUT WHAT HAPPENED. On
 * ENOTFOUND the name never resolved, so nothing was contacted: no packet left this
 * machine, and whether the editor is open and its plugin enabled had no bearing on the
 * failure. The caller with a typo in `BREAKPOINT_BRIDGE_HOST` is sent to look at Godot.
 * That is 263 §3.2's rule — a capability read is a question for somebody, and there may be
 * nobody — arriving at the transport: the hint answers "why can this peer not serve me",
 * and in the unresolved case there is no peer on the other end of the question.
 *
 * 🔴 THE HINT IS SUPPRESSED RATHER THAN REPLACED. `connectHint` returns `""` for the
 * unresolved family and the instance's own hint for everything else, so the message a
 * caller reads is BYTE-IDENTICAL to what shipped in every case except the one that was
 * making a false claim. The next action goes in the `remedy` FIELD, which is the channel
 * `remedyClause` reads and 264 §1.2 found seven other sites answering around.
 *
 * 🔴 AND WHAT IT DELIBERATELY DOES NOT DO — 264 §3.3's rule, kept. An errno outside the
 * two measured families gets NO remedy and NO hint change: `classifyConnect` returns
 * `"unclassified"` and `connectRemedy` returns `undefined`, with a test asserting it.
 * EHOSTUNREACH, ETIMEDOUT, EACCES and EAI_AGAIN are all plausible here and NONE of them
 * was driven — this container's egress answers an unroutable address with ECONNREFUSED,
 * so the case could not be produced honestly and is therefore not spoken for. A third
 * family inheriting one of these sentences by default would be a claim nobody made
 * wearing the authority of one that was measured.
 */

/**
 * Errnos that mean the address was reached and the connection was REFUSED.
 *
 * ECONNREFUSED: the host's stack answered with RST — the machine is there, and nothing is
 * listening on that port. It is the ordinary "the editor is not running" case, and it is
 * the one case where the instance hint is exactly right.
 */
export const REFUSED_CONNECT_CODES = new Set(["ECONNREFUSED"]);

/**
 * Errnos that mean the host NAME never became an address, so nothing was contacted.
 *
 * ENOTFOUND: `getaddrinfo` found no record. Note the syscall — this failure happens
 * before any packet is sent, which is why the peer's own state cannot be the cause and
 * the hint that names it has to go.
 *
 * EAI_AGAIN is deliberately ABSENT: it is a TEMPORARY resolver failure, its next action
 * is "retry" rather than "fix the name", and 265 did not drive it.
 */
export const UNRESOLVED_HOST_CODES = new Set(["ENOTFOUND"]);

export type ConnectKind = "refused" | "unresolved" | "unclassified";

/**
 * Which of the three a failed connect was.
 *
 * Unlike `classifyClose`, a missing `cause` is NOT a meaningful state here: a connect
 * that fails always fails with an error, and this handler is only ever reached from
 * `socket.once("error")`. An absent cause is therefore `"unclassified"`, not a fourth
 * family invented to fill the slot.
 */
export function classifyConnect(cause: Error | undefined): ConnectKind {
  if (!cause) return "unclassified";
  const code = (cause as NodeJS.ErrnoException).code;
  if (typeof code !== "string") return "unclassified";
  if (REFUSED_CONNECT_CODES.has(code)) return "refused";
  if (UNRESOLVED_HOST_CODES.has(code)) return "unresolved";
  return "unclassified";
}

/**
 * The hint that belongs in the MESSAGE, given what actually failed.
 *
 * Returns the instance's own hint unchanged for every family except `"unresolved"`,
 * where the hint is a statement about a peer that was never contacted. Suppressing is
 * the whole change: nothing is reworded, so every existing caller and test reading the
 * refused case reads the same bytes.
 */
export function connectHint(cause: Error | undefined, hint: string): string {
  return classifyConnect(cause) === "unresolved" ? "" : hint;
}

/**
 * The next action, given who the peer was and which env var names this client's host —
 * or `undefined` when the errno does not determine one.
 *
 * `hostKnob` is per-INSTANCE for the same reason `deadlineKnob` is (see `BridgeClient`'s
 * constructor): the editor bridge is configured by `BREAKPOINT_BRIDGE_HOST` and the
 * runtime bridge and its peers by `BREAKPOINT_RUNTIME_HOST`, and a sentence naming the
 * wrong one sends the operator to a knob that cannot move the address they just failed
 * to reach.
 *
 * Written to the grammar check 28 enforces on `error_remedies.gd`: one imperative at the
 * head, a full stop at the end, and nothing named that does not resolve.
 */
export function connectRemedy(cause: Error | undefined, peer: string, hostKnob: string): string | undefined {
  switch (classifyConnect(cause)) {
    case "refused":
      // The errno is NOT repeated: `bridge.ts` already puts `(connect ECONNREFUSED …)` in
      // the sentence immediately to the left, and a second copy teaches nobody anything.
      return (
        `Start ${peer} and retry — the machine answered and refused the connection, ` +
        `so the address is right and nothing is listening on that port.`
      );
    case "unresolved":
      return (
        `Check ${hostKnob} — the host name did not resolve, so nothing was contacted ` +
        `and the state of ${peer} is not what failed here.`
      );
    default:
      return undefined;
  }
}

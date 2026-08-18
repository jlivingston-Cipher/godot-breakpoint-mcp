/**
 * The next action when a request hit its own deadline — the last class of host-raised
 * failure on the DAP and LSP planes that had nothing to say.
 *
 * 🔴 WHY THIS EXISTS, AND WHY IT IS THE END OF A ROW RATHER THAN THE MIDDLE OF ONE.
 * 264's census counted 25 host-raised failures about the world: ONE carried a remedy in
 * a field, SEVEN named a next action inside their message where no reader counts it, and
 * SEVENTEEN said nothing at all. 266 answered the last three that had a field to put an
 * answer in, and left five that did not — four request deadlines and the C# session
 * start — because `DapError` and `LspError` had no `remedy` at all. **The gap was never
 * that nobody knew the answer; it was that there was nowhere to put it.** This module is
 * the answer for four of the five, and the field it rides on is the other half.
 *
 * 🔴 WHAT THE HOST ACTUALLY KNOWS AT THE MOMENT A DEADLINE FIRES, which is the whole
 * argument for the sentence below. A dropped connection does NOT reach here: every one of
 * the four clients rejects its pending map from the close handler, with `closeDetail` and
 * `closeRemedy` (264), on a different code path. An unreachable peer does not reach here
 * either — `connect()` fails earlier and differently. By the time a deadline can fire the
 * connection was established and the frame was written, so the honest reading is *the
 * peer has this request and has not answered yet*, not *the request did not go through*.
 * That is `timeout-caveat.ts`'s measured argument for the editor bridge, made one
 * transport over, where it holds for the same structural reason.
 *
 * 🔴 AND WHAT IT DELIBERATELY DOES NOT SAY. It does not tell the caller to retry. Three
 * of the four planes carry mutating requests (`setVariable`, `textDocument/rename`,
 * `evaluate` with a side effect), and the ledger in `late-reply.ts` exists because a
 * reply arriving after its deadline is ordinary here, not exotic — so an unqualified
 * *try again* is the instruction that duplicates the write. The sentence names the knob
 * and says plainly that a retry is a second request. 264's rule: measure N families,
 * speak for N.
 */

/**
 * The next action for a request that outlived its deadline.
 *
 * `peer` is the noun the plane's own late-reply ledger already uses — "the debug
 * adapter", "the language server", "the C# debug adapter", "the C# language server" —
 * so the sentence names what the caller was talking to rather than a socket, exactly as
 * `closeRemedy` does. `knob` is the environment variable `config.ts` reads that
 * deadline from, so the instruction is executable rather than a suggestion to be patient.
 *
 * Written to the grammar check 28 enforces on `error_remedies.gd`: one imperative at the
 * head, a full stop at the end, and nothing named that does not resolve.
 */
export function timeoutRemedy(peer: string, knob: string): string {
  return (
    `Raise \`${knob}\` if ${peer} is merely slow — the request reached it and this ` +
    `host's deadline fired first, so it may still answer and a retry sends a second request.`
  );
}

/**
 * The next action when an adapter answered `initialize` and never announced itself.
 *
 * 🔴 IT NAMES BOTH WAYS OUT, BECAUSE THE HOST CANNOT TELL THEM APART FROM HERE. Either
 * the adapter is slower than the caller's own declared deadline — raise it — or it does
 * not implement the `initialized` event at all, in which case a session can still be had
 * by opting out and accepting that breakpoints are applied ahead of the event that
 * licenses them, which is what every session did silently before 268. Naming only the
 * knob would send an operator to lengthen a wait that is never going to end.
 *
 * Written to check 28's grammar: an imperative at the head, a full stop at the end, and
 * nothing named that does not resolve.
 */
export function unannouncedRemedy(peer: string, knob: string): string {
  return (
    `Raise \`${knob}\` if ${peer} is merely slow to announce itself, or set ` +
    `\`GODOT_DAP_REQUIRE_INITIALIZED=0\` to start anyway against an adapter that never ` +
    `sends \`initialized\`.`
  );
}

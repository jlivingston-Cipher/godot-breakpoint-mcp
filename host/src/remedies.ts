/**
 * The next action for a code the ADDON could not name — the host's own fallback.
 *
 * 🔴 WHY A FALLBACK AT ALL, AND WHY IT IS EXACTLY ONE ROW (258 §2).
 * `error_remedies.gd` is the real table: 254 measured 525 `_err(..)` sites across
 * the two engine planes emitting 216 message templates with 451 of them naming no
 * next action, and answered it where the codes are raised. This file is not a
 * second copy of that table and must not become one — check 28f ceilings it at one
 * row, so a second is a decision somebody makes on purpose against a red gate
 * rather than a drift nobody notices.
 *
 * It exists for one population the addon-side table structurally cannot reach.
 * `error_remedies.gd` WAS ADDED IN ADDON 1.10.0. Its `unknown_method` row says
 * *the addon installed in the project is older than the host* — and every addon
 * old enough to raise `unknown_method` is old enough to predate the file that
 * would explain it. The remedy shipped only where it was not needed; the set of
 * users who can receive it and the set who need it are disjoint by construction.
 *
 * So the sentence has to come from the side that is current by definition: the
 * host the user just upgraded. `bridge.ts` reads `remedy` off the wire error and
 * falls back to this table when the wire carried none, which means a current addon
 * keeps answering for itself and nothing here overrides it.
 *
 * 🔴 AND THE ONE THING THIS CANNOT SEE. `unknown_method` also fires if the HOST
 * calls a method no addon has ever implemented — a host bug, not a stale addon —
 * and this remedy would then send a user to reinstall an addon that was never the
 * problem. That case is gated: `contract_check` joins every method the host calls
 * to the addon's own dispatch on both planes, so it cannot reach a release. The
 * remedy is correct for every `unknown_method` that survives CI.
 */
/**
 * code -> next action, used ONLY when the wire error carried no remedy of its own.
 *
 * Keyed by the same code vocabulary the addon raises and written to the same
 * grammar check 28 enforces on `error_remedies.gd` — one imperative at the head, a
 * full stop at the end, under the length ceiling, every backticked name joined to
 * something real. It is the same sentence a reader gets from the addon when the
 * addon is new enough to have one, so it must read the same way.
 *
 * 🔴 IT IS NOT `ADDON_SKEW_HINT` REUSED, DELIBERATELY. That constant is what a
 * TERMINAL prints — single quotes, because backticks in a shell transcript are
 * command substitution and a user pasting one gets something surprising. This is
 * what crosses the WIRE to an agent, where backticks are how every other remedy
 * marks a name. Same instruction, two audiences that read punctuation differently.
 */
export const HOST_FALLBACK_REMEDIES: Record<string, string> = {
  unknown_method:
    "Re-run `breakpoint-mcp init --force`, then reopen the project — the addon here is older than the host and plain `init` skips an addon that is already present.",
};

/**
 * The remedy to attach to a wire error: the addon's if it sent one, else the
 * host's fallback, else nothing.
 *
 * The addon ALWAYS wins when it spoke. A newer addon may know something specific
 * about the failure that a host-side table keyed only on the code cannot — and
 * silently preferring the generic sentence would make every future addon-side
 * remedy improvement invisible to the reader who acts on it.
 */
export function remedyForWireError(code: string, fromWire: string | undefined): string | undefined {
  if (typeof fromWire === "string" && fromWire !== "") return fromWire;
  return HOST_FALLBACK_REMEDIES[code];
}

/**
 * What a MANAGED CHILD'S termination discriminates, and the next action for each.
 *
 * 🔴 WHY THIS EXISTS — 265 answered the connect family and left the two peer sites in
 * the census's silent bucket. Driven at 266 against real spawned children, they are the
 * same shape one file over, and one of them was making a claim that is FALSE rather than
 * merely absent:
 *
 * ```
 *                          what the caller read
 * child exited (code 1)    1 of 1 peer(s) did not become ready. peer-1 on 21101: exited (code 1)
 *                          — SCRIPT ERROR: could not load main scene. Is the Breakpoint MCP
 *                          addon enabled in this project (it registers the runtime autoload)?
 *
 * child alive, no ping     1 of 1 peer(s) did not become ready. peer-1 on 21121: never answered
 *                          ping. Is the Breakpoint MCP addon enabled in this project (it
 *                          registers the runtime autoload)?
 *
 * two measured causes -> one question -> ZERO next actions
 * ```
 *
 * 🔴 READ THE FIRST ROW. The child EXITED, on its own, with a code and a stderr line
 * naming what stopped it. Whether the addon is enabled had no bearing on that: an absent
 * runtime autoload does not stop a process, it stops a process from ANSWERING. The
 * operator whose scene fails to load is sent to go and look at the plugin list. That is
 * 265 §1's ENOTFOUND finding at the process boundary — and `m?.exited`, the thing that
 * says which sentence is true, is computed on the line directly above the one that pastes
 * the question over both.
 *
 * 🔴 THE QUESTION IS SUPPRESSED, NOT REWORDED. `readinessHint` returns the shipped
 * sentence unchanged when NO not-ready peer exited — the family it was always true of —
 * and `""` the moment one did. Every caller that reads the silent case reads the same
 * bytes, and there is a test asserting that direction specifically, because a build that
 * dropped the question unconditionally would be a worse defect than the one being fixed
 * and would pass a one-sided test.
 *
 * 🔴 AND THE SECOND SITE NAMED A CODE THAT IS NOT A CODE. `peer_exited` rendered
 * `Peer "peer-1" exited (code null)` for a SIGKILLed child, because
 * `ProcessRegistry.run` registered `child.on("exit", (code) => …)` and dropped node's
 * SECOND argument. The signal was handed to that callback on every kill since the
 * registry was written and assigned to nothing — 265's "a default that compiles asks no
 * question", spelled here as a parameter nobody declared. `exitSignal` is captured now
 * and `describeExit` says `killed by SIGKILL` where the sentence used to print a null.
 *
 * 🟢 AND THE WIRE CAUGHT UP AT 267. 266 left this capture deliberately internal —
 * `godot_output` answered `exit_code: null` for a signal-killed child with no `signal`
 * key, because that is a wire addition to a shipped tool and would make a PATCH a MINOR.
 * It was enqueued as `process-output-omits-signal` and paid in the next cut: the tool now
 * answers `signal`, nullable beside `exit_code`, so a caller can tell a child that chose
 * to exit from one the OS killed without parsing a sentence.
 */

/** How a managed child ended, in the words a person would use. */
export function describeExit(code: number | null, signal: NodeJS.Signals | string | null): string {
  // The signal is checked FIRST because both can be non-null in no case node produces,
  // and because `code` is the one that is null exactly when the signal is the answer.
  if (signal) return `killed by ${signal}`;
  if (code === null) return "exited without reporting a code";
  return `exited (code ${code})`;
}

/** Why a spawned peer was not ready when the deadline passed. */
export type ReadinessCause = "exited" | "silent";

/**
 * The hint that belongs in the MESSAGE, given what actually happened to the children.
 *
 * Returns the shipped sentence unchanged while every not-ready peer is merely SILENT —
 * the family it describes correctly — and suppresses it as soon as one has exited, where
 * it is a statement about a plugin that could not have stopped a process.
 */
export function readinessHint(causes: readonly ReadinessCause[], hint: string): string {
  return causes.some((c) => c === "exited") ? "" : hint;
}

/**
 * The next action for a peer that did not become ready, branched on the causes in hand.
 *
 * Three populations, because the registry really does produce three: every child gone,
 * every child alive and mute, and a mixture. A mixture gets both actions named rather
 * than the first one that matched, because telling an operator with one dead peer and one
 * mute peer to do only half the work is the same error as the sentence this replaces.
 *
 * Written to the grammar check 28 enforces on `error_remedies.gd`: one imperative at the
 * head, a full stop at the end, and nothing named that does not resolve.
 */
export function readinessRemedy(causes: readonly ReadinessCause[]): string | undefined {
  if (causes.length === 0) return undefined;
  const exited = causes.some((c) => c === "exited");
  const silent = causes.some((c) => c === "silent");
  if (exited && silent) {
    return (
      // Trimmed at 267 to the ceiling check 28 has always enforced on the addon's own
      // remedies and now enforces here: it was 255 characters, and the two populations it
      // addresses are still both named.
      `Read the output quoted above and fix what stopped the peer(s) that exited, then check ` +
      `the "Breakpoint MCP" plugin for the one(s) that never answered — two things failed and ` +
      `only the second is the addon.`
    );
  }
  if (exited) {
    return (
      `Read the output quoted above and fix what stopped the child — it exited on its own, ` +
      `so the state of the Breakpoint MCP plugin is not what failed here.`
    );
  }
  return (
    `Enable the "Breakpoint MCP" plugin in this project and retry — the peer is still running ` +
    `and answered nothing on its port, which is what a missing runtime autoload looks like.`
  );
}

/**
 * The next action for a request addressed to a peer whose process is already gone.
 *
 * Branched on whether the host CAPTURED any output from it: a child that said something
 * before it died has a cause the caller can read, and one that said nothing has only the
 * fact of its death, which makes re-spawning the next action rather than reading.
 */
export function peerExitRemedy(hasTail: boolean): string {
  return hasTail
    ? `Read the last output quoted above to see what stopped this peer, then spawn a replacement with runtime_spawn_peers.`
    : `Spawn a replacement with runtime_spawn_peers — this peer captured no output before it went, so there is nothing here to read.`;
}

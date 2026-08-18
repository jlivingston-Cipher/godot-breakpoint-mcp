/**
 * One readiness wait, for every launcher that hands a caller a bridge.
 *
 * 🔴 THE FIELD WAS TRUE AND THE MOMENT WAS FALSE. `godot_run_project` and its
 * twin `godot_run_managed` returned `running: true` the instant `spawn()` handed
 * back a pid — measured 566–3213 ms before the game's autoload binds 9081. Every
 * `runtime_*` call inside that window answers *Is the project running?*, and it
 * is: the tool said so, and returned the pid. The answer is true, the question is
 * the wrong one, and no gate in this repository could read the difference.
 *
 * The tree already argued against itself here. `peers.ts` waits, and says why:
 * *"Godot needs ~200 ms to bind, so a tool that returned immediately would hand
 * the caller peers its very next call cannot reach — a flake in the one feature
 * that exists to remove flakes."* `allocatePorts`'s comment then names the gap
 * out loud — *"The DEFAULT runtime port has no such readiness wait"* — as a
 * property of the design rather than a defect. It was the defect. This module is
 * that wait, lifted out of `PeerRegistry` so the default port and the peer ports
 * are ready by the same code and provably so, and `waitReady` there is now a
 * one-line delegation rather than a second copy.
 *
 * 🔴 `ping` IS THE VERB, NOT A TCP CONNECT. `cli/doctor.ts`'s `probeTcp` proves a
 * socket accepted, which any process holding 9081 does; the launchers already
 * refuse a held port for exactly that reason. `ping` is answered by the addon's
 * runtime bridge and by nothing else, and `runtime_bridge.gd` exempts it from the
 * pause latch, so it is also the one verb that answers on a paused game.
 */
import { BridgeClient } from "./bridge.js";
import type { Config } from "./config.js";
import { resolveBridgeSecret } from "./secret.js";

/** Delay between two `ping` attempts while waiting for a bridge to bind. */
export const READY_POLL_INTERVAL_MS = 100;

/** Per-attempt deadline, so one slow `ping` cannot eat the whole wait. */
export const READY_PING_TIMEOUT_MS = 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Poll a bridge until it answers `ping`, or `deadline` passes.
 *
 * Returns whether it answered. It never throws: a caller that launched a process
 * successfully has not failed just because the bridge was slow, and the honest
 * report of that is a false in a field, not an error in place of the pid.
 */
export async function waitForBridge(client: BridgeClient, deadline: number): Promise<boolean> {
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    try {
      await client.request("ping", {}, Math.min(READY_PING_TIMEOUT_MS, remaining));
      return true;
    } catch {
      if (Date.now() >= deadline) return false;
      await sleep(READY_POLL_INTERVAL_MS);
    }
  }
}

/** What a launcher learned by waiting, and what it puts on the wire. */
export interface BridgeReadiness {
  /** The bridge answered `ping` before the deadline. */
  ready: boolean;
  /** How long the launcher actually waited, in ms. */
  waited_ms: number;
}

/**
 * The default runtime port's own client, built the way `index.ts` builds the
 * long-lived one — same host, same port, same secret resolution order — but
 * short-lived, because a launcher wants one answer and not a subscription.
 *
 * Built here rather than threaded in from `index.ts` because `registerCliTools`
 * and `registerProcessTools` both take only a `Config`: two toolsets, two
 * signatures and a stub type would have to change to hand them a client they use
 * for one `ping`.
 */
export function runtimeReadinessClient(cfg: Config): BridgeClient {
  return new BridgeClient(
    cfg.runtimeHost,
    cfg.runtimePort,
    READY_PING_TIMEOUT_MS,
    "runtime bridge",
    "Is the project running?",
    () => resolveBridgeSecret(cfg.projectPath, ["BREAKPOINT_RUNTIME_SECRET", "BREAKPOINT_BRIDGE_SECRET"]),
    "BREAKPOINT_RUNTIME_TIMEOUT_MS",
    "the running game",
  );
}

/**
 * Wait for the DEFAULT runtime bridge after a launch, and report what happened.
 *
 * `timeoutMs` of 0 (or less) is the documented opt-out: no client is built, no
 * socket is opened, and the answer is an honest `{ready: false, waited_ms: 0}` —
 * *not waited* rather than *waited and failed*, which is what a caller that asked
 * not to wait needs to be able to tell apart from a launch that lost the race.
 */
export async function waitForRuntimeBridge(cfg: Config, timeoutMs: number): Promise<BridgeReadiness> {
  if (timeoutMs <= 0) return { ready: false, waited_ms: 0 };
  const start = Date.now();
  const client = runtimeReadinessClient(cfg);
  try {
    const ready = await waitForBridge(client, start + timeoutMs);
    return { ready, waited_ms: Date.now() - start };
  } finally {
    client.close();
  }
}

/**
 * What a launcher tells a caller whose bridge never came up. 254's rule — a
 * message that says what broke has done half the job — applied to a field rather
 * than to a message: `bridge_ready: false` says what happened, and this says what
 * to do about it.
 *
 * 🔴 BOTH SENTENCES WERE REWRITTEN AT 267, AND A GATE FOUND THEM RATHER THAN A READER.
 * Widening check 28's grammar to the host's OWN remedies — until then it read only
 * `error_remedies.gd` — refused both of these at once, and the two refusals were the same
 * two defects this project has now found three times:
 *
 * 1. **They opened by describing the failure.** *The process launched but the runtime
 *    bridge … did not answer ping* is a second copy of what `bridge_ready: false` already
 *    said. The next action arrived in the last clause, after 200 characters, which is the
 *    exact shape 254 moved the addon's remedies away from.
 * 2. 🔴 **AND THE SECOND ASKED A QUESTION OVER TWO CAUSES.** *Is the "Breakpoint MCP"
 *    plugin enabled in this project?* — with *if the project is simply slow to boot* three
 *    clauses later, so the sentence named both causes and instructed on neither. That is
 *    266 §1's finding, in a different file, surviving the session that fixed it: the
 *    question was removed from `peers.ts` and left standing here, because nothing joined
 *    the two sites. A gate over the whole population is what joined them.
 *
 * Neither cause can be discriminated from here — a ping that went unanswered inside the
 * wait says nothing about which — so the repair is to name both and give one action each,
 * not to guess.
 */
export function notReadyRemedy(cfg: Config, waitedMs: number): string {
  if (waitedMs <= 0) {
    return (
      `Call \`runtime_get_tree\` to find out whether the runtime bridge at ` +
      `${cfg.runtimeHost}:${cfg.runtimePort} is up, or re-run with a wait above 0 — the process launched ` +
      `and wait_timeout_ms 0 asked for no wait, so this is unknown, not failed.`
    );
  }
  return (
    `Raise wait_timeout_ms and retry if the project is slow to boot, and check the "Breakpoint MCP" ` +
    `plugin is enabled if it is not — the bridge at ${cfg.runtimeHost}:${cfg.runtimePort} answered no ping ` +
    `in ${waitedMs} ms and this host cannot tell those apart.`
  );
}

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
 */
export function notReadyRemedy(cfg: Config, waitedMs: number): string {
  if (waitedMs <= 0) {
    return (
      `The process launched and no wait was requested (wait_timeout_ms 0), so nothing here knows whether the ` +
      `runtime bridge at ${cfg.runtimeHost}:${cfg.runtimePort} is up yet. Call runtime_get_tree to find out, or ` +
      `re-run without wait_timeout_ms and this tool will wait and answer.`
    );
  }
  return (
    `The process launched but the runtime bridge at ${cfg.runtimeHost}:${cfg.runtimePort} did not answer ping ` +
    `within ${waitedMs} ms, so a runtime_* call will fail until it does. Is the "Breakpoint MCP" plugin enabled in ` +
    `this project? The runtime autoload it registers is what binds the port. If the project is simply slow to boot, ` +
    `raise the wait with wait_timeout_ms.`
  );
}

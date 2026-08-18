import type { Config } from "./config.js";
import { BridgeClient, BridgeError } from "./bridge.js";
import { ProcessRegistry } from "./tools/processes.js";
import { ensureProjectSecret, readProjectSecret } from "./secret.js";
import { log } from "./logger.js";
import { portFree } from "./ports.js";
import { waitForBridge } from "./readiness.js";
import { describeExit, peerExitRemedy, readinessHint, readinessRemedy, type ReadinessCause } from "./exit-cause.js";

/**
 * F6 narrow — multi-peer deterministic playtesting.
 *
 * This is NOT a networking suite and must not drift into one. It is "point the
 * F4 primitives (time freeze / frame step / state digest / seeded RNG) at more
 * than one process". Spawning local headless children on loopback is TESTING,
 * not hosting, so it stays on the right side of Group M's "host nothing,
 * scaffold everything" line.
 *
 * The whole transport story is two facts that already shipped:
 *   • the runtime autoload takes its port from `BREAKPOINT_RUNTIME_PORT`
 *     (`runtime_bridge.gd:74`) and is a TCP *server* the host dials as a client;
 *   • the auth secret is minted per PROJECT, not per process, so one secret
 *     authenticates every peer with zero extra configuration.
 * Confirmed on real Godot 4.3 headless up to four simultaneous peers
 * (`F6_SPIKE_RESULT_2026-07-27.md`): no protocol, transport or handshake change,
 * and the addon needs no edit at all.
 *
 * Two constraints the spike found and this module designs in rather than
 * discovering later:
 *   1. Convergence holds on the FIXED timestep only. Stated in
 *      `runtime_peers_digest`'s tool description, not just the docs — idle-frame
 *      `delta` is wall-clock and diverges across processes regardless of seed.
 *   2. The secret mint is a check-then-write race. The host pre-mints before the
 *      first spawn (`ensureProjectSecret`), so every child takes the read path.
 */

/** One spawned headless peer. */
export interface Peer {
  /** Stable handle used by every `peer`-taking tool. */
  id: string;
  /** The loopback port its runtime autoload bound. */
  port: number;
  pid: number | null;
  /** Caller-supplied label, also exported to the child as BREAKPOINT_PEER_ROLE. */
  role: string | null;
  /** Answered `ping` on its bridge before this spawn call returned. */
  ready: boolean;
}

interface Entry {
  info: Peer;
  client: BridgeClient;
  managedId: string;
  stopped: boolean;
}

/**
 * Hard ceiling on simultaneously live peers.
 *
 * Four, not the eight an alternative offers. Four headless Godot instances is already a
 * heavy CI runner, the convergence cases that matter are covered at four, and
 * every extra instance multiplies the flake surface of the one feature whose
 * entire selling point is that it does NOT flake. Raise it on evidence, never
 * speculatively.
 */
export const MAX_PEERS = 4;

/** How far above the default runtime port the allocator will scan. */
const PORT_SCAN_SPAN = 200;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class PeerRegistry {
  /** Peers get their OWN process registry, so peer ids and `godot_run_managed`
   *  ids never share a namespace and the `runtime` toolset does not depend on
   *  whether the `processes` toolset is enabled. */
  private procs = new ProcessRegistry();
  private peers = new Map<string, Entry>();
  private counter = 0;

  constructor(private readonly cfg: Config) {}

  /** Peers that have not been stopped and whose child is still running. */
  live(): Peer[] {
    const out: Peer[] = [];
    for (const e of this.peers.values()) {
      if (e.stopped) continue;
      if (this.procs.get(e.managedId)?.exited) continue;
      out.push(e.info);
    }
    return out;
  }

  /** Every peer this registry has spawned, live or not. */
  all(): Peer[] {
    return [...this.peers.values()].map((e) => e.info);
  }

  /**
   * The one `unknown_peer` refusal, raised from both the read path and the write path.
   *
   * 🔴 WHY THIS IS A FUNCTION (265). `clientFor` and `stop` both refused an unknown id
   * with the code `unknown_peer`, off the SAME registry, in two sentences that had drifted:
   *
   * ```
   * clientFor("peer-9")   No peer with id "peer-9". Live peers: (none). Spawn peers with runtime_spawn_peers, or omit `peer`…
   * stop("peer-9")        No peer with id "peer-9". Live peers: (none).
   * ```
   *
   * One named a next action and the other stopped dead after the ids, and nothing in this
   * repository could see the difference — 264 §1.2 measured why: a next action written
   * into a message BODY reaches no reader, so `remedyClause()` returned `""` for both and
   * check 28's grammar arm judged neither. The answer moves into the `remedy` FIELD, which
   * is the channel that IS read, and the two paths stop being two sentences.
   *
   * 🔴 AND THE REMEDY IS BRANCHED ON THE REGISTRY, which is the point of 264's "silent,
   * but the host holds something that discriminates" column. Telling a caller with three
   * live peers to spawn some is the wrong next action; telling a caller with none to use
   * one of the ids above names nothing. The registry answers which sentence is true, and
   * it was in hand at both sites the whole time.
   */
  private unknownPeer(id: string): BridgeError {
    const ids = this.live().map((p) => p.id);
    return new BridgeError(
      "unknown_peer",
      `No peer with id "${id}". Live peers: ${ids.length ? ids.join(", ") : "(none)"}.`,
      ids.length
        ? `Address one of the live peer ids above, or omit \`peer\` to address the default running game.`
        : `Spawn peers with runtime_spawn_peers, or omit \`peer\` to address the default running game.`,
    );
  }

  /**
   * The bridge client addressing one peer. Throws a BridgeError the runtime
   * tools' `fail()` renders — an unknown or dead peer must read as a clear
   * message naming the live ids, never as a generic "cannot reach the bridge".
   */
  clientFor(id: string): BridgeClient {
    const e = this.peers.get(id);
    if (!e) throw this.unknownPeer(id);
    if (e.stopped) throw new BridgeError("peer_stopped", `Peer "${id}" was stopped by runtime_peer_stop.`);
    const m = this.procs.get(e.managedId);
    if (m?.exited) {
      const tail = this.procs.tail(e.managedId, 6).join(" | ");
      // 🔴 `describeExit` RATHER THAN `exitCode` ALONE (266). A SIGKILLed child has a null
      // code and a signal, and this sentence used to render the null: `exited (code null)`.
      // See exit-cause.ts for the argument node was handing us and nobody declared.
      throw new BridgeError(
        "peer_exited",
        `Peer "${id}" ${describeExit(m.exitCode, m.exitSignal)}${tail ? `; last output: ${tail}` : ""}.`,
        peerExitRemedy(tail.length > 0),
      );
    }
    return e.client;
  }

  /**
   * Allocate `count` free loopback ports, starting just above the default
   * runtime port so a peer never collides with a developer's already-running
   * game. Ports held by live peers are skipped even if the probe would pass.
   *
   * The probe is TOCTOU by construction (see `ports.ts`), but allocation is
   * sequential and the window is sub-millisecond, and the failure mode is
   * benign — the child logs "could not listen" and the readiness wait below
   * reports it with that line attached, rather than the peer silently
   * half-existing. The DEFAULT runtime port refuses a held port outright rather
   * than reporting it after the fact — and as of 257 it waits too:
   * `godot_run_project` and `godot_run_managed` call `waitForRuntimeBridge` and
   * report `bridge_ready`, so the sentence that used to stand here — *the
   * default runtime port has no such readiness wait* — is no longer true.
   */
  private async allocatePorts(count: number): Promise<number[]> {
    const taken = new Set<number>([this.cfg.runtimePort, ...this.live().map((p) => p.port)]);
    const ports: number[] = [];
    const base = this.cfg.runtimePort + 1;
    for (let port = base; port < base + PORT_SCAN_SPAN && ports.length < count; port++) {
      if (taken.has(port)) continue;
      if (!(await portFree(this.cfg.runtimeHost, port))) continue;
      taken.add(port);
      ports.push(port);
    }
    if (ports.length < count) {
      throw new BridgeError(
        "no_free_port",
        `Could not find ${count} free loopback port(s) in ${base}–${base + PORT_SCAN_SPAN - 1}. ` +
          `Stop stale peers with runtime_peer_stop{all:true}, or set BREAKPOINT_RUNTIME_PORT to a quieter range.`,
      );
    }
    return ports;
  }

  /**
   * Poll a peer's bridge until it answers `ping`, or the deadline passes.
   *
   * 🔴 THE BODY MOVED TO `readiness.ts` AT 257, AND THE POINT IS NOT REUSE. The
   * comment in `allocatePorts` above named the default runtime port's missing
   * readiness wait as a property of the design — it was the defect
   * `run-project-returns-before-bridge`, open since 249. Two copies would have
   * let the default port's wait drift from the one this module has proven
   * against real peers since 1.21.0; one function cannot.
   */
  private async waitReady(client: BridgeClient, deadline: number): Promise<boolean> {
    return waitForBridge(client, deadline);
  }

  /**
   * Spawn `count` headless peers and wait until each answers `ping`.
   *
   * Waiting is part of the contract on purpose. Godot needs ~200 ms to bind, so
   * a tool that returned immediately would hand the caller peers its very next
   * call cannot reach — a flake in the one feature that exists to remove flakes.
   */
  async spawn(opts: {
    count: number;
    scene?: string;
    args?: string[];
    role?: string;
    timeoutMs?: number;
  }): Promise<Peer[]> {
    const liveCount = this.live().length;
    if (liveCount + opts.count > MAX_PEERS) {
      throw new BridgeError(
        "peer_limit",
        `${liveCount} peer(s) already live; spawning ${opts.count} more would exceed the ceiling of ${MAX_PEERS}. ` +
          `Stop some with runtime_peer_stop{all:true} first.`,
      );
    }

    // Constraint 2 — mint BEFORE the first spawn so no child reaches the addon's
    // unlocked mint branch. Never overwrites an existing secret.
    const secret = ensureProjectSecret(this.cfg.projectPath);
    if (!secret) {
      log("[peers] could not read or mint the project secret; peers will mint their own (see peers.ts)");
    }

    const ports = await this.allocatePorts(opts.count);
    const deadline = Date.now() + (opts.timeoutMs ?? 15000);
    const spawned: Entry[] = [];

    for (let i = 0; i < ports.length; i++) {
      const port = ports[i];
      const id = `peer-${++this.counter}`;
      const extraArgs = ["--headless", ...(opts.args ?? []), ...(opts.scene ? [opts.scene] : [])];
      const env: Record<string, string> = {
        BREAKPOINT_RUNTIME_PORT: String(port),
        BREAKPOINT_PEER_ID: id,
        BREAKPOINT_PEER_INDEX: String(i),
      };
      if (opts.role) env.BREAKPOINT_PEER_ROLE = opts.role;

      const managed = this.procs.run(this.cfg, extraArgs, env);
      const client = new BridgeClient(
        this.cfg.runtimeHost,
        port,
        this.cfg.runtimeTimeoutMs,
        `runtime peer ${id}`,
        "Is the peer still running? Peers are headless children of this server; a project that fails to load exits immediately.",
        // The FILE, not resolveBridgeSecret: the addon's _setup_auth() does not
        // read BREAKPOINT_*_SECRET, so a host-launched child authenticates with
        // whatever is on disk regardless of the host's env overrides.
        () => readProjectSecret(this.cfg.projectPath),
        // A peer's deadline and peer-noun are its own, and so is its ADDRESS: peers are
        // dialled on `cfg.runtimeHost`, so an unresolved-host remedy here must name
        // BREAKPOINT_RUNTIME_HOST and not the editor bridge's variable (265).
        "BREAKPOINT_RUNTIME_TIMEOUT_MS",
        `peer ${id}`,
        "BREAKPOINT_RUNTIME_HOST",
      );
      const entry: Entry = {
        info: { id, port, pid: managed.child.pid ?? null, role: opts.role ?? null, ready: false },
        client,
        managedId: managed.id,
        stopped: false,
      };
      this.peers.set(id, entry);
      spawned.push(entry);
    }

    await Promise.all(
      spawned.map(async (e) => {
        e.info.ready = await this.waitReady(e.client, deadline);
      }),
    );

    const notReady = spawned.filter((e) => !e.info.ready);
    if (notReady.length) {
      // 🔴 THE CAUSE IS COLLECTED, NOT JUST RENDERED (266). `m?.exited` decided one word
      // of the sentence and was then thrown away, so the hint below was pasted over both
      // measured causes and was FALSE on one of them — an absent runtime autoload does
      // not stop a process, it stops a process from ANSWERING. See exit-cause.ts.
      const causes: ReadinessCause[] = [];
      const detail = notReady
        .map((e) => {
          const m = this.procs.get(e.managedId);
          causes.push(m?.exited ? "exited" : "silent");
          const why = m?.exited ? describeExit(m.exitCode, m.exitSignal) : "never answered ping";
          const tail = this.procs.tail(e.managedId, 6).join(" | ");
          return `${e.info.id} on ${e.info.port}: ${why}${tail ? ` — ${tail}` : ""}`;
        })
        .join("; ");
      // Leave the failed peers registered rather than reaping them: the caller
      // can still runtime_peer_stop{all:true}, and a half-started peer that
      // vanished from the registry is harder to reason about than one that
      // reports why it is not ready.
      const hint = readinessHint(
        causes,
        `Is the Breakpoint MCP addon enabled in this project (it registers the runtime autoload)?`,
      );
      throw new BridgeError(
        "peer_not_ready",
        `${notReady.length} of ${spawned.length} peer(s) did not become ready. ${detail}.` +
          (hint ? ` ${hint}` : ""),
        readinessRemedy(causes),
      );
    }

    return spawned.map((e) => e.info);
  }

  /** Stop one peer (or all). Repeating is a no-op, so the tool is idempotent. */
  stop(id?: string, all = false): string[] {
    const targets = all ? [...this.peers.keys()] : id ? [id] : [];
    if (!all && id && !this.peers.has(id)) throw this.unknownPeer(id);
    const stopped: string[] = [];
    for (const t of targets) {
      const e = this.peers.get(t);
      if (!e) continue;
      try {
        e.client.close();
      } catch {
        /* ignore */
      }
      try {
        this.procs.get(e.managedId)?.child.kill();
      } catch {
        /* ignore */
      }
      e.stopped = true;
      stopped.push(t);
    }
    return stopped;
  }

  /** Shutdown hook — kill every peer child and close every peer socket. */
  stopAll(): void {
    try {
      this.stop(undefined, true);
    } catch {
      /* ignore */
    }
    this.procs.killAll();
  }
}

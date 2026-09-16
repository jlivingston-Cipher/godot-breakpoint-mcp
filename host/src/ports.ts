import net from "node:net";
import { certainStop, holderPhrase, holdersPhrase, isLoopbackHost, ownedPeers, whoHolds, type PortHolder } from "./port-holder.js";
import type { Config } from "./config.js";

/**
 * Loopback port probing, shared by the two callers that must not collide.
 *
 * It lives in its own module because `peers.ts` imports `ProcessRegistry` from
 * `tools/processes.ts`, so `processes.ts` importing the probe back out of
 * `peers.ts` would close an import cycle. Nothing here imports anything local.
 */

/**
 * Is `port` bindable on `host` right now?
 *
 * Probe-then-release is a TOCTOU window by construction: another process could
 * take the port between this answer and whoever acts on it. Every caller here
 * treats a `true` as "nothing is holding it as of now", never as a lease.
 *
 * SO_REUSEADDR (which Node sets by default) does NOT let two live listeners
 * share an address on Linux or macOS — that needs SO_REUSEPORT, which Node does
 * not set — so a bound port answers `false` rather than being silently joinable.
 */
export function portFree(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    try {
      srv.listen(port, host);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Which tool is asking. The danger is identical on every plane; the remedies and
 * the honest reading of the override are not, so only those vary.
 */
export type Launcher = "run" | "debugger";

/**
 * The refusal text shared by every tool that starts a game.
 *
 * All of them launch a project whose runtime autoload binds
 * `BREAKPOINT_RUNTIME_PORT` (`runtime_bridge.gd:74` reads it, `:79` binds it).
 * When that port is already held, the autoload's `listen()` returns non-OK, it
 * `push_error`s, and **the game keeps running without a bridge** — while the
 * host's runtime client, which dials the same fixed port, connects to whichever
 * process got there first. Every subsequent `runtime_*` call then answers
 * confidently about the WRONG process, and `ping` carries no pid or boot nonce
 * that could tell them apart.
 *
 * That is why this refuses rather than warns: a determinism feature returning a
 * correct-looking answer from the wrong game is worse than one that will not
 * start.
 *
 * Note what is deliberately NOT offered as a remedy: stopping peers. A peer can
 * never hold this port — `allocatePorts` seeds its `taken` set with
 * `cfg.runtimePort` and scans from `runtimePort + 1`, so whatever holds it is
 * something else. `runtime_spawn_peers` is named below as the way to drive
 * several games at once, which is true; `runtime_peer_stop` as a way to free
 * THIS port would not be, and a remedy that cannot work is worse than one fewer
 * suggestion.
 *
 * The `debugger` variant differs in one way that matters. A DAP session is
 * addressed by SESSION, not by port, so `dbg_*` keeps working perfectly against
 * a second game even with the port held — only `runtime_*` is corrupted. The
 * override is therefore a legitimate everyday choice on that plane rather than a
 * last resort, and the text says so instead of over-warning. Over-warning is how
 * a check earns the reputation that gets it disabled.
 *
 * What NEITHER variant may do is claim to know WHAT is holding the port. All the
 * probe learns is that something is. The holder may be a `godot_run_managed`
 * child (`godot_stop` clears it), a game already under the debugger (`dbg_attach`
 * reaches it), or a window the developer opened themselves (only they can close
 * it) — and the two planes contend for the SAME port, so a debugger refusal is
 * often about a run-plane holder and vice versa. An earlier draft of the
 * debugger text asserted "a debugger-launched game is owned by the editor, so no
 * tool here can stop it" and withheld `godot_stop` on that basis; it was wrong
 * whenever the holder was a managed child, which is the commonest case of all.
 * Both variants now list every remedy with the condition under which it applies,
 * and assert nothing about which one is live.
 *
 * 🆕 318 — THAT RULE STILL HOLDS FOR THE PROBE, AND THE PROBE IS NO LONGER THE ONLY READER.
 * `holder`, when a caller passes it, is `port-holder.ts`'s reading of the kernel's listener
 * table plus this server's own ledger of the children it started: a pid, a program name, and
 * whether `godot_run_managed` or `runtime_spawn_peers` owns it. With that in hand the message
 * names the holder and the one remedy that applies to it. Without it — lsof missing, a host
 * that is not loopback, Windows — every character below is what shipped before.
 */
export function portConflictMessage(
  host: string,
  port: number,
  launcher: Launcher = "run",
  holder?: PortHolder,
): string {
  const why =
    `${host}:${port} is already bound, so a game started now could not host the runtime bridge. ` +
    `Its autoload would fail to listen and keep running anyway, and every runtime_* call would ` +
    `silently address the process that already holds the port instead of the one you just started. `;

  // 🆕 318 — WHEN THE HOLDER IS KNOWN, SAY WHICH REMEDY IS LIVE. Everything below this branch
  // is the text that shipped, byte for byte, and it is still what a caller reads whenever
  // the lookup could not answer (no lsof, a non-loopback host, Windows).
  const known = holder === undefined ? undefined : holderClause(holder, launcher);
  if (known !== undefined) return why + known + overrideTail(launcher);

  if (launcher === "debugger") {
    return (
      why +
      `Deal with whatever is already holding it — which remedy applies depends on what it is: ` +
      `godot_stop if godot_run_managed started it, dbg_attach / cs_dbg_attach to debug the running ` +
      `game instead of launching a second one (that works only if it is already under the ` +
      `debugger — a plain godot_run_project or godot_run_managed game is not), or quit it in the ` +
      `game window or the editor. You can also point this server at a free port with ` +
      `BREAKPOINT_RUNTIME_PORT. Pass allow_port_conflict:true to launch anyway: breakpoints, ` +
      `stepping and variable inspection will all work normally, because a DAP session is addressed ` +
      `by session rather than by port — but every runtime_* call would go to the process holding ` +
      `the port, not to the game you just launched. To drive more than one game at once, use ` +
      `runtime_spawn_peers, which allocates a distinct port per peer.`
    );
  }

  return (
    why +
    `Stop the running game first — godot_stop if godot_run_managed started it, otherwise quit it in ` +
    `the game window or end the debug session that launched it (a detached godot_run_project game is ` +
    `not stoppable by any tool) — or point this server at a free port with ` +
    `BREAKPOINT_RUNTIME_PORT. Pass allow_port_conflict:true to start it anyway — reasonable only if ` +
    `you want the process for its console output or its side effects and will not use any runtime_* ` +
    `tool against it. To drive more than one game at once, use runtime_spawn_peers, which allocates ` +
    `a distinct port per peer.`
  );
}

/**
 * The sentence that replaces the conditional remedy list once `port-holder.ts` has named the
 * holder — or `undefined` when it could not, so the caller keeps the list.
 *
 * 🔴 ONLY A LEDGER MATCH NAMES A STOP TOOL. `godot_stop` is offered when the pid is one
 * `godot_run_managed` started and `runtime_peer_stop` when it is a peer; a Godot this server
 * did not start still gets the conditions that apply to it, narrowed to it, because whether
 * it is under the debugger is not something a pid says.
 */
function holderClause(holder: PortHolder, launcher: Launcher): string | undefined {
  const move = `point this server at a free port with BREAKPOINT_RUNTIME_PORT`;
  if (holder.kind === "unavailable") return undefined;
  if (holder.kind === "none_visible") {
    return (
      `No process this account can see is listening on it, so it belongs to another user or to the system, ` +
      `or it exited a moment ago — no tool here can stop it. Retry once, and if it is refused again, ${move}. `
    );
  }
  const hs = holder.holders;
  if (hs.length !== 1) {
    return `It is held by ${hs.length} processes — ${holdersPhrase(hs)}. Stop or quit each of them, or ${move}. `;
  }
  const h = hs[0];
  const held = `It is held by ${holderPhrase(h)}`;
  const stop = certainStop(h);
  if (stop) return `${held}: ${stop}, or ${move}. `;
  switch (h.owner.kind) {
    case "godot_run_project":
      return `${held}. No tool can stop a detached game, so quit it in its game window, or ${move}. `;
    case "this_server":
      return `${held}; no tool here can release it, so ${move}. `;
    case "godot":
      return launcher === "debugger"
        ? `${held}: if it is already under the debugger, dbg_attach / cs_dbg_attach reaches it instead of ` +
            `launching a second game; otherwise quit it in its window, or ${move}. `
        : `${held}: quit it in its window, or end the debug session that launched it, or ${move}. `;
    default:
      return `${held}, which no Breakpoint tool can stop: quit it, or ${move}. `;
  }
}

/** The override and the peers pointer — true whoever holds the port, so kept in every variant. */
function overrideTail(launcher: Launcher): string {
  const peers = `To drive more than one game at once, use runtime_spawn_peers, which allocates a distinct port per peer.`;
  if (launcher === "debugger") {
    return (
      `Pass allow_port_conflict:true to launch anyway: breakpoints, stepping and variable inspection will all ` +
      `work normally, because a DAP session is addressed by session rather than by port — but every runtime_* ` +
      `call would go to the process holding the port, not to the game you just launched. ` + peers
    );
  }
  return (
    `Pass allow_port_conflict:true to start it anyway — reasonable only if you want the process for its ` +
    `console output or its side effects and will not use any runtime_* tool against it. ` + peers
  );
}

/** One row of `breakpoint_ports`. */
export interface PortRow {
  name: string;
  host: string;
  port: number;
  state: "held" | "free" | "unknown";
  holders: Array<{
    pid: number;
    command: string;
    addresses: string[];
    /** `godot_run_managed` · `runtime_spawn_peers` · `godot_run_project` · `this_server` · `godot` · `other` */
    owner: string;
    /** The id the owning tool takes (`godot_stop` / `runtime_peer_stop`), when it has one. */
    id: string | null;
  }>;
  note: string | null;
}

/**
 * 🆕 318 — `breakpoint_ports`: every port this server dials, and who is on it.
 *
 * 🔴 TWO READERS, AND WHICH ONE DECIDED A ROW IS SAID. The listener table (`port-holder.ts`) is
 * the one that can name a holder; the bind probe (`portFree`) is the one that can tell "nobody
 * this account can see" apart from "nobody at all", which lsof prints identically. And the
 * bind probe has a blind spot the table does not, measured on macOS at 318: a node listener on
 * `*:<port>` or `[::1]:<port>` left `127.0.0.1:<port>` bindable. So a row is `held` whenever the
 * table lists a listener, and `free` only when the table lists nothing AND the bind succeeds —
 * or, where the table could not be read, when the bind succeeds and the note says that is all
 * that was asked.
 *
 * Only this machine's loopback is looked at. A host that names another machine is `unknown`,
 * because binding a remote address locally answers nothing about that machine.
 */
export async function readPorts(cfg: Config): Promise<PortRow[]> {
  const roster: Array<{ name: string; host: string; port: number }> = [
    { name: "editor-bridge", host: cfg.bridgeHost, port: cfg.bridgePort },
    { name: "runtime-bridge", host: cfg.runtimeHost, port: cfg.runtimePort },
    { name: "gdscript-lsp", host: cfg.lspHost, port: cfg.lspPort },
    { name: "gdscript-dap", host: cfg.dapHost, port: cfg.dapPort },
    ...ownedPeers().map((p) => ({ name: `peer:${p.id}`, host: cfg.runtimeHost, port: p.port })),
  ];
  return Promise.all(roster.map((r) => readPortRow(r, cfg.godotBin)));
}

async function readPortRow(r: { name: string; host: string; port: number }, godotBin: string): Promise<PortRow> {
  const base = { name: r.name, host: r.host, port: r.port };
  if (!isLoopbackHost(r.host)) {
    return { ...base, state: "unknown", holders: [], note: `${r.host} is not this machine's loopback, so nothing here can read its listeners` };
  }
  const holder = await whoHolds(r.host, r.port, godotBin);
  if (holder.kind === "found") {
    const holders = holder.holders.map((h) => ({
      pid: h.pid,
      command: h.command,
      addresses: h.addresses,
      owner: h.owner.kind,
      id: "id" in h.owner ? h.owner.id : null,
    }));
    return { ...base, state: "held", holders, note: null };
  }
  const bindable = await portFree(r.host, r.port);
  if (holder.kind === "none_visible") {
    return bindable
      ? { ...base, state: "free", holders: [], note: null }
      : { ...base, state: "held", holders: [], note: "held by a process this account cannot see (another user's, or the system's)" };
  }
  return bindable
    ? { ...base, state: "free", holders: [], note: `${holder.reason}; free means only that ${r.host}:${r.port} could be bound` }
    : { ...base, state: "held", holders: [], note: `the holder could not be named: ${holder.reason}` };
}

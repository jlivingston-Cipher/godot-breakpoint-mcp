import net from "node:net";

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
 */
export function portConflictMessage(host: string, port: number, launcher: Launcher = "run"): string {
  const why =
    `${host}:${port} is already bound, so a game started now could not host the runtime bridge. ` +
    `Its autoload would fail to listen and keep running anyway, and every runtime_* call would ` +
    `silently address the process that already holds the port instead of the one you just started. `;

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

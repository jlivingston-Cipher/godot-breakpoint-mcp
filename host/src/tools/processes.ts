import { spawn, type ChildProcess } from "node:child_process";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { log } from "../logger.js";
import { ok, failPath } from "./lsp-common.js";
import { resolveInsideProject } from "../paths.js";
import { portFree, portConflictMessage } from "../ports.js";
import { describeExit } from "../exit-cause.js";
import { waitForRuntimeBridge, notReadyRemedy } from "../readiness.js";

interface LogLine {
  seq: number;
  stream: "stdout" | "stderr";
  text: string;
}

interface Managed {
  id: string;
  child: ChildProcess;
  lines: LogLine[];
  seq: number;
  exited: boolean;
  exitCode: number | null;
  /**
   * The signal that ended the child, when one did.
   *
   * 🔴 NODE HANDED THIS TO US ON EVERY KILL SINCE THIS REGISTRY WAS WRITTEN AND IT WAS
   * ASSIGNED TO NOTHING (266). `child.on("exit", …)` is called with `(code, signal)`, and
   * the handler below declared one parameter — so a SIGKILLed child recorded
   * `exitCode: null` and `peers.ts` rendered that null into a sentence reading
   * `exited (code null)`. It is 265's "a default that compiles asks no question" spelled
   * as an argument nobody declared: omitting a parameter is not an edit anybody reviews.
   *
   * 🔵 Internal for now. `godot_process_output` still answers `exit_code` alone and gains
   * no `signal` key here — that is a wire addition to a shipped tool and is enqueued, not
   * folded into a PATCH. `describeExit` in `exit-cause.ts` is the only reader today.
   */
  exitSignal: NodeJS.Signals | null;
}

const LINE_CAP = 5000;

/**
 * Runs Godot as a MANAGED child (piped stdio) so the host captures ALL stdout/
 * stderr — including every `print()` and engine error — which the pure-GDScript
 * runtime bridge cannot hook. Complements runtime_get_log with transparent,
 * zero-instrumentation output capture.
 */
export class ProcessRegistry {
  private procs = new Map<string, Managed>();
  private counter = 0;

  /**
   * Spawn a managed Godot child. `env` is an OVERLAY on the inherited
   * environment, not a replacement: omitted (the `godot_run_managed` path) the
   * child inherits exactly as before, byte-identical to pre-F6 behaviour.
   *
   * The overlay is what makes multi-peer work at all — the runtime autoload
   * reads `BREAKPOINT_RUNTIME_PORT` from its environment
   * (`runtime_bridge.gd:74`), so N addressable peers is a per-child env
   * passthrough plus a port allocator, with no protocol, transport or handshake
   * change. See `peers.ts`.
   */
  run(cfg: Config, extraArgs: string[], env?: Record<string, string>): Managed {
    const id = `godot-${++this.counter}`;
    const child = spawn(cfg.godotBin, ["--path", cfg.projectPath, ...extraArgs], {
      cwd: cfg.projectPath,
      stdio: ["ignore", "pipe", "pipe"],
      ...(env ? { env: { ...process.env, ...env } } : {}),
    });
    const m: Managed = { id, child, lines: [], seq: 0, exited: false, exitCode: null, exitSignal: null };
    const ingest = (stream: "stdout" | "stderr") => (buf: Buffer | string) => {
      const text = typeof buf === "string" ? buf : buf.toString("utf8");
      for (const line of text.split(/\r?\n/)) {
        if (line.length === 0) continue;
        m.seq += 1;
        m.lines.push({ seq: m.seq, stream, text: line });
        if (m.lines.length > LINE_CAP) m.lines.shift();
      }
    };
    child.stdout?.on("data", ingest("stdout"));
    child.stderr?.on("data", ingest("stderr"));
    child.on("exit", (code, signal) => {
      m.exited = true;
      m.exitCode = code;
      m.exitSignal = signal;
      log(`managed process ${id} ${describeExit(code, signal)}`);
    });
    this.procs.set(id, m);
    return m;
  }

  get(id: string): Managed | undefined {
    return this.procs.get(id);
  }

  /**
   * The last `n` captured lines for a managed child, newest last. Used to
   * explain a peer that never bound its port — a project that fails to load
   * dies with the reason on stderr, and without this the caller only ever sees
   * "cannot reach the runtime bridge".
   */
  tail(id: string, n = 12): string[] {
    const m = this.procs.get(id);
    if (!m) return [];
    return m.lines.slice(-n).map((l) => l.text);
  }

  killAll(): void {
    for (const m of this.procs.values()) {
      try {
        m.child.kill();
      } catch {
        /* ignore */
      }
    }
  }
}

export function registerProcessTools(server: McpServer, cfg: Config): ProcessRegistry {
  const registry = new ProcessRegistry();

  server.registerTool(
    "godot_run_managed",
    {
      title: "Run project (managed, captured output)",
      description:
        "Run the project as a managed child process with captured stdout/stderr, so godot_output can read ALL print()/error output. " +
        "Returns a process id. Use this instead of godot_run_project when you want the game's console log. " +
        "WAITS until the game's runtime bridge answers ping and reports bridge_ready, exactly as godot_run_project " +
        "does — no runtime_* tool is reachable before it does. " +
        "Refuses if the runtime bridge port is already bound — the new game could not host the bridge, and every " +
        "runtime_* call would address the process already holding the port. Use runtime_spawn_peers to drive more " +
        "than one game at once.",
      inputSchema: {
        scene: z.string().optional().describe("Optional res:// scene to run"),
        allow_port_conflict: z
          .boolean()
          .optional()
          .describe(
            "Start even though the runtime bridge port is already bound (default false). The new game's runtime " +
              "bridge will NOT be reachable — use only when you want the process for its console output or side " +
              "effects and will not call any runtime_* tool against it.",
          ),
        wait_timeout_ms: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            "How long to wait for the runtime bridge to answer ping, in ms (default 15000, the runtime bridge's own " +
              "deadline). 0 returns as soon as the process is spawned, reporting bridge_ready false and " +
              "bridge_wait_ms 0 — waited-not-at-all, which a caller can tell apart from waited-and-lost.",
          ),
      },
    },
    // 🔴 `godot_run_project`'s TWIN, in a different file, with the same defect —
    // measured the same way and launching the same escaping argv. 1.42.0's lesson
    // ("the second call site is the interesting one") applied before the fact.
    //
    // 🔴 AND THE SAME LESSON AGAIN AT 257 FOR THE READINESS RACE. The queue row
    // `run-project-returns-before-bridge` names only `godot_run_project`; this
    // returned `running: true` at the same false moment and no row said so.
    async ({ scene, allow_port_conflict, wait_timeout_ms }) => {
      try {
        if (scene !== undefined) resolveInsideProject(scene, cfg.projectPath, "scene");
      } catch (err) { return failPath(err); }
      if (!allow_port_conflict && !(await portFree(cfg.runtimeHost, cfg.runtimePort))) {
        return { isError: true, content: [{ type: "text" as const, text: portConflictMessage(cfg.runtimeHost, cfg.runtimePort) }] };
      }
      const m = registry.run(cfg, scene ? [scene] : []);
      const readiness = await waitForRuntimeBridge(cfg, wait_timeout_ms ?? cfg.runtimeTimeoutMs);
      return ok({
        id: m.id,
        pid: m.child.pid ?? null,
        running: true,
        scene: scene ?? null,
        bridge_ready: readiness.ready,
        bridge_wait_ms: readiness.waited_ms,
        bridge_note: readiness.ready ? null : notReadyRemedy(cfg, readiness.waited_ms),
      });
    },
  );

  server.registerTool(
    "godot_output",
    {
      title: "Read managed process output",
      description: "Read captured console output for a managed process (from godot_run_managed). Use since_seq for incremental reads.",
      inputSchema: {
        id: z.string().describe("Process id from godot_run_managed"),
        since_seq: z.number().int().optional().describe("Only lines with seq greater than this (default 0)"),
        stream: z.enum(["stdout", "stderr", "both"]).optional().describe("Filter by stream (default both)"),
      },
    },
    async ({ id, since_seq, stream }) => {
      const m = registry.get(id);
      if (!m) return { isError: true, content: [{ type: "text", text: `No managed process with id "${id}"` }] };
      const since = since_seq ?? 0;
      const want = stream ?? "both";
      const lines = m.lines.filter((l) => l.seq > since && (want === "both" || l.stream === want));
      return ok({ id, exited: m.exited, exit_code: m.exitCode, latest_seq: m.seq, lines });
    },
  );

  server.registerTool(
    "godot_stop",
    {
      title: "Stop managed process",
      description: "Terminate a managed process started by godot_run_managed.",
      inputSchema: { id: z.string().describe("Process id from godot_run_managed") },
    },
    async ({ id }) => {
      const m = registry.get(id);
      if (!m) return { isError: true, content: [{ type: "text", text: `No managed process with id "${id}"` }] };
      try {
        m.child.kill();
      } catch {
        /* ignore */
      }
      return ok({ id, stopped: true });
    },
  );

  return registry;
}

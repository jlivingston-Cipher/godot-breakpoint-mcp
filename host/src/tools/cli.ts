import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { log } from "../logger.js";
import { registerTaskTool } from "../tasks.js";
import { ok, failPath } from "./lsp-common.js";
import { resolveInsideProject } from "../paths.js";
import { portFree, portConflictMessage } from "../ports.js";
import { runDoctorChecks } from "../cli/doctor.js";
import { waitForRuntimeBridge, notReadyRemedy } from "../readiness.js";

const execFileAsync = promisify(execFile);

interface CapturedResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** Run the Godot binary to completion, capturing stdout/stderr. */
async function runCaptured(
  cfg: Config,
  args: string[],
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<CapturedResult> {
  try {
    const { stdout, stderr } = await execFileAsync(cfg.godotBin, args, {
      cwd: cfg.projectPath,
      timeout: timeoutMs,
      maxBuffer: 32 * 1024 * 1024,
      signal,
    });
    return { code: 0, stdout, stderr, timedOut: false };
  } catch (err: unknown) {
    const e = err as { code?: number; killed?: boolean; signal?: string; stdout?: string; stderr?: string; message?: string };
    return {
      code: typeof e.code === "number" ? e.code : null,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? "",
      timedOut: Boolean(e.killed) && e.signal === "SIGTERM",
    };
  }
}

/** Launch the Godot binary detached (for long-lived editor/game processes). */
function launchDetached(cfg: Config, args: string[]): number | null {
  const child = spawn(cfg.godotBin, args, {
    cwd: cfg.projectPath,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return child.pid ?? null;
}

/** Truncate long output so a single tool result stays reasonable. */
function tail(s: string, max = 8000): string {
  if (s.length <= max) return s;
  return "…(truncated)…\n" + s.slice(s.length - max);
}

export function registerCliTools(server: McpServer, cfg: Config): void {
  server.registerTool(
    "godot_version",
    {
      title: "Godot version",
      description: "Return the version string of the configured Godot binary.",
      inputSchema: {},
    },
    async () => {
      const r = await runCaptured(cfg, ["--version"], 15000);
      return ok({ version: r.stdout.trim() || r.stderr.trim(), raw: r });
    },
  );

  server.registerTool(
    "godot_launch_editor",
    {
      title: "Launch editor",
      description:
        "Open the Godot editor for the configured project (detached). Needed before any editor_* bridge tool can be used.",
      inputSchema: {},
    },
    async () => {
      const pid = launchDetached(cfg, ["-e", "--path", cfg.projectPath]);
      log(`launched editor pid=${pid}`);
      return ok({ launched: true, pid, project: cfg.projectPath });
    },
  );

  server.registerTool(
    "godot_run_project",
    {
      title: "Run project",
      description:
        "Run the project (detached). Optionally start from a specific scene path (res://...). Returns the process id. " +
        "WAITS until the game's runtime bridge answers ping and reports bridge_ready — the game takes roughly half a " +
        "second to three seconds to bind it, and no runtime_* tool is reachable before it does. " +
        "Refuses if the runtime bridge port is already bound — the new game could not host the bridge, and every " +
        "runtime_* call would address the process already holding the port. Use runtime_spawn_peers to drive more " +
        "than one game at once.",
      inputSchema: {
        scene: z.string().optional().describe("Optional scene to run, e.g. res://levels/test.tscn"),
        allow_port_conflict: z
          .boolean()
          .optional()
          .describe(
            "Start even though the runtime bridge port is already bound (default false). The new game's runtime " +
              "bridge will NOT be reachable — use only when you want the process for its side effects and will not " +
              "call any runtime_* tool against it.",
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
    // 🔴 MEASURED by the LAUNCHED PROCESS'S OWN ARGV: `res://../example_evil/x.tscn`
    // produced `godot --path …/example res://../example_evil/x.tscn` and the game
    // ran it. The port check comes second — a scene that can never legally run
    // should not first claim the runtime port.
    //
    // 🔴 AND THE WAIT COMES LAST, WHICH IS THE WHOLE POINT (257). `portFree` above
    // asserts 9081 is FREE; this handler used to prove the bridge was not up and
    // then answer `running: true`, 566–3213 ms before it came up. The field was
    // true and the moment was false — see `readiness.ts`.
    async ({ scene, allow_port_conflict, wait_timeout_ms }) => {
      try {
        if (scene !== undefined) resolveInsideProject(scene, cfg.projectPath, "scene");
      } catch (err) { return failPath(err); }
      if (!allow_port_conflict && !(await portFree(cfg.runtimeHost, cfg.runtimePort))) {
        return { isError: true, content: [{ type: "text" as const, text: portConflictMessage(cfg.runtimeHost, cfg.runtimePort) }] };
      }
      const args = ["--path", cfg.projectPath];
      if (scene) args.push(scene);
      const pid = launchDetached(cfg, args);
      const readiness = await waitForRuntimeBridge(cfg, wait_timeout_ms ?? cfg.runtimeTimeoutMs);
      return ok({
        running: true,
        pid,
        scene: scene ?? null,
        bridge_ready: readiness.ready,
        bridge_wait_ms: readiness.waited_ms,
        bridge_note: readiness.ready ? null : notReadyRemedy(cfg, readiness.waited_ms),
      });
    },
  );

  registerTaskTool(
    server,
    "godot_export",
    {
      title: "Export project",
      description:
        "Headless export using an export preset. Runs to completion and returns exit code + logs. Can be slow — " +
        "exposed as an MCP task, so a task-aware client can poll it or cancel it while it runs.",
      inputSchema: {
        preset: z.string().describe("Export preset name as defined in export_presets.cfg"),
        output_path: z.string().describe("Output file path for the exported build"),
        debug: z.boolean().optional().describe("Export a debug build instead of release (default false)"),
        timeout_ms: z.number().int().positive().optional().describe("Max run time (default 600000)"),
      },
    },
    // 🔴 A WRITER THE `to_path` SWEEP MISSED ON A NAMING ACCIDENT. `output_path` goes
    // to the Godot CLI verbatim, and the CLI honours an escaping one: measured with
    // the equivalent `--export-pack "Linux/X11" ../example_evil/g165_pack.pck`, which
    // put a 306KB .pck outside the root. (The tool's own `--export-release` could not
    // be run to completion on the measuring Mac — no export templates installed — so
    // this row is CLI-measured plus source-verified passthrough, not tool-measured.)
    async ({ preset, output_path, debug, timeout_ms }, signal) => {
      try {
        resolveInsideProject(output_path, cfg.projectPath, "output_path");
      } catch (err) { return failPath(err); }
      const flag = debug ? "--export-debug" : "--export-release";
      const r = await runCaptured(
        cfg,
        ["--headless", "--path", cfg.projectPath, flag, preset, output_path],
        timeout_ms ?? 600000,
        signal,
      );
      return ok({
        preset,
        output_path,
        exit_code: r.code,
        timed_out: r.timedOut,
        stdout: tail(r.stdout),
        stderr: tail(r.stderr),
      });
    },
  );

  registerTaskTool(
    server,
    "godot_import",
    {
      title: "Import assets",
      description:
        "Headless (re)import of project assets. Runs to completion and returns exit code + logs. " +
        "Exposed as an MCP task, so a task-aware client can poll it or cancel it while it runs.",
      inputSchema: {
        timeout_ms: z.number().int().positive().optional().describe("Max run time (default 600000)"),
      },
    },
    async ({ timeout_ms }, signal) => {
      const r = await runCaptured(
        cfg,
        ["--headless", "--path", cfg.projectPath, "--import"],
        timeout_ms ?? 600000,
        signal,
      );
      return ok({ exit_code: r.code, timed_out: r.timedOut, stdout: tail(r.stdout), stderr: tail(r.stderr) });
    },
  );

  registerTaskTool(
    server,
    "godot_run_headless_script",
    {
      title: "Run headless script",
      description:
        "Run a GDScript in headless mode (godot --headless -s <script>). Use this to invoke test runners " +
        "(GdUnit4 / GUT) or any batch tool. Returns exit code + logs. Exposed as an MCP task, so a long test " +
        "run can be polled or cancelled while it is in flight.",
      inputSchema: {
        script_path: z.string().describe("Script to execute, e.g. res://addons/gdUnit4/bin/GdUnitCmdTool.gd"),
        args: z.array(z.string()).optional().describe("Extra CLI args passed after the script"),
        timeout_ms: z.number().int().positive().optional().describe("Max run time (default 600000)"),
      },
    },
    // 🔴🔴 THE SHARPEST ROW OF THE SESSION. `-s <script_path>` EXECUTES the file. A
    // script at `res://../example_evil/g165_run.gd` RAN — proven by the marker file it
    // wrote, not by the reply, which answered `exit_code: 0` for the real script AND
    // for one that did not exist. The reply channel carried zero information.
    async ({ script_path, args, timeout_ms }, signal) => {
      try {
        resolveInsideProject(script_path, cfg.projectPath, "script_path");
      } catch (err) { return failPath(err); }
      const r = await runCaptured(
        cfg,
        ["--headless", "--path", cfg.projectPath, "-s", script_path, ...(args ?? [])],
        timeout_ms ?? 600000,
        signal,
      );
      return ok({
        script_path,
        exit_code: r.code,
        timed_out: r.timedOut,
        stdout: tail(r.stdout),
        stderr: tail(r.stderr),
      });
    },
  );

  // 🔴 D4, CARRIED SINCE 205 — THE DIAGNOSTIC THE PERSON WHO NEEDS IT CANNOT REACH.
  // `breakpoint-mcp doctor` has shipped for many versions and answers exactly this
  // question. It is a TERMINAL command, and a user whose bridge is not running is
  // not in a terminal — they are in a conversation, watching an editor_* tool fail
  // with a connect error and no idea which of the addon, the editor, the port or
  // the secret is the one that is wrong. The assistant could not look. Now it can.
  //
  // Same `runDoctorChecks` the CLI drives, so the two can never disagree. It takes
  // the ALREADY-LOADED server Config rather than calling loadConfig() — `runDoctor`
  // mutates process.env.GODOT_PROJECT before loading, and doing that inside a tool
  // handler would reconfigure the live server out from under every other tool.
  server.registerTool(
    "breakpoint_doctor",
    {
      title: "Diagnose the setup",
      description:
        "Check this Breakpoint MCP setup end to end: the Godot binary, the editor addon's install and " +
        "enable state, the capability groups in force, and the editor/runtime/LSP/DAP bridges. Returns a " +
        "per-check status with a hint for anything wrong. Read-only — run it first when an editor_*, " +
        "runtime_*, gd_* or dbg_* tool fails to connect.",
      inputSchema: {
        require_live: z
          .boolean()
          .optional()
          .describe(
            "Treat an unreachable bridge as a failure rather than information (default false). True means " +
              "the EDITOR's three bridges — editor, GDScript LSP, GDScript DAP. The runtime bridge lives " +
              "inside the running game and is deliberately not implied; use live_level for that.",
          ),
        live_level: z
          .enum(["none", "editor", "runtime", "all"])
          .optional()
          .describe(
            "Which bridges this report insists on: none (default), editor (the three the editor brings " +
              "up), runtime (the one the running game brings up), all. Takes precedence over require_live.",
          ),
        include_csharp: z
          .boolean()
          .optional()
          .describe("Also probe OmniSharp / netcoredbg on PATH (the C# planes)"),
        timeout_ms: z.number().int().positive().optional().describe("Per-bridge connect timeout (default 1500)"),
      },
    },
    async ({ require_live, live_level, include_csharp, timeout_ms }) => {
      const report = await runDoctorChecks(cfg, {
        timeoutMs: timeout_ms ?? 1500,
        liveLevel: live_level ?? (require_live ? "editor" : "none"),
        includeCsharp: include_csharp ?? false,
      });
      // `failed` counted BOTH severities beside `ok: true` — the same sentence
      // the CLI summary used to print, in a field an agent reads instead of a
      // human. Split, so the number that decides the verdict is its own number.
      const failed = report.checks.filter((c) => c.status === "fail");
      return ok({
        ok: report.ok,
        failed: failed.length,
        required_failed: failed.filter((c) => c.severity === "required").length,
        informational_failed: failed.filter((c) => c.severity === "info").length,
        checks: report.checks,
      });
    },
  );
}

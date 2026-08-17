import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { DapClient, DapError } from "../dap.js";
import { toFsPath, resolveSourceFile, type PlaneWording } from "../paths.js";
import { gate } from "../confirm.js";
import { ok } from "./lsp-common.js";
import { portFree, portConflictMessage } from "../ports.js";

/**
 * How long `stop_on_entry: true` waits for the entry `stopped` event before
 * reporting that the adapter did not honour it. Short on purpose: Godot 4.7 ignores
 * `stopOnEntry` outright (measured — the game ran to completion and printed its
 * `_ready()` line), so this is the price of the honest answer on every launch, not a
 * rare timeout. An adapter that DOES honour it stops well inside the window.
 */
const ENTRY_STOP_WAIT_MS = 3000;

/** A refusal raised by a guard here, rendered verbatim rather than as a DAP error. */
class DapRefusal extends Error {
  /**
   * 🔴 162: the SAME marker `paths.ts`, `lsp-common.fail()` and `csdap.ts` already use.
   * Before this, dap.ts recognised a refusal only by `instanceof DapRefusal`, so a
   * refusal raised anywhere else — including by the shared guard this file now calls —
   * would have been rendered as `DAP error [error]: Refusing "…"`, sending the caller
   * to debug an adapter that was never asked. One refusal contract, four planes.
   */
  readonly refusal = true;
  constructor(
    message: string,
    readonly reason: string,
  ) {
    super(message);
    this.name = "DapRefusal";
  }
}

/**
 * This plane's shipped refusal wording, kept verbatim while the guard moved to
 * `paths.ts` (161 §8 item 5). `gdscript-dap-plane.integration.mjs` pins every string
 * here BY REASON — /outside the Godot project root/, /no such file/, /is not a file/,
 * and for the empty path additionally /project root/.
 *
 * 🔴 The escape check is deliberately WIDER than the `cs_dbg_*` plane's, and 162
 * measured both to confirm the difference is real rather than drift. `cs_dbg_launch`
 * documents overriding `program` to debug a DIFFERENT .NET program, whose sources
 * legitimately live outside the Godot C# project. `dbg_launch` has no such mainline:
 * its `scene` is `'main'`, `'current'` or a `res://` path, and Godot binds breakpoints
 * only to scripts in the project it runs — so an absolute path outside the root can
 * never bind here whichever way it is spelled, and all three forms stay anchored.
 * Absolute paths INSIDE the project stay legal; the probe uses that form and two
 * over-eager mutations exist to keep it working.
 */
const GD_DAP_PATHS: PlaneWording = {
  root: "the Godot project root",
  escapeHint:
    "Godot binds breakpoints only to scripts in the project it runs, so a breakpoint " +
    "there can never bind.",
  missingHint:
    "A breakpoint there can never bind, but it was previously answered exactly like " +
    "one on a real script.",
  emptyNote: " (an empty path resolves to the project root)",
};

/**
 * `dbg_launch` / `dbg_restart`'s `scene`, which is a path parameter that is not
 * called `path` — which is exactly why 162's sweep never reached it (163 §2).
 *
 * 🔴 MEASURED against a real 4.7 adapter before a line of this was written, because
 * the obvious rule would have broken two spellings that work. Every row below is a
 * launch that was actually performed and whose game console was read back over the
 * DAP `output` event, so "did it run" is the engine's answer, not an inference:
 *
 *   main · current · res://demo/demo.tscn · <abs inside>/demo/demo.tscn · uid://<known>
 *       -> the REQUESTED scene ran. The last three are the load-bearing ones: each
 *          ran a scene that is NOT the main scene, so they prove the spelling is
 *          honoured rather than silently falling back.
 *   res://../example_evil/… · ../example_evil/… · <root>_evil/… · /elsewhere/…
 *       -> 🔴 NOTHING ran, and the session stayed `running` with a live, sceneless
 *          game process. `dbg_stack_trace` then answered `{"frames":[]}` — BYTE
 *          IDENTICAL to a healthy running session. The caller could not find out.
 *   ""  -> 🔴 nothing ran, NO game process existed at all, session still `running`.
 *   /etc/passwd · res://NoSuchFile.tscn · res://tests (a directory)
 *       -> nothing ran; the session terminated a moment later, so those at least
 *          announced themselves.
 *
 * So NOTHING ESCAPES — Godot never ran an out-of-project scene, whichever way it was
 * spelled. The defect is not containment, it is that `dbg_launch` answered
 * `{"state":"running"}` for every one of them. That is the same shape as the
 * `dbg_set_breakpoints` defect above it in this file — an answer that cannot
 * distinguish "armed" from "can never bind" — one tool over on the same plane.
 *
 * 🔴 uid:// IS EXEMPT AND THAT EXEMPTION IS MEASURED, NOT ASSUMED. Godot 4 writes a
 * UID into every scene header, and `uid://bq3k7x2yv8n1a` RAN the scene it names. A
 * uid names a project resource through the engine's own map, never a filesystem
 * location, so it cannot express an escape — and requiring it to exist on disk would
 * refuse a working spelling to fix a broken one. That is precisely the mistake 162
 * §5 D2 caught itself about to make on `csdap`.
 *
 * 🔴 WHAT THIS DELIBERATELY DOES NOT FIX, because it was measured and is a different
 * defect: an UNKNOWN uid (`uid://zzzzzzzzzzzzz`) silently ran the MAIN scene while
 * the tool echoed the uid back. Resolving that needs the engine's UID map, which the
 * host does not have. Recorded in the description and the handoff rather than guessed
 * at. Likewise `res://player.gd` — a real file inside the root that is not a scene —
 * stays legal here and terminates the session, which at least announces itself.
 */
const GD_DAP_SCENE: PlaneWording = {
  root: "the Godot project root",
  escapeHint:
    "Godot runs scenes from the project it launched, so a scene outside the root never " +
    "loads: measured, the game starts with no scene and the session reports `running` " +
    "forever. Pass 'main', 'current', a scene inside the project, or a uid:// reference.",
  missingHint:
    "The adapter accepts the launch and nothing runs, so this was previously reported " +
    "as a started session.",
  emptyNote: " (an empty scene resolves to the project root)",
};

/** Scene spellings the adapter resolves itself; neither names a file. */
const SCENE_SENTINELS = new Set(["main", "current"]);

// How long step/continue wait for the program to settle (hit a breakpoint,
// finish a step, or terminate) before returning. On timeout the tool reports
// the current state — e.g. `continue` with no further breakpoint stays running.
const RESUME_WAIT_MS = 15000;

function fail(err: unknown) {
  // A refusal this file raised is the host's own answer — rendering it as
  // `DAP error [...]` would send the caller off to debug an adapter that was never
  // asked. Same distinction lsp-common.fail() already draws for the LSP planes.
  const e = err as { command?: string; message?: string; refusal?: boolean };
  if (err instanceof DapRefusal || e?.refusal) {
    return { isError: true as const, content: [{ type: "text" as const, text: e.message ?? String(err) }] };
  }
  // An adapter can answer a failure with an EMPTY message (netcoredbg did, on
  // setVariable). `?? String(err)` only covers an ABSENT one, so the whole answer
  // became a label and a colon.
  const detail = e.message && e.message.trim() !== "" ? e.message : String(err);
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: `DAP error [${e.command ?? "error"}]: ${detail}` }],
  };
}

/**
 * True when `err` is a DAP request that hit its own request deadline (as opposed to an
 * adapter-reported failure or a dropped connection). Used to turn the setVariable /
 * evaluate hangs on advertised-but-unimplemented Godot builds into a clear message.
 */
function isDapTimeout(err: unknown): err is DapError {
  return err instanceof DapError && /timed out after/.test(err.message);
}

/**
 * 🔴 The modifier feature-detection lives in `dap.ts` (the client), NOT here, and that
 * is the fix this release carries. It was here, at SET time, where `dap.capabilities`
 * is null for every breakpoint buffered before launch — which is the documented and
 * ordinary way to arm one. The guard was correct and unreachable: measured live, a
 * pre-launch `conditions: ["counter < 0"]` was sent verbatim to an adapter that ignores
 * it, the breakpoint halted every frame, and the result carried no warning at all.
 * Detection now happens where the modifiers go on the wire, so every path gets it.
 */
const warnDropped = (dropped: string[]): string =>
  `The connected Godot debug adapter does not support ${dropped.join(", ")} on breakpoints (it advertises ` +
  `${dropped.length > 1 ? "them" : "it"} unsupported), so ${dropped.length > 1 ? "they were" : "it was"} dropped — ` +
  `the affected breakpoint(s) will halt unconditionally.`;

export function registerDapTools(server: McpServer, dap: DapClient, cfg: Config): void {
  /**
   * Refuse when no launch/attach the adapter accepted is in force.
   *
   * 🔴 Measured on a client that had never launched anything: `dbg_continue` and
   * `dbg_step` answered `isError:false {"state":"running"}`, `dbg_stack_trace`
   * answered `{"frames":[]}` and `dbg_scopes` `{"scopes":[]}` — all four
   * indistinguishable from the same calls against a real session. Worse,
   * `resume()`'s optimistic `state = "running"` MEANT THE FIRST SUCH CALL LEFT THE
   * CLIENT LOOKING LIVE, so everything after it read as a genuine session. Only
   * `dbg_restart` refused, and only because it happens to read `lastStartMode`.
   */
  const requireSession = (tool: string): void => {
    if (dap.hasSession) return;
    throw new DapRefusal(
      `${tool} needs a debug session: call dbg_launch or dbg_attach first. ` +
        `There is none, so any state, frame or scope reported here would be invented — ` +
        `this call previously answered as if the program were running.`,
      "no_session",
    );
  };

  /**
   * Refuse when the session is live but the program is not AT A STOP.
   *
   * 🔴 THE HALF `requireSession` COULD NOT SEE, AND IT IS THE SAME MISTAKE ONE LAYER IN.
   * That guard asks whether a launch succeeded; every tool below then asked the adapter
   * for a frame. A session existing is a proxy for a frame existing, and the proxy stops
   * holding the instant the program runs on. Measured against a live 4.7 adapter with a
   * launched session and nothing stopped — nine tools, eight different answers, none of
   * them "the program is running":
   *
   * ```
   * dbg_stack_trace     4ms   {"frames":[]}                    empty success
   * dbg_scopes          8ms   {"scopes":[]}                    empty success
   * dbg_variables      10ms   DAP error [variables]: unknown   the adapter's word for it
   * dbg_watch        5,016ms  error:"timeout" per expression   a fabricated cause
   * dbg_evaluate     5,019ms  DAP error [evaluate]: timeout    a fabricated cause
   * dbg_set_variable 8,004ms  "this Godot build (e.g. 4.3)…"   blames the user's engine
   * dbg_step        15,004ms  {"state":"running"}              a success that waited
   * dbg_continue    15,003ms  {"state":"running"}              a success that waited
   * ```
   *
   * 🔴 RAISED BEFORE THE ADAPTER ROUND TRIP, which is most of the point: that column of
   * timeouts is ~48 s the caller waited to be told nothing, for a question `dap.isStopped`
   * answers in none. `dbg_launch`'s scene guard is placed the same way and for the same
   * reason. The refusal names the state it read rather than the state it assumed — 260's
   * rule — and names the two ways to reach a stop, because "not stopped" is not itself an
   * instruction.
   */
  const requireStopped = (tool: string): void => {
    if (dap.isStopped) return;
    throw new DapRefusal(
      `${tool} needs the program stopped at a breakpoint: the debug session is live but the program is ${dap.state}. ` +
        `Arm a line with dbg_set_breakpoints and trigger that code path, or step from a stop you already have — ` +
        `nothing here can be read from a program that is still running.`,
      "not_stopped",
    );
  };

  /**
   * Report, on a launch/attach result, any breakpoint modifier the handshake dropped
   * when it applied the buffered breakpoints.
   *
   * 🔴 This is the other half of the buffered-modifier fix. `dbg_set_breakpoints` can
   * only say "deferred" before a session exists; this is where the caller finds out what
   * actually happened. Without it the honest "deferred" answer would have no follow-up
   * and the caller would still be left guessing.
   */
  const reportDroppedModifiers = (result: Record<string, unknown>): void => {
    const dropped = dap.droppedBreakpointModifiers();
    if (!dropped.length) return;
    result.unsupported_modifiers = dropped;
    // Never clobber a warning the caller needs more (stop_on_entry's); append.
    const note = `Buffered breakpoint modifiers were applied during this handshake: ${warnDropped(dropped)}`;
    result.warning = typeof result.warning === "string" && result.warning.length > 0 ? `${result.warning} ${note}` : note;
  };

  /**
   * Resolve a breakpoint source, refusing one that can never bind.
   *
   * 🔴 Measured: `res://NoSuchFile.gd`, `res://tests` (a DIRECTORY) and `""` — which
   * resolves to the project root — each answered `{"buffered":true,"breakpoints":[]}`
   * with `isError:false`, so a caller could not tell an armed breakpoint from one
   * that can never bind. `res://../../../etc/passwd` resolved to `/private/etc/passwd`
   * and was accepted too.
   *
   * 🔴 THE ESCAPE CHECK IS DELIBERATELY WIDER THAN THE `cs_dbg_*` PLANE'S, and the
   * difference is the point rather than an inconsistency. `cs_dbg_launch` documents
   * overriding `program` to debug a DIFFERENT .NET program, whose sources
   * legitimately live outside the Godot project, so #166 kept an absolute path
   * elsewhere legal. `dbg_launch` has no such mainline: its `scene` is `'main'`,
   * `'current'` or a `res://` path, and Godot binds breakpoints only to scripts in
   * the project it is running. An absolute path outside the root can never bind here
   * whichever way it is spelled, so ALL THREE FORMS are anchored to the root.
   * Absolute paths INSIDE the project stay legal — that form is documented, the probe
   * uses it, and two over-eager mutations exist to keep it working.
   *
   * The comparison is against `root + path.sep`, never a bare `startsWith(root)`:
   * the latter accepts a sibling directory that merely shares the root's name prefix.
   */
  const guardSource = (p: string): string => resolveSourceFile(p, cfg.projectPath, GD_DAP_PATHS);

  /**
   * `scene` for `dbg_launch` / `dbg_restart`. See GD_DAP_SCENE for the measurement.
   *
   * 🔴 Returns the ORIGINAL SPELLING, never the resolved path. `res://demo/demo.tscn`
   * and `<abs>/demo/demo.tscn` were both measured running the demo scene, so what
   * reaches the adapter must not change — this guard only ever ADDS a refusal, which
   * is what makes it behaviour-preserving on every spelling that already worked.
   *
   * 🔴 It also refuses BEFORE the port check and before the transport, deliberately:
   * that is the property 162 §2 identified as making a guard measurable with no
   * backend at all, and it is why the unit tests below need no editor. The one
   * behaviour change is a call that has BOTH a bad scene and a bound bridge port —
   * it now names the scene instead of the port. That is the more actionable of the
   * two answers, and it is pinned by a test rather than left to chance.
   */
  const guardScene = (s: string | undefined): void => {
    if (s === undefined) return;
    if (SCENE_SENTINELS.has(s)) return;
    if (s.startsWith("uid://")) return;
    resolveSourceFile(s, cfg.projectPath, GD_DAP_SCENE);
  };

  server.registerTool(
    "dbg_launch",
    {
      title: "Launch debug session",
      description:
        "Start the game under the debugger. scene may be 'main', 'current', a scene inside the project " +
        "(res://, or an absolute path inside the root), or a uid:// reference. " +
        "Refuses a scene outside the project root, one that does not exist, and an empty scene: measured on 4.7, " +
        "the adapter ACCEPTS all of those and nothing runs — an out-of-project scene leaves a live sceneless game " +
        "and a session that reports 'running' forever. A uid:// the project does not know is the one case still " +
        "not caught: Godot silently runs the main scene instead, and resolving it needs the engine's UID map. " +
        "Any breakpoints set beforehand are applied during the handshake. " +
        "Refuses if the debug adapter rejects the launch (e.g. Godot answers 'wrong_path' when the configured " +
        "project path is not the one the editor has open) rather than reporting a session that never started. " +
        "With stop_on_entry the result carries stop_on_entry_honored: Godot's adapter does not implement " +
        "stopOnEntry, so it reports false plus a warning instead of a bare 'running'. " +
        "Refuses if the runtime bridge port is already bound — the new game could not host the bridge, so " +
        "runtime_* would address the process already holding the port. Clear the holder (godot_stop, or quit " +
        "it), or dbg_attach onto it if it is already under the debugger, or pass allow_port_conflict " +
        "(dbg_* is unaffected either way; only runtime_* is).",
      inputSchema: {
        scene: z
          .string()
          .optional()
          .describe("'main' (default), 'current', res://scene.tscn, or uid://… — must be inside the project"),
        stop_on_entry: z.boolean().optional().describe("Break at entry (default false)"),
        allow_port_conflict: z
          .boolean()
          .optional()
          .describe(
            "Launch even though the runtime bridge port is already bound (default false). Breakpoints and " +
              "stepping still work — a DAP session is addressed by session, not by port — but runtime_* " +
              "tools would talk to the process holding the port, not to this game.",
          ),
      },
    },
    async ({ scene, stop_on_entry, allow_port_conflict }) => {
      // Before the port check and before the transport — see guardScene.
      try { guardScene(scene); } catch (err) { return fail(err); }
      if (!allow_port_conflict && !(await portFree(cfg.runtimeHost, cfg.runtimePort))) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: portConflictMessage(cfg.runtimeHost, cfg.runtimePort, "debugger") }],
        };
      }
      try {
        const { entryStopSeen } = await dap.start(
          "launch",
          { project: cfg.projectPath, scene: scene ?? "main", stopOnEntry: stop_on_entry ?? false },
          stop_on_entry ? ENTRY_STOP_WAIT_MS : 0,
        );
        const result: Record<string, unknown> = { session_id: "godot", state: dap.state, scene: scene ?? "main" };
        if (stop_on_entry) {
          // 🔴 Measured on Godot 4.7: stopOnEntry is ignored outright — the game ran to
          // completion and printed its _ready() line while the tool answered a bare
          // `running`, which reads exactly like a launch that simply had not stopped
          // YET. Say which one it is.
          result.stop_on_entry_honored = entryStopSeen;
          if (!entryStopSeen) {
            result.warning =
              `The connected Godot debug adapter did not stop at entry within ${ENTRY_STOP_WAIT_MS}ms ` +
              `and the program is running. Godot's adapter does not implement stopOnEntry — set a ` +
              `breakpoint with dbg_set_breakpoints before dbg_launch to land a stop.`;
          }
        }
        reportDroppedModifiers(result);
        return ok(result);
      } catch (err) { return fail(err); }
    },
  );

  // NOT port-gated, deliberately: attaching to the game that already holds the
  // port is the REMEDY dbg_launch's refusal points at. Gating it would close the
  // exit and leave the caller with nowhere to go.
  server.registerTool(
    "dbg_attach",
    {
      title: "Attach debug session",
      description:
        "Attach to an already-running Godot debug session. Refuses if the adapter rejects the attach — " +
        "Godot answers 'not_running' when nothing is running — instead of reporting state 'running' for a " +
        "session that never started.",
      inputSchema: {
        address: z.string().optional().describe("Address of the running game (default 127.0.0.1)"),
        port: z.number().int().optional().describe("Remote debug port"),
      },
    },
    async ({ address, port }) => {
      try {
        await dap.start("attach", { address: address ?? "127.0.0.1", port });
        const result: Record<string, unknown> = { session_id: "godot", state: dap.state };
        reportDroppedModifiers(result);
        return ok(result);
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_set_breakpoints",
    {
      title: "Set breakpoints",
      description:
        "Set (replace) the breakpoints for a source file. Applied immediately if a session is running, else buffered until launch. " +
        "Refuses a source that can never bind: a missing file, a directory, an empty path (which resolves to the project root), " +
        "or a path resolving outside the Godot project root — Godot binds breakpoints only to scripts in the project it runs, so " +
        "unlike cs_dbg_set_breakpoints an absolute path outside the root is refused here too. " +
        "Feature-detected: the per-line conditions / hit_conditions / log_messages modifiers are only sent when the connected adapter " +
        "advertises support (supportsConditionalBreakpoints / supportsHitConditionalBreakpoints / supportsLogPoints). On an adapter that " +
        "advertises them unsupported (Godot advertises all three false and IGNORES them, so the breakpoint would halt unconditionally) the " +
        "modifier is dropped and the result includes `unsupported_modifiers` plus a `warning`. Detection happens when the breakpoints are " +
        "applied, so it covers buffered ones too: setting modifiers before a session exists returns `modifier_detection: \"deferred\"` with a " +
        "warning, and dbg_launch then reports the `unsupported_modifiers` actually dropped during the handshake.",
      inputSchema: {
        path: z.string().describe("Script path (res://..., absolute, or project-relative)"),
        lines: z.array(z.number().int().positive()).describe("1-based line numbers"),
        conditions: z.array(z.string().nullable()).optional().describe("Optional per-line condition expressions (aligned to lines, use null to skip a line); break only when the expression is true"),
        hit_conditions: z.array(z.string().nullable()).optional().describe("Optional per-line hit expressions aligned to lines, e.g. '>3' or '%5' — break based on hit count (null to skip)"),
        log_messages: z.array(z.string().nullable()).optional().describe("Optional per-line log messages aligned to lines; a message turns that breakpoint into a LOGPOINT (logs and continues, never halts). {expr} interpolates (null to skip)."),
      },
    },
    async ({ path, lines, conditions, hit_conditions, log_messages }) => {
      try {
        const fsPath = guardSource(path);
        // The client feature-detects and drops at apply time — on this call when a session
        // is live, during the handshake when the breakpoint is buffered.
        const before = new Set(dap.droppedBreakpointModifiers());
        const body = await dap.setBreakpoints(fsPath, lines, conditions, hit_conditions, log_messages);
        const verified = Array.isArray(body["breakpoints"])
          ? (body["breakpoints"] as Array<{ line?: number; verified?: boolean }>).map((b) => ({ line: b.line ?? 0, verified: Boolean(b.verified) }))
          : [];
        const result: Record<string, unknown> = { path: fsPath, buffered: body["buffered"] === true, breakpoints: verified };
        const dropped = dap.droppedBreakpointModifiers().filter((d) => !before.has(d));
        if (dropped.length) {
          result.unsupported_modifiers = dropped;
          result.warning = warnDropped(dropped);
        } else if (body["modifier_detection_deferred"] === true) {
          // 🔴 Buffered with modifiers and no session yet: the honest answer is "not yet
          // known", never silence. dbg_launch reports what was actually dropped.
          result.modifier_detection = "deferred";
          result.warning =
            "These breakpoints are buffered until launch, so the adapter has not advertised its capabilities yet and the " +
            "conditions / hit_conditions / log_messages modifiers COULD NOT be feature-detected. Godot ignores modifiers it " +
            "does not support, which makes such a breakpoint halt unconditionally. dbg_launch reports `unsupported_modifiers` " +
            "for whatever is dropped when these are applied.";
        }
        return ok(result);
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_continue",
    {
      title: "Continue",
      description:
        "Resume execution and wait for the program to settle again (next breakpoint or termination). " +
        "Returns the resulting state; if it runs on with no further breakpoint, reports state 'running'. " +
        "Requires a stop; a running program is refused (`not_stopped`).",
      inputSchema: {},
    },
    async () => {
      try {
        requireSession("dbg_continue");
        requireStopped("dbg_continue");
        const r = await dap.resume("continue", { threadId: dap.threadId() }, RESUME_WAIT_MS);
        return ok({ state: r.state, stopped_reason: r.reason });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_step",
    {
      title: "Step",
      description:
        "Step execution: 'over' (next), 'in' (stepIn), or 'out' (stepOut), then wait for the step to land. " +
        "Returns the resulting state and stop reason. Note: stepOut may be unsupported on older Godot builds. " +
        "Requires a stop; a running program is refused (`not_stopped`).",
      inputSchema: { kind: z.enum(["in", "over", "out"]).describe("Step kind") },
    },
    async ({ kind }) => {
      try {
        requireSession("dbg_step");
        requireStopped("dbg_step");
        const command = kind === "in" ? "stepIn" : kind === "out" ? "stepOut" : "next";
        const r = await dap.resume(command, { threadId: dap.threadId() }, RESUME_WAIT_MS);
        return ok({ state: r.state, stopped_reason: r.reason });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_stack_trace",
    {
      title: "Stack trace",
      description:
        "Return the current call stack. Requires a stop; a running program is refused (`not_stopped`) rather than " +
        "answered with the empty frame list it used to return.",
      inputSchema: { levels: z.number().int().positive().optional().describe("Max frames (default 20)") },
    },
    async ({ levels }) => {
      try {
        requireSession("dbg_stack_trace");
        requireStopped("dbg_stack_trace");
        const body = await dap.request("stackTrace", { threadId: dap.threadId(), startFrame: 0, levels: levels ?? 20 });
        const frames = Array.isArray(body["stackFrames"])
          ? (body["stackFrames"] as Array<{ id?: number; name?: string; source?: { path?: string; name?: string }; line?: number }>).map((f) => ({
              id: f.id ?? 0, name: f.name ?? "", source: f.source?.path ?? f.source?.name ?? "", line: f.line ?? 0,
            }))
          : [];
        return ok({ frames });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_scopes",
    {
      title: "Scopes",
      description:
        "Return the variable scopes (Locals, Members, Globals) for a stack frame. Requires a stop; a running program is " +
        "refused (`not_stopped`) rather than answered with an empty list.",
      inputSchema: { frame_id: z.number().int().describe("Frame id from dbg_stack_trace") },
    },
    async ({ frame_id }) => {
      try {
        requireSession("dbg_scopes");
        requireStopped("dbg_scopes");
        const body = await dap.request("scopes", { frameId: frame_id });
        const scopes = Array.isArray(body["scopes"])
          ? (body["scopes"] as Array<{ name?: string; variablesReference?: number }>).map((s) => ({ name: s.name ?? "", variables_ref: s.variablesReference ?? 0 }))
          : [];
        return ok({ scopes });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_variables",
    {
      title: "Variables",
      description:
        "List variables under a scope or a complex value (via its variables_ref). Requires a stop (`not_stopped`) — a " +
        "reference is only valid within the stop that issued it.",
      inputSchema: { variables_ref: z.number().int().describe("variablesReference from dbg_scopes or a parent variable") },
    },
    async ({ variables_ref }) => {
      try {
        requireSession("dbg_variables");
        requireStopped("dbg_variables");
        const body = await dap.request("variables", { variablesReference: variables_ref });
        const variables = Array.isArray(body["variables"])
          ? (body["variables"] as Array<{ name?: string; value?: string; type?: string; variablesReference?: number }>).map((v) => ({
              name: v.name ?? "", value: v.value ?? "", type: v.type ?? "", variables_ref: v.variablesReference ?? 0,
            }))
          : [];
        return ok({ variables });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_evaluate",
    {
      title: "Evaluate expression",
      description:
        "Evaluate a GDScript expression in the context of a stopped frame. DESTRUCTIVE: arbitrary code execution — confirm with the user and keep this capability gated. " +
        "Requires a stop (`not_stopped`), checked before the confirmation prompt.",
      inputSchema: {
        expression: z.string().describe("GDScript expression to evaluate"),
        frame_id: z.number().int().optional().describe("Frame id (from dbg_stack_trace); omit for the top frame"),
        confirm: z.boolean().optional().describe("Auto-approve this arbitrary-code evaluation (skip the confirmation prompt)"),
      },
    },
    async ({ expression, frame_id, confirm }) => {
      try {
        // Before the gate on purpose: the old order prompted the operator to approve
        // arbitrary code execution against a session that had never been started.
        // 🔴 And before it for the second reason too — a program that is running has no
        // frame to evaluate in, so the prompt was asking the operator to approve code
        // execution that could only end in the adapter's 5 s silence.
        requireSession("dbg_evaluate");
        requireStopped("dbg_evaluate");
        const blocked = await gate(server, confirm, `Evaluate expression in the running game: ${expression}`);
        if (blocked) return blocked;
        // Bound the evaluate request to a short deadline instead of the full dapTimeoutMs:
        // a compliant adapter answers a repl evaluate near-instantly, so a non-response means
        // the adapter is not going to answer — fail fast rather than hang.
        let body: Record<string, unknown>;
        try {
          body = await dap.request("evaluate", { expression, frameId: frame_id, context: "repl" }, cfg.dapEvaluateTimeoutMs);
        } catch (err) {
          if (isDapTimeout(err)) {
            return {
              isError: true as const,
              content: [{ type: "text" as const, text: `The debug adapter did not answer the evaluate request within ${cfg.dapEvaluateTimeoutMs}ms — no result was returned. The debug session is still alive; use dbg_variables / dbg_watch to inspect state.` }],
            };
          }
          throw err;
        }
        return ok({ result: String(body["result"] ?? ""), type: String(body["type"] ?? ""), variables_ref: (body["variablesReference"] as number) ?? 0 });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_watch",
    {
      title: "Watch expressions",
      description:
        "Manage a persistent set of watch expressions and evaluate them in the current stopped frame. " +
        "Pass `add`/`remove`/`clear` to mutate the set (all optional), then every current watch is re-evaluated " +
        "and returned. Call with no mutation args to just re-read the watches after a step/continue. Expressions " +
        "are evaluated in DAP `watch` context (intended to be side-effect-free), so this is not gated; the results " +
        "are only meaningful while the program is stopped at a breakpoint.",
      inputSchema: {
        add: z.array(z.string()).optional().describe("Expressions to add to the watch set"),
        remove: z.array(z.string()).optional().describe("Expressions to remove from the watch set"),
        clear: z.boolean().optional().describe("Clear all watches before applying add (default false)"),
        frame_id: z.number().int().optional().describe("Frame id from dbg_stack_trace; omit for the top frame"),
      },
    },
    async ({ add, remove, clear, frame_id }) => {
      try {
        requireSession("dbg_watch");
        // 🔴 THE ONE TOOL HERE THAT IS NOT REFUSED WHEN THE PROGRAM RUNS, ON PURPOSE (262 §1).
        // `dbg_watch` is two things at once: it MANAGES a persistent set and it evaluates that
        // set. §10 B step 6's documented use — "dbg_watch for an expression across stops" — is
        // to arm the set once and re-read it at each stop, so refusing the mutation while the
        // program runs would refuse the workflow the guide teaches. The set change is applied;
        // only the VALUES are unavailable, and the entry's own `error` field says which — the
        // shape already carries a per-expression reason, so this needs no new key and, unlike
        // what it replaces, costs no adapter round trip.
        if (clear) dap.clearWatches();
        if (remove && remove.length) dap.removeWatches(remove);
        if (add && add.length) dap.addWatches(add);
        if (!dap.isStopped) {
          // 🔴 What this replaces was worse than empty: each expression came back with
          // `error: "timeout"` after the adapter sat on it for the full evaluate deadline —
          // 5 s of waiting for a fabricated cause. The program was never stopped; the adapter
          // had nothing to answer from and said so by saying nothing.
          return ok({
            watches: dap.listWatches().map((expression) => ({
              expression,
              value: "",
              type: "",
              error: `not stopped (${dap.state}) — a watch is evaluated in a stopped frame, so values arrive at the next stop`,
            })),
          });
        }
        // Bound each watch's evaluate to the short deadline (mirrors dbg_evaluate): a watch
        // expression the adapter never answers fails fast on that entry instead of hanging the
        // full dapTimeoutMs (20 s) at every stop, while other watches still resolve normally.
        const watches = await dap.evaluateWatches(frame_id, cfg.dapEvaluateTimeoutMs);
        return ok({ watches });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_set_exception_breakpoints",
    {
      title: "Set exception breakpoints",
      description:
        "Enable (replace) the debugger's exception breakpoint filters so execution halts when a matching error/exception is thrown " +
        "(DAP setExceptionBreakpoints). Pass the filter IDs to enable; call with no filters (or []) to clear them. The result echoes the " +
        "active filters and lists `available_filters` — the exception filters the connected adapter actually advertises. " +
        "Requires a running debug session. Not gated (it only configures the debugger). " +
        "Feature-detected: on an adapter that advertises no exceptionBreakpointFilters (e.g. Godot 4.3, which also does not answer " +
        "the request — it would otherwise time out) it returns a clear \"unsupported\" message WITHOUT sending anything.",
      inputSchema: {
        filters: z.array(z.string()).optional().describe("Exception filter IDs to enable (default none = clear). Choose from available_filters in the result."),
      },
    },
    async ({ filters }) => {
      try {
        // Per the DAP spec a client should only send setExceptionBreakpoints when the
        // adapter advertised at least one exception filter. Godot 4.3 advertises none and
        // does not answer the request (it would time out), so short-circuit with a clear
        // "unsupported" message instead of hanging until that timeout.
        const advertised = dap.capabilities?.["exceptionBreakpointFilters"];
        const available_filters = Array.isArray(advertised)
          ? (advertised as Array<{ filter?: string; label?: string }>).map((f) => ({ filter: f.filter ?? "", label: f.label ?? "" }))
          : [];
        if (available_filters.length === 0) {
          return {
            isError: true as const,
            content: [{ type: "text" as const, text: "dbg_set_exception_breakpoints is unsupported by the connected Godot build's debug adapter (it advertises no exceptionBreakpointFilters). There are no exception filters to enable on this build." }],
          };
        }
        const active = filters ?? [];
        const body = await dap.request("setExceptionBreakpoints", { filters: active });
        const breakpoints = Array.isArray(body["breakpoints"])
          ? (body["breakpoints"] as Array<{ verified?: boolean }>).map((b) => ({ verified: Boolean(b.verified) }))
          : [];
        return ok({ filters: active, available_filters, breakpoints });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_set_variable",
    {
      title: "Set variable value",
      description:
        "Change a variable's value in a stopped frame (DAP setVariable). DESTRUCTIVE: mutates live program state — confirm with the user and keep this gated. " +
        "`variables_ref` is the container's variablesReference (from dbg_scopes, or a complex entry in dbg_variables), `name` is the variable's name within it, " +
        "and `value` is the new value as a GDScript literal/expression. Only meaningful while stopped at a breakpoint.",
      inputSchema: {
        variables_ref: z.number().int().describe("variablesReference of the containing scope/variable (from dbg_scopes or dbg_variables)"),
        name: z.string().describe("Variable name within that container"),
        value: z.string().describe("New value as a GDScript literal/expression"),
        confirm: z.boolean().optional().describe("Auto-approve this mutation (skip the confirmation prompt)"),
      },
    },
    async ({ variables_ref, name, value, confirm }) => {
      try {
        // Before the gate and the caps check on purpose — see dbg_evaluate.
        requireSession("dbg_set_variable");
        requireStopped("dbg_set_variable");
        // Feature-detect: some debug adapters don't implement setVariable. If the
        // adapter explicitly advertised it as unsupported, say so plainly instead
        // of prompting for a confirmation and then failing.
        if (dap.capabilities && dap.capabilities["supportsSetVariable"] === false) {
          return {
            isError: true as const,
            content: [{ type: "text" as const, text: "dbg_set_variable is unsupported by the connected Godot build's debug adapter (it does not advertise supportsSetVariable). Read-only inspection (dbg_variables) still works." }],
          };
        }
        const blocked = await gate(server, confirm, `Set variable ${name} = ${value} in the running game`);
        if (blocked) return blocked;
        // Godot advertises supportsSetVariable=true (so the caps short-circuit above does not
        // fire) and never answers the setVariable request. Caps can't detect that — the adapter
        // lies — so bound the request to a short deadline and, on timeout, say plainly that this
        // adapter does not implement setVariable rather than emitting the generic 20 s DAP timeout.
        //
        // 🔴 THE SENTENCE USED TO BLAME THE READER'S ENGINE, AND IT WAS MEASURABLY WRONG (262 §3).
        // It read "this Godot build (e.g. 4.3) does not implement setVariable", written when 4.3
        // was the build in hand. Measured twice at a REAL stop on **4.7** — the newest build there
        // is — the request is advertised and still unanswered, so the only sentence this tool has
        // ever emitted told a current-build user they were behind. The naming is now the adapter,
        // not the reader's version: no `dbg_*` caller can act on "upgrade", because there is
        // nothing to upgrade to.
        let body: Record<string, unknown>;
        try {
          body = await dap.request("setVariable", { variablesReference: variables_ref, name, value }, cfg.dapSetVarTimeoutMs);
        } catch (err) {
          if (isDapTimeout(err)) {
            return {
              isError: true as const,
              content: [{ type: "text" as const, text: `The debug adapter advertises supportsSetVariable but did not answer the setVariable request within ${cfg.dapSetVarTimeoutMs}ms — Godot's GDScript debug adapter does not implement it (measured unanswered on 4.3 and on 4.7, at a real stop). No change was made; the variable is unchanged. Read-only inspection (dbg_variables) still works, and dbg_evaluate can read the value.` }],
            };
          }
          throw err;
        }
        return ok({ name, value: String(body["value"] ?? value), type: String(body["type"] ?? ""), variables_ref: (body["variablesReference"] as number) ?? 0 });
      } catch (err) { return fail(err); }
    },
  );

  // NOT port-gated, deliberately, and this one is a trap worth naming: at the
  // moment of the check the session's OWN game still holds the runtime port and
  // is about to be terminated. A probe here would fire on the very process it is
  // about to replace — a guaranteed false positive on the happy path, every
  // single time. The relaunch reuses the launch parameters, so if some THIRD
  // process holds the port the fresh game lands bridgeless exactly as before;
  // that residue is accepted knowingly rather than traded for a check that cries
  // wolf on every restart.
  server.registerTool(
    "dbg_restart",
    {
      title: "Restart debug session",
      description:
        "Restart the current debug session. Uses the DAP `restart` request when the adapter advertises `supportsRestartRequest`, " +
        "otherwise falls back to terminate + relaunch — so it works on every adapter. Reuses the last dbg_launch/dbg_attach parameters; " +
        "pass `scene` / `stop_on_entry` to override them for a launched session. `method` in the result reports which path ran " +
        "('restart' = native DAP restart, 'relaunch' = terminate + fresh handshake). Requires a session started with dbg_launch/dbg_attach. " +
        "`scene` is held to the same rule as dbg_launch's — inside the project root, existing, non-empty.",
      inputSchema: {
        scene: z
          .string()
          .optional()
          .describe("Override the scene for a launched session: 'main', 'current', res://scene.tscn, or uid://…"),
        stop_on_entry: z.boolean().optional().describe("Override stop-at-entry for the restart (launched sessions)"),
      },
    },
    async ({ scene, stop_on_entry }) => {
      try {
        // 🔴 THE SECOND CALL SITE, and the reason it is here. 162 §8 item 5 named
        // `dbg_launch` alone; `dbg_restart` takes the same `scene` and hands it to the
        // same adapter, so guarding only the first would have left the plane guarded
        // in name only. Measured before it was written: an unguarded `dbg_restart`
        // onto `res://../example_evil/outside.tscn` answered
        // `ok {"method":"restart","state":"running"}`, exactly like `dbg_launch`.
        // §7's standing rule — a guard is not wired until EVERY call site is wired.
        guardScene(scene);
        const override: Record<string, unknown> = {};
        if (scene !== undefined) override.scene = scene;
        if (stop_on_entry !== undefined) override.stopOnEntry = stop_on_entry;
        const r = await dap.restart(override);
        return ok({ session_id: "godot", method: r.method, state: r.state, scene: r.scene });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_goto",
    {
      title: "Go to line (set next statement)",
      description:
        "Move the program counter within the current stopped frame — 'set next statement' (DAP gotoTargets + goto). Call with `path` + `line` to " +
        "list the valid goto targets on that line; when the line has exactly one target (or you pass `target_id`) it jumps there. " +
        "DESTRUCTIVE: skips or repeats code by moving execution — confirm with the user and keep this gated. " +
        "Feature-detected: on an adapter that does not advertise `supportsGotoTargetsRequest` it returns a clear \"unsupported\" message WITHOUT prompting. " +
        "Refuses a source that can never carry a target — a missing file, a directory, an empty path (which resolves to the project root), " +
        "or a path resolving outside the Godot project root — the same guard dbg_set_breakpoints applies. " +
        "Only meaningful while stopped at a breakpoint.",
      inputSchema: {
        path: z.string().describe("Script path (res://..., absolute, or project-relative)"),
        line: z.number().int().positive().describe("1-based target line"),
        target_id: z.number().int().optional().describe("A specific target id from a prior dbg_goto listing; omit to auto-pick when the line has a single target"),
        confirm: z.boolean().optional().describe("Auto-approve the jump (skip the confirmation prompt)"),
      },
    },
    async ({ path, line, target_id, confirm }) => {
      try {
        // Before the caps check, the same order `dbg_set_variable` uses: a guard that
        // holds on every adapter outranks one that reports this adapter's answer. 262
        // added the pair here — `dbg_goto` had NEITHER, and "unreachable behind the
        // capability gate" is the same argument the escape guard above was written
        // against three sessions earlier.
        requireSession("dbg_goto");
        requireStopped("dbg_goto");
        if (!dap.capabilities || dap.capabilities["supportsGotoTargetsRequest"] !== true) {
          return {
            isError: true as const,
            content: [{ type: "text" as const, text: "dbg_goto is unsupported by the connected Godot build's debug adapter (it does not advertise supportsGotoTargetsRequest)." }],
          };
        }
        // 🔴 162: THIS GUARD WAS MISSING, and only a measurement found it. 161 §8 item 5
        // described dap.ts as carrying "its own inline copy of the escape guard" — true
        // of ONE of its two path-taking tools. `dbg_goto` resolved with a bare
        // `toFsPath` and handed the result to the adapter as `source.path`: no
        // containment check, no existence check. The same shape as 161 §4's "only
        // board_create's stale-tab close was asserted, and one of four creators was
        // covered" — a guard is not wired until every call site is wired.
        //
        // 🔴 It is not currently REACHABLE on Godot: the capability gate above returns
        // first because no Godot build advertises supportsGotoTargetsRequest. That is a
        // capability, not a boundary — it can change under us, and `dbg_goto` is the
        // DESTRUCTIVE tool on this plane. Guarded on its own merits, not on the engine's
        // current answer.
        const fsPath = guardSource(path);
        const body = await dap.request("gotoTargets", { source: { path: fsPath }, line });
        const targets = Array.isArray(body["targets"])
          ? (body["targets"] as Array<{ id?: number; label?: string; line?: number }>).map((t) => ({ id: t.id ?? 0, label: t.label ?? "", line: t.line ?? 0 }))
          : [];
        const chosen = target_id !== undefined
          ? targets.find((t) => t.id === target_id)
          : targets.length === 1 ? targets[0] : undefined;
        if (!chosen) {
          if (target_id !== undefined) {
            return {
              isError: true as const,
              content: [{ type: "text" as const, text: `No goto target with id ${target_id} on ${fsPath}:${line}. Call dbg_goto with just path+line to list the valid targets.` }],
            };
          }
          // Zero or multiple targets: report them and jump nowhere.
          return ok({ targets, jumped: false, target_id: null });
        }
        const blocked = await gate(server, confirm, `Move execution to ${fsPath}:${chosen.line} (${chosen.label}) in the running game`);
        if (blocked) return blocked;
        await dap.request("goto", { threadId: dap.threadId(), targetId: chosen.id });
        return ok({ targets: [chosen], jumped: true, target_id: chosen.id });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_data_breakpoints",
    {
      title: "Set data breakpoints (watchpoints)",
      description:
        "Set (replace) data breakpoints — 'watchpoints' that halt when a variable's value changes (DAP dataBreakpointInfo + setDataBreakpoints). " +
        "Pass `watch` as a list of { name, variables_ref?, access_type? }: each name is resolved to a dataId via dataBreakpointInfo, then every " +
        "resolvable id is armed in one setDataBreakpoints call. Call with no `watch` (or []) to clear all data breakpoints. The result reports the " +
        "armed `breakpoints` (each with its resolved data_id and verified flag) and any `unresolved` variables the adapter cannot watch. " +
        "Requires a running session; NOT gated (it only configures the debugger). Feature-detected: on an adapter that does not advertise " +
        "`supportsDataBreakpoints` it returns a clear \"unsupported\" message without sending any request.",
      inputSchema: {
        watch: z.array(z.object({
          name: z.string().describe("Variable name to watch"),
          variables_ref: z.number().int().optional().describe("variablesReference of the containing scope/variable (from dbg_scopes / dbg_variables); omit for a global/expression name"),
          access_type: z.enum(["read", "write", "readWrite"]).optional().describe("When to break (default the adapter's default, usually write)"),
        })).optional().describe("Variables to watch; omit or [] to clear all data breakpoints"),
      },
    },
    async ({ watch }) => {
      try {
        // 🔴 SESSION ONLY, NOT STOPPED — and the asymmetry with `dbg_goto` above is the
        // point rather than an oversight. `goto` moves the program counter *within the
        // current stopped frame*, which is meaningless without one. A data breakpoint is
        // ARMED for the future: a `variables_ref` naming a live scope does need a stop,
        // but a bare global `name` resolves without one, and refusing the whole tool
        // would refuse the case that works. Each entry already reports its own
        // `unresolved` reason, which is where a ref that needed a frame says so.
        requireSession("dbg_data_breakpoints");
        if (!dap.capabilities || dap.capabilities["supportsDataBreakpoints"] !== true) {
          return {
            isError: true as const,
            content: [{ type: "text" as const, text: "dbg_data_breakpoints is unsupported by the connected Godot build's debug adapter (it does not advertise supportsDataBreakpoints)." }],
          };
        }
        const requested = watch ?? [];
        const resolved: Array<{ name: string; dataId: string; accessType?: string }> = [];
        const unresolved: Array<{ name: string; reason: string }> = [];
        for (const w of requested) {
          try {
            const info = await dap.request("dataBreakpointInfo", { name: w.name, variablesReference: w.variables_ref });
            const dataId = info["dataId"];
            if (typeof dataId === "string" && dataId.length > 0) {
              resolved.push({ name: w.name, dataId, accessType: w.access_type });
            } else {
              unresolved.push({ name: w.name, reason: String(info["description"] ?? "adapter returned no dataId for this variable") });
            }
          } catch (err) {
            const e = err as { message?: string };
            unresolved.push({ name: w.name, reason: e.message ?? String(err) });
          }
        }
        const body = await dap.request("setDataBreakpoints", {
          breakpoints: resolved.map((r) => {
            const b: { dataId: string; accessType?: string } = { dataId: r.dataId };
            if (r.accessType) b.accessType = r.accessType;
            return b;
          }),
        });
        const verified = Array.isArray(body["breakpoints"])
          ? (body["breakpoints"] as Array<{ verified?: boolean }>).map((b) => Boolean(b.verified))
          : [];
        const breakpoints = resolved.map((r, i) => ({ name: r.name, data_id: r.dataId, verified: verified[i] ?? false }));
        return ok({ breakpoints, unresolved });
      } catch (err) { return fail(err); }
    },
  );
}

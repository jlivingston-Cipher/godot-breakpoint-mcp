import { z } from "zod";
import * as fs from "node:fs";
import * as nodePath from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { CsDapClient } from "../csdap.js";
import { DapError } from "../dap.js";
import { toFsPath } from "../paths.js";
import { gate } from "../confirm.js";
import { ok } from "./lsp-common.js";
import { portFree, portConflictMessage } from "../ports.js";

// How long step/continue wait for the program to settle (hit a breakpoint,
// finish a step, or terminate) before returning. On timeout the tool reports
// the current state — e.g. `continue` with no further breakpoint stays running.
const RESUME_WAIT_MS = 15000;

function fail(err: unknown) {
  const e = err as { command?: string; message?: string; refusal?: boolean };
  // A REFUSAL is the host declining the call, not the debug adapter failing one —
  // the same distinction `lsp-common.fail()` draws. Rendering it as
  // "C# DAP error [...]" sends the caller to debug an adapter that was never asked.
  if (e?.refusal) {
    return {
      isError: true as const,
      content: [{ type: "text" as const, text: e.message ?? String(err) }],
    };
  }
  // 🔴 An adapter failure can carry NO message at all. Measured: netcoredbg
  // advertises `supportsSetVariable: true` and answered a setVariable failure with an
  // empty `message`, so this rendered as the bare, meaningless
  // `C# DAP error [setVariable]: ` — an error whose text says nothing about what went
  // wrong or who reported it. Say that the adapter reported a failure without one.
  const message = (e?.message ?? "").trim();
  const command = e?.command ?? "error";
  if (message === "") {
    return {
      isError: true as const,
      content: [{
        type: "text" as const,
        text: `C# DAP error [${command}]: the debug adapter reported a failure with no message. ` +
          `The request was rejected; nothing was changed by it.`,
      }],
    };
  }
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: `C# DAP error [${command}]: ${message}` }],
  };
}

/** Throw a host refusal — rendered verbatim by `fail()`, never as an adapter error. */
function refuse(message: string, code: string): never {
  throw Object.assign(new Error(message), { refusal: true, code });
}

/**
 * True when `err` is a DAP request that hit its own request deadline (not an
 * adapter-reported failure or a dropped connection). Used to turn a
 * setVariable / evaluate non-response into a clear message rather than the
 * generic timeout — the same F1 discipline the GDScript DAP plane uses.
 */
function isDapTimeout(err: unknown): err is DapError {
  return err instanceof DapError && /timed out after/.test(err.message);
}

/**
 * D4 C3 — the C#/.NET debugging plane. `cs_dbg_*` tools mirroring the read/inspect
 * GDScript `dbg_*` surface, but driven by **netcoredbg** (Samsung, MIT — spawned
 * over stdio by the host) attached to / launching a C# Godot game, instead of
 * Godot's built-in TCP debug adapter.
 *
 * Same disciplines as the GDScript plane: destructive tools (`cs_dbg_evaluate`,
 * `cs_dbg_set_variable`) are elicitation-gated; those two also carry a short
 * bounded deadline so a non-answering adapter fails fast with a clear message
 * (the F1 fix) instead of hanging the full DAP timeout. Adapter absent → the
 * lazy stdio spawn fails with an actionable hint, never a hang. On top of the
 * read/inspect surface this now carries the GDScript extras netcoredbg backs —
 * `cs_dbg_watch`, `cs_dbg_set_exception_breakpoints` (netcoredbg advertises the
 * `all` / `user-unhandled` filters) and `cs_dbg_restart` (terminate + relaunch,
 * since netcoredbg advertises no `supportsRestartRequest`). `goto` and data
 * breakpoints are deliberately NOT ported: netcoredbg advertises neither
 * `supportsGotoTargetsRequest` nor `supportsDataBreakpoints`, so those tools
 * would only ever return "unsupported" here.
 */
export function registerCsDapTools(server: McpServer, dap: CsDapClient, cfg: Config): void {
  const root = cfg.csDapProjectPath;

  /**
   * Resolve a breakpoint source path and REFUSE one that cannot carry a breakpoint.
   *
   * Measured against a real netcoredbg: `res://NoSuchFile.cs`, `res://demo` (a
   * DIRECTORY) and `""` (which `path.join`s down to the PROJECT ROOT DIRECTORY) each
   * answered `{buffered:true, breakpoints:[]}` with `isError:false` — byte-identical
   * to `res://Player.cs`. The caller could not tell an armed breakpoint from one that
   * can never bind.
   *
   * 🔴 The escape check is deliberately NARROWER than the `cs_*` LSP plane's, and the
   * difference is not an oversight. `cs_dbg_launch` documents overriding `program` to
   * "debug a different .NET program", whose sources legitimately live outside the
   * Godot C# project — refusing every absolute path outside the root would break the
   * documented mainline of this tool. So:
   *
   *   - `res://…` and relative paths are PROJECT-ANCHORED by definition; one that
   *     resolves outside the root (`res://../../../etc/passwd` landed in
   *     `~/Downloads/etc/passwd`) is meaningless and is refused.
   *   - an ABSOLUTE path is the caller explicitly naming a file elsewhere, which is
   *     exactly how you debug another program. It stays legal.
   *
   * Existence is checked for BOTH forms — that guard is about whether a breakpoint
   * can bind at all, and it is location-independent. The comparison is against
   * `root + path.sep`, never a bare `startsWith(root)`: the latter accepts a sibling
   * directory that merely shares the root's name prefix.
   */
  const guardSource = (p: string): string => {
    const fsPath = nodePath.resolve(toFsPath(p, root));
    const rootPath = nodePath.resolve(root);
    const projectAnchored = !nodePath.isAbsolute(p);
    if (projectAnchored && fsPath !== rootPath && !fsPath.startsWith(rootPath + nodePath.sep)) {
      refuse(
        `Refusing "${p}": it resolves to ${fsPath}, which is outside the C# project root ` +
          `(${rootPath}). A res:// or relative path is project-anchored; pass an absolute ` +
          `path to set a breakpoint in a program outside the project.`,
        "path_outside_project",
      );
    }
    let stat: fs.Stats;
    try {
      stat = fs.statSync(fsPath);
    } catch {
      refuse(
        `Refusing "${p}": no such file (${fsPath}). A breakpoint there can never bind, but ` +
          `it was previously answered exactly like one on a real file.`,
        "file_not_found",
      );
    }
    if (!stat.isFile()) {
      refuse(
        `Refusing "${p}": ${fsPath} is not a file${p === "" ? " (an empty path resolves to the project root)" : ""}.`,
        "not_a_file",
      );
    }
    return fsPath;
  };

  server.registerTool(
    "cs_dbg_launch",
    {
      title: "Launch C# debug session",
      description:
        "Start a C# Godot game under netcoredbg. `program` defaults to the configured Mono/.NET Godot binary " +
        "(GODOT_CSHARP_BIN) and `args` to ['--path', <C# project>]; override either to debug a different .NET program. " +
        "Any breakpoints set beforehand are applied during the handshake. Requires netcoredbg (GODOT_CSDAP_CMD) — " +
        "absent, the lazy spawn fails with an actionable hint rather than hanging. A launch the adapter rejects " +
        "(a program that does not exist, or is not a .NET assembly) is reported as an error: it previously answered " +
        "state 'running' for a session that never started. With `stop_on_entry` the call waits for the entry stop, " +
        "so it returns state 'stopped' with a usable thread — not 'running'.",
      inputSchema: {
        program: z.string().optional().describe("Path to the program to launch (default: the Mono/.NET Godot binary)"),
        args: z.array(z.string()).optional().describe("Program arguments (default: ['--path', <C# project>])"),
        stop_on_entry: z.boolean().optional().describe("Break at entry (default false)"),
        just_my_code: z.boolean().optional().describe("Restrict stepping/breakpoints to user code (netcoredbg justMyCode; default true)"),
        allow_port_conflict: z
          .boolean()
          .optional()
          .describe(
            "Launch even though the runtime bridge port is already bound (default false). Only consulted when " +
              "this looks like a Godot launch — the program is named godot, or the args carry Godot's --path " +
              "project flag. Debugging some other .NET program is never gated. Breakpoints and stepping still " +
              "work; runtime_* tools would talk to the process holding the port.",
          ),
      },
    },
    async ({ program, args, stop_on_entry, just_my_code, allow_port_conflict }) => {
      const resolvedProgram = program ?? cfg.csDapProgram;
      const resolvedArgs = args ?? ["--path", cfg.csDapProjectPath];
      // Does this launch a Godot game — i.e. one whose autoload wants the runtime
      // port — or some other .NET program netcoredbg is being pointed at?
      //
      // DEFAULT TO YES, and skip the gate only when the caller has clearly aimed
      // elsewhere. Comparing the resolved program against `cfg.csDapProgram` was
      // the obvious-looking test and is wrong: that is equality against the
      // DEFAULT, so passing the real Mono binary explicitly — the way config.ts
      // documents pointing at it — skipped the gate on the mainline path this
      // whole change exists to cover. `--path <project>` is Godot's own project
      // flag and appears in the default args; a program not called godot and not
      // given --path is the one case we are confident is not a game.
      const looksLikeGodot =
        /godot/i.test(resolvedProgram.split(/[\\/]/).pop() ?? "") || resolvedArgs.includes("--path");
      if (
        looksLikeGodot &&
        !allow_port_conflict &&
        !(await portFree(cfg.runtimeHost, cfg.runtimePort))
      ) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: portConflictMessage(cfg.runtimeHost, cfg.runtimePort, "debugger") }],
        };
      }
      try {
        await dap.start("launch", {
          program: resolvedProgram,
          args: resolvedArgs,
          cwd: cfg.csDapProjectPath,
          stopAtEntry: stop_on_entry ?? false,
          justMyCode: just_my_code ?? true,
        });
        return ok({ session_id: "csharp", state: dap.state });
      } catch (err) { return fail(err); }
    },
  );

  // NOT port-gated, deliberately — see dbg_attach: attaching to the process that
  // already holds the port is the remedy, not the problem.
  server.registerTool(
    "cs_dbg_attach",
    {
      title: "Attach C# debug session",
      description:
        "Attach netcoredbg to an already-running .NET process (e.g. a C# Godot game launched separately) by its OS process id. " +
        "Any breakpoints set beforehand are applied during the handshake. A process id nothing is running under is refused " +
        "rather than reported as an attached session; a process owned by another user is a legitimate target and is not refused.",
      inputSchema: {
        // .positive(): a pid is 1 or greater. `-1` and `0` are not process ids, and
        // both were measured answering `isError:false state:"running"` — a phantom
        // session against a process that cannot exist.
        process_id: z.number().int().positive().describe("OS process id of the running .NET process to attach to"),
      },
    },
    async ({ process_id }) => {
      try {
        // Refuse a pid nothing is running under, BEFORE the handshake. `kill(pid, 0)`
        // signals nothing; it only asks the kernel about the process. ESRCH means no
        // such process. EPERM means it EXISTS and is owned by someone else — that is a
        // legitimate attach target, so it must NOT be refused here.
        try {
          process.kill(process_id, 0);
        } catch (err) {
          if ((err as NodeJS.ErrnoException)?.code === "ESRCH") {
            refuse(
              `Refusing to attach to process ${process_id}: no such process. The debug session ` +
                `was previously reported as "running" against a process that does not exist.`,
              "no_such_process",
            );
          }
        }
        await dap.start("attach", { processId: process_id });
        return ok({ session_id: "csharp", state: dap.state });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "cs_dbg_set_breakpoints",
    {
      title: "Set C# breakpoints",
      description:
        "Set (replace) the breakpoints for a C# source file. Applied immediately if a session is running, else buffered until launch/attach. " +
        "Feature-detected: the per-line `conditions` modifier is only sent when the connected adapter advertises supportsConditionalBreakpoints " +
        "(netcoredbg does); on an adapter that advertises it unsupported the modifier is dropped and the result carries `unsupported_modifiers` " +
        "plus a `warning`. Detection needs a live session, so set conditions after cs_dbg_launch/cs_dbg_attach. " +
        "A path that names nothing, or names a directory, is refused: it previously answered exactly like a real file. " +
        "A res:// or relative path that resolves outside the C# project root is refused too; an absolute path elsewhere " +
        "is legal, because debugging a different .NET program is supported.",
      inputSchema: {
        path: z.string().describe("C# script path (res://..., absolute, or relative to the C# project root)"),
        lines: z.array(z.number().int().positive()).describe("1-based line numbers"),
        conditions: z.array(z.string().nullable()).optional().describe("Optional per-line condition expressions (aligned to lines, null to skip); break only when the expression is true"),
      },
    },
    async ({ path, lines, conditions }) => {
      try {
        const fsPath = guardSource(path);
        // Feature-detect the condition modifier against the connected adapter. Only when it does
        // not advertise supportsConditionalBreakpoints do we DROP conditions and warn — otherwise
        // a "conditional" breakpoint could halt unconditionally on an adapter that ignores them.
        const wantsCondition = Array.isArray(conditions) && conditions.some((c) => c != null && c !== "");
        const conditionUnsupported = wantsCondition && dap.capabilities != null && dap.capabilities["supportsConditionalBreakpoints"] !== true;
        const body = await dap.setBreakpoints(fsPath, lines, conditionUnsupported ? undefined : conditions);
        const verified = Array.isArray(body["breakpoints"])
          ? (body["breakpoints"] as Array<{ line?: number; verified?: boolean }>).map((b) => ({ line: b.line ?? 0, verified: Boolean(b.verified) }))
          : [];
        const result: Record<string, unknown> = { path: fsPath, buffered: body["buffered"] === true, breakpoints: verified };
        if (conditionUnsupported) {
          result.unsupported_modifiers = ["condition"];
          result.warning =
            "The connected C# debug adapter does not advertise supportsConditionalBreakpoints, so the per-line conditions were " +
            "dropped — the affected breakpoint(s) will halt unconditionally.";
        }
        return ok(result);
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "cs_dbg_continue",
    {
      title: "Continue (C#)",
      description:
        "Resume execution and wait for the program to settle again (next breakpoint or termination). " +
        "Returns the resulting state; if it runs on with no further breakpoint, reports state 'running'.",
      inputSchema: {},
    },
    async () => {
      try {
        const r = await dap.resume("continue", { threadId: dap.threadId() }, RESUME_WAIT_MS);
        return ok({ state: r.state, stopped_reason: r.reason });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "cs_dbg_step",
    {
      title: "Step (C#)",
      description:
        "Step execution: 'over' (next), 'in' (stepIn), or 'out' (stepOut), then wait for the step to land. " +
        "Returns the resulting state and stop reason.",
      inputSchema: { kind: z.enum(["in", "over", "out"]).describe("Step kind") },
    },
    async ({ kind }) => {
      try {
        const command = kind === "in" ? "stepIn" : kind === "out" ? "stepOut" : "next";
        const r = await dap.resume(command, { threadId: dap.threadId() }, RESUME_WAIT_MS);
        return ok({ state: r.state, stopped_reason: r.reason });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "cs_dbg_stack_trace",
    {
      title: "Stack trace (C#)",
      description: "Return the current C# call stack (only meaningful while stopped at a breakpoint).",
      inputSchema: { levels: z.number().int().positive().optional().describe("Max frames (default 20)") },
    },
    async ({ levels }) => {
      try {
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
    "cs_dbg_scopes",
    {
      title: "Scopes (C#)",
      description: "Return the variable scopes (Locals, etc.) for a C# stack frame.",
      inputSchema: { frame_id: z.number().int().describe("Frame id from cs_dbg_stack_trace") },
    },
    async ({ frame_id }) => {
      try {
        const body = await dap.request("scopes", { frameId: frame_id });
        const scopes = Array.isArray(body["scopes"])
          ? (body["scopes"] as Array<{ name?: string; variablesReference?: number }>).map((s) => ({ name: s.name ?? "", variables_ref: s.variablesReference ?? 0 }))
          : [];
        return ok({ scopes });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "cs_dbg_variables",
    {
      title: "Variables (C#)",
      description: "List variables under a scope or a complex value (via its variables_ref).",
      inputSchema: { variables_ref: z.number().int().describe("variablesReference from cs_dbg_scopes or a parent variable") },
    },
    async ({ variables_ref }) => {
      try {
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
    "cs_dbg_evaluate",
    {
      title: "Evaluate C# expression",
      description:
        "Evaluate a C# expression in the context of a stopped frame. DESTRUCTIVE: arbitrary code execution — confirm with the user and keep this gated. " +
        "Bounded by a short deadline so a non-answering adapter fails fast rather than hanging the full DAP timeout.",
      inputSchema: {
        expression: z.string().describe("C# expression to evaluate"),
        frame_id: z.number().int().optional().describe("Frame id (from cs_dbg_stack_trace); omit for the top frame"),
        confirm: z.boolean().optional().describe("Auto-approve this arbitrary-code evaluation (skip the confirmation prompt)"),
      },
    },
    async ({ expression, frame_id, confirm }) => {
      try {
        const blocked = await gate(server, confirm, `Evaluate C# expression in the running game: ${expression}`);
        if (blocked) return blocked;
        let body: Record<string, unknown>;
        try {
          body = await dap.request("evaluate", { expression, frameId: frame_id, context: "repl" }, cfg.csDapEvaluateTimeoutMs);
        } catch (err) {
          if (isDapTimeout(err)) {
            return {
              isError: true as const,
              content: [{ type: "text" as const, text: `The C# debug adapter did not answer the evaluate request within ${cfg.csDapEvaluateTimeoutMs}ms — no result was returned. The debug session is still alive; use cs_dbg_variables to inspect state.` }],
            };
          }
          throw err;
        }
        return ok({ result: String(body["result"] ?? ""), type: String(body["type"] ?? ""), variables_ref: (body["variablesReference"] as number) ?? 0 });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "cs_dbg_set_variable",
    {
      title: "Set C# variable value",
      description:
        "Change a variable's value in a stopped C# frame (DAP setVariable). DESTRUCTIVE: mutates live program state — confirm with the user and keep this gated. " +
        "`variables_ref` is the container's variablesReference (from cs_dbg_scopes, or a complex cs_dbg_variables entry), `name` is the variable within it, " +
        "`value` is the new value as a C# literal/expression. Feature-detected: on an adapter that advertises supportsSetVariable:false it returns a clear " +
        "\"unsupported\" message WITHOUT prompting; otherwise a bounded deadline turns a non-answering adapter into a clear message rather than a hang.",
      inputSchema: {
        variables_ref: z.number().int().describe("variablesReference of the containing scope/variable (from cs_dbg_scopes or cs_dbg_variables)"),
        name: z.string().describe("Variable name within that container"),
        value: z.string().describe("New value as a C# literal/expression"),
        confirm: z.boolean().optional().describe("Auto-approve this mutation (skip the confirmation prompt)"),
      },
    },
    async ({ variables_ref, name, value, confirm }) => {
      try {
        if (dap.capabilities && dap.capabilities["supportsSetVariable"] === false) {
          return {
            isError: true as const,
            content: [{ type: "text" as const, text: "cs_dbg_set_variable is unsupported by the connected C# debug adapter (it does not advertise supportsSetVariable). Read-only inspection (cs_dbg_variables) still works." }],
          };
        }
        const blocked = await gate(server, confirm, `Set C# variable ${name} = ${value} in the running game`);
        if (blocked) return blocked;
        let body: Record<string, unknown>;
        try {
          body = await dap.request("setVariable", { variablesReference: variables_ref, name, value }, cfg.csDapSetVarTimeoutMs);
        } catch (err) {
          if (isDapTimeout(err)) {
            return {
              isError: true as const,
              content: [{ type: "text" as const, text: `The C# debug adapter did not answer the setVariable request within ${cfg.csDapSetVarTimeoutMs}ms — no change was made; the variable is unchanged. Read-only inspection (cs_dbg_variables) still works.` }],
            };
          }
          throw err;
        }
        return ok({ name, value: String(body["value"] ?? value), type: String(body["type"] ?? ""), variables_ref: (body["variablesReference"] as number) ?? 0 });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "cs_dbg_watch",
    {
      title: "Watch expressions (C#)",
      description:
        "Manage a persistent set of C# watch expressions and evaluate them in the current stopped frame. " +
        "Pass `add`/`remove`/`clear` to mutate the set (all optional), then every current watch is re-evaluated " +
        "and returned. Call with no mutation args to just re-read the watches after a step/continue. Expressions " +
        "are evaluated in DAP `watch` context (intended to be side-effect-free), so this is not gated; the results " +
        "are only meaningful while the program is stopped at a breakpoint.",
      inputSchema: {
        add: z.array(z.string()).optional().describe("Expressions to add to the watch set"),
        remove: z.array(z.string()).optional().describe("Expressions to remove from the watch set"),
        clear: z.boolean().optional().describe("Clear all watches before applying add (default false)"),
        frame_id: z.number().int().optional().describe("Frame id from cs_dbg_stack_trace; omit for the top frame"),
      },
    },
    async ({ add, remove, clear, frame_id }) => {
      try {
        if (clear) dap.clearWatches();
        if (remove && remove.length) dap.removeWatches(remove);
        if (add && add.length) dap.addWatches(add);
        // Bound each watch's evaluate to the short deadline (mirrors cs_dbg_evaluate): a watch
        // the adapter never answers fails fast on that entry instead of hanging the full DAP
        // timeout at every stop, while other watches still resolve normally.
        const watches = await dap.evaluateWatches(frame_id, cfg.csDapEvaluateTimeoutMs);
        return ok({ watches });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "cs_dbg_set_exception_breakpoints",
    {
      title: "Set C# exception breakpoints",
      description:
        "Enable (replace) the debugger's exception breakpoint filters so execution halts when a matching .NET exception is thrown " +
        "(DAP setExceptionBreakpoints). Pass the filter IDs to enable; call with no filters (or []) to clear them. The result echoes the " +
        "active filters and lists `available_filters` — the exception filters the connected adapter advertises (netcoredbg exposes `all` " +
        "for every thrown exception and `user-unhandled`). A filter id the adapter does not advertise is refused by name, listing the real " +
        "ones, rather than forwarded to the adapter as an opaque failure. Requires a running debug session. Not gated (it only configures the debugger). " +
        "Feature-detected: on an adapter that advertises no exceptionBreakpointFilters it returns a clear \"unsupported\" message WITHOUT sending anything.",
      inputSchema: {
        filters: z.array(z.string()).optional().describe("Exception filter IDs to enable (default none = clear). Choose from available_filters in the result (netcoredbg: 'all', 'user-unhandled')."),
      },
    },
    async ({ filters }) => {
      try {
        // Per the DAP spec a client should only send setExceptionBreakpoints when the adapter
        // advertised at least one exception filter. Short-circuit with a clear "unsupported"
        // message otherwise, matching the GDScript dbg_set_exception_breakpoints discipline.
        const advertised = dap.capabilities?.["exceptionBreakpointFilters"];
        const available_filters = Array.isArray(advertised)
          ? (advertised as Array<{ filter?: string; label?: string }>).map((f) => ({ filter: f.filter ?? "", label: f.label ?? "" }))
          : [];
        if (available_filters.length === 0) {
          return {
            isError: true as const,
            content: [{ type: "text" as const, text: "cs_dbg_set_exception_breakpoints is unsupported by the connected C# debug adapter (it advertises no exceptionBreakpointFilters). There are no exception filters to enable." }],
          };
        }
        const active = filters ?? [];
        // 🔴 The empty case was validated; MEMBERSHIP was not. An id the adapter never
        // advertised went straight to the wire and came back
        // `Failed command 'setExceptionBreakpoints' : 0x80070057` — a hex code for a
        // question the host already had the answer to, since `available_filters` is
        // right here. Name the bad filter and list the real ones instead.
        const known = new Set(available_filters.map((f) => f.filter));
        const unknown = active.filter((f) => !known.has(f));
        if (unknown.length) {
          refuse(
            `Refusing exception filter(s) ${unknown.map((f) => JSON.stringify(f)).join(", ")}: the ` +
              `connected C# debug adapter does not advertise them. Available: ` +
              `${available_filters.map((f) => f.filter).join(", ")}.`,
            "unknown_exception_filter",
          );
        }
        const body = await dap.request("setExceptionBreakpoints", { filters: active });
        const breakpoints = Array.isArray(body["breakpoints"])
          ? (body["breakpoints"] as Array<{ verified?: boolean }>).map((b) => ({ verified: Boolean(b.verified) }))
          : [];
        return ok({ filters: active, available_filters, breakpoints });
      } catch (err) { return fail(err); }
    },
  );

  // NOT port-gated, deliberately — see dbg_restart: the session's own game still
  // holds the port at check time, so a probe here false-positives every restart.
  server.registerTool(
    "cs_dbg_restart",
    {
      title: "Restart C# debug session",
      description:
        "Restart the current C# debug session. Uses the DAP `restart` request when the adapter advertises `supportsRestartRequest`, " +
        "otherwise falls back to terminate + relaunch — so it works on every adapter (netcoredbg advertises none, so the relaunch path runs). " +
        "Reuses the last cs_dbg_launch/cs_dbg_attach parameters; pass `stop_on_entry` / `program` / `args` to override them for a launched " +
        "session. `method` in the result reports which path ran ('restart' = native DAP restart, 'relaunch' = terminate + fresh handshake). " +
        "Requires a session started with cs_dbg_launch/cs_dbg_attach.",
      inputSchema: {
        stop_on_entry: z.boolean().optional().describe("Override stop-at-entry for the restart (launched sessions)"),
        program: z.string().optional().describe("Override the launched program (launched sessions)"),
        args: z.array(z.string()).optional().describe("Override the program arguments (launched sessions)"),
      },
    },
    async ({ stop_on_entry, program, args }) => {
      try {
        const override: Record<string, unknown> = {};
        if (stop_on_entry !== undefined) override.stopAtEntry = stop_on_entry;
        if (program !== undefined) override.program = program;
        if (args !== undefined) override.args = args;
        const r = await dap.restart(override);
        return ok({ session_id: "csharp", method: r.method, state: r.state });
      } catch (err) { return fail(err); }
    },
  );
}

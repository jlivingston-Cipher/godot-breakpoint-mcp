import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { DapClient } from "../dap.js";
import { toFsPath } from "../paths.js";
import { gate } from "../confirm.js";

// How long step/continue wait for the program to settle (hit a breakpoint,
// finish a step, or terminate) before returning. On timeout the tool reports
// the current state — e.g. `continue` with no further breakpoint stays running.
const RESUME_WAIT_MS = 15000;

function ok(obj: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }],
    structuredContent: obj as Record<string, unknown>,
  };
}
function fail(err: unknown) {
  const e = err as { command?: string; message?: string };
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: `DAP error [${e.command ?? "error"}]: ${e.message ?? String(err)}` }],
  };
}

export function registerDapTools(server: McpServer, dap: DapClient, cfg: Config): void {
  server.registerTool(
    "dbg_launch",
    {
      title: "Launch debug session",
      description:
        "Start the game under the debugger. scene may be 'main', 'current', or a res:// scene path. " +
        "Any breakpoints set beforehand are applied during the handshake.",
      inputSchema: {
        scene: z.string().optional().describe("'main' (default), 'current', or res://scene.tscn"),
        stop_on_entry: z.boolean().optional().describe("Break at entry (default false)"),
      },
    },
    async ({ scene, stop_on_entry }) => {
      try {
        await dap.start("launch", {
          project: cfg.projectPath,
          scene: scene ?? "main",
          stopOnEntry: stop_on_entry ?? false,
        });
        return ok({ session_id: "godot", state: dap.state, scene: scene ?? "main" });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_attach",
    {
      title: "Attach debug session",
      description: "Attach to an already-running Godot debug session.",
      inputSchema: {
        address: z.string().optional().describe("Address of the running game (default 127.0.0.1)"),
        port: z.number().int().optional().describe("Remote debug port"),
      },
    },
    async ({ address, port }) => {
      try {
        await dap.start("attach", { address: address ?? "127.0.0.1", port });
        return ok({ session_id: "godot", state: dap.state });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_set_breakpoints",
    {
      title: "Set breakpoints",
      description: "Set (replace) the breakpoints for a source file. Applied immediately if a session is running, else buffered until launch.",
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
        const fsPath = toFsPath(path, cfg.projectPath);
        const body = await dap.setBreakpoints(fsPath, lines, conditions, hit_conditions, log_messages);
        const verified = Array.isArray(body["breakpoints"])
          ? (body["breakpoints"] as Array<{ line?: number; verified?: boolean }>).map((b) => ({ line: b.line ?? 0, verified: Boolean(b.verified) }))
          : [];
        return ok({ path: fsPath, buffered: body["buffered"] === true, breakpoints: verified });
      } catch (err) { return fail(err); }
    },
  );

  server.registerTool(
    "dbg_continue",
    {
      title: "Continue",
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
    "dbg_step",
    {
      title: "Step",
      description:
        "Step execution: 'over' (next), 'in' (stepIn), or 'out' (stepOut), then wait for the step to land. " +
        "Returns the resulting state and stop reason. Note: stepOut may be unsupported on older Godot builds.",
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
    "dbg_stack_trace",
    {
      title: "Stack trace",
      description: "Return the current call stack (only meaningful while stopped at a breakpoint).",
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
    "dbg_scopes",
    {
      title: "Scopes",
      description: "Return the variable scopes (Locals, Members, Globals) for a stack frame.",
      inputSchema: { frame_id: z.number().int().describe("Frame id from dbg_stack_trace") },
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
    "dbg_variables",
    {
      title: "Variables",
      description: "List variables under a scope or a complex value (via its variables_ref).",
      inputSchema: { variables_ref: z.number().int().describe("variablesReference from dbg_scopes or a parent variable") },
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
    "dbg_evaluate",
    {
      title: "Evaluate expression",
      description:
        "Evaluate a GDScript expression in the context of a stopped frame. DESTRUCTIVE: arbitrary code execution — confirm with the user and keep this capability gated.",
      inputSchema: {
        expression: z.string().describe("GDScript expression to evaluate"),
        frame_id: z.number().int().optional().describe("Frame id (from dbg_stack_trace); omit for the top frame"),
        confirm: z.boolean().optional().describe("Auto-approve this arbitrary-code evaluation (skip the confirmation prompt)"),
      },
    },
    async ({ expression, frame_id, confirm }) => {
      try {
        const blocked = await gate(server, confirm, `Evaluate expression in the running game: ${expression}`);
        if (blocked) return blocked;
        const body = await dap.request("evaluate", { expression, frameId: frame_id, context: "repl" });
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
        if (clear) dap.clearWatches();
        if (remove && remove.length) dap.removeWatches(remove);
        if (add && add.length) dap.addWatches(add);
        const watches = await dap.evaluateWatches(frame_id);
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
        "active filters and lists `available_filters` — the exception filters the connected adapter actually advertises (empty if it advertises none). " +
        "Requires a running debug session. Not gated (it only configures the debugger).",
      inputSchema: {
        filters: z.array(z.string()).optional().describe("Exception filter IDs to enable (default none = clear). Choose from available_filters in the result."),
      },
    },
    async ({ filters }) => {
      try {
        const active = filters ?? [];
        const body = await dap.request("setExceptionBreakpoints", { filters: active });
        const advertised = dap.capabilities?.["exceptionBreakpointFilters"];
        const available_filters = Array.isArray(advertised)
          ? (advertised as Array<{ filter?: string; label?: string }>).map((f) => ({ filter: f.filter ?? "", label: f.label ?? "" }))
          : [];
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
        const body = await dap.request("setVariable", { variablesReference: variables_ref, name, value });
        return ok({ name, value: String(body["value"] ?? value), type: String(body["type"] ?? ""), variables_ref: (body["variablesReference"] as number) ?? 0 });
      } catch (err) { return fail(err); }
    },
  );
}

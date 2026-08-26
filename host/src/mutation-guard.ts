import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { annotationsFor } from "./annotations.js";
import { TASK_TTL_MS, TASK_POLL_INTERVAL_MS, type RequestTaskStoreLike } from "./tasks.js";
import type { Result } from "@modelcontextprotocol/sdk/types.js";
import { pauseLatch, type PauseLatch } from "./pause.js";
import { gate, type ToolResult } from "./confirm.js";

/**
 * mutation-guard.ts — session 282. TWO SHIPPED SAFETY SENTENCES, MADE TRUE.
 *
 * 🔴 BOTH WERE MEASURED FALSE ON THE PUBLISHED 1.82.1, BY DRIVING THE TARBALL
 * OVER STDIO. They are not doc rot: each names a property a user plans around.
 *
 *   USER_GUIDE §9 — *"the host also honors SIGUSR1 (pause) / SIGUSR2 (resume) —
 *   a finer latch that holds only mutating actions but across the WHOLE tool
 *   surface."*
 *
 * The latch lived inside `gate()`, which runs only for confirmation-gated tools.
 * Timed run with `BREAKPOINT_START_PAUSED=1`: `node_add` and `scene_save` were
 * DISPATCHED while paused (t=1.00s, t=1.50s); `node_delete`, gated, was HELD
 * until SIGUSR2 at t=7.00s. 111 of the 279 secure-default tools are neither
 * read-only nor gated — every `anim_*`, `body_*`, `tilemap_*` writer among them.
 *
 *   TOOL_CATALOG — *"Every tool flagged destructive accepts an optional
 *   `confirm: boolean` … so a destructive op is never executed silently."*
 *
 * 23 of the 89 `destructiveHint: true` tools took no `confirm` at all — the
 * parameter was absent from `tools/list`, so no caller could have passed it.
 * `tilemap_clear` and `node_change_type` dispatched against a client declaring
 * no elicitation capability, in the same run where `node_delete` correctly
 * refused.
 *
 * 🔵 THE REPAIR IS A SEAM, NOT TWENTY-THREE EDITS, AND THAT IS THE WHOLE POINT.
 * A roster of tools-to-gate is a population somebody has to keep true, and the
 * reason those 23 were ungated is that nobody added the parameter — which is
 * exactly what a roster fails to prevent. Both guards DERIVE their population
 * from `annotationsFor`, the table `tools/list` already publishes: the surface a
 * client is told is destructive and the surface that gates are one set, and a
 * tool added tomorrow is covered by being annotated rather than by being
 * remembered. 281's finding, one plane over: a derived population re-argues
 * itself on every run.
 *
 * 🔴 AND THE TWO GUARDS ARE SEPARATE BECAUSE THEIR POPULATIONS ARE. Everything
 * destructive mutates, and not everything that mutates is destructive: the pause
 * latch answers *hold anything that writes* and the confirmation gate answers
 * *never discard state silently*. Folding them into one wrapper would have made
 * the wider claim true only where the narrower one already was, which is the
 * defect being repaired.
 */

/** The `confirm` parameter, injected into a destructive tool that declares none. */
const CONFIRM_FIELD = {
  confirm: z
    .boolean()
    .optional()
    .describe("Auto-approve this destructive action (skip the confirmation prompt)"),
};

type RegisterFn = (name: string, config: unknown, handler: unknown) => unknown;

interface Registrar {
  registerTool: RegisterFn;
  experimental?: { tasks?: { registerToolTask?: RegisterFn } };
}

/** Apply one `registerTool` wrapper to BOTH registration paths. */
function wrapBothPaths(server: McpServer, inject: (raw: RegisterFn) => RegisterFn): void {
  const s = server as unknown as Registrar;
  s.registerTool = inject(s.registerTool.bind(server) as never);
  // D2 task-model tools register through experimental.tasks.registerToolTask and
  // never through registerTool — the same second path applyAnnotations,
  // applyCapabilities and applyTimeoutCaveat each have to cover. A guard that
  // covered one of them would be a guard with a hole exactly where the
  // long-running jobs are.
  const tasks = s.experimental?.tasks;
  if (tasks?.registerToolTask) {
    tasks.registerToolTask = inject(tasks.registerToolTask.bind(tasks) as never);
  }
}

/**
 * A task tool's handler is an OBJECT, not a function, and `createTask` is where
 * the work starts.
 *
 * 🔴 282 — FOUND BY THE NEW TEST ON ITS FIRST RUN, AND IT WAS THE SHARPEST OF
 * THE THREE FAILURES. Both guards began life with the same `typeof handler !==
 * "function"` bail every other wrapper in this tree uses — and that bail is
 * FAIL-OPEN. `registerTaskTool` hands `registerToolTask` a
 * `{ createTask, getTask, getTaskResult }` bag, so the three D2 task tools fell
 * straight through both guards and `godot_run_headless_script` — the single most
 * dangerous tool on the surface, which EXECUTES a GDScript — kept no
 * confirmation at all. The guard would have shipped green over a population it
 * had silently declined to cover, which is 281's finding in the file written to
 * repair 281's finding.
 *
 * 🔵 `applyTimeoutCaveat` HAS THE SAME BLINDNESS AND IS NOT REPAIRED HERE — a
 * missing caveat sentence is not a missing guard, and the fix belongs with a row
 * of its own rather than folded in behind this one.
 */
type TaskHandler = { createTask: (...a: unknown[]) => unknown };

function isTaskHandler(h: unknown): h is TaskHandler {
  return typeof h === "object" && h !== null && typeof (h as TaskHandler).createTask === "function";
}

/**
 * Apply `wrap` to whichever entry point this handler actually has, or return
 * `null` when it has neither — a shape this reader does not understand is
 * reported by `UNGUARDED_HANDLER_SHAPE` in the test rather than passed through.
 */
function wrapEntry(handler: unknown, check: (args: unknown[]) => Promise<ToolResult | null>): unknown | null {
  if (typeof handler === "function") {
    const fn = handler as (...a: unknown[]) => unknown;
    return async (...args: unknown[]) => (await check(args)) ?? fn(...args);
  }
  if (isTaskHandler(handler)) {
    const h = handler as TaskHandler;
    const inner = h.createTask.bind(h);
    return {
      ...h,
      createTask: async (...args: unknown[]) => {
        const blocked = await check(args);
        return blocked ? refuseAsTask(args, blocked) : inner(...args);
      },
    };
  }
  return null;
}

/**
 * 🆕 284 — A REFUSAL THE TASK MODEL CAN CARRY, because a ToolResult is not one.
 *
 * 🔴 282 GAVE BOTH GUARDS A TASK-HANDLER BRANCH AND DROVE ONLY THE PASS-THROUGH HALF.
 * The branch above was written because `typeof handler !== "function"` is FAIL-OPEN and
 * `godot_run_headless_script` — the one tool on this surface that EXECUTES a GDScript —
 * had fallen through both guards. It was wrapped correctly. What nobody could call from a
 * container is the OTHER direction: the guard actually blocking.
 *
 * `createTask` has a return type, `{ task }`, and the SDK immediately reads `.task.taskId`
 * off it. Returning the gate's ToolResult there means the SDK dereferences `undefined`,
 * so a user who omitted `confirm` got `Cannot read properties of undefined (reading
 * 'taskId')` — a raw JS TypeError, with no confirmation prompt, no remedy and nothing
 * naming the tool. Measured at 284 against a live Godot 4.7 by calling the tool the way
 * the guide does; with `confirm: true` the same call runs fine, which is what made the
 * shape obvious.
 *
 * 🔵 THE REPAIR ANSWERS IN THE TASK'S CURRENCY RATHER THAN AROUND IT. The task is
 * created and its result is stored as `failed` in the same tick, so a task-aware client
 * sees an ordinary failed task and a plain client gets the SDK's auto-poll returning the
 * refusal text — which is byte-identical to what the same refusal looks like on every
 * non-task gated tool. Throwing instead would have been fewer lines and would have made
 * one tool answer a confirmation refusal in a different dialect from the other 73.
 *
 * 🔴 AND THE POPULATION IS ONE TOOL TODAY, WHICH IS THE ARGUMENT FOR THE SEAM AND NOT
 * AGAINST IT. Destructive ∩ task-registered = `godot_run_headless_script` alone. The
 * moment `godot_export` or `godot_import` is annotated destructive — and `godot_export`
 * writes a caller-supplied path — it joins, and nothing would have said so.
 */
async function refuseAsTask(args: unknown[], refusal: ToolResult): Promise<unknown> {
  const extra = args[1] as { taskStore?: RequestTaskStoreLike } | undefined;
  const store = extra?.taskStore;
  if (!store) {
    // Nothing to answer in: fail loudly rather than let the call through. A guard that
    // silently passes because it could not build its refusal is the fail-open shape 282
    // opened this branch to remove.
    throw new Error(refusal.content.map((c) => c.text).join(" "));
  }
  const task = await store.createTask({ ttl: TASK_TTL_MS, pollInterval: TASK_POLL_INTERVAL_MS });
  await store.storeTaskResult(task.taskId, "failed", refusal as unknown as Result);
  return { task };
}

/** True when the registered config already offers the caller a `confirm`. */
export function declaresConfirm(config: unknown): boolean {
  const c = config as { inputSchema?: Record<string, unknown> } | undefined;
  return Boolean(c?.inputSchema && Object.prototype.hasOwnProperty.call(c.inputSchema, "confirm"));
}

/**
 * The tools this build would gate and inject `confirm` into, given the surface's
 * own registrations. Exported so a test can take the reading over the REAL
 * registry rather than over a list somebody typed.
 */
export function gateTargets(entries: ReadonlyArray<{ name: string; config: unknown }>): string[] {
  return entries
    .filter((e) => annotationsFor(e.name).destructiveHint && !declaresConfirm(e.config))
    .map((e) => e.name)
    .sort();
}

/** The blocking result for a mutating call that arrived while the agent was paused. */
export function pausedResult(name: string): ToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text:
          `Paused — the agent is currently paused, so "${name}" was held and NOT executed. ` +
          `Resume the agent (SIGUSR2), then re-run the tool.`,
      },
    ],
  };
}

/**
 * Hold ENTRY to every MUTATING tool while the operator has the agent paused.
 *
 * 🔴 THE POPULATION IS `readOnlyHint === false`, WHICH IS FAIL-SAFE IN THE ONE
 * DIRECTION THAT MATTERS. A tool absent from `annotations.ts`'s READ_ONLY list —
 * including a tool absent from the roster entirely — is treated as mutating and
 * held. The mistake this can make is holding a read that did not need holding;
 * the mistake it cannot make is letting a write through, which is the mistake
 * the old seam made 111 times on the default surface.
 *
 * In-flight calls are never interrupted; that is unchanged and is the semantic
 * `pause.ts` describes. What changed is only WHICH calls reach the latch.
 */
export function applyPauseLatch(server: McpServer, latch: PauseLatch = pauseLatch): void {
  wrapBothPaths(server, (raw) => (name: string, config: unknown, handler: unknown) => {
    if (annotationsFor(name).readOnlyHint) return raw(name, config, handler);
    // 🆕 284 — `check` returns the refusal or `null` for pass-through, and the
    // pass-through side effect belongs to the check. `wrapEntry` owns the SHAPE
    // difference between a plain handler and a task handler, so it is answered in
    // exactly one place rather than once per guard — which is what let the task
    // branch be half-written for two sessions without either caller noticing.
    const held = wrapEntry(handler, async () => {
      if (latch.isPaused()) {
        const resumed = await latch.awaitResumed();
        if (!resumed) return pausedResult(name);
      }
      latch.record(name);
      return null;
    });
    return raw(name, config, held ?? handler);
  });
}

/**
 * Give every DESTRUCTIVE tool that declares no `confirm` both the parameter and
 * the gate, so the catalog's sentence is true of the whole set.
 *
 * 🔴 THE PREDICATE IS THE REGISTERED `inputSchema`, NOT A ROSTER OF EXCEPTIONS,
 * and it had to be: a tool that gates itself spells `confirm` through a shared
 * `...confirmField` spread, which a grep over its own registration span cannot
 * see and this reader gets for free — the config it is handed is the object, and
 * the spread has already happened. `declaresConfirm` is therefore a measurement
 * of the surface rather than a claim about the source, which is why the seven
 * `*_scaffold` / `asset_gen_*` tools that gate through a shared helper are
 * correctly left alone while `tilemap_clear` is not.
 *
 * 🔴 AND INJECTING THE FIELD IS HALF THE FIX, NOT A CONVENIENCE. Wrapping the
 * handler alone would block the 23 tools on every client that cannot elicit,
 * with no parameter anywhere for the caller to use to proceed — a guarantee
 * kept by making the tools unusable. The field and the gate arrive together or
 * neither should.
 */
export function applyDestructiveGate(server: McpServer): void {
  wrapBothPaths(server, (raw) => (name: string, config: unknown, handler: unknown) => {
    if (!annotationsFor(name).destructiveHint || declaresConfirm(config)) {
      return raw(name, config, handler);
    }
    const gated = wrapEntry(handler, async (args: unknown[]) => {
      const a = (args[0] ?? {}) as { confirm?: boolean };
      return await gate(server, a.confirm, `${name} (destructive)`);
    });
    if (gated === null) return raw(name, config, handler);
    const cfg = config as { inputSchema?: Record<string, unknown> } | undefined;
    const nextConfig = { ...(cfg ?? {}), inputSchema: { ...(cfg?.inputSchema ?? {}), ...CONFIRM_FIELD } };
    return raw(name, nextConfig, gated);
  });
}

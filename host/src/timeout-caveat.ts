/**
 * A bridge timeout does not mean nothing happened — and until now the error said
 * it did.
 *
 * `Bridge error [timeout]` reads as "the call did not go through". It is not what
 * the host knows. `request()` awaits `connect()` first, so a genuinely
 * unreachable editor fails EARLIER and differently, as `bridge_unavailable`. By
 * the time a `timeout` can be reported the connection was established and the
 * payload was handed to the kernel — measured at the instant of rejection:
 * `bytesWritten=130`, `destroyed=false`. Meanwhile the addon polls its socket
 * from `_process`, once per frame, and dispatches synchronously
 * (`bridge_server.gd:186`), so the ordinary outcome of a premature deadline is
 * that the editor applies the mutation and answers a moment too late.
 *
 * An agent told only "timed out" retries. On a mutating, non-idempotent tool that
 * applies the change twice — reproduced end to end as two `Enemy` nodes after two
 * reported failures. The host cannot PREVENT that retry: it arrives as a fresh
 * MCP tool call with a fresh `randomUUID()`, so nothing in `bridge.ts` can
 * recognise it as a retry rather than a legitimate repeat. What the host can do
 * is stop implying the change did not land.
 *
 * So the caveat is scaled by the annotations every tool already carries, rather
 * than being one blanket hedge:
 *
 *   • readOnlyHint            → NOTHING. A stale read is not a hazard, and
 *                               `peers.ts:163` deliberately runs a 1 s liveness
 *                               ping whose timeout is routine.
 *   • mutating + idempotent   → warn, but say retrying is safe.
 *   • mutating, NOT idempotent→ warn, and say retrying may apply it twice —
 *                               `node_add`, `node_duplicate`,
 *                               `node_instantiate_scene`, `card_instance`, …
 *
 * Class sizes, derived from `annotations.ts` and checked by the gate rather than
 * asserted here: `read-only` 92 tools · `mutating` 197 tools ·
 * `mutating+idempotent` 125 tools · `mutating+non-idempotent` 72 tools.
 *
 * This is the only layer that CAN target it. `bridge.ts` sees a GDScript method
 * string and never a tool name, and `makeCall` (`tools/editor/common.ts:24`) does
 * not take one either; the tool name exists here, at registration, exactly as it
 * does for `applyAnnotations`.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { annotationsFor } from "./annotations.js";

/**
 * The marker identifying a bridge timeout envelope, built by
 * `tools/editor/common.ts`'s `fail()`. Deliberately narrow: LSP and DAP timeouts
 * are a different transport with a different failure mode (no editor-side
 * mutation is implied), and `tools/dap.ts:29` / `tools/csdap.ts:31` branch on
 * their own `/timed out after/` predicate, which this must not disturb.
 */
const BRIDGE_TIMEOUT_MARK = "Bridge error [timeout]";

/** Mutating, but repeating it lands in the same state — retrying is safe. */
export const CAVEAT_IDEMPOTENT =
  "The request WAS delivered to the editor and may already have been applied. " +
  "This tool is idempotent, so retrying is safe.";

/** Mutating and NOT idempotent — this is where a blind retry duplicates. */
export const CAVEAT_NON_IDEMPOTENT =
  "The request WAS delivered to the editor and may already have been applied. " +
  "Retrying may apply it a SECOND time — verify the editor state before you do.";

/**
 * The caveat a given tool's timeout envelope should carry, or null for the
 * read-only tools that should carry none.
 */
export function caveatFor(name: string): string | null {
  const a = annotationsFor(name);
  if (a.readOnlyHint) return null;
  return a.idempotentHint ? CAVEAT_IDEMPOTENT : CAVEAT_NON_IDEMPOTENT;
}

/**
 * Append `caveat` to the first text block carrying the bridge-timeout marker.
 *
 * APPENDS — never rewrites. The existing sentence, including its exact
 * `timed out after <n>ms` phrasing, is load-bearing elsewhere. Anything that is
 * not a bridge-timeout error envelope is returned untouched, by identity, so a
 * tool that never speaks to the bridge is unaffected even though it is wrapped.
 */
export function appendCaveat(result: unknown, caveat: string): unknown {
  const r = result as { isError?: boolean; content?: unknown } | null | undefined;
  if (!r || r.isError !== true || !Array.isArray(r.content)) return result;
  let done = false;
  const content = (r.content as Array<Record<string, unknown>>).map((block) => {
    if (done || block?.["type"] !== "text") return block;
    const text = block["text"];
    if (typeof text !== "string" || !text.includes(BRIDGE_TIMEOUT_MARK)) return block;
    done = true;
    return { ...block, text: `${text} ${caveat}` };
  });
  return done ? { ...r, content } : result;
}

/**
 * Wrap `server.registerTool` so a bridge-timeout envelope leaves with a caveat
 * matching the tool's own annotations.
 *
 * Mirrors `applyOutputSchemas` / `applyAnnotations` / `applyCapabilities`; call
 * once, AFTER `applyAnnotations` and BEFORE `applyCapabilities`, so a tool
 * dropped by a disabled capability group is never wrapped at all.
 *
 * Read-only tools are not wrapped — not wrapped-and-inert, actually not wrapped —
 * so 92 of the 289 handlers keep their exact previous identity.
 */
export function applyTimeoutCaveat(server: McpServer): void {
  const inject =
    (raw: (name: string, config: unknown, handler: unknown) => unknown) =>
    (name: string, config: unknown, handler: unknown) => {
      const caveat = caveatFor(name);
      if (!caveat || typeof handler !== "function") return raw(name, config, handler);
      const inner = handler as (...args: unknown[]) => unknown;
      const wrapped = (...args: unknown[]) => {
        const out = inner(...args);
        // Preserve synchronicity: only a promise-returning handler gets a
        // promise back, so nothing's timing changes just by being wrapped.
        return out instanceof Promise ? out.then((v) => appendCaveat(v, caveat)) : appendCaveat(out, caveat);
      };
      return raw(name, config, wrapped);
    };

  const s = server as unknown as {
    registerTool: (name: string, config: unknown, handler: unknown) => unknown;
    experimental?: { tasks?: { registerToolTask?: (name: string, config: unknown, handler: unknown) => unknown } };
  };

  s.registerTool = inject(s.registerTool.bind(server) as never);

  // The D2 task-model tools register through experimental.tasks.registerToolTask,
  // not registerTool — same reason applyAnnotations covers both paths.
  const tasks = s.experimental?.tasks;
  if (tasks?.registerToolTask) {
    tasks.registerToolTask = inject(tasks.registerToolTask.bind(tasks) as never);
  }
}

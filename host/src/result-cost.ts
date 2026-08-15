/**
 * The half of client cost the cost instrument could not see.
 *
 * 🔴 `token-cost.mjs` GOVERNS THE MENU AND THE MEAL WAS NEVER MEASURED (249, closed
 * 257). Its unit is `JSON.stringify(tools)` from a live `tools/list` — the catalogue a
 * client puts in the model's context once — against a byte ceiling that file owns, and
 * its own header says the rest out loud: *"it reads the tool list over stdio and never
 * calls a tool."* One `gd_completion` was measured returning, in a single result, very
 * nearly the byte cost of the ENTIRE advertised surface. The instrument read that tree
 * and printed `ok`, correctly, about a question nobody was asking.
 *
 * This is the missing axis, and it is deliberately a METER rather than a gate: results
 * depend on a live engine, a live language server and a real project, so nothing here can
 * refuse at build time without lying about what it measured. What it can do is make the
 * number obtainable and repeatable — `BREAKPOINT_RESULT_COST=<path>` records one line per
 * call, and `token-cost.mjs --results <path>` reads them back against a ceiling. A number
 * that lives in a handoff is a measurement; a number a command can re-take is an
 * instrument, and 249's 342,116 B has been the first kind for eight sessions.
 *
 * 🔴 ONE WRAPPER, AT THE ONE POINT THAT KNOWS BOTH HALVES. `ok()` builds the envelope but
 * is not told which tool it is answering for — and it is not even one function: six
 * byte-identical copies exist across the tool files. The `CallTool` dispatcher sees the
 * name and the result together, and `applyDroppedToolRefusal` already proves the SDK's
 * handler map can be wrapped in place. This adds one more branch in front of it.
 *
 * OFF BY DEFAULT, and off means absent: with the variable unset no wrapper is installed
 * at all, so the measured path is the shipped path plus nothing.
 */
import fs from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { log } from "./logger.js";

const CALL_TOOL_METHOD = "tools/call";

/** The env var that turns the meter on, and names the file it writes. */
export const RESULT_COST_ENV = "BREAKPOINT_RESULT_COST";

/** One measured call. `token-cost.mjs --results` parses exactly this shape. */
export interface ResultCostRecord {
  /** The tool that was called. */
  tool: string;
  /** `JSON.stringify(result)` in UTF-8 bytes — the unit `token-cost.mjs` already uses. */
  bytes: number;
}

/**
 * The wire cost of one tool result, in the same unit the catalogue is measured in.
 *
 * 🔴 THE WHOLE RESULT, NOT THE PAYLOAD. `ok()` returns `content[0].text` — the payload
 * pretty-printed at two-space indent — AND `structuredContent`, the same object again.
 * Measuring the payload once would understate what crosses the wire by roughly half, and
 * the point of this module is to stop understating it.
 */
export function resultBytes(result: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(result) ?? "", "utf8");
  } catch {
    // A result that cannot be stringified cannot have crossed the wire either, so
    // there is no honest number to record. Zero is the absence of a measurement and
    // the reader treats it as one.
    return 0;
  }
}

/** Render one record as the reader's line format: `tool<TAB>bytes`. */
export function formatRecord(rec: ResultCostRecord): string {
  return `${rec.tool}\t${rec.bytes}\n`;
}

/**
 * Install the meter, if `BREAKPOINT_RESULT_COST` names a file to write.
 *
 * Returns whether it installed, so a caller — and a test — can tell "off" from
 * "on but the dispatcher was missing", which are the same silence otherwise.
 */
export function applyResultCost(server: McpServer, env: NodeJS.ProcessEnv = process.env): boolean {
  const path = env[RESULT_COST_ENV];
  if (!path) return false;

  type RawHandler = (request: unknown, extra: unknown) => Promise<unknown>;
  const proto = (server as unknown as { server?: { _requestHandlers?: Map<string, RawHandler> } }).server;
  const handlers = proto?._requestHandlers;
  const inner = handlers?.get(CALL_TOOL_METHOD);
  // No dispatcher means no tool was ever registered; there is nothing to meter.
  if (!handlers || !inner) return false;

  handlers.set(CALL_TOOL_METHOD, async (request: unknown, extra: unknown) => {
    const result = await inner(request, extra);
    const name = (request as { params?: { name?: unknown } } | undefined)?.params?.name;
    if (typeof name === "string") {
      try {
        fs.appendFileSync(path, formatRecord({ tool: name, bytes: resultBytes(result) }));
      } catch (err) {
        // A meter that takes the server down is worse than a meter that misses a line.
        log(`[result-cost] could not append to ${path}: ${(err as Error).message}`);
      }
    }
    return result;
  });
  log(`[result-cost] metering tool results to ${path}`);
  return true;
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { pauseLatch } from "./pause.js";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Gate a destructive action behind MCP elicitation (a client-side confirmation
 * prompt). Returns `null` when the action may proceed, or a blocking tool result
 * when it must not.
 *
 * Degradation: if the caller passed `confirm: true`, we skip the prompt. If the
 * client does not support elicitation (elicitInput throws), we block and tell
 * the user to re-run with `confirm: true` — so a destructive op is never
 * executed silently on a client that can't ask.
 */
export async function gate(
  server: McpServer,
  confirm: boolean | undefined,
  summary: string,
): Promise<ToolResult | null> {
  // Track 2 — global-pause overlay. Coarser than the per-tool elicitation below
  // (which stays the lead control): while the operator has the agent paused, hold
  // ENTRY to this mutating action until they resume or the wait times out — then
  // block rather than act. In-flight ops and read-only tools are never affected.
  if (pauseLatch.isPaused()) {
    const resumed = await pauseLatch.awaitResumed();
    if (!resumed) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              `Paused — the agent is currently paused, so "${summary}" was held and NOT executed. ` +
              `Resume the agent (SIGUSR2), then re-run the tool.`,
          },
        ],
      };
    }
  }
  pauseLatch.record(summary);
  if (confirm === true) return null;
  try {
    const res = await server.server.elicitInput({
      message: `Destructive action — confirm to proceed:\n${summary}`,
      requestedSchema: {
        type: "object",
        properties: {
          proceed: { type: "boolean", title: "Proceed with this action?", description: summary },
        },
        required: ["proceed"],
      },
    });
    if (res.action === "accept" && res.content?.proceed === true) return null;
    return {
      isError: true,
      content: [{ type: "text", text: `Cancelled — user did not approve: ${summary}` }],
    };
  } catch (err) {
    // 🔴 261 — ONE `catch` WAS COVERING THREE DIFFERENT CAUSES AND NAMING THE THIRD.
    //
    // Measured at 261 against the published 1.76.0: a client that DECLARES elicitation
    // and then answers with content that does not satisfy `requestedSchema` gets
    // "interactive confirmation isn't available on this client" — a sentence about the
    // client's CAPABILITIES, printed because of a bad ANSWER — followed by the one
    // remedy that skips the confirmation the user was in the middle of giving. That is
    // 260's standing rule ("a diagnostic that names a state is not a diagnosis of its
    // cause") landing on the safety control itself, and the misdiagnosis points at the
    // bypass, which is the wrong direction for a gate to fail in.
    //
    // The capability is knowable, so ask instead of inferring it from a throw. Only the
    // genuinely unsupported client is told to re-run with `confirm: true`; a client that
    // CAN ask and failed is told the attempt failed and why, because the next action
    // there is to fix the answer, not to bypass the prompt.
    const supportsElicitation = (() => {
      try {
        return !!server.server.getClientCapabilities()?.elicitation;
      } catch {
        return false;
      }
    })();
    if (!supportsElicitation) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              `This is a destructive action (${summary}) and interactive confirmation ` +
              `isn't available on this client. Re-run the tool with confirm: true to proceed.`,
          },
        ],
      };
    }
    const detail = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text:
            `This is a destructive action (${summary}) and NOTHING WAS DONE. This client ` +
            `declares elicitation support, so the confirmation prompt was sent and the ` +
            `attempt failed: ${detail}. Fix the client's elicitation response (it must be ` +
            `{"action":"accept","content":{"proceed":true}}) and retry — or, if you mean to ` +
            `skip the prompt deliberately, re-run with confirm: true.`,
        },
      ],
    };
  }
}

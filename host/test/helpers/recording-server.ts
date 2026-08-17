/**
 * A minimal stand-in for McpServer that records every registerTool /
 * registerResource call so tests can (a) assert the registered surface and
 * (b) pull a specific tool's handler out and invoke it directly — without
 * standing up an MCP transport. It also exposes a configurable
 * `server.elicitInput` so the destructive-action gate can be exercised.
 *
 * Register functions are typed against the real McpServer; call them with
 * `recordingServer as unknown as McpServer`.
 */

export type ToolHandler = (args: Record<string, unknown>, extra?: unknown) => Promise<ToolResultLike>;

export interface ToolResultLike {
  content?: Array<{ type: string; text?: string; [k: string]: unknown }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  [k: string]: unknown;
}

export interface RecordedTool {
  name: string;
  config: Record<string, unknown>;
  handler: ToolHandler;
}

export type ElicitFn = (req: unknown) => Promise<{ action: string; content?: Record<string, unknown> }>;

/**
 * 🆕 261 — the client's DECLARED capabilities, which `confirm.ts` now reads to tell
 * "this client cannot be asked" apart from "this client was asked and the answer did
 * not parse". Before 261 both printed the first sentence and pointed at the
 * `confirm: true` bypass, so a malformed answer was reported as an absent feature and
 * the remedy named was the one that skips the prompt.
 */
export interface RecordingServer {
  registerTool(name: string, config: Record<string, unknown>, handler: ToolHandler): { name: string };
  registerResource(name: string, ...rest: unknown[]): void;
  server: { elicitInput: ElicitFn; getClientCapabilities(): Record<string, unknown> | undefined };
}

export function makeRecordingServer(elicit?: ElicitFn, clientCapabilities?: Record<string, unknown>): {
  server: RecordingServer;
  tools: Map<string, RecordedTool>;
  resources: string[];
  handler(name: string): ToolHandler;
} {
  const tools = new Map<string, RecordedTool>();
  const resources: string[] = [];

  const server: RecordingServer = {
    registerTool(name, config, handler) {
      tools.set(name, { name, config, handler });
      return { name };
    },
    registerResource(name) {
      resources.push(name);
    },
    server: {
      // Default: behave like a client that declined. Tests override as needed.
      elicitInput: elicit ?? (async () => ({ action: "decline" })),
      // Default: a client that declares elicitation — which is what a client reaching
      // the prompt at all must have done. Pass `{}` for one that does not.
      getClientCapabilities: () => clientCapabilities ?? { elicitation: {} },
    },
  };

  return {
    server,
    tools,
    resources,
    handler(name: string): ToolHandler {
      const t = tools.get(name);
      if (!t) throw new Error(`tool not registered: ${name}`);
      return t.handler;
    },
  };
}

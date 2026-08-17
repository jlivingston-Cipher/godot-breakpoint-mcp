import { fileURLToPath } from "node:url";
import type { FramedMessage, JsonRpcChannel } from "./framing.js";
import { LspError, type Diagnostic } from "./lsp.js";
import { OverdueLedger, type LateReply } from "./late-reply.js";
import { closeDetail, closeRemedy } from "./close-cause.js";
import { packageVersion } from "./version.js";

/**
 * Who answers this plane, in the words its late-reply ledger already uses.
 *
 * 🔴 ONE CONSTANT, TWO READERS (264). The ledger names this peer when a reply arrives
 * late and `closeRemedy` names it when the connection drops. Two literals would let the
 * same peer acquire two names on the same run, which is the class of drift 257's
 * per-instance deadline noun was written to stop.
 */
const CSLSP_PEER = "the language server";

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * Minimal LSP client for the C#/.NET semantic plane (D4 C2). Transport-agnostic:
 * it drives any `JsonRpcChannel`, so production spawns OmniSharp over stdio
 * (`StdioChannel`) while unit tests point it at a loopback TCP mock (`FramedConnection`)
 * exactly as the GDScript `LspClient` tests do.
 *
 * It is deliberately a sibling of `LspClient` rather than a shared base class —
 * matching the codebase's one-client-per-protocol precedent (lsp.ts / dap.ts) —
 * but reuses `LspError`, `Diagnostic`, and the framing primitives so the protocol
 * plumbing isn't re-invented. The only C#-specific behaviors are the `csharp`
 * `languageId` on didOpen and pointing at the C# project root; everything else is
 * standard LSP the same way Godot's GDScript server is.
 */
export class CsLspClient {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private initialized: Promise<unknown> | null = null;
  private serverCapabilities: Record<string, unknown> | null = null;
  private opened = new Set<string>();
  private diagnostics = new Map<string, Diagnostic[]>();
  private diagWaiters = new Map<string, Array<() => void>>();
  /**
   * Ids whose deadline fired, so a reply arriving later is recognised, not
   * dropped. `nextId` is monotonic and is deliberately NOT reset by onClose(),
   * so an id is never reused and a late reply can only be its own request's.
   */
  private readonly ledger = new OverdueLedger<number>("C# LSP", CSLSP_PEER, "GODOT_CSLSP_TIMEOUT_MS");
  /** Absolute project root path (no trailing slash), used to canonicalize URIs. */
  private readonly rootFsPath: string;

  constructor(
    private readonly channel: JsonRpcChannel,
    private readonly rootUri: string,
    private readonly timeoutMs: number,
  ) {
    let root = "";
    try {
      root = fileURLToPath(rootUri);
    } catch {
      root = rootUri.replace(/^file:\/\//, "");
    }
    this.rootFsPath = root.replace(/[\\/]+$/, "");
    this.channel.onMessage((m) => this.onMessage(m));
    this.channel.onClose((cause) => this.onClose(cause));
  }

  /**
   * Reduce any document URI to a stable, project-relative key (e.g. "Player.cs")
   * so a published-diagnostics URI matches the one we opened the file with,
   * regardless of how the server spells it (percent-encoded vs literal `file://`).
   * Mirrors LspClient.diagKey; OmniSharp uses `file://` URIs, but keeping the
   * `res://` branch costs nothing and keeps the two clients uniform.
   */
  private diagKey(uri: string): string {
    let s = uri;
    try {
      s = decodeURIComponent(uri);
    } catch {
      /* keep raw on malformed encoding */
    }
    if (s.startsWith("res://")) return s.slice("res://".length).replace(/^[\\/]+/, "");
    if (s.startsWith("file://")) s = s.slice("file://".length);
    if (this.rootFsPath && s.startsWith(this.rootFsPath)) s = s.slice(this.rootFsPath.length);
    return s.replace(/\\/g, "/").replace(/^\/+/, "");
  }

  private onMessage(msg: FramedMessage): void {
    const id = msg["id"];
    const method = msg["method"];

    // Response to one of our requests.
    if (typeof id === "number" && method === undefined) {
      const p = this.pending.get(id);
      if (!p) {
        // Not pending: either a reply we already gave up on (reconcile + log the
        // overshoot), or a genuinely unknown id — ignored exactly as before.
        this.ledger.reconcile(id, msg["error"] === undefined);
        return;
      }
      this.pending.delete(id);
      clearTimeout(p.timer);
      if (msg["error"]) {
        const e = msg["error"] as { code?: number; message?: string };
        p.reject(new LspError(e.code ?? -1, e.message ?? "LSP error"));
      } else {
        p.resolve(msg["result"] ?? null);
      }
      return;
    }

    // Server -> client notification.
    if (typeof method === "string" && id === undefined) {
      if (method === "textDocument/publishDiagnostics") {
        const params = (msg["params"] ?? {}) as { uri?: string; diagnostics?: unknown[] };
        const uri = params.uri ?? "";
        const diags: Diagnostic[] = (params.diagnostics ?? []).map((d) => {
          const dd = d as { severity?: number; message?: string; range?: { start?: { line?: number; character?: number } } };
          return {
            severity: dd.severity ?? 1,
            message: dd.message ?? "",
            line: dd.range?.start?.line ?? 0,
            character: dd.range?.start?.character ?? 0,
          };
        });
        const key = this.diagKey(uri);
        this.diagnostics.set(key, diags);
        const waiters = this.diagWaiters.get(key);
        if (waiters) {
          this.diagWaiters.delete(key);
          for (const w of waiters) w();
        }
      }
      return;
    }

    // Server -> client request (e.g. client/registerCapability, or OmniSharp's
    // window/workDoneProgress/create): ack with null so the server never blocks
    // waiting for us.
    if (typeof method === "string" && typeof id === "number") {
      void this.channel.send({ jsonrpc: "2.0", id, result: null });
    }
  }

  private onClose(cause?: Error): void {
    const detail = closeDetail(cause);
    // 🔴 THE SAME ERRNO SPLIT `bridge.ts` GOT (264 §3), IN THE MESSAGE BECAUSE THIS CLASS
    // HAS NOWHERE ELSE TO PUT IT. `LspError` carries no `remedy` field, and the plane's
    // `fail()` renders no `remedyClause`, so the next action goes where the caller will
    // actually read it. 264's census records the asymmetry rather than hiding it: of 25
    // host-raised failures about the world, 13 are on classes that cannot carry an answer.
    const remedy = closeRemedy(cause, CSLSP_PEER);
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new LspError("closed", `C# LSP connection closed${detail}${remedy ? ` — ${remedy}` : ""}`));
    }
    this.pending.clear();
    this.initialized = null;
    this.serverCapabilities = null;
    this.opened.clear();
  }

  /**
   * Snapshot of replies that arrived after their deadline, oldest first.
   * Diagnostics only — nothing in the request path reads this.
   */
  recentLateReplies(): readonly LateReply[] {
    return this.ledger.recent();
  }

  private rawRequest<T = unknown>(method: string, params: unknown, timeoutMs = this.timeoutMs): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // Remember the id BEFORE rejecting, so a reply already in flight is
        // reconciled rather than dropped as anonymous.
        this.ledger.note(id, method, timeoutMs);
        reject(new LspError("timeout", `C# LSP '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      this.channel.send({ jsonrpc: "2.0", id, method, params }).catch((err: Error) => {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      });
    });
  }

  private notify(method: string, params: unknown): Promise<void> {
    return this.channel.send({ jsonrpc: "2.0", method, params });
  }

  private ensureInitialized(): Promise<unknown> {
    if (!this.initialized) {
      this.initialized = (async () => {
        const result = (await this.rawRequest("initialize", {
          processId: process.pid,
          rootUri: this.rootUri,
          rootPath: decodeURIComponent(this.rootUri.replace(/^file:\/\//, "")),
          capabilities: {
            textDocument: {
              synchronization: { didSave: true, dynamicRegistration: false },
              completion: { completionItem: { snippetSupport: false } },
              hover: { contentFormat: ["plaintext", "markdown"] },
              definition: {},
              references: {},
              documentSymbol: { hierarchicalDocumentSymbolSupport: true },
              signatureHelp: {},
              publishDiagnostics: {},
            },
            workspace: { symbol: {}, workspaceFolders: true },
          },
          workspaceFolders: [{ uri: this.rootUri, name: "csharp-project" }],
          clientInfo: { name: "breakpoint-mcp", version: packageVersion() },
        })) as { capabilities?: Record<string, unknown> } | null;
        this.serverCapabilities = result?.capabilities ?? {};
        await this.notify("initialized", {});
        return result;
      })();
    }
    return this.initialized;
  }

  async request<T = unknown>(method: string, params: unknown, timeoutMs?: number): Promise<T> {
    await this.ensureInitialized();
    return this.rawRequest<T>(method, params, timeoutMs);
  }

  /**
   * The server's advertised capabilities from the `initialize` handshake (an
   * empty object if none). Lets a cs_* tool feature-detect an optional LSP method
   * before calling it, instead of surfacing a raw `-32601 Method not found`.
   */
  async getServerCapabilities(): Promise<Record<string, unknown>> {
    await this.ensureInitialized();
    return this.serverCapabilities ?? {};
  }

  async ensureOpen(uri: string, text: string): Promise<void> {
    if (this.opened.has(uri)) return;
    await this.ensureInitialized();
    this.opened.add(uri);
    await this.notify("textDocument/didOpen", {
      textDocument: { uri, languageId: "csharp", version: 1, text },
    });
  }

  /** Return cached diagnostics for a URI, waiting up to timeoutMs for the first publish. */
  waitForDiagnostics(uri: string, timeoutMs: number): Promise<Diagnostic[]> {
    const key = this.diagKey(uri);
    if (this.diagnostics.has(key)) return Promise.resolve(this.diagnostics.get(key)!);
    return new Promise<Diagnostic[]>((resolve) => {
      const timer = setTimeout(() => resolve(this.diagnostics.get(key) ?? []), timeoutMs);
      const arr = this.diagWaiters.get(key) ?? [];
      arr.push(() => {
        clearTimeout(timer);
        resolve(this.diagnostics.get(key) ?? []);
      });
      this.diagWaiters.set(key, arr);
    });
  }

  close(): void {
    this.channel.close();
  }
}

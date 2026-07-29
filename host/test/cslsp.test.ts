import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CsLspClient } from "../src/cslsp.js";
import { LspError } from "../src/lsp.js";
import { FramedConnection } from "../src/framing.js";
import { StdioChannel } from "../src/stdio.js";
import { registerCsLspTools } from "../src/tools/cslsp.js";
import { loadConfig } from "../src/config.js";
import type { Config } from "../src/config.js";
import { makeRecordingServer, type ToolResultLike } from "./helpers/recording-server.js";
import { startTcpServer, makeFrameParser, writeFrame, waitFor, type TcpServer } from "./helpers/tcp.js";

interface LspMsg { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: unknown }

interface MockOpts {
  capabilities?: Record<string, unknown>;
  onRequest?: (msg: LspMsg, socket: net.Socket) => void;
  onNotify?: (msg: LspMsg, socket: net.Socket) => void;
}

/** A mock C# language server (OmniSharp stand-in): answers `initialize`, delegates the rest. */
async function startCs(opts: MockOpts): Promise<{ srv: TcpServer; received: LspMsg[] }> {
  const received: LspMsg[] = [];
  const srv = await startTcpServer((s) => {
    const parse = makeFrameParser((m) => {
      const msg = m as LspMsg;
      received.push(msg);
      if (msg.method === "initialize") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: { capabilities: opts.capabilities ?? {} } });
        return;
      }
      if (msg.method !== undefined && msg.id !== undefined) { opts.onRequest?.(msg, s); return; }
      if (msg.method !== undefined && msg.id === undefined) { opts.onNotify?.(msg, s); return; }
    });
    s.on("data", (c) => parse(Buffer.from(c)));
  });
  return { srv, received };
}

/** Full Config whose C# project root is a real temp dir. */
function makeConfig(projectPath: string): Config {
  const saved = process.env.GODOT_CSHARP_PROJECT;
  process.env.GODOT_CSHARP_PROJECT = projectPath;
  try { return loadConfig(); } finally {
    if (saved === undefined) delete process.env.GODOT_CSHARP_PROJECT; else process.env.GODOT_CSHARP_PROJECT = saved;
  }
}

function tmpProject(files: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gcb-cslsp-"));
  for (const [rel, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, rel), content, "utf8");
  return dir;
}

/** Wire a CsLspClient (over a loopback TCP channel) to the cs_* tools on a recording server. */
function csToolHarness(srvPort: number, projectPath: string, elicit?: Parameters<typeof makeRecordingServer>[0]) {
  const cfg = makeConfig(projectPath);
  const channel = new FramedConnection("127.0.0.1", srvPort, "CS-LSP", "test channel");
  const cslsp = new CsLspClient(channel, cfg.csLspProjectUri, 3000);
  const rec = makeRecordingServer(elicit);
  registerCsLspTools(rec.server as unknown as Parameters<typeof registerCsLspTools>[0], cslsp, cfg);
  return { cslsp, rec, cfg };
}

test("cs_definition maps definition locations", async () => {
  const projectPath = tmpProject({ "Player.cs": "public partial class Player : Node2D {}\n" });
  const { srv } = await startCs({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/definition") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [{ uri: "file:///proj/Player.cs", range: { start: { line: 26, character: 15 } } }] });
      }
    },
  });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath);
  const res = (await rec.handler("cs_definition")({ path: "Player.cs", line: 30, character: 12 })) as ToolResultLike;
  assert.equal(res.isError, undefined);
  assert.deepEqual(res.structuredContent, { locations: [{ uri: "file:///proj/Player.cs", line: 26, character: 15 }] });
  cslsp.close();
  await srv.close();
});

test("cs_hover returns the MarkupContent value (e.g. the Counter : int type)", async () => {
  const projectPath = tmpProject({ "Player.cs": "public int Counter { get; set; }\n" });
  const { srv } = await startCs({
    capabilities: { hoverProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/hover") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: { contents: { kind: "markdown", value: "```csharp\nint Player.Counter { get; set; }\n```" } } });
      }
    },
  });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath);
  const res = (await rec.handler("cs_hover")({ path: "Player.cs", line: 0, character: 11 })) as ToolResultLike;
  const sc = res.structuredContent as { contents: string };
  assert.match(sc.contents, /int Player\.Counter/);
  cslsp.close();
  await srv.close();
});

test("cs_completion maps items and CompletionItemKind numbers to readable names", async () => {
  const projectPath = tmpProject({ "Player.cs": "class P {}\n" });
  const { srv } = await startCs({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/completion") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: { items: [
          { label: "TakeDamage", kind: 2, detail: "int Player.TakeDamage(int amount)", insertText: "TakeDamage" },
          { label: "Counter", kind: 10 },
        ] } });
      }
    },
  });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath);
  const res = (await rec.handler("cs_completion")({ path: "Player.cs", line: 0, character: 0 })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { items: [
    { label: "TakeDamage", kind: "method", detail: "int Player.TakeDamage(int amount)", insertText: "TakeDamage" },
    { label: "Counter", kind: "property", detail: "", insertText: "Counter" },
  ] });
  cslsp.close();
  await srv.close();
});

test("cs_references forwards includeDeclaration and maps locations", async () => {
  const projectPath = tmpProject({ "Player.cs": "int Counter;\n" });
  let sent: LspMsg | undefined;
  const { srv } = await startCs({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/references") {
        sent = msg;
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { uri: "file:///proj/Player.cs", range: { start: { line: 13, character: 15 } } },
          { uri: "file:///proj/Player.cs", range: { start: { line: 23, character: 8 } } },
        ] });
      }
    },
  });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath);
  const res = (await rec.handler("cs_references")({ path: "Player.cs", line: 13, character: 15, include_declaration: false })) as ToolResultLike;
  const sc = res.structuredContent as { locations: unknown[] };
  assert.equal(sc.locations.length, 2);
  assert.equal((sent!.params as { context: { includeDeclaration: boolean } }).context.includeDeclaration, false);
  cslsp.close();
  await srv.close();
});

test("cs_document_symbols maps LSP SymbolKind numbers to readable names", async () => {
  const projectPath = tmpProject({ "Player.cs": "public partial class Player {}\n" });
  const { srv } = await startCs({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/documentSymbol") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { name: "Player", kind: 5, range: { start: { line: 11, character: 0 } } },
          { name: "Counter", kind: 7, range: { start: { line: 13, character: 15 } } },
          { name: "TakeDamage", kind: 6, range: { start: { line: 26, character: 15 } } },
        ] });
      }
    },
  });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath);
  const res = (await rec.handler("cs_document_symbols")({ path: "Player.cs" })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { symbols: [
    { name: "Player", kind: "class", line: 11 },
    { name: "Counter", kind: "property", line: 13 },
    { name: "TakeDamage", kind: "method", line: 26 },
  ] });
  cslsp.close();
  await srv.close();
});

test("cs_workspace_symbols returns mapped symbols on OmniSharp (which implements workspace/symbol)", async () => {
  const projectPath = tmpProject();
  const { srv } = await startCs({
    capabilities: { workspaceSymbolProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "workspace/symbol") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { name: "Player", kind: 5, location: { uri: "file:///proj/Player.cs", range: { start: { line: 11, character: 0 } } } },
        ] });
      }
    },
  });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath);
  const res = (await rec.handler("cs_workspace_symbols")({ query: "Player" })) as ToolResultLike;
  assert.equal(res.isError, undefined);
  assert.deepEqual(res.structuredContent, { symbols: [{ name: "Player", kind: "class", uri: "file:///proj/Player.cs", line: 11 }] });
  cslsp.close();
  await srv.close();
});

test("cs_workspace_symbols returns 'unsupported' WITHOUT sending the request when the capability is absent", async () => {
  const projectPath = tmpProject();
  const { srv, received } = await startCs({ capabilities: {} });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath);
  const res = (await rec.handler("cs_workspace_symbols")({ query: "Player" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  assert.ok(!received.some((m) => m.method === "workspace/symbol"), "must NOT send workspace/symbol when the capability is absent");
  cslsp.close();
  await srv.close();
});

test("cs_workspace_symbols maps a -32601 reply to 'unsupported' (belt-and-suspenders)", async () => {
  const projectPath = tmpProject();
  const { srv } = await startCs({
    capabilities: { workspaceSymbolProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "workspace/symbol") writeFrame(s, { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } });
    },
  });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath);
  const res = (await rec.handler("cs_workspace_symbols")({ query: "Player" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  cslsp.close();
  await srv.close();
});

test("cs_signature_help maps signatures, resolves [start,end] parameter labels, and reports active indices", async () => {
  const projectPath = tmpProject({ "Player.cs": "TakeDamage();\n" });
  const { srv } = await startCs({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/signatureHelp") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: {
          signatures: [{
            label: "int Player.TakeDamage(int amount)",
            documentation: { kind: "markdown", value: "Apply damage." },
            parameters: [{ label: [22, 32], documentation: "the amount" }],
          }],
          activeSignature: 0,
          activeParameter: 0,
        } });
      }
    },
  });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath);
  const res = (await rec.handler("cs_signature_help")({ path: "Player.cs", line: 0, character: 11 })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, {
    signatures: [{
      label: "int Player.TakeDamage(int amount)",
      documentation: "Apply damage.",
      parameters: [{ label: "int amount", documentation: "the amount" }],
    }],
    active_signature: 0,
    active_parameter: 0,
  });
  cslsp.close();
  await srv.close();
});

test("cs_diagnostics matches a publishDiagnostics URI via diagKey and maps severities; opens with languageId 'csharp'", async () => {
  const projectPath = tmpProject({ "Player.cs": "int x =\n" });
  const { srv, received } = await startCs({
    onNotify: (msg, s) => {
      if (msg.method === "textDocument/didOpen") {
        const uri = (msg.params as { textDocument: { uri: string } }).textDocument.uri;
        writeFrame(s, { jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: {
          uri,
          diagnostics: [{ severity: 1, message: "; expected", range: { start: { line: 0, character: 7 } } }],
        } });
      }
    },
  });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath);
  const res = (await rec.handler("cs_diagnostics")({ path: "Player.cs", wait_ms: 1000 })) as ToolResultLike;
  const sc = res.structuredContent as { diagnostics: Array<{ severity: string; message: string; line: number }> };
  assert.equal(sc.diagnostics.length, 1);
  assert.equal(sc.diagnostics[0].severity, "error");
  assert.equal(sc.diagnostics[0].message, "; expected");
  // The C# plane must open documents as C#, not GDScript.
  const didOpen = received.find((m) => m.method === "textDocument/didOpen");
  assert.equal((didOpen!.params as { textDocument: { languageId: string } }).textDocument.languageId, "csharp");
  cslsp.close();
  await srv.close();
});

// ---- cs_rename / cs_code_action (the deferred C# LSP mutators) -------------

test("cs_rename dry-run (apply=false) returns the plan and writes nothing, without prompting", async () => {
  const projectPath = tmpProject({ "Player.cs": "int Speed = 10;\n" });
  let elicited = 0;
  const { srv } = await startCs({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/rename") {
        const uri = (msg.params as { textDocument: { uri: string } }).textDocument.uri;
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: { changes: { [uri]: [{ range: { start: { line: 0, character: 4 }, end: { line: 0, character: 9 } }, newText: "Velocity" }] } } });
      }
    },
  });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath, async () => { elicited++; return { action: "accept", content: { proceed: true } }; });
  const res = (await rec.handler("cs_rename")({ path: "Player.cs", line: 0, character: 4, new_name: "Velocity", apply: false })) as ToolResultLike;
  const sc = res.structuredContent as { edit_count: number; applied: boolean; written: string[] };
  assert.equal(sc.edit_count, 1);
  assert.equal(sc.applied, false);
  assert.deepEqual(sc.written, []);
  assert.equal(elicited, 0, "dry run must not prompt");
  assert.equal(fs.readFileSync(path.join(projectPath, "Player.cs"), "utf8"), "int Speed = 10;\n");
  cslsp.close();
  await srv.close();
});

test("cs_rename apply=true writes the edited text to disk (changes shape)", async () => {
  const projectPath = tmpProject({ "Player.cs": "int Speed = 10;\n" });
  const { srv } = await startCs({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/rename") {
        const uri = (msg.params as { textDocument: { uri: string } }).textDocument.uri;
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: { changes: { [uri]: [{ range: { start: { line: 0, character: 4 }, end: { line: 0, character: 9 } }, newText: "Velocity" }] } } });
      }
    },
  });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath, async () => ({ action: "accept", content: { proceed: true } }));
  const res = (await rec.handler("cs_rename")({ path: "Player.cs", line: 0, character: 4, new_name: "Velocity", apply: true, confirm: true })) as ToolResultLike;
  const sc = res.structuredContent as { applied: boolean; written: string[]; edit_count: number };
  assert.equal(sc.applied, true);
  assert.equal(sc.edit_count, 1);
  assert.equal(sc.written.length, 1);
  assert.equal(fs.readFileSync(path.join(projectPath, "Player.cs"), "utf8"), "int Velocity = 10;\n");
  cslsp.close();
  await srv.close();
});

test("cs_rename handles OmniSharp's documentChanges WorkspaceEdit encoding (not just changes)", async () => {
  const projectPath = tmpProject({ "Player.cs": "int Speed = 10;\n" });
  const { srv } = await startCs({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/rename") {
        const uri = (msg.params as { textDocument: { uri: string } }).textDocument.uri;
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: { documentChanges: [
          { textDocument: { uri, version: 1 }, edits: [{ range: { start: { line: 0, character: 4 }, end: { line: 0, character: 9 } }, newText: "Velocity" }] },
        ] } });
      }
    },
  });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath, async () => ({ action: "accept", content: { proceed: true } }));
  const res = (await rec.handler("cs_rename")({ path: "Player.cs", line: 0, character: 4, new_name: "Velocity", apply: true, confirm: true })) as ToolResultLike;
  const sc = res.structuredContent as { edit_count: number; written: string[] };
  assert.equal(sc.edit_count, 1);
  assert.equal(sc.written.length, 1);
  assert.equal(fs.readFileSync(path.join(projectPath, "Player.cs"), "utf8"), "int Velocity = 10;\n");
  cslsp.close();
  await srv.close();
});

test("cs_rename apply=true blocks when the client declines the elicitation (writes nothing)", async () => {
  const projectPath = tmpProject({ "Player.cs": "int Speed = 10;\n" });
  const { srv } = await startCs({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/rename") {
        const uri = (msg.params as { textDocument: { uri: string } }).textDocument.uri;
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: { changes: { [uri]: [{ range: { start: { line: 0, character: 4 }, end: { line: 0, character: 9 } }, newText: "Velocity" }] } } });
      }
    },
  });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath, async () => ({ action: "decline" }));
  const res = (await rec.handler("cs_rename")({ path: "Player.cs", line: 0, character: 4, new_name: "Velocity", apply: true })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.equal(fs.readFileSync(path.join(projectPath, "Player.cs"), "utf8"), "int Speed = 10;\n", "a declined rename must not touch the file");
  cslsp.close();
  await srv.close();
});

test("cs_code_action lists actions, flags which carry an edit, normalizes CodeAction+Command, and forwards range/only", async () => {
  const projectPath = tmpProject({ "Player.cs": "int x = 1;\n" });
  let sent: LspMsg | undefined;
  const { srv } = await startCs({
    capabilities: { codeActionProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/codeAction") {
        sent = msg;
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { title: "Generate constructor", kind: "quickfix", edit: { changes: {} } },
          { title: "Remove unnecessary usings", kind: "source.removeUnnecessaryImports", command: { title: "Fix", command: "omnisharp.fixUsings" } },
          { title: "Run", command: "omnisharp.run" },
        ] });
      }
    },
  });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath);
  const res = (await rec.handler("cs_code_action")({ path: "Player.cs", start_line: 0, start_character: 0, only: ["quickfix"] })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { actions: [
    { title: "Generate constructor", kind: "quickfix", has_edit: true, command: null },
    { title: "Remove unnecessary usings", kind: "source.removeUnnecessaryImports", has_edit: false, command: "omnisharp.fixUsings" },
    { title: "Run", kind: "", has_edit: false, command: "omnisharp.run" },
  ] });
  const params = sent!.params as { range: { start: unknown; end: unknown }; context: { only?: string[] } };
  assert.deepEqual(params.range.start, { line: 0, character: 0 });
  assert.deepEqual(params.range.end, { line: 0, character: 0 });
  assert.deepEqual(params.context.only, ["quickfix"]);
  cslsp.close();
  await srv.close();
});

test("cs_code_action returns 'unsupported' WITHOUT sending the request when codeActionProvider is absent", async () => {
  const projectPath = tmpProject({ "Player.cs": "int x = 1;\n" });
  const { srv, received } = await startCs({ capabilities: {} });
  const { cslsp, rec } = csToolHarness(srv.port, projectPath);
  const res = (await rec.handler("cs_code_action")({ path: "Player.cs", start_line: 0, start_character: 0 })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  assert.ok(!received.some((m) => m.method === "textDocument/codeAction"), "must NOT send codeAction when the capability is absent");
  cslsp.close();
  await srv.close();
});

// ---- Direct CsLspClient protocol behavior ---------------------------------

test("getServerCapabilities reflects the initialize handshake result", async () => {
  const { srv } = await startCs({ capabilities: { hoverProvider: true, workspaceSymbolProvider: true } });
  const cslsp = new CsLspClient(new FramedConnection("127.0.0.1", srv.port, "CS-LSP", "test"), "file:///proj", 3000);
  const caps = await cslsp.getServerCapabilities();
  assert.equal(caps.hoverProvider, true);
  assert.equal(caps.workspaceSymbolProvider, true);
  cslsp.close();
  await srv.close();
});

test("a server->client request (e.g. window/workDoneProgress/create) is acked with null so OmniSharp never blocks", async () => {
  const { srv, received } = await startCs({});
  const cslsp = new CsLspClient(new FramedConnection("127.0.0.1", srv.port, "CS-LSP", "test"), "file:///proj", 3000);
  await cslsp.getServerCapabilities();
  writeFrame(srv.sockets[0], { jsonrpc: "2.0", id: 7001, method: "window/workDoneProgress/create", params: {} });
  await waitFor(() => received.some((m) => m.id === 7001 && "result" in m && m.method === undefined));
  const ack = received.find((m) => m.id === 7001 && m.method === undefined)!;
  assert.equal(ack.result, null);
  cslsp.close();
  await srv.close();
});

test("request() rejects with an LspError('timeout') when the server never answers a method", async () => {
  const { srv } = await startCs({});
  const cslsp = new CsLspClient(new FramedConnection("127.0.0.1", srv.port, "CS-LSP", "test"), "file:///proj", 3000);
  await assert.rejects(cslsp.request("textDocument/hover", {}, 80), (e) => e instanceof LspError && e.code === "timeout");
  cslsp.close();
  await srv.close();
});

// ---- StdioChannel end-to-end (the transport OmniSharp actually uses) -------
// Drives CsLspClient through a REAL spawned subprocess speaking LSP over stdio,
// so the stdio framing/spawn path is exercised in the unit suite, not only in CI.

// A minimal LSP server over stdio: decodes Content-Length frames and answers
// `initialize`. Hoisted so the round-trip test and the spawn-failure recovery test
// below drive the identical server — one via `node -e`, one via a shebang wrapper.
const STDIO_LSP_MOCK = `
    let buf = Buffer.alloc(0);
    process.stdin.on("data", (c) => {
      buf = Buffer.concat([buf, c]);
      for (;;) {
        const i = buf.indexOf("\\r\\n\\r\\n");
        if (i === -1) break;
        const m = /Content-Length:\\s*(\\d+)/i.exec(buf.subarray(0, i).toString("ascii"));
        if (!m) { buf = buf.subarray(i + 4); continue; }
        const len = Number(m[1]); const start = i + 4;
        if (buf.length < start + len) break;
        const body = JSON.parse(buf.subarray(start, start + len).toString("utf8"));
        buf = buf.subarray(start + len);
        if (body.method === "initialize") {
          const res = JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { capabilities: { hoverProvider: true, workspaceSymbolProvider: true } } });
          process.stdout.write("Content-Length: " + Buffer.byteLength(res) + "\\r\\n\\r\\n" + res);
        }
      }
    });
`;

test("CsLspClient over StdioChannel: initialize round-trips against a spawned stdio server", async () => {
  const channel = new StdioChannel(process.execPath, ["-e", STDIO_LSP_MOCK], os.tmpdir(), "CS-LSP-stdio", "test");
  const cslsp = new CsLspClient(channel, "file:///proj", 4000);
  const caps = await cslsp.getServerCapabilities();
  assert.equal(caps.hoverProvider, true);
  assert.equal(caps.workspaceSymbolProvider, true);
  cslsp.close();
});

test("StdioChannel surfaces a spawn failure (bad command) as a clear error rather than hanging", async () => {
  const channel = new StdioChannel("gcb-nonexistent-omnisharp-xyz", ["-lsp"], os.tmpdir(), "CS-LSP-stdio", "Install OmniSharp.");
  const cslsp = new CsLspClient(channel, "file:///proj", 2000);
  await assert.rejects(cslsp.getServerCapabilities(), (e) => /could not spawn/i.test((e as Error).message));
  cslsp.close();
});

// The failed spawn emits `error` + `close` and NEVER `exit` — measured, not assumed.
// StdioChannel hooked only `exit`, so `closeCb()` never fired, so CsLspClient never
// cleared the rejected `initialized` promise it had cached. These two tests pin the
// event and the consequence; either one fails on the pre-fix channel.

test("StdioChannel: a failed spawn fires onClose exactly once (`close` fires, `exit` does not)", async () => {
  const channel = new StdioChannel("gcb-nonexistent-omnisharp-xyz", ["-lsp"], os.tmpdir(), "CS-LSP-stdio", "Install OmniSharp.");
  let closed = 0;
  channel.onClose(() => { closed += 1; });
  await assert.rejects(
    channel.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    (e) => /could not spawn/i.test((e as Error).message),
  );
  await waitFor(() => closed > 0, 2000);
  assert.equal(closed, 1, "the transport must notify its client once, not zero times and not twice");
  channel.close();
});

// The fake server is spawned via its shebang, which POSIX resolves and Windows does
// not. Every CI runner here is ubuntu-latest; this only skips a local Windows run.
const skipWinShebang = { skip: process.platform === "win32" ? "shebang spawn is POSIX-only" : false };

test("CsLspClient recovers when the language server appears after a failed spawn — no host restart", skipWinShebang, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gcb-cslsp-install-"));
  const bin = path.join(dir, "fake-omnisharp");
  const mockPath = path.join(dir, "mock-lsp.cjs");
  try {
    const channel = new StdioChannel(bin, ["-lsp"], dir, "CS-LSP-stdio", "Install OmniSharp.");
    const cslsp = new CsLspClient(channel, "file:///proj", 4000);

    // 1. Nothing at `bin` yet: ENOENT. ensureInitialized() caches the rejected promise.
    //    The rejection carries the actionable hint, not a generic transport error.
    await assert.rejects(cslsp.getServerCapabilities(), (e) => /could not spawn/i.test((e as Error).message));

    // The transport's `close` lands one turn AFTER that rejection, and deliberately
    // so — onClose() rejects every pending request with its own "connection closed",
    // which would replace the "Install OmniSharp" hint asserted above if the channel
    // notified synchronously from its `error` handler. So the heal trails the error
    // the caller sees by a turn. Any real second tool call is many turns later; a
    // test calling straight back to back has to yield once.
    await new Promise((r) => setTimeout(r, 50));

    // 2. "Install OmniSharp" — a real, executable server now sits at the same path.
    fs.writeFileSync(mockPath, STDIO_LSP_MOCK);
    fs.writeFileSync(bin, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(mockPath)}\n`);
    fs.chmodSync(bin, 0o755);

    // 3. Same client object, same channel, no restart. Before the `close` hook this
    //    returned the cached rejection from step 1 for the process's whole lifetime.
    const caps = await cslsp.getServerCapabilities();
    assert.equal(caps.hoverProvider, true, "the second call must reach the newly-installed server");
    cslsp.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { LspClient, LspError } from "../src/lsp.js";
import { registerLspTools } from "../src/tools/lsp.js";
import { loadConfig } from "../src/config.js";
import type { Config } from "../src/config.js";
import { makeRecordingServer, type ToolResultLike } from "./helpers/recording-server.js";
import { startTcpServer, makeFrameParser, writeFrame, waitFor, type TcpServer } from "./helpers/tcp.js";
import { structured } from "./helpers/structured.js";

interface LspMsg { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: unknown }

interface MockOpts {
  capabilities?: Record<string, unknown>;
  onRequest?: (msg: LspMsg, socket: net.Socket) => void;
  onNotify?: (msg: LspMsg, socket: net.Socket) => void;
}

/** A mock Godot GDScript language server: answers `initialize`, delegates the rest. */
async function startLsp(opts: MockOpts): Promise<{ srv: TcpServer; received: LspMsg[] }> {
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
      // else: a response from the client to a server->client request — recorded only.
    });
    s.on("data", (c) => parse(Buffer.from(c)));
  });
  return { srv, received };
}

/** Full Config rooted at a real temp project dir. */
function makeConfig(projectPath: string): Config {
  const saved = process.env.GODOT_PROJECT;
  process.env.GODOT_PROJECT = projectPath;
  try { return loadConfig(); } finally {
    if (saved === undefined) delete process.env.GODOT_PROJECT; else process.env.GODOT_PROJECT = saved;
  }
}

function tmpProject(files: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gcb-lsp-"));
  for (const [rel, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, rel), content, "utf8");
  return dir;
}

function lspToolHarness(srvPort: number, projectPath: string, elicit?: Parameters<typeof makeRecordingServer>[0]) {
  const cfg = makeConfig(projectPath);
  const lsp = new LspClient("127.0.0.1", srvPort, cfg.projectUri, 3000);
  const rec = makeRecordingServer(elicit);
  registerLspTools(rec.server as unknown as Parameters<typeof registerLspTools>[0], lsp, cfg);
  return { lsp, rec, cfg };
}

test("gd_workspace_symbols returns 'unsupported' WITHOUT sending workspace/symbol when the server never advertised the capability", async () => {
  const projectPath = tmpProject();
  const { srv, received } = await startLsp({ capabilities: {} }); // no workspaceSymbolProvider
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_workspace_symbols")({ query: "Player" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  assert.ok(!received.some((m) => m.method === "workspace/symbol"), "must NOT send workspace/symbol when the capability is absent");
  lsp.close();
  await srv.close();
});

test("gd_workspace_symbols maps a -32601 reply to 'unsupported' (belt-and-suspenders for builds that lie about the capability)", async () => {
  const projectPath = tmpProject();
  const { srv } = await startLsp({
    capabilities: { workspaceSymbolProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "workspace/symbol") writeFrame(s, { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } });
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_workspace_symbols")({ query: "Player" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  lsp.close();
  await srv.close();
});

test("gd_workspace_symbols returns mapped symbols on a build that supports it", async () => {
  const projectPath = tmpProject();
  const { srv } = await startLsp({
    capabilities: { workspaceSymbolProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "workspace/symbol") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [{ name: "Player", kind: 5, location: { uri: "res://player.gd", range: { start: { line: 3, character: 0 } } } }] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_workspace_symbols")({ query: "Player" })) as ToolResultLike;
  assert.equal(res.isError, undefined);
  assert.deepEqual(res.structuredContent, { symbols: [{ name: "Player", kind: "class", uri: "res://player.gd", line: 3 }] });
  lsp.close();
  await srv.close();
});

test("gd_document_symbols maps LSP SymbolKind numbers to readable names", async () => {
  const projectPath = tmpProject({ "player.gd": "extends Node\nfunc _ready():\n\tpass\n" });
  const { srv } = await startLsp({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/documentSymbol") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { name: "Player", kind: 5, range: { start: { line: 0, character: 0 } } },
          { name: "_ready", kind: 6, range: { start: { line: 1, character: 5 } } },
        ] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_document_symbols")({ path: "player.gd" })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { symbols: [{ name: "Player", kind: "class", line: 0 }, { name: "_ready", kind: "method", line: 1 }] });
  lsp.close();
  await srv.close();
});

test("gd_diagnostics matches a publishDiagnostics URI spelled differently (res:// vs file://) via diagKey", async () => {
  const projectPath = tmpProject({ "player.gd": "extends Node\nvar x =\n" });
  const { srv } = await startLsp({
    onNotify: (msg, s) => {
      if (msg.method === "textDocument/didOpen") {
        // Publish under a res:// URI — a DIFFERENT spelling than the percent-encoded
        // file:// URI the client opened with. diagKey must still match them.
        writeFrame(s, { jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: {
          uri: "res://player.gd",
          diagnostics: [{ severity: 1, message: "Expected expression", range: { start: { line: 1, character: 6 } } }],
        } });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_diagnostics")({ path: "player.gd", wait_ms: 1000 })) as ToolResultLike;
  const sc = structured<{ diagnostics: Array<{ severity: string; message: string; line: number }> }>(res);
  assert.equal(sc.diagnostics.length, 1);
  assert.equal(sc.diagnostics[0].severity, "error");
  assert.equal(sc.diagnostics[0].message, "Expected expression");
  assert.equal(sc.diagnostics[0].line, 1);
  lsp.close();
  await srv.close();
});

test("gd_rename dry-run (apply=false) returns the plan and writes nothing, without prompting", async () => {
  const projectPath = tmpProject({ "player.gd": "var speed = 10\n" });
  let elicited = 0;
  const { srv } = await startLsp({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/rename") {
        const uri = (msg.params as { textDocument: { uri: string } }).textDocument.uri;
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: { changes: { [uri]: [{ range: { start: { line: 0, character: 4 }, end: { line: 0, character: 9 } }, newText: "velocity" }] } } });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath, async () => { elicited++; return { action: "accept", content: { proceed: true } }; });
  const res = (await rec.handler("gd_rename")({ path: "player.gd", line: 0, character: 4, new_name: "velocity", apply: false })) as ToolResultLike;
  const sc = structured<{ edit_count: number; applied: boolean; written: string[] }>(res);
  assert.equal(sc.edit_count, 1);
  assert.equal(sc.applied, false);
  assert.deepEqual(sc.written, []);
  assert.equal(elicited, 0, "dry run must not prompt");
  assert.equal(fs.readFileSync(path.join(projectPath, "player.gd"), "utf8"), "var speed = 10\n");
  lsp.close();
  await srv.close();
});

test("gd_rename apply=true writes the edited text to disk (applyTextEdits/offsetOf end-to-end)", async () => {
  const projectPath = tmpProject({ "player.gd": "var speed = 10\n" });
  const { srv } = await startLsp({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/rename") {
        const uri = (msg.params as { textDocument: { uri: string } }).textDocument.uri;
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: { changes: { [uri]: [{ range: { start: { line: 0, character: 4 }, end: { line: 0, character: 9 } }, newText: "velocity" }] } } });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath, async () => ({ action: "accept", content: { proceed: true } }));
  const res = (await rec.handler("gd_rename")({ path: "player.gd", line: 0, character: 4, new_name: "velocity", apply: true, confirm: true })) as ToolResultLike;
  const sc = structured<{ applied: boolean; written: string[]; edit_count: number }>(res);
  assert.equal(sc.applied, true);
  assert.equal(sc.edit_count, 1);
  assert.equal(sc.written.length, 1);
  assert.equal(fs.readFileSync(path.join(projectPath, "player.gd"), "utf8"), "var velocity = 10\n");
  lsp.close();
  await srv.close();
});

test("gd_signature_help maps signatures, resolves [start,end] parameter labels, and reports active indices", async () => {
  const projectPath = tmpProject({ "player.gd": "func hit(dmg):\n\thit()\n" });
  const { srv } = await startLsp({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/signatureHelp") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: {
          signatures: [{
            label: "hit(dmg: int) -> int",
            documentation: { kind: "markdown", value: "Apply damage." },
            parameters: [{ label: [4, 12], documentation: "the amount" }],
          }],
          activeSignature: 0,
          activeParameter: 0,
        } });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_signature_help")({ path: "player.gd", line: 1, character: 5 })) as ToolResultLike;
  assert.equal(res.isError, undefined);
  assert.deepEqual(res.structuredContent, {
    signatures: [{
      label: "hit(dmg: int) -> int",
      documentation: "Apply damage.",
      parameters: [{ label: "dmg: int", documentation: "the amount" }],
    }],
    active_signature: 0,
    active_parameter: 0,
  });
  lsp.close();
  await srv.close();
});

test("gd_code_action lists actions, flags which carry an edit, normalizes CodeAction+Command, and forwards range/only", async () => {
  const projectPath = tmpProject({ "player.gd": "var x = 1\n" });
  let sent: LspMsg | undefined;
  const { srv } = await startLsp({
    capabilities: { codeActionProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/codeAction") {
        sent = msg;
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { title: "Add type hint", kind: "quickfix", edit: { changes: {} } },
          { title: "Organize", kind: "source.organizeImports", command: { title: "Organize", command: "gdscript.organize" } },
          { title: "Run", command: "gdscript.run" },
        ] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_code_action")({ path: "player.gd", start_line: 0, start_character: 0, only: ["quickfix"] })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { actions: [
    { title: "Add type hint", kind: "quickfix", has_edit: true, command: null },
    { title: "Organize", kind: "source.organizeImports", has_edit: false, command: "gdscript.organize" },
    { title: "Run", kind: "", has_edit: false, command: "gdscript.run" },
  ] });
  // end defaults to start (a caret, not a selection); `only` is forwarded in the context.
  const params = sent!.params as { range: { start: unknown; end: unknown }; context: { only?: string[] } };
  assert.deepEqual(params.range.start, { line: 0, character: 0 });
  assert.deepEqual(params.range.end, { line: 0, character: 0 });
  assert.deepEqual(params.context.only, ["quickfix"]);
  lsp.close();
  await srv.close();
});

test("gd_code_action returns 'unsupported' WITHOUT sending textDocument/codeAction when codeActionProvider is falsy (Godot 4.3 behavior)", async () => {
  const projectPath = tmpProject({ "player.gd": "var x = 1\n" });
  const { srv, received } = await startLsp({ capabilities: { codeActionProvider: false } });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_code_action")({ path: "player.gd", start_line: 0, start_character: 0 })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  assert.ok(!received.some((m) => m.method === "textDocument/codeAction"), "must NOT send codeAction when the capability is absent");
  lsp.close();
  await srv.close();
});

// ---- Phase 1 LSP-depth: read-only navigation/inspection tools -------------

test("gd_type_definition maps locations when typeDefinitionProvider is advertised", async () => {
  const projectPath = tmpProject({ "player.gd": "extends Node\nvar hp := 3\n" });
  const { srv } = await startLsp({
    capabilities: { typeDefinitionProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/typeDefinition") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [{ uri: "res://health.gd", range: { start: { line: 2, character: 0 } } }] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_type_definition")({ path: "player.gd", line: 1, character: 4 })) as ToolResultLike;
  assert.equal(res.isError, undefined);
  assert.deepEqual(res.structuredContent, { locations: [{ uri: "res://health.gd", line: 2, character: 0 }] });
  lsp.close();
  await srv.close();
});

test("gd_type_definition returns 'unsupported' WITHOUT sending the request when the capability is absent", async () => {
  const projectPath = tmpProject({ "player.gd": "extends Node\n" });
  const { srv, received } = await startLsp({ capabilities: {} });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_type_definition")({ path: "player.gd", line: 0, character: 0 })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  assert.ok(!received.some((m) => m.method === "textDocument/typeDefinition"), "must NOT send typeDefinition when the capability is absent");
  lsp.close();
  await srv.close();
});

test("gd_type_definition maps a -32601 (advertised-but-unimplemented) reply to 'unsupported' — the D7 belt-and-suspenders", async () => {
  const projectPath = tmpProject({ "player.gd": "extends Node\n" });
  const { srv } = await startLsp({
    capabilities: { typeDefinitionProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/typeDefinition") writeFrame(s, { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } });
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_type_definition")({ path: "player.gd", line: 0, character: 0 })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  lsp.close();
  await srv.close();
});

test("gd_implementation maps locations from the targetUri/targetSelectionRange form", async () => {
  const projectPath = tmpProject({ "player.gd": "extends Node\n" });
  const { srv } = await startLsp({
    capabilities: { implementationProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/implementation") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [{ targetUri: "res://enemy.gd", targetSelectionRange: { start: { line: 9, character: 2 } } }] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_implementation")({ path: "player.gd", line: 0, character: 0 })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { locations: [{ uri: "res://enemy.gd", line: 9, character: 2 }] });
  lsp.close();
  await srv.close();
});

test("gd_declaration maps a single-Location (non-array) result", async () => {
  const projectPath = tmpProject({ "player.gd": "extends Node\n" });
  const { srv } = await startLsp({
    capabilities: { declarationProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/declaration") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: { uri: "res://player.gd", range: { start: { line: 1, character: 4 } } } });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_declaration")({ path: "player.gd", line: 5, character: 8 })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { locations: [{ uri: "res://player.gd", line: 1, character: 4 }] });
  lsp.close();
  await srv.close();
});

test("gd_document_highlight maps ranges and DocumentHighlightKind numbers to write/read/text", async () => {
  const projectPath = tmpProject({ "player.gd": "var speed = 1\nspeed = 2\nprint(speed)\n" });
  const { srv } = await startLsp({
    capabilities: { documentHighlightProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/documentHighlight") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { range: { start: { line: 0, character: 4 }, end: { line: 0, character: 9 } }, kind: 3 },
          { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } }, kind: 2 },
          { range: { start: { line: 2, character: 6 }, end: { line: 2, character: 11 } } },
        ] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_document_highlight")({ path: "player.gd", line: 0, character: 4 })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { highlights: [
    { line: 0, character: 4, end_line: 0, end_character: 9, kind: "write" },
    { line: 1, character: 0, end_line: 1, end_character: 5, kind: "read" },
    { line: 2, character: 6, end_line: 2, end_character: 11, kind: "text" },
  ] });
  lsp.close();
  await srv.close();
});

test("gd_document_highlight returns 'unsupported' without sending the request when the capability is absent", async () => {
  const projectPath = tmpProject({ "player.gd": "var x = 1\n" });
  const { srv, received } = await startLsp({ capabilities: {} });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_document_highlight")({ path: "player.gd", line: 0, character: 4 })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.ok(!received.some((m) => m.method === "textDocument/documentHighlight"));
  lsp.close();
  await srv.close();
});

test("gd_folding_ranges maps startLine/endLine and a defaulted (missing) kind", async () => {
  const projectPath = tmpProject({ "player.gd": "func a():\n\tpass\nfunc b():\n\tpass\n" });
  const { srv } = await startLsp({
    capabilities: { foldingRangeProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/foldingRange") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { startLine: 0, endLine: 1, kind: "region" },
          { startLine: 2, endLine: 3 },
        ] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_folding_ranges")({ path: "player.gd" })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { ranges: [
    { start_line: 0, end_line: 1, kind: "region" },
    { start_line: 2, end_line: 3, kind: "" },
  ] });
  lsp.close();
  await srv.close();
});

test("gd_document_link maps ranges and targets", async () => {
  const projectPath = tmpProject({ "player.gd": "# see res://other.gd\n" });
  const { srv } = await startLsp({
    capabilities: { documentLinkProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/documentLink") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { range: { start: { line: 0, character: 6 }, end: { line: 0, character: 20 } }, target: "res://other.gd" },
        ] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_document_link")({ path: "player.gd" })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { links: [
    { line: 0, character: 6, end_line: 0, end_character: 20, target: "res://other.gd" },
  ] });
  lsp.close();
  await srv.close();
});

test("gd_formatting applies the server's text edits and returns the formatted text WITHOUT writing to disk", async () => {
  const projectPath = tmpProject({ "player.gd": "var x=1\n" });
  let sent: LspMsg | undefined;
  const { srv } = await startLsp({
    capabilities: { documentFormattingProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/formatting") {
        sent = msg;
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 7 } }, newText: "var x = 1" },
        ] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_formatting")({ path: "player.gd" })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { edit_count: 1, formatted: "var x = 1\n" });
  // Read-only: the file on disk is untouched.
  assert.equal(fs.readFileSync(path.join(projectPath, "player.gd"), "utf8"), "var x=1\n");
  // Formatting options default to Godot's tabs (insertSpaces:false, tabSize:4).
  const opts = (sent!.params as { options: { tabSize: number; insertSpaces: boolean } }).options;
  assert.deepEqual(opts, { tabSize: 4, insertSpaces: false });
  lsp.close();
  await srv.close();
});

test("gd_formatting returns 'unsupported' without sending the request when documentFormattingProvider is absent", async () => {
  const projectPath = tmpProject({ "player.gd": "var x=1\n" });
  const { srv, received } = await startLsp({ capabilities: {} });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_formatting")({ path: "player.gd" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.ok(!received.some((m) => m.method === "textDocument/formatting"));
  lsp.close();
  await srv.close();
});

test("gd_document_color maps ColorInformation ranges and 0..1 RGBA to components + #RRGGBBAA hex", async () => {
  const projectPath = tmpProject({ "player.gd": "var c = Color(1, 0, 0, 1)\nvar d = Color(0, 0.5, 1, 0.5)\n" });
  const { srv } = await startLsp({
    capabilities: { colorProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/documentColor") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { range: { start: { line: 0, character: 8 }, end: { line: 0, character: 24 } }, color: { red: 1, green: 0, blue: 0, alpha: 1 } },
          { range: { start: { line: 1, character: 8 }, end: { line: 1, character: 28 } }, color: { red: 0, green: 0.5, blue: 1, alpha: 0.5 } },
        ] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_document_color")({ path: "player.gd" })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { colors: [
    { line: 0, character: 8, end_line: 0, end_character: 24, red: 1, green: 0, blue: 0, alpha: 1, hex: "#ff0000ff" },
    { line: 1, character: 8, end_line: 1, end_character: 28, red: 0, green: 0.5, blue: 1, alpha: 0.5, hex: "#0080ff80" },
  ] });
  lsp.close();
  await srv.close();
});

test("gd_document_color returns 'unsupported' without sending the request when colorProvider is absent", async () => {
  const projectPath = tmpProject({ "player.gd": "var x = 1\n" });
  const { srv, received } = await startLsp({ capabilities: {} });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_document_color")({ path: "player.gd" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  assert.ok(!received.some((m) => m.method === "textDocument/documentColor"), "must NOT send documentColor when the capability is absent");
  lsp.close();
  await srv.close();
});

test("gd_document_color maps a -32601 (advertised-but-unimplemented) reply to 'unsupported' — the D7 belt-and-suspenders", async () => {
  const projectPath = tmpProject({ "player.gd": "var x = Color(1,1,1,1)\n" });
  const { srv } = await startLsp({
    capabilities: { colorProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/documentColor") writeFrame(s, { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } });
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_document_color")({ path: "player.gd" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  lsp.close();
  await srv.close();
});

// ---- Phase 2 LSP-depth: call hierarchy + semantic tokens ------------------

test("gd_call_hierarchy resolves callers (incoming) with prepare + incomingCalls, mapping items and call-site ranges", async () => {
  const projectPath = tmpProject({ "player.gd": "func take_damage(n):\n\tpass\n" });
  const { srv } = await startLsp({
    capabilities: { callHierarchyProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/prepareCallHierarchy") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { name: "take_damage", kind: 6, uri: "res://player.gd", range: { start: { line: 0, character: 0 }, end: { line: 1, character: 5 } }, selectionRange: { start: { line: 0, character: 5 }, end: { line: 0, character: 16 } }, detail: "func take_damage(n)" },
        ] });
      }
      if (msg.method === "callHierarchy/incomingCalls") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { from: { name: "_process", kind: 12, uri: "res://enemy.gd", selectionRange: { start: { line: 8, character: 5 } }, detail: "func _process(d)" }, fromRanges: [{ start: { line: 9, character: 8 }, end: { line: 9, character: 19 } }] },
        ] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_call_hierarchy")({ path: "player.gd", line: 0, character: 5 })) as ToolResultLike;
  assert.equal(res.isError, undefined);
  assert.deepEqual(res.structuredContent, {
    direction: "incoming",
    items: [{
      name: "take_damage", kind: "method", uri: "res://player.gd", line: 0, character: 5, detail: "func take_damage(n)",
      calls: [{
        name: "_process", kind: "function", uri: "res://enemy.gd", line: 8, character: 5, detail: "func _process(d)",
        ranges: [{ line: 9, character: 8, end_line: 9, end_character: 19 }],
      }],
    }],
  });
  lsp.close();
  await srv.close();
});

test("gd_call_hierarchy resolves callees (outgoing) via the `to` item and forwards direction", async () => {
  const projectPath = tmpProject({ "player.gd": "func _ready():\n\ttake_damage(1)\n" });
  const { srv } = await startLsp({
    capabilities: { callHierarchyProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/prepareCallHierarchy") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { name: "_ready", kind: 12, uri: "res://player.gd", selectionRange: { start: { line: 0, character: 5 } } },
        ] });
      }
      if (msg.method === "callHierarchy/outgoingCalls") {
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          { to: { name: "take_damage", kind: 6, uri: "res://player.gd", selectionRange: { start: { line: 10, character: 5 } } }, fromRanges: [{ start: { line: 1, character: 1 }, end: { line: 1, character: 12 } }] },
        ] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_call_hierarchy")({ path: "player.gd", line: 0, character: 5, direction: "outgoing" })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, {
    direction: "outgoing",
    items: [{
      name: "_ready", kind: "function", uri: "res://player.gd", line: 0, character: 5, detail: "",
      calls: [{
        name: "take_damage", kind: "method", uri: "res://player.gd", line: 10, character: 5, detail: "",
        ranges: [{ line: 1, character: 1, end_line: 1, end_character: 12 }],
      }],
    }],
  });
  lsp.close();
  await srv.close();
});

test("gd_call_hierarchy returns 'unsupported' WITHOUT sending prepareCallHierarchy when the capability is absent", async () => {
  const projectPath = tmpProject({ "player.gd": "func a():\n\tpass\n" });
  const { srv, received } = await startLsp({ capabilities: {} });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_call_hierarchy")({ path: "player.gd", line: 0, character: 5 })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  assert.ok(!received.some((m) => m.method === "textDocument/prepareCallHierarchy"), "must NOT send prepareCallHierarchy when the capability is absent");
  lsp.close();
  await srv.close();
});

test("gd_call_hierarchy maps a -32601 (advertised-but-unimplemented) prepare reply to 'unsupported' — the D7 belt-and-suspenders", async () => {
  const projectPath = tmpProject({ "player.gd": "func a():\n\tpass\n" });
  const { srv } = await startLsp({
    capabilities: { callHierarchyProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/prepareCallHierarchy") writeFrame(s, { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } });
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_call_hierarchy")({ path: "player.gd", line: 0, character: 5 })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  lsp.close();
  await srv.close();
});

test("gd_semantic_tokens decodes the packed integer array through the legend into absolute tokens", async () => {
  const projectPath = tmpProject({ "player.gd": "func hit():\n\tpass\n" });
  const { srv } = await startLsp({
    capabilities: { semanticTokensProvider: { legend: { tokenTypes: ["function", "variable", "keyword"], tokenModifiers: ["declaration", "readonly"] } } },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/semanticTokens/full") {
        // Two 5-tuples [deltaLine, deltaChar, length, typeIdx, modBits]: a keyword at
        // (0,0) then a function one line down (deltaChar is absolute across the line break).
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: { data: [0, 0, 4, 2, 0, 1, 2, 3, 0, 1] } });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_semantic_tokens")({ path: "player.gd" })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, {
    token_count: 2,
    tokens: [
      { line: 0, character: 0, length: 4, type: "keyword", modifiers: [] },
      { line: 1, character: 2, length: 3, type: "function", modifiers: ["declaration"] },
    ],
  });
  lsp.close();
  await srv.close();
});

test("gd_semantic_tokens returns 'unsupported' WITHOUT sending the request when semanticTokensProvider is absent", async () => {
  const projectPath = tmpProject({ "player.gd": "func a():\n\tpass\n" });
  const { srv, received } = await startLsp({ capabilities: {} });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_semantic_tokens")({ path: "player.gd" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  assert.ok(!received.some((m) => m.method === "textDocument/semanticTokens/full"), "must NOT send semanticTokens/full when the capability is absent");
  lsp.close();
  await srv.close();
});

test("gd_semantic_tokens maps a -32601 (advertised-but-unimplemented) reply to 'unsupported' — the D7 belt-and-suspenders", async () => {
  const projectPath = tmpProject({ "player.gd": "func a():\n\tpass\n" });
  const { srv } = await startLsp({
    capabilities: { semanticTokensProvider: { legend: { tokenTypes: [], tokenModifiers: [] } } },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/semanticTokens/full") writeFrame(s, { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } });
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_semantic_tokens")({ path: "player.gd" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported/i);
  lsp.close();
  await srv.close();
});

// ---- Direct LspClient protocol behavior -----------------------------------

test("getServerCapabilities reflects the initialize handshake result", async () => {
  const { srv } = await startLsp({ capabilities: { hoverProvider: true, workspaceSymbolProvider: false } });
  const lsp = new LspClient("127.0.0.1", srv.port, "file:///tmp/proj", 3000);
  const caps = await lsp.getServerCapabilities();
  assert.equal(caps.hoverProvider, true);
  assert.equal(caps.workspaceSymbolProvider, false);
  lsp.close();
  await srv.close();
});

test("a server->client request (e.g. client/registerCapability) is acked with a null result so the server never blocks", async () => {
  const clientResponses: LspMsg[] = [];
  const { srv, received } = await startLsp({});
  // After initialize, push a server->client request and watch for the client's ack.
  const lsp = new LspClient("127.0.0.1", srv.port, "file:///tmp/proj", 3000);
  await lsp.getServerCapabilities(); // forces the handshake and a live socket
  srv.sockets[0].on("data", () => {}); // ensure data flows
  writeFrame(srv.sockets[0], { jsonrpc: "2.0", id: 9001, method: "client/registerCapability", params: {} });
  await waitFor(() => received.some((m) => m.id === 9001 && "result" in m && m.method === undefined));
  const ack = received.find((m) => m.id === 9001 && m.method === undefined)!;
  assert.equal(ack.result, null);
  clientResponses.push(ack);
  lsp.close();
  await srv.close();
});

test("request() rejects with an LspError('timeout') when the server never answers a method", async () => {
  const { srv } = await startLsp({}); // answers initialize only
  const lsp = new LspClient("127.0.0.1", srv.port, "file:///tmp/proj", 3000);
  await assert.rejects(lsp.request("textDocument/hover", {}, 80), (e) => e instanceof LspError && e.code === "timeout");
  lsp.close();
  await srv.close();
});

test("request() surfaces an LspError with the server's error code on an error response", async () => {
  const { srv } = await startLsp({
    onRequest: (msg, s) => writeFrame(s, { jsonrpc: "2.0", id: msg.id, error: { code: -32602, message: "Invalid params" } }),
  });
  const lsp = new LspClient("127.0.0.1", srv.port, "file:///tmp/proj", 3000);
  await assert.rejects(lsp.request("textDocument/hover", {}), (e) => e instanceof LspError && e.code === -32602 && /Invalid params/.test((e as Error).message));
  lsp.close();
  await srv.close();
});

// --- session 156: the states the mock never produced -------------------------
// Each of these was MEASURED against real Godot 4.3/4.5/4.7 language servers
// before the guard was written; every one succeeded with isError:false before.

test("gd_rename REFUSES an invalid identifier before it plans a single edit", async () => {
  const projectPath = tmpProject({ "a.gd": "extends Node\nvar counter := 1\n" });
  const { srv, received } = await startLsp({
    capabilities: { renameProvider: true },
    onRequest: (msg, s) => writeFrame(s, {
      jsonrpc: "2.0", id: msg.id,
      result: { changes: { "file:///x/a.gd": [{ range: { start: { line: 1, character: 4 }, end: { line: 1, character: 11 } }, newText: "zzz" }] } },
    }),
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  for (const bad of ["", "1bad name!", "a b", "a\nb", "has-dash", " lead"]) {
    const res = (await rec.handler("gd_rename")({ path: "res://a.gd", line: 1, character: 4, new_name: bad })) as ToolResultLike;
    assert.equal(res.isError, true, `rename to ${JSON.stringify(bad)} must be refused`);
    assert.match(res.content![0].text!, /not a valid GDScript identifier/);
    // The refusal is a HOST refusal, not an LSP failure — it must not be dressed
    // up as one, and the caller must not be sent to debug the language server.
    assert.doesNotMatch(res.content![0].text!, /^LSP error/);
  }
  assert.ok(!received.some((m) => m.method === "textDocument/rename"),
    "must not send textDocument/rename at all — the server plans the illegal rename happily");
  lsp.close();
  await srv.close();
});

test("gd_rename REFUSES a GDScript reserved word, and still allows a legal name", async () => {
  const projectPath = tmpProject({ "a.gd": "extends Node\nvar counter := 1\n" });
  const { srv } = await startLsp({
    capabilities: { renameProvider: true },
    onRequest: (msg, s) => writeFrame(s, {
      jsonrpc: "2.0", id: msg.id,
      result: { changes: { "file:///x/a.gd": [{ range: { start: { line: 1, character: 4 }, end: { line: 1, character: 11 } }, newText: "ok" }] } },
    }),
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  for (const kw of ["func", "var", "class", "extends", "return", "true", "null"]) {
    const res = (await rec.handler("gd_rename")({ path: "res://a.gd", line: 1, character: 4, new_name: kw })) as ToolResultLike;
    assert.equal(res.isError, true, `rename to "${kw}" must be refused`);
    assert.match(res.content![0].text!, /reserved word/);
  }
  // Not over-eager: an ordinary identifier, a leading underscore, and an engine
  // CLASS name (shadowable, therefore legal) must all still plan edits.
  for (const good of ["counter2", "_private", "Node", "Vector2", "PascalCase"]) {
    const res = (await rec.handler("gd_rename")({ path: "res://a.gd", line: 1, character: 4, new_name: good })) as ToolResultLike;
    assert.notEqual(res.isError, true, `rename to "${good}" must be allowed`);
    assert.equal((res.structuredContent as { edit_count?: number })?.edit_count, 1);
  }
  lsp.close();
  await srv.close();
});

test("the gd_* tools REFUSE a path that resolves outside the project root", async () => {
  const projectPath = tmpProject({ "a.gd": "extends Node\n" });
  const { srv, received } = await startLsp({
    capabilities: { documentSymbolProvider: true, hoverProvider: true },
    onRequest: (msg, s) => writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [] }),
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  // `toFsPath` joins through path.join, which silently normalizes `..` away, so
  // both of these resolved to a real path outside the project and answered ok.
  // The last one is why the guard compares against `root + path.sep` rather than
  // a bare startsWith(root): a SIBLING directory whose name merely starts with
  // the project's name would otherwise pass.
  const sibling = `${projectPath}_evil/x.gd`;
  for (const bad of ["res://../../../etc/passwd", "/etc/passwd", "res://../outside.gd", sibling]) {
    const res = (await rec.handler("gd_document_symbols")({ path: bad })) as ToolResultLike;
    assert.equal(res.isError, true, `${bad} must be refused`);
    assert.match(res.content![0].text!, /outside the Godot project root/);
    assert.doesNotMatch(res.content![0].text!, /^LSP error/);
  }
  assert.ok(!received.some((m) => m.method === "textDocument/documentSymbol"),
    "a refused path must never reach the language server");
  // Not over-eager: a path INSIDE the project still works, including one that
  // walks out and back in again.
  for (const good of ["res://a.gd", "a.gd", "res://sub/../a.gd"]) {
    const res = (await rec.handler("gd_document_symbols")({ path: good })) as ToolResultLike;
    assert.notEqual(res.isError, true, `${good} must be allowed`);
  }
  lsp.close();
  await srv.close();
});

test("a host REFUSAL is not dressed up as an LSP error", async () => {
  const projectPath = tmpProject({ "a.gd": "extends Node\n" });
  const { srv } = await startLsp({ capabilities: { documentSymbolProvider: true } });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const refused = (await rec.handler("gd_document_symbols")({ path: "/etc/passwd" })) as ToolResultLike;
  // fail() prefixes genuine server failures with "LSP error [code]:" — sending a
  // caller to debug a server that was never asked is the bug this guards.
  assert.doesNotMatch(refused.content![0].text!, /LSP error/);
  assert.match(refused.content![0].text!, /^Refusing/);
  lsp.close();
  await srv.close();
});

test("gd_* position inputs reject a negative line or character at the SCHEMA, before any handler runs", async () => {
  const projectPath = tmpProject({ "a.gd": "extends Node\n" });
  const { srv } = await startLsp({ capabilities: { hoverProvider: true } });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  // A handler pulled out of a recording server never sees its own zod schema —
  // the real MCP server validates first — so this asserts the SCHEMA directly.
  // Measured: negatives sailed through to the wire and came back "successful"
  // with empty contents, indistinguishable from a real miss.
  for (const tool of ["gd_hover", "gd_completion", "gd_definition", "gd_references", "gd_rename"]) {
    const shape = z.object(rec.tools.get(tool)!.config.inputSchema as Record<string, z.ZodTypeAny>);
    for (const bad of [{ line: -1, character: 0 }, { line: 0, character: -1 }, { line: -5, character: -5 }]) {
      const parsed = shape.safeParse({ path: "res://a.gd", new_name: "x", ...bad });
      assert.equal(parsed.success, false, `${tool} must reject ${JSON.stringify(bad)}`);
    }
    assert.equal(shape.safeParse({ path: "res://a.gd", line: 0, character: 0, new_name: "x" }).success, true,
      `${tool} must still accept 0,0`);
  }
  lsp.close();
  await srv.close();
});

test("the gd_* tools REFUSE a path that does not exist, instead of opening it as an empty document", async () => {
  const projectPath = tmpProject({ "a.gd": "extends Node\nvar counter := 1\n" });
  const { srv, received } = await startLsp({
    capabilities: { documentSymbolProvider: true, hoverProvider: true },
    onRequest: (msg, s) => writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [] }),
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  // readFileText() returns "" for ANY read failure, so a missing file used to be
  // announced to the server via ensureOpen(uri, "") as an EMPTY one. Measured on
  // real 4.3/4.5/4.7: gd_document_symbols answered a phantom
  // {name:"<file>.gd", kind:"class"} and gd_diagnostics answered a real
  // "(EMPTY_FILE): Empty script file." warning — both isError:false, and both
  // indistinguishable from a genuinely empty file that does exist.
  for (const tool of ["gd_document_symbols", "gd_diagnostics"]) {
    const res = (await rec.handler(tool)({ path: "res://no_such_file.gd", wait_ms: 50 })) as ToolResultLike;
    assert.equal(res.isError, true, `${tool} must refuse a missing file`);
    assert.match(res.content![0].text!, /no such file/i);
    assert.doesNotMatch(res.content![0].text!, /^LSP error/);
  }
  assert.ok(!received.some((m) => m.method === "textDocument/didOpen"),
    "a missing file must never be announced to the language server at all");
  // A directory is not a file either — `res://` itself resolves to the project root.
  const dir = (await rec.handler("gd_document_symbols")({ path: "res://" })) as ToolResultLike;
  assert.equal(dir.isError, true);
  assert.match(dir.content![0].text!, /is not a file/);
  lsp.close();
  await srv.close();
});

test("a file that EXISTS and is genuinely empty is still served — the guard is about absence, not size", async () => {
  // The distinction the old behaviour destroyed: "" on disk and no file at all
  // produced identical answers. An empty file that exists must still work.
  const projectPath = tmpProject({ "empty.gd": "", "a.gd": "extends Node\n" });
  const { srv, received } = await startLsp({
    capabilities: { documentSymbolProvider: true },
    onRequest: (msg, s) => writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [] }),
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  for (const good of ["res://empty.gd", "res://a.gd", "a.gd"]) {
    const res = (await rec.handler("gd_document_symbols")({ path: good })) as ToolResultLike;
    assert.notEqual(res.isError, true, `${good} exists and must be served`);
  }
  assert.ok(received.some((m) => m.method === "textDocument/didOpen"),
    "an existing file must still be opened on the language server");
  lsp.close();
  await srv.close();
});

test("314 — gd_rename applies a WorkspaceEdit sent as `documentChanges`, not only as `changes`", async () => {
  // 🔴 314 P4 — THE MIRROR HAD DRIFTED, ON A DESTRUCTIVE TOOL, TOWARDS SILENT SUCCESS.
  // `cs_rename` has called `normalizeWorkspaceEdit` since it was written and its comment
  // says the helper takes either encoding; this plane read `edit.changes` alone, so a
  // server answering in the versioned encoding produced `changed_files: []`,
  // `edit_count: 0`, `applied: true`, `written: []` — a rename that reported success and
  // renamed nothing. Measured over the eleven 150-token clone pairs at 314, this was the
  // ONE difference between the two planes that was not a real difference between them.
  const projectPath = tmpProject({ "player.gd": "var speed = 10\n" });
  const { srv } = await startLsp({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/rename") {
        const uri = (msg.params as { textDocument: { uri: string } }).textDocument.uri;
        writeFrame(s, {
          jsonrpc: "2.0", id: msg.id,
          result: {
            documentChanges: [{
              textDocument: { uri, version: 1 },
              edits: [{ range: { start: { line: 0, character: 4 }, end: { line: 0, character: 9 } }, newText: "velocity" }],
            }],
          },
        });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath, async () => ({ action: "accept", content: { proceed: true } }));
  const res = (await rec.handler("gd_rename")({ path: "player.gd", line: 0, character: 4, new_name: "velocity", apply: true, confirm: true })) as ToolResultLike;
  const sc = structured<{ applied: boolean; written: string[]; edit_count: number; changed_files: string[] }>(res);
  assert.equal(sc.edit_count, 1, "the edit is counted from documentChanges");
  assert.equal(sc.changed_files.length, 1);
  assert.equal(sc.written.length, 1);
  assert.equal(fs.readFileSync(path.join(projectPath, "player.gd"), "utf8"), "var velocity = 10\n",
    "and the file on disk carries the rename — a green report over an unchanged file is the failure this drives");
  lsp.close();
  await srv.close();
});

// ---------------------------------------------------------------------------
// 317 — P6's first payment on `src/tools/lsp.ts`, the worst-covered large file
// in the tree (50.97% of 206 branch paths at 4c46c76). The branches below were
// chosen by what a defect in them does to a user, not by what was cheapest to
// reach: the destructive gate first, then the refusals a caller is told to act
// on, then the arms that decide whether a failure is the engine's fault or the
// server's.
// ---------------------------------------------------------------------------

test("317 — gd_rename apply=true STOPS at a declined prompt and writes nothing to disk", async () => {
  // The one uncovered branch in this file that can destroy a user's work:
  // `if (blocked) return blocked` is the only thing standing between a declined
  // confirmation and a project-wide write. Every other rename test either passes
  // `confirm: true` or accepts the prompt, so the decline path had never run.
  const projectPath = tmpProject({ "player.gd": "var speed = 10\n" });
  let planned = 0;
  const { srv } = await startLsp({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/rename") {
        planned++;
        const uri = (msg.params as { textDocument: { uri: string } }).textDocument.uri;
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: { changes: { [uri]: [{ range: { start: { line: 0, character: 4 }, end: { line: 0, character: 9 } }, newText: "velocity" }] } } });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath, async () => ({ action: "decline" }));
  const res = (await rec.handler("gd_rename")({ path: "player.gd", line: 0, character: 4, new_name: "velocity", apply: true })) as ToolResultLike;
  assert.equal(res.isError, true, "a declined rename must be an error, not a silent no-op");
  assert.match(res.content![0].text!, /Cancelled — user did not approve/);
  // The refusal must name the action it stopped, or a caller cannot tell WHICH
  // destructive call was cancelled when several are in flight.
  assert.match(res.content![0].text!, /Rename to "velocity"/);
  // The claim that matters: the file on disk is byte-identical.
  assert.equal(fs.readFileSync(path.join(projectPath, "player.gd"), "utf8"), "var speed = 10\n");
  // And the plan WAS requested — the gate sits after planning, so this proves the
  // test exercised the gate rather than failing earlier for some other reason.
  assert.equal(planned, 1, "the rename must have been planned, then blocked at the write");
  lsp.close();
  await srv.close();
});

test("317 — gd_implementation, gd_declaration, gd_folding_ranges and gd_document_link refuse WITHOUT dialling a server that never advertised the capability", async () => {
  // Their four siblings (highlight, type_definition, formatting, color,
  // call_hierarchy, semantic_tokens, code_action, workspace_symbols) each had
  // this test; these four shipped the same contract with nothing proving it.
  const projectPath = tmpProject({ "player.gd": "extends Node\n" });
  const { srv, received } = await startLsp({ capabilities: {} });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const rows: Array<[string, string, Record<string, unknown>, string]> = [
    ["gd_implementation", "textDocument/implementation", { path: "player.gd", line: 0, character: 0 }, "implementationProvider"],
    ["gd_declaration", "textDocument/declaration", { path: "player.gd", line: 0, character: 0 }, "declarationProvider"],
    ["gd_folding_ranges", "textDocument/foldingRange", { path: "player.gd" }, "foldingRangeProvider"],
    ["gd_document_link", "textDocument/documentLink", { path: "player.gd" }, "documentLinkProvider"],
  ];
  for (const [tool, method, args, capability] of rows) {
    const res = (await rec.handler(tool)(args)) as ToolResultLike;
    assert.equal(res.isError, true, `${tool} must refuse when ${capability} is absent`);
    const text = res.content![0].text!;
    assert.match(text, /unsupported by the connected Godot build/, `${tool} must say the build is the limit`);
    // The message must name the tool, the method and the capability, because that
    // triple is what tells a reader whether to upgrade Godot or change the call.
    assert.ok(text.includes(tool) && text.includes(method) && text.includes(capability),
      `${tool}'s refusal must name the tool, the method and the capability`);
    // It must also point somewhere: a refusal with no alternative is a dead end.
    assert.match(text, /Use gd_|no host-side alternative|editor-only convenience/, `${tool} must offer an alternative`);
    assert.ok(!received.some((m) => m.method === method), `${tool} must NOT send ${method} when the capability is absent`);
  }
  lsp.close();
  await srv.close();
});

test("317 — a REAL language-server failure is never dressed up as an engine limitation, on any feature-detected tool", async () => {
  // Every one of these tools carries a -32601 belt-and-suspenders: a build that
  // advertises a capability and then answers "method not found" is treated as an
  // engine limitation rather than a fault. The arm that had never run is the OTHER
  // one — a genuine failure — and it is the arm that decides whether the guard is
  // honest or merely broad. If `isMethodNotFound` ever widened, every server crash
  // would be reported as "your Godot is too old" and the user would go and upgrade
  // it for nothing.
  const projectPath = tmpProject({ "player.gd": "extends Node\nfunc _ready():\n\tpass\n" });
  const pos = { path: "player.gd", line: 0, character: 0 };
  const rows: Array<[string, string, Record<string, unknown>, Record<string, unknown>]> = [
    ["gd_workspace_symbols", "workspace/symbol", { query: "Player" }, { workspaceSymbolProvider: true }],
    ["gd_signature_help", "textDocument/signatureHelp", pos, {}],
    ["gd_code_action", "textDocument/codeAction", { path: "player.gd", start_line: 0, start_character: 0 }, { codeActionProvider: true }],
    ["gd_document_highlight", "textDocument/documentHighlight", pos, { documentHighlightProvider: true }],
    ["gd_type_definition", "textDocument/typeDefinition", pos, { typeDefinitionProvider: true }],
    ["gd_implementation", "textDocument/implementation", pos, { implementationProvider: true }],
    ["gd_declaration", "textDocument/declaration", pos, { declarationProvider: true }],
    ["gd_folding_ranges", "textDocument/foldingRange", { path: "player.gd" }, { foldingRangeProvider: true }],
    ["gd_document_link", "textDocument/documentLink", { path: "player.gd" }, { documentLinkProvider: true }],
    ["gd_formatting", "textDocument/formatting", { path: "player.gd" }, { documentFormattingProvider: true }],
    ["gd_document_color", "textDocument/documentColor", { path: "player.gd" }, { colorProvider: true }],
    ["gd_call_hierarchy", "textDocument/prepareCallHierarchy", pos, { callHierarchyProvider: true }],
    ["gd_semantic_tokens", "textDocument/semanticTokens/full", { path: "player.gd" }, { semanticTokensProvider: true }],
  ];
  for (const [tool, method, args, capabilities] of rows) {
    const { srv } = await startLsp({
      capabilities,
      onRequest: (msg, s) => {
        if (msg.method === method) {
          writeFrame(s, { jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: "GDScript language server crashed while answering" } });
        }
      },
    });
    const { lsp, rec } = lspToolHarness(srv.port, projectPath);
    // try/finally, not a bare sequence: an assertion that throws inside this loop
    // would otherwise leak an open socket and a listening server, and the test
    // runner would hang instead of reporting the failure.
    try {
      const res = (await rec.handler(tool)(args)) as ToolResultLike;
      const text = res.content![0].text!;
      assert.equal(res.isError, true, `${tool} must report a -32603 as an error`);
      // The whole claim, in one line: the server's own failure reaches the caller.
      assert.match(text, /LSP error \[-32603\]/, `${tool} must surface the server's code, not swallow it`);
      assert.match(text, /crashed while answering/, `${tool} must relay the server's own words`);
      assert.doesNotMatch(text, /unsupported by the connected Godot build/,
        `${tool} must NOT report a server crash as an engine limitation`);
    } finally {
      lsp.close();
      await srv.close();
    }
  }
});

test("317 — the -32601 guard still fires on a build that answers 'Method not found' with no error code at all", async () => {
  // The control for the test above, and the other half of the `||`: `code ?? -1`
  // means a server that omits the code leaves only the message to judge by. Both
  // operands of the guard now have a case; without this one, widening the regex
  // to match anything would go unnoticed in one direction and narrowing it in the
  // other.
  const projectPath = tmpProject();
  const { srv } = await startLsp({
    capabilities: { workspaceSymbolProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "workspace/symbol") writeFrame(s, { jsonrpc: "2.0", id: msg.id, error: { message: "Method not found" } });
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_workspace_symbols")({ query: "Player" })) as ToolResultLike;
  assert.equal(res.isError, true);
  assert.match(res.content![0].text!, /unsupported by the connected Godot build/,
    "a codeless 'Method not found' is still the engine limitation this guard is for");
  assert.doesNotMatch(res.content![0].text!, /LSP error/, "and it must not leak the raw protocol error");
  lsp.close();
  await srv.close();
});

test("317 — the -32601 belt-and-suspenders fires on the seven tools that had a catch nothing ever entered", async () => {
  // The D7 lesson (advertised != implemented) is written into every one of these
  // tools, and for these seven it had never been executed in either direction.
  // The test above proves the guard is not too broad; this one proves it is not
  // too narrow — a build that advertises the capability and then answers "method
  // not found" must still be told apart from a build that is simply broken.
  //
  // What each refusal must NAME differs by design and the rows say so rather than
  // asserting a lowest common denominator: six route through the generic
  // `unsupportedLsp`, which prints the tool, the LSP method and the capability;
  // `gd_code_action` has its own older, hand-written sentence that names the
  // capability and the code but not the method string. Flattening that difference
  // into one loose regex is how a message stops being checked at all.
  const projectPath = tmpProject({ "player.gd": "extends Node\nfunc _ready():\n\tpass\n" });
  const pos = { path: "player.gd", line: 0, character: 0 };
  const rows: Array<[string, string, Record<string, unknown>, Record<string, unknown>, string[]]> = [
    ["gd_code_action", "textDocument/codeAction", { path: "player.gd", start_line: 0, start_character: 0 }, { codeActionProvider: true }, ["gd_code_action", "codeActionProvider", "-32601"]],
    ["gd_document_highlight", "textDocument/documentHighlight", pos, { documentHighlightProvider: true }, ["gd_document_highlight", "textDocument/documentHighlight", "documentHighlightProvider"]],
    ["gd_implementation", "textDocument/implementation", pos, { implementationProvider: true }, ["gd_implementation", "textDocument/implementation", "implementationProvider"]],
    ["gd_declaration", "textDocument/declaration", pos, { declarationProvider: true }, ["gd_declaration", "textDocument/declaration", "declarationProvider"]],
    ["gd_folding_ranges", "textDocument/foldingRange", { path: "player.gd" }, { foldingRangeProvider: true }, ["gd_folding_ranges", "textDocument/foldingRange", "foldingRangeProvider"]],
    ["gd_document_link", "textDocument/documentLink", { path: "player.gd" }, { documentLinkProvider: true }, ["gd_document_link", "textDocument/documentLink", "documentLinkProvider"]],
    ["gd_formatting", "textDocument/formatting", { path: "player.gd" }, { documentFormattingProvider: true }, ["gd_formatting", "textDocument/formatting", "documentFormattingProvider"]],
  ];
  for (const [tool, method, args, capabilities, mustName] of rows) {
    const { srv } = await startLsp({
      capabilities,
      onRequest: (msg, s) => {
        if (msg.method === method) writeFrame(s, { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } });
      },
    });
    const { lsp, rec } = lspToolHarness(srv.port, projectPath);
    try {
      const res = (await rec.handler(tool)(args)) as ToolResultLike;
      const text = res.content![0].text!;
      assert.equal(res.isError, true, `${tool} must report an advertised-but-unimplemented method as an error`);
      assert.match(text, /unsupported by the connected Godot build/, `${tool} must name the build as the limit`);
      for (const needle of mustName) {
        assert.ok(text.includes(needle), `${tool}'s refusal must name ${needle}`);
      }
      // The point of the guard: the caller never sees the raw protocol error.
      assert.doesNotMatch(text, /LSP error/, `${tool} must not leak the JSON-RPC error it caught`);
    } finally {
      lsp.close();
      await srv.close();
    }
  }
});


// --- The degenerate-reply family -------------------------------------------
// Every normalizer in this file is a pure function of whatever the language
// server sent, and each one is written defensively: `?? 0`, `?? ""`, `?? {}`,
// `Array.isArray(x) ? x : []`. Those defaults are the code that runs when a build
// answers a shape the happy path never produces — and until now not one of them
// had ever executed, so "degrades instead of crashing" was a claim about the
// source rather than about the program. Each test below drives one tool with
// (a) a reply that is not the expected container and (b) items with every
// optional field missing, and asserts the DEFAULTED VALUE rather than merely
// that nothing threw.

test("317 — gd_document_highlight defaults a non-array reply and highlight items with no range or unknown kind", async () => {
  const projectPath = tmpProject({ "player.gd": "extends Node\n" });
  const { srv } = await startLsp({
    capabilities: { documentHighlightProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/documentHighlight") {
        const q = (msg.params as { position: { line: number } }).position.line;
        // line 0 asks for a reply that is not a list at all; line 1 for items that
        // carry none of the optional fields, plus a kind outside the LSP enum.
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: q === 0 ? { not: "an array" } : [{}, { kind: 9 }] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const bad = (await rec.handler("gd_document_highlight")({ path: "player.gd", line: 0, character: 0 })) as ToolResultLike;
  assert.deepEqual(bad.structuredContent, { highlights: [] }, "a non-array reply is an empty list, not a crash");
  const bare = (await rec.handler("gd_document_highlight")({ path: "player.gd", line: 1, character: 0 })) as ToolResultLike;
  assert.deepEqual(bare.structuredContent, { highlights: [
    { line: 0, character: 0, end_line: 0, end_character: 0, kind: "text" },
    // An unknown DocumentHighlightKind is surfaced as its own number rather than
    // silently becoming "text" — a caller can tell "the server said 9" apart from
    // "the server said nothing".
    { line: 0, character: 0, end_line: 0, end_character: 0, kind: "9" },
  ] });
  lsp.close();
  await srv.close();
});

test("317 — gd_folding_ranges defaults a non-array reply and ranges with no line numbers", async () => {
  const projectPath = tmpProject({ "player.gd": "func a():\n\tpass\n" });
  let shape: unknown = null;
  const { srv } = await startLsp({
    capabilities: { foldingRangeProvider: true },
    onRequest: (msg, s) => { if (msg.method === "textDocument/foldingRange") writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: shape }); },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  shape = "not a list";
  assert.deepEqual(((await rec.handler("gd_folding_ranges")({ path: "player.gd" })) as ToolResultLike).structuredContent, { ranges: [] });
  shape = [{}];
  assert.deepEqual(((await rec.handler("gd_folding_ranges")({ path: "player.gd" })) as ToolResultLike).structuredContent,
    { ranges: [{ start_line: 0, end_line: 0, kind: "" }] });
  lsp.close();
  await srv.close();
});

test("317 — gd_document_link defaults a non-array reply and links with no range or target", async () => {
  const projectPath = tmpProject({ "player.gd": "# see res://other.gd\n" });
  let shape: unknown = null;
  const { srv } = await startLsp({
    capabilities: { documentLinkProvider: true },
    onRequest: (msg, s) => { if (msg.method === "textDocument/documentLink") writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: shape }); },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  shape = { nope: true };
  assert.deepEqual(((await rec.handler("gd_document_link")({ path: "player.gd" })) as ToolResultLike).structuredContent, { links: [] });
  shape = [{}];
  assert.deepEqual(((await rec.handler("gd_document_link")({ path: "player.gd" })) as ToolResultLike).structuredContent,
    // An empty target is the honest answer for a link the server described without
    // one — the alternative was `undefined` reaching the caller as a missing key.
    { links: [{ line: 0, character: 0, end_line: 0, end_character: 0, target: "" }] });
  lsp.close();
  await srv.close();
});

test("317 — gd_document_color defaults a non-array reply and colors with no range or channels", async () => {
  const projectPath = tmpProject({ "player.gd": "var c = Color(1,0,0,1)\n" });
  let shape: unknown = null;
  const { srv } = await startLsp({
    capabilities: { colorProvider: true },
    onRequest: (msg, s) => { if (msg.method === "textDocument/documentColor") writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: shape }); },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  shape = 42;
  assert.deepEqual(((await rec.handler("gd_document_color")({ path: "player.gd" })) as ToolResultLike).structuredContent, { colors: [] });
  shape = [{}];
  const bare = (await rec.handler("gd_document_color")({ path: "player.gd" })) as ToolResultLike;
  assert.deepEqual(bare.structuredContent, { colors: [{
    line: 0, character: 0, end_line: 0, end_character: 0,
    red: 0, green: 0, blue: 0, alpha: 0,
    // The convenience hex must agree with the components it is derived from; a
    // swatch that disagrees with its own numbers is worse than no swatch.
    hex: "#00000000",
  }] });
  lsp.close();
  await srv.close();
});

test("317 — gd_call_hierarchy defaults a null prepare, null calls, null entries and call items with nothing in them", async () => {
  const projectPath = tmpProject({ "player.gd": "func a():\n\tb()\n" });
  let prepared: unknown = null;
  const { srv } = await startLsp({
    capabilities: { callHierarchyProvider: true },
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/prepareCallHierarchy") writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: prepared });
      if (msg.method === "callHierarchy/incomingCalls") {
        const item = (msg.params as { item: unknown }).item;
        // The first prepared item is answered with null (a server that resolved the
        // symbol and then had nothing to say); the second with a list containing a
        // null entry, an entry with no fromRanges at all, and one whose fromRanges
        // hold a null and a rangeless object.
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: item === null ? null : [null, { from: {} }, { from: {}, fromRanges: [null, {}] }] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  assert.deepEqual(((await rec.handler("gd_call_hierarchy")({ path: "player.gd", line: 0, character: 5 })) as ToolResultLike).structuredContent,
    { direction: "incoming", items: [] }, "a null prepare is no items, not a crash");
  prepared = [null, { kind: 99 }];
  const res = (await rec.handler("gd_call_hierarchy")({ path: "player.gd", line: 0, character: 5 })) as ToolResultLike;
  const sc = structured<{ items: Array<{ name: string; kind: string; uri: string; line: number; character: number; detail: string; calls: unknown[] }> }>(res);
  assert.equal(sc.items.length, 2);
  // A null CallHierarchyItem becomes a fully defaulted one rather than throwing on
  // property access — every field present, every field empty.
  assert.deepEqual(sc.items[0], { name: "", kind: "", uri: "", line: 0, character: 0, detail: "", calls: [] });
  // An unknown SymbolKind is surfaced as its number, as everywhere else in this file.
  assert.equal(sc.items[1].kind, "99");
  assert.deepEqual(sc.items[1].calls, [
    { name: "", kind: "", uri: "", line: 0, character: 0, detail: "", ranges: [] },
    { name: "", kind: "", uri: "", line: 0, character: 0, detail: "", ranges: [] },
    { name: "", kind: "", uri: "", line: 0, character: 0, detail: "", ranges: [
      { line: 0, character: 0, end_line: 0, end_character: 0 },
      { line: 0, character: 0, end_line: 0, end_character: 0 },
    ] },
  ]);
  lsp.close();
  await srv.close();
});

test("317 — gd_semantic_tokens decodes against a server that advertises no legend, sends holes, or sends data that is not a list", async () => {
  const projectPath = tmpProject({ "player.gd": "extends Node\n" });
  let result: unknown = null;
  const { srv } = await startLsp({
    // Truthy provider, NO legend — the decoder must fall back to printing the raw
    // indices rather than resolving names it was never given.
    capabilities: { semanticTokensProvider: true },
    onRequest: (msg, s) => { if (msg.method === "textDocument/semanticTokens/full") writeFrame(s, { jsonrpc: "2.0", id: msg.id, result }); },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const call = async () => structured<{ token_count: number; tokens: Array<{ line: number; character: number; length: number; type: string; modifiers: string[] }> }>(
    (await rec.handler("gd_semantic_tokens")({ path: "player.gd" })) as ToolResultLike);
  result = null;
  assert.deepEqual(await call(), { token_count: 0, tokens: [] }, "a null reply decodes to no tokens");
  result = { data: "not a list" };
  assert.deepEqual(await call(), { token_count: 0, tokens: [] }, "data that is not an array decodes to no tokens");
  result = { data: [0, 0, 1, 3, 5] };
  const noLegend = await call();
  // Type index 3 and modifier bits 0 and 2, with no legend to resolve them: the
  // numbers come through as strings rather than as undefined or a thrown error.
  assert.deepEqual(noLegend.tokens, [{ line: 0, character: 0, length: 1, type: "3", modifiers: ["0", "2"] }]);
  result = { data: [null, null, null, null, null] };
  assert.deepEqual((await call()).tokens, [{ line: 0, character: 0, length: 0, type: "0", modifiers: [] }],
    "a tuple of holes decodes to a zeroed token rather than NaN positions");
  lsp.close();
  await srv.close();
});

test("317 — gd_document_symbols defaults symbols with no range of any of the three shapes, and an unknown kind", async () => {
  const projectPath = tmpProject({ "player.gd": "extends Node\n" });
  const { srv } = await startLsp({
    onRequest: (msg, s) => {
      if (msg.method === "textDocument/documentSymbol") {
        // The three spellings this normalizer walks in order, and the case where
        // none of them is present. The third — `location.range` — is the legacy
        // `SymbolInformation` shape, which a server may still send in place of
        // `DocumentSymbol`; it was the one spelling nothing had ever exercised.
        writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: [
          {},
          { name: "Odd", kind: 99 },
          { name: "Legacy", kind: 12, location: { uri: "res://player.gd", range: { start: { line: 7, character: 0 } } } },
        ] });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const res = (await rec.handler("gd_document_symbols")({ path: "player.gd" })) as ToolResultLike;
  assert.deepEqual(res.structuredContent, { symbols: [
    { name: "", kind: "", line: 0 },
    { name: "Odd", kind: "99", line: 0 },
    // Read through `location.range`, not defaulted to 0: a legacy-shaped symbol
    // must land on its real line or an outline points at the top of the file.
    { name: "Legacy", kind: "function", line: 7 },
  ] });
  lsp.close();
  await srv.close();
});

test("317 — gd_workspace_symbols defaults a null reply and symbols with no location or unknown kind", async () => {
  const projectPath = tmpProject();
  let result: unknown = null;
  const { srv } = await startLsp({
    capabilities: { workspaceSymbolProvider: true },
    onRequest: (msg, s) => { if (msg.method === "workspace/symbol") writeFrame(s, { jsonrpc: "2.0", id: msg.id, result }); },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  assert.deepEqual(((await rec.handler("gd_workspace_symbols")({ query: "X" })) as ToolResultLike).structuredContent, { symbols: [] },
    "a null reply is no symbols — distinct from the 'unsupported' refusal, which is an error");
  result = [{}, { name: "Odd", kind: 99 }];
  assert.deepEqual(((await rec.handler("gd_workspace_symbols")({ query: "X" })) as ToolResultLike).structuredContent, { symbols: [
    { name: "", kind: "", uri: "", line: 0 },
    { name: "Odd", kind: "99", uri: "", line: 0 },
  ] });
  lsp.close();
  await srv.close();
});

test("317 — gd_signature_help defaults a null reply, a signature with no label or parameters, and a plain-string parameter label", async () => {
  const projectPath = tmpProject({ "player.gd": "func a(x):\n\tpass\n" });
  let result: unknown = null;
  const { srv } = await startLsp({
    onRequest: (msg, s) => { if (msg.method === "textDocument/signatureHelp") writeFrame(s, { jsonrpc: "2.0", id: msg.id, result }); },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const call = async () => structured<{ signatures: Array<{ label: string; documentation: string; parameters: Array<{ label: string; documentation: string }> }>; active_signature: number; active_parameter: number }>(
    (await rec.handler("gd_signature_help")({ path: "player.gd", line: 0, character: 0 })) as ToolResultLike);
  assert.deepEqual(await call(), { signatures: [], active_signature: 0, active_parameter: 0 },
    "a null reply defaults both active indices to 0 rather than leaving them undefined");
  // Per LSP a parameter label may be a plain string OR a [start,end] offset pair
  // into the signature label. The pair form was tested; the string form — the one
  // most servers actually send — was not.
  result = { signatures: [{}, { label: "a(x)", parameters: [{ label: "x" }] }] };
  const two = await call();
  assert.deepEqual(two.signatures[0], { label: "", documentation: "", parameters: [] });
  assert.deepEqual(two.signatures[1].parameters, [{ label: "x", documentation: "" }]);
  lsp.close();
  await srv.close();
});

test("317 — gd_code_action defaults a null reply and an action with no title", async () => {
  const projectPath = tmpProject({ "player.gd": "extends Node\n" });
  let result: unknown = null;
  const { srv } = await startLsp({
    capabilities: { codeActionProvider: true },
    onRequest: (msg, s) => { if (msg.method === "textDocument/codeAction") writeFrame(s, { jsonrpc: "2.0", id: msg.id, result }); },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const args = { path: "player.gd", start_line: 0, start_character: 0 };
  assert.deepEqual(((await rec.handler("gd_code_action")(args)) as ToolResultLike).structuredContent, { actions: [] });
  result = [{}];
  assert.deepEqual(((await rec.handler("gd_code_action")(args)) as ToolResultLike).structuredContent,
    // `has_edit` must be false rather than undefined: a caller deciding whether an
    // action is applicable reads that field.
    { actions: [{ title: "", kind: "", has_edit: false, command: null }] });
  lsp.close();
  await srv.close();
});

test("317 — gd_formatting treats a null edit list as 'nothing to change' and returns the file unaltered", async () => {
  const before = "extends Node\nfunc _ready():\n\tpass\n";
  const projectPath = tmpProject({ "player.gd": before });
  const { srv } = await startLsp({
    capabilities: { documentFormattingProvider: true },
    onRequest: (msg, s) => { if (msg.method === "textDocument/formatting") writeFrame(s, { jsonrpc: "2.0", id: msg.id, result: null }); },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  const sc = structured<{ edit_count: number; formatted: string }>((await rec.handler("gd_formatting")({ path: "player.gd" })) as ToolResultLike);
  assert.equal(sc.edit_count, 0);
  assert.equal(sc.formatted, before, "no edits must return the source verbatim, not an empty string");
  assert.equal(fs.readFileSync(path.join(projectPath, "player.gd"), "utf8"), before, "and gd_formatting never writes");
  lsp.close();
  await srv.close();
});

test("317 — gd_diagnostics uses its default wait when none is given, and calls a diagnostic with no severity an error", async () => {
  const projectPath = tmpProject({ "player.gd": "extends Node\nvar x =\n" });
  const { srv } = await startLsp({
    onNotify: (msg, s) => {
      if (msg.method === "textDocument/didOpen") {
        writeFrame(s, { jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: {
          uri: "res://player.gd",
          diagnostics: [
            // No severity at all, and a severity outside the LSP 1..4 enum: both
            // must land on "error", because under-reporting a problem is the worse
            // direction to fail in.
            { message: "unsaid", range: { start: { line: 1, character: 6 } } },
            { severity: 9, message: "out of range", range: { start: { line: 0, character: 0 } } },
          ],
        } });
      }
    },
  });
  const { lsp, rec } = lspToolHarness(srv.port, projectPath);
  // No wait_ms — the handler's own default applies. The publish arrives on didOpen,
  // so this resolves immediately rather than actually waiting it out.
  const sc = structured<{ diagnostics: Array<{ severity: string; message: string }> }>(
    (await rec.handler("gd_diagnostics")({ path: "player.gd" })) as ToolResultLike);
  assert.equal(sc.diagnostics.length, 2);
  assert.deepEqual(sc.diagnostics.map((d) => d.severity), ["error", "error"]);
  assert.deepEqual(sc.diagnostics.map((d) => d.message), ["unsaid", "out of range"]);
  lsp.close();
  await srv.close();
});

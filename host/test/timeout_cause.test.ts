import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { pathToFileURL } from "node:url";
import { DapClient, DapError, DAP_RESTART_REMEDY } from "../src/dap.js";
import { CsDapClient, CS_START_REMEDY, CS_RESTART_REMEDY } from "../src/csdap.js";
import { LspClient, LspError } from "../src/lsp.js";
import { timeoutRemedy } from "../src/timeout-cause.js";
import { closeRemedy } from "../src/close-cause.js";
import { remedyClause } from "../src/bridge.js";
import { fail as lspFail } from "../src/tools/lsp-common.js";
import { startTcpServer, makeFrameParser, writeFrame, type TcpServer } from "./helpers/tcp.js";

/**
 * 267 — the remedy CHANNEL on `DapError` and `LspError`, and the five sites that had
 * nowhere to put an answer.
 *
 * 🔴 WHAT THESE ASSERT AND WHY THE PAIRS MATTER. Every claim is made in both directions
 * and the two directions are asserted to DIFFER, because 266's finding was that a green
 * assertion on a message body is indistinguishable from a green assertion on a CORRECT
 * one. A test that only checks *the remedy is present* passes just as happily over a
 * sentence pasted onto every failure — so each pair also proves the OTHER population
 * does not get it.
 *
 * 🔴 AND THE BYTE-IDENTITY GROUP IS THE LOAD-BEARING ONE. Four close-handler sites had
 * their next action moved out of the message and onto the field this release. That is a
 * change of channel, not of wording, and the only way to say so honestly is to assert
 * the rendered text against the string the old code built.
 */

interface DapMsg { seq: number; type: string; command?: string; request_seq?: number; success?: boolean; event?: string; body?: unknown }

async function adapterThatNeverAnswers(): Promise<{ srv: TcpServer; seen: DapMsg[] }> {
  const seen: DapMsg[] = [];
  const srv = await startTcpServer((s) => {
    const parse = makeFrameParser((m) => { seen.push(m as unknown as DapMsg); });
    s.on("data", (c) => parse(Buffer.from(c)));
  });
  return { srv, seen };
}

// ---------------------------------------------------------------- the sentence itself

test("267: timeoutRemedy names the knob and the peer it was given, and two planes differ", () => {
  const dap = timeoutRemedy("the debug adapter", "GODOT_DAP_TIMEOUT_MS");
  const lsp = timeoutRemedy("the language server", "GODOT_LSP_TIMEOUT_MS");

  assert.match(dap, /GODOT_DAP_TIMEOUT_MS/);
  assert.match(dap, /the debug adapter/);
  assert.doesNotMatch(dap, /GODOT_LSP_TIMEOUT_MS/);
  assert.match(lsp, /GODOT_LSP_TIMEOUT_MS/);
  assert.match(lsp, /the language server/);
  // The pair must DIFFER: one sentence for four planes would name the wrong knob on three
  // of them, and an operator who exports it learns nothing changed.
  assert.notEqual(dap, lsp);
});

test("267: timeoutRemedy does NOT tell the caller to retry", () => {
  const s = timeoutRemedy("the debug adapter", "GODOT_DAP_TIMEOUT_MS");
  // Three of the four planes carry mutating requests and a late reply is ordinary here,
  // so an unqualified *try again* is the instruction that duplicates a write. The
  // sentence may mention a retry; it must not open with one as the action.
  assert.doesNotMatch(s.split("—")[0] ?? "", /retry|try again/i);
  assert.match(s, /a retry sends a second request/);
});

// ---------------------------------------------------------------- the field, both ways

test("267: DapError and LspError carry a remedy when given one and NOT when not", () => {
  const withRemedy = new DapError("stackTrace", "boom", "Check the thing.");
  const without = new DapError("stackTrace", "boom");
  assert.equal(withRemedy.remedy, "Check the thing.");
  assert.equal(without.remedy, undefined);
  assert.notEqual(withRemedy.remedy, without.remedy);

  const lspWith = new LspError("timeout", "boom", "Check the thing.");
  const lspWithout = new LspError(-32603, "boom");
  assert.equal(lspWith.remedy, "Check the thing.");
  assert.equal(lspWithout.remedy, undefined);

  // An empty string is not a remedy — the field stays absent, as on `BridgeError`, so a
  // renderer cannot append a bare em dash to a complete sentence.
  assert.equal(new DapError("x", "boom", "").remedy, undefined);
});

test("267: remedyClause renders the field on a DapError and renders nothing without one", () => {
  assert.equal(remedyClause(new DapError("x", "boom", "Check the thing.")), " — Check the thing.");
  assert.equal(remedyClause(new DapError("x", "boom")), "");
});

// ---------------------------------------------------------------- driven, not fabricated

test("267: a real DAP deadline carries the remedy on the FIELD and keeps its message wording", async () => {
  const { srv } = await adapterThatNeverAnswers();
  try {
    // `request()` dials lazily, so there is nothing to connect first.
    const dap = new DapClient("127.0.0.1", srv.port, 60);
    const err = await dap.request("stackTrace", {}).then(
      () => null,
      (e: unknown) => e as DapError,
    );
    assert.ok(err instanceof DapError);
    // 🔴 The message keeps `timed out after <n>ms` VERBATIM. `tools/dap.ts`'s
    // `isDapTimeout` branches on that substring and `timeout-caveat.ts` says out loud it
    // must not be disturbed, so a remedy appended to the message rather than the field
    // would have been a behaviour change disguised as a copy edit.
    assert.match(err.message, /timed out after 60ms/);
    assert.equal(err.remedy, timeoutRemedy("the debug adapter", "GODOT_DAP_TIMEOUT_MS"));
    // The two channels are separate: the sentence is NOT also in the message.
    assert.doesNotMatch(err.message, /GODOT_DAP_TIMEOUT_MS/);
    dap.close();
  } finally {
    await srv.close();
  }
});

test("267: a real LSP deadline carries the LSP knob, not the DAP one", async () => {
  const { srv } = await adapterThatNeverAnswers();
  try {
    const lsp = new LspClient("127.0.0.1", srv.port, pathToFileURL(process.cwd()).href, 60);
    const err = await lsp.request("textDocument/hover", {}).then(
      () => null,
      (e: unknown) => e as LspError,
    );
    assert.ok(err instanceof LspError);
    assert.match(err.message, /timed out after 60ms/);
    assert.match(String(err.remedy), /GODOT_LSP_TIMEOUT_MS/);
    assert.doesNotMatch(String(err.remedy), /GODOT_DAP_TIMEOUT_MS/);
    lsp.close();
  } finally {
    await srv.close();
  }
});

// ---------------------------------------------------------------- byte identity

test("267: moving the close remedy to the field leaves the rendered text byte-identical", async () => {
  const { srv, seen } = await adapterThatNeverAnswers();
  const dap = new DapClient("127.0.0.1", srv.port, 5000);
  const pending = dap.request("stackTrace", {}).then(() => null, (e: unknown) => e as DapError);
  // 🔴 THE REQUEST MUST BE IN FLIGHT BEFORE THE DROP, or the rejection comes from
  // `conn.send()` and this asserts the wrong path entirely — which is what the first
  // draft of this test did, and it is the same class of mistake as a test that passes
  // because it never reached the code it names.
  while (seen.length === 0) await new Promise((r) => setTimeout(r, 5));
  await srv.close();
  const err = await pending;
  // 🔴 THE TEARDOWN IS UNCONDITIONAL (266 §4). An assertion throwing before `dap.close()`
  // leaves a live socket holding the event loop, and `node --test` then HANGS rather than
  // reporting the failure — which a positive control on this session's own work proved by
  // hanging, in the file written by the session that recorded the hazard.
  try {
    assert.ok(err instanceof DapError, `expected a DapError, got ${err?.constructor?.name}: ${err?.message}`);

    // What the caller sees today, from the two channels…
    const rendered = `DAP error [${err.command}]: ${err.message}${remedyClause(err)}`;
    // …against the single string the pre-267 code built inside the message alone.
    const remedy = closeRemedy(undefined, "the debug adapter");
    const legacy = `DAP error [${err.command}]: DAP connection closed${remedy ? ` — ${remedy}` : ""}`;
    assert.equal(rendered, legacy);
  } finally {
    dap.close();
  }
});

// ---------------------------------------------------------------- the named consts

test("267: the restart refusals moved their next action to the field and still name their tools", () => {
  assert.match(DAP_RESTART_REMEDY, /`dbg_launch`/);
  assert.match(DAP_RESTART_REMEDY, /`dbg_attach`/);
  assert.match(CS_RESTART_REMEDY, /`cs_dbg_launch`/);
  assert.match(CS_RESTART_REMEDY, /`cs_dbg_attach`/);
  // The two planes must NOT share a sentence: sending a C# caller to `dbg_launch` is a
  // remedy that names a tool for the other language.
  assert.notEqual(DAP_RESTART_REMEDY, CS_RESTART_REMEDY);
  assert.doesNotMatch(CS_RESTART_REMEDY, /`dbg_launch`/);
});

test("267: DapClient.restart with no launch behind it refuses with the remedy on the field", async () => {
  const dap = new DapClient("127.0.0.1", 1, 50);
  const err = await dap.restart().then(() => null, (e: unknown) => e as DapError);
  assert.ok(err instanceof DapError);
  assert.equal(err.message, "no debug session to restart");
  assert.equal(err.remedy, DAP_RESTART_REMEDY);
  // The message is now free of the instruction — the whole point of the move.
  assert.doesNotMatch(err.message, /dbg_launch/);
});

test("267: CsDapClient.restart with no launch behind it refuses with the C# remedy", async () => {
  const cs = new CsDapClient(
    { send: async () => undefined, close: () => undefined, onMessage: () => undefined, onClose: () => undefined },
    50,
  );
  const err = await cs.restart().then(() => null, (e: unknown) => e as DapError);
  assert.ok(err instanceof DapError);
  assert.equal(err.message, "no C# debug session to restart");
  assert.equal(err.remedy, CS_RESTART_REMEDY);
});

test("267: the C# start-failure remedy names what to check and not what was asked", () => {
  assert.match(CS_START_REMEDY, /^Check /);
  assert.match(CS_START_REMEDY, /\.NET assembly/);
  assert.match(CS_START_REMEDY, /\.$/);
  // It must NOT be a second copy of the argument dump the message already prints.
  assert.doesNotMatch(CS_START_REMEDY, /args:/);
});

// ---------------------------------------------------------------- the renderers

test("267: the LSP renderer appends the remedy, and appends nothing when there is none", () => {
  const withR = lspFail(new LspError("timeout", "LSP 'x' timed out after 1ms", "Raise the knob."));
  const withoutR = lspFail(new LspError(-32603, "LSP 'x' timed out after 1ms"));
  assert.match(withR.content[0].text, / — Raise the knob\.$/);
  assert.doesNotMatch(withoutR.content[0].text, / — /);
  // Asserted to DIFFER: a renderer that appended unconditionally would pass the first
  // assertion and is the worse defect.
  assert.notEqual(withR.content[0].text, withoutR.content[0].text);
});

test("267: a refusal rendered by the LSP plane also carries its remedy", () => {
  const refusal = Object.assign(new Error("path is outside the project"), { refusal: true, remedy: "Pass a path inside the project." });
  const out = lspFail(refusal);
  assert.equal(out.content[0].text, "path is outside the project — Pass a path inside the project.");
  // A refusal is the host declining; it must NOT be labelled as the server failing.
  assert.doesNotMatch(out.content[0].text, /LSP error/);
});

void net;
void writeFrame;

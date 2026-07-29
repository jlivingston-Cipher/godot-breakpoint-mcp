import { test } from "node:test";
import assert from "node:assert/strict";
import { annotationsFor, ANNOTATED_TOOLS, applyAnnotations } from "../src/annotations.js";
import {
  applyTimeoutCaveat,
  appendCaveat,
  caveatFor,
  CAVEAT_IDEMPOTENT,
  CAVEAT_NON_IDEMPOTENT,
} from "../src/timeout-caveat.js";

/** The envelope tools/editor/common.ts builds for a failed bridge call. */
const timeoutEnvelope = (method = "node.add", ms = 15000) => ({
  isError: true as const,
  content: [{ type: "text" as const, text: `Bridge error [timeout]: Bridge request '${method}' timed out after ${ms}ms` }],
});

// ---- which tools get which caveat -------------------------------------------

test("read-only tools get NO caveat", () => {
  const readOnly = ANNOTATED_TOOLS.filter((n) => annotationsFor(n).readOnlyHint);
  assert.equal(readOnly.length, 92, "the read-only set is the one this decision was sized against");
  for (const name of readOnly) {
    assert.equal(caveatFor(name), null, `${name} is read-only — a stale read is not a hazard`);
  }
});

test("mutating tools get a caveat, and non-idempotent ones get the firmer one", () => {
  const mutating = ANNOTATED_TOOLS.filter((n) => !annotationsFor(n).readOnlyHint);
  assert.equal(mutating.length, 197);
  const firm = mutating.filter((n) => caveatFor(n) === CAVEAT_NON_IDEMPOTENT);
  const soft = mutating.filter((n) => caveatFor(n) === CAVEAT_IDEMPOTENT);
  assert.equal(firm.length, 72, "this many duplicate on a blind retry — the blast radius");
  assert.equal(soft.length, 125);
  assert.equal(firm.length + soft.length, mutating.length, "every mutating tool resolves to exactly one caveat");
  // Spot-check the tool the whole finding was reproduced with.
  assert.equal(caveatFor("node_add"), CAVEAT_NON_IDEMPOTENT);
  assert.match(CAVEAT_NON_IDEMPOTENT, /SECOND time/);
  assert.match(CAVEAT_IDEMPOTENT, /retrying is safe/);
});

// ---- what the caveat is appended to ------------------------------------------

test("the caveat is APPENDED — the 'timed out after <n>ms' substring survives intact", () => {
  const out = appendCaveat(timeoutEnvelope("node.add", 15000), CAVEAT_NON_IDEMPOTENT) as {
    content: Array<{ text: string }>;
  };
  const text = out.content[0].text;
  assert.match(text, /timed out after 15000ms/, "tools/dap.ts:29 branches on this substring");
  assert.match(text, /Bridge error \[timeout\]/);
  assert.ok(text.endsWith(CAVEAT_NON_IDEMPOTENT), "the caveat goes on the end, it does not replace anything");
});

test("a success envelope is returned untouched, by identity", () => {
  const ok = { content: [{ type: "text", text: "fine" }] };
  assert.equal(appendCaveat(ok, CAVEAT_NON_IDEMPOTENT), ok, "no copy, no change");
});

test("a non-timeout bridge error is returned untouched", () => {
  const err = { isError: true, content: [{ type: "text", text: "Bridge error [bad_path]: no such node" }] };
  assert.equal(appendCaveat(err, CAVEAT_NON_IDEMPOTENT), err);
});

// The caveat says "the editor may already have applied it", which is a claim
// about the EDITOR BRIDGE. An LSP or DAP timeout implies no editor-side mutation,
// and tools/dap.ts runs its own /timed out after/ predicate over DapError. Both
// must be left alone.
test("an LSP timeout envelope is left alone — this is the bridge's claim, not theirs", () => {
  const lsp = { isError: true, content: [{ type: "text", text: "LSP error [timeout]: LSP 'hover' timed out after 15000ms" }] };
  assert.equal(appendCaveat(lsp, CAVEAT_NON_IDEMPOTENT), lsp);
});

test("only the FIRST matching text block is annotated", () => {
  const two = {
    isError: true,
    content: [
      { type: "text", text: "Bridge error [timeout]: Bridge request 'a' timed out after 10ms" },
      { type: "text", text: "Bridge error [timeout]: Bridge request 'b' timed out after 10ms" },
    ],
  };
  const out = appendCaveat(two, CAVEAT_IDEMPOTENT) as { content: Array<{ text: string }> };
  assert.ok(out.content[0].text.endsWith(CAVEAT_IDEMPOTENT));
  assert.ok(!out.content[1].text.endsWith(CAVEAT_IDEMPOTENT));
});

// ---- the registration wrapper ------------------------------------------------

/** Recorder standing in for McpServer, matching annotations.test.ts's pattern. */
function recorder() {
  const handlers = new Map<string, (...a: unknown[]) => unknown>();
  const server = {
    registerTool(name: string, _config: unknown, handler: (...a: unknown[]) => unknown) {
      handlers.set(name, handler);
      return { name };
    },
  };
  return { server, handlers };
}

test("a mutating tool's timeout envelope leaves with the caveat; a read-only tool's does not", async () => {
  const { server, handlers } = recorder();
  const mcp = server as unknown as Parameters<typeof applyTimeoutCaveat>[0];
  applyAnnotations(mcp);
  applyTimeoutCaveat(mcp);

  const raw = async () => timeoutEnvelope();
  (mcp as unknown as { registerTool: (n: string, c: unknown, h: unknown) => unknown }).registerTool("node_add", {}, raw);
  (mcp as unknown as { registerTool: (n: string, c: unknown, h: unknown) => unknown }).registerTool("node_get_property", {}, raw);

  const mutated = (await handlers.get("node_add")!()) as { content: Array<{ text: string }> };
  assert.ok(mutated.content[0].text.endsWith(CAVEAT_NON_IDEMPOTENT), "node_add is mutating and not idempotent");

  // Not wrapped-and-inert — actually not wrapped. The handler keeps its identity.
  assert.equal(handlers.get("node_get_property"), raw, "a read-only tool's handler is passed through untouched");
});

test("a synchronous handler stays synchronous — wrapping changes no timing", () => {
  const { server, handlers } = recorder();
  const mcp = server as unknown as Parameters<typeof applyTimeoutCaveat>[0];
  applyAnnotations(mcp);
  applyTimeoutCaveat(mcp);
  (mcp as unknown as { registerTool: (n: string, c: unknown, h: unknown) => unknown }).registerTool(
    "node_add",
    {},
    () => timeoutEnvelope(),
  );
  const out = handlers.get("node_add")!();
  assert.ok(!(out instanceof Promise), "a sync handler must not be promoted to async by the wrapper");
  assert.ok(((out as { content: Array<{ text: string }> }).content[0].text).endsWith(CAVEAT_NON_IDEMPOTENT));
});

test("a handler that returns something unexpected is passed through, not crashed on", () => {
  for (const weird of [null, undefined, 42, "text", {}, { isError: true }, { isError: true, content: "no" }]) {
    assert.equal(appendCaveat(weird, CAVEAT_IDEMPOTENT), weird, `${JSON.stringify(weird)} must pass through`);
  }
});

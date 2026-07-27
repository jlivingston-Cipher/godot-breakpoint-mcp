import { test } from "node:test";
import assert from "node:assert/strict";
import { buildToolsets } from "../src/toolsets.js";
import { applyOutputSchemas } from "../src/schemas.js";
import { loadConfig } from "../src/config.js";
import { ANNOTATED_TOOLS, annotationsFor, applyAnnotations } from "../src/annotations.js";

const EXPECTED_TOOL_COUNT = 289;

/**
 * Register the whole surface against a recorder exactly as index.ts does —
 * applyOutputSchemas, then applyAnnotations, then every register*Tools — so the
 * annotations assertions run against the REAL registry rather than a fixture.
 * Mirrors registration.test.ts / capabilities.test.ts. Handlers are never
 * invoked, so stub clients are fine.
 */
function registerAll() {
  const calls: Array<{ name: string; config: Record<string, unknown> }> = [];
  const server = {
    registerTool(name: string, config: Record<string, unknown>) { calls.push({ name, config }); return { name }; },
    registerResource() {},
    experimental: {
      tasks: {
        registerToolTask(name: string, config: Record<string, unknown>) { calls.push({ name, config }); return { name }; },
      },
    },
    server: { elicitInput: async () => ({ action: "decline" }) },
  };

  const mcp = server as unknown as Parameters<typeof applyOutputSchemas>[0];
  const stub = {} as unknown as never;

  applyOutputSchemas(mcp);
  applyAnnotations(mcp);

  const toolsets = buildToolsets({
    server: mcp,
    bridge: stub,
    runtime: stub,
    lsp: stub,
    csLsp: stub,
    dap: stub,
    csDap: stub,
    config: loadConfig(),
  });
  for (const ts of toolsets) ts.run();

  return calls;
}

type Ann = { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
const annOf = (c: { config: Record<string, unknown> }) => c.config.annotations as Ann | undefined;

test("the annotation table is total: every registered tool has an entry, and every entry is a real tool", () => {
  const calls = registerAll();
  assert.equal(calls.length, EXPECTED_TOOL_COUNT);

  const registered = new Set(calls.map((c) => c.name));
  const annotated = new Set(ANNOTATED_TOOLS);

  const missing = [...registered].filter((n) => !annotated.has(n)).sort();
  const stale = [...annotated].filter((n) => !registered.has(n)).sort();

  assert.deepEqual(missing, [], `tools with no annotation entry: ${missing.join(", ")}`);
  assert.deepEqual(stale, [], `annotation entries for tools that no longer exist: ${stale.join(", ")}`);
});

test("every registered tool ships all four hints — absence is an explicit false, never 'unknown'", () => {
  const calls = registerAll();
  const bad = calls
    .filter((c) => {
      const a = annOf(c);
      return (
        a === undefined ||
        typeof a.readOnlyHint !== "boolean" ||
        typeof a.destructiveHint !== "boolean" ||
        typeof a.idempotentHint !== "boolean" ||
        typeof a.openWorldHint !== "boolean"
      );
    })
    .map((c) => c.name);
  assert.deepEqual(bad, [], `tools with missing/partial annotations: ${bad.join(", ")}`);
});

test("the injected annotations match annotationsFor() for every tool", () => {
  for (const c of registerAll()) {
    assert.deepEqual(annOf(c), annotationsFor(c.name), `annotations drifted for ${c.name}`);
  }
});

test("no tool is both read-only and destructive, and no read-only tool claims openWorld", () => {
  const contradictory: string[] = [];
  const egressing: string[] = [];
  for (const c of registerAll()) {
    const a = annOf(c)!;
    if (a.readOnlyHint && a.destructiveHint) contradictory.push(c.name);
    if (a.readOnlyHint && a.openWorldHint) egressing.push(c.name);
  }
  assert.deepEqual(contradictory, [], `read-only AND destructive: ${contradictory.join(", ")}`);
  assert.deepEqual(egressing, [], `read-only AND openWorld: ${egressing.join(", ")}`);
});

test("every read-only tool is genuinely non-mutating: none is confirmation-gated", () => {
  // gate()-ed tools take an optional `confirm` input. A read-only tool must never
  // have one — if it does, either the hint or the gating is wrong.
  const bad: string[] = [];
  for (const c of registerAll()) {
    const a = annOf(c)!;
    const shape = c.config.inputSchema as Record<string, unknown> | undefined;
    if (a.readOnlyHint && shape && Object.prototype.hasOwnProperty.call(shape, "confirm")) bad.push(c.name);
  }
  assert.deepEqual(bad, [], `tools marked read-only but confirmation-gated: ${bad.join(", ")}`);
});

test("openWorldHint is false across the whole surface — every bridge is loopback-only", () => {
  const egress = registerAll()
    .filter((c) => annOf(c)!.openWorldHint)
    .map((c) => c.name);
  assert.deepEqual(
    egress,
    [],
    `tool(s) now claim egress beyond loopback: ${egress.join(", ")} — if intended, update annotations.ts OPEN_WORLD and this test together`,
  );
});

test("an explicit annotations block on a call site wins over the injected one", () => {
  const calls: Array<{ name: string; config: Record<string, unknown> }> = [];
  const server = {
    registerTool(name: string, config: Record<string, unknown>) { calls.push({ name, config }); return { name }; },
  };
  const mcp = server as unknown as Parameters<typeof applyAnnotations>[0];
  applyAnnotations(mcp);

  const override = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
  (mcp as unknown as { registerTool: (n: string, c: unknown, h: unknown) => unknown }).registerTool(
    "node_delete",
    { title: "x", description: "y", inputSchema: {}, annotations: override },
    () => {},
  );

  assert.deepEqual(calls[0].config.annotations, override);
});

test("annotationsFor() returns an all-false block for an unknown tool name", () => {
  assert.deepEqual(annotationsFor("definitely_not_a_tool"), {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  });
});

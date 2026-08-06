import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  applyWireDefaults, dialectSensitive, normalizeTool, normalizeToolList,
  stripDefaultExecution, stripDialect, SDK_DIALECT,
} from "../src/wire-defaults.js";
import { applyOutputSchemas } from "../src/schemas.js";
import { applyAnnotations } from "../src/annotations.js";
import { buildToolsets } from "../src/toolsets.js";
import { TASK_CAPABILITIES, taskStore } from "../src/tasks.js";
import { loadConfig } from "../src/config.js";

const EXPECTED_TOOL_COUNT = 291;
const require = createRequire(import.meta.url);

// ── 1. THE FAIL-SAFE, WHICH IS THE ONLY REASON THE STRIP IS SAFE AT ALL ──────────────

test("strips the SDK's draft-07 declaration from a dialect-inert schema", () => {
  const s = { $schema: SDK_DIALECT, type: "object", properties: { a: { type: "string" } } };
  const out = stripDialect(s) as Record<string, unknown>;
  assert.equal(out.$schema, undefined);
  assert.deepEqual(out, { type: "object", properties: { a: { type: "string" } } });
});

test("🔴 KEEPS the declaration when a keyword the two dialects disagree on is present", () => {
  // Each of these means something different, or is spelled differently, under 2020-12.
  const loadBearing: Array<[string, Record<string, unknown>]> = [
    ["tuple items", { type: "array", items: [{ type: "string" }, { type: "number" }] }],
    ["additionalItems", { type: "array", items: { type: "string" }, additionalItems: false }],
    ["boolean exclusiveMinimum", { type: "number", minimum: 0, exclusiveMinimum: true }],
    ["dependencies keyword", { type: "object", dependencies: { a: ["b"] } }],
    ["definitions", { definitions: { X: { type: "string" } }, type: "object" }],
    ["$ref with siblings", { $ref: "#/definitions/X", description: "adjacent" }],
    ["nested, not just at the root",
      { type: "object", properties: { deep: { type: "array", items: [{ type: "string" }] } } }],
  ];
  for (const [why, body] of loadBearing) {
    const s = { $schema: SDK_DIALECT, ...body };
    assert.equal((stripDialect(s) as Record<string, unknown>).$schema, SDK_DIALECT,
      `${why}: the declaration is load-bearing here and must survive`);
  }
});

test("🔴 a property NAMED like a keyword is not a keyword — the false positive that would have kept the declaration on the whole surface", () => {
  // `scene_get_dependencies` really does return a field called `dependencies`. A walker
  // that cannot tell an author's vocabulary from the protocol's reads 291 tools as
  // dialect-bound and strips nothing, which is a silent no-op wearing a fail-safe's face.
  const s = {
    $schema: SDK_DIALECT, type: "object",
    properties: {
      dependencies: { type: "array", items: { type: "string" } },
      definitions: { type: "string" },
      items: { type: "string" },
    },
  };
  assert.equal(dialectSensitive({ ...s, $schema: undefined }), false);
  assert.equal((stripDialect(s) as Record<string, unknown>).$schema, undefined);
});

test("a NUMERIC exclusiveMinimum is common to both dialects and must not pin the declaration", () => {
  // 65 of ours are numeric. Matching on the key alone would keep the declaration on a
  // third of the surface for a difference that does not exist.
  const s = { $schema: SDK_DIALECT, type: "number", exclusiveMinimum: 0 };
  assert.equal((stripDialect(s) as Record<string, unknown>).$schema, undefined);
});

test("a dialect somebody chose deliberately is left alone", () => {
  const s = { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object" };
  assert.deepEqual(stripDialect(s), s);
});

// ── 2. THE EXECUTION DEFAULT ─────────────────────────────────────────────────────────

test("drops execution only when it carries nothing but the spec's own default", () => {
  assert.equal("execution" in stripDefaultExecution(
    { name: "a", execution: { taskSupport: "forbidden" } } as { name: string; execution?: unknown }),
    false);
  for (const keep of [
    { taskSupport: "optional" },
    { taskSupport: "required" },
    { taskSupport: "forbidden", somethingElse: 1 }, // no longer only the default
  ]) {
    assert.deepEqual(stripDefaultExecution(
      { name: "a", execution: keep } as { name: string; execution?: unknown }).execution, keep);
  }
  assert.deepEqual(stripDefaultExecution(
    { name: "a" } as { name: string; execution?: unknown }), { name: "a" });
});

test("normalizeToolList preserves everything it is not there to change", () => {
  const r = normalizeToolList({
    tools: [{ name: "a", execution: { taskSupport: "forbidden" },
              inputSchema: { $schema: SDK_DIALECT, type: "object" } }],
    nextCursor: "abc", _meta: { keep: true },
  }) as Record<string, unknown>;
  assert.equal(r.nextCursor, "abc");
  assert.deepEqual(r._meta, { keep: true });
  assert.deepEqual(r.tools, [{ name: "a", inputSchema: { type: "object" } }]);
  // and a result that is not a tool list is returned untouched
  const odd = { notTools: 1 };
  assert.equal(normalizeToolList(odd as never), odd);
});

test("normalizeTool does not clone what it does not touch", () => {
  const clean = { name: "a", inputSchema: { type: "object" } };
  assert.equal(normalizeTool(clean), clean);
});

// ── 3. THE LIVE SURFACE, THROUGH A REAL SERVER AND A REAL CLIENT ─────────────────────

async function liveTools() {
  const server = new McpServer(
    { name: "breakpoint-mcp-test", version: "0.0.0" },
    { capabilities: { ...TASK_CAPABILITIES }, taskStore },
  );
  applyWireDefaults(server);
  applyOutputSchemas(server);
  applyAnnotations(server);
  const stub = {} as unknown as never;
  buildToolsets({
    server, bridge: stub, runtime: stub, lsp: stub, csLsp: stub,
    dap: stub, csDap: stub, config: loadConfig(),
  }).forEach((g) => g.run());

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "wire-defaults-test", version: "0.0.0" }, { capabilities: {} });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const tools = [];
  let cursor: string | undefined;
  do {
    const page = await client.listTools(cursor ? { cursor } : {});
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  await client.close();
  return tools as Array<Record<string, unknown>>;
}

test("the wire surface carries no dialect declaration and no spec-default taskSupport", async () => {
  const tools = await liveTools();
  assert.equal(tools.length, EXPECTED_TOOL_COUNT);
  const declaring = tools.filter((t) =>
    (t.inputSchema as { $schema?: unknown } | undefined)?.$schema !== undefined ||
    (t.outputSchema as { $schema?: unknown } | undefined)?.$schema !== undefined);
  assert.deepEqual(declaring.map((t) => t.name), [],
    "every schema on the wire must inherit MCP's default dialect, not declare one");
  const restating = tools.filter((t) =>
    (t.execution as { taskSupport?: unknown } | undefined)?.taskSupport === "forbidden");
  assert.deepEqual(restating.map((t) => t.name), []);
});

test("the three genuine task tools keep their non-default taskSupport", async () => {
  const tools = await liveTools();
  const optional = tools
    .filter((t) => (t.execution as { taskSupport?: unknown } | undefined)?.taskSupport === "optional")
    .map((t) => t.name)
    .sort();
  assert.deepEqual(optional, ["godot_export", "godot_import", "godot_run_headless_script"],
    "stripping the default must not reach the tools that actually support tasks");
});

test("🔴 the strip is INDEPENDENTLY safe — every live schema compiles under a strict 2020-12 validator, and agreed with draft-07 before it was stripped", async () => {
  // 🔴 THIS IS THE ONE ASSERTION THAT IS NOT SELF-REFERENTIAL. Every other check here
  // asks `dialectSensitive()` whether the strip was safe — the same function that decided
  // to strip. Ajv is a second opinion with no stake in the answer: it compiles what
  // actually ships, under the ONE dialect MCP obliges every implementation to support.
  /* eslint-disable @typescript-eslint/no-var-requires */
  const Ajv2020 = require("ajv/dist/2020").default ?? require("ajv/dist/2020");
  const AjvDraft7 = require("ajv").default ?? require("ajv");
  const tools = await liveTools();
  const probes = [{}, { a: 1 }, { path: "res://x.tscn" },
    { name: "n", type: "t", path: "p", child_count: 0 }];

  let compiled = 0, disagreements = 0;
  for (const t of tools) {
    for (const which of ["inputSchema", "outputSchema"] as const) {
      const s = t[which] as Record<string, unknown> | undefined;
      if (!s) continue;
      const under2020 = new Ajv2020({ strict: false }).compile(s); // throws on a foreign dialect
      compiled += 1;
      // and the same schema under the dialect the SDK used to declare must decide alike
      const under7 = new AjvDraft7({ strict: false, validateSchema: false })
        .compile({ ...s, $schema: SDK_DIALECT });
      for (const p of probes) if (!!under2020(p) !== !!under7(p)) disagreements += 1;
    }
  }
  assert.ok(compiled > 500, `expected the whole schema surface, compiled ${compiled}`);
  assert.equal(disagreements, 0,
    "removing the declaration changed what a schema accepts — the strip is NOT meaning-preserving");
});

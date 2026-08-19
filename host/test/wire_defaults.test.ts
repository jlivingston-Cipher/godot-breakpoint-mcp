import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  applyWireDefaults, containersInert, dialectSensitive, normalizeTool, normalizeToolList,
  stripDefaultExecution, stripDialect, SDK_DIALECT,
} from "../src/wire-defaults.js";
import { applyOutputSchemas } from "../src/schemas.js";
import { applyAnnotations } from "../src/annotations.js";
import { buildToolsets } from "../src/toolsets.js";
import { TASK_CAPABILITIES, taskStore } from "../src/tasks.js";
import { loadConfig } from "../src/config.js";

const EXPECTED_TOOL_COUNT = 292;
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
    ["$ref with siblings", { $ref: "#/definitions/X", description: "adjacent" }],
    // 🆕 255 — the container is inert only while every reference into it is a PATH. These
    // three are the ways a name gets involved, and each keeps the declaration.
    ["definitions reached by $anchor",
      { definitions: { X: { $anchor: "x", type: "string" } }, type: "object" }],
    ["definitions carrying a nested $id",
      { definitions: { X: { $id: "https://e.example/x", type: "string" } }, type: "object" }],
    ["$defs with a reference that leaves the document",
      { $defs: { X: { type: "string" } }, properties: { a: { $ref: "https://e.example/x" } } }],
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
  // that cannot tell an author's vocabulary from the protocol's reads 292 tools as
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

test("🆕 255 — a definition container reached only by PATH is inert, and that is the whole recursive surface", () => {
  // zod 4 hoists a recursive schema into `definitions` and points at it with a plain
  // local `$ref`; zod 3 pointed the same cycle at `#/properties/children/items`. Both are
  // JSON Pointers, and a pointer walks the document by key under either dialect — it does
  // not ask whether the key it walks through is vocabulary. Before 255 this shape kept the
  // declaration on `scene_get_tree` and `runtime_get_tree`, which is the exact interop
  // hazard 208 §7.1 removed from every other tool, re-arriving through a dependency bump.
  const recursive = {
    $schema: SDK_DIALECT,
    type: "object",
    properties: { children: { type: "array", items: { $ref: "#/definitions/__schema0" } } },
    definitions: { __schema0: { type: "object", properties: { name: { type: "string" } } } },
  };
  assert.equal(containersInert(recursive), true);
  assert.equal((stripDialect(recursive) as Record<string, unknown>).$schema, undefined,
    "a container nothing reaches by name does not bind the document to a dialect");
  // and the 2020-12 spelling of the same shape answers identically — the rule is about
  // how the container is REACHED, not which of the two words spells it.
  const twenty = { ...recursive, $defs: recursive.definitions, definitions: undefined };
  assert.equal(dialectSensitive({ ...twenty, $schema: undefined }), false);
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

// ── 270. THE INPUT SIDE OF CHECK 29's QUESTION, WHICH NOBODY HAD ASKED ───────────────

/**
 * 🔴 ISSUE #327's WORST HALF LIVED IN THE SET DIFFERENCE NOBODY HAD TAKEN.
 *
 * `schemas.test.ts` has read the OUTPUT schemas' unconstrained-**required** keys since
 * 255, in both directions, and never asked the same question of the INPUTS. `z.any()`
 * answers true to zod's `isOptional()`, so `value` — spelled `z.any()`, described as
 * "New value", on SEVEN shipped tools — was published to every client OUTSIDE the
 * `required` list. A client omitting it was obeying this schema, and the addon then read
 * `params.get("value")` as null and wrote the property type's ZERO over whatever was
 * there. Measured live on Godot 4.7: `rotation` 1.25 -> 0.0, `position` (123, 456) ->
 * (0, 0), reported as success both times.
 *
 * 🔴 AND IT IS A ROSTER RATHER THAN A BAN, because an unconstrained optional input is a
 * legitimate thing to publish. `project_test_setting`'s `value` means *if provided, set
 * it*; `runtime_inject_input`'s `position` and `relative` mean *wherever the event lands
 * by default*. Each of those three is a decision. What must not happen again is one
 * arriving by accident, which is exactly how `value` got here — described in prose as
 * required on all seven tools, and optional on the wire on all seven.
 */
const OPTIONAL_ANY_INPUT_KEYS: ReadonlyArray<string> = [
  "editorsettings_get_set::value",
  "runtime_inject_input::event.position",
  "runtime_inject_input::event.relative",
];

/**
 * The seven `value` keys #327 was about, which are REQUIRED as of 270. Asserted
 * positively and separately from the roster above, because a roster is only evidence
 * that nothing NEW slipped in — it cannot notice a key silently leaving the surface,
 * and "the population shrank" is how a gate goes quiet without going red.
 */
const REQUIRED_VALUE_INPUTS: ReadonlyArray<string> = [
  "anim_insert_key::value",
  "node_set_property::value",
  "project_set_setting::value",
  "resource_set_property::value",
  "runtime_await_condition::value",
  "runtime_set_property::value",
  "shadermaterial_set_param::value",
];

/**
 * JSON Schema keywords that ANNOTATE and do not constrain. A subschema carrying only
 * these validates every instance, exactly as `{}` does.
 *
 * 🔴 THIS SET IS WHY THE FIRST DRAFT OF THIS TEST WAS A TAUTOLOGY. `schemas.test.ts`'s
 * output-side twin can ask `Object.keys(sub).length === 0`, because output schemas carry
 * no prose. Every input key does: `z.any().describe("New value")` compiles to
 * `{"description": "New value"}`, whose key count is ONE. A detector that measured
 * emptiness rather than CONSTRAINT would have found nothing, passed on day one, and been
 * blind to all seven of the keys it was written for.
 */
const ANNOTATION_ONLY = new Set([
  "description", "title", "default", "examples", "deprecated", "$comment", "readOnly", "writeOnly",
]);

/** Does this subschema accept literally every instance? */
function constrainsNothing(sub: unknown): boolean {
  if (sub === true) return true;
  if (sub === null || typeof sub !== "object") return false;
  return Object.keys(sub as object).every((k) => ANNOTATION_ONLY.has(k));
}

/** Every property name whose subschema constrains NOTHING and is NOT in `required`. */
function unconstrainedOptional(node: unknown, path: string, out: string[]): void {
  if (node === null || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const props = obj.properties as Record<string, unknown> | undefined;
  if (props) {
    const required = new Set(Array.isArray(obj.required) ? (obj.required as string[]) : []);
    for (const [name, sub] of Object.entries(props)) {
      const here = path ? `${path}.${name}` : name;
      if (!required.has(name) && constrainsNothing(sub)) out.push(here);
      unconstrainedOptional(sub, here, out);
    }
  }
  if (obj.items) unconstrainedOptional(obj.items, `${path}[]`, out);
}

test("🔴 270 — the input keys the wire leaves unconstrained AND optional are exactly the declared set", async () => {
  const tools = await liveTools();
  const found: string[] = [];
  for (const t of tools) {
    const hits: string[] = [];
    unconstrainedOptional(t.inputSchema, "", hits);
    for (const h of hits) found.push(`${String(t.name)}::${h}`);
  }
  assert.deepEqual([...found].sort(), [...OPTIONAL_ANY_INPUT_KEYS].sort(),
    "an input key is published as BOTH unconstrained and optional and the roster does not "
    + "name it. That is the shape of issue #327: a client omitting it is obeying this schema, "
    + "and the addon then writes the property type's zero over whatever was there. Either "
    + "constrain it (`requiredEncodedValue` in schemas.ts) or add it to "
    + "OPTIONAL_ANY_INPUT_KEYS on purpose.");

  // The other direction, positively: the seven are on the surface and every one of them
  // is REQUIRED. A key that vanished would leave the roster above perfectly green.
  const byName = new Map(tools.map((t) => [String(t.name), t.inputSchema as Record<string, unknown>]));
  for (const row of REQUIRED_VALUE_INPUTS) {
    const [tool, key] = row.split("::");
    const schema = byName.get(tool);
    assert.ok(schema, `${tool} is not on the tool surface — issue #327's roster names it`);
    const required = new Set((schema.required as string[]) ?? []);
    assert.ok(required.has(key),
      `${row} is not in the published \`required\` list. This is issue #327 exactly: the `
      + `description calls it "New value" and the schema says a client may omit it, and `
      + `omitting it writes the property type's zero over whatever was there.`);
  }
});

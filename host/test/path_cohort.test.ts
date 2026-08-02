import { test } from "node:test";
import assert from "node:assert/strict";
import { enumeratePathCohort, summarisePathCohort, type ToolLike } from "../src/path-cohort.js";

/**
 * Session 167 — the enumerator's OWN tests.
 *
 * 166 §8 item 37 earned the rule these assertions exist to hold: WHEN YOU INHERIT AN
 * ENUMERATOR, READ ITS FILTERS BEFORE YOU TRUST ITS COUNT. "78" was quoted in three
 * handoffs and two shipped CHANGELOGs and nobody read the loop that produced it.
 *
 * 🔴 EVERY ASSERTION HERE IS POSITIVE — it names a row the walk MUST FIND. That is
 * 166 §4's survivor lesson: a `doesNotMatch`-shaped assertion ("the count did not go
 * down") passes for every other way of being wrong. Each of the three historical
 * blindnesses gets a test that FAILS if it is ever reintroduced.
 */

const row = (rows: ReturnType<typeof enumeratePathCohort>, tool: string, param: string) =>
  rows.find((r) => r.tool === tool && r.param === param);

test("BLINDNESS 1 — it recurses: a nested parameter is found, with its dotted trail", () => {
  const tools: ToolLike[] = [
    {
      name: "card_template_create",
      inputSchema: {
        properties: {
          theme: { type: "object", properties: { font_path: { type: "string" } } },
        },
      },
    },
  ];
  const rows = enumeratePathCohort(tools);
  const hit = row(rows, "card_template_create", "theme.font_path");
  assert.ok(hit, "the nested row must be found — enum163 could not see it at all");
  assert.equal(hit.depth, 1);
});

test("BLINDNESS 2 — a parameter literally named `path` is NEVER discarded", () => {
  // `if (prop === "path") continue;` was 162's CONCLUSION compiled into the tool.
  // It threw away 124 rows. The walk must count them, and mark them.
  const tools: ToolLike[] = [
    { name: "theme_set_font", inputSchema: { properties: { path: { type: "string" } } } },
  ];
  const rows = enumeratePathCohort(tools);
  const hit = row(rows, "theme_set_font", "path");
  assert.ok(hit, "a `path`-named parameter must appear in the cohort");
  assert.equal(hit.named, true, "and must be marked so the cohort stays comparable");
  assert.equal(summarisePathCohort(rows).topLevelNamedPath, 1);
});

test("BLINDNESS 3 — a COMPOUND name with NO description is found by name alone", () => {
  // The exact case that made 165's own prediction fail: `{"type":"string"}` with no
  // description. An anchored exact-word list cannot see `font_path`; there is no
  // description for a description test to read. It was invisible to BOTH hints.
  const tools: ToolLike[] = [
    { name: "t", inputSchema: { properties: { font_path: { type: "string" } } } },
  ];
  const hit = row(enumeratePathCohort(tools), "t", "font_path");
  assert.ok(hit, "a compound name with no description must still be found");
  assert.equal(hit.why, "name", "and it must be the NAME hint that found it");
  assert.equal(hit.desc, "");
});

test("a description alone is enough when the name says nothing", () => {
  const tools: ToolLike[] = [
    { name: "t", inputSchema: { properties: { blob: { type: "string", description: "A res:// path" } } } },
  ];
  const hit = row(enumeratePathCohort(tools), "t", "blob");
  assert.ok(hit);
  assert.equal(hit.why, "desc");
});

test("a MULTI-BRANCH union is still stringy — string | string[] is not skipped", () => {
  // enum166 unwrapped only single-branch unions, so this shape matched neither its
  // stringy test nor its container test and fell off the end of the loop.
  const tools: ToolLike[] = [
    {
      name: "t",
      inputSchema: {
        properties: {
          src_path: { anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
        },
      },
    },
  ];
  assert.ok(row(enumeratePathCohort(tools), "t", "src_path"), "a union parameter must be enumerated");
});

test("array-of-object items are walked", () => {
  const tools: ToolLike[] = [
    {
      name: "runtime_assert_scene_structure",
      inputSchema: {
        properties: {
          expect: { type: "array", items: { type: "object", properties: { path: { type: "string" } } } },
        },
      },
    },
  ];
  const hit = row(enumeratePathCohort(tools), "runtime_assert_scene_structure", "expect.path");
  assert.ok(hit, "an array-of-object item's parameters must be enumerated");
  assert.equal(hit.depth, 1);
});

test("camelCase segments — `toPath` is found without an underscore boundary", () => {
  const tools: ToolLike[] = [{ name: "t", inputSchema: { properties: { toPath: { type: "string" } } } }];
  assert.ok(row(enumeratePathCohort(tools), "t", "toPath"));
});

test("two parameters SHARING one schema object both appear", () => {
  // identity-based dedupe silently drops the second — an under-count by construction.
  const shared = { type: "object", properties: { art: { type: "string" } } };
  const tools: ToolLike[] = [{ name: "t", inputSchema: { properties: { front: shared, back: shared } } }];
  const rows = enumeratePathCohort(tools);
  assert.ok(row(rows, "t", "front.art"), "the first user of a shared schema is enumerated");
  assert.ok(row(rows, "t", "back.art"), "and so is the second");
});

test("a union that is BOTH stringy and a container yields both the leaf and its children", () => {
  const tools: ToolLike[] = [
    {
      name: "t",
      inputSchema: {
        properties: {
          target: { anyOf: [{ type: "string" }, { type: "object", properties: { file_path: { type: "string" } } }] },
        },
      },
    },
  ];
  const rows = enumeratePathCohort(tools);
  assert.ok(row(rows, "t", "target"), "the stringy branch is a row");
  assert.ok(row(rows, "t", "target.file_path"), "and the object branch is still walked");
});

test("a parameter that is not path-like at all is left out", () => {
  const tools: ToolLike[] = [
    { name: "t", inputSchema: { properties: { line: { type: "number" }, label: { type: "string" } } } },
  ];
  assert.equal(enumeratePathCohort(tools).length, 0);
});

test("recursion terminates on a self-referential schema", () => {
  const node: Record<string, unknown> = { type: "object", properties: {} };
  (node.properties as Record<string, unknown>).child = node;
  (node.properties as Record<string, unknown>).file_path = { type: "string" };
  const rows = enumeratePathCohort([{ name: "t", inputSchema: { properties: { root: node } } }]);
  assert.ok(rows.some((r) => r.param.endsWith("file_path")), "it still finds the real row");
  assert.ok(rows.length < 50, "and it does not run away");
});

test("output is stable and diffable across runs", () => {
  const tools: ToolLike[] = [
    { name: "b_tool", inputSchema: { properties: { path: { type: "string" } } } },
    { name: "a_tool", inputSchema: { properties: { to_path: { type: "string" }, art: { type: "string" } } } },
  ];
  const once = enumeratePathCohort(tools).map((r) => `${r.tool}.${r.param}`);
  const twice = enumeratePathCohort(tools).map((r) => `${r.tool}.${r.param}`);
  assert.deepEqual(once, twice);
  assert.deepEqual(once, ["a_tool.art", "a_tool.to_path", "b_tool.path"]);
});

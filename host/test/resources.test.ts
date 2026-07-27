import { test } from "node:test";
import assert from "node:assert/strict";
import { buildToolsets } from "../src/toolsets.js";
import { applyOutputSchemas } from "../src/schemas.js";
import { loadConfig } from "../src/config.js";
import { applyCapabilities, registerCapabilitiesResource, selectPrivilegedGroups } from "../src/capabilities.js";

/**
 * The MCP resources the WIRED server exposes, as index.ts wires them: five from
 * the `resources` toolset plus the always-on `godot://capabilities`.
 *
 * Why this file exists. `registration.test.ts` asserts 5 resources and is right
 * to — its harness drives `buildToolsets`, which never wires
 * `applyCapabilities`, so `godot://capabilities` is legitimately out of its
 * view. But nothing asserted the count at the level index.ts actually assembles,
 * and `docs/TOOL_CATALOG.md` consequently said "5 MCP resources" for ten days
 * after the 6th landed in 51a9bd3 — a drift no gate could see. This test closes
 * the runtime half of that gap; `contract_check.py` check 10 closes the docs half.
 */
const EXPECTED_RESOURCES: ReadonlyArray<{ name: string; uri: string }> = [
  { name: "scene-tree", uri: "godot://scene-tree" },
  { name: "editor-state", uri: "godot://editor-state" },
  { name: "runtime-tree", uri: "godot://runtime/tree" },
  { name: "runtime-log", uri: "godot://runtime/log" },
  { name: "class-doc", uri: "godot://class/{name}" },
  { name: "capabilities", uri: "godot://capabilities" },
];

/**
 * Assemble the full surface the way index.ts does — applyOutputSchemas →
 * applyCapabilities → every toolset → registerCapabilitiesResource — against a
 * recorder. Handlers are never invoked, so stub clients are fine.
 *
 * `uri` is recorded as a string for both call forms: plain resources pass a
 * string, `class-doc` passes a `ResourceTemplate` whose `uriTemplate` carries
 * the pattern.
 */
function registerAll(tokens: string[] | null = null) {
  const resources: Array<{ name: string; uri: string }> = [];
  const server = {
    registerTool(name: string) {
      return { name };
    },
    registerResource(name: string, uri: unknown) {
      const template = (uri as { uriTemplate?: unknown })?.uriTemplate;
      resources.push({ name, uri: typeof uri === "string" ? uri : String(template) });
    },
    experimental: {
      tasks: {
        registerToolTask(name: string) {
          return { name };
        },
      },
    },
    server: { elicitInput: async () => ({ action: "decline" }) },
  };

  const mcp = server as unknown as Parameters<typeof applyOutputSchemas>[0];
  const stub = {} as unknown as never;
  const cfg = loadConfig();
  const privileged = selectPrivilegedGroups(tokens);

  applyOutputSchemas(mcp);
  applyCapabilities(mcp, privileged);
  const toolsets = buildToolsets({
    server: mcp,
    bridge: stub,
    runtime: stub,
    lsp: stub,
    csLsp: stub,
    dap: stub,
    csDap: stub,
    config: cfg,
  });
  for (const ts of toolsets) ts.run();
  // Registered unconditionally by index.ts — NOT behind the `resources` toolset.
  registerCapabilitiesResource(mcp, privileged);

  return resources;
}

test(`the wired server exposes exactly ${EXPECTED_RESOURCES.length} MCP resources`, () => {
  const resources = registerAll();
  assert.equal(resources.length, EXPECTED_RESOURCES.length);
  assert.deepEqual(
    resources.map((r) => r.name).sort(),
    EXPECTED_RESOURCES.map((r) => r.name).sort(),
  );
});

test("every resource is registered under its documented godot:// URI", () => {
  const byName = new Map(registerAll().map((r) => [r.name, r.uri]));
  for (const { name, uri } of EXPECTED_RESOURCES) {
    assert.equal(byName.get(name), uri, `${name} should be registered at ${uri}`);
  }
});

test("resource names are unique (no silent overwrite of an earlier registration)", () => {
  const names = registerAll().map((r) => r.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dupes, [], `duplicate resource names: ${dupes.join(", ")}`);
});

test("godot://capabilities is always-on — the privileged groups do not gate it", () => {
  // applyCapabilities gates TOOLS, never resources: the dropped privileged tools
  // must never become a silent gap, so the resource that documents them has to
  // survive every group combination.
  for (const tokens of [null, ["code-execution"], ["network"], ["all"]]) {
    const names = registerAll(tokens).map((r) => r.name);
    assert.equal(names.length, EXPECTED_RESOURCES.length, `groups=${tokens ?? "none"}`);
    assert.ok(names.includes("capabilities"), `capabilities resource missing with groups=${tokens ?? "none"}`);
  }
});

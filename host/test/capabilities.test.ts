import { test } from "node:test";
import assert from "node:assert/strict";
import { buildToolsets } from "../src/toolsets.js";
import { applyOutputSchemas } from "../src/schemas.js";
import { loadConfig } from "../src/config.js";
import {
  CAPABILITY_GROUPS,
  GROUP_DESCRIBE,
  TOOL_CAPABILITIES,
  applyCapabilities,
  droppedTools,
  parsePrivilegedGroups,
  registerCapabilitiesResource,
  selectPrivilegedGroups,
  toolAllowed,
} from "../src/capabilities.js";
import { ALL_ANNOTATED, annotationsFor } from "../src/annotations.js";

const FULL_TOOL_COUNT = 292;

// All 13 privileged tools. There is one group, so there is no split.
const CODE_EXEC_ONLY = [
  // arbitrary execution / invocation / paused-frame evaluation
  "cs_dbg_evaluate",
  "dbg_evaluate",
  "godot_run_headless_script",
  "godot_run_managed",
  "node_call_method",
  "runtime_call_method",
  // F6: spawns headless Godot children of the project.
  "runtime_spawn_peers",
  // asset-gen generators — the local command backend is their only privileged
  // path, so they load with code-execution alone (the network tag was dropped
  // because no external provider backend is implemented).
  "asset_gen_audio_sfx",
  "asset_gen_configure",
  "asset_gen_icon",
  "asset_gen_model",
  "asset_gen_sprite",
  "asset_gen_texture",
].sort();
// Formerly tagged `network` and dropped by default. Neither leaves the machine —
// backend_detect reads installed SDKs over the loopback bridge and
// backend_configure writes a res:// script through it — so both are unprivileged
// and must be present on an untouched install.
const FORMERLY_NETWORK = ["backend_configure", "backend_detect"].sort();
const ALL_PRIVILEGED = [...CODE_EXEC_ONLY].sort();

/**
 * Register the entire surface exactly as index.ts does — applyOutputSchemas, then
 * applyCapabilities(enabled), then every register*Tools — against a recorder, so
 * a disabled group's tools are dropped before they reach the recorder.
 */
function registerWith(tokens: string[] | null) {
  const calls: Array<{ name: string }> = [];
  const server = {
    registerTool(name: string) {
      calls.push({ name });
      return { name };
    },
    registerResource() {},
    experimental: {
      tasks: {
        registerToolTask(name: string) {
          calls.push({ name });
          return { name };
        },
      },
    },
    server: { elicitInput: async () => ({ action: "decline" }) },
  };
  const mcp = server as unknown as Parameters<typeof applyOutputSchemas>[0];
  const stub = {} as unknown as never;
  const cfg = loadConfig();

  applyOutputSchemas(mcp);
  applyCapabilities(mcp, selectPrivilegedGroups(tokens));
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
  return calls.map((c) => c.name);
}

test("secure default (no groups) drops exactly the 13 privileged tools → 279", () => {
  const names = registerWith(null);
  assert.equal(names.length, FULL_TOOL_COUNT - ALL_PRIVILEGED.length);
  assert.equal(names.length, 279);
  const present = new Set(names);
  for (const t of ALL_PRIVILEGED) assert.ok(!present.has(t), `${t} should be dropped by default`);
});

test("enabling code-execution (or 'all') restores the full 292-tool surface", () => {
  assert.equal(registerWith(["code-execution"]).length, FULL_TOOL_COUNT);
  assert.equal(registerWith(["all"]).length, FULL_TOOL_COUNT);
});

test("the backend_* tools are on an untouched install — they never egressed", () => {
  const present = new Set(registerWith(null));
  for (const t of FORMERLY_NETWORK) {
    assert.ok(present.has(t), `${t} is loopback-only and must not be gated`);
    assert.equal(TOOL_CAPABILITIES[t], undefined, `${t} must carry no capability tag`);
  }
});

test("`network` is not a group: the token is reported as unknown and ignored", () => {
  const unknown: string[][] = [];
  const enabled = selectPrivilegedGroups(["network"], (u) => unknown.push(u));
  assert.deepEqual([...enabled], [], "an unknown token must enable nothing");
  assert.deepEqual(unknown, [["network"]], "and must be reported, never silently dropped");
  assert.ok(!CAPABILITY_GROUPS.includes("network" as never));
});

test("every tagged tool is a real tool in the full surface (no stale capability tags)", () => {
  const full = new Set(registerWith(["all"]));
  const stale = Object.keys(TOOL_CAPABILITIES).filter((n) => !full.has(n));
  assert.deepEqual(stale, [], `capability tags reference unregistered tools: ${stale.join(", ")}`);
});

test("droppedTools reports the right set per enabled-group combination", () => {
  assert.deepEqual(droppedTools(selectPrivilegedGroups(null)), ALL_PRIVILEGED);
  assert.deepEqual(droppedTools(selectPrivilegedGroups(["code-execution"])), []);
  assert.deepEqual(droppedTools(selectPrivilegedGroups(["network"])), ALL_PRIVILEGED);
  assert.deepEqual(droppedTools(selectPrivilegedGroups(["all"])), []);
});

test("parse + select: unset → none; unknown tokens reported and ignored; 'all' expands", () => {
  assert.equal(parsePrivilegedGroups(undefined), null);
  assert.deepEqual(parsePrivilegedGroups("code-execution, bogus"), ["code-execution", "bogus"]);
  assert.equal(selectPrivilegedGroups(null).size, 0);

  const unknown: string[] = [];
  const set = selectPrivilegedGroups(["code-execution", "bogus"], (u) => unknown.push(...u));
  assert.deepEqual([...set], ["code-execution"]);
  assert.deepEqual(unknown, ["bogus"]);

  assert.deepEqual([...selectPrivilegedGroups(["all"])].sort(), [...CAPABILITY_GROUPS].sort());
});

test("untagged tools are always allowed; tagged tools require their group", () => {
  const none = selectPrivilegedGroups(null);
  assert.ok(toolAllowed("node_add", none), "an unprivileged tool is always allowed");
  assert.ok(!toolAllowed("godot_run_headless_script", none), "a code-execution tool is off by default");
  assert.ok(toolAllowed("godot_run_headless_script", selectPrivilegedGroups(["code-execution"])));
});

test("the capabilities resource reports group state, dropped tools, and how to enable", async () => {
  const registered: Array<{ name: string; uri: string; handler: (u: { href: string }) => Promise<unknown> }> = [];
  const server = {
    registerResource(name: string, uri: string, _meta: unknown, handler: (u: { href: string }) => Promise<unknown>) {
      registered.push({ name, uri, handler });
    },
  } as unknown as Parameters<typeof registerCapabilitiesResource>[0];

  registerCapabilitiesResource(server, selectPrivilegedGroups(null));
  assert.equal(registered.length, 1);
  assert.equal(registered[0].name, "capabilities");
  assert.equal(registered[0].uri, "godot://capabilities");

  const res = (await registered[0].handler({ href: "godot://capabilities" })) as {
    contents: Array<{ text: string }>;
  };
  const payload = JSON.parse(res.contents[0].text) as {
    default_secure: boolean;
    enabled_groups: string[];
    dropped_tools: string[];
    how_to_enable: string;
    groups: Array<{ id: string; enabled: boolean; tools: string[] }>;
  };
  assert.equal(payload.default_secure, true);
  assert.deepEqual(payload.enabled_groups, []);
  assert.deepEqual(payload.dropped_tools, ALL_PRIVILEGED);
  assert.match(payload.how_to_enable, /BREAKPOINT_PRIVILEGED_GROUPS/);
  assert.deepEqual(
    payload.groups.map((g) => g.id).sort(),
    [...CAPABILITY_GROUPS].sort(),
  );
  for (const g of payload.groups) assert.equal(g.enabled, false);
});

/**
 * The control for the defect this file's `network` group was: a capability group
 * DESCRIBED as reaching past loopback while `annotations.ts` published
 * `openWorldHint: false` for the very tools it gated. Two files disagreed about
 * whether the surface egresses, and nothing compared them — so the risk story
 * was wrong in both directions for six releases.
 *
 * Any group whose description claims egress must gate only tools that
 * annotations.ts also marks open-world. Against the tree before the fix this
 * fails, naming backend_configure and backend_detect.
 */
test("a group that claims egress gates only openWorld tools (capabilities <-> annotations)", () => {
  const EGRESS = /egress|beyond loopback|open.?world|outside this machine/i;
  const offenders: string[] = [];
  for (const group of CAPABILITY_GROUPS) {
    if (!EGRESS.test(GROUP_DESCRIBE[group])) continue;
    for (const [tool, groups] of Object.entries(TOOL_CAPABILITIES)) {
      if (!groups.includes(group)) continue;
      if (!annotationsFor(tool).openWorldHint) offenders.push(`${tool} (${group})`);
    }
  }
  assert.deepEqual(
    offenders.sort(),
    [],
    `group(s) promise egress but these tools are annotated loopback-only: ${offenders.join(", ")}`,
  );
});

/** The mirror: nothing may be annotated open-world without a group that says so. */
test("an openWorld tool is gated by a group that admits egress", () => {
  const EGRESS = /egress|beyond loopback|open.?world|outside this machine/i;
  const ungated = ALL_ANNOTATED.filter((t) => annotationsFor(t).openWorldHint).filter(
    (t) => !(TOOL_CAPABILITIES[t] ?? []).some((g) => EGRESS.test(GROUP_DESCRIBE[g])),
  );
  assert.deepEqual(ungated, [], `openWorld but not gated by an egress group: ${ungated.join(", ")}`);
});

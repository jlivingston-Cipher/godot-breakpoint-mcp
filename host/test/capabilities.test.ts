import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildToolsets } from "../src/toolsets.js";
import { applyOutputSchemas } from "../src/schemas.js";
import { loadConfig } from "../src/config.js";
import {
  CALL_TOOL_METHOD,
  CAPABILITY_GROUPS,
  GROUP_DESCRIBE,
  TOOL_CAPABILITIES,
  applyCapabilities,
  applyDroppedToolRefusal,
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

// ─────────────────────────────────────────────────────────────────────────────
// 250 — a withheld tool must not spell itself `not found`
//
// 249 §1.3 walked the published package and asked for three tools the quick
// start names. All three answered `MCP error -32602: Tool <name> not found`,
// because a dropped tool is absent from `mcp.js`'s registry for exactly the same
// reason a misspelled one is. The sentence is grammatical, accurate about the
// lookup, and wrong about the world — and its reader is usually the assistant,
// which reports the absence to a user as fact.
// ─────────────────────────────────────────────────────────────────────────────

/** Build a real McpServer with one tool registered, so the SDK installs its dispatcher. */
function realServerWithOneTool() {
  const server = new McpServer({ name: "capabilities-probe", version: "0" });
  server.registerTool("probe_ok", { description: "always registered" }, async () => ({
    content: [{ type: "text" as const, text: "ok" }],
  }));
  return server;
}

type RawHandlers = Map<string, (req: unknown, extra: unknown) => Promise<unknown>>;
const handlersOf = (s: McpServer): RawHandlers =>
  (s as unknown as { server: { _requestHandlers: RawHandlers } }).server._requestHandlers;

/**
 * The literal `applyDroppedToolRefusal` reaches for, pinned against the SDK
 * rather than restated. An SDK that renamed the method would otherwise
 * un-install the refusal in silence — the wrap would find no handler, return
 * early, and every withheld tool would go back to saying `not found` with no
 * test going red. 245's rule: a new branch needs its red before anything else.
 */
test("CALL_TOOL_METHOD is the method the SDK actually dispatches tools under", () => {
  const server = realServerWithOneTool();
  assert.ok(
    handlersOf(server).has(CALL_TOOL_METHOD),
    `the SDK registered no handler under '${CALL_TOOL_METHOD}' — the refusal wrap would silently no-op`,
  );
});

type ToolResult = { content?: Array<{ text?: string }>; isError?: boolean };
const callTool = (s: McpServer, name: string) =>
  handlersOf(s).get(CALL_TOOL_METHOD)!(
    { method: CALL_TOOL_METHOD, params: { name, arguments: {} } },
    {},
  ) as Promise<ToolResult>;

test("a withheld tool names the policy, and never `not found`", async () => {
  const server = realServerWithOneTool();
  applyDroppedToolRefusal(server, selectPrivilegedGroups(null));

  for (const name of ALL_PRIVILEGED) {
    const res = await callTool(server, name);
    assert.equal(res.isError, true, `${name} was withheld but the call did not refuse`);
    const msg = res.content?.[0]?.text ?? "";
    assert.ok(!/not found/i.test(msg), `${name} still reads as missing: ${msg}`);
    assert.match(msg, /WITHHELD BY POLICY/, `${name} does not say it is a policy: ${msg}`);
    assert.match(msg, /not a missing feature/i, `${name} does not correct the reader: ${msg}`);
    assert.match(msg, /BREAKPOINT_PRIVILEGED_GROUPS=/, `${name} names no env remedy: ${msg}`);
    assert.match(msg, /--trust full/, `${name} names no init preset: ${msg}`);
    assert.match(msg, /godot:\/\/capabilities/, `${name} names no resource: ${msg}`);
  }
});

/**
 * 🔴 THE REFUSAL KEEPS THE TRANSPORT SHAPE `not found` ALREADY HAD. `mcp.js`
 * catches its own McpError and answers with an isError CallToolResult rather
 * than throwing, so a refusal that threw would be a PROTOCOL error where every
 * other failure on this surface is a TOOL error — a second behaviour change
 * nobody asked for, riding along with a copy fix. The defect was one sentence.
 */
test("the refusal is a tool error, not a protocol error — same shape as before", async () => {
  const server = realServerWithOneTool();
  applyDroppedToolRefusal(server, selectPrivilegedGroups(null));
  const withheld = await callTool(server, "dbg_evaluate");
  const absent = await callTool(server, "no_such_tool");
  assert.equal(withheld.isError, true);
  assert.equal(absent.isError, true, "the SDK's own miss is an isError result; the refusal must match it");
  assert.equal(typeof withheld.content?.[0]?.text, "string");
});

test("the refusal is confined to withheld names — a registered tool still runs", async () => {
  const server = realServerWithOneTool();
  applyDroppedToolRefusal(server, selectPrivilegedGroups(null));
  const res = await callTool(server, "probe_ok");
  assert.equal(res.content?.[0]?.text, "ok");
  assert.notEqual(res.isError, true);
});

test("an unknown name is still the SDK's `not found` — the refusal claims only the withheld", async () => {
  const server = realServerWithOneTool();
  applyDroppedToolRefusal(server, selectPrivilegedGroups(null));
  const res = await callTool(server, "no_such_tool");
  const msg = res.content?.[0]?.text ?? "";
  assert.match(msg, /not found/i, `a genuinely absent tool must still read as absent: ${msg}`);
  assert.ok(!/WITHHELD BY POLICY/.test(msg), `a typo must not be dressed as a policy: ${msg}`);
});

test("with the group enabled nothing is withheld and the wrap installs no branch", async () => {
  const server = realServerWithOneTool();
  const before = handlersOf(server).get(CALL_TOOL_METHOD);
  applyDroppedToolRefusal(server, selectPrivilegedGroups(["all"]));
  assert.equal(handlersOf(server).get(CALL_TOOL_METHOD), before, "nothing is dropped, so nothing should be wrapped");
});

// ─────────────────────────────────────────────────────────────────────────────
// 250 — and the remedies must name a group that exists
//
// Every string below told a user to type `network`, a group deleted from
// capabilities.ts's own header. `init` printed it as the fix and then answered
// its own suggested command with `ignoring unknown trust group(s): network`.
// This reads the shipped source for the shape `<flag>=<tokens>` and asks
// `selectPrivilegedGroups` — the real parser — whether every token resolves.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Climb to the package root rather than assuming a depth — 248's lesson in
 * `cli_entry.test.ts`, and this file is run from `test/` under tsx AND from
 * `dist-test/test/` under `npm test`, so a fixed `..` is silently wrong in the
 * one CI runs. It was, on the first draft of the reader below.
 */
function packageRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as { name?: string };
      if (pkg.name === "breakpoint-mcp") return dir;
    } catch {
      /* keep climbing */
    }
    dir = path.dirname(dir);
  }
  throw new Error("could not locate the breakpoint-mcp package root from " + import.meta.url);
}

test("no shipped string offers a privileged-group token the parser would reject", () => {
  const root = packageRoot();
  const files = [
    "src/capabilities.ts",
    "src/cli/doctor.ts",
    "src/cli/init.ts",
    "src/cli/tools.ts",
    "src/index.ts",
  ];
  const OFFER = /(?:BREAKPOINT_PRIVILEGED_GROUPS=|--privileged-groups\s+)([A-Za-z0-9_,-]+)/g;

  /** Read one blob of source and name every group token the parser would drop. */
  const scan = (label: string, text: string): string[] => {
    const found: string[] = [];
    for (const m of text.matchAll(OFFER)) {
      const raw = m[1];
      // A template hole is derived from CAPABILITY_GROUPS by construction.
      if (raw.includes("$")) continue;
      const unknown: string[] = [];
      selectPrivilegedGroups(parsePrivilegedGroups(raw), (u) => unknown.push(...u));
      for (const u of unknown) found.push(`${label}: offers '${u}' in "${raw}"`);
    }
    return found;
  };

  // 🔴 THE POSITIVE CONTROL IS THE TREE AS IT SHIPPED, and it is not decoration:
  // a reader over source that can only ever return `[]` is green for the same
  // reason a broken one is. These are `doctor.ts`'s hint and `init.ts`'s
  // suggested command, verbatim, from before this commit.
  assert.deepEqual(
    scan(
      "control",
      'hint: "Enable with BREAKPOINT_PRIVILEGED_GROUPS=code-execution,network (or `breakpoint-mcp init --trust full`)."\n' +
        'say("Enable them by re-running with `--trust full` (or `--privileged-groups code-execution,network`),");',
    ),
    ["control: offers 'network' in \"code-execution,network\"", "control: offers 'network' in \"code-execution,network\""],
    "the reader cannot flag the pre-250 copy it was written to catch",
  );

  const offenders = files.flatMap((rel) => scan(rel, readFileSync(path.join(root, rel), "utf8")));
  assert.deepEqual(
    offenders.sort(),
    [],
    `shipped copy names group token(s) selectPrivilegedGroups drops:\n  ${offenders.join("\n  ")}`,
  );
});

test("the capabilities resource states its group count derived, not restated", async () => {
  const contents: Array<{ text: string }> = [];
  const server = {
    registerResource(
      _n: string,
      _u: string,
      _m: unknown,
      read: (uri: URL) => Promise<{ contents: Array<{ text: string }> }>,
    ) {
      void read(new URL("godot://capabilities")).then((r) => contents.push(...r.contents));
    },
  } as unknown as McpServer;
  registerCapabilitiesResource(server, selectPrivilegedGroups(null));
  await new Promise((r) => setTimeout(r, 0));
  const payload = JSON.parse(contents[0].text) as { summary: string; how_to_enable: string };
  assert.ok(
    payload.summary.startsWith(`${CAPABILITY_GROUPS.length} higher-trust tool group(s)`),
    `summary restates a count: ${payload.summary}`,
  );

  /** Every `'token'` the prose offers, minus the ones the parser resolves. */
  const unresolved = (s: string): string[] => {
    const unknown: string[] = [];
    for (const tok of s.match(/'[a-z-]+'/g) ?? []) {
      const t = tok.slice(1, -1);
      if (t === "all") continue;
      selectPrivilegedGroups(parsePrivilegedGroups(t), (u) => unknown.push(...u));
    }
    return unknown;
  };

  // The positive control, and it is the exact sentence this resource shipped
  // until 250 — without it the two assertions below are green over a reader
  // that may never be able to say anything.
  assert.deepEqual(
    unresolved("Set BREAKPOINT_PRIVILEGED_GROUPS …: 'code-execution', 'network', or 'all'."),
    ["network"],
    "the reader cannot flag the very string this test was written for",
  );

  for (const s of [payload.summary, payload.how_to_enable]) {
    assert.deepEqual(unresolved(s), [], `the resource offers unknown group token(s) in: ${s}`);
  }
});

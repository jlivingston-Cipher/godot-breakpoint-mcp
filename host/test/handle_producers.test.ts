/**
 * HANDLE PRODUCERS — can the tools left BEHIND by a capability group still be used?
 *
 * 🔴 THE QUESTION NOTHING ASKED. `capabilities.test.ts` proves the tagging is total
 * and correct, that the right thirteen tools are dropped, and that a dropped name is
 * refused by policy rather than as `not found`. Every one of those readers looks at
 * the tools that LEAVE. None of them looks at what is left: `godot_output` and
 * `godot_stop` are unprivileged and take an `id` that only the privileged
 * `godot_run_managed` returns, so on a default install both could answer exactly one
 * thing for every input a caller could construct — `No managed process with id "…"` —
 * and the sentence blamed the caller for a configuration.
 *
 * Measured by driving the shipped server over stdio on a real default surface, which
 * is the population nothing here had: every existing reader of this boundary asks its
 * question of ONE surface at a time and is right on both, and the defect lives in the
 * relation BETWEEN them.
 *
 * The claims below come in pairs on purpose (295 §5.3's rule, applied to a change that
 * ADDS text to a refusal): every arm that must now say more is driven beside the arm
 * that must still say exactly what it always said.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildToolsets } from "../src/toolsets.js";
import { applyOutputSchemas } from "../src/schemas.js";
import { loadConfig, type Config } from "../src/config.js";
import {
  HANDLE_PRODUCERS,
  TOOL_CAPABILITIES,
  applyCapabilities,
  orphanedConsumers,
  producerWithheldClause,
  registerCapabilitiesResource,
  selectPrivilegedGroups,
  toolAllowed,
  withheldProducerSentence,
} from "../src/capabilities.js";
import { PeerRegistry } from "../src/peers.js";
import { registerProcessTools } from "../src/tools/processes.js";
import { registerRuntimeTools } from "../src/tools/runtime.js";

type ToolCall = { name: string; config: { inputSchema?: Record<string, unknown> } };
type Handler = (args: Record<string, unknown>, extra: unknown) => Promise<{
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
}>;

/** The whole surface, recorded WITH its configs and handlers, exactly as index.ts wires it. */
function surfaceFor(tokens: string[] | null) {
  const calls: ToolCall[] = [];
  const handlers = new Map<string, Handler>();
  const record = (name: string, config: ToolCall["config"], handler: Handler) => {
    calls.push({ name, config });
    handlers.set(name, handler);
    return { name };
  };
  const server = {
    registerTool: record,
    registerResource() {},
    experimental: { tasks: { registerToolTask: record } },
    server: { elicitInput: async () => ({ action: "decline" }) },
  };
  const mcp = server as unknown as Parameters<typeof applyOutputSchemas>[0];
  const stub = {} as unknown as never;
  const cfg = loadConfig();
  applyOutputSchemas(mcp);
  applyCapabilities(mcp, selectPrivilegedGroups(tokens));
  for (const ts of buildToolsets({
    server: mcp,
    bridge: stub,
    runtime: stub,
    lsp: stub,
    csLsp: stub,
    dap: stub,
    csDap: stub,
    config: cfg,
  })) {
    ts.run();
  }
  return { names: calls.map((c) => c.name), calls, handlers };
}

/** A config whose privilegedGroups say what this arm is testing — what index.ts passes down. */
const configWith = (tokens: string[] | null): Config => ({ ...loadConfig(), privilegedGroups: tokens });

const textOf = (r: { content?: Array<{ text?: string }> }) => (r.content ?? []).map((c) => c.text ?? "").join(" ");

const CLAUSE = /WITHHELD BY POLICY in the higher-trust group/;

// ── the table is a population declaration, and the surface is what declares it ──────

/**
 * The rows a surface OWES `HANDLE_PRODUCERS`: every (tool, field) where the field is
 * REQUIRED and its description names another registered tool as the source of its value.
 *
 * 🔵 AN OPTIONAL HANDLE IS NOT AN ORPHAN. Twenty-five runtime tools take an optional
 * `peer`; omit it and the tool addresses the default game, so a withheld producer costs
 * them an OPTION and not their existence. Only a field the schema makes REQUIRED can
 * strand the tool that takes it, and that is the line this function draws.
 */
function rowsOwedBy(calls: ToolCall[], known: ReadonlySet<string>): string[] {
  const owed: string[] = [];
  for (const { name, config } of calls) {
    for (const [field, schema] of Object.entries(config.inputSchema ?? {})) {
      const s = schema as { description?: string; isOptional?: () => boolean };
      const described = s?.description ?? "";
      if (!described) continue;
      // "…from `<tool>`" / "…from <tool>" — the shape every handle field is written in.
      for (const m of described.matchAll(/\bfrom\s+`?([a-z][a-z0-9_]*)`?/gi)) {
        const producer = m[1];
        if (!known.has(producer) || producer === name) continue;
        if (s.isOptional?.() === true) continue;
        if (!HANDLE_PRODUCERS[name]) owed.push(`${name}.${field} <- ${producer}`);
      }
    }
  }
  return owed;
}

test("every REQUIRED input field that names a producing tool has a HANDLE_PRODUCERS row", () => {
  const { calls, names } = surfaceFor(["all"]);
  const known = new Set(names);
  const owed = rowsOwedBy(calls, known);
  assert.deepEqual(
    owed,
    [],
    `a tool takes a REQUIRED handle minted by another tool and declares no HANDLE_PRODUCERS row: ${owed.join(", ")}`,
  );

  // 🔴 THE POSITIVE CONTROL, IN THE SAME UNIT. An empty list from a derivation is worth
  // nothing until the derivation has been shown to produce a non-empty one: a regex that
  // stopped matching, an `isOptional` that started answering true for everything, or a
  // shape read off the wrong key would all answer `[]` and read as a clean surface. The
  // offender is a tool this table does NOT carry, taking a required field described the
  // way every real handle field is described.
  const planted: ToolCall[] = [
    ...calls,
    {
      name: "godot_version",
      config: { inputSchema: { ticket: { description: "Ticket from godot_run_managed" } } },
    },
  ];
  assert.deepEqual(rowsOwedBy(planted, known), ["godot_version.ticket <- godot_run_managed"]);
  // …and the same field made OPTIONAL is owed nothing, which is the line the claim draws.
  const plantedOptional: ToolCall[] = [
    ...calls,
    {
      name: "godot_version",
      config: {
        inputSchema: { ticket: { description: "Ticket from godot_run_managed", isOptional: () => true } },
      },
    },
  ];
  assert.deepEqual(rowsOwedBy(plantedOptional, known), []);
});

test("every HANDLE_PRODUCERS row names a real tool, a real field, and a real producer", () => {
  const { names, calls } = surfaceFor(["all"]);
  const known = new Set(names);
  const shapeOf = new Map(calls.map((c) => [c.name, Object.keys(c.config.inputSchema ?? {})]));
  for (const [consumer, row] of Object.entries(HANDLE_PRODUCERS)) {
    assert.ok(known.has(consumer), `HANDLE_PRODUCERS consumer ${consumer} is not a tool`);
    assert.ok(known.has(row.producer), `HANDLE_PRODUCERS producer ${row.producer} is not a tool`);
    assert.ok(
      (shapeOf.get(consumer) ?? []).includes(row.field),
      `${consumer} has no input field \`${row.field}\` — the row names a field that was renamed or removed`,
    );
  }
});

// ── the orphaned set, both arms ────────────────────────────────────────────────────

test("on the secure default the four cross-boundary consumers are orphaned", () => {
  assert.deepEqual(orphanedConsumers(selectPrivilegedGroups(null)), [
    "godot_output",
    "godot_stop",
    "runtime_peer_stop",
    "runtime_peers_digest",
  ]);
});

test("with code-execution enabled nothing is orphaned — the negative control", () => {
  assert.deepEqual(orphanedConsumers(selectPrivilegedGroups(["code-execution"])), []);
  assert.deepEqual(orphanedConsumers(selectPrivilegedGroups(["all"])), []);
});

test("every orphaned consumer is itself UNPRIVILEGED — an orphan is a tool you still have", () => {
  const none = selectPrivilegedGroups(null);
  for (const consumer of orphanedConsumers(none)) {
    assert.ok(!TOOL_CAPABILITIES[consumer], `${consumer} is tagged: a dropped tool is not an orphan, it is dropped`);
    assert.ok(toolAllowed(consumer, none), `${consumer} is not on the default surface`);
  }
});

// ── the clause itself, both arms ───────────────────────────────────────────────────

test("the clause fires only when the producer is actually withheld", () => {
  assert.match(producerWithheldClause("godot_stop", selectPrivilegedGroups(null)), CLAUSE);
  assert.equal(producerWithheldClause("godot_stop", selectPrivilegedGroups(["code-execution"])), "");
});

test("a tool with no row, and a producer that is unprivileged, get no clause", () => {
  assert.equal(producerWithheldClause("godot_version", selectPrivilegedGroups(null)), "");
  // cs_dbg_scopes mints the `variables_ref` cs_dbg_variables takes and is unprivileged,
  // so that pair spans no boundary and must stay silent on every surface.
  assert.equal(withheldProducerSentence("variables_ref", "cs_dbg_scopes", selectPrivilegedGroups(null)), "");
});

test("the clause names the group, the env var and the resource — it is actionable, not an apology", () => {
  const c = producerWithheldClause("godot_output", selectPrivilegedGroups(null));
  assert.match(c, /godot_run_managed/);
  assert.match(c, /BREAKPOINT_PRIVILEGED_GROUPS=code-execution/);
  assert.match(c, /godot:\/\/capabilities/);
  assert.match(c, /not a missing feature/);
});

// ── driven through the real handlers, on BOTH surfaces ─────────────────────────────

function processHandlers(tokens: string[] | null) {
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _c: unknown, h: Handler) => {
      handlers.set(name, h);
      return { name };
    },
    registerResource() {},
    server: { elicitInput: async () => ({ action: "decline" }) },
  } as unknown as McpServer;
  registerProcessTools(server, configWith(tokens));
  return handlers;
}

function runtimeHandlers(tokens: string[] | null) {
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _c: unknown, h: Handler) => {
      handlers.set(name, h);
      return { name };
    },
    registerResource() {},
    server: { elicitInput: async () => ({ action: "decline" }) },
  } as unknown as McpServer;
  const cfg = configWith(tokens);
  registerRuntimeTools(server, {} as never, new PeerRegistry(cfg), cfg);
  return handlers;
}

test("godot_stop and godot_output say WHY no id can exist on the default surface", async () => {
  const h = processHandlers(null);
  for (const name of ["godot_stop", "godot_output"]) {
    const r = await h.get(name)!({ id: "nope" }, {});
    assert.equal(r.isError, true);
    // The caller's own mistake stays FIRST — the clause explains, it does not replace.
    assert.match(textOf(r), /^No managed process with id "nope"/);
    assert.match(textOf(r), CLAUSE);
    assert.match(textOf(r), /godot_run_managed/);
  }
});

test("with the group enabled the same refusal says exactly what it always said", async () => {
  const h = processHandlers(["code-execution"]);
  for (const name of ["godot_stop", "godot_output"]) {
    const r = await h.get(name)!({ id: "nope" }, {});
    assert.equal(r.isError, true);
    assert.equal(textOf(r), 'No managed process with id "nope"');
  }
});

test("runtime_peers_digest and runtime_peer_stop carry the clause by default and not when enabled", async () => {
  const off = runtimeHandlers(null);
  const digest = await off.get("runtime_peers_digest")!({ root: "." }, {});
  assert.match(textOf(digest), /Convergence needs at least two peers; got 0\./);
  assert.match(textOf(digest), CLAUSE);
  const stop = await off.get("runtime_peer_stop")!({}, {});
  assert.match(textOf(stop), /^Pass a peer `id`, or all:true\./);
  assert.match(textOf(stop), CLAUSE);

  const on = runtimeHandlers(["code-execution"]);
  const digest2 = await on.get("runtime_peers_digest")!({ root: "." }, {});
  assert.ok(!CLAUSE.test(textOf(digest2)), `enabled surface must not explain a policy that is off: ${textOf(digest2)}`);
  const stop2 = await on.get("runtime_peer_stop")!({}, {});
  assert.ok(!CLAUSE.test(textOf(stop2)), `enabled surface must not explain a policy that is off: ${textOf(stop2)}`);
});

test("a SUCCESS never carries the clause — runtime_peer_stop with all:true still answers []", async () => {
  for (const tokens of [null, ["code-execution"]]) {
    const r = await runtimeHandlers(tokens).get("runtime_peer_stop")!({ all: true }, {});
    assert.ok(!r.isError, "stopping nothing is not an error");
    assert.ok(!CLAUSE.test(textOf(r)), "a green answer must not be dressed as a refusal");
  }
});

test("the unknown-peer refusal carries it too — one message for the whole optional-`peer` family", () => {
  const off = new PeerRegistry(configWith(null));
  const on = new PeerRegistry(configWith(["code-execution"]));
  // `clientFor` on an id no peer holds is the single sentence 25 runtime tools reach.
  // 🔴 AND THE CLAUSE IS ASSERTED ON `remedy`, NOT ON THE MESSAGE. 265 moved the next
  // action out of the body precisely because a remedy written into a message reaches no
  // reader; a clause that landed in the body would pass a lazier test and be invisible
  // to `remedyClause()` and to check 28's grammar arm.
  assert.throws(
    () => off.clientFor("peer-9"),
    (err: Error & { remedy?: string }) =>
      /No peer with id "peer-9"/.test(err.message) && CLAUSE.test(err.remedy ?? "") && !CLAUSE.test(err.message),
  );
  assert.throws(
    () => on.clientFor("peer-9"),
    (err: Error & { remedy?: string }) =>
      /No peer with id "peer-9"/.test(err.message) &&
      /Spawn peers with runtime_spawn_peers/.test(err.remedy ?? "") &&
      !CLAUSE.test(err.remedy ?? ""),
  );
});

// ── and the always-on resource says it before a caller has to find out by calling ──

test("godot://capabilities prints the orphaned consumers beside the dropped tools", async () => {
  const resources: Array<{ read: (uri: URL) => Promise<{ contents: Array<{ text: string }> }> }> = [];
  const server = {
    registerResource: (_n: string, _u: string, _m: unknown, read: (uri: URL) => Promise<{ contents: Array<{ text: string }> }>) =>
      resources.push({ read }),
  } as unknown as McpServer;
  registerCapabilitiesResource(server, selectPrivilegedGroups(null));
  const payload = JSON.parse((await resources[0]!.read(new URL("godot://capabilities"))).contents[0]!.text) as {
    dropped_tools: string[];
    orphaned_consumers: Array<{ tool: string; consumes: string; produced_only_by: string }>;
  };
  assert.deepEqual(
    payload.orphaned_consumers.map((o) => o.tool),
    ["godot_output", "godot_stop", "runtime_peer_stop", "runtime_peers_digest"],
  );
  for (const o of payload.orphaned_consumers) {
    assert.ok(payload.dropped_tools.includes(o.produced_only_by), `${o.produced_only_by} must be in the dropped set`);
    assert.ok(o.consumes.length > 0, `${o.tool} must name the field it cannot be given`);
  }
});

test("with the group enabled the resource reports no orphans — the second arm of the same reader", async () => {
  const resources: Array<{ read: (uri: URL) => Promise<{ contents: Array<{ text: string }> }> }> = [];
  const server = {
    registerResource: (_n: string, _u: string, _m: unknown, read: (uri: URL) => Promise<{ contents: Array<{ text: string }> }>) =>
      resources.push({ read }),
  } as unknown as McpServer;
  registerCapabilitiesResource(server, selectPrivilegedGroups(["all"]));
  const payload = JSON.parse((await resources[0]!.read(new URL("godot://capabilities"))).contents[0]!.text) as {
    orphaned_consumers: unknown[];
    dropped_tools: unknown[];
  };
  assert.deepEqual(payload.orphaned_consumers, []);
  assert.deepEqual(payload.dropped_tools, []);
});

// ── the description that lied ──────────────────────────────────────────────────────

test("godot_run_project no longer claims to return a process id", () => {
  const { calls } = surfaceFor(["all"]);
  const run = calls.find((c) => c.name === "godot_run_project")!;
  const description = (run.config as unknown as { description: string }).description;
  assert.ok(
    !/process id/i.test(description),
    "godot_run_project returns an OS pid and no handle; `godot_stop` takes only the registry id " +
      "`godot_run_managed` mints, and this tool's own port-conflict remedy says a detached game is not " +
      "stoppable by any tool",
  );
  // The tool that DOES mint one still says so — the claim is a correction, not a purge.
  const managed = calls.find((c) => c.name === "godot_run_managed")!;
  assert.match((managed.config as unknown as { description: string }).description, /process id/i);
});

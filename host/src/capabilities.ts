/**
 * Capability groups — a risk-based axis that cuts ACROSS the plane/feature
 * toolsets (`BREAKPOINT_TOOLSETS`). One group, OFF by default:
 *
 *   • `code-execution` — tools that run arbitrary GDScript, invoke arbitrary
 *     methods, evaluate an expression in a paused debug frame, spawn headless
 *     child processes of the project, or run a local asset-gen *command* backend.
 *
 * There is deliberately NO `network` group. There was one, tagging
 * `backend_detect` and `backend_configure` and described as "egress beyond
 * loopback" — but neither tool egresses. `backend_detect` reads which SDKs are
 * installed over the loopback editor bridge, and `backend_configure` writes a
 * `res://` script through that same bridge; the Group M principle is "host
 * nothing, scaffold everything", so the GENERATED GDScript is what talks to a
 * provider, at game runtime, in a different process. The group therefore gated
 * two local tools behind a name that promised egress, which misleads in both
 * directions: it implied the secure default was holding back a network
 * capability that never existed, and it made reading a list of installed addons
 * look like opening an outbound path. `openWorldHint` was false for every tool
 * on the surface — annotations.ts was right and this file was wrong.
 *
 * A future tool that genuinely leaves this machine must re-introduce the group
 * here AND list itself in annotations.ts's OPEN_WORLD, and the two must agree.
 *
 * Where toolsets filter whole planes, capability groups tag INDIVIDUAL tools and
 * DROP them at registration when their group isn't enabled — so a default
 * session's advertised surface omits the high-blast tools entirely
 * (least-privilege by construction, mirroring `godot-agent-loop`). The full
 * 292-tool surface loads only when `BREAKPOINT_PRIVILEGED_GROUPS` opts the
 * group back in; the secure-default surface is 292 − 13 = 279 tools.
 *
 * A tool with NO capability tag is always registered. Semantics are a UNION: a
 * tool tagged with more than one group is registered when ANY of its groups is
 * enabled. (Nothing is multi-tagged, and with one group nothing can be — the
 * asset-gen generators were formerly `code-execution` + `network` for an external
 * *provider* backend that is not implemented, which is the same reason the
 * `network` group is gone rather than merely unused.)
 *
 * This is defense-in-depth + a legible least-privilege default over a surface
 * that is already typed, schema-frozen, undoable, and destructive-op
 * elicitation-gated — NOT the closing of an open hole. The dropped tools never
 * become a silent gap: the always-on `godot://capabilities` resource lists every
 * group, its state, the tools it gates, and exactly how to enable it.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export type CapabilityGroup = "code-execution";

/** The groups, in display order. */
export const CAPABILITY_GROUPS: readonly CapabilityGroup[] = ["code-execution"];

/** One-line human description per group (shown by `doctor` and the resource). */
export const GROUP_DESCRIBE: Record<CapabilityGroup, string> = {
  "code-execution":
    "Run arbitrary GDScript, invoke arbitrary methods, evaluate an expression in a paused debug frame, spawn headless child processes of the project, or run a local asset-gen command backend.",
};

/**
 * Tool → capability group(s). A tool absent from this map is unprivileged and
 * always registered. This is the single source of truth for the risk tagging,
 * asserted total-and-correct by `capabilities.test.ts`.
 */
export const TOOL_CAPABILITIES: Readonly<Record<string, readonly CapabilityGroup[]>> = {
  // code-execution — arbitrary execution / invocation / paused-frame evaluation
  godot_run_headless_script: ["code-execution"],
  godot_run_managed: ["code-execution"],
  node_call_method: ["code-execution"],
  runtime_call_method: ["code-execution"],
  // F6: spawns headless Godot child processes of the project — the same class of
  // trust as godot_run_managed, which is why it is privileged rather than merely
  // confirmation-gated.
  runtime_spawn_peers: ["code-execution"],
  dbg_evaluate: ["code-execution"],
  cs_dbg_evaluate: ["code-execution"],
  // asset generation — the local command backend (code-execution) is the only
  // privileged path. Formerly also tagged `network` for an external provider
  // backend, but that backend is not implemented, so the network tag is dropped
  // until it ships — keeps the advertised capability matching the real surface.
  asset_gen_configure: ["code-execution"],
  asset_gen_icon: ["code-execution"],
  asset_gen_sprite: ["code-execution"],
  asset_gen_texture: ["code-execution"],
  asset_gen_model: ["code-execution"],
  asset_gen_audio_sfx: ["code-execution"],
  // backend_detect / backend_configure are deliberately ABSENT: neither leaves
  // this machine (see the header). They are unprivileged, which also puts
  // backend_configure back in line with the three sibling codegen tools —
  // leaderboard_scaffold / cloudsave_scaffold / auth_scaffold — that write the
  // same kind of generated GDScript and were never privileged.
};

/**
 * How many tools the secure default drops, DERIVED rather than restated.
 *
 * 🔴 `breakpoint-mcp init` printed "drops the 14 code-execution + network tools"
 * for as long as this group has had thirteen members — a wrong number in the first
 * thing a new user reads, on the subject the secure default exists to explain.
 * Check 25 reads three-digit numerals and this one is two digits; check 11 claims
 * tool TOTALS and this is a subset of one. NO READER OWNED IT, which is 222 §2's
 * finding arriving one instrument over, in a string we print to a terminal.
 */
export const PRIVILEGED_TOOL_COUNT = Object.keys(TOOL_CAPABILITIES).length;

/**
 * Parse the raw BREAKPOINT_PRIVILEGED_GROUPS env into a normalized token list
 * (or null for "unset" → no groups → the safe-default surface). Comma/whitespace
 * separated, lower-cased. Mirrors `parseToolsets`.
 */
export function parsePrivilegedGroups(raw: string | undefined): string[] | null {
  if (raw == null) return null;
  const toks = raw
    .split(/[,\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return toks.length ? toks : null;
}

/**
 * Resolve normalized tokens to the enabled group set. Unknown tokens are
 * reported via `onUnknown` and ignored (a typo never silently enables a group).
 * `null`/empty → the empty set (safe default). `all` enables every group.
 */
export function selectPrivilegedGroups(
  tokens: string[] | null,
  onUnknown?: (unknown: string[]) => void,
): Set<CapabilityGroup> {
  const enabled = new Set<CapabilityGroup>();
  if (!tokens) return enabled;
  const known = new Set<string>(CAPABILITY_GROUPS);
  const unknown: string[] = [];
  for (const t of tokens) {
    if (t === "all") {
      for (const g of CAPABILITY_GROUPS) enabled.add(g);
    } else if (known.has(t)) {
      enabled.add(t as CapabilityGroup);
    } else {
      unknown.push(t);
    }
  }
  if (unknown.length && onUnknown) onUnknown(unknown);
  return enabled;
}

/** Is a tool allowed given the enabled groups? Untagged tools are always allowed. */
export function toolAllowed(name: string, enabled: ReadonlySet<CapabilityGroup>): boolean {
  const groups = TOOL_CAPABILITIES[name];
  if (!groups || groups.length === 0) return true;
  return groups.some((g) => enabled.has(g));
}

/** The sorted set of privileged tool names dropped when `enabled` groups are active. */
export function droppedTools(enabled: ReadonlySet<CapabilityGroup>): string[] {
  return Object.keys(TOOL_CAPABILITIES)
    .filter((name) => !toolAllowed(name, enabled))
    .sort();
}

/**
 * Wrap `server.registerTool` to DROP any tool whose capability group isn't
 * enabled, so a disabled group's tools never reach `tools/list`. Mirrors
 * `applyOutputSchemas`' wrapping; call once, right AFTER `applyOutputSchemas`
 * (so the schema-injection wrapper stays innermost) and before any
 * `register*Tools()` call. A dropped tool returns a harmless stub handle so the
 * calling register* code proceeds unchanged.
 */
export function applyCapabilities(server: McpServer, enabled: ReadonlySet<CapabilityGroup>): void {
  const gate =
    (raw: (name: string, config: unknown, handler: unknown) => unknown) =>
    (name: string, config: unknown, handler: unknown) => {
      if (!toolAllowed(name, enabled)) {
        // Not registered — omitted from tools/list entirely (least-privilege).
        return { name } as unknown;
      }
      return raw(name, config, handler);
    };

  const s = server as unknown as {
    registerTool: (name: string, config: unknown, handler: unknown) => unknown;
    experimental?: { tasks?: { registerToolTask?: (name: string, config: unknown, handler: unknown) => unknown } };
  };

  s.registerTool = gate(s.registerTool.bind(server) as never);

  // D2 task-model tools (long jobs like `godot_run_headless_script`) register
  // through server.experimental.tasks.registerToolTask, NOT registerTool — gate
  // that path too, or a privileged task tool would slip past the drop filter.
  const tasks = s.experimental?.tasks;
  if (tasks?.registerToolTask) {
    tasks.registerToolTask = gate(tasks.registerToolTask.bind(tasks) as never);
  }
}

/**
 * The JSON-RPC method `McpServer` registers its tool dispatcher under. Written as
 * a literal because the SDK does not export the method string, and PINNED by
 * `capabilities.test.ts`, which builds a real server and asserts the handler map
 * carries exactly this key — so an SDK that renamed the method reddens a test
 * rather than silently un-installing the refusal below.
 */
export const CALL_TOOL_METHOD = "tools/call";

/**
 * The message a withheld tool answers with, in place of the SDK's `not found`.
 *
 * 🔴 THE READER OF THIS SENTENCE IS USUALLY NOT A HUMAN. `mcp.js` throws
 * `Tool <name> not found` for any name absent from its registry, and a dropped
 * tool is absent for exactly that reason — so a deliberate configuration reads,
 * to the assistant relaying it, as a feature this package does not have. It will
 * report that absence to the user as fact. Every remedy is therefore named here
 * and named *derived*: the group, the env var, the `init` preset and the resource
 * that lists the rest. `not a missing feature` is in the first line because it is
 * the sentence the reader is about to get wrong.
 */
export function droppedToolMessage(name: string): string {
  const groups = TOOL_CAPABILITIES[name] ?? [];
  const list = groups.join(", ");
  return (
    `Tool ${name} exists in this server but is WITHHELD BY POLICY — it is not a missing feature. ` +
    `It belongs to the higher-trust capability group${groups.length === 1 ? "" : "s"} ` +
    `'${list}', which ${groups.length === 1 ? "is" : "are"} OFF by default. ` +
    `Enable it by setting BREAKPOINT_PRIVILEGED_GROUPS=${list} in this server's env, ` +
    `or by re-running \`npx breakpoint-mcp init --trust full\`. ` +
    `Read the godot://capabilities resource for every group, its state, and the full withheld list.`
  );
}

/**
 * Make a call to a DROPPED tool answer with the policy instead of the SDK's
 * `Tool <name> not found`. Call ONCE, after every `register*Tools()` — the
 * dispatcher does not exist until the first `registerTool`, and wrapping it
 * earlier would wrap nothing.
 *
 * 🔴 THIS DELIBERATELY DOES NOT REGISTER THE TOOL. Least-privilege by
 * construction is the point of the drop: `tools/list` stays at 279 and no
 * withheld schema crosses the wire, so `wire_diff`, `token-cost` and every floor
 * over the advertised surface are unmoved. The ONLY thing that changes is the
 * sentence a caller gets back when it asks for one by name — which is the whole
 * defect, because the tool was never the problem.
 *
 * Wrapping the map entry rather than calling `setRequestHandler` is not a
 * shortcut: the SDK stores an already-parsed wrapper there, so re-registering
 * would mean re-implementing dispatch. This preserves it and adds one branch in
 * front, the same monkeypatch idiom `applyCapabilities` uses one function up.
 */
export function applyDroppedToolRefusal(server: McpServer, enabled: ReadonlySet<CapabilityGroup>): void {
  const dropped = new Set(droppedTools(enabled));
  if (dropped.size === 0) return;

  type RawHandler = (request: unknown, extra: unknown) => Promise<unknown>;
  const proto = (server as unknown as { server?: { _requestHandlers?: Map<string, RawHandler> } }).server;
  const handlers = proto?._requestHandlers;
  const inner = handlers?.get(CALL_TOOL_METHOD);
  // No dispatcher means no tool was ever registered — nothing to guard, and
  // installing a handler here would answer for a surface that does not exist.
  if (!handlers || !inner) return;

  handlers.set(CALL_TOOL_METHOD, async (request: unknown, extra: unknown) => {
    const name = (request as { params?: { name?: unknown } } | undefined)?.params?.name;
    if (typeof name === "string" && dropped.has(name)) {
      // 🔴 THE SAME SHAPE `not found` ALREADY HAD, AND ONLY THE SENTENCE CHANGED.
      // `mcp.js` catches its own `McpError` and answers with an isError
      // CallToolResult — it does NOT throw — so a refusal that threw would be a
      // protocol error where every other failure on this surface is a tool
      // error, and clients treat the two differently. The defect was one
      // sentence; the fix is one sentence. The code is carried for the client
      // that reads it, and it is InvalidParams for the same reason the SDK's is.
      return {
        content: [{ type: "text", text: `MCP error ${ErrorCode.InvalidParams}: ${droppedToolMessage(name)}` }],
        isError: true,
      };
    }
    return inner(request, extra);
  });
}

/**
 * Register the always-on `godot://capabilities` resource: a read-only listing of
 * the capability groups, their enabled/disabled state, exactly which tools each
 * gates, the dropped set, and the env one-liner to enable them. Registered
 * UNCONDITIONALLY (not behind the `resources` toolset), so the dropped privileged
 * tools are never a silent gap — an agent can always see what exists-but-is-
 * disabled and how to turn it on.
 */
export function registerCapabilitiesResource(server: McpServer, enabled: ReadonlySet<CapabilityGroup>): void {
  server.registerResource(
    "capabilities",
    "godot://capabilities",
    {
      title: "Capability groups",
      description:
        "Higher-trust tool groups, their enabled/disabled state, the tools each gates, and how to enable them.",
      mimeType: "application/json",
    },
    async (uri) => {
      const groups = CAPABILITY_GROUPS.map((g) => ({
        id: g,
        enabled: enabled.has(g),
        describe: GROUP_DESCRIBE[g],
        tools: Object.keys(TOOL_CAPABILITIES)
          .filter((name) => (TOOL_CAPABILITIES[name] ?? []).includes(g))
          .sort(),
      }));
      // 🔴 BOTH OF THESE ARE DERIVED FROM `CAPABILITY_GROUPS`, AND THAT IS THE
      // FIX RATHER THAN A TIDY-UP. Until 250 this resource announced "Two
      // higher-trust tool groups" and offered `'network'` — a group deleted from
      // this file's own header, whose token `selectPrivilegedGroups` reports as
      // unknown and ignores. The always-on affordance that exists so a withheld
      // tool is never a silent gap was telling its reader to type something the
      // parser refuses. A restated count goes stale in silence; a derived one
      // cannot, which is 198 §36's rule applied to a sentence instead of a floor.
      const groupList = CAPABILITY_GROUPS.map((g) => `'${g}'`).join(", ");
      const payload = {
        summary:
          `${CAPABILITY_GROUPS.length} higher-trust tool group(s) — ${CAPABILITY_GROUPS.join(", ")} — are OFF by default. ` +
          "A disabled group's tools are not registered (omitted from tools/list), and calling one by name is refused with a message naming this resource — never with `not found`. Enable a group to load its tools.",
        default_secure: enabled.size === 0,
        enabled_groups: [...enabled].sort(),
        dropped_tools: droppedTools(enabled),
        how_to_enable:
          `Set BREAKPOINT_PRIVILEGED_GROUPS in the MCP server env (comma-separated), from: ${groupList}, or 'all'. ` +
          "Or re-run `npx breakpoint-mcp init --trust full` for a guided setup.",
        groups,
      };
      return {
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(payload, null, 2) }],
      };
    },
  );
}

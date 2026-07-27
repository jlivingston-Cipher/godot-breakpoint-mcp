import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BridgeClient, BridgeError } from "../bridge.js";
import { MAX_PEERS, type PeerRegistry } from "../peers.js";
import { gate } from "../confirm.js";
import { ok } from "./lsp-common.js";

const confirmField = {
  confirm: z.boolean().optional().describe("Auto-approve this destructive action (skip the confirmation prompt)"),
};

/**
 * F6: address a spawned headless peer instead of the default running game.
 * Threaded onto the runtime tools a multi-process playtest actually drives —
 * seed, freeze, step, read, invoke, await, log — rather than minting a parallel
 * set of peer-specific tools. Omitting it is byte-identical to pre-F6 behaviour.
 */
const peerField = {
  peer: z
    .string()
    .optional()
    .describe("Target a headless peer by id (from runtime_spawn_peers). Omit to address the default running game."),
};

/**
 * Runtime-bridge tools (Plane C). Each forwards to the in-game autoload
 * (BreakpointRuntimeBridge) over TCP. These only work while the project is running.
 */

function fail(err: unknown) {
  const be = err as Partial<BridgeError> & { message?: string };
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: `Runtime error [${be?.code ?? "error"}]: ${be?.message ?? String(err)}` }],
  };
}

/**
 * Compare a polled property value against an expected value under one of the
 * restricted operators exposed by runtime_await_condition. eq/ne use structural
 * (JSON) equality so tagged-Variant objects compare cleanly; the ordered
 * operators are numeric-only and are false unless both sides are numbers.
 */
function compareValues(actual: unknown, expected: unknown, op: string): boolean {
  const bothNum = typeof actual === "number" && typeof expected === "number";
  switch (op) {
    case "ne":
      return JSON.stringify(actual) !== JSON.stringify(expected);
    case "gt":
      return bothNum && (actual as number) > (expected as number);
    case "ge":
      return bothNum && (actual as number) >= (expected as number);
    case "lt":
      return bothNum && (actual as number) < (expected as number);
    case "le":
      return bothNum && (actual as number) <= (expected as number);
    case "eq":
    default:
      return JSON.stringify(actual) === JSON.stringify(expected);
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Stable stringification of a state digest: object keys sorted at every level,
 * so convergence is a property of the CONTENT and not of key order.
 *
 * The addon already emits a stable-ordered digest, and JS preserves string-key
 * insertion order, so a plain JSON.stringify would compare correctly today.
 * Sorting anyway costs nothing and means the convergence claim does not quietly
 * depend on an ordering guarantee made two layers away.
 */
function canonical(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const src = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(src).sort()) out[k] = walk(src[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(walk(value));
}

export function registerRuntimeTools(server: McpServer, runtime: BridgeClient, peers: PeerRegistry): void {
  /** The bridge addressing `peer`, or the default running game when omitted. */
  const clientFor = (peer?: string): BridgeClient => (peer ? peers.clientFor(peer) : runtime);
  /** Human label for confirmation prompts, so a gated op names its target process. */
  const target = (peer?: string) => (peer ? `peer ${peer}` : "the running game");

  const call = async (method: string, params: Record<string, unknown> = {}, peer?: string) => {
    try {
      return ok(await clientFor(peer).request(method, params));
    } catch (err) {
      return fail(err);
    }
  };

  server.registerTool(
    "runtime_get_tree",
    {
      title: "Runtime scene tree",
      description: "Traverse the LIVE SceneTree of the running game (name, type, path, visibility, children).",
      inputSchema: {
        max_depth: z.number().int().positive().optional().describe("Max recursion depth (default 64)"),
        ...peerField,
      },
    },
    async ({ max_depth, peer }) => call("runtime.get_tree", max_depth ? { max_depth } : {}, peer),
  );

  server.registerTool(
    "runtime_get_property",
    {
      title: "Runtime get property",
      description: "Read a property from a live node (path relative to the current scene; '/root/...' absolute allowed).",
      inputSchema: { path: z.string(), property: z.string(), ...peerField },
    },
    async ({ path, property, peer }) => call("runtime.get_property", { path, property }, peer),
  );

  server.registerTool(
    "runtime_set_property",
    {
      title: "Runtime set property",
      description: "Set a property on a live node. DESTRUCTIVE (mutates running game state) — gated by confirmation. Rich types use the {\"__type__\":...} convention.",
      inputSchema: { path: z.string(), property: z.string(), value: z.any(), ...confirmField, ...peerField },
    },
    async ({ path, property, value, confirm, peer }) => {
      const blocked = await gate(server, confirm, `Set live property ${path}.${property} on ${target(peer)}`);
      if (blocked) return blocked;
      return call("runtime.set_property", { path, property, value }, peer);
    },
  );

  server.registerTool(
    "runtime_call_method",
    {
      title: "Runtime call method",
      description: "Invoke a method on a live node. DESTRUCTIVE (arbitrary invocation) — gated by confirmation. Args use the tagged-Variant convention.",
      inputSchema: { path: z.string(), method: z.string(), args: z.array(z.any()).optional(), ...confirmField, ...peerField },
    },
    async ({ path, method, args, confirm, peer }) => {
      const blocked = await gate(server, confirm, `Call ${path}.${method}() on ${target(peer)}`);
      if (blocked) return blocked;
      return call("runtime.call_method", { path, method, args: args ?? [] }, peer);
    },
  );

  server.registerTool(
    "runtime_emit_signal",
    {
      title: "Runtime emit signal",
      description: "Emit a signal from a live node. DESTRUCTIVE — gated by confirmation.",
      inputSchema: { path: z.string(), signal: z.string(), args: z.array(z.any()).optional(), ...confirmField, ...peerField },
    },
    async ({ path, signal, args, confirm, peer }) => {
      const blocked = await gate(server, confirm, `Emit signal "${signal}" from ${path} on ${target(peer)}`);
      if (blocked) return blocked;
      return call("runtime.emit_signal", { path, signal, args: args ?? [] }, peer);
    },
  );

  server.registerTool(
    "runtime_inject_input",
    {
      title: "Runtime inject input",
      description:
        "Inject a synthetic input event for automated play-testing. DESTRUCTIVE. " +
        "event.kind is 'action' | 'key' | 'mouse_button' | 'mouse_motion'. " +
        "Example: {\"kind\":\"action\",\"action\":\"jump\",\"pressed\":true}.",
      inputSchema: {
        event: z.object({
          kind: z.enum(["action", "key", "mouse_button", "mouse_motion"]),
          action: z.string().optional(),
          strength: z.number().optional(),
          keycode: z.number().int().optional(),
          button: z.number().int().optional(),
          pressed: z.boolean().optional(),
          position: z.any().optional(),
          relative: z.any().optional(),
        }),
        ...confirmField,
        ...peerField,
      },
    },
    async ({ event, confirm, peer }) => {
      const blocked = await gate(server, confirm, `Inject ${event.kind} input event into ${target(peer)}`);
      if (blocked) return blocked;
      return call("runtime.inject_input", { event }, peer);
    },
  );

  server.registerTool(
    "runtime_get_monitors",
    {
      title: "Runtime performance monitors",
      description:
        "Read live Performance monitors (FPS, draw calls, node count, physics, audio output latency, ...). " +
        "Pass specific keys or omit for all. Keys include time/fps, render/total_draw_calls, audio/output_latency.",
      inputSchema: { keys: z.array(z.string()).optional(), ...peerField },
    },
    async ({ keys, peer }) => call("runtime.get_monitors", keys ? { keys } : {}, peer),
  );

  server.registerTool(
    "runtime_screenshot",
    {
      title: "Runtime screenshot",
      description: "Capture the current game frame as a PNG and return it as image content so the assistant can see the running game.",
      inputSchema: { ...peerField },
    },
    async ({ peer }) => {
      try {
        const r = (await clientFor(peer).request("runtime.screenshot", {})) as { base64: string; mime: string; width: number; height: number };
        return {
          content: [
            { type: "image" as const, data: r.base64, mimeType: r.mime },
            { type: "text" as const, text: `Captured game frame (${r.width}x${r.height}).` },
          ],
        };
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "runtime_get_log",
    {
      title: "Runtime log",
      description:
        "Read the runtime log ring buffer (entries game code pushed via BreakpointRuntimeBridge.push_log). " +
        "Use since_seq for incremental reads.",
      inputSchema: {
        since_seq: z.number().int().optional().describe("Return only entries with seq greater than this (default 0)"),
        levels: z.array(z.string()).optional().describe("Filter to these levels, e.g. [\"error\",\"warning\"]"),
        ...peerField,
      },
    },
    async ({ since_seq, levels, peer }) =>
      call("runtime.get_log", { since_seq: since_seq ?? 0, levels: levels ?? [] }, peer),
  );

  server.registerTool(
    "runtime_assert_node_state",
    {
      title: "Runtime assert node state",
      description:
        "Assert that properties of a LIVE node equal expected values (read-only verification). " +
        "Reports per-property mismatches; supports an optional absolute numeric tolerance.",
      inputSchema: {
        path: z.string().describe("Node path (relative to the current scene; '/root/...' absolute allowed)"),
        expect: z
          .record(z.any())
          .describe("Map of property name -> expected value (JSON; use the tagged-Variant form for complex types like Vector2/Color)"),
        tolerance: z
          .number()
          .nonnegative()
          .optional()
          .describe("Absolute tolerance for numeric comparisons (default 0 = exact match)"),
        ...peerField,
      },
    },
    async ({ path, expect, tolerance, peer }) =>
      call(
        "runtime.assert_node_state",
        tolerance !== undefined ? { path, expect, tolerance } : { path, expect },
        peer,
      ),
  );

  server.registerTool(
    "runtime_assert_scene_structure",
    {
      title: "Runtime assert scene structure",
      description:
        "Assert the LIVE SceneTree matches structural expectations (read-only). Each entry asserts a node " +
        "exists at a path (and, if given, is of a class via is_class); set absent:true to assert it is NOT present.",
      inputSchema: {
        expect: z
          .array(
            z.object({
              path: z.string(),
              type: z.string().optional(),
              absent: z.boolean().optional(),
            }),
          )
          .describe("List of node expectations: {path, type?, absent?}."),
        ...peerField,
      },
    },
    async ({ expect, peer }) => call("runtime.assert_scene_structure", { expect }, peer),
  );

  server.registerTool(
    "runtime_assert_perf",
    {
      title: "Runtime assert perf",
      description:
        "Assert that live Performance monitors meet a caller-supplied baseline within tolerance (read-only). " +
        "Capture the baseline earlier with runtime_get_monitors and pass it back inline. Pass direction is inferred " +
        "(time/fps is higher-better; every other monitor is lower-better) unless overridden per key.",
      inputSchema: {
        baseline: z
          .record(z.number())
          .describe("Monitor key -> baseline value (capture earlier via runtime_get_monitors)"),
        tolerance: z
          .number()
          .nonnegative()
          .optional()
          .describe("Fractional tolerance applied to each comparison (default 0 = exact)"),
        direction: z
          .record(z.enum(["higher_better", "lower_better"]))
          .optional()
          .describe("Per-key override of the pass direction (defaults: time/fps higher_better, else lower_better)"),
        ...peerField,
      },
    },
    async ({ baseline, tolerance, direction, peer }) =>
      call(
        "runtime.assert_perf",
        {
          baseline,
          ...(tolerance !== undefined ? { tolerance } : {}),
          ...(direction !== undefined ? { direction } : {}),
        },
        peer,
      ),
  );

  server.registerTool(
    "runtime_assert_screen_text",
    {
      title: "Runtime assert screen text",
      description:
        "Assert that on-screen text is present (or absent) by scanning visible Control text in the LIVE scene tree " +
        "(read-only; no OCR). Sees text on Label / RichTextLabel / Button / LineEdit / TextEdit / CheckBox / LinkButton " +
        "and similar; does NOT see text drawn directly to the canvas or baked into textures.",
      inputSchema: {
        text: z.string().describe("Text (or regular expression) to look for"),
        present: z
          .boolean()
          .optional()
          .describe("Assert the text IS present (default true); set false to assert it is absent"),
        regex: z.boolean().optional().describe("Treat `text` as a regular expression (default false = substring)"),
        case_sensitive: z.boolean().optional().describe("Case-sensitive match (default false)"),
        min_count: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Require at least this many matches (implies present)"),
        ...peerField,
      },
    },
    async ({ text, present, regex, case_sensitive, min_count, peer }) =>
      call(
        "runtime.assert_screen_text",
        {
          text,
          ...(present !== undefined ? { present } : {}),
          ...(regex !== undefined ? { regex } : {}),
          ...(case_sensitive !== undefined ? { case_sensitive } : {}),
          ...(min_count !== undefined ? { min_count } : {}),
        },
        peer,
      ),
  );

  server.registerTool(
    "runtime_screenshot_diff",
    {
      title: "Runtime screenshot diff",
      description:
        "Capture the current frame and compare it to a reference PNG at a project path, returning diff stats and a " +
        "pass/fail vs tolerance (read-only; the diff is computed engine-side so the host stays dependency-free). " +
        "Establish the reference first by saving a runtime_screenshot as a project asset.",
      inputSchema: {
        reference: z.string().describe("res:// or user:// path to the reference PNG"),
        tolerance: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Max fraction of differing pixels that still passes (default 0)"),
        per_channel_threshold: z
          .number()
          .int()
          .min(0)
          .max(255)
          .optional()
          .describe("Per-channel delta (0-255) for a pixel to count as different (default 0)"),
        region: z
          .object({ x: z.number().int(), y: z.number().int(), w: z.number().int(), h: z.number().int() })
          .optional()
          .describe("Optional sub-region (applied to both frame and reference) to compare"),
        ...peerField,
      },
    },
    async ({ reference, tolerance, per_channel_threshold, region, peer }) =>
      call(
        "runtime.screenshot_diff",
        {
          reference,
          ...(tolerance !== undefined ? { tolerance } : {}),
          ...(per_channel_threshold !== undefined ? { per_channel_threshold } : {}),
          ...(region !== undefined ? { region } : {}),
        },
        peer,
      ),
  );

  // F8: deterministic-verification helper. Poll a live property until it meets a
  // comparison, or a timeout elapses. Host-side over runtime.get_property (no new
  // bridge method), so it works on every engine build the runtime bridge supports.
  // Read-only: it never mutates the game, so it is not confirmation-gated.
  server.registerTool(
    "runtime_await_condition",
    {
      title: "Runtime await condition",
      description:
        "Poll a property on a LIVE node until it satisfies a comparison, or a timeout elapses (read-only verification). " +
        "op is eq | ne | gt | ge | lt | le (the ordered operators require numeric values). Use this to wait for the " +
        "running game to reach a state before asserting on it — e.g. wait for hp le 0, then runtime_assert_screen_text.",
      inputSchema: {
        path: z.string().describe("Node path (relative to the current scene; '/root/...' absolute allowed)"),
        property: z.string().describe("Property to read on each poll"),
        value: z.any().describe("Value to compare the property against (tagged-Variant form for complex types)"),
        op: z.enum(["eq", "ne", "gt", "ge", "lt", "le"]).optional().describe("Comparison operator (default eq)"),
        timeout_ms: z.number().int().positive().optional().describe("Maximum time to wait, in ms (default 5000)"),
        poll_interval_ms: z.number().int().positive().optional().describe("Delay between polls, in ms (default 100)"),
        ...peerField,
      },
    },
    async ({ path, property, value, op, timeout_ms, poll_interval_ms, peer }) => {
      const operator = op ?? "eq";
      const interval = poll_interval_ms ?? 100;
      const start = Date.now();
      const deadline = start + (timeout_ms ?? 5000);
      let polls = 0;
      let last: unknown = null;
      let client: BridgeClient;
      try {
        client = clientFor(peer);
      } catch (err) {
        return fail(err);
      }
      for (;;) {
        polls++;
        let res: { value?: unknown };
        try {
          res = (await client.request("runtime.get_property", { path, property })) as { value?: unknown };
        } catch (err) {
          return fail(err);
        }
        last = res?.value ?? null;
        if (compareValues(last, value, operator)) {
          return ok({ met: true, polls, elapsed_ms: Date.now() - start, value: last });
        }
        if (Date.now() >= deadline) {
          return ok({ met: false, polls, elapsed_ms: Date.now() - start, value: last });
        }
        await sleep(interval);
      }
    },
  );

  server.registerTool(
    "runtime_anim_play",
    {
      title: "Runtime play animation",
      description:
        "Play an animation on a LIVE AnimationPlayer node. DESTRUCTIVE (drives the running game) — gated by confirmation. " +
        "Omit `animation` to (re)play the currently-assigned one.",
      inputSchema: {
        path: z.string().describe("Path to an AnimationPlayer node in the running scene"),
        animation: z.string().optional().describe("Animation name to play (default: the current/assigned animation)"),
        custom_speed: z.number().optional().describe("Playback speed multiplier (default 1.0; negative not supported here)"),
        from_end: z.boolean().optional().describe("Start playback from the end (default false)"),
        ...confirmField,
        ...peerField,
      },
    },
    async ({ path, animation, custom_speed, from_end, confirm, peer }) => {
      const blocked = await gate(
        server, confirm, `Play animation "${animation ?? "(current)"}" on ${path} in ${target(peer)}`);
      if (blocked) return blocked;
      return call(
        "runtime.anim_play",
        {
          path,
          ...(animation !== undefined ? { animation } : {}),
          ...(custom_speed !== undefined ? { custom_speed } : {}),
          ...(from_end !== undefined ? { from_end } : {}),
        },
        peer,
      );
    },
  );

  server.registerTool(
    "runtime_anim_stop",
    {
      title: "Runtime stop animation",
      description:
        "Stop (or pause) a LIVE AnimationPlayer node. DESTRUCTIVE (drives the running game) — gated by confirmation. " +
        "keep_state:true pauses in place; false (default) stops.",
      inputSchema: {
        path: z.string().describe("Path to an AnimationPlayer node in the running scene"),
        keep_state: z.boolean().optional().describe("Pause in place instead of stopping (default false)"),
        ...confirmField,
        ...peerField,
      },
    },
    async ({ path, keep_state, confirm, peer }) => {
      const blocked = await gate(server, confirm, `Stop animation on ${path} in ${target(peer)}`);
      if (blocked) return blocked;
      return call("runtime.anim_stop", { path, ...(keep_state !== undefined ? { keep_state } : {}) }, peer);
    },
  );

  server.registerTool(
    "runtime_anim_get_state",
    {
      title: "Runtime animation state",
      description:
        "Read the playback state of a LIVE AnimationPlayer (read-only): current animation, whether it is playing, " +
        "position, length, speed scale, and the list of available animations.",
      inputSchema: { path: z.string().describe("Path to an AnimationPlayer node in the running scene"), ...peerField },
    },
    async ({ path, peer }) => call("runtime.anim_get_state", { path }, peer),
  );

  server.registerTool(
    "runtime_node_add",
    {
      title: "Runtime add node",
      description:
        "Add a node to the LIVE running game as a child of `parent`. DESTRUCTIVE — gated by confirmation. " +
        "Provide `scene` (a res:// PackedScene to instantiate) OR `type` (a ClassDB class to instantiate); `name` renames it.",
      inputSchema: {
        parent: z.string().describe("Path to the parent node in the running scene"),
        type: z.string().optional().describe("Class name to instantiate (e.g. Node2D) — mutually exclusive with `scene`"),
        scene: z.string().optional().describe("res:// path to a PackedScene to instantiate — mutually exclusive with `type`"),
        name: z.string().optional().describe("Optional name for the new node"),
        ...confirmField,
        ...peerField,
      },
    },
    async ({ parent, type, scene, name, confirm, peer }) => {
      const blocked = await gate(server, confirm, `Add ${scene ?? type ?? "node"} under ${parent} in ${target(peer)}`);
      if (blocked) return blocked;
      return call(
        "runtime.node_add",
        {
          parent,
          ...(type !== undefined ? { type } : {}),
          ...(scene !== undefined ? { scene } : {}),
          ...(name !== undefined ? { name } : {}),
        },
        peer,
      );
    },
  );

  server.registerTool(
    "runtime_node_remove",
    {
      title: "Runtime remove node",
      description:
        "Remove (queue_free) a node from the LIVE running game. DESTRUCTIVE — gated by confirmation. " +
        "Refuses to remove the current scene root.",
      inputSchema: {
        path: z.string().describe("Path to the node to remove in the running scene"),
        ...confirmField,
        ...peerField,
      },
    },
    async ({ path, confirm, peer }) => {
      const blocked = await gate(server, confirm, `Remove ${path} from ${target(peer)}`);
      if (blocked) return blocked;
      return call("runtime.node_remove", { path }, peer);
    },
  );

  // F4: deterministic playtesting — freeze time, step exact frames, snapshot state, seed RNG.
  server.registerTool(
    "runtime_time_scale",
    {
      title: "Runtime time scale",
      description:
        "Set Engine.time_scale on the running game: 0 freezes time, 1 is normal, >1 fast, <1 slow-motion. " +
        "DESTRUCTIVE (alters the running game's clock) — gated by confirmation. Freeze with scale 0, then " +
        "runtime_step_frames to advance deterministically before asserting.",
      inputSchema: {
        scale: z.number().min(0).describe("0 = freeze, 1 = normal, N = slow/fast (negative is clamped to 0)"),
        ...confirmField,
        ...peerField,
      },
    },
    async ({ scale, confirm, peer }) => {
      const blocked = await gate(server, confirm, `Set time scale to ${scale} on ${target(peer)}`);
      if (blocked) return blocked;
      return call("runtime.time_scale", { scale }, peer);
    },
  );

  server.registerTool(
    "runtime_step_frames",
    {
      title: "Runtime step frames",
      description:
        "Advance the running game by an exact number of frames while otherwise frozen, for deterministic, " +
        "frame-accurate playtesting. DESTRUCTIVE — gated by confirmation. `kind` selects which loop to tick each " +
        "step: idle (default), physics, or both. Pair with runtime_time_scale{scale:0} to freeze, then assert.",
      inputSchema: {
        frames: z.number().int().positive().describe("Number of frames to advance"),
        kind: z.enum(["idle", "physics", "both"]).optional().describe("Which loop to tick each step (default idle)"),
        ...confirmField,
        ...peerField,
      },
    },
    async ({ frames, kind, confirm, peer }) => {
      const blocked = await gate(server, confirm, `Advance ${frames} frame(s) of ${target(peer)}`);
      if (blocked) return blocked;
      return call("runtime.step_frames", { frames, ...(kind !== undefined ? { kind } : {}) }, peer);
    },
  );

  server.registerTool(
    "runtime_state_digest",
    {
      title: "Runtime state digest",
      description:
        "Capture a compact, stable-ordered JSON snapshot of a live subtree's salient state (read-only) — position, " +
        "rotation, scale, visibility, and modulate by default, or a caller-supplied field list. Deterministic ordering " +
        "makes it ideal for frame-by-frame comparison alongside runtime_step_frames.",
      inputSchema: {
        root: z.string().describe("Root node path in the running scene"),
        fields: z
          .array(z.string())
          .optional()
          .describe("Property names to capture per node (default: position/global_position/rotation/scale/visible/modulate when present)"),
        max_depth: z.number().int().nonnegative().optional().describe("Max recursion depth (default 8)"),
        ...peerField,
      },
    },
    async ({ root, fields, max_depth, peer }) =>
      call(
        "runtime.state_digest",
        {
          root,
          ...(fields !== undefined ? { fields } : {}),
          ...(max_depth !== undefined ? { max_depth } : {}),
        },
        peer,
      ),
  );

  server.registerTool(
    "runtime_seed_rng",
    {
      title: "Runtime seed RNG",
      description:
        "Seed the running game's GLOBAL random number generator (GDScript seed()) so a playtest is reproducible. " +
        "DESTRUCTIVE (changes RNG state) — gated by confirmation. Seeds only the global RNG (randi/randf), not " +
        "per-instance RandomNumberGenerators or physics determinism. IMPORTANT when comparing peers: this is ONE " +
        "stream shared by every caller in the project, and FREEZING DOES NOT STOP IT BEING CONSUMED — time_scale 0 " +
        "makes delta 0 but _process/_physics_process still fire, so code that draws unconditionally burns draws at " +
        "wall-clock rate even while frozen, including in the gap between this call and runtime_step_frames. For peers " +
        "to converge the global stream must be consumed ONLY on frames you are actually stepping: guard draws on " +
        "delta > 0, and give idle-frame code its own RandomNumberGenerator. Measured on real Godot 4.3 — with both, " +
        "three peers converge byte-equal even with a deliberate stagger between each peer's seed and step; with " +
        "either violated, they diverge every time.",
      inputSchema: { seed: z.number().int().describe("Seed value for the global RNG"), ...confirmField, ...peerField },
    },
    async ({ seed, confirm, peer }) => {
      const blocked = await gate(server, confirm, `Seed the global RNG of ${target(peer)} with ${seed}`);
      if (blocked) return blocked;
      return call("runtime.seed_rng", { seed }, peer);
    },
  );

  // F6: multi-peer deterministic playtesting. Three tools, not eight — a `peer`
  // argument aimed at the existing runtime family beats minting parallel ones,
  // so there is no `call_rpc_runtime` (use runtime_call_method{peer}) and no
  // `mp_diagnose` aggregate (use runtime_get_log{peer}).
  server.registerTool(
    "runtime_spawn_peers",
    {
      title: "Runtime spawn headless peers",
      description:
        "Spawn 1-" +
        MAX_PEERS +
        " HEADLESS Godot peers of this project as child processes, each on its own loopback runtime port, and " +
        "wait until every one answers on its bridge. Returns peer ids for the `peer` argument on runtime_step_frames, " +
        "runtime_time_scale, runtime_seed_rng, runtime_get_property, runtime_call_method, runtime_await_condition and " +
        "runtime_get_log — in fact every runtime tool that talks to the running game takes `peer`, so anything you can " +
        "do to the default game you can do to one peer. Pair with runtime_peers_digest to assert that independently-" +
        "driven peers converge, and read its preconditions before expecting them to. Each child " +
        "gets BREAKPOINT_PEER_ID / BREAKPOINT_PEER_INDEX (and BREAKPOINT_PEER_ROLE when `role` is given) in its " +
        "environment, so game code can branch on which peer it is via OS.get_environment(). Local loopback testing only: " +
        "this hosts no relay, lobby or signalling server. Requires the Breakpoint MCP addon enabled in the project.",
      inputSchema: {
        count: z
          .number()
          .int()
          .min(1)
          .max(MAX_PEERS)
          .describe(`How many peers to spawn (1-${MAX_PEERS}; ${MAX_PEERS} live peers is the ceiling)`),
        scene: z.string().optional().describe("Optional res:// scene each peer runs (default: the project's main scene)"),
        args: z.array(z.string()).optional().describe("Extra command-line arguments passed to every peer"),
        role: z
          .string()
          .optional()
          .describe("Label echoed back per peer and exported to each child as BREAKPOINT_PEER_ROLE (e.g. \"server\")"),
        timeout_ms: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("How long to wait for every peer to answer on its bridge, in ms (default 15000)"),
      },
    },
    async ({ count, scene, args, role, timeout_ms }) => {
      try {
        const spawned = await peers.spawn({
          count,
          ...(scene !== undefined ? { scene } : {}),
          ...(args !== undefined ? { args } : {}),
          ...(role !== undefined ? { role } : {}),
          ...(timeout_ms !== undefined ? { timeoutMs: timeout_ms } : {}),
        });
        return ok({ peers: spawned, count: spawned.length });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "runtime_peer_stop",
    {
      title: "Runtime stop peer(s)",
      description:
        "Terminate a headless peer started by runtime_spawn_peers, or every one with all:true. DESTRUCTIVE (kills a " +
        "child process). Stopping an already-stopped peer is a no-op, so this is safe to repeat; peers are also killed " +
        "automatically when the server shuts down.",
      inputSchema: {
        id: z.string().optional().describe("Peer id to stop (from runtime_spawn_peers) — omit when using all"),
        all: z.boolean().optional().describe("Stop every peer this server spawned (default false)"),
      },
    },
    async ({ id, all }) => {
      if (!all && !id) {
        return { isError: true as const, content: [{ type: "text" as const, text: "Pass a peer `id`, or all:true." }] };
      }
      try {
        return ok({ stopped: peers.stop(id, all ?? false) });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "runtime_peers_digest",
    {
      title: "Runtime peer state digest / convergence",
      description:
        "Read runtime_state_digest from two or more peers over the SAME root and field set and report whether they " +
        "agree (read-only). Converged means every peer's digest is byte-equal; when they differ, diverged_at names the " +
        "node paths that disagree. The sequence that actually converges, in this order: runtime_spawn_peers, then per " +
        "peer runtime_time_scale{scale:0} to FREEZE FIRST, runtime_set_property{peer} to equalise the starting state, " +
        "runtime_seed_rng{seed} with the same seed, runtime_step_frames{frames:K,kind:\"physics\"}, then this. " +
        "FOUR PRECONDITIONS, every one measured on real Godot 4.3 — a run that skips any of them diverges, and (2) is " +
        "the one that surprises people. (1) Step the FIXED physics timestep: state advanced on the variable idle-frame " +
        "delta is real elapsed wall-clock time in each process and never converges, so pass kind:\"physics\". " +
        "(2) The global RNG must be consumed ONLY on frames you are stepping. runtime_seed_rng seeds one stream shared " +
        "by the whole project, and freezing does NOT stop it being drawn — time_scale 0 zeroes delta but callbacks " +
        "still fire, so unconditional draws burn the stream at wall-clock rate while frozen, and idle-frame draws burn " +
        "it during the step. Guard draws on delta > 0 and give idle-frame code its own RandomNumberGenerator; " +
        "otherwise even fixed-timestep physics state diverges. (3) Peers free-run between spawn and freeze for " +
        "different durations, so their state already differs before you begin: freeze first, then equalise with " +
        "runtime_set_property{peer}. (4) Same machine only — peers share one OS and one engine build, and this claims " +
        "nothing about convergence across machines.",
      inputSchema: {
        root: z.string().describe("Root node path to digest in each peer (same path on every peer)"),
        peers: z
          .array(z.string())
          .optional()
          .describe("Peer ids to compare (default: every live peer; at least two are required)"),
        fields: z
          .array(z.string())
          .optional()
          .describe("Property names to capture per node (default: the runtime_state_digest defaults)"),
        max_depth: z.number().int().nonnegative().optional().describe("Max recursion depth (default 8)"),
      },
    },
    async ({ root, peers: ids, fields, max_depth }) => {
      const targets = ids ?? peers.live().map((p) => p.id);
      if (targets.length < 2) {
        return {
          isError: true as const,
          content: [
            {
              type: "text" as const,
              text:
                `Convergence needs at least two peers; got ${targets.length}. ` +
                `Spawn more with runtime_spawn_peers, or use runtime_state_digest for a single target.`,
            },
          ],
        };
      }
      const params = {
        root,
        ...(fields !== undefined ? { fields } : {}),
        ...(max_depth !== undefined ? { max_depth } : {}),
      };
      let results: Array<{ id: string; digest: Record<string, unknown>; node_count: number }>;
      try {
        results = await Promise.all(
          targets.map(async (id) => {
            const r = (await peers.clientFor(id).request("runtime.state_digest", params)) as {
              digest?: Record<string, unknown>;
              node_count?: number;
            };
            return { id, digest: r?.digest ?? {}, node_count: r?.node_count ?? 0 };
          }),
        );
      } catch (err) {
        return fail(err);
      }

      const paths = new Set<string>();
      for (const r of results) for (const k of Object.keys(r.digest)) paths.add(k);
      const first = results[0];
      const divergedAt = [...paths]
        .filter((path) => {
          const ref = canonical(first.digest[path]);
          return results.some((r) => canonical(r.digest[path]) !== ref);
        })
        .sort();

      return ok({
        digests: results,
        converged: divergedAt.length === 0,
        diverged_at: divergedAt.length ? divergedAt : null,
      });
    },
  );
}

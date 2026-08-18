import { pathToFileURL } from "node:url";
import { parsePrivilegedGroups } from "./capabilities.js";
import { log } from "./logger.js";

/**
 * Runtime configuration, all overridable via environment variables so the same
 * binary works across projects and machines without code changes.
 */
export interface Config {
  /** Path to the Godot editor binary (e.g. "godot", or an absolute path). */
  godotBin: string;
  /** Absolute path to the Godot project directory (contains project.godot). */
  projectPath: string;
  /** `file://` URI of the project root (for the LSP workspace). */
  projectUri: string;
  /** Editor bridge (addon) host/port + per-request timeout. */
  bridgeHost: string;
  bridgePort: number;
  bridgeTimeoutMs: number;
  /** GDScript language server (LSP) host/port + timeout. */
  lspHost: string;
  lspPort: number;
  lspTimeoutMs: number;
  /**
   * C#/.NET semantic plane (D4 C2). The C# language server (OmniSharp) is SPAWNED
   * by the host over stdio — unlike Godot's TCP LSP — so it's a command + args +
   * a working directory (the C# project root) rather than a host/port. All
   * env-overridable; the server is launched lazily on the first cs_* tool call,
   * so a host without OmniSharp installed pays nothing.
   */
  csLspCmd: string;
  csLspArgs: string[];
  csLspProjectPath: string;
  csLspProjectUri: string;
  csLspTimeoutMs: number;
  /** Debug Adapter (DAP) host/port + timeout. */
  dapHost: string;
  dapPort: number;
  dapTimeoutMs: number;
  /**
   * Shorter bounded deadlines for the setVariable / evaluate DAP requests. These are
   * control requests a compliant adapter answers near-instantly, but Godot 4.3 advertises
   * `supportsSetVariable=true` and then never answers `setVariable` — without a bound the
   * tool would hang the full `dapTimeoutMs` (20 s). Kept separate + env-overridable so
   * tests can drive them to a few hundred ms.
   */
  dapSetVarTimeoutMs: number;
  dapEvaluateTimeoutMs: number;
  /**
   * Refuse a debug session whose adapter answered `initialize` and never emitted
   * `initialized`. Default **true**, on both DAP planes, since 268.
   *
   * 🔴 **THE DEFAULT IS THE DECISION HE MADE, AND 267 WROTE DOWN THE OTHER ONE.** Before
   * 267 the handshake awaited a `Promise<void>` that resolved on its own timer, so *the
   * adapter said it was ready* and *five seconds passed* reached the caller as the same
   * value and `setBreakpoints` went out ahead of the event the DAP specification says
   * must precede it — silently, on every launch, for as long as these clients have
   * existed. 267 made the outcome observable and REPORTED it, deliberately taking the
   * least destructive option because refusing outright breaks any adapter in the field
   * that is merely slow. 268 takes the refusal, and pays that objection rather than
   * accepting it: the wait is no longer capped at five seconds. It runs to the caller's
   * OWN declared `dapTimeoutMs`, so a slow-but-conformant adapter now succeeds where it
   * previously proceeded out of order, and only an adapter that never announces itself
   * at all is refused.
   *
   * Setting `GODOT_DAP_REQUIRE_INITIALIZED=0` restores 267's behaviour EXACTLY —
   * five-second ceiling, `initialized_seen: false`, a warning, and the session continues.
   */
  dapRequireInitialized: boolean;
  /**
   * C#/.NET debugging plane (D4 C3). The .NET debug adapter (netcoredbg, MIT) is
   * SPAWNED by the host over stdio — like OmniSharp, and unlike Godot's TCP DAP —
   * so it's a command + args + a working directory rather than a host/port. It is
   * launched lazily on the first cs_dbg_* call, so a host without netcoredbg
   * installed pays nothing. `csDapProgram` is the program cs_dbg_launch launches
   * by default (the Mono/.NET Godot binary). The setVariable / evaluate deadlines
   * mirror the DAP F1 discipline: a short bound so a non-answering adapter fails
   * fast instead of hanging the full timeout. All env-overridable.
   */
  csDapCmd: string;
  csDapArgs: string[];
  csDapProgram: string;
  csDapProjectPath: string;
  csDapTimeoutMs: number;
  csDapSetVarTimeoutMs: number;
  csDapEvaluateTimeoutMs: number;
  /** Runtime bridge (in-game autoload) host/port + timeout. */
  runtimeHost: string;
  runtimePort: number;
  runtimeTimeoutMs: number;
  /**
   * Group J — AI asset generation backend selection (the feature "flag").
   * `assetGenBackend` is one of "none" | "placeholder" | "command":
   *   - "none"        : OFF by default. The asset_gen_* tools degrade to a clear
   *                     "no generation backend configured" and return a request
   *                     spec the connected multimodal client can fulfil — the MCP
   *                     server never calls a model itself.
   *   - "placeholder" : deterministic, in-engine procedural stand-ins (no model).
   *   - "command"     : delegate to a configured local backend. `assetGenCommand`
   *                     is an argv TEMPLATE whose tokens {kind} {prompt} {output}
   *                     {width} {height} {format} are substituted per-argument (no
   *                     shell), and the command is responsible for writing the file
   *                     to {output}. Same bring-your-own-tool trust model as the
   *                     C# OmniSharp / netcoredbg commands above.
   * All are session-overridable at runtime via the asset_gen_configure tool.
   */
  assetGenBackend: string;
  assetGenCommand: string;
  assetGenProvider: string;
  assetGenTimeoutMs: number;
  /**
   * Plane/group toolset selection (BREAKPOINT_TOOLSETS). `null` = the full
   * surface (default, backward-compatible). A non-empty list enables only the
   * named register-groups — e.g. `runtime`, `editor`, `lsp` — or the plane
   * aliases `a`/`b`/`c`/`d` (and `csharp`, `semantic`, `all`). Lets a client
   * that can't defer tools, or a user who wants a smaller default menu, load
   * only the planes a project needs. See `selectToolsets`.
   */
  toolsets: string[] | null;
  /**
   * Capability-group selection (BREAKPOINT_PRIVILEGED_GROUPS). `null`/empty =
   * no privileged groups (the safe default: `code-execution` and `network`
   * tools are dropped at registration). A non-empty list enables the named
   * groups — `code-execution`, `network`, or `all`. A second, risk-based axis
   * that cuts across the toolset partition. See `selectPrivilegedGroups`.
   */
  privilegedGroups: string[] | null;
}

/**
 * A TCP port from the environment, falling back to `fallback` when the variable
 * is absent, empty, non-numeric or out of range.
 *
 * `?? "9081"` alone does not cover this: an env var set to `""` or `"nope"`
 * reaches `Number.parseInt` and yields `NaN`, which then propagates into every
 * dial and bind as a port nothing can use. The addon has guarded this since it
 * shipped — `runtime_bridge.gd:75` requires `is_valid_int()` before overriding
 * and otherwise keeps the default — and the host simply never matched it. The
 * mismatch was harmless while a bad port merely failed to connect; it stopped
 * being harmless once `godot_run_managed` began *refusing* on an unbindable
 * port, which would have read as "127.0.0.1:NaN is already bound".
 */
function port(raw: string | undefined, fallback: number): number {
  // Deliberately NOT Number.parseInt on its own: it stops at the first
  // non-digit, so "80a80" parses to 80. The host would then dial port 80 while
  // the addon — whose `is_valid_int()` rejects the whole string — bound the
  // default, which is precisely the host/addon disagreement this guard exists
  // to prevent. The pattern mirrors GDScript's `is_valid_int()`.
  const t = (raw ?? "").trim();
  if (!/^[+-]?\d+$/.test(t)) return fallback;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 && n <= 65535 ? n : fallback;
}

/**
 * The floor below which a deadline on a FRAME-POLLED bridge is premature *by
 * construction* rather than by luck.
 *
 * Both addons — `bridge_server.gd` and `runtime_bridge.gd` — poll their socket
 * from `_process` and dispatch synchronously, so they cannot answer faster than
 * one frame no matter how trivial the request. Any deadline shorter than a frame
 * period is guaranteed to fire before a reply is possible. The editor throttles
 * its main loop when idle or unfocused, so "one frame" is not the 16 ms a running
 * game would suggest; 250 ms is a frame at any plausible editor framerate, with
 * headroom.
 *
 * Below the floor we FALL BACK to the default rather than clamp up to it,
 * matching how `positiveInt` already treats `0` and negatives. A silently
 * adjusted config value is its own small dishonesty: the operator asked for
 * something unusable, and the honest answer is the documented default, said out
 * loud.
 *
 * **This applies to the two bridge deadlines ONLY, and that boundary is the
 * whole point.** LSP, DAP and the asset-gen backend are ordinary
 * request/response over TCP or stdio — nothing frame-polls them, and they answer
 * in microseconds. A 200 ms DAP deadline is a perfectly reasonable "fail fast",
 * not a broken one; `csdap.test.ts:301` sets exactly that and is right to. The
 * justification for this floor is the frame poll, so its scope is the frame poll.
 *
 * **And it does not replace late-reply reconciliation in `bridge.ts`, nor can
 * it.** A *legitimate* 15000 ms deadline fails identically the moment a frame
 * outlasts it, which `bridge_server.gd:96` documents happening on a `scene.save`
 * that triggers a rescan/reimport. The floor removes the configured cause; the
 * ledger catches the consequence whatever the cause.
 */
export const MIN_TIMEOUT_MS = 250;

/**
 * A deadline for a frame-polled bridge: `positiveInt`, then the floor.
 * Used for `bridgeTimeoutMs` and `runtimeTimeoutMs` — the two values that reach
 * a `BridgeClient` — and deliberately not for anything else.
 */
function bridgeDeadlineMs(raw: string | undefined, fallback: number): number {
  const n = positiveInt(raw, fallback);
  if (n >= MIN_TIMEOUT_MS) return n;
  log(
    `ignoring a ${n}ms bridge timeout: below the ${MIN_TIMEOUT_MS}ms floor, where the addon cannot answer ` +
      `within one frame no matter what it is doing. Using the ${fallback}ms default instead.`,
  );
  return fallback;
}

/**
 * A millisecond deadline from the environment, falling back to `fallback` when
 * the variable is absent, empty, non-numeric, or not a usable positive integer.
 *
 * This is `port()`'s sibling, and it exists because the two were split for
 * eleven releases. `port()` was hardened the moment a bad port began *refusing*
 * a launch; every timeout kept the `Number.parseInt(x ?? "15000", 10)` pattern
 * the docstring above condemns. `??` catches only null/undefined, so an
 * exported-but-empty `GODOT_LSP_TIMEOUT_MS=""` — the same shape that motivated
 * `port()` — reached `parseInt` and yielded `NaN`.
 *
 * **`setTimeout(cb, NaN)` does not throw. It fires on the next tick**,
 * measurably sooner than `setTimeout(cb, 1)`, with no Node warning
 * (`TimeoutOverflowWarning` covers only `> 2^31-1`). So the failure is worse
 * than an unusable port, because by then the request is already on the wire:
 * the addon polls its socket from `_process`, once per frame, and cannot answer
 * inside ~1 ms. The deadline wins *deterministically*, the host reports
 * `timed out after NaNms`, the addon still **executes** the mutation, and the
 * real reply is dropped as an unknown id. An agent that retries a reported
 * failure applies it twice.
 *
 * `parseInt` alone is not the fix here either, for the same reason it was not
 * the fix for ports: it stops at the first non-digit, so a plausible `"15s"`
 * silently becomes 15 ms and `"20_000"` becomes 20.
 */
function positiveInt(raw: string | undefined, fallback: number): number {
  // Same shape as port(), mirroring GDScript's `is_valid_int()`: reject the
  // whole string rather than accept a numeric prefix.
  //
  // Zero and negatives are rejected rather than clamped — a deadline of 0 is
  // not a shorter deadline, it is the NaN failure with a different spelling.
  // The upper bound is setTimeout's own: past 2^31-1 Node warns and silently
  // uses 1 ms, so a fat-fingered BREAKPOINT_ASSETGEN_TIMEOUT_MS would land back
  // in the near-zero failure this guard exists to prevent.
  const t = (raw ?? "").trim();
  if (!/^\+?\d+$/.test(t)) return fallback;
  const n = Number(t);
  return Number.isSafeInteger(n) && n > 0 && n <= 2_147_483_647 ? n : fallback;
}

/**
 * An opt-OUT flag: true unless the operator spelled a recognised falsehood.
 *
 * 🔴 THE UNRECOGNISED VALUE KEEPS THE SAFE DEFAULT, AND THAT IS THE OPPOSITE OF
 * `positiveInt`'s reasoning ON PURPOSE. A malformed deadline falls back because both
 * outcomes are ordinary; a malformed *guard* setting must not disable the guard, or a
 * typo — `GODOT_DAP_REQUIRE_INITIALIZED=no thanks` — turns a refusal off silently. Only
 * `0`, `false`, `off` and `no` are read as intent, case-insensitively.
 */
function optOut(raw: string | undefined): boolean {
  return !/^(0|false|off|no)$/i.test((raw ?? "").trim());
}

export function loadConfig(): Config {
  const projectPath = process.env.GODOT_PROJECT ?? process.cwd();
  // The C# project defaults to the main project, but is usually pointed at a
  // dedicated C# project (e.g. the example-csharp fixture) via GODOT_CSHARP_PROJECT.
  const csLspProjectPath = process.env.GODOT_CSHARP_PROJECT ?? projectPath;
  return {
    godotBin: process.env.GODOT_BIN ?? "godot",
    projectPath,
    projectUri: pathToFileURL(projectPath).href,
    bridgeHost: process.env.BREAKPOINT_BRIDGE_HOST ?? "127.0.0.1",
    bridgePort: port(process.env.BREAKPOINT_BRIDGE_PORT, 9080),
    bridgeTimeoutMs: bridgeDeadlineMs(process.env.BREAKPOINT_BRIDGE_TIMEOUT_MS, 15000),
    lspHost: process.env.GODOT_LSP_HOST ?? "127.0.0.1",
    lspPort: port(process.env.GODOT_LSP_PORT, 6005),
    lspTimeoutMs: positiveInt(process.env.GODOT_LSP_TIMEOUT_MS, 15000),
    csLspCmd: process.env.GODOT_CSLSP_CMD ?? "OmniSharp",
    csLspArgs: (process.env.GODOT_CSLSP_ARGS ?? "-lsp").split(/\s+/).filter(Boolean),
    csLspProjectPath,
    csLspProjectUri: pathToFileURL(csLspProjectPath).href,
    csLspTimeoutMs: positiveInt(process.env.GODOT_CSLSP_TIMEOUT_MS, 30000),
    dapHost: process.env.GODOT_DAP_HOST ?? "127.0.0.1",
    dapPort: port(process.env.GODOT_DAP_PORT, 6006),
    dapTimeoutMs: positiveInt(process.env.GODOT_DAP_TIMEOUT_MS, 20000),
    dapSetVarTimeoutMs: positiveInt(process.env.GODOT_DAP_SETVAR_TIMEOUT_MS, 8000),
    dapEvaluateTimeoutMs: positiveInt(process.env.GODOT_DAP_EVALUATE_TIMEOUT_MS, 8000),
    dapRequireInitialized: optOut(process.env.GODOT_DAP_REQUIRE_INITIALIZED),
    csDapCmd: process.env.GODOT_CSDAP_CMD ?? "netcoredbg",
    csDapArgs: (process.env.GODOT_CSDAP_ARGS ?? "--interpreter=vscode").split(/\s+/).filter(Boolean),
    // The default program cs_dbg_launch launches is the Mono/.NET Godot binary. GODOT_CSHARP_BIN
    // overrides it; it otherwise falls back to GODOT_BIN (the standard editor binary), which the
    // caller can also override per-call via cs_dbg_launch's `program` arg.
    csDapProgram: process.env.GODOT_CSHARP_BIN ?? process.env.GODOT_BIN ?? "godot",
    csDapProjectPath: csLspProjectPath,
    csDapTimeoutMs: positiveInt(process.env.GODOT_CSDAP_TIMEOUT_MS, 20000),
    csDapSetVarTimeoutMs: positiveInt(process.env.GODOT_CSDAP_SETVAR_TIMEOUT_MS, 8000),
    csDapEvaluateTimeoutMs: positiveInt(process.env.GODOT_CSDAP_EVALUATE_TIMEOUT_MS, 8000),
    runtimeHost: process.env.BREAKPOINT_RUNTIME_HOST ?? "127.0.0.1",
    runtimePort: port(process.env.BREAKPOINT_RUNTIME_PORT, 9081),
    runtimeTimeoutMs: bridgeDeadlineMs(process.env.BREAKPOINT_RUNTIME_TIMEOUT_MS, 15000),
    // Group J: asset generation is OFF by default (backend "none" → tools degrade).
    assetGenBackend: process.env.BREAKPOINT_ASSETGEN_BACKEND ?? "none",
    assetGenCommand: process.env.BREAKPOINT_ASSETGEN_CMD ?? "",
    assetGenProvider: process.env.BREAKPOINT_ASSETGEN_PROVIDER ?? "",
    assetGenTimeoutMs: positiveInt(process.env.BREAKPOINT_ASSETGEN_TIMEOUT_MS, 120000),
    toolsets: parseToolsets(process.env.BREAKPOINT_TOOLSETS),
    privilegedGroups: parsePrivilegedGroups(process.env.BREAKPOINT_PRIVILEGED_GROUPS),
  };
}

/** Parse the raw BREAKPOINT_TOOLSETS env into a normalized token list (or null
 *  for "unset" → full surface). Comma/whitespace separated, lower-cased. */
export function parseToolsets(raw: string | undefined): string[] | null {
  if (raw == null) return null;
  const toks = raw
    .split(/[,\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return toks.length ? toks : null;
}

/**
 * Plane/convenience aliases → concrete toolset ids. Kept here (not in
 * `toolsets.ts`) so selection has no dependency on the register* functions and
 * stays trivially unit-testable.
 */
export const TOOLSET_ALIASES: Record<string, string[]> = {
  a: ["editor"],
  b: ["cli"],
  c: ["runtime"],
  d: ["lsp", "cslsp", "dap", "csdap"],
  csharp: ["cslsp", "csdap"],
  semantic: ["lsp", "cslsp", "dap", "csdap"],
};

/**
 * Resolve a requested toolset list against the known ids.
 *  - `requested == null`  → every id (the default full surface).
 *  - aliases expand to their ids; unknown tokens are dropped (reported via
 *    `onUnknown`, so `index.ts` can warn without this being impure).
 *  - if nothing valid resolves, fall back to the full surface (a misconfigured
 *    filter must never silently yield an empty, useless server).
 * Returns a Set preserving membership only; the caller iterates the ordered
 * toolset list, so registration order is unaffected.
 */
export function selectToolsets(
  allIds: readonly string[],
  requested: string[] | null,
  onUnknown?: (tokens: string[]) => void,
): Set<string> {
  const known = new Set(allIds);
  if (requested == null) return new Set(allIds);
  const out = new Set<string>();
  const unknown: string[] = [];
  for (const tok of requested) {
    if (tok === "all") {
      for (const id of allIds) out.add(id);
    } else if (TOOLSET_ALIASES[tok]) {
      for (const id of TOOLSET_ALIASES[tok]) if (known.has(id)) out.add(id);
    } else if (known.has(tok)) {
      out.add(tok);
    } else {
      unknown.push(tok);
    }
  }
  if (unknown.length && onUnknown) onUnknown(unknown);
  return out.size ? out : new Set(allIds);
}

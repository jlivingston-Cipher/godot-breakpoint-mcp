/**
 * `breakpoint-mcp doctor` — a verifiable health check for a Breakpoint MCP
 * install, the CLI-side analogue of the planned in-editor status dock.
 *
 * It reports, for the configured project + environment:
 *   - the Godot binary (GODOT_BIN) runs and its version               [required]
 *   - the editor addon is installed + enabled in project.godot        [required, if a project is present]
 *   - the four bridges are reachable: editor 9080, runtime 9081,
 *     GDScript LSP 6005, GDScript DAP 6006                             [info; --require-live promotes to required]
 *   - optionally, OmniSharp / netcoredbg are on PATH (C# planes)       [info; --include-csharp]
 *
 * The exit code is 0 iff no *required* check failed, so `doctor` doubles as a
 * pre-flight gate. Bridges default to informational because the editor/game
 * may legitimately not be running when a user checks their install; pass
 * `--require-live` when you expect them up (e.g. after opening the editor).
 *
 * 🔴 THE FOUR BRIDGES DO NOT COME UP TOGETHER, AND `--require-live` USED TO
 * PRETEND THEY DID. Opening the editor starts three of them — the addon's
 * bridge on 9080 and Godot's own LSP/DAP. The runtime bridge on 9081 lives
 * INSIDE THE GAME and binds only while the project is running. So the one
 * instruction `docs/USER_GUIDE.md` §3.0, `README.md` and `init`'s own closing
 * line all give a new user — open the editor, then run `doctor --require-live`
 * — exited 1 on a completely correct install, every time, because it demanded a
 * game nobody had been told to launch. `LIVE_LEVELS` is that distinction made
 * nameable: bare `--require-live` asserts what opening the editor makes true,
 * and `--require-live=all` is the old four-bridge contract, still reachable and
 * now something a caller asks for on purpose.
 *
 * Configuration is read via loadConfig(), so the same env overrides the server
 * honours (GODOT_BIN, GODOT_PROJECT, and the BREAKPOINT_ / GODOT_ ports) apply here.
 */
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadConfig, type Config } from "../config.js";
import { CAPABILITY_GROUPS, droppedTools, selectPrivilegedGroups } from "../capabilities.js";
import { parseArgs, preflight } from "./args.js";
import { DOCTOR_FLAGS, DOCTOR_USAGE } from "./usage.js";
import { BridgeClient } from "../bridge.js";
import { resolveBridgeSecret } from "../secret.js";
import {
  ADDON_REL,
  ADDON_SKEW_HINT,
  compareAddonVersions,
  readAddonVersion,
  type AddonSkew,
} from "../addon-version.js";
import { resolveBundledAddon } from "./init.js";

export type CheckStatus = "ok" | "fail" | "skip";

export interface Check {
  name: string;
  status: CheckStatus;
  severity: "required" | "info";
  detail: string;
  hint?: string;
  /**
   * 🆕 259 — is this check's failure a LIVENESS fact, cleared by opening the editor
   * or launching the game?
   *
   * 🔴 IT EXISTS BECAUSE THE SUMMARY LINE REPEATED ITS OWN ORIGINAL DEFECT ON A
   * POPULATION THAT HAD GROWN. That sentence was written when every informational
   * check was a bridge, so *that is expected when the editor or the game is not
   * running … re-run with --require-live* was true of all of them. `addon-version`
   * is an informational failure that opening the editor does NOT clear and
   * `--require-live` does not promote — so the moment it joined, the summary was
   * again saying one confident thing about a set that no longer agreed with it. The
   * fix is the same shape as the first: stop asserting one explanation over a
   * population, and let each member declare which explanation is its own.
   */
  liveness?: boolean;
}

export interface DoctorReport {
  checks: Check[];
  /** True when no required check failed. */
  ok: boolean;
}

/**
 * Which bridges a run insists on.
 *
 *   none    — every bridge is informational (the default: a user checking an
 *             install has neither the editor nor the game up, necessarily)
 *   editor  — the three the EDITOR brings up: editor bridge, GDScript LSP, DAP
 *   runtime — the one the GAME brings up: the runtime bridge on 9081
 *   all     — all four
 *
 * The order matters to nothing; the tier a bridge belongs to is declared on the
 * bridge, so adding a fifth is one field and no new branch.
 */
export const LIVE_LEVELS = ["none", "editor", "runtime", "all"] as const;
export type LiveLevel = (typeof LIVE_LEVELS)[number];

/** The two things that bring bridges up. A bridge names which one it needs. */
export type BridgeTier = "editor" | "runtime";

export function severityFor(level: LiveLevel, tier: BridgeTier): Check["severity"] {
  return level === "all" || level === tier ? "required" : "info";
}

export interface DoctorOptions {
  timeoutMs: number;
  liveLevel: LiveLevel;
  includeCsharp: boolean;
}

const PLUGIN_CFG_RES = "res://addons/breakpoint_mcp/plugin.cfg";

/** Resolve after a TCP connect succeeds (true) or the port is closed/times out (false). */
function probeTcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function readText(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/** Is the Breakpoint MCP plugin listed in project.godot's [editor_plugins] enabled array? */
export function isPluginEnabled(projectGodotText: string): boolean {
  const lines = projectGodotText.split(/\r?\n/);
  let inPlugins = false;
  for (const raw of lines) {
    const s = raw.trim();
    if (s.startsWith("[") && s.endsWith("]")) {
      inPlugins = s === "[editor_plugins]";
      continue;
    }
    if (inPlugins && s.startsWith("enabled") && s.includes(PLUGIN_CFG_RES)) return true;
  }
  return false;
}

function checkGodotBinary(bin: string, timeoutMs: number): Check {
  const res = spawnSync(bin, ["--version"], { timeout: timeoutMs, encoding: "utf8" });
  if (res.error) {
    const code = (res.error as NodeJS.ErrnoException).code ?? res.error.message;
    return {
      name: "godot-binary",
      status: "fail",
      severity: "required",
      detail: `'${bin}' is not runnable (${code})`,
      hint: "Install Godot 4.2+ and put it on PATH, or set GODOT_BIN to its absolute path.",
    };
  }
  const version = (res.stdout ?? "").trim().split(/\r?\n/)[0] || "(no version output)";
  return {
    name: "godot-binary",
    status: "ok",
    severity: "required",
    detail: `${bin} → ${version}`,
  };
}

/**
 * The pair nothing compared until 258 §2: the addon a project has INSTALLED
 * against the addon this host SHIPS.
 *
 * 🔴 WHY `info` AND NOT `required`, ON THE RECORD. `doctor`'s exit code is a
 * pre-flight contract, and 252 spent a whole row fixing `--require-live` for
 * exactly one reason: it exited 1 on a correct install. An addon a release or two
 * behind answers almost every method the host calls — an addon at 1.9.1 answers
 * 260 of the current 265 — so a red exit would be wrong for most of the population
 * that has one. The skew is REPORTED, loudly and with the command that clears it;
 * it does not fail the run. Promoting it is one word if that turns out to be the
 * wrong call.
 *
 * `newer` is not folded into `older`. An installed addon ahead of the host is a
 * developer running the repo copy against an older published host, and telling
 * that person to overwrite it with `--force` would destroy the newer one.
 */
function addonVersionCheck(installed: string | null): Check {
  const bundledDir = resolveBundledAddon();
  const bundled = bundledDir === null ? null : readAddonVersion(bundledDir);
  const skew: AddonSkew = compareAddonVersions(installed, bundled);
  const pair = `installed ${installed ?? "?"} · this host ships ${bundled ?? "?"}`;
  if (skew === "same") {
    return { name: "addon-version", status: "ok", severity: "info", detail: `matches this host (${installed})` };
  }
  if (skew === "unknown") {
    return {
      name: "addon-version",
      status: "skip",
      severity: "info",
      detail: `not comparable (${pair})`,
      hint: "Neither version parsed as a dotted number, so no direction can be reported without guessing at it.",
    };
  }
  if (skew === "newer") {
    return {
      name: "addon-version",
      status: "ok",
      severity: "info",
      detail: `ahead of this host (${pair})`,
      hint: "The project's addon is newer than the one bundled here. Upgrade the host ('npm i -g breakpoint-mcp@latest') rather than overwriting the addon.",
    };
  }
  return {
    name: "addon-version",
    status: "fail",
    severity: "info",
    detail: `older than this host (${pair})`,
    hint: ADDON_SKEW_HINT,
  };
}

function checkAddon(projectPath: string): Check[] {
  const projText = readText(path.join(projectPath, "project.godot"));
  if (projText === null) {
    return [
      {
        name: "project",
        status: "skip",
        severity: "info",
        detail: `no project.godot at ${projectPath}`,
        hint: "Pass --project <dir> pointing at your Godot project, or run from the project root.",
      },
    ];
  }

  const checks: Check[] = [];
  const cfgText = readText(path.join(projectPath, ADDON_REL, "plugin.cfg"));
  if (cfgText === null) {
    checks.push({
      name: "addon-installed",
      status: "fail",
      severity: "required",
      detail: `not found at ${ADDON_REL}/plugin.cfg`,
      hint: "Run 'breakpoint-mcp init' to install the editor addon into this project.",
    });
  } else {
    const installed = readAddonVersion(path.join(projectPath, ADDON_REL));
    checks.push({
      name: "addon-installed",
      status: "ok",
      severity: "required",
      detail: `${ADDON_REL} (version ${installed ?? "?"})`,
    });
    checks.push(addonVersionCheck(installed));
  }

  checks.push(
    isPluginEnabled(projText)
      ? {
          name: "addon-enabled",
          status: "ok",
          severity: "required",
          detail: "enabled in project.godot",
        }
      : {
          name: "addon-enabled",
          status: "fail",
          severity: "required",
          detail: "not listed under [editor_plugins] enabled",
          hint: "Enable 'Breakpoint MCP' under Project → Project Settings → Plugins (or run 'breakpoint-mcp init').",
        },
  );
  return checks;
}

/** Locate an executable on PATH without launching it (used for the C# info checks). */
function whichSync(cmd: string): string | null {
  if (path.isAbsolute(cmd)) {
    try {
      fs.accessSync(cmd, fs.constants.X_OK);
      return cmd;
    } catch {
      return null;
    }
  }
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const exts =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").map((e) => e.toLowerCase())
      : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const full = path.join(dir, cmd + ext);
      try {
        fs.accessSync(full, fs.constants.X_OK);
        return full;
      } catch {
        /* keep scanning */
      }
    }
  }
  return null;
}

function checkCsharpTool(name: string, cmd: string): Check {
  const found = whichSync(cmd);
  return found
    ? { name, status: "ok", severity: "info", detail: `${cmd} → ${found}` }
    : {
        name,
        status: "skip",
        severity: "info",
        detail: `${cmd} not on PATH (C# plane inactive until installed)`,
      };
}

/**
 * Report the capability-group state (`code-execution` / `network`), how many
 * higher-trust tools the current setting drops, and how to change it — plus a
 * signal hint when an asset-gen backend is configured but its group is off (so
 * the "why won't asset-gen run?" gap the drop model can create is surfaced, not
 * silent). Informational only — never a required failure.
 */
export function checkCapabilities(config: Config): Check[] {
  const enabled = selectPrivilegedGroups(config.privilegedGroups);
  const dropped = droppedTools(enabled);
  const state = CAPABILITY_GROUPS.map((g) => `${g} ${enabled.has(g) ? "on" : "off"}`).join(" · ");
  const checks: Check[] = [
    {
      name: "capability-groups",
      status: "ok",
      severity: "info",
      detail:
        dropped.length === 0
          ? `${state} — full 292-tool surface`
          : `${state} (secure default) — ${dropped.length} higher-trust tool(s) dropped from the surface`,
      // The token list is DERIVED — `code-execution,network` was printed here
      // for as long as the `network` group has been deleted, so the remedy
      // named a token `selectPrivilegedGroups` reports as unknown and drops.
      hint:
        dropped.length === 0
          ? undefined
          : `Enable with BREAKPOINT_PRIVILEGED_GROUPS=${CAPABILITY_GROUPS.join(",")} (or \`breakpoint-mcp init --trust full\`). See the godot://capabilities resource for the exact tool list.`,
    },
  ];
  const assetGenConfigured =
    (config.assetGenBackend && config.assetGenBackend !== "none") ||
    Boolean(config.assetGenCommand) ||
    Boolean(config.assetGenProvider);
  if (assetGenConfigured && !enabled.has("code-execution")) {
    checks.push({
      name: "capability-assetgen",
      status: "ok",
      severity: "info",
      detail: "asset-gen backend configured, but code-execution is off — the asset_gen_* tools are not loaded",
      hint: "Enable it: BREAKPOINT_PRIVILEGED_GROUPS=code-execution (the local command backend is the only privileged asset-gen path).",
    });
  }
  return checks;
}

/**
 * Prove the thing on the far end is OUR bridge, not merely a listening socket.
 *
 * Sends an authenticated `ping` with the same secret resolution index.ts uses,
 * so this fails exactly when a real call would: wrong process on the port, or a
 * secret that no longer matches the one the addon minted. `probeTcp` can see
 * neither, which is what made "editor-bridge reachable" a check that could pass
 * while every tool failed.
 *
 * 🔴 AND IT NOW KEEPS THE ANSWER. `ping` has replied with `addon_version` since the
 * addon had one, and all four of its consumers threw it away — this one returned
 * `boolean`, `readiness.ts` returns `boolean`, and the two tool paths hand it to the
 * model and forget it. That is the third of 258 §2's four compounding parts: the
 * version of the addon ACTUALLY LOADED never reached anything that could compare it.
 * Files on disk are not what is running — Godot reads the addon at project load, so
 * `init --force` fixes the disk and changes nothing until the editor restarts, and
 * that gap is exactly where a user concludes the fix did not work.
 */
async function handshakeOk(
  config: Config,
  b: { host: string; port: number; secretEnv?: string[] },
  timeoutMs: number,
): Promise<{ ok: boolean; addonVersion: string | null }> {
  const client = new BridgeClient(b.host, b.port, timeoutMs, "bridge", undefined, () =>
    resolveBridgeSecret(config.projectPath, b.secretEnv ?? []),
  );
  try {
    const reply = (await client.request("ping", {}, timeoutMs)) as { addon_version?: unknown };
    const v = reply?.addon_version;
    return { ok: true, addonVersion: typeof v === "string" && v !== "" ? v : null };
  } catch {
    return { ok: false, addonVersion: null };
  } finally {
    client.close();
  }
}

/**
 * The live half of the pair: the addon a bridge REPORTS against the one this host
 * ships. Emitted only when a bridge actually answered with a version, so a closed
 * editor produces no row rather than a row about nothing.
 */
export function addonRunningCheck(bridge: string, running: string | null, bundled: string | null): Check | null {
  if (running === null) return null;
  // One row per answering bridge, named after it: a stale editor and a stale game are
  // two different states with two different next actions — reopen the project, versus
  // relaunch it — and collapsing them into one `addon-running` row would report
  // whichever process happened to be asked first.
  const name = `addon-running-${bridge.replace(/-bridge$/, "")}`;
  const skew = compareAddonVersions(running, bundled);
  const pair = `${bridge} reports ${running} · this host ships ${bundled ?? "?"}`;
  if (skew === "older") {
    return {
      name,
      status: "fail",
      severity: "info",
      detail: `older than this host (${pair})`,
      hint: ADDON_SKEW_HINT,
    };
  }
  return {
    name,
    status: "ok",
    severity: "info",
    detail: skew === "same" ? `matches this host (${running}, live on ${bridge})` : `(${pair})`,
  };
}

export async function runDoctorChecks(config: Config, opts: DoctorOptions): Promise<DoctorReport> {
  const checks: Check[] = [];

  // Capability groups — the secure-default surface + how to widen it (info only).
  checks.push(...checkCapabilities(config));

  // Godot binary (give the version probe a floor so a slow cold start isn't a false negative).
  checks.push(checkGodotBinary(config.godotBin, Math.max(opts.timeoutMs, 3000)));

  // Editor addon install + enable.
  checks.push(...checkAddon(config.projectPath));

  // The four bridges.
  // `secretEnv` marks the two bridges that speak OUR protocol, so a TCP connect
  // is not the end of the story for them (see handshakeOk). The LSP and DAP
  // entries have none: those ports belong to Godot, and anything we could send
  // to prove liveness would be us implementing a foreign protocol inside doctor.
  //
  // `tier` is what the bridge NEEDS RUNNING, not what it talks to — the one
  // fact `--require-live` was missing.
  const bridges: Array<{
    name: string;
    tier: BridgeTier;
    host: string;
    port: number;
    hint: string;
    secretEnv?: string[];
  }> = [
    {
      name: "editor-bridge",
      tier: "editor",
      host: config.bridgeHost,
      port: config.bridgePort,
      hint: 'Open the editor with the "Breakpoint MCP" plugin enabled — and if it was already open when you ran `breakpoint-mcp init`, close and reopen the project (Godot reads the enabled-plugin list only at project load).',
      secretEnv: ["BREAKPOINT_BRIDGE_SECRET"],
    },
    {
      name: "runtime-bridge",
      tier: "runtime",
      host: config.runtimeHost,
      port: config.runtimePort,
      hint: "Launch the project (godot_run_project / dbg_launch) with the plugin enabled — it auto-registers the runtime autoload.",
      secretEnv: ["BREAKPOINT_RUNTIME_SECRET", "BREAKPOINT_BRIDGE_SECRET"],
    },
    {
      name: "gdscript-lsp",
      tier: "editor",
      host: config.lspHost,
      port: config.lspPort,
      hint: "Godot's language server runs while the editor is open (Editor → Editor Settings → Network → Language Server).",
    },
    {
      name: "gdscript-dap",
      tier: "editor",
      host: config.dapHost,
      port: config.dapPort,
      hint: "Godot's debug adapter runs while the editor is open (Editor → Editor Settings → Network → Debug Adapter).",
    },
  ];
  // Filled by the handshakes below, read once after them: which bridge reported which
  // addon version. A map and not a single variable because both the editor and the
  // runtime plane answer `ping` with one, and they are two different processes that
  // can legitimately disagree — the editor holds the addon it loaded at project open,
  // the game holds the one on disk when it launched.
  const liveAddonVersions = new Map<string, string>();
  const bridgeChecks = await Promise.all(
    bridges.map(async (b): Promise<Check> => {
      const severity = severityFor(opts.liveLevel, b.tier);
      const liveness = true;                     // every row in this map is one
      const ok = await probeTcp(b.host, b.port, opts.timeoutMs);
      if (!ok) {
        return {
          name: b.name,
          status: "fail",
          severity,
          liveness,
          detail: `${b.host}:${b.port} unreachable`,
          hint: b.hint,
        };
      }
      // An open port is not a working bridge. A TCP connect succeeds for ANY
      // process holding it, and never touches the shared secret — so the two
      // failures that look most like success stayed invisible: a foreign
      // process on 9080, and a stale secret (the addon regenerates it into
      // res://.godot/, so a copied or long-lived config goes quietly wrong).
      // Both then reported "reachable" here and failed on every real call.
      if (b.secretEnv) {
        const live = await handshakeOk(config, b, opts.timeoutMs);
        if (live.addonVersion !== null) liveAddonVersions.set(b.name, live.addonVersion);
        if (!live.ok) {
          return {
            name: b.name,
            status: "fail",
            severity,
            liveness,
            detail: `${b.host}:${b.port} open, but no Breakpoint bridge answered`,
            hint: "Something holds that port without speaking the bridge protocol, or the shared secret is stale. Close other Godot instances, or delete res://.godot/breakpoint_mcp.secret and reopen the editor to remint it.",
          };
        }
      }
      return {
        name: b.name,
        status: "ok",
        severity,
        liveness,
        detail: `${b.host}:${b.port} reachable${b.secretEnv ? " · bridge answered" : ""}`,
      };
    }),
  );
  checks.push(...bridgeChecks);

  // The running half of the pair, one row per bridge that answered.
  const bundledDir = resolveBundledAddon();
  const bundledVersion = bundledDir === null ? null : readAddonVersion(bundledDir);
  for (const [bridge, running] of liveAddonVersions) {
    const c = addonRunningCheck(bridge, running, bundledVersion);
    if (c) checks.push(c);
  }

  // Optional C# tooling.
  if (opts.includeCsharp) {
    checks.push(checkCsharpTool("csharp-lsp", config.csLspCmd));
    checks.push(checkCsharpTool("csharp-dap", config.csDapCmd));
  }

  const ok = checks.every((c) => c.severity !== "required" || c.status !== "fail");
  return { checks, ok };
}

/**
 * 🔴 `✗` IS RESERVED FOR A CHECK THAT FAILED THE RUN. An informational check
 * that did not pass gets `!`, because the alternative was the contradiction this
 * function used to print: four `✗` glyphs, and then `All required checks
 * passed.` Both halves were true and defensible on their own — the bridges were
 * genuinely down, and no REQUIRED check had genuinely failed — and a tool whose
 * whole job is telling a user whether they are okay cannot say those two things
 * in one breath and leave them to work out which one is the answer.
 */
function glyph(c: Check): string {
  if (c.status === "ok") return "✓";
  if (c.status === "skip") return "–";
  return c.severity === "required" ? "✗" : "!";
}

/**
 * The last line, which is the only line many readers read. It says what failed
 * AND what that means for the exit code, because those are two facts and the
 * summary that named only one of them was the defect.
 */
export function summaryLine(report: DoctorReport): string {
  const failed = report.checks.filter((c) => c.status === "fail");
  const noted = failed.filter((c) => c.severity === "info");
  if (!report.ok) return "Some required checks failed — see the ↳ hints above.";
  if (noted.length === 0) return "All checks passed.";
  const names = noted.map((c) => c.name).join(", ");
  const head = `All required checks passed. ${noted.length} informational check(s) did not — ${names} (marked !, not counted against the exit code).`;
  const live = noted.filter((c) => c.liveness);
  const standing = noted.filter((c) => !c.liveness);
  // Only the liveness rows get the "expected when nothing is running" sentence, and
  // only the standing rows get "this will not clear on its own". Saying either of
  // those about the whole set is how the line contradicted the glyphs the first time.
  const parts = [head];
  if (live.length) {
    parts.push(
      `${live.map((c) => c.name).join(", ")} ${live.length === 1 ? "is" : "are"} expected when the editor ` +
        `or the game is not running; re-run with --require-live once the project is open in Godot.`,
    );
  }
  if (standing.length) {
    parts.push(
      `${standing.map((c) => c.name).join(", ")} will NOT clear by starting anything — see the ↳ hint${standing.length === 1 ? "" : "s"} above.`,
    );
  }
  return parts.join(" ");
}

function printReport(report: DoctorReport): void {
  const width = Math.max(...report.checks.map((c) => c.name.length));
  const out: string[] = ["breakpoint-mcp doctor", ""];
  for (const c of report.checks) {
    out.push(`  ${glyph(c)} ${c.name.padEnd(width)}  ${c.detail}`);
    if (c.status === "fail" && c.hint) out.push(`      ↳ ${c.hint}`);
  }
  out.push("");
  out.push(summaryLine(report));
  process.stdout.write(out.join("\n") + "\n");
}

/**
 * Read `--require-live` in both its forms. Bare (`true`) is `editor`; a value is
 * taken literally. An unrecognised value is an ERROR, never a silent default —
 * `--require-live=yes` quietly meaning "editor" would be a flag that agrees with
 * whatever you typed and asserts something else.
 */
export function parseLiveLevel(raw: string | boolean | undefined): LiveLevel | { error: string } {
  if (raw === undefined || raw === false) return "none";
  if (raw === true) return "editor";
  const v = raw.trim().toLowerCase();
  if ((LIVE_LEVELS as readonly string[]).includes(v) && v !== "none") return v as LiveLevel;
  return {
    error:
      `doctor: --require-live=${raw} is not a level. Use --require-live (the editor's three bridges), ` +
      `--require-live=runtime (the game's), or --require-live=all.`,
  };
}

/** Entry point for `breakpoint-mcp doctor`. Returns the process exit code. */
export async function runDoctor(argv: string[]): Promise<number> {
  const parsed = parseArgs(
    argv,
    ["json", "require-live", "include-csharp", "help", "h"],
    DOCTOR_FLAGS,
  );
  const pre = preflight(parsed, "doctor", DOCTOR_USAGE);
  if (pre !== null) return pre;
  const { flags } = parsed;

  if (typeof flags.project === "string") process.env.GODOT_PROJECT = flags.project;
  const timeoutRaw = typeof flags.timeout === "string" ? Number.parseInt(flags.timeout, 10) : NaN;
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 1500;

  const liveLevel = parseLiveLevel(flags["require-live"]);
  if (typeof liveLevel !== "string") {
    process.stderr.write(liveLevel.error + "\n");
    return 2;
  }

  const config = loadConfig();
  const report = await runDoctorChecks(config, {
    timeoutMs,
    liveLevel,
    includeCsharp: flags["include-csharp"] === true,
  });

  if (flags.json === true) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    printReport(report);
  }
  return report.ok ? 0 : 1;
}

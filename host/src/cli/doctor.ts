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

export type CheckStatus = "ok" | "fail" | "skip";

export interface Check {
  name: string;
  status: CheckStatus;
  severity: "required" | "info";
  detail: string;
  hint?: string;
}

export interface DoctorReport {
  checks: Check[];
  /** True when no required check failed. */
  ok: boolean;
}

export interface DoctorOptions {
  timeoutMs: number;
  requireLive: boolean;
  includeCsharp: boolean;
}

const ADDON_REL = "addons/breakpoint_mcp";
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
    const m = /version\s*=\s*"([^"]*)"/.exec(cfgText);
    checks.push({
      name: "addon-installed",
      status: "ok",
      severity: "required",
      detail: `${ADDON_REL} (version ${m ? m[1] : "?"})`,
    });
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
      hint:
        dropped.length === 0
          ? undefined
          : "Enable with BREAKPOINT_PRIVILEGED_GROUPS=code-execution,network (or `breakpoint-mcp init --trust full`). See the godot://capabilities resource for the exact tool list.",
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
 */
async function handshakeOk(
  config: Config,
  b: { host: string; port: number; secretEnv?: string[] },
  timeoutMs: number,
): Promise<boolean> {
  const client = new BridgeClient(b.host, b.port, timeoutMs, "bridge", undefined, () =>
    resolveBridgeSecret(config.projectPath, b.secretEnv ?? []),
  );
  try {
    await client.request("ping", {}, timeoutMs);
    return true;
  } catch {
    return false;
  } finally {
    client.close();
  }
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
  const severity: Check["severity"] = opts.requireLive ? "required" : "info";
  // `secretEnv` marks the two bridges that speak OUR protocol, so a TCP connect
  // is not the end of the story for them (see handshakeOk). The LSP and DAP
  // entries have none: those ports belong to Godot, and anything we could send
  // to prove liveness would be us implementing a foreign protocol inside doctor.
  const bridges: Array<{ name: string; host: string; port: number; hint: string; secretEnv?: string[] }> = [
    {
      name: "editor-bridge",
      host: config.bridgeHost,
      port: config.bridgePort,
      hint: 'Open the editor with the "Breakpoint MCP" plugin enabled — and if it was already open when you ran `breakpoint-mcp init`, close and reopen the project (Godot reads the enabled-plugin list only at project load).',
      secretEnv: ["BREAKPOINT_BRIDGE_SECRET"],
    },
    {
      name: "runtime-bridge",
      host: config.runtimeHost,
      port: config.runtimePort,
      hint: "Launch the project (godot_run_project / dbg_launch) with the plugin enabled — it auto-registers the runtime autoload.",
      secretEnv: ["BREAKPOINT_RUNTIME_SECRET", "BREAKPOINT_BRIDGE_SECRET"],
    },
    {
      name: "gdscript-lsp",
      host: config.lspHost,
      port: config.lspPort,
      hint: "Godot's language server runs while the editor is open (Editor → Editor Settings → Network → Language Server).",
    },
    {
      name: "gdscript-dap",
      host: config.dapHost,
      port: config.dapPort,
      hint: "Godot's debug adapter runs while the editor is open (Editor → Editor Settings → Network → Debug Adapter).",
    },
  ];
  const bridgeChecks = await Promise.all(
    bridges.map(async (b): Promise<Check> => {
      const ok = await probeTcp(b.host, b.port, opts.timeoutMs);
      if (!ok) {
        return {
          name: b.name,
          status: "fail",
          severity,
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
        if (!live) {
          return {
            name: b.name,
            status: "fail",
            severity,
            detail: `${b.host}:${b.port} open, but no Breakpoint bridge answered`,
            hint: "Something holds that port without speaking the bridge protocol, or the shared secret is stale. Close other Godot instances, or delete res://.godot/breakpoint_mcp.secret and reopen the editor to remint it.",
          };
        }
      }
      return {
        name: b.name,
        status: "ok",
        severity,
        detail: `${b.host}:${b.port} reachable${b.secretEnv ? " · bridge answered" : ""}`,
      };
    }),
  );
  checks.push(...bridgeChecks);

  // Optional C# tooling.
  if (opts.includeCsharp) {
    checks.push(checkCsharpTool("csharp-lsp", config.csLspCmd));
    checks.push(checkCsharpTool("csharp-dap", config.csDapCmd));
  }

  const ok = checks.every((c) => c.severity !== "required" || c.status !== "fail");
  return { checks, ok };
}

function glyph(status: CheckStatus): string {
  return status === "ok" ? "✓" : status === "fail" ? "✗" : "–";
}

function printReport(report: DoctorReport): void {
  const width = Math.max(...report.checks.map((c) => c.name.length));
  const out: string[] = ["breakpoint-mcp doctor", ""];
  for (const c of report.checks) {
    out.push(`  ${glyph(c.status)} ${c.name.padEnd(width)}  ${c.detail}`);
    if (c.status === "fail" && c.hint) out.push(`      ↳ ${c.hint}`);
  }
  out.push("");
  out.push(
    report.ok
      ? "All required checks passed."
      : "Some required checks failed — see the ↳ hints above.",
  );
  process.stdout.write(out.join("\n") + "\n");
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

  const config = loadConfig();
  const report = await runDoctorChecks(config, {
    timeoutMs,
    requireLive: flags["require-live"] === true,
    includeCsharp: flags["include-csharp"] === true,
  });

  if (flags.json === true) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    printReport(report);
  }
  return report.ok ? 0 : 1;
}

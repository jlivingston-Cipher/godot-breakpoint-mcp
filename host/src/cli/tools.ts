/**
 * `breakpoint-mcp tools` — export the tool surface as a stable, machine-readable
 * artifact.
 *
 * Why this exists: third-party MCP catalogs, policy gateways, and security
 * reviewers need to know what this server exposes and how risky each tool is.
 * Without a published artifact their only options are to run the server and
 * speak MCP at it, or to infer risk from tool NAMES. A public catalog did the
 * latter in July 2026 and got it backwards in both directions — `tilemap_clear`
 * filed as irreversible (it is undoable), `theme_set_color` not flagged at all
 * (it rewrites a `.tres` in place). This command, plus the annotations shipped
 * on `tools/list`, removes the need to guess.
 *
 * It reports the surface WITHOUT connecting to Godot: the registry is built
 * against a recorder using the same `buildToolsets` path `index.ts` drives, with
 * stub clients, and no handler is ever invoked. So it works in CI, in a
 * container, and on a machine with no Godot installed.
 *
 * Two surfaces are reported, because the difference is the security story:
 *   • `full`           — all 291 tools, what loads with BREAKPOINT_PRIVILEGED_GROUPS=all
 *   • `secure-default` — 278, what an untouched install actually advertises
 * `--surface` picks which one populates `tools[]`; both counts are always in the
 * header so a consumer cannot report one as the other by accident.
 */
import { parseArgs } from "./args.js";
import { buildToolsets } from "../toolsets.js";
import { applyOutputSchemas } from "../schemas.js";
import { applyAnnotations, annotationsFor } from "../annotations.js";
import { TOOL_CAPABILITIES, CAPABILITY_GROUPS, GROUP_DESCRIBE } from "../capabilities.js";
import { loadConfig } from "../config.js";
import { packageVersion } from "../version.js";



interface ExportedTool {
  name: string;
  title: string | null;
  description: string | null;
  toolset: string;
  /** Capability groups gating this tool. Empty = unprivileged, always registered. */
  capabilityGroups: string[];
  /** True when this tool is dropped from a default (no privileged groups) session. */
  privileged: boolean;
  /**
   * True when the tool takes a `confirm` parameter — i.e. it is elicitation-gated
   * and will raise a client-side confirmation prompt unless `confirm: true` is
   * passed. Fails closed on clients without elicitation support.
   */
  confirmationGated: boolean;
  /** Input parameter names, in declaration order. */
  params: string[];
  annotations: ReturnType<typeof annotationsFor>;
}

interface Recorded {
  name: string;
  config: Record<string, unknown>;
  toolset: string;
}

/**
 * Register the whole surface against a recorder, exactly as `index.ts` does
 * (`applyOutputSchemas` → `applyAnnotations` → every `register*Tools`), and
 * capture each tool's config. Capability filtering is applied afterwards rather
 * than via `applyCapabilities`, so a single pass can report both surfaces.
 */
function recordSurface(): Recorded[] {
  const recorded: Recorded[] = [];
  let current = "";

  const push = (name: string, config: Record<string, unknown>) => {
    recorded.push({ name, config, toolset: current });
    return { name };
  };

  const server = {
    registerTool: (name: string, config: Record<string, unknown>) => push(name, config),
    registerResource: () => {},
    experimental: {
      tasks: { registerToolTask: (name: string, config: Record<string, unknown>) => push(name, config) },
    },
    server: { elicitInput: async () => ({ action: "decline" }) },
  };

  const mcp = server as unknown as Parameters<typeof applyOutputSchemas>[0];
  const stub = {} as unknown as never;

  applyOutputSchemas(mcp);
  applyAnnotations(mcp);

  for (const ts of buildToolsets({
    server: mcp,
    bridge: stub,
    runtime: stub,
    lsp: stub,
    csLsp: stub,
    dap: stub,
    csDap: stub,
    config: loadConfig(),
  })) {
    current = ts.id;
    ts.run();
  }

  return recorded;
}

function toExported(r: Recorded): ExportedTool {
  const groups = [...(TOOL_CAPABILITIES[r.name] ?? [])];
  const shape = (r.config.inputSchema as Record<string, unknown> | undefined) ?? {};
  const params = Object.keys(shape);
  return {
    name: r.name,
    title: typeof r.config.title === "string" ? r.config.title : null,
    description: typeof r.config.description === "string" ? r.config.description : null,
    toolset: r.toolset,
    capabilityGroups: groups,
    privileged: groups.length > 0,
    confirmationGated: params.includes("confirm"),
    params,
    annotations: annotationsFor(r.name),
  };
}

export interface ToolsReport {
  server: { name: string; version: string };
  generatedAt: null;
  surface: "full" | "secure-default";
  counts: {
    full: number;
    secureDefault: number;
    readOnly: number;
    destructive: number;
    idempotent: number;
    openWorld: number;
    confirmationGated: number;
    privileged: number;
  };
  capabilityGroups: Array<{ id: string; describe: string; defaultEnabled: false; tools: string[] }>;
  tools: ExportedTool[];
}

/** Build the report. Exported for the tests, which assert it against the registry. */
export function buildToolsReport(surface: "full" | "secure-default"): ToolsReport {
  const all = recordSurface().map(toExported);
  const secure = all.filter((t) => !t.privileged);
  const shown = surface === "full" ? all : secure;

  return {
    server: { name: "breakpoint-mcp", version: packageVersion() },
    // Deliberately null, not a timestamp: this artifact is a pure function of the
    // source tree, so two runs of the same build must be byte-identical (a
    // consumer can diff releases; CI can assert no drift).
    generatedAt: null,
    surface,
    counts: {
      full: all.length,
      secureDefault: secure.length,
      readOnly: shown.filter((t) => t.annotations.readOnlyHint).length,
      destructive: shown.filter((t) => t.annotations.destructiveHint).length,
      idempotent: shown.filter((t) => t.annotations.idempotentHint).length,
      openWorld: shown.filter((t) => t.annotations.openWorldHint).length,
      confirmationGated: shown.filter((t) => t.confirmationGated).length,
      privileged: all.length - secure.length,
    },
    capabilityGroups: CAPABILITY_GROUPS.map((g) => ({
      id: g,
      describe: GROUP_DESCRIBE[g],
      defaultEnabled: false as const,
      tools: all.filter((t) => t.capabilityGroups.includes(g)).map((t) => t.name).sort(),
    })),
    tools: [...shown].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function renderText(report: ToolsReport): string {
  const c = report.counts;
  const lines: string[] = [
    `breakpoint-mcp ${report.server.version} — ${report.surface} surface`,
    "",
    `  tools                ${report.tools.length}` +
      (report.surface === "secure-default" ? `  (of ${c.full} total; ${c.privileged} privileged, dropped)` : ""),
    `  read-only            ${c.readOnly}`,
    `  destructive          ${c.destructive}`,
    `  idempotent           ${c.idempotent}`,
    `  open-world (egress)  ${c.openWorld}`,
    `  confirmation-gated   ${c.confirmationGated}`,
    "",
    "Capability groups (all OFF by default — enable with BREAKPOINT_PRIVILEGED_GROUPS):",
  ];
  for (const g of report.capabilityGroups) {
    lines.push(`  ${g.id} (${g.tools.length} tools) — ${g.describe}`);
  }
  lines.push("", "Tools:");
  for (const t of report.tools) {
    const marks = [
      t.annotations.readOnlyHint ? "read-only" : null,
      t.annotations.destructiveHint ? "destructive" : null,
      t.confirmationGated ? "gated" : null,
      t.privileged ? `privileged:${t.capabilityGroups.join("+")}` : null,
    ].filter(Boolean);
    lines.push(`  ${t.name.padEnd(34)} ${marks.join(" · ")}`);
  }
  lines.push("", "Re-run with --json for the machine-readable form.", "");
  return lines.join("\n");
}

export async function runTools(argv: string[]): Promise<number> {
  const { flags } = parseArgs(argv, ["json", "help", "h"]);

  if (flags.help || flags.h) {
    process.stdout.write(
      [
        "breakpoint-mcp tools — export the tool surface (name, risk annotations, capability group).",
        "",
        "  --json                Emit JSON (stable, no timestamp — safe to diff between releases).",
        "  --surface <which>     full | secure-default   (default: secure-default, what an",
        "                        untouched install actually advertises).",
        "",
        "Reads no Godot install and starts no server — the registry is built statically.",
        "",
      ].join("\n"),
    );
    return 0;
  }

  const raw = typeof flags.surface === "string" ? flags.surface : "secure-default";
  if (raw !== "full" && raw !== "secure-default") {
    process.stderr.write(`unknown --surface "${raw}" (expected: full | secure-default)\n`);
    return 2;
  }

  const report = buildToolsReport(raw);
  process.stdout.write(flags.json ? `${JSON.stringify(report, null, 2)}\n` : renderText(report));
  return 0;
}

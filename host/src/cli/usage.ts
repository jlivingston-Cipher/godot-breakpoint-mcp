/**
 * The CLI's help text, in ONE place, split by subcommand.
 *
 * It lived in `index.ts`'s `printUsage` as a single flat array, which was fine
 * while `--help` was the only thing that printed it. It stopped being fine the
 * moment `breakpoint-mcp init --help` had to print the init section and nothing
 * else: the alternative to this module is the same twelve lines written twice,
 * and a help text that disagrees with itself is worse than one that is merely
 * long. `index.ts` composes the whole document from these parts, so a flag
 * documented for a subcommand is documented in the top-level help by
 * construction.
 *
 * 🔴 THE ROSTERS BELOW ARE NOT DOCUMENTATION — THEY ARE THE PARSER'S INPUT.
 * `parseArgs` takes them as `knownFlags` and reports anything else as unknown,
 * so a flag added to a subcommand and not added here is refused at the command
 * line rather than silently ignored. That is the whole point of keeping the
 * prose and the roster in the same file: the pressure to update both is the
 * same edit.
 */

export const HEADLINE = "breakpoint-mcp — MCP server exposing Godot to AI coding assistants.";

export const SYNOPSIS: string[] = [
  "Usage:",
  "  breakpoint-mcp             Start the MCP server on stdio (default; how MCP clients launch it).",
  "  breakpoint-mcp init        Install + enable the editor addon in a project and wire the MCP client.",
  "  breakpoint-mcp doctor      Check the Godot binary, the editor addon, and the four bridges.",
  "  breakpoint-mcp tools       Export the tool surface + risk annotations (for catalogs / reviews).",
  "  breakpoint-mcp --help      Show this help.",
  "  breakpoint-mcp --version   Print the installed version and exit.",
  "",
  "Every subcommand also accepts --help.",
];

export const INIT_USAGE: string[] = [
  "Usage: breakpoint-mcp init [options]",
  "",
  "Install + enable the editor addon in a Godot project and wire the MCP client.",
  "",
  "init options:",
  "  --project <dir>     Target Godot project (default: $GODOT_PROJECT or the current directory).",
  "  --client <id>       Write the MCP config for a client: claude-code | claude-desktop | cursor | windsurf | vscode.",
  "  --force             Overwrite an addon that is already installed.",
  "  --dry-run           Print what would change without writing anything.",
  "  --from-github [ref] Fetch the editor addon from GitHub at [ref] (default: this package's version tag) instead of the bundled copy.",
  "  --repo <owner/repo> With --from-github, the source repo (default: jlivingston-Cipher/godot-breakpoint-mcp).",
  "  --trust <level>     secure | full. `full` enables every higher-trust group (default: secure).",
  "  --privileged-groups <a,b>  Enable named higher-trust groups instead of all of them.",
];

export const DOCTOR_USAGE: string[] = [
  "Usage: breakpoint-mcp doctor [options]",
  "",
  "Check the Godot binary, the editor addon, and the four bridges.",
  "",
  "doctor options:",
  "  --project <dir>     Project to check (default: $GODOT_PROJECT or the current directory).",
  "  --require-live[=L]  Require bridges to be reachable rather than just report them.",
  "                      Bare, it means the three OPENING THE EDITOR brings up: the editor",
  "                      bridge, the GDScript LSP and the DAP. L is editor | runtime | all —",
  "                      the runtime bridge lives inside the running game, so it is required",
  "                      only by =runtime and =all.",
  "  --include-csharp    Also probe OmniSharp / netcoredbg on PATH (the C# planes).",
  "  --timeout <ms>      Per-bridge connect timeout (default 1500).",
  "  --json              Emit the report as JSON.",
];

export const TOOLS_USAGE: string[] = [
  "Usage: breakpoint-mcp tools [options]",
  "",
  "Export the tool surface + risk annotations (for catalogs / reviews).",
  "",
  "tools options:",
  "  --surface <which>   full | secure-default (default: secure-default, what an untouched install advertises).",
  "  --json              Emit the surface as JSON — stable and timestamp-free, so releases can be diffed.",
];

/** Every flag `init` accepts. Booleans are declared at the call site. */
export const INIT_FLAGS = [
  "project",
  "client",
  "from-github",
  "repo",
  "trust",
  "privileged-groups",
];

/** Every flag `doctor` accepts. */
export const DOCTOR_FLAGS = ["project", "timeout"];

/** Every flag `tools` accepts. */
export const TOOLS_FLAGS = ["surface"];

/** The whole document, composed — what `breakpoint-mcp --help` prints. */
export function fullUsage(): string[] {
  // Each subcommand block contributes only its own `<name> options:` tail; the
  // per-subcommand synopsis above it would read as four competing headlines in
  // a single document.
  const tail = (block: string[]): string[] => block.slice(block.findIndex((l) => l.endsWith("options:")));
  return [
    HEADLINE,
    "",
    ...SYNOPSIS,
    "",
    ...tail(INIT_USAGE),
    "",
    ...tail(DOCTOR_USAGE),
    "",
    ...tail(TOOLS_USAGE),
    "",
    "All runtime configuration is via environment variables; see the README.",
    "",
  ];
}

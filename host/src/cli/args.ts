/**
 * Minimal argv parser for the `breakpoint-mcp` CLI subcommands (init / doctor).
 * Deliberately dependency-free — a ~40-line parser keeps the package's
 * SDK-and-zod-only footprint, and the CLI's flag surface is tiny.
 *
 * Supported forms:
 *   --flag value        (value-taking, unless `flag` is in booleanFlags)
 *   --flag=value        (always value-taking)
 *   --flag              (boolean, or value-taking with no following value)
 *   -h                  (single-dash short flag → boolean)
 *   --                  (everything after is a positional)
 *   plain               (positional)
 *
 * `booleanFlags` names the flags that never consume the next token, so
 * `--json /path` parses as `{json:true}` + positional `/path`, not `{json:"/path"}`.
 *
 * `knownFlags` is the OPTIONAL roster of every flag a subcommand accepts. A
 * parser that accepts any `--key` cannot tell a flag from a typo, and what that
 * produces is not silence — it is a confident error about something else.
 * `breakpoint-mcp init --porject /path/to/game` parsed as
 * `{porject:"/path/to/game"}`, ignored it, defaulted the project to the current
 * directory and reported `no project.godot at /home/them`: a true sentence
 * about a directory the user never named. `unknown` is how a caller gets to say
 * the sentence that is about the input it was actually given. Callers passing
 * no roster keep the permissive behaviour, and `booleanFlags` are known by
 * construction so a roster need not repeat them.
 */
export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
  /** Flag keys absent from `knownFlags`. Always empty when no roster was given. */
  unknown: string[];
}

export function parseArgs(
  argv: string[],
  booleanFlags: string[] = [],
  knownFlags?: string[],
): ParsedArgs {
  const bool = new Set(booleanFlags);
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
        continue;
      }
      const key = a.slice(2);
      if (bool.has(key)) {
        flags[key] = true;
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }
    if (a.startsWith("-") && a.length > 1) {
      flags[a.slice(1)] = true;
      continue;
    }
    positionals.push(a);
  }

  // Computed AFTER the loop rather than inside it, so `--flag=value`,
  // `--flag value` and the bare boolean forms are all judged by the same rule —
  // the key that landed in `flags`, however it got there.
  const known = knownFlags === undefined ? null : new Set([...knownFlags, ...booleanFlags]);
  const unknown = known === null ? [] : Object.keys(flags).filter((k) => !known.has(k));

  return { positionals, flags, unknown };
}

/**
 * The two questions every subcommand must answer before it does any work: was
 * `--help` asked for, and was it handed something it does not accept. Returns
 * the exit code to return, or `null` to carry on.
 *
 * Shared rather than written per subcommand, because written per subcommand it
 * was answered by exactly ONE of the three. `tools` handled `--help` and kept
 * its own copy of the text; `doctor` ignored it and ran the checks; `init`
 * ignored it and fell through to the project check, reporting a missing
 * `project.godot` — an error about the user's directory in answer to a
 * question about flags.
 */
export function preflight(parsed: ParsedArgs, subcommand: string, usage: string[]): number | null {
  if (parsed.flags.help === true || parsed.flags.h === true) {
    process.stdout.write(usage.join("\n") + "\n");
    return 0;
  }
  if (parsed.unknown.length > 0) {
    const named = parsed.unknown.map((u) => (u.length === 1 ? `-${u}` : `--${u}`)).join(", ");
    process.stderr.write(
      `${subcommand}: unknown ${parsed.unknown.length === 1 ? "option" : "options"} ${named}.\n` +
        `  Run \`breakpoint-mcp ${subcommand} --help\` for the options this subcommand accepts.\n`,
    );
    return 2;
  }
  return null;
}

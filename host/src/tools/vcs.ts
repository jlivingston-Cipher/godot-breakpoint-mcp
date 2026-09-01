import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { ok } from "./lsp-common.js";
import { gate } from "../confirm.js";

// Group L — version control (git), host-side (Plane B). These read the project's
// git repository directly by spawning the `git` binary with an explicit argv (no
// shell), rooted at the configured project path via `git -C <projectPath>`. They
// need neither the Godot editor nor a language server, so they answer whenever the
// project is a git work tree — exactly the "cloud-verifiable end-to-end" lane the
// backlog flags. This file is the READ-ONLY core (status/log/diff/show/branches/
// blame); none mutate the index or working tree, so none are undoable or gated.
// The mutating half (stage/commit/restore/…) is intentionally deferred pending a
// scope steer and, when added, reuses the elicitation `gate()` in ../confirm.ts.

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 20000;
const MAX_BUFFER = 32 * 1024 * 1024;
const UNIT = "\x1f"; // ASCII unit separator — safe field delimiter for --pretty.

interface GitResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  /** True when the `git` binary itself is missing (ENOENT). */
  missing: boolean;
}

/** Run git with an explicit argv rooted at the project path. Never throws. */
async function git(cfg: Config, args: string[], timeoutMs = GIT_TIMEOUT_MS): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", ["-C", cfg.projectPath, ...args], {
      timeout: timeoutMs,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
    });
    return { ok: true, code: 0, stdout, stderr, missing: false };
  } catch (err: unknown) {
    const e = err as { code?: number | string; errno?: string; stdout?: string; stderr?: string; message?: string };
    const missing = e.code === "ENOENT" || e.errno === "ENOENT";
    return {
      ok: false,
      code: typeof e.code === "number" ? e.code : null,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? "",
      missing,
    };
  }
}

/** MCP error envelope for a failed git call (never throws to the caller). */
function gitFail(r: GitResult) {
  if (r.missing) {
    return {
      isError: true as const,
      content: [{
        type: "text" as const,
        text: "git is not installed or not on PATH. Install git to use the vcs_* tools.",
      }],
    };
  }
  const msg = (r.stderr || r.stdout || "git command failed").trim();
  const notRepo = /not a git repository/i.test(msg);
  const hint = notRepo ? " (the configured project path is not inside a git work tree)" : "";
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: `git error${r.code != null ? ` [${r.code}]` : ""}: ${msg}${hint}` }],
  };
}

/**
 * The paths from a `git ... --name-only` run, in git's own order and dropping the
 * trailing blank. Used by `vcs_restore` to MEASURE what changed rather than echo what
 * was requested — see the comment at its handler for why that distinction is the whole
 * point (D5, 155 §2; the same family as #181, #183 and #188).
 */
function nameOnly(stdout: string): string[] {
  return stdout.split("\n").map((s) => s.trim()).filter(Boolean);
}

/**
 * Classify a `vcs_restore` run from the two readings around it.
 *
 * 🔴 A PURE FUNCTION TAKING ITS POPULATIONS AS PARAMETERS, AND THAT IS THE POINT
 * (173 §6, whose own reverse sweep caught the same shape in the commit written to fix
 * that session). Inlined in the handler, `stranded` could only ever be built from what
 * a real `git restore` produces — which, when it works, is always the empty list. A
 * collector you only ever assert is EMPTY is a collector nobody has proved collects,
 * so the collapse case has to be constructible without git's cooperation.
 */
export function restoreOutcome(rels: string[], wasDirty: string[], stillDirty: string[]): {
  restored: string[]; count: number; requested: string[]; stranded: string[];
} {
  const stuck = new Set(stillDirty);
  const restored = wasDirty.filter((p) => !stuck.has(p));
  return { restored, count: restored.length, requested: rels, stranded: [...stuck] };
}

/**
 * Truncate long text so a single tool result stays reasonable; report whether it
 * was cut. Keeps the HEAD (not the tail): for a patch the first changed files and
 * their hunks are the useful part, and for file content the start is; the caller
 * narrows with `path`/`ref`/line range when `truncated` is true.
 */
function clip(s: string, max = 12000): { text: string; truncated: boolean } {
  if (s.length <= max) return { text: s, truncated: false };
  return { text: s.slice(0, max) + "\n…(truncated)…", truncated: true };
}

/**
 * Accept a `res://` path or a plain PROJECT-relative path, and answer the pathspec
 * git should be given. `git` is always spawned with `-C cfg.projectPath`, so a
 * pathspec is resolved relative to the PROJECT — never to the repository root.
 *
 * \U0001f534 295 — AND THAT IS THE ONLY SPELLING THIS FAMILY ACCEPTS, WHICH EVERY ONE OF
 * THESE DESCRIPTIONS USED TO DENY. They promised "res:// or repo-relative", and
 * repo-relative is precisely the spelling that does not work: with the project at
 * `<repo>/example`, `example/player.gd` reaches git as `example/example/player.gd`.
 * Three tools refused that loudly; `vcs_log` and `vcs_diff` answered an EMPTY LIST,
 * which reads as *this file has no history* about a file that has one. The promise is
 * corrected here and the empty answer is refused below (`filterMatchedNothing`).
 */
function toRepoPath(p: string): string {
  return p.startsWith("res://") ? p.slice("res://".length) : p;
}

/**
 * The project's own directory as git spells it from the repository root — `""` when
 * the project IS the repository root, `"example/"` when it is a subdirectory of it.
 *
 * \U0001f534 295 — THE TWO VOCABULARIES THIS FAMILY MIXED ARE IDENTICAL EXACTLY WHEN THIS
 * IS EMPTY, AND THAT IS THE ONLY LAYOUT ANYTHING EVER DROVE. `git status --porcelain=v2`
 * prints paths relative to the CWD (the project); `git diff --name-only` and `git show`
 * print them relative to the REPOSITORY ROOT. Every fixture in `vcs.test.ts` and
 * `vcs.integration.mjs` builds the repo AT the project path, where the prefix is `""`
 * and the two spellings coincide — so a family that disagreed with itself about the name
 * of a file tested green for as long as it has existed. This repository's own `example/`
 * is a project inside a repository, which is where it was finally measured.
 */
async function projectPrefix(cfg: Config): Promise<string> {
  const r = await git(cfg, ["rev-parse", "--show-prefix"]);
  return r.ok ? r.stdout.trim() : "";
}

/**
 * Does a path filter name something this repository has ever heard of — in the working
 * tree, the index, or history?
 *
 * \U0001f534 295 — AN EMPTY ANSWER TO A FILTER THAT MATCHED NOTHING IS AN UNREAD WEARING A
 * FINDING'S CLOTHES. `vcs_log --path <typo>` and `vcs_diff --path <typo>` both exit 0
 * with an empty result, and a caller cannot tell *this file has no commits* from *no
 * file by that name exists*. The first is a measurement; the second is a question that
 * was never asked. This is the same distinction 155 §2 drew for `vcs_restore` — measure
 * what happened rather than echo what was requested — one tool family over.
 */
async function filterMatchedNothing(cfg: Config, spec: string): Promise<boolean> {
  const tracked = await git(cfg, ["ls-files", "--error-unmatch", "--", spec]);
  if (tracked.ok && tracked.stdout.trim()) return false;
  const known = await git(cfg, ["log", "--max-count=1", "--pretty=format:%H", "--", spec]);
  if (known.ok && known.stdout.trim()) return false;
  const onDisk = await git(cfg, ["ls-files", "--others", "--", spec]);
  return !(onDisk.ok && onDisk.stdout.trim());
}

/** The refusal a filter that named nothing earns, naming what it resolved to. */
function unmatchedFilter(cfg: Config, given: string, spec: string) {
  return {
    isError: true as const,
    content: [{
      type: "text" as const,
      text:
        `No path in this repository matches '${spec}'` +
        (given === spec ? "" : ` (from '${given}')`) +
        `. Paths are PROJECT-relative — resolved against ${cfg.projectPath}, not against the ` +
        `repository root — so a path that reads correctly at the root of the repository will not ` +
        `match here. Use the res:// spelling, or the path as vcs_status prints it. Refusing rather ` +
        `than answering an empty list: an empty answer here is indistinguishable from 'no history'.`,
    }],
  };
}

// ---- git status --porcelain=v2 --branch parsing ----------------------------
// Ordinary changed:  1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
// Renamed/copied:    2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <Xscore> <path>\t<orig>
// Untracked:         ? <path>          Unmerged: u <XY> ... <path>
interface ParsedStatus {
  branch: string | null;
  oid: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  staged: Array<{ path: string; status: string }>;
  unstaged: Array<{ path: string; status: string }>;
  untracked: string[];
  unmerged: string[];
  clean: boolean;
  /**
   * Paths git reports as changed that lie OUTSIDE the Godot project, repo-root-relative.
   *
   * \U0001f534 295 — THEY USED TO ARRIVE IN THE LISTS ABOVE, SPELLED `../docs/README.md`, AND A
   * `res://` SURFACE CANNOT SAY THAT. `git -C <project> status` reports the whole work
   * tree, so a project inside a repository saw its neighbours' edits listed as its own —
   * in a spelling no other tool in this family accepts, beside members that are
   * project-relative. They are REPORTED here rather than dropped: `vcs_add` with no
   * paths still stages them and `vcs_commit` still commits them, so a status that hid
   * them would be the more dangerous reading, not the safer one.
   */
  outside_project: string[];
}

/**
 * A CWD-relative path git printed (`../docs/README.md`) re-spelled relative to the
 * repository root, given the project's own prefix within it (`example/`). Pure, so the
 * subdirectory layout can be driven without a repository.
 */
export function toRepoRootRel(prefix: string, cwdRel: string): string {
  const segs = (prefix + cwdRel).split("/");
  const out: string[] = [];
  for (const seg of segs) {
    if (seg === "." || seg === "") continue;
    if (seg === ".." && out.length && out[out.length - 1] !== "..") out.pop();
    else out.push(seg);
  }
  return out.join("/");
}

export function parseStatusV2(stdout: string): ParsedStatus {
  const s: ParsedStatus = {
    branch: null, oid: null, upstream: null, ahead: 0, behind: 0,
    staged: [], unstaged: [], untracked: [], unmerged: [], clean: true,
    outside_project: [],
  };
  for (const line of stdout.split("\n")) {
    if (!line) continue;
    if (line.startsWith("# branch.oid ")) { const v = line.slice(13).trim(); s.oid = v === "(initial)" ? null : v; }
    else if (line.startsWith("# branch.head ")) { const v = line.slice(14).trim(); s.branch = v === "(detached)" ? null : v; }
    else if (line.startsWith("# branch.upstream ")) s.upstream = line.slice(18).trim();
    else if (line.startsWith("# branch.ab ")) {
      const m = line.slice(12).trim().match(/\+(-?\d+)\s+-(-?\d+)/);
      if (m) { s.ahead = Number(m[1]); s.behind = Number(m[2]); }
    } else if (line.startsWith("1 ") || line.startsWith("2 ")) {
      const parts = line.split(" ");
      const xy = parts[1];
      const rest = line.startsWith("2 ")
        ? parts.slice(9).join(" ").split("\t")[0] // renamed: path before the \t<orig>
        : parts.slice(8).join(" ");
      const x = xy[0], y = xy[1];
      if (x !== ".") s.staged.push({ path: rest, status: x });
      if (y !== ".") s.unstaged.push({ path: rest, status: y });
    } else if (line.startsWith("u ")) {
      const parts = line.split(" ");
      s.unmerged.push(parts.slice(10).join(" "));
    } else if (line.startsWith("? ")) {
      s.untracked.push(line.slice(2));
    }
  }
  // \U0001f534 A PATH THAT LEAVES THE PROJECT IS NOT ONE OF THE PROJECT'S. `--porcelain=v2`
  // prints relative to the CWD, so a change above the project arrives as `../…` — the one
  // spelling this family's inputs cannot consume. Move them, repo-root-relative, into
  // their own field, and never leave a `../` member in a list of project paths.
  const escapes = (p: string): boolean => p === ".." || p.startsWith("../");
  for (const key of ["staged", "unstaged"] as const) {
    const keep: Array<{ path: string; status: string }> = [];
    for (const e of s[key]) {
      if (escapes(e.path)) s.outside_project.push(e.path);
      else keep.push(e);
    }
    s[key] = keep;
  }
  for (const key of ["untracked", "unmerged"] as const) {
    const keep: string[] = [];
    for (const e of s[key]) {
      if (escapes(e)) s.outside_project.push(e);
      else keep.push(e);
    }
    s[key] = keep;
  }
  s.outside_project = [...new Set(s.outside_project)].sort();
  // The handler re-spells these repo-root-relative with `toRepoRootRel` once it knows
  // the prefix; the parser stays pure so its population can be driven from fixtures.
  s.clean = s.staged.length === 0 && s.unstaged.length === 0 && s.untracked.length === 0 && s.unmerged.length === 0;
  return s;
}

export function registerVcsTools(server: McpServer, cfg: Config): void {
  // ---- vcs_status ----------------------------------------------------------
  server.registerTool(
    "vcs_status",
    {
      title: "Git status",
      description:
        "Working-tree status of the project's git repository, every path project-relative. Changes " +
        "elsewhere in the repository are listed separately in `outside_project`. Read-only; errors " +
        "clearly if the project path is not a git work tree.",
      inputSchema: {},
    },
    async () => {
      const r = await git(cfg, ["status", "--porcelain=v2", "--branch"]);
      if (!r.ok) return gitFail(r);
      const parsed = parseStatusV2(r.stdout);
      if (parsed.outside_project.length) {
        const prefix = await projectPrefix(cfg);
        parsed.outside_project = parsed.outside_project.map((p) => toRepoRootRel(prefix, p));
      }
      return ok(parsed);
    },
  );

  // ---- vcs_log -------------------------------------------------------------
  server.registerTool(
    "vcs_log",
    {
      title: "Git log",
      description:
        "Recent commits, newest first: full and short hash, author, ISO author date, and subject. " +
        "Recent commits, newest first. Optionally limit to commits touching a path (res:// or " +
        "project-relative); a path matching nothing is refused, not answered empty. Read-only.",
      inputSchema: {
        max_count: z.number().int().positive().max(1000).optional().describe("Max commits to return (default 20)"),
        path: z.string().optional().describe("Only commits touching this path (res:// or project-relative)"),
      },
    },
    async ({ max_count, path }) => {
      const fmt = ["%H", "%h", "%an", "%aI", "%s"].join(UNIT);
      const args = ["log", `--max-count=${max_count ?? 20}`, `--pretty=format:${fmt}`];
      const spec = path === undefined ? undefined : toRepoPath(path);
      if (spec !== undefined) args.push("--", spec);
      const r = await git(cfg, args);
      if (!r.ok) return gitFail(r);
      // \U0001f534 295 — AN EMPTY LOG UNDER A FILTER IS TWO DIFFERENT ANSWERS AND ONLY ONE OF
      // THEM IS A MEASUREMENT. Ask whether the repository has ever heard of the path
      // before reporting that it has no commits.
      if (spec !== undefined && !r.stdout.trim() && await filterMatchedNothing(cfg, spec)) {
        return unmatchedFilter(cfg, path as string, spec);
      }
      const commits = r.stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [hash, short, author, date, subject] = line.split(UNIT);
          return { hash, short, author, date, subject };
        });
      return ok({ commits, count: commits.length });
    },
  );

  // ---- vcs_diff ------------------------------------------------------------
  server.registerTool(
    "vcs_diff",
    {
      title: "Git diff",
      description:
        "Unified diff of the working tree (default) or the staged index (staged=true), optionally scoped to " +
        "a single path (res:// or project-relative). Returns the patch (tail-truncated) plus the changed-file " +
        "list, both project-relative. A path matching nothing is refused, not answered empty. Read-only.",
      inputSchema: {
        staged: z.boolean().optional().describe("Diff the staged index vs HEAD instead of the working tree (default false)"),
        path: z.string().optional().describe("Restrict the diff to this path (res:// or project-relative)"),
      },
    },
    async ({ staged, path }) => {
      // \U0001f534 295 — `--relative` IS WHAT MAKES THIS TOOL AND `vcs_status` NAME THE SAME FILE
      // THE SAME WAY. Without it git prints repo-root-relative paths while status prints
      // project-relative ones, so the two disagreed about one file at one moment, and
      // `files` could not be fed back into any path argument in this family. At the
      // repository root the flag is a no-op — which is exactly why nothing caught this.
      const args = ["diff", "--no-color", "--relative"];
      if (staged) args.push("--cached");
      const spec = path === undefined ? undefined : toRepoPath(path);
      if (spec !== undefined) args.push("--", spec);
      const r = await git(cfg, args);
      if (!r.ok) return gitFail(r);
      if (spec !== undefined && !r.stdout.trim() && await filterMatchedNothing(cfg, spec)) {
        return unmatchedFilter(cfg, path as string, spec);
      }
      const files = [...r.stdout.matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]);
      const { text, truncated } = clip(r.stdout);
      return ok({ staged: Boolean(staged), path: path ?? null, files, patch: text, truncated });
    },
  );

  // ---- vcs_show ------------------------------------------------------------
  server.registerTool(
    "vcs_show",
    {
      title: "Git show",
      description:
        "Inspect a commit or a file at a revision. With no path: commit metadata (hash, author, date, subject, " +
        "body) plus its patch (tail-truncated). With a path: the file's full content at that ref. `ref` defaults " +
        "to HEAD and accepts any revision (branch, tag, sha, HEAD~2). Read-only.",
      inputSchema: {
        ref: z.string().optional().describe("Revision to show (default HEAD): branch, tag, sha, or HEAD~n"),
        path: z.string().optional().describe("If set, return this file's content at <ref> instead of the commit"),
      },
    },
    async ({ ref, path }) => {
      const rev = ref ?? "HEAD";
      if (path) {
        const r = await git(cfg, ["show", `${rev}:${toRepoPath(path)}`]);
        if (!r.ok) return gitFail(r);
        const { text, truncated } = clip(r.stdout, 20000);
        return ok({ ref: rev, path, content: text, truncated });
      }
      const meta = await git(cfg, ["show", "-s", `--pretty=format:${["%H", "%h", "%an", "%aI", "%s", "%b"].join(UNIT)}`, rev]);
      if (!meta.ok) return gitFail(meta);
      const [hash, short, author, date, subject, body] = meta.stdout.split(UNIT);
      // \U0001f534 295 — `--relative`, FOR `vcs_diff`'s REASON. A commit's patch printed
      // repo-root-relative beside a `files` list printed project-relative is the same
      // two-vocabulary split one tool over; it also scopes the patch to the project,
      // which is the subject this tool's caller asked about.
      const patchRes = await git(cfg, ["show", "--no-color", "--relative", "--format=", rev]);
      if (!patchRes.ok) return gitFail(patchRes);
      const { text, truncated } = clip(patchRes.stdout);
      return ok({
        ref: rev, hash, short, author, date, subject,
        body: (body ?? "").trim(), patch: text, truncated,
      });
    },
  );

  // ---- vcs_branch_list -----------------------------------------------------
  server.registerTool(
    "vcs_branch_list",
    {
      title: "Git branches",
      description:
        "List branches with their short object name and a flag for the current branch. Local only by default; " +
        "set remotes=true to include remote-tracking branches (flagged remote=true). On a detached HEAD, " +
        "`current` is null and `detached` is true — matching vcs_status — and no pseudo-branch is listed. " +
        "Read-only.",
      inputSchema: {
        remotes: z.boolean().optional().describe("Include remote-tracking branches (default false)"),
      },
    },
    async ({ remotes }) => {
      const args = [
        "branch", "--no-color",
        `--format=%(refname)${UNIT}%(refname:short)${UNIT}%(objectname:short)${UNIT}%(HEAD)`,
      ];
      if (remotes) args.push("--all");
      const r = await git(cfg, args);
      if (!r.ok) return gitFail(r);
      let current: string | null = null;
      let detached = false;
      type Branch = { name: string; short_sha: string; current: boolean; remote: boolean };
      const branches = r.stdout
        .split("\n")
        .filter(Boolean)
        .map((line): Branch | null => {
          const [full, name, short_sha, head] = line.split(UNIT);
          const isCurrent = head.trim() === "*";
          // On a detached HEAD `git branch` emits a pseudo-entry whose refname is the
          // literal "(HEAD detached at <sha>)" rather than refs/heads/… . It is NOT a
          // branch — listing it as `current` contradicted vcs_status, which reports
          // null for the same repo, and no vcs_switch could ever reach it.
          if (!full.startsWith("refs/")) {
            if (isCurrent) detached = true;
            return null;
          }
          if (isCurrent) current = name;
          // Discriminate off the FULL refname: `%(refname:short)` of a remote-tracking
          // branch is "origin/main", never "remotes/origin/main", so the old
          // name.startsWith("remotes/") test could never match and every branch came
          // back remote=false — including under remotes=true, the flag's whole point.
          return { name, short_sha, current: isCurrent, remote: full.startsWith("refs/remotes/") };
        })
        .filter((b): b is Branch => b !== null);
      return ok({ current, branches, count: branches.length, detached });
    },
  );

  // ---- vcs_blame -----------------------------------------------------------
  server.registerTool(
    "vcs_blame",
    {
      title: "Git blame",
      description:
        "Per-line last-change attribution for a file: for each line, the short commit, author, ISO date, and the " +
        "line text. Optionally restrict to a [start,end] line range (1-based, inclusive); either bound may be " +
        "given alone (start alone runs to end-of-file). Read-only.",
      inputSchema: {
        path: z.string().describe("File to blame (res:// or project-relative)"),
        start: z.number().int().positive().optional().describe("First line (1-based, inclusive). May be given without `end`."),
        end: z.number().int().positive().optional().describe("Last line (1-based, inclusive). May be given without `start`."),
      },
    },
    async ({ path, start, end }) => {
      const args = ["blame", "--line-porcelain"];
      // An omitted end must be an EMPTY field: `-L 3,` blames line 3 to end-of-file.
      // `$` is a `git log -L` form and `git blame` REJECTS it with usage exit 129, so
      // the old `end ?? "$"` made every start-without-end call fail. Measured, not read.
      if (start != null || end != null) args.push("-L", `${start ?? 1},${end ?? ""}`);
      args.push("--", toRepoPath(path));
      const r = await git(cfg, args);
      if (!r.ok) return gitFail(r);
      const lines = parseBlamePorcelain(r.stdout);
      const { list, truncated } = capLines(lines);
      return ok({ path, lines: list, count: list.length, truncated });
    },
  );

  // ==== mutating tools (Tier A — safe local, no network) ====================
  // Posture: gate what can LOSE work or REWRITE history (vcs_restore, vcs_stash
  // op=drop); leave the reversible ops (add / commit / branch_create / switch)
  // ungated. Gating reuses the shared elicitation `gate()` — honors confirm:true,
  // and BLOCKS (never proceeds silently) on a client that can't elicit.

  // ---- vcs_add (stage) — ungated (reversible via `git restore --staged`) ----
  server.registerTool(
    "vcs_add",
    {
      title: "Git add (stage)",
      description:
        "Stage changes for the next commit. With `paths`, stages exactly those (res:// or project-relative); " +
        "omit `paths` to stage everything (git add -A). Returns the resulting staged file list. Reversible " +
        "with vcs_restore-staged / `git restore --staged`, so not gated.",
      inputSchema: {
        paths: z.array(z.string()).optional().describe("Paths to stage (res:// or project-relative). Omit to stage all."),
      },
    },
    async ({ paths }) => {
      const addArgs = paths && paths.length > 0 ? ["add", "--", ...paths.map(toRepoPath)] : ["add", "-A"];
      const r = await git(cfg, addArgs);
      if (!r.ok) return gitFail(r);
      const st = await git(cfg, ["status", "--porcelain=v2", "--branch"]);
      if (!st.ok) return gitFail(st);
      const parsed = parseStatusV2(st.stdout);
      return ok({ staged: parsed.staged, count: parsed.staged.length });
    },
  );

  // ---- vcs_commit — ungated (reversible via `git reset --soft HEAD~1`) ------
  server.registerTool(
    "vcs_commit",
    {
      title: "Git commit",
      description:
        "Commit the currently staged changes with a message. Reversible (`git reset --soft HEAD~1`) and " +
        "loses nothing, so not gated. Errors clearly if nothing is staged. Commit signing is disabled for " +
        "this call so it can never block on a passphrase prompt.",
      inputSchema: {
        message: z.string().min(1).describe("Commit message"),
      },
    },
    async ({ message }) => {
      const r = await git(cfg, ["-c", "commit.gpgsign=false", "commit", "-m", message]);
      if (!r.ok) {
        const blob = `${r.stdout}\n${r.stderr}`;
        if (/nothing to commit|no changes added|nothing added to commit/i.test(blob)) {
          return {
            isError: true as const,
            content: [{ type: "text" as const, text: "Nothing to commit — stage changes first with vcs_add." }],
          };
        }
        return gitFail(r);
      }
      const meta = await git(cfg, ["log", "-1", `--pretty=format:${["%H", "%h", "%s"].join(UNIT)}`]);
      if (!meta.ok) return gitFail(meta);
      const [hash, short, subject] = meta.stdout.split(UNIT);
      return ok({ committed: true, hash, short, summary: subject });
    },
  );

  // ---- vcs_restore — GATED (discards uncommitted working-tree edits) --------
  server.registerTool(
    "vcs_restore",
    {
      title: "Git restore (discard changes)",
      description:
        "Discard uncommitted working-tree changes to the given paths, restoring them from the index/HEAD " +
        "(`git restore -- <paths>`). DESTRUCTIVE — the discarded edits are unrecoverable — so it is " +
        "elicitation-gated: pass confirm:true to bypass the prompt on clients that can't elicit. " +
        "`restored` is MEASURED, not echoed: it lists only the paths git actually changed, so a path with " +
        "nothing to discard is absent from it rather than reported as discarded work. `requested` carries " +
        "what you asked for, and `stranded` names any path still dirty afterwards (a partial, not an error).",
      inputSchema: {
        paths: z.array(z.string()).min(1).describe("Paths to discard changes for (res:// or project-relative)"),
        confirm: z.boolean().optional().describe("Skip the confirmation prompt"),
      },
    },
    async ({ paths, confirm }) => {
      const rels = paths.map(toRepoPath);
      const blocked = await gate(server, confirm, `Discard working-tree changes to: ${rels.join(", ")}`);
      if (blocked) return blocked;
      // 🔴 D5 (155 §2), AND THE THIRD MEMBER OF #181/#183/#188's FAMILY: this used to
      // return `restored: rels` — THE REQUEST, ECHOED. `git restore` exits 0 for a path
      // with nothing to discard, so asking to discard five files of which one was dirty
      // reported all five as restored, and the caller of a DESTRUCTIVE, gated tool was
      // told it had thrown away work it had not touched. Every existing test restored a
      // path that was dirty, so the clean-path branch had never run anywhere.
      //
      // What `git restore -- <paths>` discards is exactly the working-tree-vs-index
      // diff, so that diff, read BEFORE and AFTER, is the measurement — not the request.
      // \U0001f534 295 — AND THE MEASUREMENT HAS TO SPEAK `requested`'s LANGUAGE. Without
      // `--relative` these two reads answer repo-root-relative while `rels` is
      // project-relative, so a destructive tool returned `requested: ["scripts/player.gd"]`
      // beside `restored: ["game/scripts/player.gd"]` — one file, two spellings, in one
      // object — and a caller checking whether the path it asked about was restored read
      // its own work being discarded as nothing having happened.
      const before = await git(cfg, ["diff", "--name-only", "--relative", "--", ...rels]);
      if (!before.ok) return gitFail(before);
      const wasDirty = nameOnly(before.stdout);

      const r = await git(cfg, ["restore", "--", ...rels]);
      if (!r.ok) return gitFail(r);

      const after = await git(cfg, ["diff", "--name-only", "--relative", "--", ...rels]);
      if (!after.ok) return gitFail(after);
      // Three outcomes, and one list cannot carry them (#188's two booleans, as lists):
      // a path that was dirty and is now clean was RESTORED; a path git still reports as
      // dirty is STRANDED; and `requested` stays available so a caller can see that the
      // other paths had nothing to discard rather than having to infer it.
      //
      // A stranded path is a PARTIAL, not an error — deliberately, and for #188 §7's
      // reason inverted: work WAS discarded for the other paths, and `_err` would claim
      // nothing happened, which is the same misdescription pointing the other way.
      return ok(restoreOutcome(rels, wasDirty, nameOnly(after.stdout)));
    },
  );

  // ---- vcs_stash — pop/list ungated; push and drop GATED ----
  //
  // 🔴 282 — `push` MOVED FROM UNGATED TO GATED, AND THE EVIDENCE IS THIS
  // SESSION'S OWN WORKING TREE. The posture above read *push/pop/list ungated*
  // on the argument that `push` is reversible with `pop`. It is — and reversible
  // is not the predicate the shipped sentence makes: `docs/TOOL_CATALOG.md`
  // promises *a destructive op is never executed silently*, and `git stash push`
  // REVERTS EVERY UNCOMMITTED CHANGE IN THE WORKING TREE. A probe added earlier
  // in this same session called it unattended against this repository and took a
  // day of uncommitted work out of the tree; it was recovered only because
  // somebody knew to look in `refs/stash`. An assistant doing that to a user's
  // project is the exact event the sentence exists to prevent, and "you can get
  // it back if you know the command" is not the same thing as not doing it.
  //
  // `pop` and `list` stay ungated: one RESTORES work and the other reads.
  server.registerTool(
    "vcs_stash",
    {
      title: "Git stash",
      description:
        "Manage stashes: op='push' saves and reverts your working changes (optional message); 'pop' " +
        "re-applies the latest stash; 'list' returns the stash entries; 'drop' deletes a stash entry. " +
        "'push' and 'drop' are destructive and elicitation-gated (confirm:true bypasses) — push reverts every " +
        "uncommitted change in the working tree, and drop deletes an entry unrecoverably; pop and list are not gated. " +
        "op='push' ERRORS when nothing was stashed (no tracked file has uncommitted changes) rather than " +
        "reporting success — a success there would tell you work is parked when it is not. Untracked files " +
        "are never stashed.",
      inputSchema: {
        op: z.enum(["push", "pop", "list", "drop"]).describe("Stash operation"),
        message: z.string().optional().describe("Message for op='push'"),
        ref: z.string().optional().describe("Stash ref for op='drop'/'pop', e.g. stash@{1} (default latest)"),
        confirm: z.boolean().optional().describe("Skip the confirmation prompt (op='push' / op='drop')"),
      },
    },
    async ({ op, message, ref, confirm }) => {
      if (op === "list") {
        const r = await git(cfg, ["stash", "list", `--pretty=format:%gd${UNIT}%s`]);
        if (!r.ok) return gitFail(r);
        const stashes = r.stdout.split("\n").filter(Boolean).map((line) => {
          const [refName, description] = line.split(UNIT);
          return { ref: refName, description };
        });
        return ok({ op, message: `${stashes.length} stash entr${stashes.length === 1 ? "y" : "ies"}`, stashes });
      }
      if (op === "drop") {
        const target = ref ?? "the latest stash";
        const blocked = await gate(server, confirm, `Delete stash entry (${target}) — its contents are unrecoverable`);
        if (blocked) return blocked;
        const r = await git(cfg, ["stash", "drop", ...(ref ? [ref] : [])]);
        if (!r.ok) return gitFail(r);
        return ok({ op, message: r.stdout.trim() || "dropped", stashes: [] });
      }
      if (op === "push") {
        // `git stash push` EXITS 0 printing "No local changes to save" when there is
        // nothing to stash. Passing that through as success is the worst shape this
        // family has: the caller believes their work is safely parked and may then
        // switch or restore over it. Decide on refs/stash BEFORE vs AFTER rather than
        // on git's wording, which is not a stable interface across versions.
        // Note untracked-only trees stash NOTHING here (no -u) — measured.
        const blocked = await gate(
          server,
          confirm,
          `Stash and REVERT every uncommitted change in the working tree${message ? ` (message: ${message})` : ""}`,
        );
        if (blocked) return blocked;
        const before = await git(cfg, ["rev-parse", "--quiet", "--verify", "refs/stash"]);
        const r = await git(cfg, ["stash", "push", ...(message ? ["-m", message] : [])]);
        if (!r.ok) return gitFail(r);
        const after = await git(cfg, ["rev-parse", "--quiet", "--verify", "refs/stash"]);
        const beforeOid = before.ok ? before.stdout.trim() : "";
        const afterOid = after.ok ? after.stdout.trim() : "";
        if (afterOid === "" || afterOid === beforeOid) {
          return {
            isError: true as const,
            content: [{
              type: "text" as const,
              text:
                "Nothing was stashed — no tracked file has uncommitted changes, so your working tree " +
                "is unchanged and no stash entry was created. Do not treat this as work being parked. " +
                `(git said: ${r.stdout.trim() || "nothing"})`,
            }],
          };
        }
        return ok({ op, message: r.stdout.trim() || "push ok", stashes: [] });
      }
      const r = await git(cfg, ["stash", "pop", ...(ref ? [ref] : [])]);
      if (!r.ok) return gitFail(r);
      return ok({ op, message: r.stdout.trim() || "pop ok", stashes: [] });
    },
  );

  // ---- vcs_branch_create — ungated (reversible) ----------------------------
  server.registerTool(
    "vcs_branch_create",
    {
      title: "Git branch (create)",
      description:
        "Create a new branch, optionally starting from a given ref (default HEAD), and optionally switch to " +
        "it. Reversible (`git branch -d`), so not gated. Errors clearly if the branch already exists. If " +
        "switch=true and the switch is refused (e.g. local changes would be overwritten), the error SAYS the " +
        "branch was still created — create and switch are two git calls and only the second can fail.",
      inputSchema: {
        name: z.string().min(1).describe("New branch name"),
        from: z.string().optional().describe("Start point (branch, tag, or sha; default HEAD)"),
        switch: z.boolean().optional().describe("Switch to the new branch after creating it (default false)"),
      },
    },
    async ({ name, from, switch: doSwitch }) => {
      const r = await git(cfg, ["branch", name, ...(from ? [from] : [])]);
      if (!r.ok) return gitFail(r);
      let switched = false;
      if (doSwitch) {
        const sw = await git(cfg, ["switch", name]);
        if (!sw.ok) {
          // The branch EXISTS at this point. Returning only the switch failure strands
          // the caller: they believe nothing happened, retry, and get "already exists"
          // from a branch they created themselves. Report BOTH halves.
          const failure = gitFail(sw);
          return {
            isError: true as const,
            content: [{
              type: "text" as const,
              text:
                `Branch '${name}' WAS created, but switching to it failed — you are still on the ` +
                `previous branch. Delete it with \`git branch -d ${name}\` if it is unwanted, or ` +
                `resolve the block below and switch with vcs_switch. ${failure.content[0].text}`,
            }],
          };
        }
        switched = true;
      }
      return ok({ created: true, name, from: from ?? null, switched });
    },
  );

  // ---- vcs_switch — ungated (git refuses on a dirty conflict; no --force) ---
  server.registerTool(
    "vcs_switch",
    {
      title: "Git switch (branch)",
      description:
        "Switch to an existing branch (`git switch <branch>`). No --force: if local changes would be " +
        "overwritten, git refuses and its message is returned unchanged — nothing is clobbered — so this is " +
        "not gated.",
      inputSchema: {
        branch: z.string().min(1).describe("Existing branch to switch to"),
      },
    },
    async ({ branch }) => {
      const r = await git(cfg, ["switch", branch]);
      if (!r.ok) return gitFail(r);
      return ok({ switched: true, branch });
    },
  );
}

// ---- git blame --line-porcelain parsing ------------------------------------
// Each line is a group: a header `<sha> <orig> <final> [group]`, key/value header
// lines (author, author-time, …), then a single content line prefixed with a TAB.
interface BlameLine { line: number; commit: string; author: string; date: string; text: string }

function parseBlamePorcelain(stdout: string): BlameLine[] {
  const out: BlameLine[] = [];
  const rows = stdout.split("\n");
  let sha = "", author = "", epoch = 0, finalLine = 0;
  for (const row of rows) {
    const head = row.match(/^([0-9a-f]{40}) \d+ (\d+)(?: \d+)?$/);
    if (head) { sha = head[1]; finalLine = Number(head[2]); continue; }
    if (row.startsWith("author ")) { author = row.slice(7); continue; }
    if (row.startsWith("author-time ")) { epoch = Number(row.slice(12)); continue; }
    if (row.startsWith("\t")) {
      out.push({
        line: finalLine,
        commit: sha.slice(0, 7),
        author,
        date: epoch ? new Date(epoch * 1000).toISOString() : "",
        text: row.slice(1),
      });
    }
  }
  return out;
}

/** Cap a blame result so a huge file can't blow the response size. */
function capLines(lines: BlameLine[], max = 5000): { list: BlameLine[]; truncated: boolean } {
  if (lines.length <= max) return { list: lines, truncated: false };
  return { list: lines.slice(0, max), truncated: true };
}

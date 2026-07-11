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
 * Truncate long text so a single tool result stays reasonable; report whether it
 * was cut. Keeps the HEAD (not the tail): for a patch the first changed files and
 * their hunks are the useful part, and for file content the start is; the caller
 * narrows with `path`/`ref`/line range when `truncated` is true.
 */
function clip(s: string, max = 12000): { text: string; truncated: boolean } {
  if (s.length <= max) return { text: s, truncated: false };
  return { text: s.slice(0, max) + "\n…(truncated)…", truncated: true };
}

/** Accept a res:// path (project-relative) or a plain repo-relative/absolute path. */
function toRepoPath(p: string): string {
  return p.startsWith("res://") ? p.slice("res://".length) : p;
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
}

function parseStatusV2(stdout: string): ParsedStatus {
  const s: ParsedStatus = {
    branch: null, oid: null, upstream: null, ahead: 0, behind: 0,
    staged: [], unstaged: [], untracked: [], unmerged: [], clean: true,
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
        "Working-tree status of the project's git repository: current branch, upstream ahead/behind, " +
        "and the staged / unstaged / untracked / unmerged file lists. Read-only. Reports clean=true when " +
        "nothing is pending. Errors clearly if the project path is not a git work tree.",
      inputSchema: {},
    },
    async () => {
      const r = await git(cfg, ["status", "--porcelain=v2", "--branch"]);
      if (!r.ok) return gitFail(r);
      return ok(parseStatusV2(r.stdout));
    },
  );

  // ---- vcs_log -------------------------------------------------------------
  server.registerTool(
    "vcs_log",
    {
      title: "Git log",
      description:
        "Recent commits, newest first: full and short hash, author, ISO author date, and subject. " +
        "Optionally limit to commits touching a path (accepts res:// or repo-relative). Read-only.",
      inputSchema: {
        max_count: z.number().int().positive().max(1000).optional().describe("Max commits to return (default 20)"),
        path: z.string().optional().describe("Only commits touching this path (res:// or repo-relative)"),
      },
    },
    async ({ max_count, path }) => {
      const fmt = ["%H", "%h", "%an", "%aI", "%s"].join(UNIT);
      const args = ["log", `--max-count=${max_count ?? 20}`, `--pretty=format:${fmt}`];
      if (path) args.push("--", toRepoPath(path));
      const r = await git(cfg, args);
      if (!r.ok) return gitFail(r);
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
        "Unified diff of the working tree (default) or the staged index (staged=true), optionally scoped to a " +
        "single path (res:// or repo-relative). Returns the patch text (tail-truncated for large diffs) plus the " +
        "list of changed files parsed from it. Read-only.",
      inputSchema: {
        staged: z.boolean().optional().describe("Diff the staged index vs HEAD instead of the working tree (default false)"),
        path: z.string().optional().describe("Restrict the diff to this path (res:// or repo-relative)"),
      },
    },
    async ({ staged, path }) => {
      const args = ["diff", "--no-color"];
      if (staged) args.push("--cached");
      if (path) args.push("--", toRepoPath(path));
      const r = await git(cfg, args);
      if (!r.ok) return gitFail(r);
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
      const patchRes = await git(cfg, ["show", "--no-color", "--format=", rev]);
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
        "set remotes=true to include remote-tracking branches. Read-only.",
      inputSchema: {
        remotes: z.boolean().optional().describe("Include remote-tracking branches (default false)"),
      },
    },
    async ({ remotes }) => {
      const args = ["branch", "--no-color", `--format=%(refname:short)${UNIT}%(objectname:short)${UNIT}%(HEAD)`];
      if (remotes) args.push("--all");
      const r = await git(cfg, args);
      if (!r.ok) return gitFail(r);
      let current: string | null = null;
      const branches = r.stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [name, short_sha, head] = line.split(UNIT);
          const isCurrent = head.trim() === "*";
          if (isCurrent) current = name;
          return { name, short_sha, current: isCurrent, remote: name.startsWith("remotes/") };
        });
      return ok({ current, branches, count: branches.length });
    },
  );

  // ---- vcs_blame -----------------------------------------------------------
  server.registerTool(
    "vcs_blame",
    {
      title: "Git blame",
      description:
        "Per-line last-change attribution for a file: for each line, the short commit, author, ISO date, and the " +
        "line text. Optionally restrict to a [start,end] line range (1-based, inclusive). Read-only.",
      inputSchema: {
        path: z.string().describe("File to blame (res:// or repo-relative)"),
        start: z.number().int().positive().optional().describe("First line (1-based, inclusive)"),
        end: z.number().int().positive().optional().describe("Last line (1-based, inclusive)"),
      },
    },
    async ({ path, start, end }) => {
      const args = ["blame", "--line-porcelain"];
      if (start != null || end != null) args.push("-L", `${start ?? 1},${end ?? "$"}`);
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
        "Stage changes for the next commit. With `paths`, stages exactly those (res:// or repo-relative); " +
        "omit `paths` to stage everything (git add -A). Returns the resulting staged file list. Reversible " +
        "with vcs_restore-staged / `git restore --staged`, so not gated.",
      inputSchema: {
        paths: z.array(z.string()).optional().describe("Paths to stage (res:// or repo-relative). Omit to stage all."),
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
        "elicitation-gated: pass confirm:true to bypass the prompt on clients that can't elicit.",
      inputSchema: {
        paths: z.array(z.string()).min(1).describe("Paths to discard changes for (res:// or repo-relative)"),
        confirm: z.boolean().optional().describe("Skip the confirmation prompt"),
      },
    },
    async ({ paths, confirm }) => {
      const rels = paths.map(toRepoPath);
      const blocked = await gate(server, confirm, `Discard working-tree changes to: ${rels.join(", ")}`);
      if (blocked) return blocked;
      const r = await git(cfg, ["restore", "--", ...rels]);
      if (!r.ok) return gitFail(r);
      return ok({ restored: rels, count: rels.length });
    },
  );

  // ---- vcs_stash — push/pop/list ungated; drop GATED (destroys an entry) ----
  server.registerTool(
    "vcs_stash",
    {
      title: "Git stash",
      description:
        "Manage stashes: op='push' saves and reverts your working changes (optional message); 'pop' " +
        "re-applies the latest stash; 'list' returns the stash entries; 'drop' deletes a stash entry. " +
        "Only 'drop' is destructive and elicitation-gated (confirm:true bypasses); push/pop/list are not.",
      inputSchema: {
        op: z.enum(["push", "pop", "list", "drop"]).describe("Stash operation"),
        message: z.string().optional().describe("Message for op='push'"),
        ref: z.string().optional().describe("Stash ref for op='drop'/'pop', e.g. stash@{1} (default latest)"),
        confirm: z.boolean().optional().describe("Skip the confirmation prompt (op='drop')"),
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
      // push / pop
      const args = op === "push"
        ? ["stash", "push", ...(message ? ["-m", message] : [])]
        : ["stash", "pop", ...(ref ? [ref] : [])];
      const r = await git(cfg, args);
      if (!r.ok) return gitFail(r);
      return ok({ op, message: r.stdout.trim() || `${op} ok`, stashes: [] });
    },
  );

  // ---- vcs_branch_create — ungated (reversible) ----------------------------
  server.registerTool(
    "vcs_branch_create",
    {
      title: "Git branch (create)",
      description:
        "Create a new branch, optionally starting from a given ref (default HEAD), and optionally switch to " +
        "it. Reversible (`git branch -d`), so not gated. Errors clearly if the branch already exists.",
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
        if (!sw.ok) return gitFail(sw);
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

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerVcsTools } from "../src/tools/vcs.js";
import type { Config } from "../src/config.js";

type Handler = (args: Record<string, unknown>) => Promise<{
  isError?: boolean;
  content?: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
}>;

type Elicit = (req: unknown) => Promise<{ action: string; content?: Record<string, unknown> }>;

/**
 * Register the Group L tools against a recorder and return their handlers. The
 * optional `elicit` backs `server.server.elicitInput` used by the gated tools'
 * `gate()`; default simulates a client that CANNOT elicit (throws), which must
 * make a gated call block rather than proceed.
 */
function setup(projectPath: string, elicit?: Elicit): Record<string, Handler> {
  const handlers: Record<string, Handler> = {};
  const server = {
    registerTool(name: string, _config: unknown, handler: Handler) { handlers[name] = handler; },
    server: { elicitInput: elicit ?? (async () => { throw new Error("no elicitation on this client"); }) },
  };
  registerVcsTools(server as unknown as Parameters<typeof registerVcsTools>[0], { projectPath } as Config);
  return handlers;
}

const ACCEPT: Elicit = async () => ({ action: "accept", content: { proceed: true } });
const DECLINE: Elicit = async () => ({ action: "decline" });

function g(dir: string, ...args: string[]): string {
  return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim();
}

/**
 * A throwaway git repo: two commits on the default branch, then a modified
 * tracked file (unstaged), a staged edit to another file, and one untracked file.
 */
function mkrepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gcb-vcs-"));
  g(dir, "-c", "init.defaultBranch=main", "init", "-q");
  g(dir, "config", "user.email", "test@example.com");
  g(dir, "config", "user.name", "Test User");
  g(dir, "config", "commit.gpgsign", "false");

  fs.writeFileSync(path.join(dir, "player.gd"), "extends Node\nfunc _ready():\n\tpass\n");
  fs.writeFileSync(path.join(dir, "enemy.gd"), "extends Node\n");
  g(dir, "add", "-A");
  g(dir, "commit", "-q", "-m", "initial commit");

  // second commit touching only player.gd, so a path-filtered log can distinguish
  fs.appendFileSync(path.join(dir, "player.gd"), "\nfunc attack():\n\tpass\n");
  g(dir, "add", "player.gd");
  g(dir, "commit", "-q", "-m", "add attack()");

  // working state: staged edit to enemy.gd, unstaged edit to player.gd, one untracked file
  fs.appendFileSync(path.join(dir, "enemy.gd"), "func hit():\n\tpass\n");
  g(dir, "add", "enemy.gd");
  fs.appendFileSync(path.join(dir, "player.gd"), "\n# tweak\n");
  fs.writeFileSync(path.join(dir, "notes.txt"), "scratch\n");
  return dir;
}

function cleanup(dir: string) { fs.rmSync(dir, { recursive: true, force: true }); }

test("vcs_status reports branch, staged/unstaged/untracked and clean=false", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    const r = await h.vcs_status({});
    assert.ok(!r.isError, `unexpected error: ${JSON.stringify(r.content)}`);
    const sc = r.structuredContent as {
      branch: string | null; clean: boolean;
      staged: Array<{ path: string }>; unstaged: Array<{ path: string }>; untracked: string[];
    };
    assert.ok(sc.branch && sc.branch.length > 0, "branch should be resolved");
    assert.equal(sc.clean, false);
    assert.ok(sc.staged.some((e) => e.path === "enemy.gd"), "enemy.gd should be staged");
    assert.ok(sc.unstaged.some((e) => e.path === "player.gd"), "player.gd should be unstaged");
    assert.ok(sc.untracked.includes("notes.txt"), "notes.txt should be untracked");
  } finally { cleanup(dir); }
});

test("vcs_log returns commits newest-first; path filter narrows", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    const all = await h.vcs_log({});
    const sc = all.structuredContent as { commits: Array<{ subject: string; hash: string; short: string }>; count: number };
    assert.equal(sc.count, 2);
    assert.equal(sc.commits[0].subject, "add attack()"); // newest first
    assert.equal(sc.commits[1].subject, "initial commit");
    assert.equal(sc.commits[0].short, sc.commits[0].hash.slice(0, sc.commits[0].short.length));

    const filtered = await h.vcs_log({ path: "enemy.gd" });
    const fsc = filtered.structuredContent as { commits: Array<{ subject: string }>; count: number };
    assert.equal(fsc.count, 1, "enemy.gd only appears in the initial commit");
    assert.equal(fsc.commits[0].subject, "initial commit");

    // res:// prefix is accepted and stripped
    const resFiltered = await h.vcs_log({ path: "res://enemy.gd" });
    assert.equal((resFiltered.structuredContent as { count: number }).count, 1);
  } finally { cleanup(dir); }
});

test("vcs_diff (working tree) lists changed files and includes the hunk; staged mode differs", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    const wt = await h.vcs_diff({});
    const wsc = wt.structuredContent as { files: string[]; patch: string; staged: boolean };
    assert.equal(wsc.staged, false);
    assert.ok(wsc.files.includes("player.gd"), "working-tree diff should show player.gd");
    assert.ok(!wsc.files.includes("enemy.gd"), "enemy.gd change is staged, not in the working-tree diff");
    assert.ok(wsc.patch.includes("# tweak"), "patch should contain the added line");

    const staged = await h.vcs_diff({ staged: true });
    const ssc = staged.structuredContent as { files: string[]; staged: boolean };
    assert.equal(ssc.staged, true);
    assert.ok(ssc.files.includes("enemy.gd"), "staged diff should show enemy.gd");
    assert.ok(!ssc.files.includes("player.gd"), "player.gd is unstaged, not in the staged diff");
  } finally { cleanup(dir); }
});

test("vcs_show returns commit metadata+patch, and a file's content at a ref", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    const commit = await h.vcs_show({});
    const csc = commit.structuredContent as { ref: string; subject: string; patch: string; hash: string };
    assert.equal(csc.ref, "HEAD");
    assert.equal(csc.subject, "add attack()");
    assert.ok(csc.patch.includes("func attack"), "commit patch should include the added function");

    // file mode: player.gd at the FIRST commit had no attack()
    const first = g(dir, "rev-parse", "HEAD~1");
    const fileAtFirst = await h.vcs_show({ ref: first, path: "player.gd" });
    const fsc = fileAtFirst.structuredContent as { content: string; path: string; ref: string };
    assert.equal(fsc.path, "player.gd");
    assert.ok(fsc.content.includes("func _ready"), "content at HEAD~1 should include _ready");
    assert.ok(!fsc.content.includes("func attack"), "content at HEAD~1 should NOT yet include attack()");
  } finally { cleanup(dir); }
});

test("vcs_branch_list flags the current branch", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    const r = await h.vcs_branch_list({});
    const sc = r.structuredContent as { current: string | null; branches: Array<{ name: string; current: boolean }>; count: number };
    assert.ok(sc.count >= 1);
    assert.ok(sc.current, "a current branch should be reported");
    const cur = sc.branches.find((b) => b.current);
    assert.ok(cur && cur.name === sc.current, "the flagged branch matches `current`");
  } finally { cleanup(dir); }
});

test("vcs_blame attributes lines with commit/author/text; line range restricts output", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    const full = await h.vcs_blame({ path: "player.gd" });
    const sc = full.structuredContent as { lines: Array<{ line: number; commit: string; author: string; text: string }>; count: number };
    assert.ok(sc.count >= 3, `expected several blamed lines, got ${sc.count}`);
    assert.equal(sc.lines[0].line, 1);
    assert.ok(sc.lines[0].author === "Test User", "author should be attributed");
    assert.ok(sc.lines.some((l) => l.text.includes("extends Node")), "blamed text should include a source line");

    const ranged = await h.vcs_blame({ path: "player.gd", start: 1, end: 2 });
    const rsc = ranged.structuredContent as { lines: Array<{ line: number }>; count: number };
    assert.equal(rsc.count, 2, "range 1,2 yields exactly two lines");
    assert.deepEqual(rsc.lines.map((l) => l.line), [1, 2]);
  } finally { cleanup(dir); }
});

test("vcs_status errors clearly when the path is not a git work tree", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gcb-vcs-norepo-"));
  try {
    const h = setup(dir);
    const r = await h.vcs_status({});
    assert.equal(r.isError, true);
    assert.match(r.content?.[0].text ?? "", /not a git repository/i);
  } finally { cleanup(dir); }
});

// ---- mutating tools --------------------------------------------------------

test("vcs_add stages a specific path (res:// accepted)", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    const r = await h.vcs_add({ paths: ["res://notes.txt"] });
    assert.ok(!r.isError, JSON.stringify(r.content));
    const staged = (r.structuredContent as { staged: Array<{ path: string }> }).staged.map((e) => e.path);
    assert.ok(staged.includes("notes.txt"), "notes.txt should now be staged");
    // confirmed independently via status
    const st = await h.vcs_status({});
    assert.ok((st.structuredContent as { untracked: string[] }).untracked.length === 0, "nothing untracked after staging notes.txt");
  } finally { cleanup(dir); }
});

test("vcs_commit commits the staged changes and reports the new hash; empty index errors", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    const r = await h.vcs_commit({ message: "stage enemy.gd hit()" });
    assert.ok(!r.isError, JSON.stringify(r.content));
    const sc = r.structuredContent as { committed: boolean; hash: string; short: string; summary: string };
    assert.equal(sc.committed, true);
    assert.match(sc.hash, /^[0-9a-f]{40}$/);
    assert.equal(sc.summary, "stage enemy.gd hit()");
    assert.equal(g(dir, "log", "-1", "--pretty=%s"), "stage enemy.gd hit()");

    // player.gd's unstaged edit + notes.txt were never staged → second commit finds nothing staged
    g(dir, "restore", "--staged", "."); // unstage anything lingering
    g(dir, "stash", "-q", "-u"); // clean the tree so the index is truly empty
    const empty = await h.vcs_commit({ message: "noop" });
    assert.equal(empty.isError, true);
    assert.match(empty.content?.[0].text ?? "", /nothing to commit/i);
  } finally { cleanup(dir); }
});

test("vcs_restore is gated: blocks without elicitation, proceeds on confirm/accept, cancels on decline", async () => {
  // (a) non-eliciting client + no confirm → blocked, file untouched
  let dir = mkrepo();
  try {
    const h = setup(dir); // default elicit throws
    const before = fs.readFileSync(path.join(dir, "player.gd"), "utf8");
    const blocked = await h.vcs_restore({ paths: ["player.gd"] });
    assert.equal(blocked.isError, true);
    assert.match(blocked.content?.[0].text ?? "", /confirm: true/i);
    assert.equal(fs.readFileSync(path.join(dir, "player.gd"), "utf8"), before, "file must be untouched when blocked");
  } finally { cleanup(dir); }

  // (b) confirm:true bypass → discards the unstaged edit
  dir = mkrepo();
  try {
    const h = setup(dir);
    assert.ok(fs.readFileSync(path.join(dir, "player.gd"), "utf8").includes("# tweak"));
    const r = await h.vcs_restore({ paths: ["player.gd"], confirm: true });
    assert.ok(!r.isError, JSON.stringify(r.content));
    assert.ok(!fs.readFileSync(path.join(dir, "player.gd"), "utf8").includes("# tweak"), "the tweak should be discarded");
    const st = await h.vcs_status({});
    assert.ok(!(st.structuredContent as { unstaged: Array<{ path: string }> }).unstaged.some((e) => e.path === "player.gd"));
  } finally { cleanup(dir); }

  // (c) elicit decline → cancelled, file untouched
  dir = mkrepo();
  try {
    const h = setup(dir, DECLINE);
    const before = fs.readFileSync(path.join(dir, "player.gd"), "utf8");
    const r = await h.vcs_restore({ paths: ["player.gd"] });
    assert.equal(r.isError, true);
    assert.match(r.content?.[0].text ?? "", /did not approve|cancelled/i);
    assert.equal(fs.readFileSync(path.join(dir, "player.gd"), "utf8"), before);
  } finally { cleanup(dir); }

  // (d) elicit accept → proceeds
  dir = mkrepo();
  try {
    const h = setup(dir, ACCEPT);
    const r = await h.vcs_restore({ paths: ["player.gd"] });
    assert.ok(!r.isError, JSON.stringify(r.content));
    assert.ok(!fs.readFileSync(path.join(dir, "player.gd"), "utf8").includes("# tweak"));
  } finally { cleanup(dir); }
});

test("vcs_stash push/list/pop work; drop is gated", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir); // default elicit throws (for the drop-block assertion)
    const push = await h.vcs_stash({ op: "push", message: "wip" });
    assert.ok(!push.isError, JSON.stringify(push.content));
    // tracked changes are now stashed → working tree clean of them
    const st = await h.vcs_status({});
    const sc = st.structuredContent as { staged: unknown[]; unstaged: unknown[] };
    assert.equal(sc.staged.length, 0);
    assert.equal(sc.unstaged.length, 0);

    const list = await h.vcs_stash({ op: "list" });
    assert.equal((list.structuredContent as { stashes: unknown[] }).stashes.length, 1);

    // drop without elicitation → blocked, stash still present
    const blockedDrop = await h.vcs_stash({ op: "drop" });
    assert.equal(blockedDrop.isError, true);
    const stillThere = await h.vcs_stash({ op: "list" });
    assert.equal((stillThere.structuredContent as { stashes: unknown[] }).stashes.length, 1, "blocked drop must NOT delete the stash");

    const pop = await h.vcs_stash({ op: "pop" });
    assert.ok(!pop.isError, JSON.stringify(pop.content));
    assert.ok(fs.readFileSync(path.join(dir, "player.gd"), "utf8").includes("# tweak"), "pop restores the working change");
  } finally { cleanup(dir); }
});

test("vcs_branch_create (+switch) and vcs_switch move HEAD between branches", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    const start = (await h.vcs_branch_list({})).structuredContent as { current: string };
    const create = await h.vcs_branch_create({ name: "feature/x", switch: true });
    assert.ok(!create.isError, JSON.stringify(create.content));
    const csc = create.structuredContent as { created: boolean; switched: boolean; name: string };
    assert.equal(csc.created, true);
    assert.equal(csc.switched, true);
    assert.equal((await h.vcs_branch_list({})).structuredContent!.current, "feature/x");

    const back = await h.vcs_switch({ branch: start.current });
    assert.ok(!back.isError, JSON.stringify(back.content));
    assert.equal((back.structuredContent as { branch: string }).branch, start.current);
    assert.equal((await h.vcs_branch_list({})).structuredContent!.current, start.current);

    // creating an existing branch errors clearly
    const dupe = await h.vcs_branch_create({ name: "feature/x" });
    assert.equal(dupe.isError, true);
  } finally { cleanup(dir); }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerVcsTools, restoreOutcome } from "../src/tools/vcs.js";
import type { Config } from "../src/config.js";
import { structured } from "./helpers/structured.js";

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
    const sc = structured<{
      branch: string | null; clean: boolean;
      staged: Array<{ path: string }>; unstaged: Array<{ path: string }>; untracked: string[];
    }>(r);
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
    const sc = structured<{ commits: Array<{ subject: string; hash: string; short: string }>; count: number }>(all);
    assert.equal(sc.count, 2);
    assert.equal(sc.commits[0].subject, "add attack()"); // newest first
    assert.equal(sc.commits[1].subject, "initial commit");
    assert.equal(sc.commits[0].short, sc.commits[0].hash.slice(0, sc.commits[0].short.length));

    const filtered = await h.vcs_log({ path: "enemy.gd" });
    const fsc = structured<{ commits: Array<{ subject: string }>; count: number }>(filtered);
    assert.equal(fsc.count, 1, "enemy.gd only appears in the initial commit");
    assert.equal(fsc.commits[0].subject, "initial commit");

    // res:// prefix is accepted and stripped
    const resFiltered = await h.vcs_log({ path: "res://enemy.gd" });
    assert.equal((structured<{ count: number }>(resFiltered)).count, 1);
  } finally { cleanup(dir); }
});

test("vcs_diff (working tree) lists changed files and includes the hunk; staged mode differs", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    const wt = await h.vcs_diff({});
    const wsc = structured<{ files: string[]; patch: string; staged: boolean }>(wt);
    assert.equal(wsc.staged, false);
    assert.ok(wsc.files.includes("player.gd"), "working-tree diff should show player.gd");
    assert.ok(!wsc.files.includes("enemy.gd"), "enemy.gd change is staged, not in the working-tree diff");
    assert.ok(wsc.patch.includes("# tweak"), "patch should contain the added line");

    const staged = await h.vcs_diff({ staged: true });
    const ssc = structured<{ files: string[]; staged: boolean }>(staged);
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
    const csc = structured<{ ref: string; subject: string; patch: string; hash: string }>(commit);
    assert.equal(csc.ref, "HEAD");
    assert.equal(csc.subject, "add attack()");
    assert.ok(csc.patch.includes("func attack"), "commit patch should include the added function");

    // file mode: player.gd at the FIRST commit had no attack()
    const first = g(dir, "rev-parse", "HEAD~1");
    const fileAtFirst = await h.vcs_show({ ref: first, path: "player.gd" });
    const fsc = structured<{ content: string; path: string; ref: string }>(fileAtFirst);
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
    const sc = structured<{ current: string | null; branches: Array<{ name: string; current: boolean }>; count: number }>(r);
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
    const sc = structured<{ lines: Array<{ line: number; commit: string; author: string; text: string }>; count: number }>(full);
    assert.ok(sc.count >= 3, `expected several blamed lines, got ${sc.count}`);
    assert.equal(sc.lines[0].line, 1);
    assert.ok(sc.lines[0].author === "Test User", "author should be attributed");
    assert.ok(sc.lines.some((l) => l.text.includes("extends Node")), "blamed text should include a source line");

    const ranged = await h.vcs_blame({ path: "player.gd", start: 1, end: 2 });
    const rsc = structured<{ lines: Array<{ line: number }>; count: number }>(ranged);
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
    const staged = (structured<{ staged: Array<{ path: string }> }>(r)).staged.map((e) => e.path);
    assert.ok(staged.includes("notes.txt"), "notes.txt should now be staged");
    // confirmed independently via status
    const st = await h.vcs_status({});
    assert.ok((structured<{ untracked: string[] }>(st)).untracked.length === 0, "nothing untracked after staging notes.txt");
  } finally { cleanup(dir); }
});

test("vcs_commit commits the staged changes and reports the new hash; empty index errors", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    const r = await h.vcs_commit({ message: "stage enemy.gd hit()" });
    assert.ok(!r.isError, JSON.stringify(r.content));
    const sc = structured<{ committed: boolean; hash: string; short: string; summary: string }>(r);
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
    assert.ok(!(structured<{ unstaged: Array<{ path: string }> }>(st)).unstaged.some((e) => e.path === "player.gd"));
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

// 🔴 D5 (155 §2), CARRIED NINETEEN SESSIONS, AND THE THIRD CONFIRMED MEMBER OF THE
// FAMILY AFTER #181, #183 AND #188. `restored` was the REQUEST handed straight back:
// `git restore` exits 0 for a path with nothing to discard, so asking about five files
// of which one was dirty reported all five as restored — from a DESTRUCTIVE, gated tool
// whose entire output is the caller's record of what it just threw away.
//
// 🔴 AND THE BRANCH HAD NEVER RUN. Every pre-existing vcs_restore case restored a path
// that WAS dirty, so no test in the tree had ever put a clean path through it — the fix
// would have been unfalsifiable (173 §8). These two cases are that branch, both
// directions, checked against GIT rather than against the tool's own answer.
test("vcs_restore reports the paths git actually changed, not the paths it was asked about", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir, ACCEPT);
    // enemy.gd's edit is STAGED, so its working tree already matches the index: there is
    // nothing there for `git restore` to discard, and git exits 0 saying exactly that.
    assert.equal(g(dir, "diff", "--name-only"), "player.gd", "fixture: only player.gd is dirty vs the index");

    const r = await h.vcs_restore({ paths: ["player.gd", "enemy.gd"], confirm: true });
    assert.ok(!r.isError, JSON.stringify(r.content));
    const out = structured<{ restored: string[]; count: number; requested: string[]; stranded: string[] }>(r);

    assert.deepEqual(out.restored, ["player.gd"], "only the path git actually changed is reported restored");
    assert.equal(out.count, 1, "count follows the measurement, not the request length");
    assert.deepEqual(out.requested, ["player.gd", "enemy.gd"], "the request survives, labelled as the request");
    assert.deepEqual(out.stranded, [], "nothing was left dirty");

    // checked against git, not against the answer under test
    assert.ok(!fs.readFileSync(path.join(dir, "player.gd"), "utf8").includes("# tweak"), "the unstaged tweak is gone");
    assert.equal(g(dir, "diff", "--name-only"), "", "nothing is dirty vs the index afterwards");
    assert.match(g(dir, "diff", "--cached", "--name-only"), /enemy\.gd/, "enemy.gd's STAGED edit is untouched — restore never reached it");
  } finally { cleanup(dir); }
});

test("vcs_restore over a path with nothing to discard reports zero rather than a discard", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir, ACCEPT);
    const before = fs.readFileSync(path.join(dir, "enemy.gd"), "utf8");
    const r = await h.vcs_restore({ paths: ["enemy.gd"], confirm: true });
    assert.ok(!r.isError, JSON.stringify(r.content));
    const out = structured<{ restored: string[]; count: number; requested: string[]; stranded: string[] }>(r);

    assert.deepEqual(out.restored, [], "a clean path is NOT reported as discarded work");
    assert.equal(out.count, 0, "and the count is zero, which is what the caller needs to see");
    assert.deepEqual(out.requested, ["enemy.gd"], "what was asked for is still reported");
    assert.equal(fs.readFileSync(path.join(dir, "enemy.gd"), "utf8"), before, "the file is byte-identical");
  } finally { cleanup(dir); }
});

// 🔴 THE COLLAPSE CASE GIT WILL NOT PRODUCE ON DEMAND. Both live cases above assert
// `stranded` is EMPTY, and a collector only ever asserted empty is a collector nobody
// has proved collects (173 §6, caught by that session's own reverse sweep). A real
// `git restore` that works never strands anything, so the classification is a pure
// function taking its populations as parameters and these cases hand it the readings
// directly — which is the only way the stranded arm can be constructed at all.
test("restoreOutcome separates restored, requested and stranded from the two readings", () => {
  // the healthy mixed call: one dirty path discarded, one clean path asked about
  const okCase = restoreOutcome(["dirty.gd", "clean.gd"], ["dirty.gd"], []);
  assert.deepEqual(okCase.restored, ["dirty.gd"]);
  assert.equal(okCase.count, 1);
  assert.deepEqual(okCase.requested, ["dirty.gd", "clean.gd"], "the request is carried, not discarded");
  assert.deepEqual(okCase.stranded, []);

  // 🔴 THE ARM THAT PROVES THE COLLECTOR COLLECTS: git said ok, and a path is still dirty
  const stuck = restoreOutcome(["a.gd", "b.gd"], ["a.gd", "b.gd"], ["b.gd"]);
  assert.deepEqual(stuck.restored, ["a.gd"], "a path still dirty afterwards was NOT restored");
  assert.equal(stuck.count, 1, "and it does not count towards the discard");
  assert.deepEqual(stuck.stranded, ["b.gd"], "it is named instead of silently folded into restored");

  // everything stranded: the report must not claim a single discard
  const none = restoreOutcome(["a.gd"], ["a.gd"], ["a.gd"]);
  assert.deepEqual(none.restored, [], "nothing was discarded");
  assert.equal(none.count, 0);
  assert.deepEqual(none.stranded, ["a.gd"]);

  // nothing was dirty to begin with: zero discards, and no stranding either
  const noop = restoreOutcome(["clean.gd"], [], []);
  assert.deepEqual(noop.restored, [], "a clean path is never reported as discarded work");
  assert.equal(noop.count, 0);
  assert.deepEqual(noop.stranded, []);
});

test("vcs_stash push/list/pop work; push and drop are gated", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir); // default elicit throws (for the block assertions)
    // 🔴 282 — `push` IS GATED NOW, and this is the claim that says so. It was
    // ungated on the argument that `pop` undoes it; a probe added in the same
    // session called it unattended and reverted a whole working tree, which is
    // the event `docs/TOOL_CATALOG.md` promises against.
    const blockedPush = await h.vcs_stash({ op: "push", message: "wip" });
    assert.equal(blockedPush.isError, true, "push without confirmation must be blocked");
    assert.match(blockedPush.content?.[0].text ?? "", /confirm: true/);
    assert.equal(g(dir, "stash", "list"), "", "and nothing may have been stashed");

    const push = await h.vcs_stash({ op: "push", message: "wip", confirm: true });
    assert.ok(!push.isError, JSON.stringify(push.content));
    // tracked changes are now stashed → working tree clean of them
    const st = await h.vcs_status({});
    const sc = structured<{ staged: unknown[]; unstaged: unknown[] }>(st);
    assert.equal(sc.staged.length, 0);
    assert.equal(sc.unstaged.length, 0);

    const list = await h.vcs_stash({ op: "list" });
    assert.equal((structured<{ stashes: unknown[] }>(list)).stashes.length, 1);

    // drop without elicitation → blocked, stash still present
    const blockedDrop = await h.vcs_stash({ op: "drop" });
    assert.equal(blockedDrop.isError, true);
    const stillThere = await h.vcs_stash({ op: "list" });
    assert.equal((structured<{ stashes: unknown[] }>(stillThere)).stashes.length, 1, "blocked drop must NOT delete the stash");

    const pop = await h.vcs_stash({ op: "pop" });
    assert.ok(!pop.isError, JSON.stringify(pop.content));
    assert.ok(fs.readFileSync(path.join(dir, "player.gd"), "utf8").includes("# tweak"), "pop restores the working change");
  } finally { cleanup(dir); }
});

test("vcs_branch_create (+switch) and vcs_switch move HEAD between branches", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    const start = structured<{ current: string }>((await h.vcs_branch_list({})));
    const create = await h.vcs_branch_create({ name: "feature/x", switch: true });
    assert.ok(!create.isError, JSON.stringify(create.content));
    const csc = structured<{ created: boolean; switched: boolean; name: string }>(create);
    assert.equal(csc.created, true);
    assert.equal(csc.switched, true);
    assert.equal((await h.vcs_branch_list({})).structuredContent!.current, "feature/x");

    const back = await h.vcs_switch({ branch: start.current });
    assert.ok(!back.isError, JSON.stringify(back.content));
    assert.equal((structured<{ branch: string }>(back)).branch, start.current);
    assert.equal((await h.vcs_branch_list({})).structuredContent!.current, start.current);

    // creating an existing branch errors clearly
    const dupe = await h.vcs_branch_create({ name: "feature/x" });
    assert.equal(dupe.isError, true);
  } finally { cleanup(dir); }
});

// ---- unhappy paths ---------------------------------------------------------
// Everything above drives the happy path. The five below are the states the mkrepo()
// fixture cannot produce; each was a live defect until session 155. The VCS-plane probe
// (test-integration/vcs.integration.mjs) covers them more broadly — these are the guards
// that make `npm test` alone catch a regression.

test("vcs_blame accepts a range bound given ALONE (start without end ran to a git usage error)", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    // player.gd is 6 lines after mkrepo's edits; assert relative to the full blame so the
    // test does not encode the fixture's exact length.
    const full = structured<{ count: number }>((await h.vcs_blame({ path: "player.gd" })));

    const startOnly = await h.vcs_blame({ path: "player.gd", start: 2 });
    assert.ok(!startOnly.isError, `start-without-end must succeed: ${startOnly.content?.[0].text}`);
    const s = structured<{ lines: Array<{ line: number }>; count: number }>(startOnly);
    assert.equal(s.lines[0].line, 2, "start alone begins at `start`");
    assert.equal(s.count, full.count - 1, "and runs to end-of-file");

    const endOnly = await h.vcs_blame({ path: "player.gd", end: 2 });
    assert.ok(!endOnly.isError, `end-without-start must succeed: ${endOnly.content?.[0].text}`);
    assert.deepEqual((structured<{ lines: Array<{ line: number }> }>(endOnly)).lines.map((l) => l.line), [1, 2]);
  } finally { cleanup(dir); }
});

test("vcs_stash push ERRORS when nothing was stashed, and does not create an entry", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    g(dir, "stash", "-q", "-u"); // park everything so the tree is genuinely clean
    g(dir, "stash", "drop", "-q");

    const noop = await h.vcs_stash({ op: "push", message: "nothing", confirm: true });
    assert.equal(noop.isError, true, "a push that stashes nothing must not report success");
    assert.match(noop.content?.[0].text ?? "", /nothing was stashed/i);
    assert.equal(g(dir, "stash", "list"), "", "and no entry may exist");

    // a real change still stashes
    fs.appendFileSync(path.join(dir, "player.gd"), "\n# real\n");
    const real = await h.vcs_stash({ op: "push", message: "real", confirm: true });
    assert.ok(!real.isError, JSON.stringify(real.content));
    assert.match(g(dir, "stash", "list"), /stash@/);

    // with an entry already present, a no-op push must STILL error (the check is OID
    // inequality, not emptiness)
    const noop2 = await h.vcs_stash({ op: "push", message: "still nothing", confirm: true });
    assert.equal(noop2.isError, true);
    assert.match(noop2.content?.[0].text ?? "", /nothing was stashed/i, "the refusal is the no-op one, not the gate's");
    assert.equal(g(dir, "stash", "list").split("\n").length, 1, "and must not add a second entry");
  } finally { cleanup(dir); }
});

test("vcs_branch_create reports the branch it created when the switch is refused", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    // a branch whose content conflicts with an uncommitted local edit
    g(dir, "branch", "other");
    g(dir, "stash", "-q", "-u");
    g(dir, "switch", "-q", "other");
    fs.writeFileSync(path.join(dir, "player.gd"), "wholly different\n");
    g(dir, "add", "-A"); g(dir, "commit", "-q", "-m", "divergent");
    g(dir, "switch", "-q", "-"); // back to the starting branch
    fs.appendFileSync(path.join(dir, "player.gd"), "local edit\n");

    const r = await h.vcs_branch_create({ name: "newbr", from: "other", switch: true });
    assert.equal(r.isError, true, "a refused switch is not a success");
    assert.match(r.content?.[0].text ?? "", /newbr.*WAS created/is, "the error must name the branch it created");
    assert.equal(g(dir, "branch", "--list", "newbr").replace(/^[*+ ]+/, ""), "newbr", "the branch really exists");
    assert.notEqual(g(dir, "rev-parse", "--abbrev-ref", "HEAD"), "newbr", "and HEAD did not move");
  } finally { cleanup(dir); }
});

test("vcs_branch_list reports a detached HEAD as detached, agreeing with vcs_status", async () => {
  const dir = mkrepo();
  try {
    const h = setup(dir);
    g(dir, "stash", "-q", "-u");
    g(dir, "checkout", "-q", "--detach", "HEAD~1");
    const b = structured<{
      current: string | null; detached: boolean; branches: Array<{ name: string }>; count: number;
    }>((await h.vcs_branch_list({})));
    const s = structured<{ branch: string | null }>((await h.vcs_status({})));
    assert.equal(b.current, null, "git's '(HEAD detached at …)' pseudo-entry is not a branch");
    assert.equal(b.detached, true);
    assert.equal(s.branch, b.current, "the two tools must agree");
    assert.ok(!b.branches.some((x) => x.name.startsWith("(")), "no pseudo-entry may be listed");
    assert.equal(b.count, b.branches.length);
  } finally { cleanup(dir); }
});

test("vcs_branch_list flags remote-tracking branches (the prefix test could never match)", async () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "gcb-vcs-bare-"));
  const dir = mkrepo();
  try {
    execFileSync("git", ["-c", "init.defaultBranch=main", "init", "-q", "--bare", bare]);
    g(dir, "remote", "add", "origin", bare);
    g(dir, "push", "-q", "-u", "origin", "HEAD");
    const h = setup(dir);
    const all = structured<{
      branches: Array<{ name: string; remote: boolean; current: boolean }>;
    }>((await h.vcs_branch_list({ remotes: true })));
    const tracking = all.branches.filter((x) => x.remote);
    assert.equal(tracking.length, 1, `exactly one tracking branch expected, got ${JSON.stringify(all.branches)}`);
    assert.match(tracking[0].name, /^origin\//);
    assert.equal(tracking[0].current, false, "a tracking branch is never current");
    assert.ok(all.branches.some((x) => !x.remote && x.current), "the local branch is still there and current");

    const local = structured<{ branches: Array<{ remote: boolean }> }>((await h.vcs_branch_list({})));
    // 🆕 282 — THE FLOOR UNDER THE `every`, which `positive_control_gate` was right
    // about: `[].every(..)` is true, so this claim was equally green against a reader
    // that returned no branches at all — the exact silence the whole gate exists to
    // refuse, one assertion below a `some` that carries its own control.
    assert.ok(local.branches.length >= 1, `remotes=false still lists the local branch, got ${JSON.stringify(local.branches)}`);
    assert.ok(local.branches.every((x) => !x.remote), "remotes=false must not leak tracking branches");
  } finally { cleanup(dir); cleanup(bare); }
});

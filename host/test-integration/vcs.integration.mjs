// VCS-plane integration probe — drives the Group L git tools against REAL throwaway
// git repositories, on the repo states a happy path never reaches.
//
//   vcs_status        (the porcelain=v2 RENAME and UNMERGED arms; the no-commits repo)
//   vcs_branch_list   (detached HEAD; the remote-tracking flag)
//   vcs_blame         (an omitted range bound)
//   vcs_stash         (push that stashes NOTHING; pop into a conflict)
//   vcs_branch_create (a switch refused AFTER the branch was created)
//   vcs_switch        (a refusal that must not move HEAD)
//
// WHY THIS EXISTS
// ---------------
// test/vcs.test.ts already drives real git — this family was never mock-tested, and the
// premise that it was is wrong. What it drives is the HAPPY PATH: a repo with two commits,
// one staged edit, one unstaged edit, one untracked file, and every call shaped to succeed.
//
// Everything below is a state that fixture cannot produce. Five defects were found by
// reaching them, and every one was the same shape #157 fixed in runtime_emit_signal: the
// tool reported success, or reported nothing, for work git had refused or never done.
//
//   D1  vcs_blame's `end ?? "$"` built `-L 3,$`, which git blame rejects (usage, exit 129).
//       `start` without `end` is schema-legal and ALWAYS failed. An omitted end must be
//       the EMPTY field: `-L 3,`.
//   D2  vcs_branch_create(switch:true) ran two git calls and reported only the second.
//       On a refused switch the caller saw a bare checkout error for a branch that now
//       existed — retry, and git says "already exists" about their own branch.
//   D3  vcs_stash push EXITS 0 saying "No local changes to save". Passed through as
//       success, it tells a caller their work is parked when it is not — and the next
//       thing a caller does with a "safely stashed" tree is switch or restore over it.
//   D4  vcs_branch_list listed git's "(HEAD detached at <sha>)" pseudo-entry as a branch
//       and as `current`, while vcs_status reported branch:null for the same repo.
//   D6  the remote flag tested name.startsWith("remotes/") against %(refname:short),
//       which is "origin/main" — never "remotes/…". It could not fire. Under remotes=true,
//       the flag's entire purpose, every branch came back remote:false.
//
// D5 — vcs_restore echoing paths it did not actually change — was carried from 155 §2 to
// 174 as "a steer, not a defect", and this note used to end "it has no assertion here
// either way". 🔴 IT WAS A DEFECT, AND THE NOTE IS WHY IT SURVIVED NINETEEN SESSIONS: a
// thing recorded as deliberately unasserted reads, on every re-reading, as a thing
// already considered. VCS_LIVE_RESTORE_ECHO is that assertion (section 7b).
//
// WHAT MAKES IT COVERAGE RATHER THAN GREEN
// ----------------------------------------
// The load-bearing assertions do not read the tool's own answer back. D2 asks GIT whether
// the branch exists and where HEAD is; D3 compares refs/stash BEFORE and AFTER rather than
// matching git's wording, which is not a stable interface across versions. An
// implementation that returns a plausible envelope fails them.
//
// Needs git and nothing else — no Godot, no port, no game, no matrix. Not part of
// `npm test`; invoked directly by .github/workflows/integration.yml. Exits non-zero on any
// failure.
//
// Markers (grep-able): VCS_LIVE_RENAME / VCS_LIVE_UNMERGED / VCS_LIVE_INITIAL /
// VCS_LIVE_DETACHED / VCS_LIVE_REMOTE / VCS_LIVE_BLAME / VCS_LIVE_STASH_NOOP /
// VCS_LIVE_RESTORE_ECHO / VCS_LIVE_BRANCH_PARTIAL / VCS_LIVE_REFUSALS / VCS_LIVE_NOREPO,
// plus the banners VCS_LIVE_PING / VCS_LIVE_ALL.
// Exit status is the gate (the vcs-plane job in integration.yml).
import { Population } from "./_population.mjs";

// 🔴 THE CLAIM POPULATION, COUNTED (169 §10 item 2). This probe used to end
// `VCS_LIVE_ALL ok every claim held` having counted nothing at all — a sentence
// that is literally true of the empty set. Every section here is a block scope
// inside one file: a block that stops running, or one whose assertions are
// deleted while its marker line survives, leaves the run green and smaller.
//
// The manifest is the ten marker names this probe already printed, so it costs
// no new maintenance surface; `population.seal()` attributes each section's claims to
// the marker that closes it. See `_population.mjs`.
const population = new Population("VCS_LIVE", {
  families: [
    "VCS_LIVE_RENAME", "VCS_LIVE_UNMERGED", "VCS_LIVE_INITIAL", "VCS_LIVE_DETACHED",
    "VCS_LIVE_REMOTE", "VCS_LIVE_BLAME", "VCS_LIVE_STASH_NOOP", "VCS_LIVE_BRANCH_PARTIAL",
    "VCS_LIVE_REFUSALS", "VCS_LIVE_NOREPO", "VCS_LIVE_RESTORE_ECHO",
  ],
  scope: 11,           // 🔴 174: 10 -> 11 with VCS_LIVE_RESTORE_ECHO. The floor moves when the population does.
  claims: 78,          // 🔴 EXACT. 69 + the nine D5 claims — the same number in every environment measured
});
const assert = population.assert;
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerVcsTools } from "../dist/tools/vcs.js";

const repos = [];
function mktemp(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `vcs-probe-${tag}-`));
  repos.push(d);
  return d;
}
process.on("exit", () => {
  for (const d of repos) fs.rmSync(d, { recursive: true, force: true });
});

/** Run git in `dir`, throwing on failure. The probe's independent instrument. */
const g = (dir, ...args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim();
/** Same, but never throws — for the calls whose failure is the point. */
const gq = (dir, ...args) => {
  try {
    return g(dir, ...args);
  } catch (e) {
    return `ERR:${(e.stderr || e.message || "").trim()}`;
  }
};

/** Register the Group L tools against a recorder, exactly as the server does. */
function tools(projectPath, elicit) {
  const handlers = {};
  const server = {
    registerTool(name, _config, handler) {
      handlers[name] = handler;
    },
    server: { elicitInput: elicit ?? (async () => { throw new Error("no elicitation on this client"); }) },
  };
  registerVcsTools(server, { projectPath });
  return handlers;
}

/** A repo with git identity configured and one commit. */
function newRepo(tag, seed = { "a.gd": "extends Node\nfunc _ready():\n\tpass\nline4\nline5\n" }) {
  const d = mktemp(tag);
  g(d, "-c", "init.defaultBranch=main", "init", "-q");
  g(d, "config", "user.email", "probe@example.com");
  g(d, "config", "user.name", "Probe User");
  g(d, "config", "commit.gpgsign", "false");
  for (const [f, body] of Object.entries(seed)) fs.writeFileSync(path.join(d, f), body);
  g(d, "add", "-A");
  g(d, "commit", "-q", "-m", "initial");
  return d;
}

const stashOid = (d) => gq(d, "rev-parse", "--quiet", "--verify", "refs/stash");
const sc = (r) => r.structuredContent ?? {};
const txt = (r) => r.content?.[0]?.text ?? "";

console.log(`VCS_LIVE_PING ok ${execFileSync("git", ["--version"], { encoding: "utf8" }).trim()}`);

// 1) The porcelain=v2 RENAME arm ("2 " lines), with SPACES in both names. This parser
//    branch slices a different field offset than the ordinary one and splits on a TAB;
//    nothing in the repo had ever executed it.
{
  const d = newRepo("rename", { "old name.gd": "x\n".repeat(40) });
  g(d, "mv", "old name.gd", "new name.gd");
  const h = tools(d);
  const s = sc(await h.vcs_status({}));
  const raw = g(d, "status", "--porcelain=v2", "--branch").split("\n").filter((l) => l.startsWith("2 "));
  assert.equal(raw.length, 1, "the fixture must actually produce a rename record");
  assert.deepEqual(
    s.staged,
    [{ path: "new name.gd", status: "R" }],
    `rename must report the NEW path only, spaces intact — got ${JSON.stringify(s.staged)}`,
  );
  assert.deepEqual(s.unstaged, [], "a staged-only rename must not appear as unstaged");
  assert.equal(s.clean, false);
  population.seal("VCS_LIVE_RENAME", "ok staged rename reports the new path with its space, not the tab-joined pair");
}

// 2) The UNMERGED arm ("u " lines). Requires a real conflicted merge.
{
  const d = newRepo("unmerged", { "c.gd": "base\n" });
  g(d, "branch", "side");
  fs.writeFileSync(path.join(d, "c.gd"), "main side\n");
  g(d, "add", "-A");
  g(d, "commit", "-q", "-m", "m");
  g(d, "switch", "-q", "side");
  fs.writeFileSync(path.join(d, "c.gd"), "other side\n");
  g(d, "add", "-A");
  g(d, "commit", "-q", "-m", "s");
  const merged = gq(d, "merge", "main");
  assert.ok(merged.startsWith("ERR:"), "the fixture must actually conflict");
  const h = tools(d);
  const s = sc(await h.vcs_status({}));
  assert.deepEqual(s.unmerged, ["c.gd"], `conflicted path must land in unmerged — got ${JSON.stringify(s)}`);
  assert.equal(s.clean, false, "a repo mid-conflict is never clean");
  population.seal("VCS_LIVE_UNMERGED", "ok a conflicted path lands in unmerged[] and forces clean=false");
}

// 3) A repo with NO commits. `# branch.oid (initial)` must become null rather than the
//    literal string, and vcs_log must fail LEGIBLY rather than answer "no commits".
{
  const d = mktemp("initial");
  g(d, "-c", "init.defaultBranch=main", "init", "-q");
  g(d, "config", "user.email", "probe@example.com");
  g(d, "config", "user.name", "Probe User");
  fs.writeFileSync(path.join(d, "n.gd"), "x\n");
  const h = tools(d);
  const s = sc(await h.vcs_status({}));
  assert.equal(s.oid, null, "the (initial) sentinel must be null, not a string");
  assert.equal(s.branch, "main", "an unborn branch still has a name");
  assert.deepEqual(s.untracked, ["n.gd"]);
  const log = await h.vcs_log({});
  assert.equal(log.isError, true, "log on an unborn branch must ERROR, not answer 'no commits'");
  assert.match(txt(log), /does not have any commits/i);
  population.seal("VCS_LIVE_INITIAL", "ok unborn branch: oid null, branch named, log errors legibly");
}

// 4) D4 — DETACHED HEAD. git emits a "(HEAD detached at <sha>)" pseudo-entry from
//    `git branch`; it is not a branch and vcs_switch could never reach it. The old code
//    reported it as `current`, contradicting vcs_status on the very same repo.
{
  const d = newRepo("detached");
  fs.writeFileSync(path.join(d, "a.gd"), "second\n");
  g(d, "add", "-A");
  g(d, "commit", "-q", "-m", "second");
  g(d, "checkout", "-q", "--detach", "HEAD~1");
  assert.ok(gq(d, "symbolic-ref", "-q", "HEAD").startsWith("ERR:"), "the fixture must be detached");
  const h = tools(d);
  const b = sc(await h.vcs_branch_list({}));
  const s = sc(await h.vcs_status({}));
  assert.equal(b.current, null, `detached HEAD has no current branch — got ${JSON.stringify(b.current)}`);
  assert.equal(b.detached, true, "detached must be reported, not merely absent");
  assert.equal(s.branch, b.current, "vcs_branch_list and vcs_status must AGREE about detachment");
  assert.deepEqual(b.branches.map((x) => x.name), ["main"], "the pseudo-entry must not be listed as a branch");
  assert.equal(b.count, b.branches.length, "count must match the list it describes");
  // and the same repo, re-attached, must go back to naming the branch
  g(d, "switch", "-q", "main");
  const back = sc(await h.vcs_branch_list({}));
  assert.equal(back.current, "main");
  assert.equal(back.detached, false);
  population.seal("VCS_LIVE_DETACHED", "ok current null + detached true, no pseudo-branch, and it agrees with vcs_status");
}

// 5) D6 — the remote-tracking flag. Needs a real second repository to push to.
{
  const bare = mktemp("bare");
  g(bare, "-c", "init.defaultBranch=main", "init", "-q", "--bare");
  const d = newRepo("remote");
  g(d, "remote", "add", "origin", bare);
  g(d, "push", "-q", "-u", "origin", "main");
  const h = tools(d);
  const all = sc(await h.vcs_branch_list({ remotes: true }));
  const local = sc(await h.vcs_branch_list({}));
  const byName = Object.fromEntries(all.branches.map((x) => [x.name, x]));
  assert.ok(byName["origin/main"], `remotes=true must list the tracking branch — got ${JSON.stringify(all.branches)}`);
  assert.equal(byName["origin/main"].remote, true, "a remote-tracking branch must be flagged remote:true");
  assert.equal(byName["main"].remote, false, "a local branch must not be flagged remote");
  assert.equal(byName["main"].current, true);
  assert.equal(byName["origin/main"].current, false, "a tracking branch is never current");
  assert.deepEqual(local.branches.map((x) => x.name), ["main"], "remotes=false must not leak the tracking branch");
  population.seal("VCS_LIVE_REMOTE", "ok origin/main flagged remote:true, local main remote:false, and remotes=false excludes it");
}

// 6) D1 — vcs_blame with an omitted range bound. `start` alone is schema-legal and used
//    to build `-L 3,$`, which git blame rejects outright.
{
  const d = newRepo("blame");
  const h = tools(d);
  const full = sc(await h.vcs_blame({ path: "a.gd" }));
  assert.equal(full.count, 5, "the fixture is five lines");

  const startOnly = await h.vcs_blame({ path: "a.gd", start: 3 });
  assert.ok(!startOnly.isError, `start-without-end must succeed — got ${txt(startOnly)}`);
  assert.deepEqual(
    sc(startOnly).lines.map((l) => l.line),
    [3, 4, 5],
    "start alone must run to end-of-file, not stop at line 3",
  );

  const endOnly = await h.vcs_blame({ path: "a.gd", end: 2 });
  assert.ok(!endOnly.isError, `end-without-start must succeed — got ${txt(endOnly)}`);
  assert.deepEqual(sc(endOnly).lines.map((l) => l.line), [1, 2]);

  const both = sc(await h.vcs_blame({ path: "a.gd", start: 2, end: 4 }));
  assert.deepEqual(both.lines.map((l) => l.line), [2, 3, 4]);

  // the range is a WINDOW on the file, not a re-numbering: line numbers stay absolute
  assert.equal(both.lines[0].text, full.lines[1].text, "ranged line 2 must be the file's line 2");
  assert.equal(sc(startOnly).lines[0].author, "Probe User", "attribution survives the range");
  population.seal("VCS_LIVE_BLAME", "ok start-alone runs to EOF, end-alone starts at 1, and both keep absolute line numbers");
}

// 7) D3 — vcs_stash push that stashes NOTHING. git exits 0 here; the verdict must come
//    from refs/stash moving, not from git's wording.
{
  const d = newRepo("stash");
  const h = tools(d);

  const before = stashOid(d);
  assert.ok(before.startsWith("ERR:"), "a fresh repo has no stash ref");
  const noop = await h.vcs_stash({ op: "push", message: "nothing here" });
  assert.equal(noop.isError, true, `a push that stashes nothing must ERROR — got ${JSON.stringify(sc(noop))}`);
  assert.match(txt(noop), /nothing was stashed/i);
  assert.ok(stashOid(d).startsWith("ERR:"), "and it must genuinely not have created an entry");
  assert.equal(gq(d, "stash", "list"), "", "git's own view must agree the stash list is empty");

  // untracked-only is ALSO nothing: `git stash push` without -u does not take it
  fs.writeFileSync(path.join(d, "fresh.txt"), "untracked\n");
  const untracked = await h.vcs_stash({ op: "push", message: "untracked only" });
  assert.equal(untracked.isError, true, "an untracked-only tree stashes nothing and must error");
  assert.ok(fs.existsSync(path.join(d, "fresh.txt")), "and the untracked file must still be there");

  // a REAL change still stashes, and reverts the working tree
  fs.appendFileSync(path.join(d, "a.gd"), "\n# real edit\n");
  const real = await h.vcs_stash({ op: "push", message: "real work" });
  assert.ok(!real.isError, `a real change must stash — got ${txt(real)}`);
  const after = stashOid(d);
  assert.ok(!after.startsWith("ERR:") && after !== before, "refs/stash must actually have moved");
  assert.ok(
    !fs.readFileSync(path.join(d, "a.gd"), "utf8").includes("# real edit"),
    "push must revert the working tree, not merely record it",
  );
  assert.equal(sc(await h.vcs_stash({ op: "list" })).stashes.length, 1);

  // a second no-op push, with an entry ALREADY present, must still error — the check is
  // OID inequality, not emptiness
  const noop2 = await h.vcs_stash({ op: "push", message: "still nothing" });
  assert.equal(noop2.isError, true, "a no-op push must error even when a stash already exists");
  assert.equal(stashOid(d), after, "and must not have added a second entry");

  const pop = await h.vcs_stash({ op: "pop" });
  assert.ok(!pop.isError, `pop must restore — got ${txt(pop)}`);
  assert.ok(fs.readFileSync(path.join(d, "a.gd"), "utf8").includes("# real edit"), "pop must bring the edit back");
  population.seal("VCS_LIVE_STASH_NOOP", "ok clean and untracked-only pushes error with refs/stash untouched; a real push moves it and reverts the tree");
}

// 7b) 🔴 D5 — vcs_restore echoing paths it did not change. Carried since 155 §2 as a
//     "steer, not a defect", and this file's own header used to record that it had no
//     assertion either way. It is the third confirmed member of #181/#183/#188's family:
//     `git restore` exits 0 for a path with nothing to discard, so the REQUEST echoed
//     back reported work discarded that was never touched — from the destructive tool
//     whose output is the caller's only record of what it just threw away.
//
//     Asked of GIT: the mixed case, one dirty path and one clean one in a single call.
{
  const d = newRepo("restoreecho", { "dirty.gd": "extends Node\n", "clean.gd": "extends Node\n" });
  fs.appendFileSync(path.join(d, "dirty.gd"), "# discard me\n");
  const h = tools(d, async () => ({ action: "accept", content: { proceed: true } }));

  assert.equal(g(d, "diff", "--name-only"), "dirty.gd", "the fixture must have exactly one dirty path");
  const cleanBefore = fs.readFileSync(path.join(d, "clean.gd"), "utf8");

  const r = await h.vcs_restore({ paths: ["dirty.gd", "clean.gd"], confirm: true });
  assert.ok(!r.isError, `the restore must succeed — got ${txt(r)}`);
  const out = sc(r);

  assert.deepEqual(out.restored, ["dirty.gd"], `only the path git changed may be reported restored — got ${JSON.stringify(out.restored)}`);
  assert.equal(out.count, 1, "count follows the measurement, not the number of paths asked about");
  assert.deepEqual(out.requested, ["dirty.gd", "clean.gd"], "the request survives, labelled as the request");
  assert.deepEqual(out.stranded, [], "nothing may be left dirty");

  // and the verdict is checked against git rather than against the answer under test
  assert.equal(g(d, "diff", "--name-only"), "", "the working tree must be clean vs the index afterwards");
  assert.ok(!fs.readFileSync(path.join(d, "dirty.gd"), "utf8").includes("# discard me"), "the edit must actually be gone");
  assert.equal(fs.readFileSync(path.join(d, "clean.gd"), "utf8"), cleanBefore, "the clean file must be byte-identical");
  population.seal("VCS_LIVE_RESTORE_ECHO", "ok a clean path in a mixed call is absent from restored[] rather than reported as discarded work");
}

// 8) D2 — vcs_branch_create(switch:true) where the switch is refused AFTER the branch
//    exists. Asked of GIT, not of the tool's own answer.
{
  const d = newRepo("partial");
  g(d, "branch", "other");
  g(d, "switch", "-q", "other");
  fs.writeFileSync(path.join(d, "a.gd"), "wholly different content\n");
  g(d, "add", "-A");
  g(d, "commit", "-q", "-m", "divergent");
  g(d, "switch", "-q", "main");
  fs.appendFileSync(path.join(d, "a.gd"), "uncommitted local edit\n");

  const h = tools(d);
  const r = await h.vcs_branch_create({ name: "newbr", from: "other", switch: true });
  assert.equal(r.isError, true, "a refused switch is not a success");
  assert.match(txt(r), /newbr.*WAS created/is, `the error must NAME the branch it created — got ${txt(r)}`);
  assert.match(txt(r), /would be overwritten/i, "and must still carry git's own reason");
  // the load-bearing half: ask git, not the tool
  assert.equal(
    g(d, "branch", "--list", "newbr").replace(/^[*+ ]+/, ""),
    "newbr",
    "the branch must genuinely exist — that is what makes silence a defect",
  );
  assert.equal(g(d, "rev-parse", "--abbrev-ref", "HEAD"), "main", "HEAD must NOT have moved");
  assert.equal(g(d, "rev-parse", "newbr"), g(d, "rev-parse", "other"), "and it must have been created at `from`");
  assert.ok(
    fs.readFileSync(path.join(d, "a.gd"), "utf8").includes("uncommitted local edit"),
    "the local edit that blocked the switch must be untouched",
  );

  // the clean path still works and still reports switched:true
  g(d, "checkout", "-q", "--", "a.gd");
  const clean = await h.vcs_branch_create({ name: "cleanbr", switch: true });
  assert.ok(!clean.isError, `an unblocked create+switch must succeed — got ${txt(clean)}`);
  assert.equal(sc(clean).switched, true);
  assert.equal(g(d, "rev-parse", "--abbrev-ref", "HEAD"), "cleanbr", "and HEAD must really be there");
  population.seal("VCS_LIVE_BRANCH_PARTIAL", "ok a refused switch names the branch it created, leaves HEAD put, and the clean path still switches");
}

// 9) The refusals that were already correct, held to account so they stay that way.
{
  const d = newRepo("refuse");
  g(d, "branch", "other");
  g(d, "switch", "-q", "other");
  fs.writeFileSync(path.join(d, "a.gd"), "divergent\n");
  g(d, "add", "-A");
  g(d, "commit", "-q", "-m", "d");
  g(d, "switch", "-q", "main");
  fs.appendFileSync(path.join(d, "a.gd"), "local\n");
  const h = tools(d);

  const sw = await h.vcs_switch({ branch: "other" });
  assert.equal(sw.isError, true, "git refuses this switch; the tool must not claim it happened");
  assert.equal(g(d, "rev-parse", "--abbrev-ref", "HEAD"), "main", "HEAD must not have moved");
  assert.ok(fs.readFileSync(path.join(d, "a.gd"), "utf8").includes("local"), "nothing may be clobbered");

  const missing = await h.vcs_switch({ branch: "no-such-branch" });
  assert.equal(missing.isError, true, "switching to a branch that does not exist must error");

  // stash pop into a conflict: errors, and MUST keep the entry
  const d2 = newRepo("popconflict", { "a.gd": "base\n" });
  const h2 = tools(d2);
  fs.writeFileSync(path.join(d2, "a.gd"), "stashed version\n");
  assert.ok(!(await h2.vcs_stash({ op: "push", message: "w" })).isError);
  fs.writeFileSync(path.join(d2, "a.gd"), "conflicting version\n");
  g(d2, "add", "-A");
  g(d2, "commit", "-q", "-m", "conflict");
  const popped = await h2.vcs_stash({ op: "pop" });
  assert.equal(popped.isError, true, "a conflicting pop must error");
  assert.match(gq(d2, "stash", "list"), /stash@/, "and MUST NOT drop the entry it failed to apply");
  population.seal("VCS_LIVE_REFUSALS", "ok a refused switch leaves HEAD and the tree alone; a conflicting pop keeps the stash");
}

// 10) The not-a-repo path is the one shape every tool in the family shares. One tool
//     proves the plumbing for all twelve.
{
  const d = mktemp("norepo");
  const h = tools(d);
  const r = await h.vcs_status({});
  assert.equal(r.isError, true);
  assert.match(txt(r), /not a git repository/i);
  assert.match(txt(r), /not inside a git work tree/i, "the host's hint must survive into the message");
  population.seal("VCS_LIVE_NOREPO", "ok a non-repo path errors with git's reason and the host's hint");
}

// 🔴 THE POPULATION GATE, before the sentence that used to be unconditional.
const claims = population.reportOrDie();
console.log(`VCS_LIVE_ALL ok every claim held (${claims} claim(s) ran)`);

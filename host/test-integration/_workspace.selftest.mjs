// _workspace.selftest.mjs — THE GATE ON THE CLEANUP THAT PROVES ITSELF.
//
// `_workspace.mjs` decides what AUTH_CLEAN means. Its own header states the property
// the whole design rests on:
//
//   "diff() is computed AFTER restore() and compares content hashes, not just names.
//    It is what PROVES the restore actually worked instead of merely running."
//
// 173 §11.2 flagged that nothing had ever blinded it. Measured in 174 before a line of
// fix, over every headless gate in the tree — `npm test`, the tautology gate, both
// self-tests, the instrument gate and `contract_check.py`:
//
//     BLIND174 _workspace.mjs   6 of 6 STILL GREEN
//
// Six of six, because the module is imported in exactly one place — a probe that boots
// the Godot editor GUI under Xvfb — which is `_path_ledger.mjs`'s gap one file over.
//
// 🔴 AND THE SEAM IS SHARPER THAN THE ABSENCE. `restoreDir` decides what to REMOVE from
// `walk()`; `diffDir` decides what APPEARED from `walk()`. Same enumerator, both
// directions. diffDir re-HASHES independently — that is the half #141 and #143 were
// about, and it is real — but it does not re-ENUMERATE independently. Measured:
//
//     walk() blinded   restore removed 0 · diff reported 0 added · AUTH_CLEAN PASSES
//                      and three artefacts were still sitting in the tree
//
// So the check and the thing it checks share a blind spot, and the check cannot see it.
// Two answers, and this file is only the first: every case below is a population that
// is healthy or one that collapsed in a named way, with the verdict written down before
// the code ran (169 §2). The second is `scripts/instrument_gate.py`, which points a
// blinding harness at this module — the seam is what a self-test cannot pin, because a
// self-test calls the enumerator it would need to distrust.
//
// Dependency-free (node builtins only), same as the module under test.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { snapshotDir, restoreDir, diffDir, describeDiff, blindWalk } from "./_workspace.mjs";

let failures = 0;
const claims = [];
function check(cond, name, detail = "") {
  claims.push(name);
  if (cond) { console.log(`  ok   ${name}${detail ? ` — ${detail}` : ""}`); return true; }
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
  return false;
}

// ── fixtures ───────────────────────────────────────────────────────────────────
const roots = [];
function mkroot() {
  const r = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wsselftest-")));
  roots.push(r);
  return r;
}
function put(root, rel, body) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  return abs;
}
/** Everything actually on disk, relative and sorted — the independent reading that
 *  every claim about restore is checked against, so no claim leans on the module's
 *  own view of the tree to decide whether the module was right. */
function onDisk(root, rel = "") {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const r = rel ? path.join(rel, e.name) : e.name;
    if (e.isDirectory()) { out.push(r + "/"); out.push(...onDisk(root, r)); }
    else out.push(r);
  }
  return out.sort();
}
const sorted = (xs) => [...xs].sort().join(",");

// ──────────────────────────────────────────────────── what the snapshot records
console.log("\n-- snapshotDir: the population it holds --");
{
  const root = mkroot();
  put(root, "a.txt", "alpha");
  put(root, "nested/b.txt", "beta");
  put(root, "nested/deep/c.txt", "gamma");
  const s = snapshotDir(root);

  check(s.files.size === 3, "SNAP_COUNTS every file at every depth", `${s.files.size} file(s)`);
  check(sorted(s.files.keys()) === ["a.txt", "nested/b.txt", "nested/deep/c.txt"].join(","),
    "SNAP_KEYS are relative paths, not absolute", sorted(s.files.keys()));
  check(sorted(s.dirs) === ["nested", "nested/deep"].join(","), "SNAP_DIRS records every directory too", sorted(s.dirs));
  check(s.root === root, "SNAP_ROOT is carried on the snapshot, so restore cannot be pointed elsewhere");

  const a = s.files.get("a.txt");
  check(a.bytes instanceof Buffer && a.bytes.toString() === "alpha", "SNAP_KEEPS_BYTES a small file's contents are held for restore");
  check(/^[0-9a-f]{64}$/.test(a.hash), "SNAP_HASHES with sha256, not a size or an mtime", a.hash.slice(0, 12) + "…");
  check(a.size === 5, "SNAP_SIZE is the byte length", `${a.size}`);
}
{
  // 🔴 THE CASE THAT MAKES A BLIND WALK DISTINGUISHABLE FROM A SMALL ONE. An empty
  // snapshot is a legitimate answer for an empty tree and an illegitimate one for a
  // populated tree, and NOTHING IN THE SHAPE TELLS THEM APART — which is why the probe
  // floors `files.size` at the call site rather than trusting the module.
  const root = mkroot();
  const s = snapshotDir(root);
  check(s.files.size === 0 && s.dirs.size === 0, "SNAP_EMPTY an empty tree snapshots empty — and reads identically to a blind walk");
  const missing = snapshotDir(path.join(root, "does-not-exist"));
  check(missing.files.size === 0, "SNAP_ABSENT_ROOT a root that is not there is empty, not a throw");
}
{
  const root = mkroot();
  put(root, "keep.txt", "kept");
  put(root, ".godot/cache.bin", "engine churn");
  put(root, ".git/HEAD", "ref: refs/heads/main");
  put(root, "node_modules/pkg/index.js", "module.exports={}");
  const s = snapshotDir(root);
  check(s.files.size === 1 && s.files.has("keep.txt"), "SNAP_SKIPS the engine cache, .git and node_modules", sorted(s.files.keys()));
  check(!s.dirs.has(".godot") && !s.dirs.has(".git") && !s.dirs.has("node_modules"),
    "SNAP_SKIPS_DIRS ...and does not record the skipped directories either", sorted(s.dirs));
}

// ────────────────────────────────────────────────── the large-file sentinel path
//
// MAX_KEPT_BYTES is 8MiB. Above it the module records a `size:` sentinel instead of the
// contents and — by its own comment — "cannot rewrite it and says so instead of
// pretending". Both halves of that promise are asserted here; neither had ever run,
// because no probe artefact is anywhere near 8MiB.
console.log("\n-- the file too large to hold --");
{
  const root = mkroot();
  const big = path.join(root, "big.bin");
  fs.writeFileSync(big, Buffer.alloc(9 * 1024 * 1024, 7));
  const s = snapshotDir(root);
  const rec = s.files.get("big.bin");
  check(rec.bytes === null, "BIG_NOT_HELD contents above the cap are not kept in memory");
  check(rec.hash === `size:${9 * 1024 * 1024}`, "BIG_SENTINEL the hash is a size sentinel, not sha256", rec.hash);

  fs.appendFileSync(big, "x");
  const r = restoreDir(s);
  check(r.rewritten.length === 0, "BIG_NOT_REWRITTEN a file it never held is not rewritten from nothing");
  check(r.failed.length === 1 && r.failed[0].path === "big.bin" && /too large/.test(r.failed[0].why),
    "BIG_SAYS_SO ...and the failure is NAMED rather than silently skipped", JSON.stringify(r.failed));
  const d = diffDir(s);
  check(d.modified.includes("big.bin") && d.clean === false, "BIG_DIFF_SEES_IT the sentinel still detects the change", describeDiff(d));
}

// ──────────────────────────────────────────────────────── restoreDir: the actions
console.log("\n-- restoreDir: removes, rewrites, rmdirs --");
{
  const root = mkroot();
  put(root, "tracked.txt", "original");
  put(root, "vanishes.txt", "also original");
  const s = snapshotDir(root);

  // the probe runs: adds, modifies, deletes, and makes nested directories
  put(root, "_auth_probe_1.tres", "artefact");
  put(root, "new/deep/_asset_probe_2.tres", "artefact");
  fs.writeFileSync(path.join(root, "tracked.txt"), "clobbered");
  fs.rmSync(path.join(root, "vanishes.txt"));

  const r = restoreDir(s);
  check(sorted(r.removed) === ["_auth_probe_1.tres", "new/deep/_asset_probe_2.tres"].join(","),
    "RESTORE_REMOVES exactly the files that appeared", sorted(r.removed));
  check(sorted(r.rewritten) === ["tracked.txt", "vanishes.txt"].join(","),
    "RESTORE_REWRITES both the modified file and the deleted one", sorted(r.rewritten));
  check(sorted(r.rmdir) === ["new", "new/deep"].join(","), "RESTORE_RMDIR removes the directories that appeared", sorted(r.rmdir));
  check(r.failed.length === 0, "RESTORE_NO_FAILURES on a tree it can fully undo");

  // 🔴 CHECKED AGAINST THE FILESYSTEM, NOT AGAINST restoreDir's OWN REPORT. #188's
  // whole family is reports that describe an action rather than its result.
  check(sorted(onDisk(root)) === ["tracked.txt", "vanishes.txt"].join(","),
    "RESTORE_TRUE the tree on disk is the tree the snapshot recorded", sorted(onDisk(root)));
  check(fs.readFileSync(path.join(root, "tracked.txt"), "utf8") === "original",
    "RESTORE_CONTENT ...and the rewritten file holds its original bytes");
}

{
  // Order is load-bearing: rmdir on a non-empty directory fails, so children must go
  // before parents. Asserted as an ORDER, not as a set — the set claim above passes
  // whichever way round they come out.
  const root = mkroot();
  const s = snapshotDir(root);
  put(root, "a/b/c/leaf.txt", "x");
  const r = restoreDir(s);
  check(r.rmdir.join(",") === ["a/b/c", "a/b", "a"].join(","), "RESTORE_RMDIR_DEEPEST_FIRST children are removed before their parents", r.rmdir.join(","));
  check(r.failed.length === 0 && onDisk(root).length === 0, "RESTORE_RMDIR_TRUE ...and the tree is empty on disk afterwards", sorted(onDisk(root)));
}
{
  // 🔴 THE SAFETY PROPERTY THE HEADER CLAIMS AND NOTHING HAD EVER TESTED: a developer's
  // own untracked scratch is in the snapshot, is therefore not "new", and is never
  // touched — including a file whose name the old `rm -rf` glob would have matched.
  const root = mkroot();
  put(root, "_auth_probe_MINE.tres", "a developer's own file, named like an artefact");
  put(root, "scratch/notes.md", "hand-written");
  const s = snapshotDir(root);
  put(root, "_auth_probe_1.tres", "the probe's");
  const r = restoreDir(s);
  check(r.removed.join(",") === "_auth_probe_1.tres", "RESTORE_SPARES_PREEXISTING only paths that appeared are removed", r.removed.join(","));
  check(fs.readFileSync(path.join(root, "_auth_probe_MINE.tres"), "utf8").startsWith("a developer's"),
    "RESTORE_SPARES_LOOKALIKE ...even one named exactly like the artefacts the old glob matched");
  check(r.rmdir.length === 0, "RESTORE_SPARES_DIRS a pre-existing directory is not removed either");
}

// ─────────────────────────────────────── restoreDir: the collector, POPULATED
//
// 🔴 173 §6's corollary, earned by that session's own reverse sweep: A COLLECTOR YOU
// ONLY EVER ASSERT IS EMPTY IS A COLLECTOR NOBODY HAS PROVED COLLECTS. Every claim
// above asserts `failed.length === 0`. These two make it come back non-empty and NAMED,
// so `failed` is proved to collect before anything is allowed to rely on it being bare.
console.log("\n-- restoreDir: the failure collector, proved to collect --");
{
  const root = mkroot();
  put(root, "becomes-a-dir.txt", "was a file");
  const s = snapshotDir(root);
  // the path is still there, but it is no longer a file — so the rewrite cannot land
  fs.rmSync(path.join(root, "becomes-a-dir.txt"));
  fs.mkdirSync(path.join(root, "becomes-a-dir.txt"));

  const r = restoreDir(s);
  check(r.failed.length === 1, "FAILED_COLLECTS one entry, not an empty list", JSON.stringify(r.failed));
  check(r.failed[0].path === "becomes-a-dir.txt", "FAILED_NAMES_THE_PATH so the report says which one", r.failed[0]?.path);
  check(/^write:/.test(r.failed[0].why || ""), "FAILED_NAMES_THE_REASON and which operation could not be done", r.failed[0]?.why);
  check(r.rewritten.length === 0, "FAILED_NOT_ALSO_REWRITTEN a path cannot be both restored and failed");
}

// ────────────────────────────────────────── diffDir: each population, one at a time
//
// `clean` is a conjunction of four lists. A conjunction asserted only in its true state
// is the same tautology as a collector asserted only empty, so each population is made
// to fire ALONE and `clean` is required to go false for each of them by itself.
console.log("\n-- diffDir: four populations, each alone --");
{
  const root = mkroot();
  put(root, "tracked.txt", "original");
  const s = snapshotDir(root);
  check(diffDir(s).clean === true, "DIFF_CLEAN_UNTOUCHED an unchanged tree is clean");

  put(root, "appeared.txt", "new");
  let d = diffDir(s);
  check(d.added.join(",") === "appeared.txt" && d.clean === false, "DIFF_ADDED alone flips clean to false", describeDiff(d));
  fs.rmSync(path.join(root, "appeared.txt"));

  fs.writeFileSync(path.join(root, "tracked.txt"), "changed");
  d = diffDir(s);
  check(d.modified.join(",") === "tracked.txt" && d.added.length === 0 && d.clean === false,
    "DIFF_MODIFIED alone flips clean to false", describeDiff(d));
  fs.writeFileSync(path.join(root, "tracked.txt"), "original");

  fs.rmSync(path.join(root, "tracked.txt"));
  d = diffDir(s);
  check(d.missing.join(",") === "tracked.txt" && d.clean === false, "DIFF_MISSING alone flips clean to false", describeDiff(d));
  put(root, "tracked.txt", "original");

  fs.mkdirSync(path.join(root, "newdir"));
  d = diffDir(s);
  check(d.dirs.join(",") === "newdir" && d.added.length === 0 && d.clean === false,
    "DIFF_NEWDIR alone flips clean to false — an empty directory is residue too", describeDiff(d));
  fs.rmdirSync(path.join(root, "newdir"));
  check(diffDir(s).clean === true, "DIFF_CLEAN_RETURNS once every population is empty again");
}
{
  // A modified file is not also a missing one: liveHash's null-vs-mismatch branches
  // decide which list a path lands in, and both are asserted.
  const root = mkroot();
  put(root, "f.txt", "a");
  const s = snapshotDir(root);
  fs.rmSync(path.join(root, "f.txt"));
  fs.mkdirSync(path.join(root, "f.txt"));
  const d = diffDir(s);
  check(d.missing.join(",") === "f.txt" && d.modified.length === 0,
    "DIFF_NOT_A_FILE a path that is no longer a file reads as missing, not modified", describeDiff(d));
}

// ──────────────────────────────────────────────────────────── describeDiff bounds
console.log("\n-- describeDiff --");
{
  check(describeDiff({ added: [], modified: [], missing: [], dirs: [] }) === "nothing",
    "DESC_NOTHING a clean diff describes itself as nothing, not as an empty string");
  const d = { added: ["a", "b"], modified: ["m"], missing: ["x"], dirs: ["n"] };
  const s = describeDiff(d);
  check(/added=a,b/.test(s) && /modified=m/.test(s) && /missing=x/.test(s) && /newdirs=n/.test(s),
    "DESC_NAMES every non-empty population appears with its label", s);
  const many = describeDiff({ added: ["1", "2", "3", "4", "5", "6", "7", "8"], modified: [], missing: [], dirs: [] }, 6);
  check(/added=1,2,3,4,5,6\+2/.test(many), "DESC_BOUNDED the list is capped and the remainder is COUNTED, not dropped", many);
  check(describeDiff({ added: ["only"], modified: [], missing: [], dirs: [] }, 6) === "added=only",
    "DESC_NO_SUFFIX_UNDER_LIMIT nothing is appended when nothing was elided");
}

// ────────────────────────────────────────────────────── the round trip, end to end
//
// What the probe actually does, in one claim: snapshot, make a mess of every shape the
// authoring families make, restore, and require BOTH the module's verdict and an
// independent listing of the filesystem to agree that the tree came back.
console.log("\n-- the round trip --");
{
  const root = mkroot();
  put(root, "project.godot", "[application]");
  put(root, "demo/scene.tscn", "[gd_scene]");
  put(root, "addons/plugin/plugin.cfg", "[plugin]");
  const before = onDisk(root);
  const s = snapshotDir(root);

  for (let i = 0; i < 12; i++) put(root, `_auth_probe_${i}.tres`, `artefact ${i}`);
  for (let i = 0; i < 4; i++) put(root, `generated/sub${i}/_asset_probe_${i}.tres.uid`, "uid://abc");
  fs.writeFileSync(path.join(root, "project.godot"), "[application]\nedited=true");
  fs.rmSync(path.join(root, "demo/scene.tscn"));

  const r = restoreDir(s);
  const d = diffDir(s);
  check(r.removed.length === 16, "TRIP_REMOVED all sixteen artefacts", `${r.removed.length}`);
  check(r.rewritten.length === 2, "TRIP_REWROTE the edited file and the deleted one", `${r.rewritten.length}`);
  check(r.rmdir.length === 5, "TRIP_RMDIR generated/ and its four children", `${r.rmdir.length}`);
  check(d.clean === true, "TRIP_DIFF_CLEAN the module's own verdict is clean", describeDiff(d));
  check(onDisk(root).join(",") === before.join(","),
    "TRIP_DISK_IDENTICAL and an independent listing agrees, byte for byte", onDisk(root).join(","));
}

// ────────────────────────────── the SEAM, constructible at last (181, from 180 §6)
//
// 🔴 THE HEADER ABOVE HAS SAID SINCE 174 THAT A SELF-TEST CANNOT PIN THIS, AND IT WAS
// RIGHT ABOUT `walk` AND WRONG ABOUT THE SEAM. 181 measured the case the module's own
// prose describes, and found the caller's floor does not reach it:
//
//     snapshot=6 (AUTH_SNAPSHOT_FILE_FLOOR = 70 is on THIS) · restore removed=0
//     diff clean=true · added=0 · …and the artefact was still on disk
//
// `instrument_gate.py` blinds `walk` and IS caught — but a GLOBAL blind empties
// `snapshotDir` too, so the caller's floor catches that one and the late blind, the one
// that survives the floor, was never constructible. Lifting the comparison out as a pure
// `blindWalk(snap, nowFiles, missing)` makes it constructible from three arguments,
// 173's move for `ledgerScopeFailures` applied to this seam. Every case below states its
// verdict before the code runs (169 §2).
console.log("\n-- blindWalk: the second reading, checked against the first --");
{
  const snapOf = (rels) => ({ root: "/x", files: new Map(rels.map((r) => [r, { hash: "h", size: 1, bytes: null }])), dirs: new Set() });

  // HEALTHY: the walk saw everything the snapshot holds.
  check(blindWalk(snapOf(["a", "b", "c"]), ["a", "b", "c"], []).length === 0,
    "BLIND_HEALTHY an agreeing pair of readings reports nothing");
  // …and an addition is not this population's business.
  check(blindWalk(snapOf(["a"]), ["a", "new"], []).length === 0,
    "BLIND_ADDED_IS_NOT_BLIND a file the walk found and the snapshot lacks is `added`, not blind");
  // TOTALLY QUIET: the case that passed as clean.
  check(sorted(blindWalk(snapOf(["a", "b"]), [], [])) === "a,b",
    "BLIND_TOTAL a walk that enumerated nothing is caught by the files liveHash still sees");
  // ONE SUBTREE QUIET: the realistic shape — a SKIP_DIRS entry, an unreadable directory,
  // a readdir that threw into walk's `catch { return; }`.
  check(sorted(blindWalk(snapOf(["a", "sub/b", "sub/c"]), ["a"], [])) === "sub/b,sub/c",
    "BLIND_SUBTREE a walk quiet over ONE directory is caught, not only a wholly blind one");
  // 🔴 AND THE HALF THAT STOPS IT CRYING WOLF. A file the probe legitimately deleted is
  // `null` from liveHash, lands in `missing`, and must NOT also be reported here — two
  // populations naming one fact is 175's "a measurement that got bigger without its
  // population growing".
  check(blindWalk(snapOf(["a", "gone"]), ["a"], ["gone"]).length === 0,
    "BLIND_EXCLUDES_MISSING a file liveHash says is GONE is `missing`, and is not double-reported");
  check(sorted(blindWalk(snapOf(["a", "gone", "unseen"]), ["a"], ["gone"])) === "unseen",
    "BLIND_MISSING_AND_BLIND_TOGETHER the two populations separate cleanly when both are non-empty");
}
{
  // 🔴 AND THE WIRE INTO `clean`, WHICH IS THE PART A MUTANT DELETES. `blind` alone
  // being correct is worth nothing if the verdict never reads it — 174 §8 / 176's G3 /
  // 180 §7.1, the same wire four sessions running. Driven through the REAL diffDir with
  // a snapshot naming a file that is on disk but outside the walked root, which is the
  // one shape that reaches this branch without monkey-patching anything.
  const root = mkroot();
  put(root, "a.txt", "alpha");
  const outside = mkroot();
  const body = "not under root";
  put(outside, "elsewhere.txt", body);
  const s = snapshotDir(root);
  // 🔴 THE RECORDED HASH IS THE REAL ONE, SO `modified` STAYS EMPTY. A fixture with a
  // wrong hash flips `clean` for TWO reasons at once and the claim below would hold with
  // the new term deleted — 173's G3 / 176's two-conditions-never-apart, which is the
  // failure this whole file exists to make constructible. `blind` is the ONLY non-empty
  // population here.
  s.files.set("../" + path.basename(outside) + "/elsewhere.txt", {
    hash: crypto.createHash("sha256").update(body).digest("hex"), size: body.length, bytes: Buffer.from(body),
  });
  const d = diffDir(s);
  check(d.blind.length === 1, "BLIND_REACHES_DIFF diffDir returns the population", describeDiff(d));
  // Compared as a VALUE, not as four `!x.length` conjuncts — the tautology gate flagged
  // the first draft of this line as `bare truthiness (presence only)` x4 and was right
  // to. `describeDiff` over the same diff with `blind` emptied is "nothing" exactly when
  // the other four populations are, and it prints what it saw when it is not.
  check(describeDiff({ ...d, blind: [] }) === "nothing",
    "BLIND_ALONE the other four populations are empty, so the next claim isolates this one",
    describeDiff({ ...d, blind: [] }));
  check(d.clean === false, "🔴 BLIND_FLIPS_CLEAN and the verdict READS it — a walk nobody can trust is not a clean tree");
  check(/UNENUMERATED/.test(describeDiff(d)),
    "BLIND_IS_REPORTED describeDiff names it, and names it differently from the other four (174 §5)",
    describeDiff(d));
}

// ─────────────────────────────────────────────────────── population + summary
//
// This file has a population of its own, for the reason every other gate here does: a
// self-test that silently stopped running most of its cases would pass.
const SELFTEST_CLAIM_FLOOR = 48;   // 181: 38 -> 48 (the blindWalk section), measured 58
// 🔴 AND THE FLOOR'S OWN VALUE IS PINNED (181, from 180 §11.3). 180 §7.3 found this
// exact hole in `_path_ledger.selftest.mjs` and closed it there; the §11.3 sweep asked
// every other floor in the tree the same question and this file was one of the two that
// answered badly. A `<` floor with nothing asserting what it IS can be zeroed
// invisibly — the run passes, the population line prints, and the only thing that
// changed is that the floor stopped being one.
check(SELFTEST_CLAIM_FLOOR === 48, "SELFTEST_FLOOR_PINNED the claim floor is 48, not whatever it was last set to");
console.log(`\nWORKSPACE_SELFTEST_CLAIMS ${claims.length} (floor ${SELFTEST_CLAIM_FLOOR})`);
if (claims.length < SELFTEST_CLAIM_FLOOR) {
  console.log(`  FAIL WORKSPACE_SELFTEST_POPULATION — only ${claims.length} claim(s) ran, floor is ${SELFTEST_CLAIM_FLOOR}`);
  failures++;
}
if (new Set(claims).size !== claims.length) {
  const dupes = claims.filter((c, i) => claims.indexOf(c) !== i);
  console.log(`  FAIL WORKSPACE_SELFTEST_POPULATION — two claims share a name, so one of them is not being read: ${[...new Set(dupes)].join(", ")}`);
  failures++;
}

for (const r of roots) { try { fs.rmSync(r, { recursive: true, force: true }); } catch { /* scratch */ } }

if (failures) {
  console.error(`::error::WORKSPACE_SELFTEST FAILED — ${failures} claim(s) did not hold; AUTH_CLEAN's verdict is not trustworthy`);
  process.exit(1);
}
console.log(`\nWORKSPACE_SELFTEST ok every claim held (${claims.length} claim(s) ran)`);

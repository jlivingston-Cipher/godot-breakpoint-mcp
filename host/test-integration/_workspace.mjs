// _workspace.mjs — snapshot / restore / diff for the live probes that mutate a REAL project.
//
// WHY THIS EXISTS. The authoring probe writes ~30 real files into example/ —
// _auth_probe_*.tres, _asset_probe_*.tres, the codegen .gd files, export_presets.cfg,
// default_bus_layout.tres — plus the .uid and .import siblings the editor mints for
// them, and it edits project.godot. In CI that is harmless: the runner is thrown away.
// On a developer machine it is not. Every local run left the tree dirty and the next
// run started from a polluted project, so the documented recovery was a hand-typed
// `rm -rf` glob narrow enough not to delete tracked .uid sidecars by accident.
//
// The glob was also the wrong SHAPE of fix. It enumerated the artefacts known at the
// time it was written, which means every family added since had to remember to extend
// it, and nothing ever checked that it had. This module inverts that: it records what
// the directory looked like BEFORE the probe ran and puts it back afterwards, so the
// artefact list is DISCOVERED rather than maintained. A family added tomorrow is
// cleaned up by construction.
//
// Two properties worth stating, because both are load-bearing:
//
//   * Files that were already there — including a developer's own untracked scratch —
//     are in the snapshot, are therefore not "new", and are never touched. Only paths
//     that appeared while the probe was running are removed. This is strictly safer
//     than the glob, which would happily match a real file named _auth_probe_*.
//   * diff() is computed AFTER restore() and compares content hashes, not just names.
//     It is what proves the restore actually worked instead of merely running — the
//     same distinction #141 and #143 were both about. If a future family writes
//     somewhere restore() cannot undo, the diff names the leftover and the assertion
//     that consumes it fails.
//
// .godot/ is skipped: it is the engine's own import cache, it is gitignored, it churns
// on every editor focus for reasons that have nothing to do with the probe, and
// restoring it would fight the editor rather than clean up after ourselves.
//
// Dependency-free (node builtins only), same as _png.mjs.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/** Directories never walked, restored or reported. */
const SKIP_DIRS = new Set([".godot", ".git", "node_modules"]);

/** Above this, contents are not held in memory — the hash still detects a change,
 *  but restore() cannot rewrite it and says so instead of pretending. */
const MAX_KEPT_BYTES = 8 * 1024 * 1024;

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

/** Recursively list files and dirs under `root`, relative-path keyed. */
function walk(root, rel, files, dirs) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return; // vanished mid-walk — treated as absent, which is the truth
  }
  for (const e of entries) {
    const r = rel ? path.join(rel, e.name) : e.name;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      dirs.push(r);
      walk(root, r, files, dirs);
    } else if (e.isFile()) {
      files.push(r);
    }
    // symlinks / sockets / fifos: not something either probe creates; left alone.
  }
}

/**
 * Record the current state of `root`.
 * @returns {{root: string, files: Map<string, {hash: string, size: number, bytes: Buffer|null}>, dirs: Set<string>}}
 */
export function snapshotDir(root) {
  const files = [], dirs = [];
  walk(root, "", files, dirs);
  const map = new Map();
  for (const rel of files) {
    let bytes = null, size = 0, hash = "";
    try {
      const st = fs.statSync(path.join(root, rel));
      size = st.size;
      if (size <= MAX_KEPT_BYTES) {
        bytes = fs.readFileSync(path.join(root, rel));
        hash = sha(bytes);
      } else {
        hash = `size:${size}`; // cheap sentinel; big binaries are not probe artefacts
      }
    } catch { continue; }
    map.set(rel, { hash, size, bytes });
  }
  return { root, files: map, dirs: new Set(dirs) };
}

/** Current hash of a file, or null if it is gone / unreadable. */
function liveHash(abs, size) {
  try {
    const st = fs.statSync(abs);
    if (!st.isFile()) return null;
    if (st.size > MAX_KEPT_BYTES) return `size:${st.size}`;
    return sha(fs.readFileSync(abs));
  } catch { return null; }
}

/**
 * Put `root` back the way `snap` found it.
 * Removes files/dirs that appeared, rewrites files that changed or vanished.
 * @returns {{removed: string[], rewritten: string[], rmdir: string[], failed: {path: string, why: string}[]}}
 */
export function restoreDir(snap) {
  const out = { removed: [], rewritten: [], rmdir: [], failed: [] };
  const nowFiles = [], nowDirs = [];
  walk(snap.root, "", nowFiles, nowDirs);

  // 1. files that appeared -> delete
  for (const rel of nowFiles) {
    if (snap.files.has(rel)) continue;
    try { fs.rmSync(path.join(snap.root, rel), { force: true }); out.removed.push(rel); }
    catch (e) { out.failed.push({ path: rel, why: `unlink: ${e?.message || e}` }); }
  }
  // 2. files that changed or vanished -> rewrite from the snapshot
  for (const [rel, rec] of snap.files) {
    const abs = path.join(snap.root, rel);
    if (liveHash(abs, rec.size) === rec.hash) continue;
    if (!rec.bytes) { out.failed.push({ path: rel, why: "changed but too large to have been kept" }); continue; }
    try {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, rec.bytes);
      out.rewritten.push(rel);
    } catch (e) { out.failed.push({ path: rel, why: `write: ${e?.message || e}` }); }
  }
  // 3. dirs that appeared -> remove, deepest first so children go before parents
  for (const rel of nowDirs.filter((d) => !snap.dirs.has(d)).sort((a, b) => b.length - a.length)) {
    try { fs.rmdirSync(path.join(snap.root, rel)); out.rmdir.push(rel); }
    catch (e) { out.failed.push({ path: rel, why: `rmdir: ${e?.message || e}` }); }
  }
  return out;
}

/**
 * What still differs from `snap`. Run this AFTER restoreDir to prove it worked.
 * @returns {{added: string[], modified: string[], missing: string[], dirs: string[], blind: string[], clean: boolean}}
 */
export function diffDir(snap) {
  const nowFiles = [], nowDirs = [];
  walk(snap.root, "", nowFiles, nowDirs);
  const added = nowFiles.filter((r) => !snap.files.has(r));
  const modified = [], missing = [];
  for (const [rel, rec] of snap.files) {
    const h = liveHash(path.join(snap.root, rel), rec.size);
    if (h === null) missing.push(rel);
    else if (h !== rec.hash) modified.push(rel);
  }
  const dirs = nowDirs.filter((d) => !snap.dirs.has(d));
  // ONE call, read into ONE binding, ORed into `clean` exactly like the other four.
  // Computing it twice would leave a copy a mutant could delete with the verdict intact
  // — 174 §8 / 176's G3 / 180 §7.1, which is the same wire three sessions running.
  const blind = blindWalk(snap, nowFiles, missing);
  return {
    added, modified, missing, dirs, blind,
    clean: !added.length && !modified.length && !missing.length && !dirs.length && !blind.length,
  };
}

/**
 * 🔴 THE SEAM, CHECKED AT THE COMPARISON RATHER THAN AT THE CALLER (181, from 180 §6).
 *
 * `AUTH_SNAPSHOT_FILE_FLOOR = 70` in `authoring-plane.integration.mjs` floors the FIRST
 * walk — the one `snapshotDir` runs before anything connects. `restoreDir` and `diffDir`
 * each walk AGAIN, ~120 seconds later, and nothing floored either of those. Measured:
 *
 *     snapshot=6 (the floor is on THIS) · restore removed=0 · diff clean=true
 *     …and the artefact was still on disk
 *
 * A floor could not close it. A floor is a literal about a population's SIZE, and this
 * module's fixtures are three rows while the live tree is seventy-odd, so any literal
 * that held here would be meaningless there (180 §6's `pop` parameter, one file over).
 * `instrument_gate.py` blinds `walk` and IS caught — but it blinds it for the whole run,
 * so `snapshotDir` empties too and the caller's floor catches that. The hazard is the
 * enumerator going quiet AFTER the population floor has already been satisfied, and a
 * global blind cannot construct it.
 *
 * What closes it is that this module already holds TWO independent readings of the same
 * tree: `walk()` enumerates, and `liveHash()` stats each snapshot path by name without
 * consulting the walk at all. So they can be made to check each other, with no literal
 * and nothing to maintain:
 *
 *   every snapshot file that `liveHash` says is STILL THERE must have been enumerated.
 *
 * A walk that goes quiet — wholly, or over one subtree, or only on the second call —
 * fails that immediately. A file the probe legitimately deleted is `null` from
 * `liveHash`, lands in `missing`, and is excluded here so the two populations never
 * double-report the same fact. Symlinks cannot appear on the snapshot side: `walk`
 * records only `isFile()` entries, so nothing `liveHash` follows can be in `snap.files`
 * without the walk having seen it first.
 *
 * 🔴 EXPORTED, AND PURE, FOR 173's REASON AND 180 §8's. A self-test cannot blind
 * `walk` — it is module-private and the self-test would be calling the enumerator it
 * needs to distrust. Lifting the comparison out as a pure function makes the COLLAPSED
 * case constructible from three plain arguments, which is the only way this population
 * gets covered: like a floor, `blind` is reachable only from a tree that is already
 * wrong, so a live run can never redden on it and `instrument_gate.py` blinding it can
 * never be covered by anything but the self-test below.
 */
export function blindWalk(snap, nowFiles, missing) {
  const enumerated = new Set(nowFiles);
  const gone = new Set(missing);
  return [...snap.files.keys()].filter((rel) => !gone.has(rel) && !enumerated.has(rel));
}

/** One-line, bounded summary for a marker's detail field. */
export function describeDiff(d, limit = 6) {
  const parts = [];
  const some = (label, xs) => { if (xs.length) parts.push(`${label}=${xs.slice(0, limit).join(",")}${xs.length > limit ? `+${xs.length - limit}` : ""}`); };
  some("added", d.added); some("modified", d.modified); some("missing", d.missing); some("newdirs", d.dirs);
  // 🔴 `blind` IS REPORTED TOO. A message that reports less than it checked is 174 §5,
  // and this is the only line a reader of a failed AUTH_CLEAN ever sees. Labelled
  // differently from the other four on purpose: the others say the tree is dirty, this
  // one says the reading is not trustworthy, and those want different next steps.
  some("UNENUMERATED", d.blind || []);
  return parts.join(" ") || "nothing";
}

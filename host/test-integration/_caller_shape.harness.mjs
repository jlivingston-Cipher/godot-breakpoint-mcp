// _caller_shape.harness.mjs — THE LIVE AXIS FOR THE THREE INSTRUMENTS WHOSE ONLY CALLER
// BOOTS THE EDITOR.
//
// WHY THIS EXISTS. 182 put the late blind — "answer honestly once, return the empty for
// every call after that" — to all 51 targets of `instrument_gate.py` over two axes, and
// the axis that found all four real defects was the LIVE one: for five of the eight
// instruments the shipped gate IS the caller and runs headless, so the blind lands in the
// shape the defect actually has. `_workspace.mjs`, `_png.mjs` and `_population.mjs` have
// no live axis at all. They are imported only by probes that boot the Godot editor under
// Xvfb, so their late blind ran against the SELF-TEST, and 182 §11.2 handed the gap over
// in one sentence: the self-test cannot reproduce the caller's shape.
//
// 🔴 AND THE SHAPE IS THE WHOLE POINT, BECAUSE IT IS WHAT A SELF-TEST STRUCTURALLY CANNOT
// HAVE. A self-test calls a module with fixtures and asserts its return values, so every
// call is its own verdict and a function that stops answering after the first call is
// caught by the second assertion. The caller does something different in TIME:
//
//     t=0   derive a population and FLOOR it          (snapshotDir -> 84 files >= 70)
//     ...   do the work the floor was permission for  (write 30, modify one, delete one)
//     t=1   RE-DERIVE and take a verdict from that    (restoreDir + diffDir -> clean?)
//
// A blind that fires at t=0 is caught by the floor. A blind that fires only at t=1 is
// caught by nothing the floor can see, and that is the class 181 §6 found sitting in this
// exact module: `AUTH_SNAPSHOT_FILE_FLOOR = 70` floors the FIRST of three walks, and the
// second and third — 120 seconds later, inside `restoreDir` and `diffDir` — were floored
// by nothing. This file is that shape, minus the editor.
//
// 🔴 WHAT THIS IS NOT. It is not the authoring probe and it does not claim the probe's
// coverage. It drives a TEMP TREE, not a real Godot project; it never connects to the
// bridge; it decodes PNGs it authored rather than frames a rasterizer drew. The one thing
// it reproduces is the shape above, and the one thing it adds that the probe cannot have
// is GROUND TRUTH — it knows what the tree held and what the image contained, so it can
// check the module's answer against the world instead of against itself.
//
// 🔴 AND THAT IS WHY EVERY VERDICT HERE IS TAKEN FROM AN INDEPENDENT READING. `census()`
// below walks the tree with its own recursion and hashes with its own call to crypto; it
// does not import one line of `_workspace.mjs`. That duplication is deliberate and it is
// the entire load-bearing idea: a verdict derived from the module under test cannot
// witness that module going quiet — which is 174's finding about `restoreDir` and
// `diffDir` sharing one enumerator, one level out. If `census()` is ever "simplified" to
// call `snapshotDir`, this file stops being a gate and becomes a tautology.
//
// Dependency-free (node builtins only), same as the three modules it drives.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";

import { snapshotDir, restoreDir, diffDir, describeDiff } from "./_workspace.mjs";
import { decodePng, sampleDistinctColours } from "./_png.mjs";
import { Population } from "./_population.mjs";

// ── the population, driven exactly as a WRAPPED-FAMILY probe drives it ───────────────
const pop = new Population("SHAPE", {
  families: ["SHAPE_TREE", "SHAPE_RESTORE", "SHAPE_PNG", "SHAPE_POP"],
  scope: 4,
  claims: 20,   // measured 29 (24 + the four verdicts SHAPE_POP takes on the tally instance + the roster-floor pin)
});
const assert = pop.assert;

let failures = 0;
const fail = (marker, detail) => { failures++; console.log(`  FAIL ${marker} ${detail}`); };
const onThrow = (label, why) => fail(`${label}_THREW`, why);

// 🔴 THE INDEPENDENT CLAIM COUNT (the ground truth for `_population.mjs` itself). Every
// `assert.*` call below counts one claim through the proxy; `made` counts the same call
// sites here, in two lines that share nothing with the instrument. `report()`'s `claims=`
// is then a number that can be CHECKED rather than believed — which is the only way a
// counter that drifts DOWN while staying above its floor is visible from outside itself.
let made = 0;
const ok = (cond, marker, detail = "") => { made++; assert.ok(cond, `${marker} ${detail}`); };
const eq = (a, b, marker) => { made++; assert.deepEqual(a, b, marker); };

// ── an INDEPENDENT census: this file's own walk, this file's own hash ────────────────
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

/**
 * Every regular file under `root`, relative path -> content hash, plus every directory.
 *
 * 🔴 DUPLICATED ON PURPOSE — see the header. This is the only reading in the file that
 * `instrument_gate.py` never blinds, so it is the only reading that can testify about a
 * blinded one.
 */
function census(root) {
  const files = new Map();
  const dirs = new Set();
  const SKIP = new Set([".godot", ".git", "node_modules"]);
  const rec = (rel) => {
    let entries;
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const r = rel ? path.join(rel, e.name) : e.name;
      if (e.isDirectory()) {
        if (SKIP.has(e.name)) continue;
        dirs.add(r);
        rec(r);
      } else if (e.isFile()) {
        try { files.set(r, sha(fs.readFileSync(path.join(root, r)))); } catch { /* vanished */ }
      }
    }
  };
  rec("");
  return { files, dirs };
}

/** Two censuses compared as VALUES — the differences, named, not a boolean. */
function censusDiff(before, after) {
  const added = [...after.files.keys()].filter((r) => !before.files.has(r));
  const missing = [...before.files.keys()].filter((r) => !after.files.has(r));
  const modified = [...before.files.keys()].filter(
    (r) => after.files.has(r) && after.files.get(r) !== before.files.get(r));
  const newdirs = [...after.dirs].filter((d) => !before.dirs.has(d));
  const lostdirs = [...before.dirs].filter((d) => !after.dirs.has(d));
  return { added, missing, modified, newdirs, lostdirs,
           identical: !added.length && !missing.length && !modified.length
                      && !newdirs.length && !lostdirs.length };
}

const describeCensus = (c, limit = 6) => {
  const parts = [];
  const some = (l, xs) => { if (xs.length) parts.push(`${l}=${xs.slice(0, limit).join(",")}${xs.length > limit ? `+${xs.length - limit}` : ""}`); };
  some("added", c.added); some("missing", c.missing); some("modified", c.modified);
  some("newdirs", c.newdirs); some("lostdirs", c.lostdirs);
  return parts.join(" ") || "identical";
};

// ── the tree ─────────────────────────────────────────────────────────────────────────
//
// Shaped like the thing the real caller floors: a Godot project's worth of files spread
// over enough directories that a walk which quietly loses one SUBTREE is distinguishable
// from one that loses everything.
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "bp-caller-shape-"));
const TREE_DIRS = ["scenes", "scenes/levels", "scripts", "scripts/ui", "assets",
                   "assets/sprites", "assets/audio", "addons", "addons/thing",
                   "addons/thing/icons", "tests", "tests/fixtures"];
const TREE_FILES = 84;

function buildTree() {
  for (const d of TREE_DIRS) fs.mkdirSync(path.join(ROOT, d), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "project.godot"), '[application]\nconfig/name="shape"\n');
  for (let i = 0; i < TREE_FILES - 1; i++) {
    const d = TREE_DIRS[i % TREE_DIRS.length];
    fs.writeFileSync(path.join(ROOT, d, `f${i}.txt`), `original ${i}\n`.repeat(1 + (i % 5)));
  }
}

// 🔴 THE FLOORS, AND THEIR OWN VALUES PINNED (180 §11.3 / 181 §7). A `<` floor with
// nothing asserting what it IS can be zeroed invisibly: the run passes, the line prints,
// and the only thing that changed is that the floor stopped being one. These two mirror
// `authoring-plane.integration.mjs`'s AUTH_SNAPSHOT_FILE_FLOOR / _DIR_FLOOR, because the
// point of the harness is that the SHAPE matches — a floor an order of magnitude below
// the caller's would leave the t=0 half untestable while still reading `ok`.
const SHAPE_SNAPSHOT_FILE_FLOOR = 70;
const SHAPE_SNAPSHOT_DIR_FLOOR = 8;

// 🔴 A ROSTER **AND** A FLOOR, WHICH IS 183 §9's FINDING TURNED ON THIS FILE. `LATE_LIVE`
// was a list with nothing under it, so deleting three entries removed an entire axis while
// every printed number still read ok. This roster has exactly that shape: delete the tally
// instance and its entry below — 183 §9's "three lines" again — and the harness drops from
// 42 claims to 31, prints two healthy population lines instead of three, and says nothing
// at all, because `claims: 20` has the headroom to absorb it. `_population.mjs` has THREE
// shapes and this file exists to drive all three.
//
// Declared here rather than beside the check that reads it, because the floor's own value
// is pinned inside SHAPE_POP and a `const` at the bottom of the file is in its temporal
// dead zone while the families run. Floors live with floors.
const POPULATION_LINES = ["SHAPE_SEAL_POPULATION", "SHAPE_TALLY_POPULATION", "SHAPE_POPULATION"];
const POPULATION_LINES_FLOOR = 3;   // 184: the WRAPPED-FAMILY, SEAL and TALLY shapes

// ── a minimal PNG encoder, so the decoder has something real and KNOWN to read ────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** The encoder's own Paeth — the predictor, not the module's copy of it. */
function encPaeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Encode an RGB8 image. Row 0 uses filter 0; every row after it uses filter 4 (Paeth),
 * which is what makes the decoder's `paeth` load-bearing rather than decorative.
 * @returns {{png: Buffer, choseNotA: number}}
 */
function encodePng(width, height, pixels) {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  let choseNotA = 0;
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = y === 0 ? 0 : 4;
    for (let x = 0; x < stride; x++) {
      const v = pixels[y * stride + x];
      if (y === 0) { raw[rowStart + 1 + x] = v; continue; }
      const a = x >= 3 ? pixels[y * stride + x - 3] : 0;
      const b = pixels[(y - 1) * stride + x];
      const c = x >= 3 ? pixels[(y - 1) * stride + x - 3] : 0;
      const pred = encPaeth(a, b, c);
      // 🔴 INTERIOR ONLY, AND `mutate183.py`'s H3 IS WHY. At x < 3 the left neighbour and
      // the up-left neighbour are both the zero sentinel, so `b` wins on any non-black
      // row whatever the picture contains. The first draft counted those, and
      // `choseNotA > 0` therefore held over a fixture whose interior was uniform in x —
      // which is precisely the property the claim exists to assert. H3 replaced the
      // pattern with a y-only one and STAYED GREEN on 141 edge hits. The edge is not
      // evidence about the picture.
      if (x >= 3 && pred !== a) choseNotA++;
      raw[rowStart + 1 + x] = (v - pred) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return { png, choseNotA };
}

/** Distinct RGB values over the SOURCE pixels, same grid — the ground truth. */
function sourceDistinct(width, height, pixels, step) {
  const seen = new Set();
  let sampled = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 3;
      seen.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
      sampled++;
    }
  }
  return { distinct: seen.size, sampled };
}

const W = 64, H = 48, STEP = 7;
const drawn = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    drawn[i] = (x * 37) & 0xff;
    drawn[i + 1] = (y * 53) & 0xff;
    drawn[i + 2] = ((x ^ y) * 29) & 0xff;
  }
}
const uniform = Buffer.alloc(W * H * 3, 0x11);

// ─────────────────────────────────────────────────────────────────────── the run ─────
let snap = null, goldenCensus = null;

async function run() {
  // ── t=0: derive the population and floor it ────────────────────────────────────────
  await pop.family("SHAPE_TREE", async () => {
    buildTree();
    goldenCensus = census(ROOT);
    snap = snapshotDir(ROOT);

    ok(SHAPE_SNAPSHOT_FILE_FLOOR === 70, "SHAPE_FILE_FLOOR_PINNED", "the file floor is 70, not whatever it was last set to");
    ok(SHAPE_SNAPSHOT_DIR_FLOOR === 8, "SHAPE_DIR_FLOOR_PINNED", "the dir floor is 8, not whatever it was last set to");
    // 🔴 AND THE ROSTER FLOOR, PINNED BY VALUE — `floor_pin_gate.py` is what said so. It
    // zeroed `POPULATION_LINES_FLOOR` and this file STAYED GREEN, because a floor cannot
    // redden a roster that is still complete: `3 >= 0` holds. The two halves catch
    // different collapses (183 §9's conclusion about `LATE_LIVE`, one file over), so both
    // are needed and only the value pin makes the floor itself un-zeroable.
    ok(POPULATION_LINES_FLOOR === 3, "SHAPE_ROSTER_FLOOR_PINNED", "the roster floor is 3 — one per shape `_population.mjs` has");

    // The harness's own reading of the tree it just built — so a fixture that quietly
    // stopped being built is a failure here rather than a floor that stopped being met.
    ok(goldenCensus.files.size === TREE_FILES,
      "SHAPE_FIXTURE_BUILT", `census saw ${goldenCensus.files.size} file(s), built ${TREE_FILES}`);
    ok(goldenCensus.dirs.size === TREE_DIRS.length,
      "SHAPE_FIXTURE_DIRS", `census saw ${goldenCensus.dirs.size} dir(s), built ${TREE_DIRS.length}`);

    // 🔴 THE FLOOR AT t=0 — the AUTH_CLEAN_SCOPE line, one tree over.
    ok(snap.files.size >= SHAPE_SNAPSHOT_FILE_FLOOR,
      "SHAPE_SNAPSHOT_SCOPE", `${snap.files.size} file(s) enumerated, floor ${SHAPE_SNAPSHOT_FILE_FLOOR}`);
    ok(snap.dirs.size >= SHAPE_SNAPSHOT_DIR_FLOOR,
      "SHAPE_SNAPSHOT_DIR_SCOPE", `${snap.dirs.size} dir(s) enumerated, floor ${SHAPE_SNAPSHOT_DIR_FLOOR}`);

    // And the snapshot agrees with the independent census — the two readings of t=0.
    eq([...snap.files.keys()].sort(), [...goldenCensus.files.keys()].sort(),
      "SHAPE_SNAPSHOT_AGREES the snapshot and the census enumerated the same tree");
  }, onThrow);

  // ── the work the floor was permission for ──────────────────────────────────────────
  await pop.family("SHAPE_RESTORE", async () => {
    // The three things the authoring probe does to a real project: add, modify, delete.
    fs.mkdirSync(path.join(ROOT, "scenes/_probe_out"), { recursive: true });
    for (let i = 0; i < 30; i++) {
      fs.writeFileSync(path.join(ROOT, "scenes/_probe_out", `_probe_${i}.tres`), `artefact ${i}\n`);
    }
    fs.writeFileSync(path.join(ROOT, "project.godot"), '[application]\nconfig/name="MUTATED"\n');
    fs.rmSync(path.join(ROOT, "scripts", "f2.txt"), { force: true });

    const dirty = census(ROOT);
    ok(dirty.files.size === TREE_FILES + 29,
      "SHAPE_MUTATION_LANDED", `${dirty.files.size} file(s) after the mutation, expected ${TREE_FILES + 29}`);
    ok(!censusDiff(goldenCensus, dirty).identical,
      "SHAPE_MUTATION_VISIBLE the census can tell a dirty tree from a clean one");

    // ── t=1: RE-DERIVE, and take the verdict from the re-derivation ──────────────────
    const restored = restoreDir(snap);
    const residue = diffDir(snap);

    ok(restored.failed.length === 0,
      "SHAPE_RESTORE_NO_FAILURES", restored.failed.map((f) => `${f.path}: ${f.why}`).join("; "));
    ok(residue.clean === true, "SHAPE_RESTORE_CLEAN", describeDiff(residue));

    // 🔴 AND THE VERDICT THE MODULE CANNOT GIVE ITSELF. `residue.clean` is derived from
    // the same walk `restoreDir` used to decide what to remove; if that walk goes quiet
    // at t=1 the restore removes nothing AND the check reports clean, which is 174's
    // finding and the reason this harness exists. The census below shares nothing with
    // it. A green `residue.clean` over a red census is the defect, stated as a claim.
    const after = census(ROOT);
    const cd = censusDiff(goldenCensus, after);
    ok(cd.identical,
      "🔴 SHAPE_TREE_BYTE_IDENTICAL", `the INDEPENDENT census still differs after the restore -> ${describeCensus(cd)}`);
    ok(restored.removed.length >= 30,
      "SHAPE_RESTORE_REMOVED", `the restore removed ${restored.removed.length} path(s), expected at least the 30 artefacts`);
    ok(restored.rewritten.length >= 2,
      "SHAPE_RESTORE_REWROTE", `the restore rewrote ${restored.rewritten.length} file(s), expected the modified one and the deleted one`);
  }, onThrow);

  // ── the reader, over frames whose contents are known ───────────────────────────────
  await pop.family("SHAPE_PNG", async () => {
    const encDrawn = encodePng(W, H, drawn);
    const encUniform = encodePng(W, H, uniform);

    // 🔴 THE FIXTURE'S OWN DISCRIMINATING PROPERTY, ASSERTED (182 §7's G5). A pattern
    // whose Paeth predictor always chose `a` would round-trip perfectly through
    // `function paeth(a, b, c) { return a; }` — the blind `instrument_gate.py` points at
    // this exact function — and every claim below would hold over it.
    ok(encDrawn.choseNotA > 0,
      "SHAPE_PNG_PAETH_DISCRIMINATES", `the fixture's predictor chose something other than \`a\` ${encDrawn.choseNotA} time(s)`);

    const decodedDrawn = decodePng(encDrawn.png);
    ok(decodedDrawn !== null, "SHAPE_PNG_DECODES the drawn frame decoded at all");
    ok(decodedDrawn.width === W && decodedDrawn.height === H,
      "SHAPE_PNG_DIMS", `${decodedDrawn?.width}x${decodedDrawn?.height}, authored ${W}x${H}`);
    // Ground truth: the decoded pixels ARE the pixels that went in.
    ok(Buffer.compare(decodedDrawn.pixels, drawn) === 0,
      "🔴 SHAPE_PNG_ROUND_TRIP the decoded pixels are byte-identical to the authored frame");

    const truth = sourceDistinct(W, H, drawn, STEP);
    const shades = sampleDistinctColours(decodedDrawn, STEP);
    // 🔴 AGAINST A KNOWN COUNT, NOT AGAINST `> 1`. The probe can only ask whether the
    // rasterizer drew ANYTHING, so `{distinct: 999}` — the blind this instrument's gate
    // injects, deliberately a HEALTHY answer (182 §11.27) — satisfies it. A harness that
    // authored the frame knows the number, so the same blind is visible here.
    eq(shades, truth, "🔴 SHAPE_PNG_DISTINCT_EXACT the sampled distinct count matches the authored frame's");

    const decodedUniform = decodePng(encUniform.png);
    const flat = sampleDistinctColours(decodedUniform, STEP);
    ok(flat.distinct === 1,
      "🔴 SHAPE_PNG_UNIFORM_IS_ONE", `a single-fill frame sampled ${flat.distinct} distinct colour(s) — this is the reading AUTH_SHOT_DRAWN exists to make`);
    ok(flat.sampled === truth.sampled,
      "SHAPE_PNG_SAMPLED_SAME", `${flat.sampled} vs ${truth.sampled} — same dims, same step, so the same grid`);
  }, onThrow);

  // ── the counter, checked against a count it did not make ───────────────────────────
  await pop.family("SHAPE_POP", async () => {
    // 🔴 THE ONLY READING OF `_population.mjs` THAT IS NOT `_population.mjs`. `report()`
    // prints `claims=N` and floors it; a `claim()` that answers once and stops leaves the
    // total at 1, and the floor is what catches that. But the floor is a literal somebody
    // chose, and a total that drifts DOWN while staying above it is invisible to the
    // floor. `made` is incremented at the same call sites, two lines of this file, so the
    // instrument's own arithmetic has a witness.
    ok(pop.total === made,
      "🔴 SHAPE_POP_COUNTED_EVERY_CLAIM", `the population counted ${pop.total}, this file made ${made}`);
    ok(pop.vacuous.length === 0, "SHAPE_POP_NO_VACUOUS", pop.vacuous.join(", "));
    ok(pop.partial.length === 0, "SHAPE_POP_NO_PARTIAL", pop.partial.map((p) => p.label).join(", "));

    // 🔴 AND THE THIRD INSTANCE'S VERDICTS, TAKEN FROM INSIDE A FAMILY ON PURPOSE. The
    // tally instance below ran before this family opened; its state is finished and can
    // be read. These claims are made THROUGH `pop` and therefore land on SHAPE_POP —
    // because a harness that made its verification claims outside every family would sit
    // in the unattributed bucket and trip the very gate this session added.
    ok(tallyPop.total === tallyMade,
      "🔴 SHAPE_TALLY_COUNTED_EVERY_CLAIM", `the tally population counted ${tallyPop.total}, this file made ${tallyMade}`);
    // 🔴 THE ARM NOTHING LIVE EXERCISED. `claim(family)` attributes immediately; the two
    // instances above both take the OTHER arm, so a `claim()` that dropped the explicit
    // family — falling through to `current`, which is null in this shape — left them both
    // green. Compared as VALUES against a Map this file owns, so "counted" and "counted
    // onto the right family" are two different verdicts rather than one.
    eq([...tallyPop.seen].sort(), [...tallyTruth].sort(),
      "🔴 SHAPE_TALLY_ATTRIBUTED_EXACTLY every claim landed on the family it named");
    // 🔴 AND THE BANNER IS STILL HELD. One claim was made outside every family, exactly
    // as `tabletop-plane` makes two; it must be counted in the total and attributed to
    // nothing, which is the state `_POPULATION_UNSEALED` reads.
    ok(tallyPop.pending === 1,
      "🔴 SHAPE_TALLY_BANNER_UNATTRIBUTED", `${tallyPop.pending} claim(s) held for no family, the banner is exactly 1`);
    ok(tallyPop.vacuous.length === 0, "SHAPE_TALLY_NO_VACUOUS", tallyPop.vacuous.join(", "));
  }, onThrow);
}

// ── the SEAL shape, because eight of the fourteen live probes use that one ────────────
//
// 🔴 A SECOND INSTANCE, NOT A SECOND SHAPE ON THE FIRST. `_population.mjs`'s own header:
// "A probe uses one shape or the other; mixing them would attribute the same claim
// twice." So this is a second probe living in the same file — which is also the only way
// `seal()` gets a live axis at all, since the wrapped-family shape above never calls it.
const sealPop = new Population("SHAPE_SEAL", {
  families: ["SHAPE_SEAL_A", "SHAPE_SEAL_B", "SHAPE_SEAL_C"],
  scope: 3,
  claims: 6,   // measured 7
});
let sealMade = 0;
// 🔴 THE CLAIM GOES THROUGH `sealPop.assert` DIRECTLY, AND THAT IS THE POINT (191).
// 190 §4 measured this file's old shape — `const sassert = sealPop.assert` wrapped in
// `sok()` — and left it alone deliberately, declaring the blind spot with
// `ALIAS_BLIND_CEILING = 1` rather than widening the claim finder for one instrument's
// fixtures. 190 §9.2 then handed the DECISION over: should this file keep an idiom no gate
// can read at all, now that the cost of the alternative is known?
//
// It should not, and the alternative costs nothing the measurement did not already price.
// `sealPop.assert.ok` is a spelling `READS_AS_CLAIM` reads through its `\.assert\.` arm,
// which promotes `sok` by the ordinary fixed point — the same mechanism that already made
// `ok`/`eq`/`run` readable forty lines up. So the seven fixture claims join the population
// every other section of this file is already in, the alias rule's ceiling goes to ZERO,
// and this file stops being the one place in the directory where a gate is asked to trust
// a comment instead of reading a call.
//
// 🔴 IT IS ALSO WHY THE ALIAS ABOVE (`const assert = pop.assert`, line 61) STAYS. That one
// is spelled exactly `assert`, which the finder reads; ten of the eleven bindings in the
// directory are spelled that way and this file already had one. The defect was never
// "an alias" — it was an alias under a name the finder's TEXT test could not match.
const sok = (cond, marker, detail = "") => { sealMade++; sealPop.assert.ok(cond, `${marker} ${detail}`); };

function runSeal() {
  sok(true, "SHAPE_SEAL_A1 the seal shape counts a claim made before any marker prints");
  sok(1 + 1 === 2, "SHAPE_SEAL_A2");
  sok("x".length === 1, "SHAPE_SEAL_A3");
  const drainedA = sealPop.seal("SHAPE_SEAL_A", "3 claim(s)");

  // Verified in the NEXT section on purpose: a claim made after the last seal belongs to
  // no section and is counted in the total. 🔴 184: it is also reported as `unsealed=N/M`
  // and GATED — this instance declares none, so the seal that drains everything is the
  // shape gate 6 requires of it; the tally instance below is the one that declares one.
  sok(drainedA === 3, "SHAPE_SEAL_A_DRAINED", `the seal drained ${drainedA}, three claims preceded it`);
  sok(sealPop.seen.get("SHAPE_SEAL_A") === 3, "SHAPE_SEAL_A_ATTRIBUTED", "the marker owns the three claims");
  const drainedB = sealPop.seal("SHAPE_SEAL_B", "2 claim(s)");

  sok(drainedB === 2, "SHAPE_SEAL_B_DRAINED", `the seal drained ${drainedB}, two claims preceded it`);
  sok(sealPop.total === sealMade,
    "🔴 SHAPE_SEAL_COUNTED_EVERY_CLAIM", `the population counted ${sealPop.total}, this file made ${sealMade}`);
  sealPop.seal("SHAPE_SEAL_C", "2 claim(s)");
}

// ── the TALLY shape, the third of three, and the arm `claim(family)` had no witness for ─
//
// 🔴 183 §12.2. `claim()` has two arms: with an EXPLICIT family it attributes immediately,
// with none it is held until a marker drains it. Both instances above take the second arm,
// so the first — the one `lsp-plane` and `cs-lsp-plane` run on, `population.claim(marker)`
// from inside a `check()` helper — was exercised by nothing live at all. Delete it and both
// instances above stay green; the only thing that noticed was the self-test.
//
// 🔴 AND IT CARRIES A BANNER CLAIM ON PURPOSE (184 §3). `tabletop-plane` makes two claims
// outside every family — its reachability and registration banners — and its own source
// declared them in a COMMENT while `report()` printed the count and no gate read it.
// Reproducing that shape here is what puts `_POPULATION_UNSEALED` on a live axis instead of
// only in the self-test, and it is why this instance declares `unsealed` rather than
// pretending a probe never has one.
const tallyPop = new Population("SHAPE_TALLY", {
  families: ["SHAPE_TALLY_A", "SHAPE_TALLY_B", "SHAPE_TALLY_C"],
  scope: 3,
  claims: 6,   // measured 7 — six attributed plus the banner
  unsealed: 1,
  unsealedWhy: "SHAPE_TALLY_BANNER is made before any family names itself, mirroring "
             + "tabletop-plane's TT_GATE_PING — the shape this instance exists to reproduce",
});

// 🔴 THE GROUND TRUTH FOR THE ATTRIBUTION, COUNTED HERE. `report()`'s roster is the
// instrument's own arithmetic; this Map is built at the same call sites from a line that
// shares nothing with it, so "counted" and "counted onto the family it named" become two
// verdicts rather than one. A `claim()` that counted every call but attributed them all to
// one family would satisfy the total and fail this.
const tallyTruth = new Map();
let tallyMade = 0;

// 🔴 EVERY CLAIM IS A VALUE AGAINST A KNOWN VALUE, AND `tautology_gate.mjs` IS WHY. The
// first draft of this helper took a bare condition and was called with `tcheck(true, …)`
// and `tcheck(1 + 1 === 2, …)` — three families in which every assertion was satisfied by
// a wrong answer of the right type, which is precisely what that gate exists to reject,
// and it rejected them the first time it read this file. A driver for `claim(family)` does
// not need a subject to be a real claim; the instrument's OWN accumulating state is one,
// with an answer known in advance at every step.
//
// 🔴 AND THE READING IS A THUNK, NOT A VALUE, because JavaScript evaluates arguments
// BEFORE the call: passing `tallyPop.total` reads the counter one claim too early, which
// is how the first run of this failed five of its six. The claim each expectation is about
// is the one the expectation itself makes, so the read has to happen after it.
const tcheck = (readActual, expected, family, marker) => {
  tallyPop.claim(family);            // <- lsp-plane's line, verbatim: the explicit arm
  tallyMade++;
  tallyTruth.set(family, (tallyTruth.get(family) ?? 0) + 1);
  const actual = readActual();
  if (actual !== expected) fail(marker, `expected ${expected}, got ${actual}`);
};

function runTally() {
  // The banner, outside every family and before any of them — TT_GATE_PING's shape.
  tallyPop.claim();
  tallyMade++;

  // The claim is made FIRST inside `tcheck`, so each expectation below counts itself.
  tcheck(() => tallyPop.total, 2, "SHAPE_TALLY_A", "SHAPE_TALLY_A1");
  tcheck(() => tallyPop.seen.get("SHAPE_TALLY_A"), 2, "SHAPE_TALLY_A", "SHAPE_TALLY_A2");
  // 🔴 THE READING THE OTHER TWO INSTANCES CANNOT MAKE: the banner is STILL held while
  // attributed claims go past it, which is only true if `claim(family)` took the explicit
  // arm every time rather than falling through to the pending bucket.
  tcheck(() => tallyPop.pending, 1, "SHAPE_TALLY_B", "SHAPE_TALLY_B1");
  tcheck(() => tallyPop.seen.get("SHAPE_TALLY_B"), 2, "SHAPE_TALLY_B", "SHAPE_TALLY_B2");
  tcheck(() => tallyPop.seen.size, 3, "SHAPE_TALLY_C", "SHAPE_TALLY_C1");
  tcheck(() => tallyPop.total, 7, "SHAPE_TALLY_C", "SHAPE_TALLY_C2");
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 🔴 THE TALLY INSTANCE RUNS FIRST, because SHAPE_POP inside `run()` takes its verdicts
// from the finished state — a population still being built has nothing to testify about.
// 🔴 199 §9.2 — TWO OF THE FIVE SECTIONS RAN OUTSIDE THE THROW-CATCHER THE OTHER THREE
// HAVE, AND THAT IS THE WHOLE OF THE `B:live` CRASH FAMILY. Every `pop.family(…)` above
// takes `onThrow` and records a `_THREW` failure; `runTally()` and `runSeal()` are bare
// calls in this try, so an AssertionError inside either killed the process before
// `report()` ran — no `SHAPE_POPULATION` line, no failure list, and `instrument_gate.py`
// counting a crash as a catch for three of `_population.mjs`'s targets.
//
// 🔴 THE FIX IS THE IDIOM THE FILE ALREADY HAS, NOT A GUARD AT THE ASSERTION. Wrapping
// `sok()` in a try/catch would have paid only `sok`'s throws and left every other read in
// these two sections able to do the same thing; and it would have touched the one call
// spelling 191 §4 deliberately left bare so `READS_AS_CLAIM` can see it. Catching at the
// SECTION boundary is where the other three already catch, so the five sections finally
// have one shape — and a throw anywhere inside either one now reaches the verdict.
const section = (label, fn) => {
  try { fn(); } catch (e) { onThrow(label, String(e?.message || e).slice(0, 200)); }
};

try {
  section("SHAPE_TALLY", runTally);
  await run();
  section("SHAPE_SEAL", runSeal);
} finally {
  try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch { /* scratch */ }
}

// ── the marker LINES, checked — because that is what the caller actually reads ────────
//
// 🔴 `report()` RETURNS A FAILURE LIST WHOSE HEALTHY VALUE IS EMPTY, so a blind that
// returns `[]` injects a HEALTHY answer and no live caller can see it from the return
// value (182 §11.27's corollary, measured again here). But the caller depends on the
// other thing `report()` does: it PRINTS the population line, and that line — not the
// return value — is what the CI job logs are grepped for. Nothing anywhere asserted that
// it prints. A gate whose marker stops printing is 169 §4's tautology inverted: the
// reader sees no line and concludes nothing, when the absence is the whole signal.
//
// Teeing rather than replacing, so the line still reaches the log it is written for.
const emitted = [];
const realWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, ...rest) => { emitted.push(String(chunk)); return realWrite(chunk, ...rest); };

const sealFailures = sealPop.report();
for (const f of sealFailures) fail("SHAPE_SEAL_POPULATION", f);
// 🔴 THE DECLARED-UNSEALED PATH, TAKEN LIVE. The tally instance holds one claim that
// belongs to no family and declares exactly one; `report()`'s sixth gate compares the two
// and this fold is what makes a mismatch a failure of the harness rather than a line in a
// log. A `report()` that stopped comparing them shows up as a mutant that stays green.
const tallyFailures = tallyPop.report();
for (const f of tallyFailures) fail("SHAPE_TALLY_POPULATION", f);
const total = pop.reportOrDie();

process.stdout.write = realWrite;
const printed = emitted.join("");
// 🔴 AND THE `unsealed=` FIELD ITSELF IS A MARKER NOW, so it is checked the same way the
// population lines are: printed at all, and printed with BOTH numbers. Until 184 it
// appeared only when non-zero, which meant the healthy value was never in any log and
// nobody could tell a probe that stopped making its banner claims from one that never had
// any. The absence of a number is not evidence about the number.
if (!/\nSHAPE_TALLY_POPULATION claims=\d+\/\d+ families=\d+\/\d+ vacuous=\d+ partial=\d+ unsealed=1\/1\b/.test(printed)) {
  fail("SHAPE_TALLY_UNSEALED_FIELD",
    "the tally population line did not print `unsealed=1/1` — the measured count and the declared one are what gate 6 compares, and a field that prints only in the failing case is a field nobody reads in the passing one");
}
if (POPULATION_LINES.length < POPULATION_LINES_FLOOR) {
  fail("SHAPE_ROSTER_FLOOR",
    `the harness drives ${POPULATION_LINES.length} population line(s), floor is ${POPULATION_LINES_FLOOR} — an axis removed from the roster takes its claims with it and leaves every other number reading ok`);
}
for (const prefix of POPULATION_LINES) {
  if (!new RegExp(`\\n${prefix} claims=\\d+/\\d+ families=`).test(printed)) {
    fail(`${prefix}_LINE`,
      `report() returned without printing the ${prefix} line — the marker the CI job greps for is gone, and its absence is the only thing that would have said so`);
  }
}

if (failures) {
  console.error(`::error::CALLER_SHAPE FAILED — ${failures} claim(s) did not hold; the late axis for _workspace/_png/_population is not trustworthy`);
  process.exit(1);
}
console.log(`\nCALLER_SHAPE ok every claim held (${total} + ${sealPop.total} + ${tallyPop.total} claim(s) ran)`);

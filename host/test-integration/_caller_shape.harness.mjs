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
  claims: 20,   // measured 24
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
const sassert = sealPop.assert;
let sealMade = 0;
const sok = (cond, marker, detail = "") => { sealMade++; sassert.ok(cond, `${marker} ${detail}`); };

function runSeal() {
  sok(true, "SHAPE_SEAL_A1 the seal shape counts a claim made before any marker prints");
  sok(1 + 1 === 2, "SHAPE_SEAL_A2");
  sok("x".length === 1, "SHAPE_SEAL_A3");
  const drainedA = sealPop.seal("SHAPE_SEAL_A", "3 claim(s)");

  // Verified in the NEXT section on purpose: a claim made after the last seal belongs to
  // no section, is counted in the total, and — 🔴 as of 183, see the handoff — is
  // reported as `unsealed=` and gated by nothing.
  sok(drainedA === 3, "SHAPE_SEAL_A_DRAINED", `the seal drained ${drainedA}, three claims preceded it`);
  sok(sealPop.seen.get("SHAPE_SEAL_A") === 3, "SHAPE_SEAL_A_ATTRIBUTED", "the marker owns the three claims");
  const drainedB = sealPop.seal("SHAPE_SEAL_B", "2 claim(s)");

  sok(drainedB === 2, "SHAPE_SEAL_B_DRAINED", `the seal drained ${drainedB}, two claims preceded it`);
  sok(sealPop.total === sealMade,
    "🔴 SHAPE_SEAL_COUNTED_EVERY_CLAIM", `the population counted ${sealPop.total}, this file made ${sealMade}`);
  sealPop.seal("SHAPE_SEAL_C", "2 claim(s)");
}

// ─────────────────────────────────────────────────────────────────────────────────────
try {
  await run();
  runSeal();
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
const total = pop.reportOrDie();

process.stdout.write = realWrite;
const printed = emitted.join("");
for (const prefix of ["SHAPE_SEAL_POPULATION", "SHAPE_POPULATION"]) {
  if (!new RegExp(`\\n${prefix} claims=\\d+/\\d+ families=`).test(printed)) {
    fail(`${prefix}_LINE`,
      `report() returned without printing the ${prefix} line — the marker the CI job greps for is gone, and its absence is the only thing that would have said so`);
  }
}

if (failures) {
  console.error(`::error::CALLER_SHAPE FAILED — ${failures} claim(s) did not hold; the late axis for _workspace/_png/_population is not trustworthy`);
  process.exit(1);
}
console.log(`\nCALLER_SHAPE ok every claim held (${total} + ${sealPop.total} claim(s) ran)`);

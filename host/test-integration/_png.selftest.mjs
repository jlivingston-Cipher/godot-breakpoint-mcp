#!/usr/bin/env node
// _png.selftest.mjs — session 175. THE FIFTH INSTRUMENT, AND THE ONE THAT DECIDES WHAT
// A RENDERED FRAME IS.
//
// 🔴 MEASURED FIRST, 174 §2's technique: `BLIND175 _png.mjs 2 of 2 STILL GREEN`. Both
// exports could be replaced with a constant and every headless gate in the tree — the
// suite, both tautology gates, both verdict gates, all three instrument self-tests —
// still passed, for `_workspace.mjs`'s reason one session earlier: it is imported in
// exactly two places, a probe that boots the editor GUI under Xvfb and a manual script
// that needs a real GPU. Neither runs headless.
//
// 🔴 AND THE THING IT DECIDES IS THE ONE #143 WAS ABOUT. `sampleDistinctColours`
// returning anything above 1 is the whole content of AUTH_SHOT_NOT_UNIFORM — the check
// that separates "the rasterizer drew something" from "the rasterizer initialised and
// drew nothing". Blinded to a constant, an all-black frame passes the render family.
// A tool's own label (mimeType, the "(WxH)" note, the four magic bytes) cannot tell
// those apart, which is why this reader exists at all.
//
// Known-answer claims over PNGs built here, byte by byte. No fixtures, no engine, no
// network — the encoder below is fourteen lines of zlib and CRC.
import zlib from "node:zlib";
import { decodePng, sampleDistinctColours } from "./_png.mjs";

let ran = 0, bad = 0;
function check(cond, name, detail = "") {
  ran++;
  if (cond) { console.log(`  ok   ${name}${detail ? ` — ${detail}` : ""}`); return true; }
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  bad++;
  return false;
}

// ── a PNG encoder, so every input is a known answer ─────────────────────────────────
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (b) => {
    let c = -1;
    for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
};
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** rows: array of arrays of channel bytes. filter applies to every row. */
function png(w, h, colorType, rows, { depth = 8, interlace = 0, filter = 0, idat = true, junkIdat = false } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = depth; ihdr[9] = colorType; ihdr[12] = interlace;
  const parts = [SIG, chunk("IHDR", ihdr)];
  if (idat) {
    const raw = Buffer.concat(rows.map((r) => Buffer.concat([Buffer.from([filter]), Buffer.from(r)])));
    parts.push(chunk("IDAT", junkIdat ? Buffer.from([1, 2, 3, 4]) : zlib.deflateSync(raw)));
  }
  parts.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(parts);
}

/** A w*h RGB image, every pixel the same colour. The all-black frame, generalised. */
const uniform = (w, h, rgb = [0, 0, 0]) =>
  png(w, h, 2, Array.from({ length: h }, () => Array.from({ length: w }, () => rgb).flat()));

console.log("T_PNG — the reader that decides what a rendered frame is");

// ── 1. THE REJECTIONS. A reader that returns something for anything constrains nothing.
check(decodePng(null) === null, "T_PNG_NOT_A_BUFFER", "null is refused, not thrown on");
check(decodePng("not a buffer") === null, "T_PNG_NOT_A_BUFFER_STRING");
check(decodePng(Buffer.alloc(10)) === null, "T_PNG_TOO_SHORT", "under 24 bytes cannot hold IHDR");
check(decodePng(Buffer.concat([Buffer.from("NOTAPNG!"), Buffer.alloc(40)])) === null,
  "T_PNG_BAD_MAGIC", "the first four bytes are the signature");

// 🔴 THE DOCUMENTED DEGRADE PATHS. The header says this returns null rather than throws
// for anything Godot does not emit, "so a caller can degrade rather than throw". That
// sentence had never been executed.
check(decodePng(png(2, 2, 2, [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]], { depth: 16 })) === null,
  "T_PNG_DEPTH_16_DEGRADES", "16 bits per channel is refused, not misread");
check(decodePng(png(2, 2, 2, [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]], { interlace: 1 })) === null,
  "T_PNG_INTERLACED_DEGRADES", "Adam7 is refused");
check(decodePng(png(2, 2, 3, [[0, 0], [0, 0]])) === null,
  "T_PNG_PALETTE_DEGRADES", "colour type 3 is not in CHANNELS");
check(decodePng(png(2, 2, 2, [], { idat: false })) === null,
  "T_PNG_NO_IDAT_DEGRADES", "a header with no pixel data");
check(decodePng(png(2, 2, 2, [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]], { junkIdat: true })) === null,
  "T_PNG_CORRUPT_ZLIB_DEGRADES", "inflateSync throws and is caught");
check(decodePng(png(4, 4, 2, [[1, 2, 3]])) === null,
  "T_PNG_TRUNCATED_DEGRADES", "fewer rows than IHDR promises");
check(decodePng(png(0, 0, 2, [])) === null, "T_PNG_ZERO_DIMENSION_DEGRADES");

// ── 2. THE HEADER IS READ, NOT ASSUMED ──────────────────────────────────────────────
const rgb = decodePng(uniform(3, 2, [10, 20, 30]));
// 🔴 THIS CLAIM WAS `check(rgb !== null, …)` AND THE TAUTOLOGY GATE CAUGHT IT — in a
// file written the same session, by the extension made the same session. A null-presence
// check is satisfied by `{}`: a decoder that returned an empty object would have passed
// the claim named for decoding. The gate reported TAUT_VACUOUS on the first run over the
// newly-rostered tree. It now asserts the shape it is named for.
check(rgb !== null && rgb.width === 3 && rgb.height === 2 && rgb.channels === 3,
  "T_PNG_DECODES_AT_ALL", "a plain 8-bit RGB frame, described correctly");
check(rgb.width === 3 && rgb.height === 2, "T_PNG_DIMENSIONS", `${rgb.width}x${rgb.height}`);
check(rgb.channels === 3, "T_PNG_CHANNELS_RGB");
check(rgb.pixels.length === 3 * 2 * 3, "T_PNG_PIXEL_BUFFER_SIZE", `${rgb.pixels.length} bytes`);
check(rgb.pixels[0] === 10 && rgb.pixels[1] === 20 && rgb.pixels[2] === 30,
  "T_PNG_PIXEL_VALUES", "the first pixel is the colour that was encoded");
const grey = decodePng(png(2, 1, 0, [[7, 9]]));
check(grey && grey.channels === 1, "T_PNG_CHANNELS_GREY");
const rgba = decodePng(png(1, 1, 6, [[1, 2, 3, 255]]));
check(rgba && rgba.channels === 4, "T_PNG_CHANNELS_RGBA");
const greyA = decodePng(png(1, 1, 4, [[5, 255]]));
check(greyA && greyA.channels === 2, "T_PNG_CHANNELS_GREY_ALPHA");

// ── 3. EVERY FILTER ARM. Godot picks per row; four of the five had never run here. ──
// Each case encodes bytes that decode to a KNOWN answer under that filter, so a filter
// arm silently dropped (or two of them swapped) reds rather than round-trips.
const filtered = (f, rows) => decodePng(png(2, 2, 2, rows, { filter: f }));
const px = (d) => (d ? [...d.pixels] : null);
check(JSON.stringify(px(filtered(0, [[10, 20, 30, 40, 50, 60], [70, 80, 90, 100, 110, 120]])))
  === JSON.stringify([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]),
  "T_PNG_FILTER_0_NONE");
// Sub: each byte is a delta from the pixel to its left (0 for the first pixel).
check(JSON.stringify(px(filtered(1, [[10, 20, 30, 5, 5, 5], [0, 0, 0, 0, 0, 0]])))
  === JSON.stringify([10, 20, 30, 15, 25, 35, 0, 0, 0, 0, 0, 0]),
  "T_PNG_FILTER_1_SUB", "the left neighbour is added back");
// Up: a delta from the row above. Row 0's "above" is zero.
check(JSON.stringify(px(filtered(2, [[10, 10, 10, 10, 10, 10], [5, 5, 5, 5, 5, 5]])))
  === JSON.stringify([10, 10, 10, 10, 10, 10, 15, 15, 15, 15, 15, 15]),
  "T_PNG_FILTER_2_UP", "the row above is added back");
// Average: (left + above) >> 1.
const avg = filtered(3, [[10, 10, 10, 0, 0, 0], [0, 0, 0, 0, 0, 0]]);
check(avg && avg.pixels[3] === 5, "T_PNG_FILTER_3_AVERAGE", `(10 + 0) >> 1 = ${avg && avg.pixels[3]}`);
// Paeth: with above and upper-left both zero the predictor picks `left`.
const pae = filtered(4, [[10, 10, 10, 0, 0, 0], [0, 0, 0, 0, 0, 0]]);
check(pae && pae.pixels[3] === 10, "T_PNG_FILTER_4_PAETH", `predictor chose left = ${pae && pae.pixels[3]}`);
// 🔴 THE CASE ABOVE IS SATISFIED BY A PAETH THAT ALWAYS RETURNS `a`, AND THAT IS EXACTLY
// THE MISTAKE THIS FILE EXISTS TO CATCH — a wrong answer of the right type. Row 1's first
// pixel has a=0 (nothing to its left), b=10 (the row above) and c=0, so pa=10, pb=0:
// the predictor must choose ABOVE. Blinding `paeth` to `return a` reds here and nowhere
// else, which is why it is a target in instrument_gate.py.
check(pae && pae.pixels[6] === 10, "T_PNG_FILTER_4_PAETH_CHOOSES_ABOVE",
  `pa=10 pb=0 -> b, got ${pae && pae.pixels[6]}`);
// 🔴 AND THE WRAP. `v & 0xff` is the line that makes a delta legal at the boundary; a
// reader that clamped instead of wrapping would round-trip every case above and get
// this one wrong.
const wrap = filtered(1, [[200, 0, 0, 100, 0, 0], [0, 0, 0, 0, 0, 0]]);
check(wrap && wrap.pixels[3] === 44, "T_PNG_FILTER_WRAPS_AT_256", `200 + 100 = ${wrap && wrap.pixels[3]}, not 255`);

// ── 4. THE UNIFORM FRAME — THE ONE THING THIS FILE REALLY DECIDES ───────────────────
// 🔴 #143's failure, and the only result the header says it is "really here to
// distinguish": a rasterizer that initialised and then drew nothing.
const black = sampleDistinctColours(decodePng(uniform(40, 40, [0, 0, 0])));
check(black.distinct === 1, "T_PNG_ALL_BLACK_IS_ONE_COLOUR", `distinct=${black.distinct}`);
const white = sampleDistinctColours(decodePng(uniform(40, 40, [255, 255, 255])));
check(white.distinct === 1, "T_PNG_ALL_WHITE_IS_ONE_COLOUR", "any single fill, not just black");
check(sampleDistinctColours(null) === null, "T_PNG_SAMPLE_NULL_DEGRADES", "a failed decode does not throw here");

// A frame with real content. Rows differ, so a sparse grid still separates them.
const varied = png(40, 40, 2,
  Array.from({ length: 40 }, (_, y) => Array.from({ length: 40 }, (_, x) => [x * 6, y * 6, 128]).flat()));
const many = sampleDistinctColours(decodePng(varied));
check(many.distinct > 1, "T_PNG_DREW_SOMETHING", `distinct=${many.distinct}`);
check(many.distinct > 10, "T_PNG_DISTINCT_IS_A_REAL_COUNT",
  `not merely >1 — a gradient reports ${many.distinct}, so the Set keys on the colour and not on the pixel index`);

// 🔴 THE STRIDE IS A SAMPLE, AND A SAMPLE THAT MISSES EVERYTHING IS THE FAILURE MODE.
// The header's argument is that a uniform frame is uniform EVERYWHERE, so a grid is as
// decisive as a full scan. That holds only if the grid actually visits pixels.
check(many.sampled === Math.ceil(40 / 7) ** 2, "T_PNG_SAMPLED_COUNT", `${many.sampled} at step 7 over 40x40`);
check(sampleDistinctColours(decodePng(varied), 1).sampled === 1600,
  "T_PNG_STEP_1_IS_EVERY_PIXEL", "step 1 visits all 1600");
check(sampleDistinctColours(decodePng(varied), 1).distinct >= many.distinct,
  "T_PNG_FULL_SCAN_SEES_AT_LEAST_AS_MUCH", "the sparse grid never reports MORE colours than the full scan");
// Greyscale has one channel; r, g and b must all come from it, or every grey frame
// reads as distinct=1 whatever it contains.
const greyRamp = decodePng(png(9, 1, 0, [[0, 30, 60, 90, 120, 150, 180, 210, 240]]));
check(sampleDistinctColours(greyRamp, 1).distinct === 9, "T_PNG_GREY_RAMP_IS_NINE_COLOURS",
  "a 1-channel frame is not silently uniform");

console.log(`\nPNG_SELFTEST ${ran - bad}/${ran} claims`);
// 🔴 A LITERAL FLOOR, AND IT WAS WRITTEN FROM A GUESS TWICE THIS SESSION AND CAUGHT
// ITSELF BOTH TIMES (VERDICT_GATE's SUBJECT_FLOOR, VERDICT_SELFTEST's). Measured: 36.
if (ran !== 35) { console.log(`🔴 PNG_SELFTEST_SCOPE ${ran} claims ran, expected 35 — a case stopped running`); process.exit(1); }
if (bad) { console.log(`🔴 PNG_SELFTEST FAILED — ${bad} of ${ran}`); process.exit(1); }
console.log("PNG_SELFTEST ok");

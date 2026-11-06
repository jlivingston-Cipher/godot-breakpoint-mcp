// Hearing-plane integration probe (BP-0064) — drives `godot_record` and `audio_analyze` over the
// real path: Godot's Movie Maker records res://tests/hearing_probe.tscn, a 1 kHz sine at amplitude
// 0.25 built in code, and the host measures the WAV it wrote.
//
// WHY THIS EXISTS
// ---------------
// 1.93.0 shipped the hearing plane proven by a script outside the repository, on one Mac. The
// unit tests in `test/hearing.test.ts` measure WAVs the test writes itself, so a change that broke
// the RECORD half — Godot's argv, the Movie Maker output path, the frame cleanup, the WAV the
// engine actually writes — would turn nothing red. Movie Maker needs a real renderer (under
// `--headless --write-movie` Godot 4.7 crashes, measured at 334), and runtime-render-plane already
// has one: Xvfb plus Mesa llvmpipe. So this probe runs there, against that job's Godot.
//
// WHAT MAKES IT COVERAGE RATHER THAN GREEN
// ----------------------------------------
// Every expectation is arithmetic on the fixture, never an earlier run: 2 s at 48 kHz is 96000
// frames; a sine of amplitude 0.25 peaks at 20·log10(0.25) = -12.04 dBFS and its RMS is 3.01 dB
// below that; two such channels read -12.04 LUFS under BS.1770. Then the same scene at +18 dB, which
// the engine's own mixer clips at full scale, so the comparison has to find the peak capped near
// +12 dB (not +18) and harmonics in the 4 kHz octave where the clean tone had none. An analyser
// that returned constants, or read silence, or skipped the file, fails at least one of those.
//
// Markers (grep-able): HEARING_LIVE_PICTURE / _LENGTH / _LEVEL / _LOUDNESS / _TONE / _FRAMES /
// _CLIP / _COMPARE / _REVERSE / _REFUSALS / _RESULT.
//
// Requires GODOT_PROJECT (the example project) and GODOT_BIN, and a display: it is run under
// xvfb-run with LIBGL_ALWAYS_SOFTWARE=1 by integration.yml. Not part of `npm test`.
import { Population } from "./_population.mjs";

// The claim population, counted (169 §10 item 2): each family below must speak, and must have
// asserted something when it does. The floor is the count this file makes on a complete run.
const population = new Population("HEARING_LIVE", {
  families: [
    "HEARING_LIVE_PICTURE", "HEARING_LIVE_LENGTH", "HEARING_LIVE_LEVEL", "HEARING_LIVE_LOUDNESS",
    "HEARING_LIVE_TONE", "HEARING_LIVE_FRAMES", "HEARING_LIVE_CLIP", "HEARING_LIVE_COMPARE",
    "HEARING_LIVE_REVERSE", "HEARING_LIVE_REFUSALS",
  ],
  scope: 10,
  claims: 41,
});
// 🔴 ANNOTATED, SO THIS FILE PAYS NO `TS2775`. `checkJs` will not narrow through an assertion
// function reached by an un-annotated binding, which is the tax `scripts/lint_ceiling.py`'s TS2775
// row records for every other probe. One JSDoc line on the binding is the whole fix.
/** @type {typeof import("node:assert/strict")} */
const assert = population.assert;
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../dist/config.js";
import { registerHearingTools } from "../dist/tools/hearing.js";

const cfg = loadConfig();
const tools = new Map();
registerHearingTools({ registerTool: (n, _c, h) => tools.set(n, h) }, cfg);
const raw = (n, a) => tools.get(n)(a, {});
const SCENE = "res://tests/hearing_probe.tscn";

/** A reading within `tol` of what the fixture's arithmetic says. `null` (silence) never is. */
function near(actual, expected, tol, what) {
  assert.ok(actual !== null && Math.abs(actual - expected) <= tol, `${what}: read ${actual}, expected ${expected} ± ${tol}`);
}

console.log(`hearing probe -> ${cfg.godotBin}  project=${cfg.projectPath}`);

// 1. Record the clean tone. The reply carries a spectrogram as its second content block.
const t0 = Date.now();
const r1 = await raw("godot_record", { scene: SCENE, seconds: 2 });
assert.equal(r1.isError, undefined, `godot_record failed: ${r1.content?.[0]?.text}`);
const s1 = r1.structuredContent, a1 = s1.analysis;
console.log(`hearing probe: clean recording took ${Date.now() - t0} ms -> ${s1.wav}`);
const png1 = Buffer.from(r1.content[1].data, "base64");
assert.equal(r1.content[1].type, "image");
assert.equal(r1.content[1].mimeType, "image/png");
assert.ok(png1.subarray(1, 4).toString("ascii") === "PNG", "the picture is not a PNG");
population.seal("HEARING_LIVE_PICTURE", `ok ${png1.length} bytes`);

// 2. Movie Maker mixes in lockstep with the frame clock, so the length is exact, not approximate.
near(a1.duration_s, 2, 0.001, "duration");
assert.equal(a1.sample_rate, 48000);
assert.equal(a1.channels, 2);
population.seal("HEARING_LIVE_LENGTH", `ok ${a1.duration_s} s at ${a1.sample_rate} Hz x${a1.channels}`);

// 3. The level: sample peak and RMS of a 0.25 sine.
near(a1.peak_dbfs, -12.04, 0.02, "peak");
near(a1.rms_dbfs, -15.05, 0.05, "rms");
population.seal("HEARING_LIVE_LEVEL", `ok peak ${a1.peak_dbfs} dBFS rms ${a1.rms_dbfs} dBFS`);

// 4. Integrated loudness: two channels of that sine, K-weighted (1 kHz is K-weighting's 0 dB point).
near(a1.loudness_lufs, -12.04, 0.1, "loudness");
population.seal("HEARING_LIVE_LOUDNESS", `ok ${a1.loudness_lufs} LUFS`);

// 5. The tone itself, and nothing at full scale.
near(a1.dominant_hz, 1000, 2, "dominant");
assert.equal(a1.clipped_samples, 0);
population.seal("HEARING_LIVE_TONE", `ok ${a1.dominant_hz} Hz, 0 clipped`);

// 6. 🆕 BP-0063 (336): by default Movie Maker writes one AVI, the host keeps its sound and deletes
// it, and no picture is ever written as a file. One picture per frame, exactly: 2 s at 60 fps.
// The AVI's sound is the engine's depth — 32-bit on 4.2 to 4.5, 16-bit on 4.7 (measured at 336) —
// and the level above was read from it. With `keep_frames` it is the PNG route instead: the frames
// stay and the WAV is the 32-bit mix on every version.
const recDir = (wav) => path.join(cfg.projectPath, path.dirname(wav.slice("res://".length)));
assert.equal(s1.frames_dir, null);
assert.equal(s1.frames, 120, `the AVI held ${s1.frames} pictures, not one per frame of 2 s at 60 fps`);
assert.ok(a1.bits === 16 || a1.bits === 32, `the default route's sound is ${a1.bits}-bit, neither of the AVI writer's two depths`);
assert.deepEqual(fs.readdirSync(recDir(s1.wav)), ["sound.wav"], "only the WAV is left: no movie, no picture");
const rk = await raw("godot_record", { scene: SCENE, seconds: 1, keep_frames: true });
assert.equal(rk.isError, undefined, `godot_record (keep_frames) failed: ${rk.content?.[0]?.text}`);
const sk = rk.structuredContent;
assert.equal(sk.frames_dir, `res://${path.dirname(sk.wav.slice("res://".length))}`);
assert.equal(fs.readdirSync(recDir(sk.wav)).filter((f) => /^frame\d+\.png$/.test(f)).length, sk.frames);
assert.equal(sk.frames, 60, `keep_frames kept ${sk.frames} frames, not one per frame of 1 s at 60 fps`);
assert.equal(sk.analysis.bits, 32, `the PNG route's sound is ${sk.analysis.bits}-bit, not the engine's 32`);
near(sk.analysis.peak_dbfs, -12.04, 0.02, "peak (keep_frames)");
population.seal("HEARING_LIVE_FRAMES", `ok ${s1.frames} pictures in one AVI, none kept, ${a1.bits}-bit; keep_frames kept ${sk.frames} PNGs, 32-bit`);

// 7. The same scene at +18 dB: the engine's mixer clips, and the analysis has to say so.
const r2 = await raw("godot_record", { scene: SCENE, seconds: 2, user_args: ["--hearing-gain-db=18"], compare_to: s1.wav });
assert.equal(r2.isError, undefined, `godot_record (+18 dB) failed: ${r2.content?.[0]?.text}`);
const a2 = r2.structuredContent.analysis, c = r2.structuredContent.comparison;
assert.ok(a2.clipped_samples > 1000, `only ${a2.clipped_samples} clipped samples at +18 dB`);
near(a2.peak_dbfs, 0, 0.01, "clipped peak");
population.seal("HEARING_LIVE_CLIP", `ok ${a2.clipped_samples} samples at full scale in ${a2.clipped_runs} runs`);

// 8. The comparison, this recording minus the clean one: the peak is capped by full scale, the
// RMS rises by less than the gain, and clipping's harmonics fill the 4 kHz octave.
near(c.delta.peak_dbfs, 12.04, 0.05, "peak delta");
assert.ok(c.delta.rms_dbfs > 9 && c.delta.rms_dbfs < 18, `rms delta ${c.delta.rms_dbfs}`);
const band4k = c.band_delta_db.find((b) => b.hz === 4000);
assert.ok(band4k && band4k.db > 30, `4 kHz octave rose ${band4k?.db} dB`);
population.seal("HEARING_LIVE_COMPARE", `ok peak +${c.delta.peak_dbfs} dB rms +${c.delta.rms_dbfs} dB 4k +${band4k.db} dB`);

// 9. `audio_analyze` on the two files the other way round: the same comparison, reversed.
const r3 = await raw("audio_analyze", { path: s1.wav, compare_to: r2.structuredContent.wav });
assert.equal(r3.isError, undefined, `audio_analyze failed: ${r3.content?.[0]?.text}`);
near(r3.structuredContent.comparison.delta.peak_dbfs, -12.04, 0.05, "reversed peak delta");
population.seal("HEARING_LIVE_REVERSE", `ok peak ${r3.structuredContent.comparison.delta.peak_dbfs} dB`);

// 10. What both tools refuse, each before Godot or the file system sees it.
const notWav = await raw("audio_analyze", { path: "res://tests/hearing_probe.gd" });
assert.equal(notWav.isError, true);
assert.match(notWav.content[0].text, /Pass a PCM or float WAV/);
const outside = await raw("audio_analyze", { path: "res://../outside.wav" });
assert.equal(outside.isError, true);
const option = await raw("godot_record", { scene: "--script=res://tests/hearing_probe.gd" });
assert.equal(option.isError, true);
assert.match(option.content[0].text, /reads as a command-line option/);
for (const [tool, args, param] of [
  ["godot_record", { scene: "res://../elsewhere.tscn" }, "scene"],
  ["godot_record", { compare_to: "res://../x.wav" }, "compare_to"],
  ["audio_analyze", { path: s1.wav, compare_to: "res://../x.wav" }, "compare_to"],
]) {
  const r = await raw(tool, args);
  assert.equal(r.isError, true, `${tool}.${param}: res://.. was not refused`);
  assert.match(r.content[0].text, new RegExp(String(param)));
}
population.seal("HEARING_LIVE_REFUSALS", "ok not-a-WAV, outside, option-shaped scene, three res://..");

for (const w of [s1.wav, sk.wav, r2.structuredContent.wav]) {
  fs.rmSync(path.join(cfg.projectPath, path.dirname(w.slice("res://".length))), { recursive: true, force: true });
}
console.log(`HEARING_LIVE_RESULT peak=${a1.peak_dbfs} rms=${a1.rms_dbfs} lufs=${a1.loudness_lufs} clipped=${a2.clipped_samples}`);
population.reportOrDie();
console.log("✔ hearing-plane integration OK");

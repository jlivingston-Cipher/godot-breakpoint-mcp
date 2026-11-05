// 🆕 BP-0026 (334) — the hearing plane's measurement, checked against arithmetic and against the
// standard's own numbers, never against an earlier run of itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { parseWav, analyze, compare, kWeighting, spectrogram, stack, encodePng, WavError, OCTAVES, channelWeights } from "../src/hearing.js";

type Kind = "u8" | "i16" | "i24" | "i32" | "f32";
/** A WAV in memory; `ext` writes WAVE_FORMAT_EXTENSIBLE (with `mask` as its speaker mask). */
function wav(chans: number[][], rate: number, kind: Kind, ext = false, mask = 0): Buffer {
  const bits = { u8: 8, i16: 16, i24: 24, i32: 32, f32: 32 }[kind], bps = bits / 8, n = chans[0].length, ch = chans.length;
  const fmtLen = ext ? 40 : 16, data = Buffer.alloc(n * ch * bps);
  let p = 0;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++, p += bps) {
    const v = Math.max(-1, Math.min(1, chans[c][i]));
    if (kind === "f32") data.writeFloatLE(chans[c][i], p);
    else if (kind === "u8") data[p] = Math.round(v * 127) + 128;
    else if (kind === "i16") data.writeInt16LE(Math.round(v * 32767), p);
    else if (kind === "i24") data.writeIntLE(Math.round(v * 8388607), p, 3);
    else data.writeInt32LE(Math.round(v * 2147483647), p);
  }
  const fmt = Buffer.alloc(fmtLen);
  fmt.writeUInt16LE(ext ? 0xfffe : kind === "f32" ? 3 : 1, 0); fmt.writeUInt16LE(ch, 2); fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate * ch * bps, 8); fmt.writeUInt16LE(ch * bps, 12); fmt.writeUInt16LE(bits, 14);
  if (ext) { fmt.writeUInt16LE(22, 16); fmt.writeUInt16LE(bits, 18); fmt.writeUInt32LE(mask, 20); fmt.writeUInt16LE(kind === "f32" ? 3 : 1, 24); }
  const hdr = (id: string, len: number): Buffer => { const b = Buffer.alloc(8); b.write(id, 0, "ascii"); b.writeUInt32LE(len, 4); return b; };
  const body = Buffer.concat([Buffer.from("WAVE"), hdr("fmt ", fmtLen), fmt, hdr("data", data.length), data]);
  return Buffer.concat([hdr("RIFF", body.length), body]);
}
const sine = (hz: number, amp: number, secs: number, rate = 48000, phase = 0): number[] =>
  Array.from({ length: Math.round(secs * rate) }, (_, i) => amp * Math.sin(2 * Math.PI * hz * (i / rate) + phase));
/** Every number anywhere in `v` is finite — what the server's finiteness pass would demand. */
const allFinite = (v: unknown): boolean =>
  typeof v === "number" ? Number.isFinite(v) : Array.isArray(v) ? v.every(allFinite) : v !== null && typeof v === "object" ? Object.values(v).every(allFinite) : true;
/** Raw RIFF assembly for chunk-order cases: [id, body] pairs after "WAVE". */
const riff = (chunks: Array<[string, Buffer, number?]>): Buffer => {
  const parts: Buffer[] = [Buffer.from("WAVE")];
  for (const [id, body, len] of chunks) {
    const h = Buffer.alloc(8); h.write(id, 0, "ascii"); h.writeUInt32LE(len ?? body.length, 4);
    parts.push(h, body); if (body.length & 1) parts.push(Buffer.alloc(1));
  }
  const b = Buffer.concat(parts), h = Buffer.alloc(8); h.write("RIFF", 0, "ascii"); h.writeUInt32LE(b.length, 4);
  return Buffer.concat([h, b]);
};
/** The fmt and data bodies of a plain 16-bit mono WAV of `x`. */
const pieces = (x: number[], rate = 48000): { fmt: Buffer; data: Buffer } => {
  const b = wav([x], rate, "i16");
  return { fmt: b.subarray(20, 36), data: b.subarray(44) };
};
/** `a` is a number within `tol` of `b`. Asserted at each call site, inside its test, so every claim has a unit. */
const within = (a: number | null, b: number, tol: number): boolean => a !== null && Math.abs(a - b) <= tol;

test("K-weighting at 48 kHz reproduces BS.1770-4's published coefficients", () => {
  const [shelf, hp] = kWeighting(48000);
  [1.53512485958697, -2.69169618940638, 1.19839281085285].forEach((v, i) => assert.ok(within(shelf.b[i], v, 1e-9), `${`shelf b${i}`}: ${shelf.b[i]} not within 1e-9 of ${v}`));
  [-1.69065929318241, 0.73248077421585].forEach((v, i) => assert.ok(within(shelf.a[i + 1], v, 1e-9), `${`shelf a${i + 1}`}: ${shelf.a[i + 1]} not within 1e-9 of ${v}`));
  [-1.99004745483398, 0.99007225036621].forEach((v, i) => assert.ok(within(hp.a[i + 1], v, 1e-9), `${`highpass a${i + 1}`}: ${hp.a[i + 1]} not within 1e-9 of ${v}`));
});

test("the standard's calibration: a full-scale 1 kHz sine in one channel reads -3.01 LUFS", () => {
  const a = analyze(parseWav(wav([sine(1000, 1, 3)], 48000, "f32")));
  assert.ok(within(a.loudness_lufs, -3.01, 0.05), `${"loudness"}: ${a.loudness_lufs} not within 0.05 of ${-3.01}`);
});

test("the fixture's sine (1 kHz at 0.25, stereo, 32-bit PCM as Movie Maker writes it) reads its arithmetic", () => {
  const s = sine(1000, 0.25, 2);
  const a = analyze(parseWav(wav([s, s], 48000, "i32")));
  assert.equal(a.sample_rate, 48000); assert.equal(a.channels, 2); assert.equal(a.bits, 32); assert.ok(within(a.duration_s, 2, 1e-9), `${"duration"}: ${a.duration_s} not within 1e-9 of ${2}`);
  assert.ok(within(a.peak_dbfs, -12.04, 0.01), `${"sample peak"}: ${a.peak_dbfs} not within 0.01 of ${-12.04}`); assert.ok(within(a.rms_dbfs, -15.05, 0.01), `${"rms"}: ${a.rms_dbfs} not within 0.01 of ${-15.05}`);
  assert.ok(within(a.loudness_lufs, -12.04, 0.05), `${"loudness"}: ${a.loudness_lufs} not within 0.05 of ${-12.04}`); assert.ok(within(a.dominant_hz, 1000, 1), `${"dominant"}: ${a.dominant_hz} not within 1 of ${1000}`);
  const k = a.bands.find((b) => b.hz === 1000)!;
  assert.ok(within(k.db, -15.05, 0.3), `${"the 1 kHz octave"}: ${k.db} not within 0.3 of ${-15.05}`);
  for (const b of a.bands) if (b.hz !== 1000 && b.db !== null) assert.ok(b.db < (k.db as number) - 40, `${b.hz} Hz band ${b.db}`);
  assert.equal(a.clipped_samples, 0); assert.equal(a.first_clip_s, null); assert.equal(a.silent_fraction, 0);
  // sample 0 of sin() is 0, sample 1 is 0.033: the onset is the second sample, 1/48000 s
  assert.ok(a.onset_s !== null && a.onset_s <= 1 / 48000, `onset ${a.onset_s}`);
  assert.equal(a.bands.length, OCTAVES.length); assert.equal(a.nonfinite_samples, 0);
  assert.equal(a.loudness_weighting, "every channel 1.0");
  assert.ok(allFinite(a), "every number finite");
});

test("true peak finds the over that sits between the samples", () => {
  // fs/4 at a 45-degree phase: every sample lands at +-0.707 of the amplitude, 3 dB under the wave.
  const a = analyze(parseWav(wav([sine(12000, 0.5, 1, 48000, Math.PI / 4)], 48000, "f32")));
  assert.ok(within(a.peak_dbfs, 20 * Math.log10(0.5 * Math.SQRT1_2), 0.01), `${"sample peak"}: ${a.peak_dbfs} not within 0.01 of ${20 * Math.log10(0.5 * Math.SQRT1_2)}`);
  assert.ok(within(a.true_peak_dbtp, 20 * Math.log10(0.5), 0.25), `${"true peak"}: ${a.true_peak_dbtp} not within 0.25 of ${20 * Math.log10(0.5)}`);
});

test("clipping is counted, located and run-counted, exactly", () => {
  // 2·sin clamped to ±1: |2 sin| >= 0.9999 for 2/3 of the time, one run per half cycle, and the
  // first sample at or over full scale is #10 (asin(0.49995)/(2π·440) = 0.1894 ms -> sample 9.09).
  const s = sine(440, 2, 1).map((v) => Math.max(-1, Math.min(1, v)));
  const a = analyze(parseWav(wav([s], 48000, "i32")));
  // counted independently on the source signal (about 2/3 of 48000; each of the 880 runs straddles
  // sample boundaries, so the closed form is only approximate)
  assert.equal(a.clipped_samples, s.filter((v) => Math.abs(v) >= 0.9999).length);
  assert.ok(within(a.clipped_samples, 32000, 120), `${"about two thirds of the samples"}: ${a.clipped_samples} not within 120 of ${32000}`);
  assert.equal(a.clipped_runs, 880);
  assert.equal(a.first_clip_s, 0.0002);
});

test("8-bit full scale is 127/128: a square wave at both rails clips on both sides", () => {
  const sq = Array.from({ length: 4800 }, (_, i) => (Math.floor(i / 24) % 2 ? -1 : 1));
  const a = analyze(parseWav(wav([sq], 48000, "u8")));
  assert.equal(a.clipped_samples, 4800);
  assert.ok(within(analyze(parseWav(wav([sine(1000, 0.25, 0.5)], 48000, "u8"))).peak_dbfs, -12.04, 0.1), `${"8-bit peak"}: ${analyze(parseWav(wav([sine(1000, 0.25, 0.5)], 48000, "u8"))).peak_dbfs} not within 0.1 of ${-12.04}`);
  assert.ok(within(analyze(parseWav(wav([sine(1000, 0.25, 0.5)], 48000, "i24"))).peak_dbfs, -12.04, 0.01), `${"24-bit peak"}: ${analyze(parseWav(wav([sine(1000, 0.25, 0.5)], 48000, "i24"))).peak_dbfs} not within 0.01 of ${-12.04}`);
});

test("silence reads null, never -Infinity, and the reply survives JSON", () => {
  const a = analyze(parseWav(wav([new Array(48000).fill(0)], 48000, "i16")));
  assert.equal(a.peak_dbfs, null); assert.equal(a.rms_dbfs, null); assert.equal(a.loudness_lufs, null);
  assert.equal(a.onset_s, null); assert.equal(a.silent_fraction, 1); assert.equal(a.dominant_hz, null);
  assert.ok(a.bands.every((b) => b.db === null));
  assert.ok(allFinite(a)); assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
});

test("NaN and Infinity samples in a float file are counted and read as 0, and every reading stays finite", () => {
  const x = sine(1000, 0.25, 1);
  x[1000] = NaN; x[2000] = Infinity; x[3000] = -Infinity;
  const a = analyze(parseWav(wav([x], 48000, "f32")));
  assert.equal(a.nonfinite_samples, 3);
  assert.ok(allFinite(a)); assert.ok(within(a.peak_dbfs, -12.04, 0.01), `${"peak"}: ${a.peak_dbfs} not within 0.01 of ${-12.04}`); assert.notEqual(a.loudness_lufs, null);
});

test("a sample rate under 8 kHz is refused, not measured (a 4 Hz header used to loop forever)", () => {
  for (const rate of [4, 2000]) assert.throws(() => parseWav(wav([sine(1, 0.25, 0.01, 100000)], rate, "i16")), WavError);
});

test("44.1 kHz: the K-weighting re-derived for the rate still gives the standard's -3.01 LUFS", () => {
  assert.ok(within(analyze(parseWav(wav([sine(1000, 1, 3, 44100)], 44100, "f32"))).loudness_lufs, -3.01, 0.05), `${"loudness at 44.1k"}: ${analyze(parseWav(wav([sine(1000, 1, 3, 44100)], 44100, "f32"))).loudness_lufs} not within 0.05 of ${-3.01}`);
});

test("a sound shorter than one analysis window reads true in its octave (a click or a footstep)", () => {
  for (const n of [4097, 6000]) {
    const a = analyze(parseWav(wav([sine(1000, 0.25, n / 48000)], 48000, "f32")));
    assert.ok(within(a.bands.find((b) => b.hz === 1000)!.db, a.rms_dbfs as number, 0.35), `${`${n}-frame 1 kHz octave vs RMS`}: ${a.bands.find((b) => b.hz === 1000)!.db} not within 0.35 of ${a.rms_dbfs as number}`);
  }
});

test("a long file is read end to end: a 50 ms burst reads the same wherever it falls", () => {
  const burstAt = (start: number): number | null => {
    const x = new Array(48000 * 40).fill(0);
    for (let i = 0; i < 2400; i++) x[start + i] = 0.5 * Math.sin((2 * Math.PI * 3000 * i) / 48000);
    return analyze(parseWav(wav([x], 48000, "f32"))).bands.find((b) => b.hz === 4000)!.db;
  };
  const a = burstAt(48000 * 20), b = burstAt(48000 * 20 + 2048 - 1200), c = burstAt(48000 * 37 + 3333);
  assert.ok(within(b, a as number, 0.5), `${"burst on a window boundary vs mid-window"}: ${b} not within 0.5 of ${a as number}`); assert.ok(within(c, a as number, 0.5), `${"burst late in the file"}: ${c} not within 0.5 of ${a as number}`);
});

test("channel weights: the mask names the speakers; without one only Movie Maker's layouts are assumed", () => {
  assert.deepEqual(channelWeights(2, null).weights, [1, 1]);
  assert.deepEqual(channelWeights(6, null).weights, [1, 1, 1, 0, 1.41, 1.41]);
  assert.deepEqual(channelWeights(8, null).weights, [1, 1, 1, 0, 1, 1, 1.41, 1.41]);
  assert.deepEqual(channelWeights(9, null).weights, Array(9).fill(1));
  assert.deepEqual(channelWeights(6, 0x3f).weights, [1, 1, 1, 0, 1.41, 1.41]);                 // 5.1 back
  assert.deepEqual(channelWeights(8, 0x63f).weights, [1, 1, 1, 0, 1, 1, 1.41, 1.41]);           // 7.1
  const s = sine(1000, 0.25, 1), z = new Array(s.length).fill(0);
  const back71 = analyze(parseWav(wav([z, z, z, z, s, z, z, z], 48000, "f32", true, 0x63f)));
  assert.ok(within(back71.loudness_lufs, analyze(parseWav(wav([s], 48000, "f32"))).loudness_lufs as number, 0.01), `${"a back channel beyond 120 degrees weighs 1.0"}: ${back71.loudness_lufs} not within 0.01 of ${analyze(parseWav(wav([s], 48000, "f32"))).loudness_lufs as number}`);
  assert.equal(back71.loudness_weighting, "from the file's speaker mask");
});

test("chunk order: a LIST before fmt (odd length, padded), data before fmt, an empty data chunk, a truncated file", () => {
  const x = sine(1000, 0.25, 0.25), { fmt, data } = pieces(x), ref = analyze(parseWav(wav([x], 48000, "i16")));
  assert.ok(within(analyze(parseWav(riff([["LIST", Buffer.from("abc")], ["fmt ", fmt], ["data", data]]))).peak_dbfs, ref.peak_dbfs as number, 0.001), `${"LIST first"}: ${analyze(parseWav(riff([["LIST", Buffer.from("abc")], ["fmt ", fmt], ["data", data]]))).peak_dbfs} not within 0.001 of ${ref.peak_dbfs as number}`);
  assert.ok(within(analyze(parseWav(riff([["data", data], ["fmt ", fmt]]))).peak_dbfs, ref.peak_dbfs as number, 0.001), `${"data before fmt"}: ${analyze(parseWav(riff([["data", data], ["fmt ", fmt]]))).peak_dbfs} not within 0.001 of ${ref.peak_dbfs as number}`);
  assert.equal(parseWav(riff([["fmt ", fmt], ["data", Buffer.alloc(0)], ["LIST", Buffer.from("abcd")]])).frames, 0);
  const full = riff([["fmt ", fmt], ["data", data]]);
  const cut = parseWav(full.subarray(0, full.length - 2000));
  assert.equal(cut.frames, x.length - 1000);
});

test("compare: the same tone 6 dB up is +6.02 everywhere it should be, and the bands agree", () => {
  const A = analyze(parseWav(wav([sine(1000, 0.25, 2)], 48000, "f32")));
  const B = analyze(parseWav(wav([sine(1000, 0.5, 2)], 48000, "f32")));
  const c = compare(A, B);
  assert.ok(within(c.delta.peak_dbfs, 6.02, 0.01), `${"peak"}: ${c.delta.peak_dbfs} not within 0.01 of ${6.02}`); assert.ok(within(c.delta.rms_dbfs, 6.02, 0.01), `${"rms"}: ${c.delta.rms_dbfs} not within 0.01 of ${6.02}`); assert.ok(within(c.delta.loudness_lufs, 6.02, 0.05), `${"loudness"}: ${c.delta.loudness_lufs} not within 0.05 of ${6.02}`);
  assert.ok(within(c.band_delta_db.find((b) => b.hz === 1000)!.db, 6.02, 0.05), `${"1 kHz band"}: ${c.band_delta_db.find((b) => b.hz === 1000)!.db} not within 0.05 of ${6.02}`);
  assert.ok(within(c.band_mean_abs_diff_db, 6.02, 0.5), `${"mean band difference"}: ${c.band_mean_abs_diff_db} not within 0.5 of ${6.02}`);
  assert.equal(c.delta.dominant_hz, 0); assert.deepEqual(c.notes, []);
});

test("WAV encodings: 16-bit, float, EXTENSIBLE read alike; what is not a WAV is refused", () => {
  const s = sine(1000, 0.25, 0.5);
  const ref = analyze(parseWav(wav([s], 48000, "f32")));
  for (const b of [wav([s], 48000, "i16"), wav([s], 48000, "i32", true), wav([s], 48000, "f32", true)]) assert.ok(within(analyze(parseWav(b)).peak_dbfs, ref.peak_dbfs as number, 0.01), `${"peak"}: ${analyze(parseWav(b)).peak_dbfs} not within 0.01 of ${ref.peak_dbfs as number}`);
  for (const bad of [Buffer.from("not a wav at all"), (() => { const b = wav([s], 48000, "i16"); b.writeUInt16LE(2, 20); return b; })()]) {
    assert.throws(() => parseWav(bad), (e: unknown) => e instanceof WavError);
  }
});

test("the picture: a well-formed PNG whose 1 kHz row is the brightest, and a stacked pair", () => {
  const s = sine(1000, 0.25, 2);
  const r = spectrogram(parseWav(wav([s], 48000, "f32")), 400, 200);
  assert.equal(r.width, 375); assert.equal(r.height, 206);
  const png = encodePng(r);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.readUInt32BE(16), 375); assert.equal(png.readUInt32BE(20), 206);
  assert.equal(png.readUInt32BE(png.length - 4), 0xae426082, "IEND CRC");
  const idatLen = png.readUInt32BE(33);
  assert.equal(zlib.inflateSync(png.subarray(41, 41 + idatLen)).length, (375 * 3 + 1) * 206);
  // brightest row in the middle column should be the 1 kHz row: log position of 1 kHz in 20 Hz..20 kHz
  const x = 187, lum = (y: number): number => r.rgb[(y * r.width + x) * 3] + r.rgb[(y * r.width + x) * 3 + 1];
  let best = 6;
  for (let y = 6; y < r.height; y++) if (lum(y) > lum(best)) best = y;
  const want = r.height - 1 - Math.round((Math.log(1000 / 20) / Math.log(20000 / 20)) * 200);
  assert.ok(Math.abs(best - want) <= 3, `brightest row ${best}, 1 kHz row ${want}`);
  const st = stack(r, r);
  assert.equal(st.height, 206 * 2 + 4); assert.equal(st.width, 375);
});

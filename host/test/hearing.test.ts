// 🆕 BP-0026 (334) — the hearing plane's measurement, checked against arithmetic and against the
// standard's own numbers, never against an earlier run of itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { parseWav, analyze, compare, kWeighting, spectrogram, stack, encodePng, WavError, OCTAVES, channelWeights, demuxAviSound, AviError } from "../src/hearing.js";

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
  assert.equal(a.bands.length, 10, "ten octaves, so the every() below has a population");
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

// ---- 🆕 BP-0063 (336): the sound inside a Movie Maker AVI ---------------------------------------

/** A chunk: id, little-endian size, body, and the pad byte RIFF puts after an odd body. */
const chunk = (id: string, body: Buffer, size = body.length): Buffer => {
  const h = Buffer.alloc(8); h.write(id, 0, "latin1"); h.writeUInt32LE(size, 4);
  return Buffer.concat([h, body, Buffer.alloc(body.length & 1)]);
};
const list = (kind: string, parts: Buffer[], size?: number): Buffer => {
  const b = Buffer.concat([Buffer.from(kind, "latin1"), ...parts]);
  return chunk("LIST", b, size ?? b.length);
};
/**
 * An AVI laid out the way Godot's MJPEG writer lays one out (measured on 4.3's and 4.7.1's at 336):
 * hdrl with a `vids` then an `auds` stream, then `movi` holding one picture chunk `00db` and one
 * sound chunk `01wb` per frame, then `idx1`. `pcm16` is interleaved 16-bit sound, split evenly.
 */
function avi(pcm16: Buffer, frames: number, channels: number, opts: { picture?: number; zeroSizes?: boolean; noSound?: boolean } = {}): Buffer {
  const pic = opts.picture ?? 5, align = channels * 2, per = Math.floor(pcm16.length / align / frames) * align;
  const strh = (kind: string): Buffer => { const b = Buffer.alloc(48); b.write(kind, 0, "latin1"); return chunk("strh", b); };
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0); fmt.writeUInt16LE(channels, 2); fmt.writeUInt32LE(48000, 4);
  fmt.writeUInt32LE(48000 * align, 8); fmt.writeUInt16LE(align, 12); fmt.writeUInt16LE(16, 14);
  const streams = [list("strl", [strh("vids"), chunk("strf", Buffer.alloc(40))])];
  if (!opts.noSound) streams.push(list("strl", [strh("auds"), chunk("strf", fmt)]));
  const hdrl = list("hdrl", [chunk("avih", Buffer.alloc(56)), ...streams]);
  const movi: Buffer[] = [];
  for (let f = 0; f < frames; f++) {
    movi.push(chunk("00db", Buffer.alloc(pic, 0xd8)));
    if (!opts.noSound) movi.push(chunk("01wb", pcm16.subarray(f * per, (f + 1) * per)));
  }
  const z = opts.zeroSizes ? 0 : undefined;
  // Past the index, a sound chunk that is NOT the movie's: the walk must stop at idx1, so none of
  // these bytes may reach the WAV. (Godot itself ends the file at idx1; 336's review found the 70
  // bytes the first capture seemed to carry past it were its RIFF size written 70 short.)
  const tail = opts.zeroSizes ? [] : [chunk("idx1", Buffer.alloc(16 * frames)), chunk("01wb", Buffer.alloc(per, 0x7f))];
  const body = Buffer.concat([Buffer.from("AVI ", "latin1"), hdrl, list("movi", movi, z), ...tail]);
  return chunk("RIFF", body, z ?? body.length - 70);
}
/** A reader over `b` that records every range it was asked for. */
const reader = (b: Buffer) => {
  const asked: Array<[number, number]> = [];
  return { asked, read: (pos: number, len: number): Buffer => { asked.push([pos, len]); return b.subarray(pos, pos + len); } };
};
/** The 16-bit interleaved samples Movie Maker's AVI carries for `chans`. */
const int16 = (chans: number[][]): Buffer => wav(chans, 48000, "i16").subarray(44);

test("an AVI's sound is re-wrapped byte for byte, and its pictures are counted without being read", () => {
  const l = sine(1000, 0.25, 0.5), r = sine(1000, 0.25, 0.5, 48000, 1), samples = int16([l, r]);
  const file = avi(samples, 30, 2, { picture: 4001 });
  const { asked, read } = reader(file);
  const got = demuxAviSound(read, file.length);
  assert.equal(got.videoFrames, 30, "one picture chunk per frame is counted");
  assert.equal(got.truncated, false, "a closed movie is not reported cut short");
  assert.deepEqual(got.wav.subarray(44), samples, "the WAV's data is the movie's sound chunks, concatenated, unchanged");
  const pcm = parseWav(got.wav), ref = analyze(parseWav(wav([l, r], 48000, "i16")));
  assert.equal(pcm.bits, 16); assert.equal(pcm.channels, 2); assert.equal(pcm.frames, l.length);
  assert.equal(analyze(pcm).peak_dbfs, ref.peak_dbfs, "the tone measures as the same tone written as a plain WAV");
  const biggest = Math.max(...asked.map(([, n]) => n));
  assert.ok(biggest < 4001, `no read reached into a 4001-byte picture (largest read ${biggest} bytes)`);
});

test("an AVI's sizes are not trusted: zeroed RIFF and LIST sizes, no index, a file cut inside a sound chunk", () => {
  const x = sine(440, 0.5, 0.25), samples = int16([x, x]);
  const whole = avi(samples, 10, 2, { zeroSizes: true });
  assert.deepEqual(demuxAviSound(reader(whole).read, whole.length).wav.subarray(44), samples, "sizes of 0 (a run stopped before Movie Maker closed the movie) read to the end");
  const cut = whole.subarray(0, whole.length - 1001);
  const got = demuxAviSound(reader(cut).read, cut.length);
  assert.equal(got.truncated, true, "a movie that ends inside a chunk says so");
  assert.equal(parseWav(got.wav).frames, (samples.length - 1001 - ((samples.length - 1001) % 4)) / 4, "the sound stops at its last whole sample");
});

test("an AVI cut inside a chunk header is reported cut short, a cut picture is not counted, and a corrupt format or an oversized sound is refused", () => {
  const x = sine(1000, 0.25, 0.1), samples = int16([x, x]);
  const whole = avi(samples, 6, 2, { zeroSizes: true, picture: 9 });
  const inHeader = whole.subarray(0, whole.length - 3203);
  const a = demuxAviSound(reader(inHeader).read, inHeader.length);
  assert.equal(a.truncated, true, "a movie that ends three bytes into a chunk header says so");
  const inPicture = whole.subarray(0, whole.length - 3200 - 8 - 4);
  assert.equal(demuxAviSound(reader(inPicture).read, inPicture.length).videoFrames, 5, "the sixth picture was cut off, so it is not counted as written");
  const bad = Buffer.from(whole);
  const at = bad.indexOf("strf", bad.indexOf("auds"), "latin1");
  bad.writeUInt32LE(5_000_000, at + 4);
  assert.throws(() => demuxAviSound(reader(bad).read, bad.length), (e: unknown) => e instanceof AviError && /format chunk claims 5000000 bytes/.test(e.message));
  assert.throws(() => demuxAviSound(reader(whole).read, whole.length, 4000), (e: unknown) => e instanceof AviError && /over the/.test(e.message));
});

test("an AVI with an odd-length picture still demuxes; no sound stream, or not an AVI, is refused", () => {
  const x = sine(1000, 0.25, 0.1), samples = int16([x]);
  const odd = avi(samples, 6, 1, { picture: 7 });
  assert.deepEqual(demuxAviSound(reader(odd).read, odd.length).wav.subarray(44), samples, "the pad byte after a 7-byte picture is stepped over");
  const silent = avi(samples, 6, 1, { noSound: true });
  assert.throws(() => demuxAviSound(reader(silent).read, silent.length), (e: unknown) => e instanceof AviError && /no sound stream/.test(e.message));
  const notAvi = wav([x], 48000, "i16");
  assert.throws(() => demuxAviSound(reader(notAvi).read, notAvi.length), (e: unknown) => e instanceof AviError && /not a RIFF\/AVI/.test(e.message));
});

test("compare says when the two files differ in bit depth (a 16-bit AVI take against a 32-bit keep_frames one); a loud tone moves by under a thousandth of a dB", () => {
  const s = sine(1000, 0.25, 1);
  const c = compare(analyze(parseWav(wav([s, s], 48000, "i32"))), analyze(parseWav(wav([s, s], 48000, "i16"))));
  assert.deepEqual(c.notes, ["bit depths differ: 32 vs 16"]);
  assert.ok(within(c.delta.peak_dbfs, 0, 0.001), `requantising alone moves the peak by ${c.delta.peak_dbfs} dB, not more than 0.001`);
});

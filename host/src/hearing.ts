// 🆕 BP-0026 (334) — THE HEARING PLANE'S MEASUREMENT HALF. Pure: WAV bytes in, numbers and a
// picture out. An assistant cannot listen, so every claim it makes about a game's sound has to
// stand on a number it can read or a picture it can look at, never on an adjective (the 324
// brainstorm's rule). Nothing here touches Godot; `tools/hearing.ts` feeds it what Movie Maker
// wrote, or any WAV the caller names.
//
// Conventions, stated once because every number below follows them:
//   * dBFS is 20·log10 of a linear amplitude where 1.0 is digital full scale. `rms_dbfs` is the
//     RMS of the samples in that scale, so a full-scale SQUARE wave reads 0 and a full-scale
//     SINE reads −3.01. Octave band levels are mean-square power in the same scale, so the
//     bands of a signal inside 22 Hz–22.6 kHz sum (in power) to `rms_dbfs`.
//   * Loudness is ITU-R BS.1770-4 / EBU R128: K-weighting, 400 ms blocks every 100 ms, the
//     −70 LUFS absolute gate and the −10 LU relative gate. A full-scale 1 kHz sine in ONE
//     channel reads −3.01 LUFS, the standard's own calibration. Channel weights are 1.0, except
//     a 5.1/7.1 layout (L R C LFE Ls Rs [Lb Rb]): LFE 0, surrounds 1.41.
//   * Silence is not a number: a level of an all-zero signal is `null`, never −Infinity
//     (JSON cannot carry it, and `finiteness.ts` would refuse the reply).

import zlib from "node:zlib";

/** A decoded WAV: one Float32Array per channel, samples in [−1, 1). */
export interface Pcm {
  rate: number;
  channels: number;
  frames: number;
  bits: number;
  float: boolean;
  data: Float32Array[];
  /** NaN or ±Infinity samples in a float file, counted and read as 0 (one would poison every reading). */
  nonfinite: number;
  /** WAVE_FORMAT_EXTENSIBLE's speaker mask, or null for a plain header. */
  mask: number | null;
}

/** Below this a WAV is refused: K-weighting's shelf sits at 1.7 kHz and is not stable under ~3.4 kHz. */
const MIN_RATE = 8000;

/** A WAV this module cannot read; the message says why, the tool says what to do instead. */
export class WavError extends Error {}

const SUBFORMAT_PCM = 1;
const SUBFORMAT_FLOAT = 3;
const EXTENSIBLE = 0xfffe;

/**
 * Parse a RIFF/WAVE file: PCM 8/16/24/32-bit, IEEE float 32/64-bit, plain or EXTENSIBLE.
 * A `data` chunk whose size field is 0 or larger than the file (a writer that never finalised
 * its header) is read to the end of the file, so a recording cut short still measures.
 */
export function parseWav(buf: Buffer): Pcm {
  if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new WavError("not a RIFF/WAVE file");
  }
  let off = 12;
  let fmt: { tag: number; channels: number; rate: number; bits: number; mask: number | null } | null = null;
  let data: { start: number; len: number } | null = null;
  const looksLikeChunk = (at: number): boolean =>
    at + 8 <= buf.length && /^[A-Za-z0-9 _]{4}$/.test(buf.toString("ascii", at, at + 4)) && at + 8 + buf.readUInt32LE(at + 4) <= buf.length;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    let len = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === "fmt ") {
      if (len < 16 || body + 16 > buf.length) throw new WavError("truncated fmt chunk");
      let tag = buf.readUInt16LE(body);
      const bits = buf.readUInt16LE(body + 14);
      let mask: number | null = null;
      if (tag === EXTENSIBLE && len >= 26 && body + 26 <= buf.length) { mask = buf.readUInt32LE(body + 20); tag = buf.readUInt16LE(body + 24); }
      fmt = { tag, channels: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits, mask };
    } else if (id === "data") {
      // A size of 0 is a writer that never finalised its header — unless a real chunk follows it,
      // in which case it is an empty recording and the bytes after it are not audio.
      const unfinalised = (len === 0 && !looksLikeChunk(body)) || body + len > buf.length;
      if (unfinalised) len = buf.length - body;
      data = { start: body, len };
      if (unfinalised) break;
    }
    off = body + len + (len & 1);
  }
  if (!fmt) throw new WavError(data ? "no fmt chunk (the data chunk has no format to read it by)" : "no fmt chunk");
  if (!data) throw new WavError("no data chunk");
  const { tag, channels, rate, bits, mask } = fmt;
  const float = tag === SUBFORMAT_FLOAT;
  if (!(tag === SUBFORMAT_PCM || float)) throw new WavError(`unsupported WAV encoding (format tag ${tag}); PCM or IEEE float only`);
  if (channels < 1) throw new WavError("fmt chunk declares no channels");
  if (rate < MIN_RATE) throw new WavError(`sample rate ${rate} Hz is below the ${MIN_RATE} Hz this measurement supports`);
  const okBits = float ? [32, 64] : [8, 16, 24, 32];
  if (!okBits.includes(bits)) throw new WavError(`unsupported ${float ? "float" : "PCM"} bit depth ${bits}`);
  const bps = bits / 8;
  const frames = Math.floor(data.len / (bps * channels));
  const out: Float32Array[] = [];
  for (let c = 0; c < channels; c++) out.push(new Float32Array(frames));
  let p = data.start, nonfinite = 0;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++, p += bps) {
      let v: number;
      if (float) v = bits === 32 ? buf.readFloatLE(p) : buf.readDoubleLE(p);
      else if (bits === 8) v = (buf[p] - 128) / 128;
      else if (bits === 16) v = buf.readInt16LE(p) / 32768;
      else if (bits === 24) v = buf.readIntLE(p, 3) / 8388608;
      else v = buf.readInt32LE(p) / 2147483648;
      if (!Number.isFinite(v) || !Number.isFinite(Math.fround(v))) { nonfinite++; v = 0; }
      out[c][i] = v;
    }
  }
  return { rate, channels, frames, bits, float, data: out, nonfinite, mask };
}

// ---- the sound inside a Movie Maker AVI -------------------------------------------------------

/** An AVI this module cannot take the sound out of; the message says why, the tool says what to do. */
export class AviError extends Error {}

/** What `demuxAviSound` takes out of an AVI: the sound as a WAV, and how many pictures it skipped. */
export interface AviSound {
  /** A RIFF/WAVE file: the audio stream's own `strf` as its `fmt `, its sample chunks as `data`. */
  wav: Buffer;
  /** Picture chunks of the video stream, one per frame Movie Maker wrote. */
  videoFrames: number;
  /** The file ended inside a chunk (a run stopped before Movie Maker closed it). */
  truncated: boolean;
}

const CHUNK_ID = /^[\x20-\x7e]{4}$/;

/**
 * 🆕 BP-0063 (336) — THE SOUND OF A MOVIE MAKER AVI, READ WITHOUT READING ITS PICTURES.
 * Godot's MJPEG writer interleaves one picture chunk (`00db`) and one sound chunk (`01wb`) per
 * frame, and the audio stream's `strf` is a WAVEFORMATEX — the body of a WAV `fmt ` chunk — so
 * the sound is re-wrapped as a WAV with no conversion, at whatever depth the engine wrote. Through
 * 4.5 that is the 32-bit mix the PNG writer saves (measured byte for byte on 4.2.2, 4.3 and 4.5).
 * From 4.6 the depth is the project setting `editor/movie_writer/audio_bit_depth`, default 16, and
 * 16 is the 32-bit mix shifted right by 16 — truncated, not dithered (measured on 4.7.1: 960,000 of
 * 960,000 samples; with the setting at 32, byte for byte the PNG route again). Nothing is resampled,
 * converted or dithered here.
 *
 * `read(pos, len)` returns up to `len` bytes at `pos`, so a 3 GB movie is walked a chunk header
 * at a time and only the sound is ever held. No RIFF or LIST size is trusted: Movie Maker writes
 * them when the movie ends (a run stopped at the time limit leaves them unwritten) and they are
 * 32-bit (a movie over 4 GB wraps them). Every LIST is descended into instead, in file order,
 * and the walk ends at the index, at the end of the file, or at bytes that are not a chunk.
 */
export function demuxAviSound(read: (pos: number, len: number) => Buffer, size: number, maxSoundBytes = Infinity): AviSound {
  const head = read(0, 12);
  if (head.length < 12 || head.toString("latin1", 0, 4) !== "RIFF" || head.toString("latin1", 8, 12) !== "AVI ") {
    throw new AviError("not a RIFF/AVI file");
  }
  let off = 12, stream = -1, audio = -1, video = -1, videoFrames = 0, bytes = 0, truncated = false;
  let fmt: Buffer | null = null;
  const parts: Buffer[] = [];
  const tag = (n: number): string => String(n).padStart(2, "0");
  while (off < size) {
    const h = read(off, 8);
    // A movie stopped mid-write can end inside a chunk header as well as inside a body.
    if (h.length < 8) { truncated = true; break; }
    const id = h.toString("latin1", 0, 4), len = h.readUInt32LE(4), body = off + 8;
    if (!CHUNK_ID.test(id) || id === "idx1") break;
    if (id === "RIFF" || id === "LIST") { off = body + 4; continue; }
    const take = Math.max(0, Math.min(len, size - body));
    if (take < len) truncated = true;
    if (id === "strh") {
      stream++;
      const kind = read(body, 4).toString("latin1");
      if (kind === "auds" && audio < 0) audio = stream;
      else if (kind === "vids" && video < 0) video = stream;
    } else if (id === "strf" && stream === audio && fmt === null) {
      // A WAVEFORMATEX is 16 to 40 bytes; a corrupted size must not read the movie as a format.
      if (len > 256) throw new AviError(`its sound stream's format chunk claims ${len} bytes`);
      fmt = read(body, take);
    } else if (audio >= 0 && id === `${tag(audio)}wb`) {
      if (bytes + take > maxSoundBytes) throw new AviError(`its sound is over the ${Math.round(maxSoundBytes / 1048576)} MB this tool reads`);
      const b = read(body, take); parts.push(b); bytes += b.length;
    } else if (video >= 0 && (id === `${tag(video)}db` || id === `${tag(video)}dc`) && take === len) videoFrames++;
    off = body + len + (len & 1);
  }
  if (audio < 0) throw new AviError("it has no sound stream");
  if (!fmt || fmt.length < 16) throw new AviError("its sound stream has no format to read the samples by");
  const align = fmt.readUInt16LE(12);
  const data = Buffer.concat(parts, bytes);
  const whole = align > 0 ? data.subarray(0, data.length - (data.length % align)) : data;
  const pad = fmt.length & 1;
  const out = Buffer.alloc(12 + 8 + fmt.length + pad + 8);
  out.write("RIFF", 0, "latin1");
  out.writeUInt32LE(4 + 8 + fmt.length + pad + 8 + whole.length, 4);
  out.write("WAVE", 8, "latin1");
  out.write("fmt ", 12, "latin1");
  out.writeUInt32LE(fmt.length, 16);
  fmt.copy(out, 20);
  out.write("data", 20 + fmt.length + pad, "latin1");
  out.writeUInt32LE(whole.length, 24 + fmt.length + pad);
  return { wav: Buffer.concat([out, whole]), videoFrames, truncated };
}

// ---- small numerics ---------------------------------------------------------------------------

const round = (v: number, d: number): number => Math.round(v * 10 ** d) / 10 ** d;
/** 20·log10, rounded; null for silence. */
const ampDb = (a: number): number | null => (a > 0 ? round(20 * Math.log10(a), 2) : null);
/** 10·log10 of a power, rounded; null for silence. */
const powDb = (p: number): number | null => (p > 0 ? round(10 * Math.log10(p), 2) : null);

/** In-place iterative radix-2 FFT. `re`/`im` length must be a power of two. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

const hann = (n: number): Float64Array => {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
};

/**
 * Add the one-sided power of the Hann-windowed `x[start..start+n)` (zero outside the file) into
 * `out`, UNSCALED, and return the window energy that fell inside the file. A caller divides its sum
 * by n·Σ(returned energies): the Welch estimate whose bins sum to the mean square of what was read.
 */
function powerFrame(x: Float32Array, start: number, w: Float64Array, out: Float64Array, re: Float64Array, im: Float64Array): number {
  const n = w.length;
  let wss = 0;
  for (let i = 0; i < n; i++) {
    const s = start + i;
    const inside = s >= 0 && s < x.length;
    re[i] = inside ? x[s] * w[i] : 0;
    im[i] = 0;
    if (inside) wss += w[i] * w[i];
  }
  if (wss === 0) return 0;
  fft(re, im);
  const h = n / 2;
  out[0] += re[0] * re[0] + im[0] * im[0];
  for (let b = 1; b < h; b++) out[b] += 2 * (re[b] * re[b] + im[b] * im[b]);
  out[h] += re[h] * re[h] + im[h] * im[h];
  return wss;
}

// ---- BS.1770 ------------------------------------------------------------------------------------

/** K-weighting as two biquads for any sample rate (BS.1770-4's 48 kHz pair, re-derived). */
export function kWeighting(rate: number): Array<{ b: number[]; a: number[] }> {
  // Stage 1 — the high shelf (+4 dB above ~1.7 kHz).
  let K = Math.tan((Math.PI * 1681.974450955533) / rate);
  const Q1 = 0.7071752369554196;
  const Vh = 10 ** (3.999843853973347 / 20), Vb = Vh ** 0.4996667741545416;
  let a0 = 1 + K / Q1 + K * K;
  const shelf = {
    b: [(Vh + (Vb * K) / Q1 + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q1 + K * K) / a0],
    a: [1, (2 * (K * K - 1)) / a0, (1 - K / Q1 + K * K) / a0],
  };
  // Stage 2 — the RLB high pass (~38 Hz).
  K = Math.tan((Math.PI * 38.13547087602444) / rate);
  const Q2 = 0.5003270373238773;
  a0 = 1 + K / Q2 + K * K;
  const hp = { b: [1, -2, 1], a: [1, (2 * (K * K - 1)) / a0, (1 - K / Q2 + K * K) / a0] };
  return [shelf, hp];
}

function biquad(x: Float64Array, f: { b: number[]; a: number[] }): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const [b0, b1, b2] = f.b, [, a1, a2] = f.a;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/**
 * BS.1770-4 channel weights, and the words for which rule chose them. With an EXTENSIBLE mask the
 * speakers are named: LFE 0, side surrounds 1.41, back surrounds 1.41 only when they ARE the
 * surrounds (5.1 written with the back pair) and 1.0 beyond 120 degrees otherwise. Without one, only
 * the layouts Godot's Movie Maker writes are recognised by count — 3.1 (L R C LFE), 5.1 (L R C LFE
 * Ls Rs) and 7.1 (L R C LFE Lb Rb Ls Rs) — and anything else is weighted 1.0 throughout and says so.
 */
export function channelWeights(channels: number, mask: number | null): { weights: number[]; rule: string } {
  if (mask !== null && mask !== 0) {
    const bits: number[] = [];
    for (let b = 0; b < 32 && bits.length < channels; b++) if (mask & (1 << b)) bits.push(1 << b);
    const hasSides = (mask & 0x600) !== 0;
    const weights = Array.from({ length: channels }, (_, i) => {
      const sp = bits[i];
      if (sp === 0x8) return 0;
      if (sp === 0x200 || sp === 0x400) return 1.41;
      if ((sp === 0x10 || sp === 0x20) && !hasSides) return 1.41;
      return 1;
    });
    return { weights, rule: "from the file's speaker mask" };
  }
  if (channels === 4) return { weights: [1, 1, 1, 0], rule: "3.1 by channel count (LFE 0)" };
  if (channels === 6) return { weights: [1, 1, 1, 0, 1.41, 1.41], rule: "5.1 by channel count (LFE 0, surrounds 1.41)" };
  if (channels === 8) return { weights: [1, 1, 1, 0, 1, 1, 1.41, 1.41], rule: "7.1 by channel count (LFE 0, sides 1.41, backs 1.0)" };
  return { weights: Array(channels).fill(1), rule: channels <= 2 ? "every channel 1.0" : "every channel 1.0 (no known layout for this channel count)" };
}

interface Loudness { integrated: number | null; momentary_max: number | null; short_term_max: number | null }

function loudness(pcm: Pcm, weights: number[]): Loudness {
  const { rate, frames, channels } = pcm;
  // Prefix sums of the weighted, K-filtered square — every window below is then O(1).
  const cum = new Float64Array(frames + 1);
  const kw = kWeighting(rate);
  for (let c = 0; c < channels; c++) {
    const g = weights[c];
    if (g === 0) continue;
    const y = biquad(biquad(Float64Array.from(pcm.data[c]), kw[0]), kw[1]);
    let acc = 0;
    for (let i = 0; i < frames; i++) { acc += g * y[i] * y[i]; cum[i + 1] += acc; }
  }
  const lk = (z: number): number => -0.691 + 10 * Math.log10(z);
  const blocks = (len: number): number[] => {
    const hop = Math.max(1, Math.round(rate * 0.1)), n = Math.max(1, Math.round(rate * len)), out: number[] = [];
    for (let s = 0; s + n <= frames; s += hop) out.push((cum[s + n] - cum[s]) / n);
    return out;
  };
  const m = blocks(0.4), st = blocks(3);
  const maxL = (zs: number[]): number | null => {
    let top = 0;
    for (const z of zs) if (z > top) top = z;
    return top > 0 ? round(lk(top), 2) : null;
  };
  const abs = m.filter((z) => z > 0 && lk(z) > -70);
  let integrated: number | null = null;
  if (abs.length) {
    const rel = lk(abs.reduce((s, z) => s + z, 0) / abs.length) - 10;
    const gated = abs.filter((z) => lk(z) > rel);
    if (gated.length) integrated = round(lk(gated.reduce((s, z) => s + z, 0) / gated.length), 2);
  }
  return { integrated, momentary_max: maxL(m), short_term_max: maxL(st) };
}

// ---- true peak --------------------------------------------------------------------------------

/** 4× polyphase interpolator: Blackman-windowed sinc over ±6 input samples, unity DC per phase. */
const TP_PHASES: number[][] = (() => {
  const out: number[][] = [];
  for (let p = 0; p < 4; p++) {
    const taps: number[] = [];
    for (let k = -5; k <= 6; k++) {
      const t = p / 4 - k;
      const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
      const w = Math.abs(t) >= 6 ? 0 : 0.42 + 0.5 * Math.cos((Math.PI * t) / 6) + 0.08 * Math.cos((2 * Math.PI * t) / 6);
      taps.push(sinc * w);
    }
    const s = taps.reduce((a, b) => a + b, 0);
    out.push(taps.map((v) => v / s));
  }
  return out;
})();

/**
 * Inter-sample peak by 4× oversampling, evaluated only next to samples within 6 dB of the
 * channel's sample peak (an inter-sample over larger than that needs a pathological signal).
 */
function truePeak(x: Float32Array, samplePeak: number): number {
  let tp = samplePeak;
  const floor = samplePeak / 2;
  for (let j = 0; j < x.length; j++) {
    if (Math.abs(x[j]) < floor && Math.abs(x[j + 1] ?? 0) < floor) continue;
    for (let p = 1; p < 4; p++) {
      let v = 0;
      const taps = TP_PHASES[p];
      for (let k = 0; k < 12; k++) {
        const s = j - 5 + k;
        if (s >= 0 && s < x.length) v += x[s] * taps[k];
      }
      if (Math.abs(v) > tp) tp = Math.abs(v);
    }
  }
  return tp;
}

// ---- the analysis -----------------------------------------------------------------------------

/** Octave bands by their nominal labels (IEC 61260); the edges use the exact base-2 centres 1000·2^k. */
export const OCTAVES = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EXACT_CENTRE = (i: number): number => 1000 * 2 ** (i - 5);
/** A float or 16/24/32-bit sample at or beyond this magnitude is at full scale. */
const CLIP_LEVEL = 0.9999;
/** Full scale for this file: an 8-bit file's largest positive code is 127/128, under CLIP_LEVEL. */
const clipLevel = (pcm: Pcm): number => (pcm.float ? CLIP_LEVEL : Math.min(CLIP_LEVEL, (2 ** (pcm.bits - 1) - 1) / 2 ** (pcm.bits - 1)));
const SILENCE = 0.001; // −60 dBFS
const WELCH_N = 8192;

interface ChannelReading { peak_dbfs: number | null; rms_dbfs: number | null; dc_offset: number }
interface Analysis {
  duration_s: number;
  sample_rate: number;
  channels: number;
  bits: number;
  peak_dbfs: number | null;
  true_peak_dbtp: number | null;
  rms_dbfs: number | null;
  loudness_lufs: number | null;
  loudness_momentary_max_lufs: number | null;
  loudness_short_term_max_lufs: number | null;
  loudness_weighting: string;
  clipped_samples: number;
  clipped_runs: number;
  first_clip_s: number | null;
  nonfinite_samples: number;
  onset_s: number | null;
  silent_fraction: number;
  dominant_hz: number | null;
  centroid_hz: number | null;
  bands: Array<{ hz: number; db: number | null }>;
  per_channel: ChannelReading[];
}

/**
 * The averaged one-sided power spectrum, Welch, with every sample of every channel weighted the
 * same. 🔴 334's review measured the first draft, which capped the windows at 400 and skipped the
 * rest: past ~34 s whole stretches went unread, and a 50 ms burst moved its octave by 20 dB
 * depending only on where it fell. Now nothing is skipped, and the hop is n/4 rather than n/2
 * because squared Hann windows at 75% overlap sum to a constant (1.5) while at 50% they swing
 * between 0.5 and 1 — so a short sound reads the same wherever it falls. The sum is normalised by
 * the window energy that fell inside the file, so a sound shorter than one window reads true too.
 * The cost is linear in the file.
 */
function spectrum(pcm: Pcm): { p: Float64Array; binHz: number } {
  const n = Math.min(WELCH_N, 1 << Math.ceil(Math.log2(Math.max(16, pcm.frames))));
  const w = hann(n), p = new Float64Array(n / 2 + 1), re = new Float64Array(n), im = new Float64Array(n);
  const hop = n / 4;
  // Windows stay INSIDE the file: one hanging past an end sees the recording's hard cut, and that
  // cut splatters across every band (measured at 334: +40 dB in a clean tone's 4 kHz octave). The
  // outer 3n/4 samples are tapered by the window as a result; everything between is weighted evenly.
  const starts: number[] = [];
  if (pcm.frames <= n) starts.push(0);
  else {
    for (let s = 0; s + n <= pcm.frames; s += hop) starts.push(s);
    if (starts[starts.length - 1] + n < pcm.frames) starts.push(pcm.frames - n);
  }
  let energy = 0;
  for (const s of starts) for (let c = 0; c < pcm.channels; c++) energy += powerFrame(pcm.data[c], s, w, p, re, im);
  const k = energy > 0 ? 1 / (n * energy) : 0;
  for (let b = 0; b < p.length; b++) p[b] *= k;
  return { p, binHz: pcm.rate / n };
}

export function analyze(pcm: Pcm): Analysis {
  const { rate, frames, channels } = pcm;
  const clipAt = clipLevel(pcm);
  const per_channel: ChannelReading[] = [];
  let peak = 0, tp = 0, msSum = 0, clipped = 0, runs = 0, firstClip = -1, onset = -1;
  for (let c = 0; c < channels; c++) {
    const x = pcm.data[c];
    let pk = 0, ss = 0, sum = 0, run = 0;
    for (let i = 0; i < frames; i++) {
      const v = x[i], a = Math.abs(v);
      if (a > pk) pk = a;
      ss += v * v; sum += v;
      if (a >= clipAt) {
        clipped++; run++;
        if (run === 3) runs++;
        if (firstClip < 0 || i < firstClip) firstClip = i;
      } else run = 0;
      if (a > SILENCE && (onset < 0 || i < onset)) onset = i;
    }
    const ms = frames ? ss / frames : 0;
    msSum += ms;
    peak = Math.max(peak, pk);
    tp = Math.max(tp, pk > 0 ? truePeak(x, pk) : 0);
    per_channel.push({ peak_dbfs: ampDb(pk), rms_dbfs: powDb(ms), dc_offset: round(frames ? sum / frames : 0, 6) });
  }
  // Silent fraction: 100 ms blocks whose loudest channel is under −60 dBFS RMS.
  const blk = Math.max(1, Math.round(rate * 0.1));
  let blocks = 0, silent = 0;
  for (let s = 0; s < frames; s += blk) {
    const e = Math.min(frames, s + blk);
    let loud = 0;
    for (let c = 0; c < channels; c++) {
      let ss = 0;
      for (let i = s; i < e; i++) ss += pcm.data[c][i] ** 2;
      loud = Math.max(loud, ss / (e - s));
    }
    blocks++;
    if (loud < SILENCE * SILENCE) silent++;
  }
  const { p, binHz } = spectrum(pcm);
  const bands = OCTAVES.map((hz, i) => {
    const fc = EXACT_CENTRE(i), lo = fc / Math.SQRT2, hi = Math.min(fc * Math.SQRT2, rate / 2);
    if (lo >= rate / 2) return { hz, db: null };
    let e = 0;
    let bins = 0;
    for (let b = Math.max(1, Math.ceil(lo / binHz)); b * binHz < hi && b < p.length; b++) { e += p[b]; bins++; }
    // A file too short to put one spectrum bin inside this octave cannot say anything about it:
    // null here means "not resolved", which the catalogue states beside "silent".
    return { hz, db: bins ? powDb(e) : null };
  });
  let best = -1, bestP = 0, num = 0, den = 0;
  for (let b = Math.ceil(20 / binHz); b < p.length; b++) {
    num += b * binHz * p[b]; den += p[b];
    if (p[b] > bestP) { bestP = p[b]; best = b; }
  }
  let dominant: number | null = null;
  if (best > 0 && best < p.length - 1 && p[best - 1] > 0 && p[best + 1] > 0) {
    const [l, m, r] = [Math.log(p[best - 1]), Math.log(p[best]), Math.log(p[best + 1])];
    const d = l - 2 * m + r;
    dominant = round((best + (d !== 0 ? (0.5 * (l - r)) / d : 0)) * binHz, 1);
  } else if (best > 0) dominant = round(best * binHz, 1);
  const cw = channelWeights(channels, pcm.mask);
  const L = loudness(pcm, cw.weights);
  return {
    duration_s: round(frames / rate, 4),
    sample_rate: rate,
    channels,
    bits: pcm.bits,
    peak_dbfs: ampDb(peak),
    true_peak_dbtp: ampDb(tp),
    rms_dbfs: powDb(channels ? msSum / channels : 0),
    loudness_lufs: L.integrated,
    loudness_momentary_max_lufs: L.momentary_max,
    loudness_short_term_max_lufs: L.short_term_max,
    loudness_weighting: cw.rule,
    clipped_samples: clipped,
    clipped_runs: runs,
    first_clip_s: firstClip < 0 ? null : round(firstClip / rate, 4),
    nonfinite_samples: pcm.nonfinite,
    onset_s: onset < 0 ? null : round(onset / rate, 4),
    silent_fraction: blocks ? round(silent / blocks, 3) : 1,
    dominant_hz: dominant,
    centroid_hz: den > 0 ? round(num / den, 1) : null,
    bands,
    per_channel,
  };
}

// ---- comparison -------------------------------------------------------------------------------

interface Comparison {
  delta: Record<string, number | null>;
  band_delta_db: Array<{ hz: number; db: number | null }>;
  band_mean_abs_diff_db: number | null;
  notes: string[];
}

const SCALARS = [
  "duration_s", "peak_dbfs", "true_peak_dbtp", "rms_dbfs", "loudness_lufs", "loudness_momentary_max_lufs",
  "loudness_short_term_max_lufs", "clipped_samples", "onset_s", "silent_fraction", "dominant_hz", "centroid_hz",
] as const;

/** B minus A for every scalar and every band; null where either side is silent. */
export function compare(a: Analysis, b: Analysis): Comparison {
  const delta: Record<string, number | null> = {};
  for (const k of SCALARS) {
    const x = a[k], y = b[k];
    delta[k] = x === null || y === null ? null : round(y - x, 4);
  }
  const band_delta_db = a.bands.map((ab, i) => {
    const bb = b.bands[i];
    return { hz: ab.hz, db: ab.db === null || bb?.db == null ? null : round(bb.db - ab.db, 2) };
  });
  // Mean |Δ| over the bands where either side has content above −90 dB (a band both sides
  // leave empty is not a difference, and its noise-floor delta would dominate the mean).
  const live = band_delta_db.filter((d, i) => d.db !== null && Math.max(a.bands[i].db ?? -999, b.bands[i].db ?? -999) > -90);
  const notes: string[] = [];
  if (a.sample_rate !== b.sample_rate) notes.push(`sample rates differ: ${a.sample_rate} vs ${b.sample_rate}`);
  if (a.channels !== b.channels) notes.push(`channel counts differ: ${a.channels} vs ${b.channels}`);
  // 🆕 BP-0063 (336): from Godot 4.6 godot_record's sound is 16-bit by default and 32-bit with
  // keep_frames, so a comparison across the two says so. The truncation moves a loud tone by about
  // 0.001 dB and a quiet one by far more (measured on 4.7.1 by 336's review arm: +0.83 dB at
  // -72 dBFS, +12.04 dB at -102 dBFS).
  if (a.bits !== b.bits) notes.push(`bit depths differ: ${a.bits} vs ${b.bits}`);
  if (Math.abs(a.duration_s - b.duration_s) > 0.05) notes.push(`durations differ by ${round(b.duration_s - a.duration_s, 3)} s`);
  return {
    delta,
    band_delta_db,
    band_mean_abs_diff_db: live.length ? round(live.reduce((s, d) => s + Math.abs(d.db as number), 0) / live.length, 2) : null,
    notes,
  };
}

// ---- the picture ------------------------------------------------------------------------------

/** What the spectrogram's axes mean — sent beside every picture, since the picture has no text. */
export const SPECTROGRAM_LEGEND =
  "Spectrogram: x is time (left to right; faint vertical lines every second, every 10 s past a minute), " +
  "y is frequency on a log scale from 20 Hz (bottom) to 20 kHz or Nyquist (top; faint lines at 100 Hz, 1 kHz, 10 kHz), " +
  "colour is level from -100 dBFS (black) through purple and orange to 0 dBFS (pale yellow). " +
  "A red strip along the top marks time where samples hit full scale.";

const INFERNO: Array<[number, number, number, number]> = [
  [0, 0, 0, 4], [0.15, 31, 12, 72], [0.3, 85, 15, 109], [0.45, 136, 34, 106],
  [0.6, 186, 54, 85], [0.75, 227, 89, 51], [0.87, 249, 140, 10], [1, 252, 255, 164],
];
function colour(t: number): [number, number, number] {
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < INFERNO.length; i++) {
    const [t1, r1, g1, b1] = INFERNO[i];
    if (t <= t1) {
      const [t0, r0, g0, b0] = INFERNO[i - 1];
      const u = (t - t0) / (t1 - t0);
      return [r0 + (r1 - r0) * u, g0 + (g1 - g0) * u, b0 + (b1 - b0) * u];
    }
  }
  return [252, 255, 164];
}

export interface Raster { width: number; height: number; rgb: Uint8Array }

const STRIP = 6;
/** A log-frequency spectrogram, `width`×(`height`+6) RGB, the top 6 rows the clipping strip. */
export function spectrogram(pcm: Pcm, width = 800, height = 200): Raster {
  const n = 2048, w = hann(n), half = n / 2;
  const cols = Math.max(1, Math.min(width, Math.floor(pcm.frames / 256)));
  const H = height + STRIP;
  const rgb = new Uint8Array(cols * H * 3);
  const nyq = pcm.rate / 2, fTop = Math.min(20000, nyq), fBot = 20;
  const rowHz = (r: number): number => fBot * (fTop / fBot) ** (r / height);
  const col = new Float64Array(half + 1), re = new Float64Array(n), im = new Float64Array(n);
  for (let x = 0; x < cols; x++) {
    col.fill(0);
    const centre = Math.round(((x + 0.5) / cols) * pcm.frames);
    let energy = 0;
    for (let c = 0; c < pcm.channels; c++) energy += powerFrame(pcm.data[c], centre - half, w, col, re, im);
    if (energy > 0) for (let b = 0; b <= half; b++) col[b] *= pcm.channels / (n * energy);
    // the clipping strip: any full-scale sample inside this column's span
    const s0 = Math.floor((x / cols) * pcm.frames), s1 = Math.floor(((x + 1) / cols) * pcm.frames);
    let clip = false;
    for (let c = 0; c < pcm.channels && !clip; c++) for (let i = s0; i < s1; i++) if (Math.abs(pcm.data[c][i]) >= clipLevel(pcm)) { clip = true; break; }
    for (let r = 0; r < STRIP; r++) {
      const o = (r * cols + x) * 3;
      rgb[o] = clip ? 230 : 24; rgb[o + 1] = clip ? 30 : 24; rgb[o + 2] = clip ? 30 : 24;
    }
    for (let r = 0; r < height; r++) {
      const lo = rowHz(r) / (pcm.rate / n), hi = rowHz(r + 1) / (pcm.rate / n);
      let e = 0;
      const b0 = Math.max(1, Math.floor(lo)), b1 = Math.min(half - 1, Math.max(b0, Math.ceil(hi) - 1));
      for (let b = b0; b <= b1; b++) e = Math.max(e, col[b] / pcm.channels);
      const db = e > 0 ? 10 * Math.log10(e) : -200;
      const [cr, cg, cb] = colour((db + 100) / 100);
      const o = ((H - 1 - r) * cols + x) * 3;
      rgb[o] = cr; rgb[o + 1] = cg; rgb[o + 2] = cb;
    }
  }
  // gridlines: blend 35% white
  const blend = (x: number, y: number): void => {
    const o = (y * cols + x) * 3;
    for (let k = 0; k < 3; k++) rgb[o + k] = Math.round(rgb[o + k] * 0.65 + 255 * 0.35);
  };
  for (const hz of [100, 1000, 10000]) {
    if (hz >= fTop) continue;
    const r = Math.round((Math.log(hz / fBot) / Math.log(fTop / fBot)) * height);
    for (let x = 0; x < cols; x++) blend(x, H - 1 - Math.min(height - 1, r));
  }
  const dur = pcm.frames / pcm.rate, every = dur > 60 ? 10 : 1;
  for (let t = every; t < dur; t += every) {
    const x = Math.round((t / dur) * cols);
    for (let y = STRIP; y < H; y++) if (x < cols) blend(x, y);
  }
  return { width: cols, height: H, rgb };
}

/** Two rasters one above the other with a grey rule between, padded to the wider. */
export function stack(a: Raster, b: Raster): Raster {
  const width = Math.max(a.width, b.width), gap = 4, height = a.height + gap + b.height;
  const rgb = new Uint8Array(width * height * 3);
  const put = (src: Raster, y0: number): void => {
    for (let y = 0; y < src.height; y++) rgb.set(src.rgb.subarray(y * src.width * 3, (y + 1) * src.width * 3), ((y0 + y) * width) * 3);
  };
  put(a, 0);
  rgb.fill(128, a.height * width * 3, (a.height + gap) * width * 3);
  put(b, a.height + gap);
  return { width, height, rgb };
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** An 8-bit RGB PNG (filter 0 on every row). Node ≥18 has no zlib.crc32, hence the table above. */
export function encodePng(r: Raster): Buffer {
  const chunk = (type: string, body: Buffer): Buffer => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type, "ascii"), body]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tb));
    return Buffer.concat([len, tb, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(r.width, 0); ihdr.writeUInt32BE(r.height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((r.width * 3 + 1) * r.height);
  for (let y = 0; y < r.height; y++) {
    raw[y * (r.width * 3 + 1)] = 0;
    Buffer.from(r.rgb.buffer, r.rgb.byteOffset + y * r.width * 3, r.width * 3).copy(raw, y * (r.width * 3 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

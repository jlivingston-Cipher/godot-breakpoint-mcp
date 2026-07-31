// _png.mjs — a minimal, dependency-free PNG reader for the live probes.
//
// WHY THIS EXISTS. Both pixel-producing tools return a base64 PNG, and until now
// every assertion about those frames was made against the tool's own LABEL — the
// "(WxH)" note, the mimeType, the first four magic bytes. None of them open the
// payload. That leaves the editor half of the render coverage with the same hole
// #141 built res://tests/render_probe.tscn to close on the runtime half: a frame
// that is entirely one colour satisfies every one of those checks. An all-black
// viewport — a rasterizer that initialised and then drew nothing — is exactly the
// failure the render planes exist to catch, and it would have passed.
//
// Deliberately NOT a general PNG library. It handles what Godot's
// Image.save_png_to_buffer() actually emits (8 bits per channel, non-interlaced)
// and returns null for anything else, so a caller can degrade rather than throw.
// Decoding a 1417x872 RGBA frame costs ~130ms, which is noise next to the ~120s
// software-rendered editor boot it runs behind.

import zlib from "node:zlib";

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 }; // grey, rgb, grey+a, rgba

/** Paeth predictor (PNG filter type 4). */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Decode an 8-bit non-interlaced PNG.
 * @returns {{width:number,height:number,channels:number,pixels:Buffer}|null}
 */
export function decodePng(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return null;
  if (!(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)) return null;

  let p = 8, width = 0, height = 0, depth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || !width || !height) return null;
  const channels = CHANNELS[colorType];
  if (!channels || !idat.length) return null;

  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idat)); } catch { return null; }
  const stride = width * channels;
  if (raw.length < height * (stride + 1)) return null;

  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart];
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      let v = raw[rowStart + 1 + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      pixels[y * stride + x] = v & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

/**
 * Count distinct RGB values over a strided sample of the frame.
 *
 * Returns 1 for a uniform frame — black, white, or any single fill — which is the
 * only result this is really here to distinguish. `step` samples rather than reads
 * every pixel: a rasterizer that drew nothing is uniform EVERYWHERE, so a sparse
 * grid separates "drew nothing" from "drew something" just as decisively as a full
 * scan, and a grid step coprime with common viewport widths avoids aliasing onto a
 * repeating column pattern.
 *
 * @returns {{distinct:number, sampled:number}|null}
 */
export function sampleDistinctColours(img, step = 7) {
  if (!img) return null;
  const { width, height, channels, pixels } = img;
  const seen = new Set();
  let sampled = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * channels;
      const r = pixels[i];
      const g = channels >= 3 ? pixels[i + 1] : r;
      const b = channels >= 3 ? pixels[i + 2] : r;
      seen.add((r << 16) | (g << 8) | b);
      sampled++;
    }
  }
  return { distinct: seen.size, sampled };
}

// 🆕 BP-0026 (334) — THE HEARING PLANE: two tools that turn a game's sound into numbers and a
// picture, because an assistant cannot listen.
//
//   godot_record   runs the project (or one scene) under Godot's Movie Maker for a fixed number of
//                  frames. Movie Maker advances frames and mixes audio in exact lockstep at a fixed
//                  rate, never in real time, so a recording is the same on a fast or a slow machine
//                  and two recordings of the same scene compare sample for sample. (Part E of
//                  BP-0037, priced apart at 327 and built here.)
//   audio_analyze  measures any WAV inside the project, or compares two.
//
// 🔴 MEASURED AT 327 AND AGAIN AT 334, AND THE REASON THIS TOOL OPENS A WINDOW: `--headless
// --write-movie` crashes 4.7 (SIGSEGV after `texture_2d_get` returns null in the dummy renderer;
// ci327/moviemaker_headless_crash.log). Movie Maker needs a real renderer, so the run is windowed.
// A GDScript MovieWriter cannot be registered in time either (main.cpp picks the writer before
// autoloads), and AudioServer binds no method that reads the master output from script, so the
// engine's own movie writers are the one clean source of a running game's mixed sound.
//
// 334 measured the fixture (example/tests/hearing_probe.tscn, a 1 kHz sine at 0.25) on 4.7: 120
// frames at 60 fps -> a 32-bit stereo 48 kHz WAV of exactly 96000 frames, peak -12.041 dBFS, RMS
// -15.052 dBFS, sound from sample 67, in 4.5 s of wall time.
//
// 🆕 BP-0063 (336) — AND BY DEFAULT IT NO LONGER WRITES A PICTURE FOR EVERY FRAME. The PNG writer
// saves one full-size image per frame to keep only the WAV beside them. Measured at 336 on an M2
// (4.7.1, 1152x648): 120 s of the fixture took 151.8 s and 7,202 files; five seconds of a frame no
// codec compresses took 34.7 s and 725 MB in 302 files. Movie Maker's other writer, the MJPEG AVI
// (chosen by the `.avi` extension), interleaves the same mix as one sound chunk per frame; the
// host reads only those chunks and deletes the movie: 60.7 s, and 4.45 s / 131 MB, one file each.
// The sound is the engine's: on 4.2.2, 4.3 and 4.5 the AVI carries the 32-bit mix the PNG route
// saves (4.3: byte for byte), and 4.7.1 carries that mix shifted right by 16 (16-bit, 960,000 of
// 960,000 samples equal). So the default route is the AVI, and `keep_frames` — the caller who
// wants the pictures — takes the PNG route, whose WAV is 32-bit on every version. Shrinking the
// window would also have been quicker, and was refused: a 2D sound's pan follows its position in
// the viewport, so it would change the sound being measured.
//
// Era-neutral (card §4, until 2.0): ordinary tools — no confirmation, no task, no subscription.

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { failPath } from "./lsp-common.js";
import { resolveInsideProject, resolveExistingFile } from "../paths.js";
import { spawnGuarded } from "../spawn-guard.js";
import {
  parseWav, analyze, compare, spectrogram, stack, encodePng, demuxAviSound, WavError, AviError, SPECTROGRAM_LEGEND,
  type Pcm, type Raster, type AviSound,
} from "../hearing.js";

/** Where recordings go, project-relative: under `.godot/`, which Godot's own .gitignore keeps out of VCS. */
const RECORDINGS_DIR = ".godot/breakpoint/recordings";
const MAX_RECORD_SECONDS = 120;
/** A WAV larger than this is refused rather than read into memory (120 s of 8-channel 32-bit is ~184 MB). */
const MAX_WAV_BYTES = 256 * 1024 * 1024;

const refuse = (text: string) => ({ isError: true as const, content: [{ type: "text" as const, text }] });

export function readPcm(abs: string): Pcm {
  const size = fs.statSync(abs).size;
  if (size > MAX_WAV_BYTES) throw new WavError(`it is ${Math.round(size / 1048576)} MB, over the ${MAX_WAV_BYTES / 1048576} MB this tool reads`);
  return parseWav(fs.readFileSync(abs));
}

/** The sound of a Movie Maker AVI, read a chunk at a time from disk (a long movie is gigabytes of pictures). */
function readAviSound(abs: string): AviSound {
  const fd = fs.openSync(abs, "r");
  try {
    const size = fs.fstatSync(fd).size;
    return demuxAviSound((pos, len) => {
      const b = Buffer.alloc(len);
      const n = fs.readSync(fd, b, 0, len, pos);
      return n < len ? b.subarray(0, n) : b;
    }, size);
  } finally {
    fs.closeSync(fd);
  }
}

/** Numbers as structured content and text, the picture as an image block, the legend beside it. */
function reply(structured: Record<string, unknown>, picture: Raster) {
  return {
    content: [
      { type: "text" as const, text: `${JSON.stringify(structured, null, 2)}\n\n${SPECTROGRAM_LEGEND}` },
      { type: "image" as const, data: encodePng(picture).toString("base64"), mimeType: "image/png" },
    ],
    structuredContent: structured,
  };
}

/** Measure `pcm`; with `before`, compare (after minus before) and stack the pictures, before on top. */
function measure(pcm: Pcm, before: Pcm | null) {
  const analysis = analyze(pcm);
  if (!before) return { analysis, comparison: null, picture: spectrogram(pcm) };
  return { analysis, comparison: compare(analyze(before), analysis), picture: stack(spectrogram(before), spectrogram(pcm)) };
}

interface Run { code: number | null; timedOut: boolean; log: string; spawnFailed: string | null }

const LOG_TAIL_BYTES = 64 * 1024;
const KILL_GRACE_MS = 5000;

/**
 * Run Godot to completion under a deadline of our own. 🔴 334's review: the first draft used
 * execFile's `timeout`, which sends one SIGTERM to one process — a Godot stuck in a GPU driver never
 * answered, the promise never settled and the tool never returned — and buffered all output, so a
 * chatty game hit maxBuffer and was reported as an ordinary exit. Now: the child leads its own
 * process group; at the deadline the GROUP gets SIGTERM, then SIGKILL after a grace period; the
 * timeout is our flag, not inferred from a signal; and only the last 64 KB of output is kept.
 */
async function runGodot(cfg: Config, args: string[], timeoutMs: number): Promise<Run> {
  const started = await spawnGuarded(cfg.godotBin, args, { cwd: cfg.projectPath, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  if (!started.ok) return { code: null, timedOut: false, log: "", spawnFailed: started.message };
  const child = started.child;
  return new Promise((resolve) => {
    let log = "", timedOut = false, settled = false;
    const keep = (d: Buffer): void => { log = (log + d.toString("utf8")).slice(-LOG_TAIL_BYTES); };
    const group = (sig: NodeJS.Signals): void => {
      try { if (child.pid) process.kill(-child.pid, sig); } catch { try { child.kill(sig); } catch { /* already gone */ } }
    };
    let killTimer: NodeJS.Timeout | undefined;
    const deadline = setTimeout(() => { timedOut = true; group("SIGTERM"); killTimer = setTimeout(() => group("SIGKILL"), KILL_GRACE_MS); }, timeoutMs);
    const done = (r: Run): void => {
      if (settled) return;
      settled = true; clearTimeout(deadline); if (killTimer) clearTimeout(killTimer); resolve(r);
    };
    child.stdout?.on("data", keep);
    child.stderr?.on("data", keep);
    child.on("error", (err) => done({ code: null, timedOut, log: `${log}\n${String(err)}`, spawnFailed: null }));
    child.on("close", (code) => done({ code, timedOut, log: log.trim(), spawnFailed: null }));
  });
}

/** A float WAV header (format 3) for interleaved samples of `bits` bits. */
function floatWav(samples: Buffer, rate: number, channels: number, bits: number): Buffer {
  const h = Buffer.alloc(44), align = channels * (bits / 8);
  h.write("RIFF", 0, "latin1"); h.writeUInt32LE(36 + samples.length, 4); h.write("WAVE", 8, "latin1");
  h.write("fmt ", 12, "latin1"); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * align, 28); h.writeUInt16LE(align, 32); h.writeUInt16LE(bits, 34);
  h.write("data", 36, "latin1"); h.writeUInt32LE(samples.length, 40);
  return Buffer.concat([h, samples]);
}

/** What the running game sent back for `runtime.audio_capture` (addon 1.23.0, BP-0059). */
export interface CapturedSound {
  rate: number;
  channels: number;
  frames: number;
  /** 4, or 8 from a double-precision build: `PackedVector2Array.to_byte_array()` is raw `real_t`. */
  sample_bytes: number;
  base64: string;
}

/**
 * 🆕 BP-0059 (336) — `runtime_audio_capture`'s second half: the floats a running game sent back,
 * written as a WAV beside `godot_record`'s recordings (a `-live-` folder) and measured the same
 * way, so a capture and a recording compare with `compare_to` in either direction. A reply whose
 * byte count does not match the frames it claims is refused rather than measured short.
 */
export function measureCapture(
  cfg: Config, sound: CapturedSound, before: Pcm | null, compareTo: string | null,
  fields: Record<string, unknown>, notes: string[],
) {
  const samples = Buffer.from(sound.base64, "base64");
  const want = sound.frames * sound.channels * sound.sample_bytes;
  if ((sound.sample_bytes !== 4 && sound.sample_bytes !== 8) || sound.channels < 1 || sound.frames < 1 || samples.length !== want) {
    return refuse(
      `runtime_audio_capture: the game sent ${samples.length} bytes for ${sound.frames} frames of ${sound.channels} channels at ` +
      `${sound.sample_bytes} bytes a sample. Re-run \`breakpoint-mcp init --force\` so the game's addon matches this host, then capture again.`,
    );
  }
  const base = path.join(cfg.projectPath, RECORDINGS_DIR);
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, `${new Date().toISOString().replace(/[:.]/g, "-")}-live-`));
  const wavAbs = path.join(dir, "sound.wav");
  fs.writeFileSync(wavAbs, floatWav(samples, sound.rate, sound.channels, sound.sample_bytes * 8));
  try {
    const m = measure(readPcm(wavAbs), before);
    return reply({
      wav: `res://${RECORDINGS_DIR}/${path.basename(dir)}/sound.wav`,
      ...fields,
      analysis: m.analysis,
      compare_to: compareTo,
      comparison: m.comparison,
      notes,
    }, m.picture);
  } catch (err) {
    if (err instanceof WavError) {
      // compare_to was read before the game was asked, so this is the capture itself (a mix rate
      // under 8 kHz, say); nothing worth keeping was written.
      fs.rmSync(dir, { recursive: true, force: true });
      return refuse(`runtime_audio_capture: the game's capture could not be measured (${err.message}). Run the game at Godot's default mix rate, then capture again.`);
    }
    throw err;
  }
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000;
const tailLines = (s: string, n = 12): string => s.split("\n").filter((l) => l.trim()).slice(-n).join("\n");

export function registerHearingTools(server: McpServer, cfg: Config): void {
  server.registerTool(
    "godot_record",
    {
      title: "Record and measure the game's sound",
      description:
        "Run the project (or one scene) under Godot's Movie Maker: frames and sound advance in exact lockstep at a fixed " +
        "frame rate, so a recording does not depend on the machine's speed. Then measure the sound — loudness (LUFS), " +
        "sample and true peak, clipping, octave bands — and return a spectrogram picture. Opens a game window for the run. " +
        "The WAV stays in the project for audio_analyze.",
      inputSchema: {
        scene: z.string().optional().describe("Scene to record, e.g. res://levels/boss.tscn (default: the main scene)"),
        seconds: z.number().positive().max(MAX_RECORD_SECONDS).optional().describe("Length of game time to record (default 5)"),
        fps: z.number().int().min(1).max(240).optional().describe("Fixed frame rate (default 60)"),
        keep_frames: z.boolean().optional().describe("Keep PNG frames; WAV then 32-bit (default false)"),
        compare_to: z.string().optional().describe("An earlier WAV to compare this recording against"),
        user_args: z.array(z.string()).optional().describe("Arguments passed to the game after --"),
      },
    },
    async ({ scene, seconds, fps, keep_frames, compare_to, user_args }) => {
      let beforeAbs: string | null = null;
      // A scene is a path, and it reaches Godot's argv: one spelled like an option would be read as one.
      if (scene?.startsWith("-")) return refuse(`godot_record: scene ${JSON.stringify(scene)} reads as a command-line option. Pass a res:// path to a scene.`);
      try {
        if (scene !== undefined) resolveInsideProject(scene, cfg.projectPath, "scene");
        if (compare_to !== undefined) beforeAbs = resolveExistingFile(compare_to, cfg.projectPath, "compare_to");
      } catch (err) {
        return failPath(err);
      }
      const rate = fps ?? 60, secs = seconds ?? 5, frames = Math.max(1, Math.round(secs * rate));
      // The time names the folder for a reader; mkdtemp's suffix keeps two recordings in one millisecond apart.
      const base = path.join(cfg.projectPath, RECORDINGS_DIR);
      fs.mkdirSync(base, { recursive: true });
      const dir = fs.mkdtempSync(path.join(base, `${new Date().toISOString().replace(/[:.]/g, "-")}-`));
      const rel = `${RECORDINGS_DIR}/${path.basename(dir)}`;
      // BP-0063: the AVI unless the caller wants the pictures. Movie Maker picks its writer by extension.
      const viaFrames = keep_frames === true;
      const movie = path.join(dir, viaFrames ? "frame.png" : "movie.avi");
      const args = ["--path", cfg.projectPath, "--write-movie", movie, "--fixed-fps", String(rate), "--quit-after", String(frames)];
      if (scene) args.push(scene);
      if (user_args?.length) args.push("--", ...user_args);
      const run = await runGodot(cfg, args, 60_000 + secs * 20_000);
      const drop = (): void => fs.rmSync(dir, { recursive: true, force: true });
      if (run.spawnFailed) { drop(); return refuse(run.spawnFailed); }
      const movieWav = path.join(dir, "frame.wav"), wavAbs = path.join(dir, "sound.wav");
      const wroteNoSound = (why = ""): ReturnType<typeof refuse> => {
        drop();
        return refuse(
          `godot_record: Godot wrote no sound${why} (exit code ${run.code}${run.timedOut ? ", stopped at the time limit" : ""}). ` +
          `Run the same scene with godot_run_managed and read godot_output for the error it prints, then record again.` +
          (run.log ? `\nLast lines Godot printed:\n${tailLines(run.log)}` : ""),
        );
      };
      let written = 0, cutShort = false;
      if (viaFrames) {
        written = fs.readdirSync(dir).filter((n) => /^frame\d+\.png$/.test(n)).length;
        if (!fs.existsSync(movieWav)) return wroteNoSound();
        fs.renameSync(movieWav, wavAbs);
      } else {
        if (!fs.existsSync(movie)) return wroteNoSound();
        let s: AviSound;
        try {
          s = readAviSound(movie);
        } catch (err) {
          if (err instanceof AviError) return wroteNoSound(` that could be read (the movie: ${err.message})`);
          throw err;
        } finally {
          fs.rmSync(movie, { force: true });
        }
        fs.writeFileSync(wavAbs, s.wav);
        written = s.videoFrames;
        cutShort = s.truncated;
      }
      try {
        const before = beforeAbs ? readPcm(beforeAbs) : null;
        const m = measure(readPcm(wavAbs), before);
        // A recording that stopped early must not read as a short success (334's review).
        const notes: string[] = [];
        const expected = frames / rate, got = m.analysis.duration_s;
        if (run.timedOut) notes.push(`stopped at the time limit: the WAV holds ${got} s of the ${round3(expected)} s asked for`);
        else if (got < expected - 1 / rate - 0.01) notes.push(`the WAV holds ${got} s of the ${round3(expected)} s asked for: Godot stopped early (exit code ${run.code})`);
        if (run.code !== 0 && !run.timedOut) notes.push(`Godot exited with code ${run.code}`);
        if (cutShort) notes.push("the movie ended inside a chunk: the sound is read up to its last whole sample");
        return reply({
          wav: `res://${rel}/sound.wav`,
          frames_dir: keep_frames ? `res://${rel}` : null,
          frames: written,
          fps: rate,
          exit_code: run.code,
          timed_out: run.timedOut,
          analysis: m.analysis,
          compare_to: compare_to ?? null,
          comparison: m.comparison,
          notes,
        }, m.picture);
      } catch (err) {
        if (err instanceof WavError) {
          return refuse(`godot_record: a WAV could not be read (${err.message}). Pass compare_to a PCM or float WAV, such as an earlier recording's sound.wav.`);
        }
        throw err;
      }
    },
  );

  server.registerTool(
    "audio_analyze",
    {
      title: "Measure a WAV (or compare two)",
      description:
        "Measure a WAV file in the project: loudness (LUFS), sample and true peak, clipping, octave bands, and a " +
        "spectrogram picture. With compare_to, also report this file minus that one, metric by metric and band by band.",
      inputSchema: {
        path: z.string().describe("WAV file, e.g. a sound.wav that godot_record wrote"),
        compare_to: z.string().optional().describe("A second WAV, the 'before' of the comparison"),
      },
    },
    async ({ path: p, compare_to }) => {
      let abs: string, beforeAbs: string | null = null;
      try {
        abs = resolveExistingFile(p, cfg.projectPath, "path");
        if (compare_to !== undefined) beforeAbs = resolveExistingFile(compare_to, cfg.projectPath, "compare_to");
      } catch (err) {
        return failPath(err);
      }
      try {
        const m = measure(readPcm(abs), beforeAbs ? readPcm(beforeAbs) : null);
        return reply({ path: p, analysis: m.analysis, compare_to: compare_to ?? null, comparison: m.comparison }, m.picture);
      } catch (err) {
        if (err instanceof WavError) {
          return refuse(`audio_analyze: a file could not be read as a WAV (${err.message}). Pass a PCM or float WAV, such as the sound.wav godot_record writes.`);
        }
        throw err;
      }
    },
  );
}

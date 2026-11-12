// 🆕 BP-0062 (1.95.0) — THE HEARING PLANE'S MEASUREMENT, OFF THE SERVER'S ONE THREAD. Reading a WAV
// and measuring it is linear in the file: 334's review timed 7.7 s for two minutes of eight channels
// on the first draft, and the server answers every tool call on one thread, so every other call
// waited behind it. Now a measurement is a job run on a worker thread of its own, and the server's
// thread is free while it runs. A job names files, not samples: the worker reads them itself, so
// nothing large crosses between the threads except the picture coming back. One job, one thread:
// it ends when it has answered, and nothing is shared between two jobs. 🔴 341's review arm: one
// thread per call with no limit ran every measurement at once (four 176 MB files peaked at 1.44 GB,
// outside any heap limit), where in-thread they ran one after another. So jobs queue: one runs at a
// time, as before, only no longer on the server's thread.

import fs from "node:fs";
import { Worker } from "node:worker_threads";
import { parseWav, analyze, compare, spectrogram, stack, encodePng, WavError, type Pcm, type Analysis, type Comparison } from "./hearing.js";

/** A WAV larger than this is refused rather than read into memory (120 s of 8-channel 32-bit is ~184 MB). */
const MAX_WAV_BYTES = 256 * 1024 * 1024;

function readPcm(abs: string): Pcm {
  const size = fs.statSync(abs).size;
  if (size > MAX_WAV_BYTES) throw new WavError(`it is ${Math.round(size / 1048576)} MB, over the ${MAX_WAV_BYTES / 1048576} MB this tool reads`);
  return parseWav(fs.readFileSync(abs));
}

/** `check` reads and parses one WAV; `measure` measures `path` and, with `before`, compares (after minus before). */
export type MeasureJob = { op: "check"; path: string } | { op: "measure"; path: string; before: string | null };
type MeasureResult =
  | { ok: true; op: "check" }
  | { ok: true; op: "measure"; analysis: Analysis; comparison: Comparison | null; png: Uint8Array }
  | { ok: false; wav: boolean; message: string; file: "path" | "before" };

/** One job, on whichever thread calls it. The worker calls it; so does the test that holds the two equal. */
export function runJob(job: MeasureJob): MeasureResult {
  // Which file a failure was reading (341's review arm): a compare_to that changed after it was
  // checked must not be reported as, and cost, the new recording.
  let file: "path" | "before" = "path";
  try {
    if (job.op === "check") {
      readPcm(job.path);
      return { ok: true, op: "check" };
    }
    const pcm = readPcm(job.path);
    file = "before";
    const before = job.before === null ? null : readPcm(job.before);
    file = "path";
    const analysis = analyze(pcm);
    // With a before, the pictures stack before on top.
    if (!before) return { ok: true, op: "measure", analysis, comparison: null, png: encodePng(spectrogram(pcm)) };
    return { ok: true, op: "measure", analysis, comparison: compare(analyze(before), analysis), png: encodePng(stack(spectrogram(before), spectrogram(pcm))) };
  } catch (err) {
    return { ok: false, wav: err instanceof WavError, message: err instanceof Error ? err.message : String(err), file };
  }
}

let queue: Promise<unknown> = Promise.resolve();

/** Run one job on a thread of its own, after any job already queued, and wait for its answer. */
export function offThread(job: MeasureJob): Promise<MeasureResult> {
  const run = queue.then(() => spawnJob(job));
  queue = run;
  return run;
}

/** One job, one thread; a thread that dies without an answer is an answer too (it never rejects). */
function spawnJob(job: MeasureJob): Promise<MeasureResult> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: MeasureResult): void => {
      if (!settled) { settled = true; resolve(r); }
    };
    const w = new Worker(new URL("./measure-worker.js", import.meta.url), { workerData: job });
    w.once("message", (r: MeasureResult) => done(r));
    w.once("error", (err: Error) => done({ ok: false, wav: false, message: `the measuring thread failed: ${err.message}`, file: "path" }));
    w.once("exit", (code: number) => done({ ok: false, wav: false, message: `the measuring thread exited (code ${code}) without an answer`, file: "path" }));
  });
}

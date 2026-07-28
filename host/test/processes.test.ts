import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { ProcessRegistry, registerProcessTools } from "../src/tools/processes.js";
import { makeRecordingServer, type ToolResultLike } from "./helpers/recording-server.js";
import type { Config } from "../src/config.js";

/**
 * Behavior tests for the managed-process plane (tools/processes.ts). This is
 * pure host logic — a captured child process and an in-memory ring buffer — so
 * no Godot is needed. A tiny POSIX fixture stands in for the Godot binary and
 * emits deterministic stdout/stderr; the injected `--path <project>` args are
 * ignored, and the first extra arg selects how many stdout lines to print.
 */

const POSIX = process.platform !== "win32";

let dir: string;
let fakeGodot: string;
/** A runtime-bridge port that nothing holds, so the no-conflict path is the default. */
let freeRuntimePort: number;

/**
 * Bind loopback on an ephemeral port and keep holding it — this stands in for
 * "the developer's own game is already running", which is the only way the
 * runtime bridge port is ever occupied in the wild. Taking the port the kernel
 * hands out, rather than guessing a number, means the conflict is a fact of the
 * test rather than an assumption about the machine running it.
 */
function squat(): Promise<{ srv: net.Server; port: number }> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => resolve({ srv, port: (srv.address() as net.AddressInfo).port }));
  });
}

async function freePort(): Promise<number> {
  const { srv, port } = await squat();
  await new Promise<void>((r) => srv.close(() => r()));
  return port;
}

before(async () => {
  if (!POSIX) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gcb-proc-"));
  fakeGodot = path.join(dir, "fakegodot.sh");
  // argv is: --path <projectPath> [count].  Emit <count> stdout lines
  // (default 3) then one stderr line, then exit 0.
  fs.writeFileSync(
    fakeGodot,
    [
      "#!/bin/sh",
      'count="${3:-3}"',
      "i=1",
      'while [ "$i" -le "$count" ]; do echo "out$i"; i=$((i+1)); done',
      'echo "boom" 1>&2',
      "exit 0",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  freeRuntimePort = await freePort();
});

after(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

function cfg(runtimePort?: number): Config {
  return {
    godotBin: fakeGodot,
    projectPath: dir,
    runtimeHost: "127.0.0.1",
    runtimePort: runtimePort ?? freeRuntimePort,
  } as unknown as Config;
}

async function waitFor(cond: () => boolean | undefined, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting for the child to exit");
    await delay(10);
  }
  // Let any trailing stdout/stderr 'data' events flush after 'exit'.
  await delay(30);
}

const sc = (r: ToolResultLike) => r.structuredContent as Record<string, unknown>;

test("ProcessRegistry captures stdout and stderr separately and records the exit code", { skip: !POSIX }, async () => {
  const reg = new ProcessRegistry();
  const m = reg.run(cfg(), ["3"]);
  await waitFor(() => m.exited);

  const outs = m.lines.filter((l) => l.stream === "stdout").map((l) => l.text);
  const errs = m.lines.filter((l) => l.stream === "stderr").map((l) => l.text);
  assert.deepEqual(outs, ["out1", "out2", "out3"]);
  assert.deepEqual(errs, ["boom"]);
  assert.equal(m.lines.length, 4);
  assert.equal(m.exitCode, 0);
  // seq values are unique.
  assert.equal(new Set(m.lines.map((l) => l.seq)).size, 4);
  reg.killAll();
});

test("the capture ring buffer caps at 5000 lines, dropping the oldest", { skip: !POSIX }, async () => {
  const reg = new ProcessRegistry();
  const m = reg.run(cfg(), ["5100"]); // 5100 stdout + 1 stderr = 5101 emitted
  await waitFor(() => m.exited, 20000);

  assert.equal(m.lines.length, 5000, "ring buffer must cap at LINE_CAP");
  assert.ok(!m.lines.some((l) => l.text === "out1"), "the oldest lines should be dropped");
  assert.ok(m.lines.some((l) => l.text === "out5100"), "the newest stdout line should be retained");
  assert.ok(m.lines.some((l) => l.text === "boom"), "the final stderr line should be retained");
  reg.killAll();
});

test("godot_output filters by since_seq and by stream", { skip: !POSIX }, async () => {
  const rec = makeRecordingServer();
  const reg = registerProcessTools(rec.server as unknown as Parameters<typeof registerProcessTools>[0], cfg());

  const run = await rec.handler("godot_run_managed")({});
  const id = sc(run).id as string;
  assert.equal(typeof id, "string");
  await waitFor(() => reg.get(id)?.exited);

  const all = sc(await rec.handler("godot_output")({ id }));
  assert.equal(all.exited, true);
  assert.equal(all.exit_code, 0);
  assert.equal((all.lines as unknown[]).length, 4); // 3 stdout + 1 stderr (default count 3)

  const outOnly = sc(await rec.handler("godot_output")({ id, stream: "stdout" }));
  const outLines = outOnly.lines as Array<{ stream: string }>;
  assert.equal(outLines.length, 3);
  assert.ok(outLines.every((l) => l.stream === "stdout"));

  const since = sc(await rec.handler("godot_output")({ id, since_seq: 2 }));
  const sinceLines = since.lines as Array<{ seq: number }>;
  assert.ok(sinceLines.length > 0 && sinceLines.every((l) => l.seq > 2));

  reg.killAll();
});

test("godot_output and godot_stop return a friendly error for an unknown process id", { skip: !POSIX }, async () => {
  const rec = makeRecordingServer();
  registerProcessTools(rec.server as unknown as Parameters<typeof registerProcessTools>[0], cfg());

  const out = await rec.handler("godot_output")({ id: "does-not-exist" });
  assert.equal(out.isError, true);
  assert.match(out.content?.[0]?.text ?? "", /No managed process/);

  const stop = await rec.handler("godot_stop")({ id: "does-not-exist" });
  assert.equal(stop.isError, true);
  assert.match(stop.content?.[0]?.text ?? "", /No managed process/);
});

test("godot_stop terminates a managed process", { skip: !POSIX }, async () => {
  const rec = makeRecordingServer();
  const reg = registerProcessTools(rec.server as unknown as Parameters<typeof registerProcessTools>[0], cfg());
  const run = await rec.handler("godot_run_managed")({});
  const id = sc(run).id as string;

  const stop = sc(await rec.handler("godot_stop")({ id }));
  assert.equal(stop.stopped, true);
  assert.equal(stop.id, id);
  reg.killAll();
});

/**
 * Port-collision on the DEFAULT runtime port — the one case the peer allocator is
 * already immune to and the managed/detached run paths were not.
 *
 * The failure this prevents is not "the port is busy". It is that the child
 * starts fine, its autoload's `listen()` returns non-OK and it `push_error`s but
 * keeps running, and the host's runtime client — which dials one fixed port —
 * goes on talking to whichever process got there first. `ping` answers
 * `{pong, runtime, godot, log_capture}` with no pid and no boot nonce, so
 * nothing downstream can tell the two apart. Every `runtime_*` call after that
 * is confidently about the wrong game, which is the worst possible failure for
 * the one feature whose entire claim is determinism.
 */
test("godot_run_managed refuses a held runtime port, and names the wrong-process risk", { skip: !POSIX }, async () => {
  const { srv, port } = await squat();
  const rec = makeRecordingServer();
  const reg = registerProcessTools(rec.server as unknown as Parameters<typeof registerProcessTools>[0], cfg(port));
  try {
    const r = await rec.handler("godot_run_managed")({});
    assert.equal(r.isError, true);
    const text = r.content?.[0]?.text ?? "";
    assert.match(text, new RegExp(`127\\.0\\.0\\.1:${port} is already bound`));
    // A bare "port in use" would be useless here: what the caller has to learn
    // is that proceeding produces answers about a different process.
    assert.match(text, /silently address the process that already holds the port/);
    // Every exit named, so the refusal is actionable rather than merely correct.
    assert.match(text, /godot_stop/);
    assert.match(text, /BREAKPOINT_RUNTIME_PORT/);
    assert.match(text, /allow_port_conflict:true/);
    assert.match(text, /runtime_spawn_peers/);
    // Refusing means refusing: no child may be left behind.
    assert.equal(reg.get("godot-1"), undefined, "a refused run must not spawn anything");
  } finally {
    reg.killAll();
    srv.close();
  }
});

test("godot_run_managed honours allow_port_conflict, and the override does not stick", { skip: !POSIX }, async () => {
  const { srv, port } = await squat();
  const rec = makeRecordingServer();
  const reg = registerProcessTools(rec.server as unknown as Parameters<typeof registerProcessTools>[0], cfg(port));
  try {
    const r = await rec.handler("godot_run_managed")({ allow_port_conflict: true });
    assert.notEqual(r.isError, true, "the override must actually start the process");
    const id = sc(r).id as string;
    assert.equal(typeof id, "string");
    await waitFor(() => reg.get(id)?.exited);
    assert.equal(reg.get(id)?.exitCode, 0);

    // The escape hatch is per-call. A second run without it must refuse again —
    // an override that latches would silently disarm the check for the session.
    const again = await rec.handler("godot_run_managed")({});
    assert.equal(again.isError, true, "allow_port_conflict must not persist across calls");
  } finally {
    reg.killAll();
    srv.close();
  }
});

test("a free runtime port is not read as a conflict once the holder lets go", { skip: !POSIX }, async () => {
  // Guards the other direction: the probe must not latch on a port that WAS
  // held. Stop the game, run again, and it works — otherwise the fix trades a
  // silent wrong answer for a permanent refusal.
  const { srv, port } = await squat();
  await new Promise<void>((r) => srv.close(() => r()));
  const rec = makeRecordingServer();
  const reg = registerProcessTools(rec.server as unknown as Parameters<typeof registerProcessTools>[0], cfg(port));
  try {
    const r = await rec.handler("godot_run_managed")({});
    assert.notEqual(r.isError, true);
    assert.equal(typeof sc(r).id, "string");
  } finally {
    reg.killAll();
  }
});

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { registerCliTools } from "../src/tools/cli.js";
import type { Config } from "../src/config.js";

/**
 * Behavior tests for the headless-CLI plane (tools/cli.ts). The value here is
 * pure host logic: capturing a child's stdout, degrading (not throwing) when the
 * binary is missing or exits non-zero, and launching detached processes. A tiny
 * POSIX fixture stands in for the Godot binary so no real Godot is needed.
 */

const POSIX = process.platform !== "win32";

type ToolResult = {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content?: Array<{ type: string; text?: string }>;
};
type Handler = (args: Record<string, unknown>) => Promise<ToolResult>;

/**
 * A recorder that captures plain tools AND task-model tools (godot_export/import/
 * run_headless_script register via server.experimental.tasks). Task handlers are
 * not plain callables, so we only assert their presence, never invoke them.
 */
function setup(godotBin: string, projectPath: string, runtimePort?: number) {
  const tools = new Map<string, Handler>();
  const server = {
    registerTool(name: string, _config: unknown, handler: Handler) {
      tools.set(name, handler);
    },
    experimental: {
      tasks: {
        registerToolTask(name: string) {
          tools.set(name, (async () => ({ content: [] })) as Handler);
        },
      },
    },
    server: { elicitInput: async () => ({ action: "decline" }) },
  };
  registerCliTools(
    server as unknown as Parameters<typeof registerCliTools>[0],
    {
      godotBin,
      projectPath,
      runtimeHost: "127.0.0.1",
      runtimePort: runtimePort ?? freeRuntimePort,
    } as unknown as Config,
  );
  return tools;
}

let dir: string;
let fakeGodot: string;
/** A runtime-bridge port nothing holds, so the no-conflict path stays the default. */
let freeRuntimePort: number;

/** Hold an ephemeral loopback port — stands in for a game already running. */
function squat(): Promise<{ srv: net.Server; port: number }> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => resolve({ srv, port: (srv.address() as net.AddressInfo).port }));
  });
}

before(async () => {
  if (!POSIX) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gcb-cli-"));
  fakeGodot = path.join(dir, "fakegodot.sh");
  // Prints a fixed version line for `--version`; exits 0 for anything else.
  fs.writeFileSync(
    fakeGodot,
    ['#!/bin/sh', 'if [ "$1" = "--version" ]; then echo "4.7.stable.custom"; fi', "exit 0", ""].join("\n"),
    { mode: 0o755 },
  );
  const held = await squat();
  freeRuntimePort = held.port;
  await new Promise<void>((r) => held.srv.close(() => r()));
});

after(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

const sc = (r: ToolResult) => r.structuredContent as Record<string, unknown>;

test("godot_version returns the captured version string and exit code 0", { skip: !POSIX }, async () => {
  const tools = setup(fakeGodot, dir);
  const r = await tools.get("godot_version")!({});
  assert.equal(sc(r).version, "4.7.stable.custom");
  assert.equal((sc(r).raw as { code: number }).code, 0);
});

test("godot_version degrades (no throw) when the binary is missing", { skip: !POSIX }, async () => {
  const tools = setup("/no/such/godot-binary-xyz", dir);
  const r = await tools.get("godot_version")!({});
  // A spawn failure resolves to a result (never throws): exit code is null and
  // timed_out is false — the tool reports the failure instead of crashing.
  assert.notEqual(r.isError, true, "a missing binary should be reported, not thrown");
  const raw = sc(r).raw as { code: number | null; timedOut: boolean };
  assert.equal(raw.code, null);
  assert.equal(raw.timedOut, false);
});

test("godot_version records a non-zero exit code without throwing", { skip: !POSIX }, async () => {
  const tools = setup("/usr/bin/false", dir);
  const r = await tools.get("godot_version")!({});
  assert.notEqual(r.isError, true);
  assert.equal((sc(r).raw as { code: number | null }).code, 1);
});

test("godot_run_project launches detached and returns a numeric pid", { skip: !POSIX }, async () => {
  const tools = setup(fakeGodot, dir);
  const r = await tools.get("godot_run_project")!({});
  assert.equal(sc(r).running, true);
  assert.equal(typeof sc(r).pid, "number");
});

test("godot_launch_editor reports launched:true and the project path", { skip: !POSIX }, async () => {
  const tools = setup(fakeGodot, dir);
  const r = await tools.get("godot_launch_editor")!({});
  assert.equal(sc(r).launched, true);
  assert.equal(sc(r).project, dir);
});

test("the long-running CLI tools register under the task model", { skip: !POSIX }, () => {
  const tools = setup(fakeGodot, dir);
  for (const n of ["godot_export", "godot_import", "godot_run_headless_script"]) {
    assert.ok(tools.has(n), `${n} should be registered`);
  }
});

/**
 * `godot_run_project` is detached, so unlike the managed path there is not even a
 * captured `push_error("could not listen…")` to find afterwards. If the runtime
 * bridge port is already held, this tool would hand back `running: true` for a
 * game the host can never address, while `runtime_*` kept answering from the
 * process that already owned the port. See `host/src/ports.ts`.
 */
test("godot_run_project refuses a held runtime port instead of returning running:true", { skip: !POSIX }, async () => {
  const { srv, port } = await squat();
  try {
    const tools = setup(fakeGodot, dir, port);
    const r = await tools.get("godot_run_project")!({});
    assert.equal(r.isError, true);
    const text = r.content?.[0]?.text ?? "";
    assert.match(text, new RegExp(`127\\.0\\.0\\.1:${port} is already bound`));
    assert.match(text, /silently address the process that already holds the port/);
    assert.match(text, /runtime_spawn_peers/);
    assert.equal(r.structuredContent, undefined, "a refusal carries no success payload");
  } finally {
    srv.close();
  }
});

test("godot_run_project still launches when allow_port_conflict is set", { skip: !POSIX }, async () => {
  const { srv, port } = await squat();
  try {
    const tools = setup(fakeGodot, dir, port);
    const r = await tools.get("godot_run_project")!({ allow_port_conflict: true });
    assert.notEqual(r.isError, true);
    assert.equal(sc(r).running, true);
    assert.equal(typeof sc(r).pid, "number");
  } finally {
    srv.close();
  }
});

test("godot_launch_editor is unaffected — the editor binds the bridge port, not the runtime port", { skip: !POSIX }, async () => {
  // The editor's bridge_server listens on BREAKPOINT_BRIDGE_PORT (9080); the
  // runtime autoload owns 9081. Gating the editor on a busy runtime port would
  // be a false positive, and a check that fires when nothing is wrong gets
  // disabled by the first person it inconveniences.
  const { srv, port } = await squat();
  try {
    const tools = setup(fakeGodot, dir, port);
    const r = await tools.get("godot_launch_editor")!({});
    assert.notEqual(r.isError, true);
    assert.equal(sc(r).launched, true);
  } finally {
    srv.close();
  }
});

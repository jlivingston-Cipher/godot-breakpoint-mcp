import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  describeExit,
  peerExitRemedy,
  readinessHint,
  readinessRemedy,
  type ReadinessCause,
} from "../src/exit-cause.js";
import { PeerRegistry } from "../src/peers.js";
import { BridgeError, remedyClause } from "../src/bridge.js";
import { loadConfig } from "../src/config.js";

/**
 * 266 — the two peer sites of `host-failures-carry-no-remedy`, and the argument node had
 * been handing us since the process registry was written.
 *
 * 🔴 THE CLAIMS HERE ARE DRIVEN AGAINST REAL SPAWNED CHILDREN, not against hand-built
 * error objects, for 265 §5's reason: a remedy asserted against a fabricated `Managed`
 * proves the formatter and says nothing about whether the branch is reachable with the
 * state the registry actually holds. The three fake binaries below are the three
 * measured populations — a child that dies, a child that lives and never answers, and a
 * child that works and is then killed.
 */

const DIE = `#!/usr/bin/env node
process.stderr.write("SCRIPT ERROR: could not load main scene\\n");
process.exit(1);
`;

const DEAF = `#!/usr/bin/env node
// Alive, reachable by nobody: binds no port at all. This is what a project WITHOUT the
// runtime autoload looks like from the host's side, and it is the ONE family the shipped
// hint was ever true of.
setTimeout(() => {}, 60000);
`;

const LIVE = `#!/usr/bin/env node
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
const port = Number.parseInt(process.env.BREAKPOINT_RUNTIME_PORT ?? "0", 10);
const projectPath = process.env.FAKE_PEER_PROJECT ?? process.cwd();
const expected = (() => {
  try { return fs.readFileSync(path.join(projectPath, ".godot", "breakpoint_mcp.secret"), "utf8").trim(); }
  catch { return ""; }
})();
net.createServer((sock) => {
  let authed = expected.length === 0;
  let buf = "";
  sock.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    let nl;
    while ((nl = buf.indexOf("\\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.method === "auth") {
        if (msg.params?.secret === expected) { authed = true; sock.write(JSON.stringify({ ok: true }) + "\\n"); }
        else { sock.destroy(); }
        continue;
      }
      if (!authed) { sock.destroy(); continue; }
      sock.write(JSON.stringify({ id: msg.id, ok: true, result: { pong: true, runtime: true } }) + "\\n");
    }
  });
}).listen(port, "127.0.0.1");
`;

function fixture(body: string): { dir: string; bin: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-exit-"));
  fs.writeFileSync(path.join(dir, "project.godot"), 'config_version=5\n\n[application]\n\nconfig/name="exit"\n');
  const bin = path.join(dir, "fake-godot.mjs");
  fs.writeFileSync(bin, body, { mode: 0o755 });
  return { dir, bin };
}

let nextBase = 23080;
const cfgFor = (f: { dir: string; bin: string }) => ({
  ...loadConfig(),
  godotBin: f.bin,
  projectPath: f.dir,
  runtimeHost: "127.0.0.1",
  runtimePort: (nextBase += 20),
  runtimeTimeoutMs: 4000,
});

const skipWin = { skip: process.platform === "win32" ? "shebang spawn is POSIX-only" : false };

/** The shipped sentence, quoted once so the byte-identity claims below cannot drift. */
const SHIPPED_HINT = "Is the Breakpoint MCP addon enabled in this project (it registers the runtime autoload)?";

// ── describeExit: the argument that was being dropped ─────────────────────────────────

test("describeExit names the SIGNAL when there is one, and the code when there is not — and the two differ", () => {
  const killed = describeExit(null, "SIGKILL");
  const exited = describeExit(1, null);
  assert.equal(killed, "killed by SIGKILL");
  assert.equal(exited, "exited (code 1)");
  assert.notEqual(killed, exited, "one rendering for two terminations is the defect this replaces");
  // The pre-266 rendering interpolated exitCode unconditionally; assert that string is
  // gone rather than merely that the new one is present.
  assert.ok(!killed.includes("null"), "a signal-killed child must never render its null code");
});

test("describeExit still answers when node gives NEITHER — and does not print the word null", () => {
  const neither = describeExit(null, null);
  assert.equal(neither, "exited without reporting a code");
  assert.ok(!neither.includes("null"));
  assert.notEqual(neither, describeExit(0, null), "code 0 is a real code and must not read as an absent one");
});

test("describeExit prefers the signal over a code, so a kill is never reported as a clean exit", () => {
  // node does not produce both, but the branch order is the claim: were it reversed, a
  // future caller passing both would be told the process chose to stop.
  assert.equal(describeExit(0, "SIGTERM"), "killed by SIGTERM");
});

// ── readinessHint: the suppression, in BOTH directions ────────────────────────────────

test("readinessHint keeps the shipped sentence BYTE-IDENTICAL while every peer is merely silent", () => {
  assert.equal(readinessHint(["silent"], SHIPPED_HINT), SHIPPED_HINT);
  assert.equal(readinessHint(["silent", "silent"], SHIPPED_HINT), SHIPPED_HINT);
});

test("readinessHint suppresses the sentence the moment ANY peer exited — the case it is false in", () => {
  assert.equal(readinessHint(["exited"], SHIPPED_HINT), "");
  assert.equal(readinessHint(["exited", "silent"], SHIPPED_HINT), "", "one dead child is enough to make it a false claim about the rest");
  assert.notEqual(
    readinessHint(["exited"], SHIPPED_HINT),
    readinessHint(["silent"], SHIPPED_HINT),
    "a build that suppressed unconditionally would pass a one-sided test and be a worse defect",
  );
});

// ── readinessRemedy: three populations, three next actions ────────────────────────────

test("readinessRemedy names a DIFFERENT next action for each of the three populations", () => {
  const exited = readinessRemedy(["exited"])!;
  const silent = readinessRemedy(["silent"])!;
  const mixed = readinessRemedy(["exited", "silent"])!;
  assert.equal(new Set([exited, silent, mixed]).size, 3, "three causes that share one sentence is what 266 removed");
  assert.match(exited, /exited on its own/);
  assert.ok(!/Enable the "Breakpoint MCP" plugin/.test(exited), "a child that died was not stopped by a disabled plugin");
  assert.match(silent, /Enable the "Breakpoint MCP" plugin/);
  // Trimmed at 267 to the 210-character ceiling check 28 has always enforced on the
  // addon's own remedies and now enforces on the host's. Both populations are still named,
  // which is the claim — the exact wording was not.
  assert.match(mixed, /two things failed and only the second is the addon/);
  assert.ok(mixed.length <= 210, `a host remedy over the ceiling: ${mixed.length}`);
  for (const r of [exited, silent, mixed]) assert.ok(r.endsWith("."), "check 28's grammar: a remedy ends in a full stop");
});

test("readinessRemedy answers nothing when nothing was not ready — it does not invent a sentence", () => {
  assert.equal(readinessRemedy([]), undefined);
});

// ── peerExitRemedy: branched on whether there is anything to read ─────────────────────

test("peerExitRemedy sends the caller to the output only when output was captured", () => {
  const withTail = peerExitRemedy(true);
  const without = peerExitRemedy(false);
  assert.match(withTail, /Read the last output quoted above/);
  assert.match(without, /captured no output/);
  assert.notEqual(withTail, without);
  assert.ok(!/Read the last output/.test(without), "pointing at output that is not there is the shape 259 §3 found");
  for (const r of [withTail, without]) assert.match(r, /runtime_spawn_peers/, "both name the tool that replaces it");
});

// ── The live drives. These are the claims that could not be made against a fake. ──────

test("LIVE: a peer whose child EXITED reports the exit, drops the addon question, and says what to do", skipWin, async () => {
  const f = fixture(DIE);
  const reg = new PeerRegistry(cfgFor(f) as never);
  try {
    await assert.rejects(
      reg.spawn({ count: 1, timeoutMs: 6000 }),
      (e: unknown) => {
        assert.ok(e instanceof BridgeError && e.code === "peer_not_ready");
        assert.match(e.message, /exited \(code 1\)/);
        assert.match(e.message, /SCRIPT ERROR: could not load main scene/, "the tail the operator must read is quoted");
        assert.ok(!e.message.includes(SHIPPED_HINT), "before 266 this sentence was appended to this exact failure");
        assert.match(remedyClause(e), / — Read the output quoted above/, "the next action reaches the renderer");
        return true;
      },
    );
  } finally {
    reg.stopAll();
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("LIVE: a peer that STAYS UP and never answers keeps the shipped message byte-for-byte, and gains a remedy", skipWin, async () => {
  const f = fixture(DEAF);
  const reg = new PeerRegistry(cfgFor(f) as never);
  try {
    await assert.rejects(
      reg.spawn({ count: 1, timeoutMs: 4000 }),
      (e: unknown) => {
        assert.ok(e instanceof BridgeError && e.code === "peer_not_ready");
        assert.match(e.message, /never answered ping/);
        assert.ok(e.message.endsWith(SHIPPED_HINT), "the family the hint is TRUE of must read exactly as it shipped");
        assert.match(remedyClause(e), / — Enable the "Breakpoint MCP" plugin/);
        return true;
      },
    );
  } finally {
    reg.stopAll();
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("LIVE: a peer killed by a SIGNAL says so, where it used to print `exited (code null)`", skipWin, async () => {
  const f = fixture(LIVE);
  const reg = new PeerRegistry(cfgFor(f) as never);
  try {
    const peers = await reg.spawn({ count: 1, timeoutMs: 8000 });
    assert.equal(peers[0].ready, true, "the drive is only meaningful on a peer that WORKED first");
    process.kill(peers[0].pid!, "SIGKILL");
    // The exit event is what populates exitSignal; poll rather than sleep a fixed span.
    for (let i = 0; i < 60; i++) {
      try {
        reg.clientFor(peers[0].id);
        await new Promise((r) => setTimeout(r, 50));
      } catch (e) {
        assert.ok(e instanceof BridgeError && e.code === "peer_exited");
        assert.match(e.message, /killed by SIGKILL/);
        assert.ok(!e.message.includes("code null"), "the null this sentence used to render was node's dropped second argument");
        assert.match(remedyClause(e), / — /, "a dead peer now names a next action");
        return;
      }
    }
    assert.fail("the registry never noticed the child had gone");
  } finally {
    reg.stopAll();
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("LIVE: the process registry CAPTURES the signal — the field, not just the sentence", skipWin, async () => {
  // Asserted on the recorded state rather than on rendered text, so a reword cannot green
  // it and a revert of the `(code, signal)` handler cannot hide behind one.
  const f = fixture(LIVE);
  const reg = new PeerRegistry(cfgFor(f) as never);
  try {
    const peers = await reg.spawn({ count: 1, timeoutMs: 8000 });
    const procs = (reg as unknown as { procs: { get(id: string): { exited: boolean; exitCode: number | null; exitSignal: string | null } | undefined } }).procs;
    const managedId = (reg as unknown as { peers: Map<string, { managedId: string }> }).peers.get(peers[0].id)!.managedId;
    assert.equal(procs.get(managedId)!.exitSignal, null, "a running child has no signal");
    process.kill(peers[0].pid!, "SIGTERM");
    for (let i = 0; i < 60 && !procs.get(managedId)!.exited; i++) await new Promise((r) => setTimeout(r, 50));
    const m = procs.get(managedId)!;
    assert.equal(m.exited, true);
    assert.equal(m.exitSignal, "SIGTERM", "node passed this on every kill since the registry was written");
    assert.equal(m.exitCode, null, "and the code really is absent, which is why the old sentence printed a null");
  } finally {
    reg.stopAll();
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

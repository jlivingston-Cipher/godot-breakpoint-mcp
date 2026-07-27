import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { PeerRegistry, MAX_PEERS } from "../src/peers.js";
import { loadConfig } from "../src/config.js";
import { readProjectSecret } from "../src/secret.js";

/**
 * F6 — the multi-peer registry, tested against a FAKE headless peer rather than
 * a real Godot.
 *
 * The fake is a tiny Node script that does exactly what the runtime autoload
 * does and nothing else: read `BREAKPOINT_RUNTIME_PORT` from its environment,
 * bind loopback on it, accept the newline-delimited-JSON `auth` line against the
 * per-project secret FILE, and answer `ping` / `runtime.state_digest`. That
 * makes this a real end-to-end exercise of the whole load-bearing mechanism —
 * env port passthrough, host-minted secret, per-peer client pool, readiness
 * wait, lifecycle — on every CI node version, with no engine installed.
 *
 * What it deliberately does NOT cover: whether *Godot* honours the env var and
 * the secret file. That was settled on real Godot 4.3 headless in the F6 spike
 * (`F6_SPIKE_RESULT_2026-07-27.md`) and is re-checked by the integration
 * workflow, not here.
 */

const FAKE_PEER = `#!/usr/bin/env node
// Stands in for a headless Godot running the Breakpoint runtime autoload.
// Command-line arguments are ignored on purpose: the engine's own flags
// (--path/--headless/scene) are meaningless here, and ignoring them is what
// lets this be dropped in as \`godotBin\`.
import net from "node:net";
import fs from "node:fs";
import path from "node:path";

const port = Number.parseInt(process.env.BREAKPOINT_RUNTIME_PORT ?? "0", 10);
const projectPath = process.env.FAKE_PEER_PROJECT ?? process.cwd();
const index = process.env.BREAKPOINT_PEER_INDEX ?? "?";
const role = process.env.BREAKPOINT_PEER_ROLE ?? "";
const drift = process.env.FAKE_PEER_DRIFT === "1";
if (process.env.FAKE_PEER_DIE === "1") {
  process.stderr.write("SCRIPT ERROR: could not load main scene\\n");
  process.exit(1);
}
const expected = (() => {
  try {
    return fs.readFileSync(path.join(projectPath, ".godot", "breakpoint_mcp.secret"), "utf8").trim();
  } catch { return ""; }
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
        // The addon replies with NO id and closes on failure, exactly as here.
        if (msg.params?.secret === expected) { authed = true; sock.write(JSON.stringify({ ok: true }) + "\\n"); }
        else { sock.write(JSON.stringify({ ok: false, error: { code: "unauthorized", message: "bad secret" } }) + "\\n"); sock.destroy(); }
        continue;
      }
      if (!authed) { sock.destroy(); continue; }
      let result;
      if (msg.method === "ping") result = { pong: true, runtime: true, peer_index: index, role };
      else if (msg.method === "runtime.state_digest")
        result = { digest: { "./Same": { x: 1 }, "./Mover": { x: drift ? Number(index) + 1 : 1 } }, node_count: 2 };
      else result = { echoed: msg.method, params: msg.params ?? {} };
      sock.write(JSON.stringify({ id: msg.id, ok: true, result }) + "\\n");
    }
  });
}).listen(port, "127.0.0.1");
`;

/** A throwaway project dir + an executable fake-Godot to spawn as its peers. */
function fixture(): { dir: string; bin: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-peers-"));
  fs.writeFileSync(path.join(dir, "project.godot"), 'config_version=5\n\n[application]\n\nconfig/name="peers"\n');
  const bin = path.join(dir, "fake-godot.mjs");
  fs.writeFileSync(bin, FAKE_PEER, { mode: 0o755 });
  return { dir, bin };
}

function cfgFor(f: { dir: string; bin: string }, runtimePort: number) {
  return {
    ...loadConfig(),
    godotBin: f.bin,
    projectPath: f.dir,
    runtimeHost: "127.0.0.1",
    runtimePort,
    runtimeTimeoutMs: 4000,
  };
}

// A per-test base port keeps concurrently-running suites off each other's ports.
let nextBase = 19080;
const basePort = () => (nextBase += 20);

// The fake peer is spawned via its shebang, which POSIX resolves and Windows
// does not. Every CI runner here is ubuntu-latest; this only skips a local
// Windows developer run.
const skipWin = { skip: process.platform === "win32" ? "shebang spawn is POSIX-only" : false };

test("spawn: peers bind the allocated ports, authenticate with the host-minted secret, and answer independently", skipWin, async () => {
  const f = fixture();
  const base = basePort();
  const reg = new PeerRegistry(cfgFor(f, base) as never);
  try {
    // No secret exists yet — the host must mint it BEFORE the first spawn
    // (spike constraint 2), or a cold project races the addon's unlocked mint.
    assert.equal(readProjectSecret(f.dir), null, "fixture starts with no secret");

    const peers = await reg.spawn({ count: 3, role: "client", timeoutMs: 8000 });
    const secret = readProjectSecret(f.dir);
    assert.ok(secret && secret.length === 64, "host minted a 64-char secret before spawning");

    assert.equal(peers.length, 3);
    assert.deepEqual(peers.map((p) => p.ready), [true, true, true]);
    assert.equal(new Set(peers.map((p) => p.port)).size, 3, "every peer got a distinct port");
    for (const p of peers) {
      assert.ok(p.port > base, `peer port ${p.port} must sit above the default runtime port ${base}`);
      assert.equal(p.role, "client");
      assert.ok(typeof p.pid === "number");
    }

    // Each peer answers on its OWN socket, and reports the env it was given —
    // which is the whole mechanism: one project secret, N ports, N processes.
    for (let i = 0; i < peers.length; i++) {
      const pong = (await reg.clientFor(peers[i].id).request("ping", {})) as {
        pong: boolean; peer_index: string; role: string;
      };
      assert.equal(pong.pong, true);
      assert.equal(pong.peer_index, String(i), "BREAKPOINT_PEER_INDEX reached the child");
      assert.equal(pong.role, "client", "BREAKPOINT_PEER_ROLE reached the child");
    }
  } finally {
    reg.stopAll();
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("spawn: an existing project secret is reused, never overwritten", skipWin, async () => {
  const f = fixture();
  const preset = "a".repeat(64);
  fs.mkdirSync(path.join(f.dir, ".godot"), { recursive: true });
  fs.writeFileSync(path.join(f.dir, ".godot", "breakpoint_mcp.secret"), preset);

  const reg = new PeerRegistry(cfgFor(f, basePort()) as never);
  try {
    const peers = await reg.spawn({ count: 1, timeoutMs: 8000 });
    assert.equal(readProjectSecret(f.dir), preset, "the editor's secret must survive a peer spawn");
    // The peer authenticated against that same value, so requests work.
    assert.equal(((await reg.clientFor(peers[0].id).request("ping", {})) as { pong: boolean }).pong, true);
  } finally {
    reg.stopAll();
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("allocator: peers never take the default runtime port, and skip one already in use", skipWin, async () => {
  const f = fixture();
  const base = basePort();
  const cfg = cfgFor(f, base);
  // Occupy the first port the allocator would otherwise hand out.
  const squatter = await new Promise<net.Server>((resolve) => {
    const s = net.createServer();
    s.listen(base + 1, "127.0.0.1", () => resolve(s));
  });
  const reg = new PeerRegistry(cfg as never);
  try {
    const peers = await reg.spawn({ count: 2, timeoutMs: 8000 });
    const ports = peers.map((p) => p.port);
    assert.ok(!ports.includes(base), "must never collide with the default runtime port");
    assert.ok(!ports.includes(base + 1), "must skip a port already bound by another process");
    assert.equal(new Set(ports).size, 2);
  } finally {
    reg.stopAll();
    squatter.close();
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("lifecycle: stop kills a peer, is idempotent, and stopAll clears the live set", skipWin, async () => {
  const f = fixture();
  const reg = new PeerRegistry(cfgFor(f, basePort()) as never);
  try {
    const peers = await reg.spawn({ count: 2, timeoutMs: 8000 });
    assert.equal(reg.live().length, 2);

    assert.deepEqual(reg.stop(peers[0].id), [peers[0].id]);
    assert.deepEqual(reg.stop(peers[0].id), [peers[0].id], "repeating a stop is a no-op, not an error");
    assert.deepEqual(reg.live().map((p) => p.id), [peers[1].id]);

    // A stopped peer is no longer addressable, and says why.
    assert.throws(() => reg.clientFor(peers[0].id), /was stopped/);

    reg.stopAll();
    assert.deepEqual(reg.live(), []);
  } finally {
    reg.stopAll();
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("errors: unknown peer ids name the live set instead of failing as a bridge error", skipWin, async () => {
  const f = fixture();
  const reg = new PeerRegistry(cfgFor(f, basePort()) as never);
  try {
    assert.throws(() => reg.clientFor("peer-404"), (e: Error & { code?: string }) => {
      assert.equal(e.code, "unknown_peer");
      assert.match(e.message, /Live peers: \(none\)/);
      return true;
    });
    const peers = await reg.spawn({ count: 1, timeoutMs: 8000 });
    assert.throws(() => reg.stop("peer-404"), new RegExp(`Live peers: ${peers[0].id}`));
  } finally {
    reg.stopAll();
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("readiness: a peer that dies on startup fails the spawn WITH its own stderr attached", skipWin, async () => {
  const f = fixture();
  const reg = new PeerRegistry(cfgFor(f, basePort()) as never);
  process.env.FAKE_PEER_DIE = "1";
  try {
    await assert.rejects(
      reg.spawn({ count: 1, timeoutMs: 1500 }),
      (e: Error & { code?: string }) => {
        assert.equal(e.code, "peer_not_ready");
        // The whole point: the caller sees WHY, not "cannot reach the bridge".
        assert.match(e.message, /could not load main scene/);
        assert.match(e.message, /addon enabled/);
        return true;
      },
    );
  } finally {
    delete process.env.FAKE_PEER_DIE;
    reg.stopAll();
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("ceiling: MAX_PEERS live peers is a hard limit, and the error says how to clear it", skipWin, async () => {
  const f = fixture();
  const reg = new PeerRegistry(cfgFor(f, basePort()) as never);
  try {
    assert.equal(MAX_PEERS, 4);
    await reg.spawn({ count: MAX_PEERS, timeoutMs: 10000 });
    assert.equal(reg.live().length, MAX_PEERS);
    await assert.rejects(reg.spawn({ count: 1, timeoutMs: 1000 }), /ceiling of 4/);
    // Freeing a slot makes room again — the ceiling is on LIVE peers, not on
    // how many the registry has ever spawned.
    reg.stop(reg.live()[0].id);
    const more = await reg.spawn({ count: 1, timeoutMs: 8000 });
    assert.equal(more.length, 1);
  } finally {
    reg.stopAll();
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("auth: a peer refuses a host whose secret does not match the project file", skipWin, async () => {
  const f = fixture();
  const reg = new PeerRegistry(cfgFor(f, basePort()) as never);
  try {
    const peers = await reg.spawn({ count: 1, timeoutMs: 8000 });
    // The peer authenticated against the file. Now rewrite the file so the host's
    // NEXT connection presents a value the running peer will reject — the shape a
    // stale or mismatched secret has in the wild.
    fs.writeFileSync(path.join(f.dir, ".godot", "breakpoint_mcp.secret"), "c".repeat(64));
    reg.clientFor(peers[0].id).close();
    await assert.rejects(
      reg.clientFor(peers[0].id).request("ping", {}, 2500),
      (e: Error & { code?: string }) => {
        // The addon closes the socket on a failed handshake, so the host sees the
        // connection drop or the request time out — either way it does NOT succeed.
        assert.ok(["bridge_closed", "timeout", "bridge_unavailable"].includes(e.code ?? ""), `unexpected code ${e.code}`);
        return true;
      },
    );
  } finally {
    reg.stopAll();
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("lifecycle: a peer that dies AFTER becoming ready reports peer_exited with its output", skipWin, async () => {
  const f = fixture();
  const reg = new PeerRegistry(cfgFor(f, basePort()) as never);
  try {
    const peers = await reg.spawn({ count: 1, timeoutMs: 8000 });
    assert.equal(reg.live().length, 1);

    // Kill the child out from under the registry — a crash, not a runtime_peer_stop.
    process.kill(peers[0].pid as number, "SIGKILL");
    for (let i = 0; i < 40 && reg.live().length === 1; i++) await new Promise((r) => setTimeout(r, 50));

    assert.deepEqual(reg.live(), [], "a dead child must drop out of the live set");
    assert.throws(() => reg.clientFor(peers[0].id), (e: Error & { code?: string }) => {
      // Not "was stopped" (nobody stopped it) and not a generic bridge error —
      // the caller needs to know the process died, and ideally why.
      assert.equal(e.code, "peer_exited");
      assert.match(e.message, /exited/);
      return true;
    });
  } finally {
    reg.stopAll();
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

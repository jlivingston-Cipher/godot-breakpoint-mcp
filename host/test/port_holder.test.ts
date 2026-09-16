import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { EventEmitter } from "node:events";
import {
  attribute,
  foldHolders,
  lsofArgs,
  noteOwned,
  ownedPeers,
  parseLsof,
  readHolder,
  silentHolderRemedy,
  whoHolds,
  type ExecFn,
  type ExecOutcome,
  type Holder,
  type PortHolder,
} from "../src/port-holder.js";
import { portConflictMessage } from "../src/ports.js";
import { holderFacts } from "../src/cli/doctor.js";
import { BridgeClient, BridgeError } from "../src/bridge.js";
import { startTcpServer } from "./helpers/tcp.js";

// 🔴 THE FIXTURES ARE THE BYTES lsof PRINTED AT 318, NOT OUTPUT WRITTEN TO FIT THE PARSER.
// macOS 15.7 / lsof 4.91 against a node listener, and Ubuntu 24.04 against the same — the
// Linux build omits the `f` line, which is why the parser ignores every field letter it does
// not read. The escaped name is Activity Monitor's `ROLI Hardware Driver`, as lsof spelled it.
const MAC_OUT = "p19023\ncnode\nf12\nn127.0.0.1:58567\n";
const LINUX_OUT = "p1568\ncnode\nn127.0.0.1:39633\n";
const ESCAPED_OUT = "p87502\ncROLI\\x20Hardware\\x20Driver\nf4\nn127.0.0.1:12911\n";

const exec = (outcome: ExecOutcome, calls: string[][] = []): ExecFn => async (file, args) => {
  calls.push([file, ...args]);
  return outcome;
};

const listen = (host = "127.0.0.1"): Promise<net.Server> =>
  new Promise((resolve) => {
    const s = net.createServer((sock) => sock.on("error", () => {}));
    s.listen(0, host, () => resolve(s));
  });
const portOf = (s: net.Server): number => (s.address() as net.AddressInfo).port;
const closeServer = (s: net.Server): Promise<void> => new Promise((r) => s.close(() => r()));

test("318: parseLsof reads the measured macOS and Linux output, and decodes lsof's \\xNN escapes", () => {
  assert.deepEqual(parseLsof(MAC_OUT), [{ pid: 19023, command: "node", address: "127.0.0.1:58567" }]);
  assert.deepEqual(parseLsof(LINUX_OUT), [{ pid: 1568, command: "node", address: "127.0.0.1:39633" }]);
  assert.deepEqual(parseLsof(ESCAPED_OUT), [{ pid: 87502, command: "ROLI Hardware Driver", address: "127.0.0.1:12911" }]);
  // One process, two sockets — the dual-stack case — is two listeners here and one holder later.
  const two = parseLsof("p7\ncGodot\nf3\nn127.0.0.1:9081\nf4\nn[::1]:9081\n");
  assert.equal(two.length, 2);
  assert.equal(foldHolders(two, "godot", 1).length, 1);
  assert.deepEqual(foldHolders(two, "godot", 1)[0].addresses, ["127.0.0.1:9081", "[::1]:9081"]);
});

test("318: readHolder's families — found, none_visible, and every way it cannot answer", async () => {
  const calls: string[][] = [];
  const found = await readHolder("127.0.0.1", 9081, { exec: exec({ code: 0, timedOut: false, stdout: MAC_OUT }, calls), platform: "darwin" });
  assert.equal(found.kind, "found");
  assert.deepEqual(calls[0], ["lsof", ...lsofArgs(9081)], "the one invocation, pid+name+address only");
  assert.ok(!lsofArgs(9081).some((a) => /^-F.*[^pcn]/.test(a)), "never asks for anything beyond p, c, n");

  assert.deepEqual(
    await readHolder("127.0.0.1", 9081, { exec: exec({ code: 1, timedOut: false, stdout: "" }), platform: "linux" }),
    { kind: "none_visible" },
  );
  assert.deepEqual(
    await readHolder("127.0.0.1", 9081, { exec: exec({ code: "ENOENT", timedOut: false, stdout: "" }), platform: "linux" }),
    { kind: "unavailable", reason: "lsof is not installed" },
  );
  assert.deepEqual(
    await readHolder("127.0.0.1", 9081, { exec: exec({ code: null, timedOut: true, stdout: "" }), platform: "darwin", timeoutMs: 5 }),
    { kind: "unavailable", reason: "lsof did not answer within 5 ms" },
  );
  assert.deepEqual(
    await readHolder("127.0.0.1", 9081, { exec: exec({ code: 2, timedOut: false, stdout: "" }), platform: "darwin" }),
    { kind: "unavailable", reason: "lsof exited 2" },
  );
  // A non-zero exit WITH output is not "nobody": only exit 1 over an empty table is.
  assert.equal((await readHolder("127.0.0.1", 9081, { exec: exec({ code: 1, timedOut: false, stdout: MAC_OUT }), platform: "darwin" })).kind, "unavailable");

  // Refusals that must not even run the command.
  const untouched: string[][] = [];
  const remote = await readHolder("10.0.0.7", 9081, { exec: exec({ code: 0, timedOut: false, stdout: MAC_OUT }, untouched), platform: "darwin" });
  const windows = await readHolder("127.0.0.1", 9081, { exec: exec({ code: 0, timedOut: false, stdout: MAC_OUT }, untouched), platform: "win32" });
  assert.equal(remote.kind, "unavailable");
  assert.equal(windows.kind, "unavailable");
  assert.equal(untouched.length, 0, "a host that is not this machine, and Windows, never reach lsof");
});

test("318: against the real table — a listener this process holds is found by pid, and a closed port is not", async (t) => {
  const srv = await listen();
  const port = portOf(srv);
  try {
    const held = await readHolder("127.0.0.1", port);
    if (held.kind === "unavailable") {
      // The one legitimate reason a runner cannot answer, named — not a skip that passes anything.
      assert.equal(held.reason, "lsof is not installed");
      t.diagnostic("lsof is not on this runner; the found/none_visible arms ran on injected output only");
      return;
    }
    assert.equal(held.kind, "found");
    assert.ok(held.kind === "found" && held.listeners.some((l) => l.pid === process.pid && l.address === `127.0.0.1:${port}`));
    const who = await whoHolds("127.0.0.1", port, "godot");
    assert.ok(who.kind === "found");
    // One holder, and it is this process — asserted by count and by member, because an
    // `.every` over the holders would pass on a lookup that folded them to nothing.
    assert.equal(who.holders.length, 1);
    assert.equal(who.holders[0].owner.kind, "this_server");
  } finally {
    await closeServer(srv);
  }
  assert.deepEqual(await readHolder("127.0.0.1", port), { kind: "none_visible" }, "the same port, closed, lists nobody");
});

test("318: the ledger names this server's own children, and forgets a pid the moment it exits", () => {
  const child = Object.assign(new EventEmitter(), { pid: 424242 });
  const l = { pid: 424242, command: "Godot", address: "127.0.0.1:9081" };
  assert.deepEqual(attribute(l, "godot", 1), { kind: "godot" }, "before: a Godot this server did not start");
  noteOwned(child, { tool: "godot_run_managed", id: "godot-3" });
  assert.deepEqual(attribute(l, "godot", 1), { kind: "godot_run_managed", id: "godot-3" });
  child.emit("exit");
  assert.deepEqual(attribute(l, "godot", 1), { kind: "godot" }, "after exit the pid is a stranger again");

  const peer = Object.assign(new EventEmitter(), { pid: 424243 });
  noteOwned(peer, { tool: "runtime_spawn_peers", id: "peer-1", port: 9082 });
  assert.deepEqual(ownedPeers(), [{ id: "peer-1", port: 9082, pid: 424243 }]);
  peer.emit("exit");
  assert.deepEqual(ownedPeers(), []);

  noteOwned(Object.assign(new EventEmitter(), { pid: undefined }), { tool: "godot_run_project" });
  assert.deepEqual(ownedPeers(), [], "a child that never got a pid records nothing");
});

test("318: attribution — a renamed Godot is recognised through GODOT_BIN, anything else is not Godot", () => {
  const at = (command: string, bin: string) => attribute({ pid: 99, command, address: "*:1" }, bin, 1).kind;
  assert.equal(at("Godot", "/Applications/Godot.app/Contents/MacOS/Godot"), "godot");
  assert.equal(at("Godot_v4.4-stab", "godot"), "godot", "Linux truncates comm to 15 bytes");
  assert.equal(at("engine", "/opt/builds/engine"), "godot", "renamed, and named by GODOT_BIN");
  assert.equal(at("engine", "godot"), "other");
  assert.equal(at("python3", "godot"), "other");
  assert.equal(attribute({ pid: 5, command: "node", address: "*:1" }, "godot", 5).kind, "this_server");
});

const h = (owner: Holder["owner"], command = "Godot", pid = 4312): Holder => ({ pid, command, addresses: ["127.0.0.1:9081"], owner });
const found = (...holders: Holder[]): PortHolder => ({ kind: "found", holders });

// 🔴 BYTE-FOR-BYTE WHAT 1.85.1 RETURNED, captured from its built `dist/ports.js` before this
// change. The promise is that a lookup that cannot answer leaves the refusal exactly as it was.
const SHIPPED_RUN =
  "127.0.0.1:9081 is already bound, so a game started now could not host the runtime bridge. Its autoload would fail to listen and keep running anyway, and every runtime_* call would silently address the process that already holds the port instead of the one you just started. Stop the running game first — godot_stop if godot_run_managed started it, otherwise quit it in the game window or end the debug session that launched it (a detached godot_run_project game is not stoppable by any tool) — or point this server at a free port with BREAKPOINT_RUNTIME_PORT. Pass allow_port_conflict:true to start it anyway — reasonable only if you want the process for its console output or its side effects and will not use any runtime_* tool against it. To drive more than one game at once, use runtime_spawn_peers, which allocates a distinct port per peer.";
const SHIPPED_DEBUGGER =
  "127.0.0.1:9081 is already bound, so a game started now could not host the runtime bridge. Its autoload would fail to listen and keep running anyway, and every runtime_* call would silently address the process that already holds the port instead of the one you just started. Deal with whatever is already holding it — which remedy applies depends on what it is: godot_stop if godot_run_managed started it, dbg_attach / cs_dbg_attach to debug the running game instead of launching a second one (that works only if it is already under the debugger — a plain godot_run_project or godot_run_managed game is not), or quit it in the game window or the editor. You can also point this server at a free port with BREAKPOINT_RUNTIME_PORT. Pass allow_port_conflict:true to launch anyway: breakpoints, stepping and variable inspection will all work normally, because a DAP session is addressed by session rather than by port — but every runtime_* call would go to the process holding the port, not to the game you just launched. To drive more than one game at once, use runtime_spawn_peers, which allocates a distinct port per peer.";

test("318: a refusal whose holder could not be read is the refusal that shipped, byte for byte", () => {
  const unavailable: PortHolder = { kind: "unavailable", reason: "lsof is not installed" };
  assert.equal(portConflictMessage("127.0.0.1", 9081), SHIPPED_RUN);
  assert.equal(portConflictMessage("127.0.0.1", 9081, "run", unavailable), SHIPPED_RUN);
  assert.equal(portConflictMessage("127.0.0.1", 9081, "debugger"), SHIPPED_DEBUGGER);
  assert.equal(portConflictMessage("127.0.0.1", 9081, "debugger", unavailable), SHIPPED_DEBUGGER);
});

test("318: a refusal whose holder IS known names it and gives only the remedy that applies", () => {
  const managed = portConflictMessage("127.0.0.1", 9081, "run", found(h({ kind: "godot_run_managed", id: "godot-2" })));
  assert.match(managed, /held by the game godot_run_managed started as "godot-2" \(pid 4312, Godot, on 127\.0\.0\.1:9081\)/);
  assert.match(managed, /stop it with godot_stop, id "godot-2"/);
  assert.doesNotMatch(managed, /which remedy applies|otherwise quit it/, "the conditional list is gone");
  assert.match(managed, /allow_port_conflict:true/, "the override is still offered");

  const stranger = portConflictMessage("127.0.0.1", 9081, "run", found(h({ kind: "other" }, "python3", 77)));
  assert.match(stranger, /a program that is not Godot \(pid 77, python3/);
  assert.doesNotMatch(stranger, /godot_stop/, "no stop tool is named for a process no tool can stop");

  const detached = portConflictMessage("127.0.0.1", 9081, "run", found(h({ kind: "godot_run_project" })));
  assert.match(detached, /No tool can stop a detached game/);
  assert.doesNotMatch(detached, /godot_stop/);

  const underDebugger = portConflictMessage("127.0.0.1", 9081, "debugger", found(h({ kind: "godot" })));
  assert.match(underDebugger, /a Godot process this server did not start/);
  assert.match(underDebugger, /dbg_attach \/ cs_dbg_attach/);
  assert.doesNotMatch(portConflictMessage("127.0.0.1", 9081, "run", found(h({ kind: "godot" }))), /dbg_attach/);

  const hidden = portConflictMessage("127.0.0.1", 9081, "run", { kind: "none_visible" });
  assert.match(hidden, /No process this account can see is listening on it/);
  assert.doesNotMatch(hidden, /godot_stop/);

  const two = portConflictMessage("127.0.0.1", 9081, "run", found(h({ kind: "godot" }, "Godot", 1), h({ kind: "other" }, "nc", 2)));
  assert.match(two, /held by 2 processes/);
});

test("318: the silent-peer remedy with a holder names it, and without one keeps its old sentence", () => {
  const args = ["127.0.0.1", 9081, "the running game", "BREAKPOINT_RUNTIME_HOST"] as const;
  assert.equal(silentHolderRemedy(...args, { kind: "unavailable", reason: "x" }), undefined);
  const stranger = silentHolderRemedy(...args, found(h({ kind: "other" }, "python3", 77)));
  assert.match(String(stranger), /^Set BREAKPOINT_RUNTIME_HOST and its port knob/, "check 28: the next action comes first");
  assert.match(String(stranger), /close what holds 127\.0\.0\.1:9081: a program that is not Godot \(pid 77, python3/);
  assert.match(String(stranger), /never spoke the Breakpoint bridge protocol, so the running game is not what failed\.$/);
  assert.doesNotMatch(String(stranger), /lsof/, "the command is run, not handed over");
  assert.match(String(silentHolderRemedy(...args, found(h({ kind: "runtime_spawn_peers", id: "peer-4" })))), /^Call runtime_peer_stop with id "peer-4" to free 127\.0\.0\.1:9081/);
  assert.match(String(silentHolderRemedy(...args, { kind: "none_visible" })), /holder belongs to another account, so no tool here can stop it\.$/);
});

test("318: BridgeClient asks the lookup at the deadline, and only when the silent-peer sentence would be used", async () => {
  // A listener that accepts and never speaks — the silent peer. The helper destroys its
  // sockets on close; a bare `server.close()` would wait for the client forever.
  const srv = await startTcpServer(() => { /* never respond */ });
  const port = srv.port;
  const client = new BridgeClient("127.0.0.1", port, 5000);
  let asked = 0;
  client.setHolderLookup(async (host, p) => {
    asked += 1;
    assert.equal(host, "127.0.0.1");
    assert.equal(p, port);
    return found(h({ kind: "godot_run_managed", id: "godot-9" }));
  });
  await assert.rejects(client.request("runtime.ping", {}, 60), (e: unknown) => {
    assert.ok(e instanceof BridgeError && e.code === "timeout");
    assert.match(String(e.remedy), /^Call godot_stop with id "godot-9"/);
    return true;
  });
  assert.equal(asked, 1);

  // A positive fact outranks the inference, so the lookup is never run behind it.
  client.setHoldProbe(() => "Release the game with `dbg_continue`.");
  await assert.rejects(client.request("runtime.ping", {}, 60), (e: unknown) => /dbg_continue/.test(String((e as BridgeError).remedy)));
  assert.equal(asked, 1, "the hold probe answered, so lsof was not asked");

  // A lookup that throws leaves the sentence that shipped.
  client.setHoldProbe(() => undefined);
  client.setHolderLookup(async () => { throw new Error("boom"); });
  await assert.rejects(client.request("runtime.ping", {}, 60), (e: unknown) => /lsof -nP -iTCP:/.test(String((e as BridgeError).remedy)));
  client.close();
  await srv.close();
});

test("318: doctor — only a port held entirely by a program that is not Godot turns a row red", () => {
  assert.deepEqual(holderFacts({ kind: "unavailable", reason: "x" }, "GODOT_LSP_PORT"), { suffix: "" });
  assert.deepEqual(holderFacts({ kind: "none_visible" }, "GODOT_LSP_PORT"), { suffix: " · held by a process this account cannot see" });
  const godot = holderFacts(found(h({ kind: "godot" }, "Godot", 511)), "GODOT_LSP_PORT");
  assert.deepEqual(godot, { suffix: " · held by Godot, pid 511" });
  const stranger = holderFacts(found(h({ kind: "other" }, "python3", 77)), "GODOT_LSP_PORT");
  assert.match(String(stranger.wrongProcess), /^A program that is not Godot \(pid 77, python3.*set GODOT_LSP_PORT/);
  const mixed = holderFacts(found(h({ kind: "godot" }, "Godot", 1), h({ kind: "other" }, "nc", 2)), "GODOT_LSP_PORT");
  assert.equal(mixed.wrongProcess, undefined, "one Godot on the port is enough not to accuse the port");
  const ours = holderFacts(found(h({ kind: "godot_run_managed", id: "godot-1" })), "BREAKPOINT_RUNTIME_PORT");
  assert.equal(ours.stop, 'Stop it with godot_stop, id "godot-1", then retry.');
});

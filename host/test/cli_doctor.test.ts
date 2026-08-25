import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import {
  runDoctor,
  runDoctorChecks,
  isPluginEnabled,
  severityFor,
  parseLiveLevel,
  summaryLine,
} from "../src/cli/doctor.js";
import { startTcpServer, type TcpServer } from "./helpers/tcp.js";

/**
 * Tests for `breakpoint-mcp doctor`. The four bridges are exercised against
 * in-process loopback TCP servers (the same helper the DAP/bridge suites use);
 * a POSIX shell fixture stands in for the Godot binary, so no real Godot is
 * needed. Env is snapshotted/restored around each test so ports/paths don't leak.
 */

const POSIX = process.platform !== "win32";

const ENV_KEYS = [
  "GODOT_PROJECT",
  "GODOT_BIN",
  "BREAKPOINT_BRIDGE_PORT",
  "BREAKPOINT_RUNTIME_PORT",
  "GODOT_LSP_PORT",
  "GODOT_DAP_PORT",
];

let saved: Record<string, string | undefined> = {};
function snapshotEnv(): void {
  saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
}
function restoreEnv(): void {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

let dir: string;
let projectDir: string;
let fakeGodot: string;

/** Write a minimal Godot project that installs + enables the addon. */
function writeInstalledProject(root: string, enabled: boolean, version = "1.1.0"): void {
  const addonDir = path.join(root, "addons", "breakpoint_mcp");
  fs.mkdirSync(addonDir, { recursive: true });
  fs.writeFileSync(
    path.join(addonDir, "plugin.cfg"),
    `[plugin]\nname="Breakpoint MCP"\nversion="${version}"\nscript="plugin.gd"\n`,
  );
  const enabledLine = enabled
    ? 'enabled=PackedStringArray("res://addons/breakpoint_mcp/plugin.cfg")'
    : "enabled=PackedStringArray()";
  fs.writeFileSync(
    path.join(root, "project.godot"),
    `config_version=5\n\n[application]\n\nconfig/name="fixture"\n\n[editor_plugins]\n\n${enabledLine}\n`,
  );
}

before(() => {
  if (!POSIX) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "bpmcp-doctor-"));
  projectDir = path.join(dir, "project");
  writeInstalledProject(projectDir, true);
  fakeGodot = path.join(dir, "fakegodot.sh");
  fs.writeFileSync(
    fakeGodot,
    ['#!/bin/sh', 'if [ "$1" = "--version" ]; then echo "4.7.stable.fixture"; fi', "exit 0", ""].join("\n"),
    { mode: 0o755 },
  );
});

after(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * Start N loopback servers. The first two stand in for the editor and runtime
 * bridges, which speak OUR line protocol, so they must answer `ping` — doctor
 * now proves the far end is a Breakpoint bridge rather than merely a listening
 * socket. The rest (LSP/DAP) just accept and hold, which is all doctor probes.
 */
async function startBridges(n: number): Promise<TcpServer[]> {
  const servers: TcpServer[] = [];
  for (let i = 0; i < n; i++) {
    servers.push(i < 2 ? await startPingableBridge() : await startTcpServer(() => {}));
  }
  return servers;
}

/** A loopback server that answers the bridge `ping` (and ignores the auth line). */
async function startPingableBridge(): Promise<TcpServer> {
  return startTcpServer((sock) => {
    let buf = "";
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        let req: { id?: string; method?: string };
        try {
          req = JSON.parse(line) as { id?: string; method?: string };
        } catch {
          continue;
        }
        if (!req.id) continue; // the auth frame carries no id
        sock.write(JSON.stringify({ id: req.id, ok: true, result: {} }) + "\n");
      }
    });
  });
}

/** A socket that accepts and then says nothing — a foreign process on the port. */
async function startMuteServer(): Promise<TcpServer> {
  return startTcpServer(() => {});
}
async function closeAll(servers: TcpServer[]): Promise<void> {
  await Promise.all(servers.map((s) => s.close()));
}
/** A port that was bound then released — reliably closed for a refusal test. */
async function closedPort(): Promise<number> {
  const s = await startTcpServer(() => {});
  const p = s.port;
  await s.close();
  return p;
}

const status = (r: { checks: Array<{ name: string; status: string }> }, name: string) =>
  r.checks.find((c) => c.name === name)?.status;

test("isPluginEnabled detects the enabled plugin, ignores others / missing section", () => {
  const enabled =
    '[editor_plugins]\n\nenabled=PackedStringArray("res://addons/other/plugin.cfg", "res://addons/breakpoint_mcp/plugin.cfg")\n';
  assert.equal(isPluginEnabled(enabled), true);
  const otherOnly = '[editor_plugins]\n\nenabled=PackedStringArray("res://addons/other/plugin.cfg")\n';
  assert.equal(isPluginEnabled(otherOnly), false);
  assert.equal(isPluginEnabled('[application]\n\nconfig/name="x"\n'), false);
  // The res path must be inside [editor_plugins], not just anywhere in the file.
  const wrongSection =
    '[application]\n\nconfig/icon="res://addons/breakpoint_mcp/plugin.cfg"\n\n[editor_plugins]\n\nenabled=PackedStringArray()\n';
  assert.equal(isPluginEnabled(wrongSection), false);
});

test("all checks pass against a fully-set-up install", { skip: !POSIX }, async () => {
  snapshotEnv();
  const servers = await startBridges(4);
  try {
    process.env.GODOT_BIN = fakeGodot;
    process.env.GODOT_PROJECT = projectDir;
    process.env.BREAKPOINT_BRIDGE_PORT = String(servers[0].port);
    process.env.BREAKPOINT_RUNTIME_PORT = String(servers[1].port);
    process.env.GODOT_LSP_PORT = String(servers[2].port);
    process.env.GODOT_DAP_PORT = String(servers[3].port);

    const report = await runDoctorChecks(loadConfig(), {
      timeoutMs: 1000,
      liveLevel: "all",
      includeCsharp: false,
    });

    assert.equal(report.ok, true);
    assert.equal(status(report, "godot-binary"), "ok");
    assert.equal(status(report, "addon-installed"), "ok");
    assert.equal(status(report, "addon-enabled"), "ok");
    for (const b of ["editor-bridge", "runtime-bridge", "gdscript-lsp", "gdscript-dap"]) {
      assert.equal(status(report, b), "ok", `${b} should be reachable`);
    }
  } finally {
    await closeAll(servers);
    restoreEnv();
  }
});

/**
 * The blind spot this closes: `probeTcp` proves only that SOMETHING accepts on
 * the port. It never speaks the protocol and never touches the shared secret,
 * so a foreign process squatting on 9080 — a second Godot, a stale editor, an
 * unrelated server — reported "editor-bridge reachable" while every real call
 * failed. A stale secret looked identical. Session 140 lost a cycle to exactly
 * this class of "the check is green and nothing works".
 *
 * Against the pre-fix doctor this test FAILS: the mute server accepts the
 * connection, probeTcp returns true, and the check reports ok.
 */
test("a port held by something that is not the bridge fails --require-live", { skip: !POSIX }, async () => {
  snapshotEnv();
  const mute = await startMuteServer();
  const others = await startBridges(4);
  try {
    process.env.GODOT_BIN = fakeGodot;
    process.env.GODOT_PROJECT = projectDir;
    process.env.BREAKPOINT_BRIDGE_PORT = String(mute.port); // squatter
    process.env.BREAKPOINT_RUNTIME_PORT = String(others[1].port);
    process.env.GODOT_LSP_PORT = String(others[2].port);
    process.env.GODOT_DAP_PORT = String(others[3].port);

    const report = await runDoctorChecks(loadConfig(), {
      timeoutMs: 400,
      liveLevel: "all",
      includeCsharp: false,
    });

    assert.equal(status(report, "editor-bridge"), "fail", "an open port that never answers is not a live bridge");
    assert.equal(report.ok, false, "--require-live must not pass on a squatted port");
    const check = report.checks.find((c) => c.name === "editor-bridge");
    assert.match(check?.detail ?? "", /open, but no Breakpoint bridge answered/);
    assert.match(check?.hint ?? "", /stale/i, "the hint must name the stale-secret cause too");
    // The runtime bridge answered, so it must still be ok — this failure is
    // per-bridge, not a blanket downgrade of every live check.
    assert.equal(status(report, "runtime-bridge"), "ok");
  } finally {
    await mute.close();
    await closeAll(others);
    restoreEnv();
  }
});

test("an unreachable bridge fails the report under --require-live", { skip: !POSIX }, async () => {
  snapshotEnv();
  const servers = await startBridges(3);
  const dead = await closedPort();
  try {
    process.env.GODOT_BIN = fakeGodot;
    process.env.GODOT_PROJECT = projectDir;
    process.env.BREAKPOINT_BRIDGE_PORT = String(servers[0].port);
    process.env.BREAKPOINT_RUNTIME_PORT = String(servers[1].port);
    process.env.GODOT_LSP_PORT = String(servers[2].port);
    process.env.GODOT_DAP_PORT = String(dead);

    const report = await runDoctorChecks(loadConfig(), {
      timeoutMs: 800,
      liveLevel: "all",
      includeCsharp: false,
    });
    assert.equal(status(report, "gdscript-dap"), "fail");
    assert.equal(report.ok, false);
  } finally {
    await closeAll(servers);
    restoreEnv();
  }
});

test("unreachable bridges are informational (report still ok) without --require-live", { skip: !POSIX }, async () => {
  snapshotEnv();
  const dead = await closedPort();
  try {
    process.env.GODOT_BIN = fakeGodot;
    process.env.GODOT_PROJECT = projectDir;
    // Point every bridge at closed ports; at liveLevel "none" they are info-only.
    process.env.BREAKPOINT_BRIDGE_PORT = String(dead);
    process.env.BREAKPOINT_RUNTIME_PORT = String(dead);
    process.env.GODOT_LSP_PORT = String(dead);
    process.env.GODOT_DAP_PORT = String(dead);

    const report = await runDoctorChecks(loadConfig(), {
      timeoutMs: 500,
      liveLevel: "none",
      includeCsharp: false,
    });
    assert.equal(status(report, "editor-bridge"), "fail");
    // Only godot-binary + addon checks are required here, and those pass.
    assert.equal(report.ok, true);
  } finally {
    restoreEnv();
  }
});

test("a missing addon fails the required addon-installed check", { skip: !POSIX }, async () => {
  snapshotEnv();
  const bare = path.join(dir, "bare");
  fs.mkdirSync(bare, { recursive: true });
  fs.writeFileSync(path.join(bare, "project.godot"), 'config_version=5\n\n[application]\n\nconfig/name="bare"\n');
  try {
    process.env.GODOT_BIN = fakeGodot;
    process.env.GODOT_PROJECT = bare;
    const report = await runDoctorChecks(loadConfig(), {
      timeoutMs: 300,
      liveLevel: "none",
      includeCsharp: false,
    });
    assert.equal(status(report, "addon-installed"), "fail");
    assert.equal(status(report, "addon-enabled"), "fail");
    assert.equal(report.ok, false);
  } finally {
    restoreEnv();
  }
});

test("a missing Godot binary fails the required godot-binary check", { skip: !POSIX }, async () => {
  snapshotEnv();
  try {
    process.env.GODOT_BIN = "/no/such/godot-binary-xyz";
    process.env.GODOT_PROJECT = projectDir;
    const report = await runDoctorChecks(loadConfig(), {
      timeoutMs: 300,
      liveLevel: "none",
      includeCsharp: false,
    });
    assert.equal(status(report, "godot-binary"), "fail");
    assert.equal(report.ok, false);
  } finally {
    restoreEnv();
  }
});

test("runDoctor returns exit 0 and emits valid JSON when everything is up", { skip: !POSIX }, async () => {
  snapshotEnv();
  const servers = await startBridges(4);
  const origWrite = process.stdout.write.bind(process.stdout);
  let out = "";
  try {
    process.env.GODOT_BIN = fakeGodot;
    process.env.BREAKPOINT_BRIDGE_PORT = String(servers[0].port);
    process.env.BREAKPOINT_RUNTIME_PORT = String(servers[1].port);
    process.env.GODOT_LSP_PORT = String(servers[2].port);
    process.env.GODOT_DAP_PORT = String(servers[3].port);
    (process.stdout as unknown as { write: (c: string | Uint8Array) => boolean }).write = (
      chunk: string | Uint8Array,
    ) => {
      out += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    };
    // --project routes into GODOT_PROJECT inside runDoctor.
    const code = await runDoctor(["--json", "--require-live", "--project", projectDir]);
    (process.stdout as unknown as { write: typeof origWrite }).write = origWrite;
    assert.equal(code, 0);
    const parsed = JSON.parse(out) as { ok: boolean; checks: unknown[] };
    assert.equal(parsed.ok, true);
    assert.ok(Array.isArray(parsed.checks) && parsed.checks.length >= 7);
  } finally {
    (process.stdout as unknown as { write: typeof origWrite }).write = origWrite;
    await closeAll(servers);
    restoreEnv();
  }
});

/**
 * 🔴 THE ONE THE DOCUMENTATION TELLS EVERY NEW USER TO RUN.
 *
 * `docs/USER_GUIDE.md` §3.0, `README.md` and `init`'s own closing line all say:
 * open the project in Godot, then run `doctor --require-live` to verify. Opening
 * the editor brings up three bridges. The fourth — the runtime bridge on 9081 —
 * lives inside the RUNNING GAME, which nobody has been told to launch. So the
 * documented verification step exited 1 on a completely correct install, and
 * told the reader their setup was broken in the one place they had gone to find
 * out whether it was.
 */
test("--require-live passes with the editor open and the game not running", { skip: !POSIX }, async () => {
  snapshotEnv();
  const servers = await startBridges(4);
  const dead = await closedPort();
  try {
    process.env.GODOT_BIN = fakeGodot;
    process.env.GODOT_PROJECT = projectDir;
    process.env.BREAKPOINT_BRIDGE_PORT = String(servers[0].port);
    process.env.BREAKPOINT_RUNTIME_PORT = String(dead); // the game is not running
    process.env.GODOT_LSP_PORT = String(servers[2].port);
    process.env.GODOT_DAP_PORT = String(servers[3].port);

    const report = await runDoctorChecks(loadConfig(), {
      timeoutMs: 800,
      liveLevel: "editor",
      includeCsharp: false,
    });

    assert.equal(report.ok, true, "an editor-only install must not exit 1 on the documented command");
    assert.equal(status(report, "runtime-bridge"), "fail", "it is still down, and still reported");
    assert.equal(
      report.checks.find((c) => c.name === "runtime-bridge")?.severity,
      "info",
      "down but not disqualifying — the distinction the flag was missing",
    );
    for (const b of ["editor-bridge", "gdscript-lsp", "gdscript-dap"]) {
      assert.equal(status(report, b), "ok", `${b} is what opening the editor brings up`);
      assert.equal(report.checks.find((c) => c.name === b)?.severity, "required");
    }
  } finally {
    await closeAll(servers);
    restoreEnv();
  }
});

/**
 * 🔴 THE POSITIVE CONTROL, AND IT IS THE BEHAVIOUR AS IT SHIPPED THROUGH 251.
 * A "fix" that simply demoted every bridge to informational would pass the test
 * above for the same reason a correct one does. `=all` is the old contract,
 * asserted against the identical fixture: same ports, same dead runtime, and it
 * must still fail.
 */
test("--require-live=all still fails on the same tree — the old contract, kept", { skip: !POSIX }, async () => {
  snapshotEnv();
  const servers = await startBridges(4);
  const dead = await closedPort();
  try {
    process.env.GODOT_BIN = fakeGodot;
    process.env.GODOT_PROJECT = projectDir;
    process.env.BREAKPOINT_BRIDGE_PORT = String(servers[0].port);
    process.env.BREAKPOINT_RUNTIME_PORT = String(dead);
    process.env.GODOT_LSP_PORT = String(servers[2].port);
    process.env.GODOT_DAP_PORT = String(servers[3].port);

    const all = await runDoctorChecks(loadConfig(), { timeoutMs: 800, liveLevel: "all", includeCsharp: false });
    assert.equal(all.ok, false, "=all is the four-bridge assertion and the fourth is down");

    // ...and the mirror level: the game's bridge required, the editor's not.
    const runtime = await runDoctorChecks(loadConfig(), {
      timeoutMs: 800,
      liveLevel: "runtime",
      includeCsharp: false,
    });
    assert.equal(runtime.ok, false);
    assert.equal(runtime.checks.find((c) => c.name === "runtime-bridge")?.severity, "required");
    assert.equal(runtime.checks.find((c) => c.name === "editor-bridge")?.severity, "info");
  } finally {
    await closeAll(servers);
    restoreEnv();
  }
});

/** Every level names exactly the bridges it says it does — the table, not a branch. */
test("severityFor pins which tier each level requires", () => {
  assert.equal(severityFor("none", "editor"), "info");
  assert.equal(severityFor("none", "runtime"), "info");
  assert.equal(severityFor("editor", "editor"), "required");
  assert.equal(severityFor("editor", "runtime"), "info");
  assert.equal(severityFor("runtime", "runtime"), "required");
  assert.equal(severityFor("runtime", "editor"), "info");
  assert.equal(severityFor("all", "editor"), "required");
  assert.equal(severityFor("all", "runtime"), "required");
});

test("parseLiveLevel reads both forms and refuses a level it does not have", () => {
  assert.equal(parseLiveLevel(undefined), "none");
  assert.equal(parseLiveLevel(false), "none");
  // Bare `--require-live` is the editor's three — the documented instruction.
  assert.equal(parseLiveLevel(true), "editor");
  assert.equal(parseLiveLevel("editor"), "editor");
  assert.equal(parseLiveLevel("runtime"), "runtime");
  assert.equal(parseLiveLevel("ALL"), "all");
  // 🔴 A VALUE IT DOES NOT KNOW IS AN ERROR, NOT A DEFAULT. Silently reading
  // `--require-live=yes` as "editor" is a flag that agrees with whatever you
  // typed and then asserts something else.
  for (const bad of ["yes", "true", "1", "none", "editor,runtime"]) {
    const got = parseLiveLevel(bad);
    assert.notEqual(typeof got, "string", `--require-live=${bad} must not resolve to a level`);
    assert.match((got as { error: string }).error, /is not a level/);
  }
});

/**
 * 🔴 FOUR ✗ AND THEN "All required checks passed." Both halves were true. Read
 * together they are a tool whose job is telling a user whether they are okay
 * saying two different things and leaving them to pick.
 */
test("the summary line does not contradict the glyphs above it", { skip: !POSIX }, async () => {
  snapshotEnv();
  const dead = await closedPort();
  try {
    process.env.GODOT_BIN = fakeGodot;
    process.env.GODOT_PROJECT = projectDir;
    // Pin the bundled addon to the fixture project's own version so the four rows
    // under test are the four BRIDGES. Without this the comparison is against
    // whatever the tree ships and the count moves every time the addon is cut.
    const matched = path.join(dir, "bundled-matched");
    fs.mkdirSync(matched, { recursive: true });
    fs.writeFileSync(path.join(matched, "plugin.cfg"), '[plugin]\nname="x"\nversion="1.1.0"\n');
    process.env.BREAKPOINT_ADDON_SRC = matched;
    for (const k of ["BREAKPOINT_BRIDGE_PORT", "BREAKPOINT_RUNTIME_PORT", "GODOT_LSP_PORT", "GODOT_DAP_PORT"]) {
      process.env[k] = String(dead);
    }
    const report = await runDoctorChecks(loadConfig(), { timeoutMs: 500, liveLevel: "none", includeCsharp: false });
    assert.equal(report.ok, true);

    const line = summaryLine(report);
    assert.match(line, /4 informational check\(s\) did not/, "the count the old line left out");
    assert.match(line, /editor-bridge/, "and which ones");
    assert.match(line, /--require-live/, "and how to make them count");

    // 🆕 259 — THE SAME DEFECT, ONE POPULATION LATER. That explanation was true of
    // every informational check while every informational check was a bridge.
    // `addon-version` is one that opening the editor does not clear and
    // `--require-live` does not promote, so a single blanket sentence over the set
    // would send a user to restart Godot over a stale addon that would still be
    // stale afterwards. The line splits; both halves keep their own explanation.
    const mixed = summaryLine({
      ok: true,
      withheld: [],
      liveLevel: "none",
      checks: [
        ...report.checks,
        { name: "addon-version", status: "fail", severity: "info", detail: "older than this host" },
      ],
    });
    assert.match(mixed, /5 informational check\(s\) did not/);
    assert.match(mixed, /editor-bridge[^.]*are expected when the editor or the game is not running/);
    assert.match(mixed, /addon-version will NOT clear by starting anything/);
    assert.notEqual(line, "All required checks passed.", "the sentence that was the whole defect");

    // A clean tree still gets the short sentence — and it is a DIFFERENT one.
    assert.equal(summaryLine({ checks: report.checks.filter((c) => c.status !== "fail"), ok: true, withheld: [], liveLevel: "none" }), "All checks passed.");
    // A required failure keeps its own wording, unchanged.
    assert.match(summaryLine({ checks: report.checks, ok: false, withheld: [], liveLevel: "none" }), /Some required checks failed/);
  } finally {
    delete process.env.BREAKPOINT_ADDON_SRC;
    restoreEnv();
  }
});

test("runDoctor exits 2 on a --require-live level it does not have", { skip: !POSIX }, async () => {
  snapshotEnv();
  const origErr = process.stderr.write.bind(process.stderr);
  let err = "";
  try {
    process.env.GODOT_BIN = fakeGodot;
    (process.stderr as unknown as { write: (c: string | Uint8Array) => boolean }).write = (c) => {
      err += typeof c === "string" ? c : Buffer.from(c).toString("utf8");
      return true;
    };
    const code = await runDoctor(["--require-live=sometimes", "--project", projectDir]);
    (process.stderr as unknown as { write: typeof origErr }).write = origErr;
    assert.equal(code, 2);
    assert.match(err, /--require-live=sometimes is not a level/);
    assert.match(err, /--require-live=all/, "the message must name the levels it does have");
  } finally {
    (process.stderr as unknown as { write: typeof origErr }).write = origErr;
    restoreEnv();
  }
});

/**
 * 🔴 THE GREEN LINE THAT CARRIED THE NUMBER PROVING IT SHOULD BE RED (258 §2).
 * `checkAddon` regexed `version=` out of the project's `plugin.cfg`, interpolated
 * it into the detail string, and hardcoded `status: "ok"` in that branch — measured
 * live against a 1.75.0 host: `✓ addon-installed addons/breakpoint_mcp (version
 * 1.9.9)`. Every fact needed to red it was in scope; nothing compared them.
 */
test("doctor reds an addon older than the one this host ships", { skip: !POSIX }, async () => {
  snapshotEnv();
  const src = path.join(dir, "bundled-1100");
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, "plugin.cfg"), '[plugin]\nname="x"\nversion="1.10.0"\n');
  const proj = path.join(dir, "skewed-project");
  writeInstalledProject(proj, true, "1.9.9");
  try {
    process.env.GODOT_BIN = fakeGodot;
    process.env.GODOT_PROJECT = proj;
    process.env.BREAKPOINT_ADDON_SRC = src;
    const report = await runDoctorChecks(loadConfig(), { timeoutMs: 200, liveLevel: "none", includeCsharp: false });
    assert.equal(status(report, "addon-installed"), "ok");
    assert.equal(status(report, "addon-version"), "fail");
    const c = report.checks.find((x) => x.name === "addon-version");
    assert.match(c?.detail ?? "", /1\.9\.9/);
    assert.match(c?.hint ?? "", /--force/);
    // 🔴 AND THE EXIT CODE IS UNMOVED, ON PURPOSE. 252 spent a row fixing
    // `--require-live` because it exited 1 on a correct install; an addon a release
    // behind answers almost everything, so this is REPORTED and does not fail a
    // pre-flight that other tooling gates on.
    assert.equal(report.ok, true);
    assert.equal(c?.severity, "info");
  } finally {
    delete process.env.BREAKPOINT_ADDON_SRC;
    restoreEnv();
  }
});

test("doctor calls a matching addon a match, and an ahead one ahead", { skip: !POSIX }, async () => {
  snapshotEnv();
  const src = path.join(dir, "bundled-190");
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, "plugin.cfg"), '[plugin]\nname="x"\nversion="1.9.0"\n');
  const same = path.join(dir, "same-project");
  writeInstalledProject(same, true, "1.9.0");
  const ahead = path.join(dir, "ahead-project");
  writeInstalledProject(ahead, true, "1.11.0");
  try {
    process.env.GODOT_BIN = fakeGodot;
    process.env.BREAKPOINT_ADDON_SRC = src;
    process.env.GODOT_PROJECT = same;
    const a = await runDoctorChecks(loadConfig(), { timeoutMs: 200, liveLevel: "none", includeCsharp: false });
    assert.equal(status(a, "addon-version"), "ok");
    // 🔴 `newer` IS NOT FOLDED INTO `older`. A contributor running the repo addon
    // against an older published host would be told to overwrite the newer copy.
    process.env.GODOT_PROJECT = ahead;
    const b = await runDoctorChecks(loadConfig(), { timeoutMs: 200, liveLevel: "none", includeCsharp: false });
    assert.equal(status(b, "addon-version"), "ok");
    assert.doesNotMatch(b.checks.find((x) => x.name === "addon-version")?.hint ?? "", /--force/);
  } finally {
    delete process.env.BREAKPOINT_ADDON_SRC;
    restoreEnv();
  }
});

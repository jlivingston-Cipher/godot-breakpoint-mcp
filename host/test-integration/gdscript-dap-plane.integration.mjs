// GDScript DAP plane GATE — asserts all fifteen `dbg_*` tools against a REAL Godot
// editor Debug Adapter (:6006). Every claim below FAILS THE JOB; nothing here is
// log-only. Grep-able markers: GD_DAP_CAPS / GD_DAP_PHANTOM / GD_DAP_NOSESSION /
// GD_DAP_SOURCE / GD_DAP_ENTRY / GD_DAP_LIVE.
//
// 🔴 WHY THIS IS A SEPARATE JOB AND NOT A STEP IN `dap-plane`. 156 §2's rule is
// "check where the assertion lands". `csharp-plane` carries no `continue-on-error`,
// so #164 and #166 could land their gates as STEPS inside it. `dap-plane` DOES carry
// `continue-on-error: true` by design — it is an experimental probe of a novel live
// adapter and must never block a merge. A strict assertion added there would be
// silently optional, which is the exact failure 1.35.0 and 1.36.0 were about. So this
// is its own REQUIRED job, and `dap-plane` keeps its two log-only probes unchanged.
//
// 🔴 WHY IT NEEDS NO Xvfb. `dap-plane` boots `--editor` under Xvfb with software GL
// because its probes RUN THE GAME. `godot --headless --editor` serves the Debug
// Adapter on 6006 just the same (measured), and every assertion here is about what
// the HOST does with the adapter's answers, so the gate is display-free and cheap.
//
// Requires: a headless editor already up on the project at GODOT_PROJECT.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { DapClient } from "../dist/dap.js";
import { loadConfig } from "../dist/config.js";
import { registerDapTools } from "../dist/tools/dap.js";

// 🔴 A launch/attach the adapter rejects used to be an UNHANDLED REJECTION, which
// Node terminates the process for. Fail loudly rather than let an exit code 1 be
// mistaken for an assertion failure — and prove the crash is gone.
let crashed = null;
process.on("unhandledRejection", (e) => { crashed = `unhandledRejection ${e?.command ?? ""}: ${e?.message ?? e}`; });
process.on("uncaughtException", (e) => { crashed = `uncaughtException: ${e?.message ?? e}`; });

const cfg = loadConfig();
const ROOT = fs.realpathSync(cfg.projectPath);
console.log(`GD_DAP target ${cfg.dapHost}:${cfg.dapPort}  project=${ROOT}`);

let failures = 0;
function check(cond, marker, detail) {
  if (cond) { console.log(`  ok   ${marker} — ${detail}`); return true; }
  console.log(`  FAIL ${marker} — ${detail}`);
  failures++;
  return false;
}

function newClient(projectPath = cfg.projectPath) {
  const dap = new DapClient(cfg.dapHost, cfg.dapPort, 15000);
  const tools = new Map();
  registerDapTools(
    { registerTool: (n, c, h) => tools.set(n, { c, h }), registerResource: () => {}, server: { elicitInput: async () => ({ action: "accept", content: {} }) } },
    dap,
    { ...cfg, projectPath },
  );
  // 🔴 Validate through the zod schema the real MCP server applies: a handler pulled
  // out of a recording server never sees it, so a schema-level guard would be
  // invisible to this probe (155 §7).
  const call = async (name, args = {}) => {
    const t = tools.get(name);
    if (!t) return { isError: true, content: [{ type: "text", text: `no such tool ${name}` }] };
    let parsed;
    try { parsed = z.object(t.c.inputSchema).parse(args); }
    catch (e) { return { isError: true, content: [{ type: "text", text: `schema refused: ${e.issues?.[0]?.message ?? e.message}` }] }; }
    return t.h(parsed, {});
  };
  return { dap, tools, call };
}

const textOf = (r) => r.content?.[0]?.text ?? "";
const sc = (r) => r.structuredContent ?? {};

/**
 * 🔴 End a live session before starting the next one. The editor serves ONE debug
 * session at a time: closing the socket leaves the game running, and the next
 * launch then races a `terminated` event for the OLD game into the NEW handshake —
 * which lands as `state: "terminated"` and no session. Observed while writing this
 * probe, and it is exactly the flakiness a gate must not have.
 */
async function endSession(dap) {
  try { await dap.request("terminate", {}); } catch { /* best effort */ }
  await new Promise((r) => setTimeout(r, 1500));
  dap.close();
}

// A temp area for fixtures that must live OUTSIDE the project root. Removed in the
// `finally` — nothing is added to `example/`, so the tracked-file count does not move
// and there is no new `.uid` sidecar (the call sessions 155–158 made).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gddap-"));
let live = null;

try {
  // ── 1. surface ────────────────────────────────────────────────────────────────
  const { tools } = newClient();
  const names = [...tools.keys()].filter((n) => n.startsWith("dbg_")).sort();
  check(names.length === 15, "GD_DAP_CAPS", `${names.length} dbg_* tools advertised: ${names.join(" ")}`);

  // ── 2. a launch the adapter REJECTED is reported as one, and does not crash ───
  // Godot answers `wrong_path` when `project` is not the project the editor has
  // open. Before the fix this returned isError:false state:"running" AND killed the
  // process with an unhandled rejection (measured: exit 1).
  {
    const wrong = path.join(tmp, "not-the-open-project");
    fs.mkdirSync(wrong, { recursive: true });
    const { dap, call } = newClient(wrong);
    const r = await call("dbg_launch", { scene: "main", allow_port_conflict: true });
    check(r.isError === true, "GD_DAP_PHANTOM", `a launch the adapter rejected is refused (${textOf(r).slice(0, 80)})`);
    check(/wrong_path/.test(textOf(r)), "GD_DAP_PHANTOM", "the refusal quotes the adapter's own message, not a generic failure");
    check(dap.hasSession === false, "GD_DAP_PHANTOM", `no session is left behind (state=${dap.state})`);
    // …and every follow-up refuses rather than answering from the phantom.
    const st = await call("dbg_stack_trace", {});
    check(st.isError === true && /needs a debug session/.test(textOf(st)), "GD_DAP_PHANTOM", "a follow-up call refuses by reason instead of answering {frames:[]}");
    dap.close();
  }
  // attach with nothing running: Godot answers `not_running` — the same crash path.
  {
    const { dap, call } = newClient();
    const r = await call("dbg_attach", { port: 6099 });
    check(r.isError === true && /not_running/.test(textOf(r)), "GD_DAP_PHANTOM", `attach with nothing running is refused (${textOf(r).slice(0, 60)})`);
    check(dap.hasSession === false, "GD_DAP_PHANTOM", "a refused attach leaves no session");
    dap.close();
  }
  check(crashed === null, "GD_DAP_PHANTOM", `no unhandled rejection / uncaught exception from a rejected launch or attach${crashed ? ` — ${crashed}` : ""}`);

  // ── 3. no session → every tool that needs one refuses BY REASON ──────────────
  {
    const { dap, call } = newClient();
    const cases = [
      ["dbg_continue", {}],
      ["dbg_step", { kind: "over" }],
      ["dbg_stack_trace", {}],
      ["dbg_scopes", { frame_id: 0 }],
      ["dbg_variables", { variables_ref: 1 }],
      ["dbg_watch", { add: ["1+1"] }],
      ["dbg_evaluate", { expression: "1+1", confirm: true }],
      ["dbg_set_variable", { variables_ref: 1, name: "x", value: "1", confirm: true }],
    ];
    for (const [name, args] of cases) {
      const r = await call(name, args);
      check(
        r.isError === true && /needs a debug session/.test(textOf(r)),
        "GD_DAP_NOSESSION",
        `${name} refuses with no session (${textOf(r).slice(0, 46)}…)`,
      );
    }
    // 🔴 The sharpest half: the first such call used to LEAVE the client looking live.
    check(dap.state === "disconnected", "GD_DAP_NOSESSION", `no call fabricated a session state (state=${dap.state})`);
    check(dap.hasSession === false, "GD_DAP_NOSESSION", "hasSession is still false after eight refused calls");
    dap.close();
  }

  // ── 4. breakpoint sources that can never bind ────────────────────────────────
  // 🔴 EVERY FIXTURE BELOW EXISTS ON DISK unless the case under test is "missing",
  // and every assertion is BY REASON. 158 §6: a refusal assertion that only checks
  // isError proves nothing when several guards can refuse the same input — the
  // existence guard silently masked the escape guard in that session's first sweep.
  {
    const { call } = newClient();
    const parent = path.dirname(ROOT);
    // A real file outside the root, and a real file in a SIBLING directory that
    // shares the root's name prefix — the case a bare startsWith(root) would accept.
    const outsideReal = path.join(tmp, "outside_real.gd");
    fs.writeFileSync(outsideReal, "extends Node\n");
    const siblingDir = `${ROOT}_evil`;
    fs.mkdirSync(siblingDir, { recursive: true });
    const siblingReal = path.join(siblingDir, "sibling_real.gd");
    fs.writeFileSync(siblingReal, "extends Node\n");
    const relToSibling = `../${path.basename(siblingDir)}/sibling_real.gd`;

    const ok1 = await call("dbg_set_breakpoints", { path: "res://player.gd", lines: [13] });
    check(ok1.isError !== true && sc(ok1).buffered === true, "GD_DAP_SOURCE", "a real in-project script is still accepted");
    // 🔴 The documented ABSOLUTE in-project form must keep working — two over-eager
    // mutations exist for this line.
    const ok2 = await call("dbg_set_breakpoints", { path: path.join(ROOT, "player.gd"), lines: [13] });
    check(ok2.isError !== true, "GD_DAP_SOURCE", "an absolute path INSIDE the project is still accepted");

    const miss = await call("dbg_set_breakpoints", { path: "res://NoSuchFile.gd", lines: [1] });
    check(miss.isError === true && /no such file/.test(textOf(miss)), "GD_DAP_SOURCE", "a missing script is refused as missing");
    const dir = await call("dbg_set_breakpoints", { path: "res://tests", lines: [1] });
    check(dir.isError === true && /is not a file/.test(textOf(dir)), "GD_DAP_SOURCE", "a DIRECTORY is refused as not-a-file");
    const empty = await call("dbg_set_breakpoints", { path: "", lines: [1] });
    check(empty.isError === true && /is not a file/.test(textOf(empty)) && /project root/.test(textOf(empty)), "GD_DAP_SOURCE", "an empty path is refused, and says it resolved to the project root");
    // Escape cases — each targets a file that GENUINELY EXISTS, so only the escape
    // guard can be what refused it.
    const esc1 = await call("dbg_set_breakpoints", { path: outsideReal, lines: [1] });
    check(esc1.isError === true && /outside the Godot project root/.test(textOf(esc1)), "GD_DAP_SOURCE", "an ABSOLUTE path to a real file outside the root is refused BY REASON");
    const esc2 = await call("dbg_set_breakpoints", { path: relToSibling, lines: [1] });
    check(esc2.isError === true && /outside the Godot project root/.test(textOf(esc2)), "GD_DAP_SOURCE", "a relative path into a sibling dir sharing the root's name prefix is refused BY REASON");
    const esc3 = await call("dbg_set_breakpoints", { path: `res://../${path.basename(siblingDir)}/sibling_real.gd`, lines: [1] });
    check(esc3.isError === true && /outside the Godot project root/.test(textOf(esc3)), "GD_DAP_SOURCE", "a res:// path escaping into that sibling is refused BY REASON");
    check(parent.length > 0, "GD_DAP_SOURCE", `fixtures live beside the root (${parent})`);
    fs.rmSync(siblingDir, { recursive: true, force: true });
  }

  // ── 5. stop_on_entry says which it is ────────────────────────────────────────
  {
    const { dap, call } = newClient();
    const r = await call("dbg_launch", { scene: "main", stop_on_entry: true, allow_port_conflict: true });
    check(r.isError !== true, "GD_DAP_ENTRY", "a launch the adapter accepted is not refused");
    check(typeof sc(r).stop_on_entry_honored === "boolean", "GD_DAP_ENTRY", `stop_on_entry_honored is reported (${sc(r).stop_on_entry_honored})`);
    if (sc(r).stop_on_entry_honored === false) {
      check(typeof sc(r).warning === "string" && sc(r).warning.length > 0, "GD_DAP_ENTRY", "an ignored stop_on_entry carries a warning rather than a bare 'running'");
      check(sc(r).state === "running", "GD_DAP_ENTRY", "…and reports running, which is what is actually true");
    } else {
      check(sc(r).state === "stopped", "GD_DAP_ENTRY", "an honoured stop_on_entry reports stopped");
    }
    await endSession(dap);
  }

  // ── 6. a real session: arm → launch → stop → inspect → step → continue ──────
  {
    live = newClient();
    const { dap, call } = live;
    const stopped = new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 60000);
      timer.unref?.();
      dap.once("stopped", () => { clearTimeout(timer); resolve(true); });
    });
    // Both the one-shot _ready() and the per-frame _process(): a stop lands even if
    // the scene-load one is missed.
    const bp = await call("dbg_set_breakpoints", { path: "res://player.gd", lines: [13, 21] });
    check(bp.isError !== true, "GD_DAP_LIVE", `breakpoints buffered (${JSON.stringify(sc(bp).breakpoints ?? [])})`);
    const launched = await call("dbg_launch", { scene: "main", allow_port_conflict: true });
    check(launched.isError !== true && sc(launched).session_id === "godot", "GD_DAP_LIVE", `launched (state=${sc(launched).state})`);
    check(dap.hasSession === true, "GD_DAP_LIVE", "an accepted launch DOES leave a session");
    const landed = await stopped;
    // 🔴 Refuse to assert on a session that never stopped rather than let the frame /
    // scope claims below pass vacuously.
    if (!check(landed, "GD_DAP_LIVE", `a stop landed (state=${dap.state} reason=${dap.lastStoppedReason})`)) {
      throw new Error("no stop landed — the claims below would be vacuous");
    }
    const st = await call("dbg_stack_trace", {});
    const frames = sc(st).frames ?? [];
    check(st.isError !== true && frames.length > 0, "GD_DAP_LIVE", `stack trace has ${frames.length} frame(s), top=${frames[0]?.name}@${frames[0]?.line}`);
    check(String(frames[0]?.source ?? "").endsWith("player.gd"), "GD_DAP_LIVE", `the top frame is in the script we breakpointed (${frames[0]?.source})`);
    const scopes = await call("dbg_scopes", { frame_id: frames[0]?.id ?? 0 });
    check(scopes.isError !== true && (sc(scopes).scopes ?? []).length > 0, "GD_DAP_LIVE", `scopes: ${(sc(scopes).scopes ?? []).map((s) => s.name).join(",")}`);
    // 🔴 `dbg_evaluate` gets an INVARIANT, not a value. Godot's own adapter answers
    // `success=false message="timeout"` after ~5 s at a `breakpoint` stop while
    // returning "2" for the same expression at a `step` stop — measured, repeatedly,
    // both ways. Asserting `result === "2"` would make this gate flaky by
    // construction, which is 1.36.0's lesson about building on what a plane can
    // assert deterministically. What IS the host's own contract: it never answers a
    // silent success. Either a result comes back, or the adapter's refusal does.
    const ev = await call("dbg_evaluate", { expression: "1+1", confirm: true });
    const evalOk = ev.isError !== true && String(sc(ev).result ?? "") !== "";
    const evalRefused = ev.isError === true && textOf(ev).trim().length > 0 && !/\[\w+\]:\s*$/.test(textOf(ev));
    check(evalOk || evalRefused, "GD_DAP_LIVE", evalOk ? `evaluate 1+1 -> ${sc(ev).result}` : `evaluate refused with a non-empty message (upstream): ${textOf(ev).slice(0, 80)}`);
    const stepped = await call("dbg_step", { kind: "over" });
    check(stepped.isError !== true, "GD_DAP_LIVE", `step over -> state=${sc(stepped).state} reason=${sc(stepped).stopped_reason}`);
    const cont = await call("dbg_continue", {});
    check(cont.isError !== true, "GD_DAP_LIVE", `continue -> state=${sc(cont).state} reason=${sc(cont).stopped_reason}`);
    check(crashed === null, "GD_DAP_LIVE", `still no unhandled rejection anywhere${crashed ? ` — ${crashed}` : ""}`);
  }
} catch (err) {
  // 🔴 THIS CATCH IS THE POINT, and a mutation found its absence. The
  // `uncaughtException` / `unhandledRejection` handlers installed at the top to prove
  // the crash is gone ALSO SWALLOWED THIS FILE'S OWN THROW: the "no stop landed"
  // bail-out escaped the try, the code that sets the exit code became unreachable,
  // and the module rejection was absorbed by the very listener meant to detect a
  // crash. The probe printed six FAIL lines and exited 0 — a log-only gate inside a
  // required job, which is the exact disease 1.35.0 and 1.36.0 were about, rebuilt by
  // accident in the tool meant to prevent it.
  console.log(`  FAIL GD_DAP_FATAL — ${err?.message ?? err}`);
  failures++;
} finally {
  try { if (live?.dap) await endSession(live.dap); } catch { /* best effort */ }
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (crashed) {
  console.log(`  FAIL GD_DAP_CRASH — ${crashed}`);
  failures++;
}
if (failures > 0) {
  console.log(`\nGD_DAP_ALL FAILED — ${failures} claim(s) did not hold`);
  process.exit(1);
}
console.log("\nGD_DAP_ALL ok — every claim held");
process.exit(0);

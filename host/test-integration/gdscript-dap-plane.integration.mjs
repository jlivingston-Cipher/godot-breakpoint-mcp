// GDScript DAP plane GATE — asserts all fifteen `dbg_*` tools against a REAL Godot
// editor Debug Adapter (:6006). Every claim below FAILS THE JOB; nothing here is
// log-only. Grep-able markers: GD_DAP_CAPS / GD_DAP_PHANTOM / GD_DAP_NOSESSION /
// GD_DAP_NOTSTOPPED / GD_DAP_SOURCE / GD_DAP_SCENE / GD_DAP_ENTRY / GD_DAP_LIVE / GD_DAP_GATED /
// GD_DAP_RESTART / GD_DAP_MODIFIERS.
//
// 🔴 THIS IS NOW THE ONLY DAP COVERAGE, AND THE MEASUREMENT THAT EARNED THAT.
// 159 §8.17 proposed deleting the experimental `dap-plane` job on the grounds that its
// D_DAP_* markers "duplicate what the gate logs". Measured against one live 4.7
// adapter, that was FALSE: of the fifteen `dbg_*` tools this gate exercised EIGHT
// live, and the two deleted probes reached all fifteen. Nine things had no counterpart
// here at all — the adapter capability dump, breakpoint `verified` flags, live
// `dbg_variables` / `dbg_watch` / `dbg_set_variable`, `dbg_restart`, the three
// capability-gated tools, the game's console output, and the breakpoint modifiers.
// Every one of them is now a claim in this file rather than a line in a log, which is
// what made deleting the job a subtraction instead of a loss. Sections 7, 8 and 9 and
// the second half of 6 are that port; do not read them as scope creep.
//
// 🔴 WHY THIS IS A SEPARATE JOB — the reasoning that survives `dap-plane`'s deletion.
// 156 §2's rule is "check where the assertion lands". `csharp-plane` carries no
// `continue-on-error`, so #164 and #166 could land their gates as STEPS inside it.
// `dap-plane` DID carry `continue-on-error: true`, so a strict assertion added there
// would have been silently optional — the exact failure 1.35.0 and 1.36.0 were about.
// That is why this was built as its own REQUIRED job rather than a step, and it is why
// the optional job could then be deleted rather than repaired.
//
// 🔴 THE EDITOR IS HEADLESS; ONLY THE GAME IT SPAWNS NEEDS A DISPLAY.
// `godot --headless --editor` serves the Debug Adapter on 6006 just the same, so this
// job skips dap-plane's software-rendered GUI editor boot entirely — the port opens in
// ~4s here against the ~120s that job budgets. Sections 1–5 need no display at all.
// Section 6 does: the editor spawns the game as a child, and a game with no DISPLAY
// exits before it can reach a breakpoint. CI taught that — the first version of this
// job ran fully headless and the live stop never landed — so the workflow wraps the
// step in xvfb-run for the child's sake.
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

// 🆕 278 — THE OBSERVED-CAPABILITY LEDGER, AND IT IS READ RATHER THAN RESTATED.
// `docs/dap_capability_ledger.json` is the one place this tree records what a real
// adapter advertised, per build. This file supplied the typed list that stood in for it
// and got the population wrong in both directions (§ the note beside `capNamesRead`), so
// the list lives there now and check 33 joins it to `host/src` in both directions.
const LEDGER = JSON.parse(fs.readFileSync(
  path.join(import.meta.dirname, "..", "..", "docs", "dap_capability_ledger.json"), "utf8"));

const cfg = loadConfig();
const ROOT = fs.realpathSync(cfg.projectPath);
console.log(`GD_DAP target ${cfg.dapHost}:${cfg.dapPort}  project=${ROOT}`);

let failures = 0;
// 🔴 THE CLAIM POPULATION, COUNTED (169 §4 / 168 §8.5). `failures` was the only number
// this probe kept, and a probe that counts only failures cannot tell "nothing was wrong"
// from "nothing was asked". The whole body sits inside ONE try/catch: a throw in section
// 3 skips sections 4–12, and a conditional that guards a block (`if (anyRef !== null)`)
// removes its claims from the run without leaving a trace. In both cases `failures`
// stays at its old value and the last line still reads "every claim held" — literally
// true of the empty set.
//
// 168 §5 earned this the hard way: deleting a reply field took a suite from 205/205 to a
// perfectly green 200/200 because the claims raised inside their own argument lists. The
// fix there was to compare the mutant's claim TOTAL against a baseline. This is that
// comparison, made permanent and moved into the probe itself.
let claims = 0;
const seen = new Map();
function check(cond, marker, detail) {
  claims++;
  seen.set(marker, (seen.get(marker) ?? 0) + 1);
  if (cond) { console.log(`  ok   ${marker} — ${detail}`); return true; }
  console.log(`  FAIL ${marker} — ${detail}`);
  failures++;
  return false;
}

function newClient(projectPath = cfg.projectPath) {
  const dap = new DapClient(cfg.dapHost, cfg.dapPort, 15000);
  // Console output the launched game produced, via DAP `output` events. The clearest
  // proof that `launch` actually SPAWNED AND RAN a game rather than merely being
  // accepted — player.gd's _ready() prints a line. Ported from the deleted dap-plane
  // probe's D_DAP_OUT, as an assertion rather than a log.
  const output = [];
  dap.on("output", (b) => {
    const line = String(b?.output ?? "").replace(/\s+$/, "");
    if (line) output.push(line);
  });
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
  return { dap, tools, call, output };
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

  // ── 3b. a session that IS live, with the program RUNNING ─────────────────────
  // 🔴 THE OTHER HALF OF SECTION 3, AND THE ONE A UNIT TEST CANNOT ESTABLISH (262 §1).
  // Section 3 proves the tools refuse when no launch happened. This proves what they do
  // when a launch DID happen and the program simply is not at a stop — the state a user
  // is in for every second of a debugging session except the ones they care about. It
  // needs a real adapter because the thing under test is which side answers: measured
  // here before the guard, `dbg_stack_trace` said `{"frames":[]}` in 4ms, `dbg_watch`
  // fabricated `error:"timeout"` after 5s, and `dbg_step`/`dbg_continue` each waited
  // FIFTEEN SECONDS to report `{"state":"running"}`. Eight tools, eight answers, ~48s.
  //
  // Placed BEFORE section 4 arms anything on purpose: no breakpoint has been set in this
  // editor yet, so the launched game cannot reach a stop and the premise is structural
  // rather than a race. It is still asserted rather than assumed.
  {
    const { dap, call } = newClient();
    const launched = await call("dbg_launch", { scene: "main", allow_port_conflict: true });
    check(launched.isError !== true, "GD_DAP_NOTSTOPPED", `a session is live (state=${sc(launched).state})`);
    check(dap.hasSession === true, "GD_DAP_NOTSTOPPED", "the premise: hasSession is TRUE — this is not section 3 again");
    if (!check(dap.isStopped === false, "GD_DAP_NOTSTOPPED", `…and the program is not at a stop (state=${dap.state})`)) {
      throw new Error(`the program stopped with no breakpoint armed (state=${dap.state}) — the claims below would test the wrong state`);
    }
    const cases = [
      ["dbg_continue", {}],
      ["dbg_step", { kind: "over" }],
      ["dbg_stack_trace", {}],
      ["dbg_scopes", { frame_id: 0 }],
      ["dbg_variables", { variables_ref: 1 }],
      ["dbg_evaluate", { expression: "1+1", confirm: true }],
      ["dbg_set_variable", { variables_ref: 1, name: "counter", value: "1", confirm: true }],
      ["dbg_goto", { path: "res://player.gd", line: 13, confirm: true }],
    ];
    for (const [name, args] of cases) {
      const t0 = Date.now();
      const r = await call(name, args);
      const ms = Date.now() - t0;
      check(
        r.isError === true && /needs the program stopped at a breakpoint/.test(textOf(r)),
        "GD_DAP_NOTSTOPPED",
        `${name} refuses a running program (${ms}ms): ${textOf(r).slice(0, 52)}…`,
      );
      // 260's rule — the refusal names the state it READ, not one it assumed.
      check(/the program is (running|initialized)/.test(textOf(r)), "GD_DAP_NOTSTOPPED", `${name} names the state it read`);
      // 🔴 The economic claim, and the only one that would notice the guard being moved
      // BELOW the adapter round trip: the refusal must cost no wait. 5s, 8s and 15s were
      // the measured costs of the three that asked the adapter.
      check(ms < 2000, "GD_DAP_NOTSTOPPED", `${name} refuses without an adapter round trip (${ms}ms)`);
    }
    // dbg_watch is the deliberate exception: the SET still updates, no value is invented,
    // and the entry says which — §10 B's "a watch across stops" keeps working.
    const w = await call("dbg_watch", { add: ["counter"] });
    const entry = (sc(w).watches ?? [])[0];
    check(
      w.isError !== true && entry?.expression === "counter" && entry?.value === "" && /not stopped/.test(String(entry?.error)),
      "GD_DAP_NOTSTOPPED",
      `dbg_watch manages the set and names the reason instead of a value (error=${JSON.stringify(entry?.error)})`,
    );
    await endSession(dap);
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

  // ── 4b. scenes that can never run ────────────────────────────────────────────
  // 🔴 163. `scene` is a path parameter that is not called `path`, which is why 162's
  // sweep reached `dbg_goto` and not this. MEASURED against a real 4.7 adapter before
  // the guard was written: every spelling below answered `ok {"state":"running"}`, and
  // the four escapes left a live SCENELESS game whose `dbg_stack_trace` returned
  // `{"frames":[]}` — byte-identical to a healthy session. Nothing ever escaped; the
  // ANSWER was the defect.
  //
  // 🔴 NOT LAUNCHED, DELIBERATELY. The guard refuses before the port check and before
  // the transport, so this whole section costs no game process and no adapter round
  // trip. That property is the reason it can assert every case rather than the one or
  // two a launching section could afford.
  //
  // 🔴 THE uid:// CARVE-OUT IS UNIT-ONLY AND HERE IS WHY. `uid://<known>` was measured
  // running its scene, so it must stay legal — but `example/` has no uid-bearing scene
  // to point at, and adding one would change the tracked-file count this gate's sibling
  // checks pin. Asserting a uid here would exercise the unknown-uid FALLBACK, not the
  // carve-out. `test/dbg_scene_guard.test.ts` covers it where a fixture is free.
  {
    const { call } = newClient();
    const siblingDir = `${ROOT}_evil`;
    fs.mkdirSync(siblingDir, { recursive: true });
    const siblingScene = path.join(siblingDir, "outside.tscn");
    fs.writeFileSync(siblingScene, "[gd_scene format=3]\n");
    const relToSibling = `../${path.basename(siblingDir)}/outside.tscn`;

    // Escapes — the fixture EXISTS, so only the escape guard can be what refused it.
    for (const [spelling, what] of [
      [siblingScene, "an ABSOLUTE scene in a sibling sharing the root's name prefix"],
      [relToSibling, "a bare relative scene escaping into that sibling"],
      [`res://../${path.basename(siblingDir)}/outside.tscn`, "a res:// scene escaping into that sibling"],
    ]) {
      const r = await call("dbg_launch", { scene: spelling });
      check(
        r.isError === true && /outside the Godot project root/.test(textOf(r)),
        "GD_DAP_SCENE", `${what} is refused BY REASON`,
      );
      // The host's own refusal, never dressed as an adapter failure — the caller must
      // not be sent off to debug a debug adapter that was never asked.
      check(!/^DAP error/.test(textOf(r)), "GD_DAP_SCENE", `${what} is refused as a REFUSAL, not a DAP error`);
    }
    const miss = await call("dbg_launch", { scene: "res://NoSuchScene.tscn" });
    check(miss.isError === true && /no such file/.test(textOf(miss)), "GD_DAP_SCENE", "a missing scene is refused as missing");
    const dir = await call("dbg_launch", { scene: "res://tests" });
    check(dir.isError === true && /is not a file/.test(textOf(dir)), "GD_DAP_SCENE", "a DIRECTORY scene is refused as not-a-file");
    const empty = await call("dbg_launch", { scene: "" });
    check(
      empty.isError === true && /is not a file/.test(textOf(empty)) && /project root/.test(textOf(empty)),
      "GD_DAP_SCENE", "an empty scene is refused, and says it resolved to the project root",
    );

    // 🔴 THE SECOND CALL SITE. `dbg_restart` takes the same `scene`; guarding only
    // `dbg_launch` would leave the plane guarded in name only (§7's standing rule, and
    // 161 §4's clearStaleTab). There is no session here, and the SCENE is still what is
    // named — the guard runs before the session check, so a typo'd scene is not hidden
    // behind "no debug session".
    const rs = await call("dbg_restart", { scene: relToSibling });
    check(
      rs.isError === true && /outside the Godot project root/.test(textOf(rs)),
      "GD_DAP_SCENE", "dbg_restart is wired to the same guard, and names the scene rather than the missing session",
    );

    // …and the sentinels are NOT refused. Cheap to assert, and the thing that would
    // break first if the guard were made over-eager: `main` reaching the port gate or
    // the adapter means it got past the guard.
    const sentinel = await call("dbg_restart", { scene: "main" });
    check(
      sentinel.isError === true && !/outside the Godot project root|no such file|is not a file/.test(textOf(sentinel)),
      "GD_DAP_SCENE", `'main' is not touched by the guard (refused for the real reason: ${textOf(sentinel).slice(0, 48)}…)`,
    );
    fs.rmSync(siblingDir, { recursive: true, force: true });
  }

  // ── 5. stop_on_entry says which it is ────────────────────────────────────────
  {
    const { dap, call } = newClient();
    const r = await call("dbg_launch", { scene: "main", stop_on_entry: true, allow_port_conflict: true });
    check(r.isError !== true, "GD_DAP_ENTRY", "a launch the adapter accepted is not refused");
    // 🔴 WAS `typeof sc(r).stop_on_entry_honored === "boolean"` — 168 §4's tautology
    // VERBATIM, one plane over, found by the mechanical sweep that finding earned
    // (169 §2). Measured on 4.7: the field reads `false`. So the claim was green, and
    // the value it was green for was the negative one — a host that never asked the
    // adapter and hardcoded `false` produced exactly this reading and this OK line.
    //
    // The replacement is a BICONDITIONAL, which is this file's own house style two
    // sections down (GD_DAP_GATED: "the claim is a BICONDITIONAL, so it holds on 4.3
    // and 4.7 alike"). Measured off the sibling rather than invented (168 §3). The
    // report must AGREE WITH THE SESSION: an unhonoured entry did not stop, an
    // honoured one did. A hardcoded field cannot satisfy both halves, because the
    // half it does not control is read from the adapter's own session state.
    const honored = sc(r).stop_on_entry_honored;
    const stoppedAtEntry = sc(r).state === "stopped";
    check(
      (honored === true || honored === false) && honored === stoppedAtEntry,
      "GD_DAP_ENTRY",
      `stop_on_entry_honored AGREES with the session it describes (honored=${honored} state=${sc(r).state})`,
    );
    if (sc(r).stop_on_entry_honored === false) {
      check(typeof sc(r).warning === "string" && sc(r).warning.length > 0, "GD_DAP_ENTRY", "an ignored stop_on_entry carries a warning rather than a bare 'running'");
      // 🔴 NOT `state === "running"`. CI taught this: a game that boots and exits
      // inside the wait window reports `terminated`, which is equally true and
      // equally not-a-stop. The claim under test is that the session did NOT stop —
      // pinning the exact non-stopped state would be asserting the runner's timing.
      check(sc(r).state !== "stopped", "GD_DAP_ENTRY", `…and does not claim a stop (state=${sc(r).state})`);
    } else {
      check(sc(r).state === "stopped", "GD_DAP_ENTRY", "an honoured stop_on_entry reports stopped");
    }
    await endSession(dap);
  }

  // ── 6. a real session: arm → launch → stop → inspect → step → continue ──────
  {
    live = newClient();
    const { dap, call, output } = live;
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

    // ── ported from the deleted dap-plane probe (D_DAP_VAR / PROBE dbg_variables) ──
    // 🔴 `dbg_variables` was previously reachable ONLY in the no-session refusal case,
    // so nothing here ever called it against a live stop. It gets a SHAPE claim, and
    // the first draft of this port got that wrong in a way worth recording: it asserted
    // that a scope ref `dbg_scopes` just handed out is one `dbg_variables` accepts.
    // That reads like a host contract and is not one. Measured on 4.7 at a `_ready`
    // breakpoint stop, the adapter answered `DAP error [variables]: unknown` for the
    // `Locals` and `Members` refs it had itself just issued, while `Globals` worked —
    // and the deleted probe had seen all three succeed at the same stop minutes
    // earlier. That is 159 §8.16, upstream and not reproducible on demand.
    //
    // So the claim is the one the host actually owns, the same one `dbg_evaluate` and
    // `dbg_set_variable` get: the answer is SELF-DESCRIBING either way — the documented
    // shape on success, or a refusal quoting the adapter's own message, never a bare
    // label and never a silent empty success. Contents and success are logged so the
    // build difference stays visible. Asserting the success would have made this gate
    // flaky by construction, which is 159 §6's lesson about over-eager invariants.
    let counter = null;
    let anyRef = null;
    for (const s of sc(scopes).scopes ?? []) {
      if (!s.variables_ref) continue;
      if (anyRef === null) anyRef = s.variables_ref;
      const vars = await call("dbg_variables", { variables_ref: s.variables_ref });
      const selfDescribing = vars.isError === true
        ? textOf(vars).trim().length > 0 && !/\[\w+\]:\s*$/.test(textOf(vars))
        : Array.isArray(sc(vars).variables);
      check(
        selfDescribing,
        "GD_DAP_LIVE",
        vars.isError === true
          ? `dbg_variables refuses self-describingly for '${s.name}' (ref=${s.variables_ref}, upstream): ${textOf(vars).slice(0, 90)}`
          : `dbg_variables answers the documented shape for '${s.name}' (${(sc(vars).variables ?? []).length} var(s): ${(sc(vars).variables ?? []).slice(0, 6).map((v) => v.name).join(", ")})`,
      );
      const hit = (sc(vars).variables ?? []).find((v) => v.name === "counter");
      if (hit) counter = hit.value;
    }
    check(anyRef !== null, "GD_DAP_LIVE", `dbg_scopes handed out at least one variables reference to follow (ref=${anyRef})`);
    console.log(`  note GD_DAP_LIVE — counter=${counter ?? "(not found on this build)"} (logged, not asserted: upstream)`);

    // dbg_watch live: previously refusal-only here too.
    const watch = await call("dbg_watch", { add: ["counter"] });
    const watches = sc(watch).watches ?? [];
    check(
      watch.isError !== true && watches.length === 1 && watches[0].expression === "counter" && "value" in watches[0] && "error" in watches[0],
      "GD_DAP_LIVE",
      `dbg_watch answers the documented shape at a stop (value=${JSON.stringify(watches[0]?.value)} error=${JSON.stringify(watches[0]?.error)})`,
    );

    // 🔴 dbg_set_variable is the sharpest port. Godot ADVERTISES supportsSetVariable=true
    // and then does not answer the request at all — it times out. The host contract is
    // that such a build produces a SELF-DESCRIBING refusal naming the situation, never a
    // hang surfacing as a bare label (this release's D5 sibling on the cs_dbg_* plane).
    // A build that implements it answers the documented shape. Both are legal; silence
    // and a bare `[setVariable]: ` are not.
    // Driven off ANY scope ref, not one that happened to yield `counter`: the claim is
    // about how the host reports an advertised-but-unimplemented request, which does
    // not depend on the ref resolving to anything in particular.
    if (anyRef !== null) {
      const setv = await call("dbg_set_variable", { variables_ref: anyRef, name: "counter", value: "4242", confirm: true });
      const selfDescribing = setv.isError === true
        ? textOf(setv).trim().length > 0 && !/\[\w+\]:\s*$/.test(textOf(setv))
        : sc(setv).name !== undefined && sc(setv).value !== undefined && sc(setv).variables_ref !== undefined;
      check(
        selfDescribing,
        "GD_DAP_LIVE",
        setv.isError === true
          ? `dbg_set_variable refuses self-describingly on an advertised-but-unimplemented build: ${textOf(setv).slice(0, 90)}`
          : `dbg_set_variable answered the documented shape (value=${JSON.stringify(sc(setv).value)})`,
      );
    } else {
      check(false, "GD_DAP_LIVE", "dbg_scopes handed out no variables reference at all — dbg_set_variable could not be reached");
    }
    // 🔴 `dbg_evaluate` gets a SHAPE assertion, not a value, and the reason is worth
    // reading. The same `1+1` at a live stop produces three different answers from
    // Godot depending on build and stop reason — "2" at a `step` stop on 4.7,
    // `success=false message="timeout"` after ~5 s at a `breakpoint` stop on 4.7, and
    // `success` with an EMPTY result on 4.3. All three are upstream; none is the
    // host's to fix, and an empty string is a legitimate value for an expression to
    // have, so refusing it would be over-eager. Asserting a value here would make the
    // gate flaky by construction — 1.36.0's lesson about building only on what a
    // plane can assert deterministically.
    //
    // What IS the host's contract, and what this pins: the answer is self-describing
    // either way. A refusal carries a non-empty message (never the bare label-and-colon
    // this release also fixed); a success carries the full documented shape. The value
    // itself is logged, not asserted, so the 4.3/4.7 difference stays visible.
    const ev = await call("dbg_evaluate", { expression: "1+1", confirm: true });
    const shapeOk =
      ev.isError === true
        ? textOf(ev).trim().length > 0 && !/\[\w+\]:\s*$/.test(textOf(ev))
        : sc(ev).result !== undefined && sc(ev).type !== undefined && sc(ev).variables_ref !== undefined;
    check(
      shapeOk,
      "GD_DAP_LIVE",
      ev.isError === true
        ? `evaluate refused with a non-empty message (upstream): ${textOf(ev).slice(0, 80)}`
        : `evaluate answered the documented shape; result=${JSON.stringify(sc(ev).result)} type=${JSON.stringify(sc(ev).type)}`,
    );
    const stepped = await call("dbg_step", { kind: "over" });
    check(stepped.isError !== true, "GD_DAP_LIVE", `step over -> state=${sc(stepped).state} reason=${sc(stepped).stopped_reason}`);
    const cont = await call("dbg_continue", {});
    check(cont.isError !== true, "GD_DAP_LIVE", `continue -> state=${sc(cont).state} reason=${sc(cont).stopped_reason}`);

    // ── ported: the adapter capability dump (D_DAP_CAPS) ─────────────────────
    // 🔴 NOT the same claim as section 1's GD_DAP_CAPS, which counts fifteen tool
    // NAMES in the host surface. This is what the ADAPTER advertised, and nothing in
    // the gate read it before — yet three tools' behaviour is derived from it, and the
    // modifier fix in this release is derived from it too. A build that answered
    // `initialize` without capabilities would silently disable every feature gate.
    const caps = dap.capabilities;
    // 🔴 WAS `caps !== null && typeof caps === "object"` — vacuous for `{}`, which is
    // EXACTLY the build the comment above warns about (169 §2). Worse, the two CAPS
    // claims were vacuous TOGETHER: the `capNames.every(...)` claim below is satisfied
    // when every key is `undefined`, so an adapter that answered `initialize` with an
    // empty capabilities object passed both, and every feature gate derived from them
    // would have silently read "unsupported" with two green ticks over it.
    //
    // 🔴 NOT a list of REQUIRED capabilities: which ones a build advertises is exactly
    // the thing that varies between 4.3 and 4.7, and pinning them would assert the
    // engine version instead of the handshake. What is asserted is that the handshake
    // brought back a NON-EMPTY object containing at least one key the host's own
    // feature gates read — the minimum that distinguishes "captured" from "empty".
    // Measured on 4.7: supportsRestartRequest / supportsSetVariable /
    // supportsTerminateRequest all true, the other five absent.
    //
    // ── 🆕 278 — THE LIST LEFT THIS FILE, AND BOTH HALVES OF WHY ARE MEASUREMENTS ──
    //
    // 🔴 IT NAMED A CAPABILITY THE HOST GATES ON NOTHING, AND OMITTED ONE IT DOES.
    // `supportsTerminateRequest` appears nowhere in `host/src` — and it is one of the
    // THREE this adapter advertises, so the message below called it a "gate the host
    // reads" and counted 3 where the gates that were actually read number 2.
    // `supportsConfigurationDoneRequest` IS read (`dap.ts`) and was not in the list, so
    // no run has ever observed it: the ledger carries it as `unread`, which is a
    // different fact from `absent` (271 — a reader's silence is not an answer).
    //
    // 🔴 A TYPED LIST OF "WHAT THE HOST READS" IS A COUNT OF WHAT THE LIST CAN SPELL
    // (276), so it is derived now: `gated_on` in the ledger, joined to `host/src` in
    // BOTH directions by contract_check's check 33. This file reads that one file.
    const capNamesRead = LEDGER.gated_on;
    const capsPresent = capNamesRead.filter((k) => caps?.[k] !== undefined);
    check(
      caps !== null && typeof caps === "object" && capsPresent.length > 0,
      "GD_DAP_CAPS",
      `the handshake captured a NON-EMPTY capabilities object naming ${capsPresent.length} gate(s) the host reads (${capsPresent.join(", ") || "none"}) — an empty {} is the silent-disable build`,
    );
    // 🆕 278 — THE `.length` IS A FLOOR AND NOT DECORATION. This list was a LITERAL until
    // this session and is DERIVED now, so `every` over it is satisfied by an empty one —
    // the exact shape `positive_control_gate.mjs` refused on the run that made the change
    // (`PC_UNDEFENDED_EXCESS`, first try). A derived population needs its own floor.
    const capNames = capNamesRead.filter((k) => k !== "exceptionBreakpointFilters");
    check(
      capNames.length >= 8 && capNames.every((k) => caps?.[k] === undefined || typeof caps[k] === "boolean"),
      "GD_DAP_CAPS",
      `all ${capNames.length} (floor 8) advertised capabilities the host gates on are boolean or absent: ${capNames.map((k) => `${k}=${caps?.[k] ?? "-"}`).join(" ")}`,
    );

    // ── 🆕 278 — THE LEDGER JOIN, AND IT IS THE ONLY FALSIFIER THIS FILE HAS ─────────
    //
    // 🔴 EVERY OTHER CAPABILITY CLAIM ABOVE HOLDS ON EITHER SIDE OF THE QUESTION. §7's
    // biconditional says *advertised implies it answers, unadvertised implies it refuses
    // by reason*, which is true whether Godot advertises the capability or not — so a
    // green run has never said WHICH. This is the claim that does: the observed value
    // must be the one `docs/dap_capability_ledger.json` recorded for THIS arm, and a
    // build that starts (or stops) advertising something reddens here naming both values.
    //
    // 🔵 AN `unread` LEDGER ENTRY IS A NOTE AND NEVER A REFUSAL — 271 §1, the same rule
    // the four world-facing readings use. A key nothing has ever observed cannot have a
    // recorded value, and the run that first observes it is the one that supplies it;
    // refusing here would only ever punish the session that closed the gap. Check 33
    // refuses an `unread` key being CITED as the reason a surface is dead, which is the
    // place where not knowing would actually cost something.
    {
      const arm = process.env.GODOT_VERSION ?? "";
      const row = LEDGER.observed[arm];
      check(
        row !== undefined,
        "GD_DAP_LEDGER",
        `the ledger has a row for this arm (GODOT_VERSION=${JSON.stringify(arm)}; rows: ${Object.keys(LEDGER.observed).join(", ")})`,
      );
      for (const k of capNamesRead) {
        const seen = caps?.[k] === undefined ? "absent" : caps[k];
        const want = row?.[k];
        if (want === "unread") {
          check(true, "GD_DAP_LEDGER", `${k}: ledger says unread — OBSERVED HERE AS ${JSON.stringify(seen)}. Write it into docs/dap_capability_ledger.json for ${arm}`);
          continue;
        }
        check(
          JSON.stringify(seen) === JSON.stringify(want),
          "GD_DAP_LEDGER",
          `${k}: observed ${JSON.stringify(seen)} and the ledger records ${JSON.stringify(want)} for ${arm}`,
        );
      }
    }

    // ── ported: breakpoints VERIFIED on a live session (D_DAP_BP) ─────────────
    // 🔴 The gate only ever asserted the BUFFERED answer (`buffered:true`,
    // `breakpoints:[]`), which by construction carries no verified flags — so nothing
    // proved a breakpoint ever actually BOUND. Re-asserting on the live session is the
    // only way to see the adapter's own verdict.
    const rebp = await call("dbg_set_breakpoints", { path: "res://player.gd", lines: [13, 21] });
    const verified = sc(rebp).breakpoints ?? [];
    check(rebp.isError !== true && sc(rebp).buffered === false, "GD_DAP_LIVE", "re-asserting on a live session applies immediately rather than buffering");
    check(
      verified.length === 2 && verified.every((b) => typeof b.verified === "boolean" && typeof b.line === "number"),
      "GD_DAP_LIVE",
      `the adapter's own verified flags come back per line: ${JSON.stringify(verified)}`,
    );
    check(verified.some((b) => b.verified === true), "GD_DAP_LIVE", "at least one breakpoint in a script we stopped inside is VERIFIED by the adapter");

    // ── ported: the game actually ran (D_DAP_OUT / D_DAP_GAME_RAN) ────────────
    // A launch the adapter accepts is not the same as a game that started. player.gd's
    // _ready() prints, so console output is the proof — and it is what distinguishes a
    // real launch from one that died on a GPU-less renderer.
    check(output.length > 0, "GD_DAP_LIVE", `the launched game produced console output (${output.length} line(s), first: ${JSON.stringify(output[0]?.slice(0, 60) ?? "")})`);
    check(crashed === null, "GD_DAP_LIVE", `still no unhandled rejection anywhere${crashed ? ` — ${crashed}` : ""}`);

    // ── 7. every capability-gated tool refuses IFF the adapter lacks the capability ──
    // 🔴 159 §3 found these four "needed nothing" and left them unexercised. That was
    // the evidence against porting #166 mechanically — and it is exactly why they
    // deserve a gate: nothing would notice if a refactor stopped consulting
    // capabilities and started firing the request at an adapter that cannot serve it.
    // The claim is a BICONDITIONAL, so it holds on 4.3 and 4.7 alike and would fail on
    // a build that starts advertising support without the tool noticing.
    // `dbg_set_exception_breakpoints` gates on a NON-EMPTY exceptionBreakpointFilters
    // array rather than a boolean, so its predicate differs in kind from the other two.
    for (const [tool, cap, args, advertised] of [
      ["dbg_goto", "supportsGotoTargetsRequest", { path: "res://player.gd", line: 14 }, caps?.supportsGotoTargetsRequest === true],
      ["dbg_data_breakpoints", "supportsDataBreakpoints", { watch: [{ name: "counter" }] }, caps?.supportsDataBreakpoints === true],
      ["dbg_set_exception_breakpoints", "exceptionBreakpointFilters", {}, Array.isArray(caps?.exceptionBreakpointFilters) && caps.exceptionBreakpointFilters.length > 0],
    ]) {
      const r = await call(tool, { ...args, confirm: true });
      if (advertised) {
        check(r.isError !== true, "GD_DAP_GATED", `${tool}: the adapter advertises ${cap}, so the tool must not refuse as unsupported`);
      } else {
        check(
          r.isError === true && /unsupported|does not advertise|advertises/i.test(textOf(r)),
          "GD_DAP_GATED",
          `${tool}: ${cap} is not advertised, so it refuses BY REASON (${textOf(r).slice(0, 70)})`,
        );
      }
    }

    // ── 8. dbg_restart takes the path the advertised capability implies ───────
    // 🔴 Never exercised by the gate before, and it is the one tool whose behaviour
    // BRANCHES on a capability: a native `restart` request when the adapter advertises
    // supportsRestartRequest, a terminate-and-relaunch fallback when it does not.
    // Asserting the branch matches the advertisement holds on both builds; asserting a
    // re-hit would not — the relaunched game may or may not settle in the window, which
    // is the runner's timing and not the host's contract.
    {
      const rs = await call("dbg_restart", {});
      if (rs.isError === true) {
        check(textOf(rs).trim().length > 0 && !/\[\w+\]:\s*$/.test(textOf(rs)), "GD_DAP_RESTART", `restart refused self-describingly: ${textOf(rs).slice(0, 80)}`);
      } else {
        const expected = caps?.supportsRestartRequest === true ? "restart" : "relaunch";
        check(
          sc(rs).method === expected,
          "GD_DAP_RESTART",
          `restart took the ${sc(rs).method} path, which is the one supportsRestartRequest=${caps?.supportsRestartRequest === true} implies`,
        );
        check(sc(rs).session_id === "godot" && typeof sc(rs).state === "string", "GD_DAP_RESTART", `…and answered the documented shape (state=${sc(rs).state})`);
      }
    }

    // 🔴 END THIS SESSION BEFORE SECTION 9 OPENS ANOTHER, and CI taught it — on the
    // 4.3 arm only. The editor serves ONE debug session at a time (§7's standing
    // gotcha), and section 8's `dbg_restart` deliberately leaves a fresh game running.
    // Without this, section 9's launch is refused and three claims fail for a reason
    // that has nothing to do with what they test. On 4.7 it happened to pass, because
    // the restarted game had already terminated by the time section 9 ran — a timing
    // accident, which is exactly the kind of thing a gate must not depend on.
    await endSession(dap);
    live = null;
  }

  // ── 9. buffered breakpoint modifiers are feature-detected too ───────────────
  // 🔴 THE DEFECT THIS RELEASE FIXES, and the only live assertion of it anywhere.
  // Detection used to run at SET time against capabilities that are null until a
  // session exists — so a modifier buffered BEFORE launch, which is the documented and
  // ordinary way to arm one, skipped detection entirely and went to an adapter that
  // ignores it. Measured on 4.7: `conditions: ["counter < 0"]` (always false) produced
  // no warning and the breakpoint halted on the first frame regardless.
  //
  // This also replaces the deleted `editor-dap-breakpoints` probe, which asked the same
  // question of the ADAPTER and logged the answer. The answer was always "ignored", on
  // every build tried; what actually matters is that the HOST notices and says so, and
  // that is a claim rather than an observation.
  {
    // Tracked in `live` so the finally tears this session down too if a claim throws —
    // the editor serves one session at a time and a leaked one poisons the next run.
    live = newClient();
    const { dap, call } = live;
    const before = await call("dbg_set_breakpoints", {
      path: "res://player.gd", lines: [21],
      conditions: ["counter < 0"], hit_conditions: [">1000000"], log_messages: ["GCB_LOGPOINT {counter}"],
    });
    check(sc(before).buffered === true, "GD_DAP_MODIFIERS", "modifiers set before a session are buffered");
    check(
      sc(before).modifier_detection === "deferred",
      "GD_DAP_MODIFIERS",
      `a buffered modifier reports detection as deferred rather than staying silent (${sc(before).modifier_detection})`,
    );
    check(typeof sc(before).warning === "string" && sc(before).warning.length > 0, "GD_DAP_MODIFIERS", "…and carries a warning saying why it could not be detected");
    check(sc(before).unsupported_modifiers === undefined, "GD_DAP_MODIFIERS", "…and claims no verdict it cannot yet have");

    const launched = await call("dbg_launch", { scene: "main", allow_port_conflict: true });
    // Quote the refusal when it fails: a launch refused here means the previous
    // section left a session open, which is a completely different fault from the
    // modifier reporting under test — and the first CI run said only "not accepted".
    check(
      launched.isError !== true,
      "GD_DAP_MODIFIERS",
      launched.isError === true
        ? `the launch that applies the buffered modifiers was REFUSED: ${textOf(launched).slice(0, 110)}`
        : "the launch that applies the buffered modifiers is accepted",
    );
    const caps = dap.capabilities;
    // The expected set is derived from what THIS adapter advertises, so the claim is
    // the same one on a build that implements the modifiers and on one that does not.
    const expected = [
      ["condition", "supportsConditionalBreakpoints"],
      ["hitCondition", "supportsHitConditionalBreakpoints"],
      ["logMessage", "supportsLogPoints"],
    ].filter(([, capName]) => caps?.[capName] !== true).map(([field]) => field);
    const reported = sc(launched).unsupported_modifiers ?? [];
    check(
      JSON.stringify(reported) === JSON.stringify(expected),
      "GD_DAP_MODIFIERS",
      `dbg_launch reports exactly the modifiers this adapter cannot honour: reported=${JSON.stringify(reported)} expected=${JSON.stringify(expected)}`,
    );
    if (expected.length > 0) {
      check(/halt unconditionally/.test(String(sc(launched).warning ?? "")), "GD_DAP_MODIFIERS", "…and warns that the affected breakpoints halt unconditionally");
    } else {
      check(sc(launched).warning === undefined, "GD_DAP_MODIFIERS", "…and stays silent on a build that honours all three");
    }
    await endSession(dap);
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

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 THE POPULATION GATE. Deliberately OUTSIDE the try/catch and evaluated even when the
// body threw, because the run that shrank the suite is exactly the run that will not
// reach a check placed inside it.
//
// 🔴 A FAMILY MANIFEST, NOT A BARE TOTAL. A single `claims >= N` floor forces a choice
// between catching a lost family and tolerating legitimate build variance: this probe
// takes different arms on 4.3 and 4.7 (`stop_on_entry_honored` true vs false; the three
// claims behind the `anyRef !== null` guard), so a floor tight enough to catch the
// smallest family — GD_DAP_RESTART makes two claims — would false-fail on another build.
// Naming the families removes the trade-off: every family must SPEAK, and how many times
// it speaks is allowed to vary. That is 168 §6's totality gate, transferred here.
//
// Measured on 4.7 (a complete run, session 169): 77 claims across ten families —
// LIVE 21, SCENE 11, NOSESSION 10, SOURCE 9, PHANTOM 7, MODIFIERS 7, ENTRY 4, GATED 3,
// CAPS 3, RESTART 2. 262 adds an eleventh, GD_DAP_NOTSTOPPED, which makes 28: the three
// premise claims plus three per refused tool across eight tools, plus dbg_watch's.
//
// 🔴 EACH GATE ASSERTS ITS OWN SCOPE (168 §6): if this list is ever emptied, the gate
// passes while covering nothing, so its length is checked before its contents.
//
// 🆕 278 — A TWELFTH, `GD_DAP_LEDGER`, AND IT IS THE FIRST FAMILY HERE THAT CAN TELL THE
// TWO SIDES OF A CAPABILITY APART. Ten claims: one that this arm has a ledger row, nine
// comparing an observed capability to the value recorded for it.
const GD_DAP_FAMILIES = [
  "GD_DAP_LIVE", "GD_DAP_SCENE", "GD_DAP_NOSESSION", "GD_DAP_NOTSTOPPED", "GD_DAP_SOURCE",
  "GD_DAP_PHANTOM", "GD_DAP_MODIFIERS", "GD_DAP_ENTRY", "GD_DAP_GATED", "GD_DAP_CAPS",
  "GD_DAP_RESTART", "GD_DAP_LEDGER",
];
// The coarse backstop, kept alongside the manifest: it catches a family that shrank from
// twenty-one claims to one, which the manifest alone cannot see.
// 🆕 278 — 98 -> 108: measured 105 at 0be54af and `GD_DAP_LEDGER` adds ten, so 115 run on
// a healthy tree. The floor keeps 169's margin rather than pinning the live number.
const GD_DAP_CLAIM_FLOOR = 108;

console.log(`\nGD_DAP_CLAIMS ${claims} (floor ${GD_DAP_CLAIM_FLOOR}) across ${seen.size}/${GD_DAP_FAMILIES.length} famil(ies): ${[...seen].map(([m, n]) => `${m}=${n}`).join(" ")}`);

if (GD_DAP_FAMILIES.length < 12) {
  console.log(`  FAIL GD_DAP_POPULATION_SCOPE — the manifest itself has ${GD_DAP_FAMILIES.length} entries; a gate whose scope collapsed passes while covering nothing`);
  failures++;
}
const silent = GD_DAP_FAMILIES.filter((m) => !seen.has(m));
if (silent.length) {
  // 🔴 A SUITE THAT GETS SMALLER IS NOT A SUITE THAT GOT GREENER (168 §5). Without this,
  // a throw in section 3 prints one FAIL and eleven sections silently do not happen —
  // and a conditional that skips a block removes its claims leaving no trace at all.
  console.log(`  FAIL GD_DAP_POPULATION — ${silent.length} famil(ies) never made a claim: ${silent.join(", ")} — they went MISSING rather than failed`);
  failures++;
}
if (claims < GD_DAP_CLAIM_FLOOR) {
  console.log(`  FAIL GD_DAP_POPULATION — only ${claims} claim(s) ran, floor is ${GD_DAP_CLAIM_FLOOR}: a family shrank rather than failed`);
  failures++;
}

if (failures > 0) {
  console.log(`\nGD_DAP_ALL FAILED — ${failures} claim(s) did not hold`);
  process.exit(1);
}
console.log(`\nGD_DAP_ALL ok — every claim held (${claims} claim(s) ran)`);
process.exit(0);

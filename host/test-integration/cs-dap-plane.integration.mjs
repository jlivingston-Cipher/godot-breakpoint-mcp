// C# DAP plane — THE GATE (session 158). Asserts the `cs_dbg_*` tools against a REAL
// netcoredbg and exits non-zero on the first broken claim.
//
// 🔴 Why this exists, and why `csharp-dap.integration.mjs` next door is not enough.
// That probe spawns the same real adapter, but only its `initialize` handshake sets
// `process.exitCode`; everything past `if (reached)` is a try/catch that console.logs,
// and its own header says so ("LOG-ONLY beyond the C#_DAP_REACHED gate"). It sits
// inside `csharp-plane`, which carries NO `continue-on-error` and has been a REQUIRED
// gate since session 25 — the exact shape session 157 fixed one step above it on the
// `cs_*` LSP plane. A required job running a logging probe is exactly as blind as an
// optional job running a strict one. That probe stays as the diagnostic it always was;
// this one is the gate.
//
// 🔴 Why a THROWAWAY .NET program rather than the Godot fixture. What 157's probe could
// assert about OmniSharp needed only files that already existed. A debugger needs a
// process that actually stops, and whether netcoredbg can debug the CoreCLR the Godot
// native host loads is precisely the uncertainty the log-only probe was written around.
// A plain console app makes the live flow DETERMINISTIC and Godot-free — no display
// server, no port, no Mono build — so every claim below is a real assertion instead of
// a best-effort log. It is built into a temp dir and removed in a `finally`: NOTHING is
// added to `example-csharp/`, so check 18's tracked-file count does not move and there
// is no new `.uid` sidecar to commit (the same call sessions 155/156/157 made).
//
// 🔴 And it REFUSES TO ASSERT AGAINST A SESSION THAT NEVER STOPPED. Every claim below
// about frames, scopes and variables is trivially true against a dead session — the
// tools would simply error and a lazy probe would call that "handled". CS_DAP_LIVE_WARM
// exits non-zero if the entry stop never lands, so the assertions underneath it cannot
// pass vacuously. That is the same trap CS_LSP_LIVE_WARM guards on the LSP plane.
//
// Requires netcoredbg via GODOT_CSDAP_CMD and a `dotnet` SDK on PATH.
import { z } from "zod";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { CsDapClient } from "../dist/csdap.js";
import { StdioChannel } from "../dist/stdio.js";
import { loadConfig } from "../dist/config.js";
import { registerCsDapTools } from "../dist/tools/csdap.js";
import { Population } from "./_population.mjs";

let failures = 0;
// 🔴 THE CLAIM POPULATION, COUNTED (169 §10 item 2). The whole body of this probe is
// one try/finally: a throw in section 3 skips sections 4–8, `failures` stays where it
// was, and the run ends `CS_DAP_LIVE_ALL ok every claim held` — true of the empty set.
//
// `claim()` names its assertion in PROSE, not with a marker, so the family unit here
// is the section-closing `CS_DAP_*` line this probe already printed. Two of those did
// not exist (`SURFACE`, `ADAPTER_ERROR`); their claims were previously attributed to
// whichever section happened to close next, so they are printed now rather than left
// to lean on a neighbour.
const population = new Population("CS_DAP", {
  families: [
    "CS_DAP_SURFACE", "CS_DAP_PHANTOM", "CS_DAP_LIVE_STOPPED", "CS_DAP_LIVE_BREAKPOINT",
    "CS_DAP_PATH_ESCAPE", "CS_DAP_MISSING_FILE", "CS_DAP_NOT_A_FILE", "CS_DAP_PATH_LEGAL",
    "CS_DAP_EXC_FILTER", "CS_DAP_ADAPTER_ERROR", "CS_DAP_ATTACH_PID",
  ],
  scope: 11,
  claims: 42,         // measured 44 in CI (this PR). Never runnable locally — needs netcoredbg
});
const claim = (name, cond, detail = "") => {
  population.claim();
  if (cond) console.log(`  ok   ${name}${detail ? ` — ${detail}` : ""}`);
  else { failures++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
};
const die = (marker, why) => {
  console.error(`${marker}: ${why}`);
  process.exit(1);
};

const cfg = loadConfig();
console.log(`C# DAP plane: cmd='${cfg.csDapCmd} ${cfg.csDapArgs.join(" ")}'  project=${cfg.csDapProjectPath}`);

// ---- A throwaway .NET console app, built once, removed in the finally ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bp-csdap-"));
let program = null;
let source = null;
try {
  execFileSync("dotnet", ["new", "console", "-o", tmp, "--force"], { stdio: "pipe" });
  source = path.join(tmp, "Program.cs");
  // Line 12 (`Counter += 1;`) is inside the loop — the surest live breakpoint. Keep
  // this file's line numbering stable; the assertions below name line 12 explicitly.
  fs.writeFileSync(source, [
    "using System;",
    "",
    "class Program",
    "{",
    "    static int Counter = 0;",
    "",
    "    static void Main(string[] args)",
    "    {",
    "        Console.WriteLine(\"start\");",
    "        for (int i = 0; i < 3; i++)",
    "        {",
    "            Counter += 1;",
    "            Console.WriteLine($\"tick {i} counter={Counter}\");",
    "        }",
    "        Console.WriteLine(\"done\");",
    "    }",
    "}",
    "",
  ].join("\n"));
  execFileSync("dotnet", ["build", "-c", "Debug", tmp], { stdio: "pipe" });
  const built = fs.readdirSync(path.join(tmp, "bin", "Debug"), { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => path.join(tmp, "bin", "Debug", d.name));
  program = built.map((d) => path.join(d, path.basename(tmp))).find((p) => fs.existsSync(p)) ?? null;
  // macOS resolves /tmp through /private; netcoredbg reports module paths realpath'd,
  // and a breakpoint set on the un-realpath'd spelling never binds. Not a host defect —
  // but it would make this probe lie, so both paths are canonicalised here.
  if (program) program = fs.realpathSync(program);
  source = fs.realpathSync(source);
  if (!program) die("CS_DAP_FIXTURE", `no built apphost under ${tmp}/bin/Debug`);
  console.log(`CS_DAP_FIXTURE: built ${program}`);

  const newChannel = () =>
    new StdioChannel(cfg.csDapCmd, cfg.csDapArgs, cfg.csDapProjectPath, "C# DAP (netcoredbg)",
      "Is netcoredbg installed and GODOT_CSDAP_CMD set?");

  // Pull the handlers out of a recording server. 🔴 A handler pulled out this way never
  // sees its zod schema, so every call goes through `z.object(inputSchema).parse()`
  // first — otherwise a schema-level fix (`process_id` gaining `.positive()`) is
  // invisible to this probe and its mutation would survive.
  const makeSession = () => {
    const dap = new CsDapClient(newChannel(), 30000);
    const handlers = new Map();
    const schemas = new Map();
    registerCsDapTools({
      registerTool: (name, config, handler) => { handlers.set(name, handler); schemas.set(name, config.inputSchema ?? {}); },
      registerResource: () => {},
      server: { elicitInput: async () => ({ action: "accept", content: { proceed: true } }) },
    }, dap, cfg);
    const call = async (name, args = {}) => {
      let parsed;
      try { parsed = z.object(schemas.get(name)).parse(args); }
      catch (err) { return { isError: true, schemaRejected: true, content: [{ type: "text", text: String(err?.issues?.[0]?.message ?? err) }] }; }
      return handlers.get(name)(parsed, {});
    };
    return { dap, call, tools: [...handlers.keys()] };
  };

  const textOf = (r) => String(r?.content?.[0]?.text ?? "");

  // ---- 1. surface ----------------------------------------------------------
  {
    const { dap, tools } = makeSession();
    console.log(`CS_DAP_CAPS ${tools.length} tools · advertised: ${tools.slice().sort().join(" ")}`);
    claim("every cs_dbg_* tool is registered", tools.length === 13, `${tools.length}`);
    population.seal("CS_DAP_SURFACE", "ok");
    dap.close();
  }

  // ---- 2. THE PHANTOM SESSION — a launch the adapter rejected ----------------
  // netcoredbg answers `launch` success=true and reports the failure on
  // `configurationDone` (0x80070002 = FILE_NOT_FOUND). That response used to be
  // `.catch(() => undefined)`-swallowed, immediately before an unconditional
  // `state = "running"`.
  console.log("\n-- phantom session --");
  for (const [label, prog] of [["a program that does not exist", "/no/such/binary"], ["an empty program path", ""]]) {
    const { dap, call } = makeSession();
    const r = await call("cs_dbg_launch", { program: prog, args: [] });
    claim(`launch with ${label} is an error`, r.isError === true, textOf(r).slice(0, 110));
    claim(`  …and does not report state "running"`, !/"state"\s*:\s*"running"/.test(JSON.stringify(r.structuredContent ?? {})));
    claim(`  …and the session is not left configured`, dap.state !== "running", `state=${dap.state}`);
    dap.close();
  }
  population.seal("CS_DAP_PHANTOM", "ok — a launch the adapter rejected is reported as one");

  // ---- 3. THE LIVE SESSION — and the vacuity gate ---------------------------
  console.log("\n-- live session --");
  const live = makeSession();
  const launched = await live.call("cs_dbg_launch", {
    program, args: [], stop_on_entry: true, just_my_code: false,
  });
  if (launched.isError) die("CS_DAP_LIVE_WARM", `the fixture would not launch: ${textOf(launched)}`);
  // 🔴 THE VACUITY GATE. Everything below asserts about a stopped program. Against a
  // session that never stopped those assertions are trivially satisfiable, so this is
  // fatal rather than a failed claim.
  if (launched.structuredContent?.state !== "stopped") {
    die("CS_DAP_LIVE_WARM", `stop_on_entry did not reach a stopped state (state=${launched.structuredContent?.state}) — ` +
      `every claim below would pass vacuously`);
  }
  if (!(live.dap.lastStoppedThreadId > 0)) {
    die("CS_DAP_LIVE_WARM", `stopped with no thread id — the stack/scope claims below would pass vacuously`);
  }
  // NOT a family: the three lines above are `die()` guards, not claims, so sealing
  // here would drain nothing and fire VACUOUS on a healthy run. Same reason the
  // `_PING` banners on the runtime probes stay out of their manifests.
  console.log(`CS_DAP_LIVE_WARM ok — stopped at entry, thread=${live.dap.lastStoppedThreadId}`);
  claim("stop_on_entry reports stopped, not running", launched.structuredContent.state === "stopped");
  claim("  …and the thread id is the adapter's, not the fallback 1", live.dap.threadId() !== 1,
    `thread=${live.dap.threadId()}`);

  // The whole point of D2: the very next call works, with no sleep in between.
  const stack = await live.call("cs_dbg_stack_trace", {});
  claim("stack_trace immediately after launch succeeds", !stack.isError, textOf(stack).slice(0, 90));
  const frames = stack.structuredContent?.frames ?? [];
  claim("  …and returns a frame in the fixture's source", frames.length > 0 && String(frames[0].source).endsWith("Program.cs"),
    JSON.stringify(frames[0] ?? {}).slice(0, 110));

  const scopes = await live.call("cs_dbg_scopes", { frame_id: frames[0].id });
  claim("scopes on that frame succeeds", !scopes.isError && (scopes.structuredContent?.scopes ?? []).length > 0);
  const ref = scopes.structuredContent.scopes[0].variables_ref;
  const vars = await live.call("cs_dbg_variables", { variables_ref: ref });
  // 🔴 `Array.isArray(…)` IS A TYPE TEST, AND `[]` IS AN ARRAY (172). A scope that came
  // back with NO variables satisfied a claim named "variables under that scope
  // succeeds". Floored the way the `scopes` claim two lines up already floors itself —
  // the file's own idiom, applied to the one claim that had drifted out of it.
  claim("variables under that scope succeeds",
    !vars.isError && (vars.structuredContent?.variables ?? []).length > 0,
    `${(vars.structuredContent?.variables ?? []).length} variable(s): ${JSON.stringify((vars.structuredContent?.variables ?? []).map((v) => v.name)).slice(0, 90)}`);
  const evald = await live.call("cs_dbg_evaluate", { expression: "1+1", confirm: true });
  claim("evaluate in the stopped frame succeeds", !evald.isError && evald.structuredContent?.result === "2",
    JSON.stringify(evald.structuredContent ?? {}).slice(0, 80));
  population.seal("CS_DAP_LIVE_STOPPED", "ok — stack → scopes → variables → evaluate all real");

  // ---- 4. breakpoint bind + hit — the claim the log-only probe never made -----
  const armed = await live.call("cs_dbg_set_breakpoints", { path: source, lines: [12] });
  claim("a breakpoint on a real file is accepted", !armed.isError, textOf(armed).slice(0, 90));
  claim("  …and the adapter VERIFIES it (it is not merely accepted)",
    (armed.structuredContent?.breakpoints ?? []).some((b) => b.line === 12 && b.verified === true),
    JSON.stringify(armed.structuredContent?.breakpoints ?? []));
  const cont = await live.call("cs_dbg_continue", {});
  claim("continue reaches that breakpoint", cont.structuredContent?.state === "stopped" &&
    cont.structuredContent?.stopped_reason === "breakpoint", JSON.stringify(cont.structuredContent ?? {}));
  const atBp = await live.call("cs_dbg_stack_trace", {});
  claim("  …and the top frame is on line 12", (atBp.structuredContent?.frames ?? [])[0]?.line === 12,
    JSON.stringify((atBp.structuredContent?.frames ?? [])[0] ?? {}).slice(0, 110));
  const stepped = await live.call("cs_dbg_step", { kind: "over" });
  claim("step over lands stopped", stepped.structuredContent?.state === "stopped", JSON.stringify(stepped.structuredContent ?? {}));
  population.seal("CS_DAP_LIVE_BREAKPOINT", "ok — armed, verified, hit, stepped");

  // ---- 5. path refusals, and the LEGAL cases that must survive ---------------
  console.log("\n-- breakpoint source paths --");
  // 🔴 The escape target must EXIST, and the refusal must be checked BY REASON.
  // `res://../../../etc/passwd` resolves to a path that happens not to exist here, so
  // the EXISTENCE guard refuses it and a probe that only checks `isError` cannot tell
  // which guard fired — dropping the escape check entirely still looked green. The
  // mutation sweep caught exactly that. `res://../README.md` is the repo README: real,
  // and outside the C# project root.
  const escape = await live.call("cs_dbg_set_breakpoints", { path: "res://../README.md", lines: [1] });
  claim("a res:// path escaping the project root is refused", escape.isError === true, textOf(escape).slice(0, 100));
  claim("  …BY REASON — the escape guard, not the existence guard",
    /outside the C# project root/.test(textOf(escape)), textOf(escape).slice(0, 120));
  claim("  …and the refusal is not dressed as an adapter error", !/^C# DAP error/.test(textOf(escape)));
  population.seal("CS_DAP_PATH_ESCAPE", "ok");

  const missing = await live.call("cs_dbg_set_breakpoints", { path: "res://NoSuchFile.cs", lines: [1] });
  claim("a source that names nothing is refused", missing.isError === true, textOf(missing).slice(0, 100));
  population.seal("CS_DAP_MISSING_FILE", "ok");

  const dir = await live.call("cs_dbg_set_breakpoints", { path: "res://demo", lines: [1] });
  claim("a source that names a DIRECTORY is refused", dir.isError === true, textOf(dir).slice(0, 100));
  const empty = await live.call("cs_dbg_set_breakpoints", { path: "", lines: [1] });
  claim("an empty source path (→ the project root) is refused", empty.isError === true, textOf(empty).slice(0, 100));
  population.seal("CS_DAP_NOT_A_FILE", "ok");

  // 🔴 THE OVER-EAGER SIDE. `cs_dbg_launch` documents debugging a different .NET
  // program, whose sources are outside the Godot project. An ABSOLUTE path elsewhere
  // must stay legal — this fixture's own source is exactly that case, and every
  // assertion in §4 above depends on it.
  const outside = await live.call("cs_dbg_set_breakpoints", { path: source, lines: [12] });
  claim("an ABSOLUTE path outside the project stays legal", !outside.isError, textOf(outside).slice(0, 90));
  const inside = await live.call("cs_dbg_set_breakpoints", { path: "res://Player.cs", lines: [1] });
  claim("a plain res:// path inside the project stays legal", !inside.isError, textOf(inside).slice(0, 90));
  // A sibling directory sharing the root's NAME PREFIX must not pass a bare
  // startsWith(root) — carried from 155 §7 and asserted, not assumed.
  //
  // 🔴 The sibling file is CREATED, and the refusal checked BY REASON. A sibling that
  // does not exist is refused by the existence guard, which made a bare
  // `startsWith(root)` mutation look caught when nothing had caught it.
  const siblingRoot = `${cfg.csDapProjectPath}-sibling`;
  fs.mkdirSync(siblingRoot, { recursive: true });
  fs.writeFileSync(path.join(siblingRoot, "X.cs"), "class X {}\n");
  try {
    const sibling = await live.call("cs_dbg_set_breakpoints", { path: `res://../${path.basename(siblingRoot)}/X.cs`, lines: [1] });
    claim("a sibling dir sharing the root's name prefix is refused", sibling.isError === true, textOf(sibling).slice(0, 100));
    claim("  …BY REASON — the root+sep comparison, not the existence guard",
      /outside the C# project root/.test(textOf(sibling)), textOf(sibling).slice(0, 120));
  } finally {
    fs.rmSync(siblingRoot, { recursive: true, force: true });
  }
  population.seal("CS_DAP_PATH_LEGAL", "ok");

  // ---- 6. exception filters — membership, and the advertised ones -----------
  console.log("\n-- exception filters --");
  const bogusFilter = await live.call("cs_dbg_set_exception_breakpoints", { filters: ["nonsense-filter"] });
  claim("an unadvertised exception filter is refused by name", bogusFilter.isError === true, textOf(bogusFilter).slice(0, 120));
  claim("  …and the refusal lists the real filters", /user-unhandled/.test(textOf(bogusFilter)));
  claim("  …and is not dressed as an adapter error", !/^C# DAP error/.test(textOf(bogusFilter)));
  const realFilter = await live.call("cs_dbg_set_exception_breakpoints", { filters: ["all"] });
  claim("an ADVERTISED filter still works", !realFilter.isError, textOf(realFilter).slice(0, 90));
  const clearFilters = await live.call("cs_dbg_set_exception_breakpoints", {});
  claim("clearing the filters still works", !clearFilters.isError, textOf(clearFilters).slice(0, 90));
  population.seal("CS_DAP_EXC_FILTER", "ok");

  // ---- 7. an adapter failure with NO message ---------------------------------
  const blank = await live.call("cs_dbg_set_variable", { variables_ref: -1, name: "x", value: "1", confirm: true });
  claim("setVariable on a bad ref is an error", blank.isError === true);
  claim("  …and never renders as a bare 'C# DAP error [setVariable]: '",
    !/^C# DAP error \[[a-zA-Z]+\]:\s*$/.test(textOf(blank).trim()), JSON.stringify(textOf(blank)).slice(0, 120));
  // 🔴 The over-eager mirror, in both directions at once. A GENUINE adapter error must
  // keep its own text AND its `C# DAP error [cmd]:` label — a fix that renders every
  // failure as "no message", or that dresses every adapter error as a host refusal,
  // destroys the very distinction the two branches above exist to draw.
  const realErr = await live.call("cs_dbg_evaluate", { expression: "@@@!!", confirm: true });
  claim("a real adapter error keeps its own message", /CS1646|verbatim specifier/.test(textOf(realErr)),
    textOf(realErr).slice(0, 110));
  claim("  …and is still labelled as an adapter error", /^C# DAP error \[/.test(textOf(realErr)));
  live.dap.close();

  // A launch WITHOUT stop_on_entry must not wait for a stop that is never coming.
  {
    const s = makeSession();
    const plain = await s.call("cs_dbg_launch", { program, args: [], just_my_code: false });
    claim("a launch without stop_on_entry reports running, not stopped",
      plain.structuredContent?.state === "running", JSON.stringify(plain.structuredContent ?? {}));
    s.dap.close();
  }
  population.seal("CS_DAP_ADAPTER_ERROR", "ok");

  // ---- 8. attach — the schema, and a pid nothing runs under ------------------
  console.log("\n-- attach --");
  for (const pid of [-1, 0]) {
    const s = makeSession();
    const r = await s.call("cs_dbg_attach", { process_id: pid });
    claim(`attach process_id=${pid} is rejected BY THE SCHEMA`, r.schemaRejected === true, textOf(r).slice(0, 80));
    s.dap.close();
  }
  {
    const s = makeSession();
    const r = await s.call("cs_dbg_attach", { process_id: 999999 });
    claim("attach to a pid nothing runs under is refused", r.isError === true, textOf(r).slice(0, 110));
    claim("  …and the refusal is not dressed as an adapter error", !/^C# DAP error/.test(textOf(r)));
    // The over-eager side: OUR OWN pid exists, so it must reach the adapter rather
    // than being refused as missing. It may still fail to attach — that is the
    // adapter's answer about a non-.NET-debuggable process, not a host refusal.
    const self = await s.call("cs_dbg_attach", { process_id: process.pid });
    claim("attach to a pid that DOES exist is not refused as missing",
      !/no such process/.test(textOf(self)), textOf(self).slice(0, 90));
    s.dap.close();
  }
  population.seal("CS_DAP_ATTACH_PID", "ok");

  // 🔴 THE POPULATION GATE, folded into the same failure count the probe already had.
  failures += population.report().length;
  if (failures) die("CS_DAP_LIVE_ALL", `${failures} claim(s) failed`);
  console.log(`\nCS_DAP_LIVE_ALL ok every claim held (${population.total} claim(s) ran)`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
// netcoredbg's debuggee is a grandchild that can inherit the adapter's stdio pipe and
// keep node alive after the probe is done. Exit explicitly.
process.exit(failures ? 1 : 0);

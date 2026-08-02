// C#/LSP-plane live coverage — the assertions the csharp-plane job never had.
//
// `csharp-lsp.integration.mjs` (which stays) is a DIAGNOSTIC log. Only its
// `initialize` handshake can fail: everything past `if (reached)` is a try/catch
// that console.logs, so `C#_LSP_SEMANTIC_OK: hover=false definition=false` would
// print and the job would stay GREEN. That matters more here than it did on the
// GDScript plane, because `csharp-plane` is a REQUIRED gate whose own header
// comment claims the "OmniSharp cs_* LSP probe ... gate[s] the job". Past the
// handshake, it does not. This file is the gate that makes the claim true.
//
// Same load-bearing design as `lsp-plane.integration.mjs`: the capability
// baseline is DERIVED from the connected server, never pinned to a table, and an
// "unsupported" verdict on a provider the server DID advertise has to be EARNED
// by asking the server for a real -32601 rather than believing the tool.
import fs from "node:fs";
import { z } from "zod";
import { CsLspClient } from "../dist/cslsp.js";
import { StdioChannel } from "../dist/stdio.js";
import { loadConfig } from "../dist/config.js";
import { registerCsLspTools } from "../dist/tools/cslsp.js";
import { Population } from "./_population.mjs";

const cfg = loadConfig();
const channel = new StdioChannel(
  cfg.csLspCmd, cfg.csLspArgs, cfg.csLspProjectPath,
  "C# LSP (OmniSharp)", "Is OmniSharp installed and GODOT_CSLSP_CMD/GODOT_CSHARP_PROJECT set?",
);
const cslsp = new CsLspClient(channel, cfg.csLspProjectUri, 45000);

const handlers = new Map();
const schemas = new Map();
registerCsLspTools({
  registerTool: (name, config, handler) => {
    handlers.set(name, handler);
    schemas.set(name, config?.inputSchema ?? {});
  },
  registerResource: () => {},
  server: { elicitInput: async () => ({ action: "decline" }) },
}, cslsp, cfg);

// A handler pulled straight out of a recording server NEVER SEES ITS zod SCHEMA
// — the real MCP server validates before dispatch. A probe that skips that step
// cannot observe a schema-level fix at all, so every call here is validated the
// way the wire would validate it.
const validate = (name, args) => z.object(schemas.get(name)).parse(args);
const call = async (name, args) => handlers.get(name)(validate(name, args), {});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
// 🔴 THE CLAIM POPULATION, COUNTED (169 §10 item 2) — see `lsp-plane` for the long
// form. `CS_LSP_LIVE_ALL ok every claim held` counted nothing, and this probe has an
// extra way to shrink: everything below `WARM` is skipped when OmniSharp's
// design-time build has not finished, and the run still ends on that sentence.
//
// Excluded from the manifest for the same reason as the GDScript plane: `NO_THROW`
// is an error path, and `DEGRADE` / `NO_RAW_RPC` / `TRAP_EARNED` are earned per
// build. Counted, but never required.
const population = new Population("CS_LSP_LIVE", {
  families: [
    "WARM", "SUPPORTED", "STRUCTURED", "REFUSAL_NOT_LSP_ERROR",
    "PATH_ESCAPE", "PATH_ABSOLUTE", "PATH_SIBLING_PREFIX", "MISSING_FILE",
    "NOT_A_FILE", "RENAME_IDENT", "RENAME_KEYWORD", "NEG_POSITION",
    "RENAME_LEGAL", "PATH_LEGAL", "EMPTY_FILE_OK",
  ],
  scope: 15,
  claims: 62,         // measured 64 in CI (this PR). Never runnable locally — needs OmniSharp
});
const check = (cond, marker, detail) => {
  population.claim(marker);
  if (cond) console.log(`CS_LSP_LIVE_${marker} ok ${detail}`);
  else { failures++; console.log(`CS_LSP_LIVE_${marker} FAIL ${detail}`); }
};

// The provider each tool is gated on. `null` = not a request provider.
const CAP = {
  cs_completion: "completionProvider", cs_hover: "hoverProvider",
  cs_definition: "definitionProvider", cs_references: "referencesProvider",
  cs_rename: "renameProvider", cs_document_symbols: "documentSymbolProvider",
  cs_workspace_symbols: "workspaceSymbolProvider", cs_signature_help: "signatureHelpProvider",
  cs_code_action: "codeActionProvider", cs_diagnostics: null,
};
// The raw LSP method behind each tool, so an "unsupported" verdict can be checked
// against the SERVER rather than believed.
const METHOD = {
  cs_workspace_symbols: ["workspace/symbol", { query: "x" }],
  cs_code_action: ["textDocument/codeAction", null],
};

// Player.cs fixture (0-based), the same anchors the diagnostic probe uses:
// `Counter` property decl at 13:15, `TakeDamage` decl at 26:15, the `Counter`
// use inside TakeDamage at 29:8.
const P = "res://Player.cs";
const ARGS = {
  cs_completion: { path: P, line: 29, character: 8 },
  cs_hover: { path: P, line: 13, character: 15 },
  cs_definition: { path: P, line: 29, character: 8 },
  cs_references: { path: P, line: 13, character: 15 },
  cs_rename: { path: P, line: 13, character: 15, new_name: "Counter2", apply: false },
  cs_document_symbols: { path: P },
  cs_workspace_symbols: { query: "Player" },
  cs_signature_help: { path: P, line: 30, character: 30 },
  cs_code_action: { path: P, start_line: 29, start_character: 0 },
  cs_diagnostics: { path: P, wait_ms: 4000 },
};
const UNSUPPORTED = /unsupported by the connected C# language server/i;

const caps = await cslsp.getServerCapabilities();
const advertised = Object.entries(CAP).filter(([, c]) => c && caps[c]).map(([t]) => t).sort();
console.log(`CS_LSP_CAPS ${Object.keys(CAP).length} tools · advertised: ${advertised.join(" ")}`);

// OmniSharp loads the project and runs a design-time build ASYNCHRONOUSLY after
// initialize; semantic answers are empty until that finishes. Poll until the
// workspace is warm, then FAIL if it never warms — an unwarmed server would make
// every SUPPORTED assertion below vacuous, which is the exact failure mode this
// file exists to prevent.
let warm = 0;
for (let i = 0; i < 40; i++) {
  const r = await call("cs_document_symbols", { path: P });
  warm = r.structuredContent?.symbols?.length ?? 0;
  if (warm > 0) break;
  await sleep(3000);
}
check(warm > 0, "WARM", `the OmniSharp workspace must load before anything is asserted (Player.cs symbols=${warm})`);
if (!warm) {
  console.log("CS_LSP_LIVE_ALL FAIL workspace never loaded — refusing to assert against a cold server");
  process.exit(1);
}

const traps = [];
for (const name of Object.keys(CAP).sort()) {
  const cap = CAP[name];
  const isAdvertised = cap === null ? null : !!caps[cap];
  let res;
  try {
    res = await call(name, ARGS[name]);
  } catch (err) {
    check(false, "NO_THROW", `${name} THREW to the caller: ${err?.message ?? err}`);
    continue;
  }
  const text = String(res?.content?.[0]?.text ?? "");

  if (isAdvertised === false) {
    check(res.isError === true && UNSUPPORTED.test(text), "DEGRADE",
      `${name}: unadvertised ${cap} must return the documented unsupported error (isError=${!!res.isError})`);
    check(!/-32601|Method not found/i.test(text) || UNSUPPORTED.test(text), "NO_RAW_RPC",
      `${name}: must not leak a raw JSON-RPC code`);
    continue;
  }

  if (res.isError && UNSUPPORTED.test(text)) {
    // Advertised, but the tool says unsupported. Only legitimate if the SERVER
    // really refuses the method — ask it directly rather than take the tool's word.
    const m = METHOD[name];
    let refused = false, code = "no-raw-method-mapped";
    if (m) {
      const params = m[1] ?? {
        textDocument: { uri: cfg.csLspProjectUri.replace(/\/$/, "") + "/Player.cs" },
        position: { line: 13, character: 15 },
      };
      try { await cslsp.request(m[0], params); code = "server ANSWERED"; }
      catch (err) {
        code = String(err?.code ?? err?.message ?? err);
        refused = err?.code === -32601 || /method not found/i.test(err?.message ?? "");
      }
    }
    check(refused, "TRAP_EARNED",
      `${name}: advertised ${cap} + tool says unsupported — the server must really answer -32601 (got ${code})`);
    if (refused) traps.push(`${name}(${cap})`);
    continue;
  }

  check(!res.isError, "SUPPORTED",
    `${name}: ${cap ?? "no provider gate"} is available, so the tool must succeed — ${res.isError ? text.slice(0, 110) : "ok"}`);
  check(!res.isError && !!res.structuredContent, "STRUCTURED", `${name}: must return structuredContent`);
}
console.log(`CS_LSP_TRAPS ${traps.length ? traps.join(" ") : "none"} (advertised-but--32601, earned this run)`);

// --- the refusals: states the mock C# server cannot produce ------------------
const refusal = async (marker, name, args, re, detail) => {
  try {
    const r = await call(name, args);
    const text = String(r.content?.[0]?.text ?? "");
    check(r.isError === true && re.test(text), marker, `${detail} — got ${text.slice(0, 90) || "isError=" + !!r.isError}`);
    // A refusal is the HOST declining, not the server failing. Dressing it as
    // "LSP error [...]" sends the caller to debug a server never contacted.
    check(!/^LSP error/.test(text), "REFUSAL_NOT_LSP_ERROR",
      `${name}: a host refusal must not be reported as an LSP error — got ${text.slice(0, 70)}`);
  } catch (err) {
    // A zod rejection IS the refusal for schema-level guards.
    check(re.test(String(err?.message ?? err)), marker, `${detail} (schema: ${String(err?.message ?? err).slice(0, 80)})`);
  }
};

await refusal("PATH_ESCAPE", "cs_document_symbols", { path: "res://../../../etc/passwd" },
  /outside the C# project root/, "a res:// path that escapes the project root must be refused");
await refusal("PATH_ABSOLUTE", "cs_document_symbols", { path: "/etc/passwd" },
  /outside the C# project root/, "an absolute path outside the project must be refused");
// The separator matters: a SIBLING directory whose name merely starts with the
// project's name passes a bare startsWith(root) test.
await refusal("PATH_SIBLING_PREFIX", "cs_document_symbols", { path: "res://../example-csharp_evil/x.cs" },
  /outside the C# project root/, "a sibling directory sharing the project's name prefix must be refused");
// Measured live before the guard: ABSENT, EMPTY and DIRECTORY all returned
// byte-identical {"symbols":[]} with isError:false. Three states, one answer.
for (const tool of ["cs_document_symbols", "cs_diagnostics", "cs_hover"]) {
  await refusal("MISSING_FILE", tool,
    { path: "res://NoSuchFile.cs", line: 0, character: 0, wait_ms: 50 },
    /no such file/i, `${tool} must refuse a path that does not exist`);
}
await refusal("NOT_A_FILE", "cs_document_symbols", { path: "res://" },
  /is not a file/, "a directory must be refused");
for (const [bad, why] of [["", "empty"], ["1bad name!", "not an identifier"], ["a\nb", "contains a newline"], ["my-name", "contains a hyphen"]]) {
  await refusal("RENAME_IDENT", "cs_rename", { path: P, line: 13, character: 15, new_name: bad, apply: false },
    /not a valid C# identifier/, `rename to ${JSON.stringify(bad)} (${why}) must be refused BEFORE edits are planned`);
}
for (const kw of ["class", "int", "static"]) {
  await refusal("RENAME_KEYWORD", "cs_rename", { path: P, line: 13, character: 15, new_name: kw, apply: false },
    /reserved keyword/, `rename to the C# keyword "${kw}" must be refused`);
}
// Schema-level: these never reach the handler on the real wire. Measured before
// the bound, a negative position returned
// `LSP error [-32603]: Internal Error - System.ArgumentOutOfRangeException` with
// a .NET stack trace in the answer — NOT the silent success the gd_* plane gave.
await refusal("NEG_POSITION", "cs_hover", { path: P, line: -5, character: 0 },
  /greater than or equal to 0|Too small/i, "a negative line must be rejected by the input schema");
await refusal("NEG_POSITION", "cs_hover", { path: P, line: 0, character: -1 },
  /greater than or equal to 0|Too small/i, "a negative character must be rejected by the input schema");

// --- the guards must NOT be over-eager --------------------------------------
// Every name here compiles as C#, so every one must still plan edits: ordinary
// identifiers, CONTEXTUAL keywords (not reserved), framework type names
// (shadowable, exactly like Godot's engine classes), the @-verbatim form whose
// entire purpose is to legalize a keyword, and Unicode identifiers.
for (const good of ["Counter2", "_private", "var", "value", "async", "record", "Console", "@class", "Ångström"]) {
  const r = await call("cs_rename", { path: P, line: 13, character: 15, new_name: good, apply: false });
  check(!r.isError && r.structuredContent?.edit_count > 0 && r.structuredContent?.applied === false,
    "RENAME_LEGAL", `"${good}" is a legal C# identifier and must still plan edits (edit_count=${r.structuredContent?.edit_count ?? "-"})`);
}
// A path inside the project must still be accepted, including one that walks out
// and back in — the escape guard resolves before it judges.
for (const good of [P, "Player.cs", "res://demo/../Player.cs"]) {
  const r = await call("cs_document_symbols", { path: good });
  check(!r.isError, "PATH_LEGAL", `"${good}" resolves inside the project and must be accepted`);
}
// The missing-file guard is about ABSENCE, not size: a file that exists and is
// genuinely empty must still be served. That is precisely the distinction the
// old behaviour destroyed, and here it destroyed it completely — absent, empty
// and directory were byte-identical.
const emptyRel = "ZzCsLspEmptyProbe.cs";
const emptyAbs = `${cfg.csLspProjectPath}/${emptyRel}`;
fs.writeFileSync(emptyAbs, "");
try {
  const r = await call("cs_document_symbols", { path: `res://${emptyRel}` });
  check(!r.isError, "EMPTY_FILE_OK",
    `a file that EXISTS and is empty must still be served — ${r.isError ? String(r.content?.[0]?.text ?? "").slice(0, 80) : "ok"}`);
} finally {
  fs.rmSync(emptyAbs, { force: true });
}

cslsp.close();
// 🔴 THE POPULATION GATE, folded into the same failure count the probe already had.
failures += population.report().length;
if (failures) { console.log(`CS_LSP_LIVE_ALL FAIL ${failures} claim(s) did not hold`); process.exit(1); }
console.log(`CS_LSP_LIVE_ALL ok every claim held (${population.total} claim(s) ran)`);
process.exit(0);

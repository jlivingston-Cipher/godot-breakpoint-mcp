// LSP-plane live coverage — the assertions the editor/LSP job never had.
//
// `editor-lsp.integration.mjs` (which stays) is a DIAGNOSTIC log: every probe in
// it is wrapped in a try/catch that only console.logs, so a gd_* tool erroring on
// every call left the job green. This file is the GATE. Anything it finds wrong
// exits non-zero.
//
// The load-bearing idea is that the baseline is DERIVED from the live build, not
// pinned to a table: Godot's providers differ per version (measured — 4.7
// advertises documentHighlight and 4.3/4.5 do not; 4.3 advertises
// workspaceSymbol and 4.5/4.7 do not), so a pinned matrix would need hand
// maintenance on every engine bump and would encode 4.3's trap as an expected
// pass.
//
// And the trap exemption is EARNED per run, never hardcoded: when a tool reports
// "unsupported" for a provider the server DID advertise, this probe issues the
// raw LSP request itself and requires the server to answer -32601. That is the
// 155 §6 rule — the load-bearing assertion asks the language server, not the
// tool's own answer read back.
import fs from "node:fs";
import { z } from "zod";
import { LspClient } from "../dist/lsp.js";
import { loadConfig } from "../dist/config.js";
import { registerLspTools } from "../dist/tools/lsp.js";
import { Population } from "./_population.mjs";

const cfg = loadConfig();
const lsp = new LspClient(cfg.lspHost, cfg.lspPort, cfg.projectUri, 20000);

const handlers = new Map();
const schemas = new Map();
registerLspTools({
  registerTool: (name, config, handler) => {
    handlers.set(name, handler);
    schemas.set(name, config?.inputSchema ?? {});
  },
  registerResource: () => {},
  server: { elicitInput: async () => ({ action: "decline" }) },
}, lsp, cfg);

// A handler pulled straight out of a recording server NEVER SEES ITS zod SCHEMA
// — the real MCP server validates first. A probe that skips that step cannot see
// a schema-level fix at all, so every call here is validated the way the wire
// would validate it.
const validate = (name, args) => z.object(schemas.get(name)).parse(args);
const call = async (name, args) => handlers.get(name)(validate(name, args), {});

let failures = 0;
// 🔴 THE CLAIM POPULATION, COUNTED (169 §10 item 2). `failures` was the only number
// this probe kept, and a probe that counts only failures cannot tell "nothing was
// wrong" from "nothing was asked": the last line read `LSP_LIVE_ALL ok every claim
// held`, which is true of the empty set.
//
// 🔴 THE MANIFEST HOLDS ONLY WHAT MUST ALWAYS SPEAK, and this plane is the reason
// that distinction exists. Four markers are legitimately absent on a healthy run:
// `NO_THROW` fires only when a tool throws to the caller, and `DEGRADE`,
// `NO_RAW_RPC` and `TRAP_EARNED` are EARNED per build — Godot's providers differ by
// version (measured: 4.7 advertises documentHighlight and 4.3/4.5 do not), so a
// build that supports everything makes none of them. Naming them would false-fail a
// green run on a future engine; they are still counted in the total.
const population = new Population("LSP_LIVE", {
  families: [
    "SUPPORTED", "STRUCTURED", "REFUSAL_NOT_LSP_ERROR", "PATH_EVERY_TOOL",
    "PATH_ESCAPE", "PATH_ABSOLUTE", "PATH_SIBLING_PREFIX", "MISSING_FILE",
    "NOT_A_FILE", "RENAME_IDENT", "RENAME_KEYWORD", "NEG_POSITION",
    "RENAME_LEGAL", "PATH_LEGAL", "EMPTY_FILE_OK",
  ],
  scope: 15,
  claims: 80,         // 🔴 NOT exact, and MEASURED not guessed: 84 claims / 17 families on 4.7, 82 / 18 on 4.3. The 18th is TRAP_EARNED, which 4.7 never makes — naming it would have false-failed 4.7 on a green run
});
const check = (cond, marker, detail) => {
  population.claim(marker);
  if (cond) console.log(`LSP_LIVE_${marker} ok ${detail}`);
  else { failures++; console.log(`LSP_LIVE_${marker} FAIL ${detail}`); }
};

// The provider each tool is gated on. `null` = not a request provider.
const CAP = {
  gd_completion: "completionProvider", gd_hover: "hoverProvider",
  gd_definition: "definitionProvider", gd_declaration: "declarationProvider",
  gd_type_definition: "typeDefinitionProvider", gd_implementation: "implementationProvider",
  gd_references: "referencesProvider", gd_document_symbols: "documentSymbolProvider",
  gd_workspace_symbols: "workspaceSymbolProvider", gd_document_highlight: "documentHighlightProvider",
  gd_document_link: "documentLinkProvider", gd_document_color: "colorProvider",
  gd_folding_ranges: "foldingRangeProvider", gd_formatting: "documentFormattingProvider",
  gd_signature_help: "signatureHelpProvider", gd_code_action: "codeActionProvider",
  gd_call_hierarchy: "callHierarchyProvider", gd_semantic_tokens: "semanticTokensProvider",
  gd_rename: "renameProvider", gd_diagnostics: null,
};
// The raw LSP method behind each tool, so an "unsupported" verdict can be checked
// against the SERVER rather than believed.
const METHOD = {
  gd_workspace_symbols: ["workspace/symbol", { query: "x" }],
  gd_document_color: ["textDocument/documentColor", null],
  gd_folding_ranges: ["textDocument/foldingRange", null],
  gd_formatting: ["textDocument/formatting", null],
  gd_code_action: ["textDocument/codeAction", null],
  gd_semantic_tokens: ["textDocument/semanticTokens/full", null],
  gd_type_definition: ["textDocument/typeDefinition", null],
  gd_implementation: ["textDocument/implementation", null],
  gd_document_highlight: ["textDocument/documentHighlight", null],
  gd_call_hierarchy: ["textDocument/prepareCallHierarchy", null],
};

const P = "res://player.gd";
const ARGS = {
  gd_completion: { path: P, line: 20, character: 8 },
  gd_hover: { path: P, line: 23, character: 7 },
  gd_definition: { path: P, line: 23, character: 7 },
  gd_declaration: { path: P, line: 23, character: 7 },
  gd_type_definition: { path: P, line: 23, character: 7 },
  gd_implementation: { path: P, line: 23, character: 7 },
  gd_references: { path: P, line: 8, character: 4 },
  gd_document_symbols: { path: P },
  gd_workspace_symbols: { query: "take_damage" },
  gd_document_highlight: { path: P, line: 8, character: 4 },
  gd_document_link: { path: P },
  gd_document_color: { path: P },
  gd_folding_ranges: { path: P },
  gd_formatting: { path: P },
  gd_signature_help: { path: P, line: 23, character: 16 },
  gd_code_action: { path: P, start_line: 23, start_character: 0 },
  gd_call_hierarchy: { path: P, line: 23, character: 7, direction: "incoming" },
  gd_semantic_tokens: { path: P },
  gd_rename: { path: P, line: 8, character: 4, new_name: "counter2", apply: false },
  gd_diagnostics: { path: P, wait_ms: 2500 },
};
const UNSUPPORTED = /unsupported by the connected Godot build/i;

const caps = await lsp.getServerCapabilities();
const advertised = Object.entries(CAP)
  .filter(([, c]) => c && caps[c]).map(([t]) => t).sort();
console.log(`LSP_CAPS ${Object.keys(CAP).length} tools · advertised: ${advertised.join(" ")}`);

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
    // Not advertised -> must degrade with the documented message. Never succeed,
    // never leak a raw JSON-RPC code.
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
      const params = m[1] ?? { textDocument: { uri: cfg.projectUri.replace(/\/$/, "") + "/player.gd" },
                               position: { line: 8, character: 4 } };
      try { await lsp.request(m[0], params); code = "server ANSWERED"; }
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

  // Advertised (or not provider-gated) and not trapped -> must succeed and carry
  // structured content.
  check(!res.isError, "SUPPORTED",
    `${name}: ${cap ?? "no provider gate"} is available, so the tool must succeed — ${res.isError ? text.slice(0, 110) : "ok"}`);
  // 🔴 `!!res.structuredContent` WAS SATISFIED BY `{}` (172). A marker named STRUCTURED
  // passed for a reply carrying no structure at all — 171 D4's `outputSchemas` empty
  // shape, in the probe suite, twice (here and cs-lsp-plane). Presence is not structure.
  check(!res.isError && Object.keys(res.structuredContent ?? {}).length > 0, "STRUCTURED",
    `${name}: must return a NON-EMPTY structuredContent (got ${JSON.stringify(res.structuredContent ?? null).slice(0, 90)})`);
}
console.log(`LSP_TRAPS ${traps.length ? traps.join(" ") : "none"} (advertised-but--32601, earned this run)`);

// --- the refusals: states no mock LSP can produce -------------------------
const refusal = async (marker, name, args, re, detail) => {
  try {
    const r = await call(name, args);
    const text = String(r.content?.[0]?.text ?? "");
    check(r.isError === true && re.test(text), marker, detail);
    // A refusal is the HOST declining, not the server failing. Dressing it as
    // "LSP error [...]" sends the caller to debug a server never contacted.
    check(!/^LSP error/.test(text), "REFUSAL_NOT_LSP_ERROR",
      `${name}: a host refusal must not be reported as an LSP error — got ${text.slice(0, 70)}`);
  } catch (err) {
    // A zod rejection IS the refusal for schema-level guards.
    check(re.test(String(err?.message ?? err)), marker, `${detail} (schema: ${String(err?.message ?? err).slice(0, 80)})`);
  }
};

// 🔴 EVERY REACHABLE PATH-TAKING TOOL, not one of them (session 162).
//
// Until now this plane asserted the escape refusal on `gd_document_symbols` alone,
// while nineteen gd_* tools take a `path`. That is the shape 161 §4 caught on the
// tabletop plane — `clearStaleTab` asserted on one of four call sites, and deleting it
// from the other three survived the sweep — and 162's measurement caught it again on
// the DAP plane, where `dbg_goto` turned out to take a path and guard nothing.
//
// The exemption is EARNED, never hardcoded: a tool whose provider this build does not
// advertise answers "unsupported" BEFORE the guard, so it cannot be asserted here. That
// is a measured property of the connected engine (on 4.7, 8 of the 19 are exempt), and
// the count is printed so a silent drop to zero is visible.
{
  const PATH_TOOLS = Object.keys(ARGS).filter((t) => "path" in (ARGS[t] ?? {}));
  let asserted = 0; const exempt = [];
  for (const name of PATH_TOOLS) {
    const cap = CAP[name];
    if (cap && !caps[cap]) { exempt.push(name); continue; }
    const r = await call(name, { ...ARGS[name], path: "res://../example_evil/x.gd" });
    const text = String(r?.content?.[0]?.text ?? "");
    if (UNSUPPORTED.test(text)) { exempt.push(name); continue; }
    check(r.isError === true && /outside the Godot project root/.test(text), "PATH_EVERY_TOOL",
      `${name}: an escaping path must be refused BY REASON (got ${text.slice(0, 80)})`);
    asserted++;
  }
  check(asserted > 0, "PATH_EVERY_TOOL", "at least one path-taking tool must be reachable to assert");
  console.log(`LSP_LIVE_PATH_COVERAGE ok ${asserted}/${PATH_TOOLS.length} asserted · ` +
    `exempt (provider not advertised): ${exempt.join(" ") || "none"}`);
}

await refusal("PATH_ESCAPE", "gd_document_symbols", { path: "res://../../../etc/passwd" },
  /outside the Godot project root/, "a res:// path that escapes the project root must be refused");
await refusal("PATH_ABSOLUTE", "gd_document_symbols", { path: "/etc/passwd" },
  /outside the Godot project root/, "an absolute path outside the project must be refused");
// The separator matters: a SIBLING directory whose name merely starts with the
// project's name passes a bare startsWith(root) test. `example` vs
// `example_evil` is the whole reason the guard compares against `root + sep`.
await refusal("PATH_SIBLING_PREFIX", "gd_document_symbols", { path: "res://../example_evil/x.gd" },
  /outside the Godot project root/,
  "a sibling directory sharing the project's name prefix must be refused");
// A missing file must be refused, not opened as an empty document. Before the
// guard, gd_document_symbols answered a phantom class symbol and gd_diagnostics
// a real "(EMPTY_FILE)" warning — both isError:false, for a file that is not there.
for (const tool of ["gd_document_symbols", "gd_diagnostics", "gd_hover"]) {
  await refusal("MISSING_FILE", tool,
    { path: "res://no_such_file.gd", line: 0, character: 0, wait_ms: 50 },
    /no such file/i, `${tool} must refuse a path that does not exist`);
}
await refusal("NOT_A_FILE", "gd_document_symbols", { path: "res://" },
  /is not a file/, "a directory must be refused");
for (const [bad, why] of [["", "empty"], ["1bad name!", "not an identifier"], ["a\nb", "contains a newline"]]) {
  await refusal("RENAME_IDENT", "gd_rename", { path: P, line: 8, character: 4, new_name: bad, apply: false },
    /not a valid GDScript identifier/, `rename to ${JSON.stringify(bad)} (${why}) must be refused BEFORE edits are planned`);
}
await refusal("RENAME_KEYWORD", "gd_rename", { path: P, line: 8, character: 4, new_name: "func", apply: false },
  /reserved word/, "rename to a GDScript keyword must be refused");
// Schema-level: these never reach the handler on the real wire.
await refusal("NEG_POSITION", "gd_hover", { path: P, line: -5, character: 0 },
  /greater than or equal to 0|Too small/i, "a negative line must be rejected by the input schema");
await refusal("NEG_POSITION", "gd_hover", { path: P, line: 0, character: -1 },
  /greater than or equal to 0|Too small/i, "a negative character must be rejected by the input schema");

// The guards must not be over-eager. A plain identifier, a LEADING UNDERSCORE
// (idiomatic GDScript for private members) and an engine CLASS name (shadowable,
// therefore legal) must all still plan edits.
for (const good of ["counter2", "_private", "Node", "Vector2"]) {
  const r = await call("gd_rename", { path: P, line: 8, character: 4, new_name: good, apply: false });
  check(!r.isError && r.structuredContent?.edit_count > 0 && r.structuredContent?.applied === false,
    "RENAME_LEGAL", `"${good}" is a legal identifier and must still plan edits (edit_count=${r.structuredContent?.edit_count ?? "-"})`);
}
// A path inside the project must still be accepted, including one that walks out
// and back in — the escape guard resolves before it judges.
for (const good of [P, "player.gd", "res://sub/../player.gd"]) {
  const r = await call("gd_document_symbols", { path: good });
  check(!r.isError, "PATH_LEGAL", `"${good}" resolves inside the project and must be accepted`);
}
// The missing-file guard is about ABSENCE, not size: a file that exists and is
// genuinely empty must still be served. That is the distinction the old
// behaviour destroyed — "" on disk and no file at all answered identically.
const emptyRel = "tests/lsp_empty_probe.gd";
const emptyAbs = `${cfg.projectPath}/${emptyRel}`;
fs.writeFileSync(emptyAbs, "");
try {
  const r = await call("gd_document_symbols", { path: `res://${emptyRel}` });
  check(!r.isError, "EMPTY_FILE_OK",
    `a file that EXISTS and is empty must still be served — ${r.isError ? String(r.content?.[0]?.text ?? "").slice(0, 80) : "ok"}`);
} finally {
  fs.rmSync(emptyAbs, { force: true });
}

lsp.close();
// 🔴 THE POPULATION GATE, folded into the same failure count the probe already had.
failures += population.report().length;
if (failures) { console.log(`LSP_LIVE_ALL FAIL ${failures} claim(s) did not hold`); process.exit(1); }
console.log(`LSP_LIVE_ALL ok every claim held (${population.total} claim(s) ran)`);

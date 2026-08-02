#!/usr/bin/env node
// boundary_gate.mjs — session 177. THE TAUTOLOGY THAT LIVES ON THE OTHER SIDE OF THE BRIDGE.
//
// 🔴 THE DEFECT THIS EXISTS FOR, IN FULL:
//
//     # addons/breakpoint_mcp/operations.gd
//     func _filesystem_scan(_params: Dictionary) -> Dictionary:
//         EditorInterface.get_resource_filesystem().scan()
//         return _ok({"scanning": true})
//
//     // host/test-integration/authoring-plane.integration.mjs
//     (await call("filesystem_scan")).scanning === true
//       ? pass("AUTH_RESOURCE_FS_SCAN") : fail("AUTH_RESOURCE_FS_SCAN");
//
// Neither half is wrong on its own, and `tautology_gate.mjs` cannot see it. That gate
// classifies a claim's LEAVES: `.scanning` is a property of a value fetched at runtime,
// which is the textbook shape of a VALUE claim — the one kind it is built to pass. The
// constant is real, but it is in another language, in another file, on the other side of
// a JSON hop. **A claim is only as falsifiable as the widest thing that can vary in it,
// and nothing in `_filesystem_scan` can vary at all.**
//
// 🔴 AND `call()` THROWS ON `isError`, WHICH IS WHAT CLOSES THE LAST ESCAPE. One could
// argue `.scanning === true` at least distinguishes success from failure — it does not.
// Every `_err` path in an operation escapes through `call()` before the comparison is
// reached, so by the time a hard-wired field is read, the literal the addon typed is the
// only value it can possibly hold. The claim's two outcomes are "true" and "unreachable".
//
// ── WHAT THIS GATE DOES NOT DO, AND WHY ──────────────────────────────────────────────
//
// 🔴 IT DOES NOT MATCH FIELDS BY NAME, BECAUSE THE FIRST DRAFT DID AND INVENTED SIX.
// Asking "is any hard-wired field name compared against its literal?" flagged ten sites.
// Six were `resource_load(...).type === "Shader"` and its siblings — and `_resource_load`
// returns `"type": res.get_class()`, DERIVED, which is the entire point of those checks:
// they prove the thing saved to disk loads back as the class it claims to be. The name
// `.type` is hard-wired by `_shader_create` and derived by `_resource_load`, and matching
// on the name alone cannot tell those apart.
//
// That is 175 §3's defect, committed again in 176 §5, and committed a third time here by
// the session that read both. **A lesson recorded in a handoff is a lesson about the past
// tense** (176 §11.21). So every comparison is bound to the call that PRODUCED its
// receiver — inline `(await call("t")).f`, or `const x = await call("t", …)` then `x.f` —
// and the tool is resolved to a GDScript function through two real lookups:
//
//   tool name --registerTool's own call("<op>") argument--> op string
//   op string --the addon's dispatcher, read from operations.gd--> _gd_function
//
// A comparison whose receiver does not resolve is NOT JUDGED and is counted separately.
// Silence about what an instrument could not see is the thing every session since 170 has
// been paying for.
//
// 🔴 IT DOES NOT FLAG A HARD-WIRED FIELD THAT NOBODY ASSERTS. `_screenshot.mime` is
// `"image/png"` unconditionally and that is fine — a constant in a response is only a
// defect when something DRESSES IT AS EVIDENCE. The population is the intersection, not
// the constants.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// fileURLToPath, not .pathname — the repo lives under "Godot MCP" (174 §10).
const HOST = fileURLToPath(new URL("../", import.meta.url));
const GD = join(HOST, "../addons/breakpoint_mcp/operations.gd");

// A value that cannot vary: a GDScript literal with no identifier and no call in it.
const LITERAL = /^(true|false|-?\d+(\.\d+)?|"[^"]*")$/;

// ─────────────────────────────────────────────────────────── the addon: dispatcher ──
/**
 * `"filesystem.scan":` / `return _filesystem_scan(params)` — the addon's own match
 * statement, read rather than re-spelled. Exported so the self-test can drive it with a
 * source that has no file behind it.
 */
export function dispatchMap(gdText) {
  const out = new Map();
  const lines = gdText.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const k = lines[i].match(/^\s*"([\w.]+)":\s*$/);
    const v = lines[i + 1].match(/^\s*return (_\w+)\(/);
    if (k && v) out.set(k[1], v[1]);
  }
  return out;
}

/** Split a GDScript dict body on top-level commas — nested dicts and arrays stay whole. */
function splitTop(body) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of body) {
    if ("{[(".includes(ch)) depth++;
    if ("}])".includes(ch)) depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out
    .map((p) => p.match(/^\s*"([^"]+)"\s*:\s*([\s\S]+?)\s*$/))
    .filter(Boolean)
    .map((m) => ({ key: m[1], val: m[2].trim() }));
}

/**
 * Which response fields are an unconditional literal on EVERY return path of an operation?
 *
 * 🔴 "EVERY RETURN PATH" IS THE WHOLE TEST, and it is why this is not a grep. An operation
 * with two `_ok(...)` returns — one literal, one derived — has a field that CAN vary, and
 * a claim over it is honest. Only a field that is the same literal at every `_ok` and
 * derived at none cannot carry information. `_err` returns are irrelevant: they never
 * reach a comparison, because `call()` throws on them.
 */
export function hardwired(gdText) {
  const lines = gdText.split("\n");
  const returns = new Map();
  let fn = null;
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].match(/^func (_\w+)\(/);
    if (f) { fn = f[1]; returns.set(fn, []); continue; }
    if (!fn) continue;
    const one = lines[i].match(/_ok\(\{(.*)\}\)/);
    if (one) { returns.get(fn).push(splitTop(one[1])); continue; }
    if (/_ok\(\{\s*$/.test(lines[i])) {              // the multi-line dict spelling
      let j = i + 1, buf = "";
      while (j < lines.length && !/^\s*\}\)/.test(lines[j])) { buf += lines[j] + "\n"; j++; }
      returns.get(fn).push(splitTop(buf));
      i = j;
    }
  }
  const out = new Map();
  for (const [op, rets] of returns) {
    if (!rets.length) continue;
    const seen = new Map();
    for (const r of rets) for (const { key, val } of r) {
      const e = seen.get(key) ?? { lits: new Set(), derived: 0 };
      LITERAL.test(val) ? e.lits.add(val) : e.derived++;
      seen.set(key, e);
    }
    const fields = new Map();
    for (const [k, e] of seen) if (e.derived === 0 && e.lits.size === 1) fields.set(k, [...e.lits][0]);
    if (fields.size) out.set(op, fields);
  }
  return out;
}

// ───────────────────────────────────────────────────── the host: tool -> op string ──
/**
 * `server.registerTool("filesystem_scan", …, async () => call("filesystem.scan"))`.
 *
 * 🔴 ONLY AN UNAMBIGUOUS REGISTRATION IS RECORDED. A tool whose handler reaches two
 * different operations (a read-back, a fallback) is left out rather than guessed at: the
 * whole point of this file is that a guess about which operation produced a reply is the
 * defect it was written to catch.
 */
export function toolOps(sources) {
  const out = new Map();
  for (const [file, text] of sources) {
    const s = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (n) => {
      if (ts.isCallExpression(n) && /registerTool$/.test(n.expression.getText(s))) {
        const t = n.arguments[0];
        if (t && ts.isStringLiteralLike(t)) {
          const ops = [];
          const find = (m) => {
            if (ts.isCallExpression(m) && /(^|\.)call$/.test(m.expression.getText(s))) {
              const a = m.arguments[0];
              if (a && ts.isStringLiteralLike(a) && a.text.includes(".")) ops.push(a.text);
            }
            ts.forEachChild(m, find);
          };
          find(n);
          if (new Set(ops).size === 1) out.set(t.text, ops[0]);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(s);
  }
  return out;
}

// ──────────────────────────────────────────── the probes: comparisons, receiver-bound ──
const down = (e) => { let v = e; while (ts.isAwaitExpression(v) || ts.isParenthesizedExpression(v)) v = v.expression; return v; };
const toolOf = (e) => {
  const d = down(e);
  if (ts.isCallExpression(d)) {
    const a = d.arguments[0];
    if (a && ts.isStringLiteralLike(a)) return a.text;
  }
  return null;
};

/**
 * Every `<receiver>.<field> === <literal>` in one source, with the receiver resolved back
 * to the tool call that produced it. `resolved: null` means "not judged" and is reported.
 */
export function comparisons(file, text) {
  const s = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    /\.ts$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const lines = text.split("\n");
  const bound = new Map();
  const bind = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const t = toolOf(n.initializer);
      if (t) bound.set(n.name.text, t);
    }
    ts.forEachChild(n, bind);
  };
  bind(s);

  const out = [];
  const visit = (n) => {
    if (ts.isBinaryExpression(n)
        && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(n.operatorToken.kind)) {
      for (const [a, b] of [[n.left, n.right], [n.right, n.left]]) {
        if (!ts.isPropertyAccessExpression(a)) continue;
        const isLit = b.kind === ts.SyntaxKind.TrueKeyword || b.kind === ts.SyntaxKind.FalseKeyword
          || ts.isNumericLiteral(b) || ts.isStringLiteralLike(b);
        if (!isLit) continue;
        const recv = a.expression;
        const tool = toolOf(recv) ?? (ts.isIdentifier(recv) ? bound.get(recv.text) ?? null : null);
        const line = s.getLineAndCharacterOfPosition(n.getStart(s)).line;
        out.push({
          file, line: line + 1, field: a.name.text,
          lit: b.getText(s).replace(/^["']|["']$/g, ""),
          tool, text: lines[line].trim(),
        });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(s);
  return out;
}

// ──────────────────────────────────────────────────────────────────── the walk ──
// 🔴 ONE RECURSIVE WALK AND NO DIRECTORY ROSTER — 176 §6, which found `[".", "scripts",
// "test-integration"]` over a recursive walk double-counting every site under the last two
// (109 where there were 61, and the one real defect twice). Each skipped directory carries
// a written reason, because an exclusion that costs nothing to write is an exclusion
// nobody re-reads (174 §5).
export const BOUNDARY_SKIP = {
  node_modules: "third-party sources; nothing here is ours to fix",
  dist: "compiled output of host/src — the .ts is the instrument",
  "dist-test": "compiled test output, same reason",
  _to_delete: "the bridge-scratch convention (129 §7). Scratch may evaporate between sessions",
  addon: "gitignored staging copy that `npm run stage-addon` recreates verbatim",
  ".godot": "engine cache, not source",
};

function walk(abs, rel = "", re = /\.(mjs|ts)$/) {
  const out = [];
  for (const e of readdirSync(join(abs, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (Object.hasOwn(BOUNDARY_SKIP, e.name)) continue;
      out.push(...walk(abs, r, re));
    } else if (re.test(e.name)) out.push(r);
  }
  return out;
}

// 🔴 FOUR FLOORS, BECAUSE THERE ARE FOUR WAYS THIS COLLAPSES INTO A GREEN LIE, and each
// one alone leaves the other three reporting a clean tree. Measured on the tree this ships
// with, then set below the measurement — a floor at the exact reading reddens on the next
// honest edit, and a gate that reds on good work gets deleted.
//
//   CONST  `hardwired()` stops recognising `_ok({...})`      -> 0 constants, 0 offenders
//   OP     `dispatchMap()` stops recognising the match arms  -> no tool resolves, 0 offenders
//   TOOL   `toolOps()` stops recognising `registerTool`      -> no tool resolves, 0 offenders
//   SITE   `comparisons()` stops recognising `x.f === lit`   -> 0 sites, 0 offenders
export const CONST_FLOOR = 14;   // measured 17 fields across 17 operations
export const OP_FLOOR = 140;     // measured 155 dispatcher arms
export const TOOL_FLOOR = 150;   // measured 170 tools resolved to exactly one operation
export const SITE_FLOOR = 800;   // measured 953 literal comparisons in the walked tree

/**
 * 🔴 THE COLLAPSE TEST, EXTRACTED AS A PURE FUNCTION — 176 §8's G12 shape. Pinning a
 * floor's VALUE with a claim is circular (the claim reads the constant it is checking);
 * what is not circular is that an EMPTIED population is a collapse whatever the floor
 * says. The self-test asserts exactly that, so setting any floor to 0 reddens.
 */
export function collapsed(n, floor) {
  return n === 0 || n < floor;
}

/** The judgement, as a pure function of its populations (174 §8's reason). */
export function judge(pop, offenders) {
  const out = { lines: [], failed: false };
  const say = (s) => out.lines.push(s);
  say(`BOUNDARY_GATE consts=${pop.consts}/${CONST_FLOOR} ops=${pop.ops}/${OP_FLOOR} `
    + `tools=${pop.tools}/${TOOL_FLOOR} sites=${pop.sites}/${SITE_FLOOR} `
    + `unresolved=${pop.unresolved} judged=${pop.judged} offenders=${offenders.length}`);

  for (const [what, n, floor, why] of [
    ["CONSTS", pop.consts, CONST_FLOOR, "operations.gd stopped yielding hard-wired fields — the `_ok({…})` reader no longer matches"],
    ["OPS", pop.ops, OP_FLOOR, "the addon's dispatcher stopped resolving — no reply can be traced to the function that built it"],
    ["TOOLS", pop.tools, TOOL_FLOOR, "registerTool stopped resolving to an operation string — every comparison becomes unjudgeable"],
    ["SITES", pop.sites, SITE_FLOOR, "no comparison against a literal was found at all — the finder, not the tree, went quiet"],
  ]) {
    if (collapsed(n, floor)) {
      say(`🔴 BOUNDARY_${what}_COLLAPSE ${n} < ${floor} — ${why}.`);
      say(`   Zero offenders out of a population that collapsed is not a clean tree (170 §4).`);
      out.failed = true;
    }
  }

  for (const d of offenders) {
    out.failed = true;
    say(`\n🔴 BOUNDARY_TAUTOLOGY ${d.file}:${d.line}`);
    say(`   ${d.text}`);
    say(`   ${d.tool} -> ${d.op} -> ${d.gd}, and .${d.field} is ${d.lit} on EVERY return path`);
    say(`   of that operation. call() throws on isError, so every other path escapes before`);
    say(`   this line — the literal the addon typed is the only value this can hold. The`);
    say(`   claim has two outcomes: "true", and "never reached". Assert something DERIVED`);
    say(`   (a field the operation computes, or a read-back from the engine), or assert the`);
    say(`   response SHAPE and write down that the value is a documented constant.`);
  }

  say(out.failed ? `\nBOUNDARY_GATE 🔴 FAILED` : `BOUNDARY_GATE ok — ${pop.judged} judged claim(s), none compared against a constant`);
  return out;
}

export function scan(host = HOST, gdPath = GD) {
  const gdText = readFileSync(gdPath, "utf8");
  const dispatch = dispatchMap(gdText);
  const consts = hardwired(gdText);
  const tools = toolOps(walk(host, "src", /\.ts$/).map((f) => [f, readFileSync(join(host, f), "utf8")]));

  const sites = [];
  for (const f of walk(host)) {
    if (f.startsWith("src/")) continue;          // the registrations, not a claim site
    sites.push(...comparisons(f, readFileSync(join(host, f), "utf8")));
  }

  const offenders = [];
  let judged = 0, unresolved = 0;
  for (const c of sites) {
    if (!c.tool) { unresolved++; continue; }
    const op = tools.get(c.tool) ?? (c.tool.includes(".") ? c.tool : null);
    const gd = op ? dispatch.get(op) : null;
    if (!gd) { unresolved++; continue; }
    judged++;
    const fields = consts.get(gd);
    if (!fields || !fields.has(c.field)) continue;
    if (fields.get(c.field).replace(/^"|"$/g, "") !== c.lit) continue;
    offenders.push({ ...c, op, gd, lit: fields.get(c.field) });
  }

  let constCount = 0;
  for (const m of consts.values()) constCount += m.size;
  return {
    pop: { consts: constCount, ops: dispatch.size, tools: tools.size, sites: sites.length, judged, unresolved },
    offenders,
  };
}

// 🔴 THE COMPOSITION, TAKEN APART BECAUSE THE REVERSE SWEEP COULD NOT REACH IT.
// `main()` used to call `scan()`, hand the result to `judge()` and map the verdict to an
// exit code, all in one body — and on a healthy tree `offenders` is empty, so
// `judge(pop, offenders)` could have been written `judge(pop, [])`, or `main()` could have
// returned 0 outright, and every gate in this repo would still have passed. That is 173's
// G3, 174's H5, 175's G3 and 176's G10 — the FIFTH instance of one mistake: a term that is
// only ever exercised by a failure the shipped tree does not contain.
//
// Both halves now take their input as a parameter, so both are reachable from the
// self-test: `report()` with a hand-built verdict, and `run()` against a fixture that
// contains a real offender.
export function run(host = HOST, gdPath = GD) {
  const { pop, offenders } = scan(host, gdPath);
  return judge(pop, offenders);
}

export function report(r, log = console.log) {
  for (const l of r.lines) log(l);
  return r.failed ? 1 : 0;
}

export function main() {
  return report(run());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main());

#!/usr/bin/env node
// boundary_gate.mjs — session 177, widened in 178. THE TAUTOLOGY ON THE OTHER SIDE OF THE BRIDGE.
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
// ── 178: THE POPULATION HAD FOUR HOLES, AND THEY HELD FIVE LIVE TAUTOLOGIES ───────────
//
// 177 shipped this gate reading ONE dispatcher, ONE return spelling and ONE comparison
// idiom, and printed `judged=78` as though that were the population. It was not.
//
//   H1  ONE DISPATCHER.  The addon has two. `runtime_bridge.gd` carries its own
//       `_dispatch`, its own `_ok`/`_err`, and 22 registered tools resolve into it. Every
//       comparison over a runtime reply landed in `unresolved` — printed, and printed is
//       not judged. FOUR of 178's five defects were in there.
//   H2  ONE RETURN SPELLING.  `"ping": return _ok(_ping())` names the WRAPPER, so the arm
//       resolved to `_ok` — truthy, so the claim COUNTED AS JUDGED and could never be
//       flagged. Five arms, one live claim. And twelve handlers build their reply one hop
//       away, which the `_ok({…})` reader could not see at all (177 §10.2).
//   H3  ONE COMPARISON IDIOM.  `x.f === lit` is the minority spelling: `test-integration/`
//       writes `assert.equal(x.f, lit)` roughly as often, and it is the SAME claim.
//   H4  NO CONDUITS.  `const inject = (event) => call("runtime_inject_input", {event})` is
//       one hop from a comparison to a tool. 177 §10.18 declined to follow it for the
//       verdict finder on a measurement of +3 sites and 0 defects. Here it is +1 defect.
//
// 🔴 AND WIDENING A POPULATION IS WHERE FALSE POSITIVES COME FROM, so three rules were
// added at the same time, each of which stopped an invented defect:
//
//   ABSENCE IS NOT SAMENESS.  `_compare_images` returns `"reason": "dimension_mismatch"`
//   on one `_ok` path and has NO `reason` key on the other. "Every occurrence is the same
//   literal" answered yes; the field is still falsifiable, because `undefined` is the
//   other outcome. A field must be present on EVERY reply path, not merely consistent
//   wherever it appears. That alone would have invented a defect in runtime-screenshot.
//
//   AN UNREADABLE RETURN POISONS ITS WHOLE OPERATION.  `_asset_gen_placeholder` returns
//   `_ok(desc)` where `desc` is a local dict built line by line. If some return paths of
//   an operation cannot be read, no field of that operation can be called constant on
//   "every" path — so the operation yields nothing and is counted as `opaque`.
//
//   A CONDUIT IS FOLLOWED ONLY IF IT THROWS.  `raw()` does not throw on `isError`, so
//   `r.emitted === true` over a raw() receiver really does separate success from failure.
//   Two conduits in the tree bottom out in a non-throwing helper; both stay unjudged.
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
// That is 175 §3's defect, committed again in 176 §5, and committed a third time in 177 by
// the session that read both. **A lesson recorded in a handoff is a lesson about the past
// tense** (176 §11.21). So every comparison is bound to the call that PRODUCED its
// receiver — inline `(await call("t")).f`, `const x = await call("t", …)` then `x.f`, or
// one hop through a throwing conduit — and the tool is resolved to a GDScript function
// through two real lookups:
//
//   tool name --registerTool's own call("<op>") argument--> op string
//   op string --the addon's dispatchers, read from the .gd--> _gd_function
//
// A comparison whose receiver does not resolve is NOT JUDGED and is counted separately.
// Silence about what an instrument could not see is the thing every session since 170 has
// been paying for.
//
// 🔴 IT DOES NOT FLAG A HARD-WIRED FIELD THAT NOBODY ASSERTS. `_screenshot.mime` is
// `"image/png"` unconditionally and that is fine — a constant in a response is only a
// defect when something DRESSES IT AS EVIDENCE. The population is the intersection, not
// the constants.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// fileURLToPath, not .pathname — the repo lives under "Godot MCP" (174 §10).
const HOST = fileURLToPath(new URL("../", import.meta.url));

// 🔴 BOTH DISPATCHERS, NAMED. 177 read the first and called the result "the population".
export const PLANES = ["operations.gd", "runtime_bridge.gd"];
const GD = PLANES.map((f) => join(HOST, "../addons/breakpoint_mcp", f));

// A value that cannot vary: a GDScript literal with no identifier and no call in it.
const LITERAL = /^(true|false|-?\d+(\.\d+)?|"[^"]*")$/;

// The two wrappers every handler ends in. Neither is a handler.
const WRAPPERS = new Set(["_ok", "_err"]);

// ───────────────────────────────────────────────────────── the addon: dispatchers ──
/**
 * `"filesystem.scan":` / `return _filesystem_scan(params)` — the addon's own match
 * statement, read rather than re-spelled. Exported so the self-test can drive it with a
 * source that has no file behind it.
 *
 * 🔴 THE ONE HOP (178, H2). Five arms are spelled `"ping": return _ok(_ping())`. The next
 * line names `_ok`, which is the WRAPPER, and 177 recorded it as the handler: truthy, so
 * the claim counted as JUDGED, and `_ok` has no fields, so it could never be flagged.
 * Judged-but-unjudgeable is the worst reading an instrument can print. When the returned
 * function is a wrapper, the handler is its first argument — and if that is not a call to
 * a `_function` either, the arm resolves to NOTHING rather than to a guess.
 */
export function dispatchMap(gdText) {
  const out = new Map();
  const lines = gdText.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const k = lines[i].match(/^\s*"([\w.]+)":\s*$/);
    if (!k) continue;
    const v = lines[i + 1].match(/^\s*return (_\w+)\(([\s\S]*)$/);
    if (!v) continue;
    let gd = v[1];
    if (gd === "_ok") {
      const inner = v[2].match(/^(_\w+)\(/);
      if (!inner) continue;                 // `_ok({…})` inline, or `_ok(local)` — no handler to name
      gd = inner[1];
    }
    if (WRAPPERS.has(gd)) continue;         // `return _err(...)` is not a reply builder
    out.set(k[1], gd);
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

/** Every `func name(...)` and the lines of its body, in source order. */
function bodies(lines) {
  const out = new Map();
  let fn = null;
  for (const l of lines) {
    const f = l.match(/^func (\w+)\(/);
    if (f) { fn = f[1]; out.set(fn, []); continue; }
    if (fn) out.get(fn).push(l);
  }
  return out;
}

// The two reply-dict spellings, each in its one-line and its multi-line form.
const OK_DICT = { one: /_ok\(\{(.*)\}\)/, open: /_ok\(\{\s*$/, close: /^\s*\}\)/ };
const PLAIN_DICT = { one: /^\s*return \{(.*)\}\s*$/, open: /^\s*return \{\s*$/, close: /^\s*\}\s*$/ };

/** Read every dict of one spelling out of a function body. */
function dictsIn(body, spell) {
  const out = [];
  for (let i = 0; i < body.length; i++) {
    const one = body[i].match(spell.one);
    if (one) { out.push(splitTop(one[1])); continue; }
    if (spell.open.test(body[i])) {
      let j = i + 1, buf = "";
      while (j < body.length && !spell.close.test(body[j])) { buf += body[j] + "\n"; j++; }
      out.push(splitTop(buf));
      i = j;
    }
  }
  return out;
}

/**
 * Which response fields are an unconditional literal on EVERY return path of an operation?
 *
 * 🔴 "EVERY RETURN PATH" IS THE WHOLE TEST, and it is why this is not a grep. An operation
 * with two `_ok(...)` returns — one literal, one derived — has a field that CAN vary, and
 * a claim over it is honest. `_err` returns are irrelevant: they never reach a comparison,
 * because `call()` throws on them.
 *
 * 178 adds the two ways "every" was being read too loosely, each of which invented a
 * defect before it was written down:
 *
 *   🔴 ABSENCE IS NOT SAMENESS. A key that appears on one reply path with a literal and is
 *   MISSING from another is not a constant — `undefined` is the second outcome, so the
 *   claim can fail. `_compare_images.reason` is exactly this and was flagged before the
 *   `seen === rets.length` clause below.
 *
 *   🔴 AN UNREADABLE RETURN POISONS THE WHOLE OPERATION. `_asset_gen_placeholder` returns
 *   `_ok(desc)`, a dict assembled line by line. "Literal on every path" cannot be answered
 *   when a path cannot be read, so such an operation yields NOTHING and is reported as
 *   `opaque`. An under-reach that prints its own size beats a guess.
 *
 * Returns { fields, opaque } — `opaque` naming the operations whose replies it could not
 * read, and `reads` counting the reply dicts it DID read, which is what RETURN_FLOOR pins.
 */
export function hardwired(gdText) {
  const lines = gdText.split("\n");
  const body = bodies(lines);
  const targets = new Set(dispatchMap(gdText).values());
  const fields = new Map();
  const opaque = [];
  let reads = 0;

  for (const [fn, lns] of body) {
    if (!fn.startsWith("_")) continue;
    const rets = dictsIn(lns, OK_DICT);
    // 🔴 THE ONE HOP, on the return side: `return _ok(_main_screen_state())` builds the
    // reply in a function one call away. Read ITS plain `return {…}` dicts as reply dicts.
    const delegated = lns.map((l) => l.match(/return _ok\((_\w+)\(/)).filter(Boolean).map((m) => m[1]);
    for (const b of delegated) rets.push(...dictsIn(body.get(b) ?? [], PLAIN_DICT));
    // A dispatcher arm may name the builder itself (`"ping": return _ok(_ping())`), in
    // which case the builder's own plain returns ARE the operation's replies.
    if (!rets.length && targets.has(fn)) rets.push(...dictsIn(lns, PLAIN_DICT));
    // 🔴 HOW MANY REPLY RETURNS COULD NOT BE READ. `_asset_gen_placeholder` has three
    // `return _ok(descN)` paths and none of them is a dict this reader can see. "Literal
    // on EVERY path" is unanswerable when a path is invisible, so the operation yields
    // nothing rather than a claim about the paths that happened to be legible. Counted
    // and printed, because an under-reach that states its own size is not silence.
    const okReturns = lns.filter((l) => /return _ok\(/.test(l)).length;
    const readable = dictsIn(lns, OK_DICT).length
      + lns.filter((l) => /return _ok\(_\w+\(/.test(l))
           .filter((l) => dictsIn(body.get(l.match(/return _ok\((_\w+)\(/)[1]) ?? [], PLAIN_DICT).length > 0).length;
    if (okReturns > 0 && readable < okReturns) { opaque.push(fn); continue; }
    // 🔴 AND AN ARM TARGET THAT YIELDED NOTHING AT ALL IS OPAQUE, NOT ABSENT.
    // `_screenshot_diff` ends `return _compare_images(...)` — a THIRD delegation spelling,
    // one this reader does not follow. Before this line it fell out of the loop silently
    // and its reply fields simply did not exist as far as any number printed. An
    // under-reach that is not counted is indistinguishable from coverage.
    if (!rets.length) { if (targets.has(fn)) opaque.push(fn); continue; }
    reads += rets.length;

    const seen = new Map();
    for (const r of rets) for (const { key, val } of r) {
      const e = seen.get(key) ?? { lits: new Set(), derived: 0, n: 0 };
      LITERAL.test(val) ? e.lits.add(val) : e.derived++;
      e.n++;
      seen.set(key, e);
    }
    const f = new Map();
    for (const [k, e] of seen) if (e.derived === 0 && e.lits.size === 1 && e.n === rets.length) f.set(k, [...e.lits][0]);
    if (f.size) fields.set(fn, f);
  }
  return { fields, opaque, reads };
}

// ─────────────────────────────────────────── the host: tool -> op string ──
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

// ──────────────────────────────────────────────── the probes: conduits (178, H4) ──
/**
 * `const inject = (event) => call("runtime_inject_input", { event, confirm: true })` —
 * one hop between a comparison and the tool that produced its receiver. 177 §3 measured
 * this exact shape for the verdict finder and declined to follow it on +3 sites and 0
 * defects; here it is worth one real defect, so it is followed.
 *
 * 🔴 BUT ONLY THROUGH A HELPER THAT THROWS ON `isError`, AND THAT IS THE WHOLE SAFETY
 * ARGUMENT. The tautology exists because `call()` throws, so the error paths never reach
 * the comparison. `raw()` does NOT throw: over a raw() receiver, `r.emitted === true`
 * really does separate success from failure, and flagging it would be an invented defect.
 * Two conduits in this tree bottom out in a non-throwing helper. Both stay unjudged.
 *
 * One hop, one file, and exactly one string-literal call inside the body — a helper that
 * reaches two tools is dropped, for the same reason an ambiguous registration is.
 */
/**
 * 🔴 179: EXTRACTED, BECAUSE THE THROWING TEST WAS ENFORCED ON THE HOP AND NOT ON THE
 * DIRECT CALL. `conduits()` asked "does the helper this wrapper bottoms out in throw?" and
 * refused two wrappers over `raw()`. `comparisons()` asked nothing at all about a receiver
 * spelled `await raw("runtime_node_add", …)` — seventeen of them, every one asserting
 * `.isError === true`, all counted as `judged` against an operation whose `_err` paths the
 * gate had already decided were irrelevant *because `call()` throws*. Over a `raw()`
 * receiver that premise is false. Same rule, same file, one spelling exempt.
 *
 * Returns the locally-DEFINED helpers and which of them throw on `isError`. Only local
 * definitions: an imported `call` cannot be read from here, and refusing what cannot be
 * read would be a guess in the other direction.
 */
export function helpers(file, text) {
  const s = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    /\.ts$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const bodyOf = new Map();
  const collect = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
        && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)))
      bodyOf.set(n.name.text, n.initializer.body);
    if (ts.isFunctionDeclaration(n) && n.name && n.body) bodyOf.set(n.name.text, n.body);
    ts.forEachChild(n, collect);
  };
  collect(s);

  const throwers = new Set();
  for (const [name, body] of bodyOf) {
    let t = false;
    const f = (m) => { if (ts.isThrowStatement(m) && /isError/.test(body.getText(s))) t = true; ts.forEachChild(m, f); };
    f(body);
    if (t) throwers.add(name);
  }
  return { s, bodyOf, throwers, defined: new Set(bodyOf.keys()) };
}

export function conduits(file, text, h = helpers(file, text)) {
  const { s, bodyOf, throwers } = h;
  const out = new Map();
  for (const [name, body] of bodyOf) {
    if (throwers.has(name)) continue;
    const hits = [];
    const f = (m) => {
      if (ts.isCallExpression(m) && ts.isIdentifier(m.expression)) {
        const a = m.arguments[0];
        if (a && ts.isStringLiteralLike(a)) hits.push({ callee: m.expression.text, tool: a.text });
      }
      ts.forEachChild(m, f);
    };
    f(body);
    if (hits.length === 1 && throwers.has(hits[0].callee)) out.set(name, hits[0].tool);
  }
  return out;
}

// ─────────────────────────────────── the probes: comparisons, receiver-bound ──
const down = (e) => {
  let v = e;
  while (ts.isAwaitExpression(v) || ts.isParenthesizedExpression(v) || ts.isNonNullExpression(v)) v = v.expression;
  return v;
};
// `r.structuredContent.path` and `r.sc.path` are the SAME claim as `r.path` — the host
// envelope, not a field the addon wrote. Strip it so the receiver is the tool call again.
const ENVELOPE = ["structuredContent", "sc", "result"];
const strip = (e) => { let v = e; while (ts.isPropertyAccessExpression(v) && ENVELOPE.includes(v.name.text)) v = v.expression; return v; };

/**
 * Every `<receiver>.<field> === <literal>` AND every `assert.equal(<receiver>.<field>,
 * <literal>)` in one source, with the receiver resolved back to the tool call that
 * produced it. `tool: null` means "not judged" and is counted and printed.
 *
 * 🔴 THE SECOND IDIOM IS NOT A CONVENIENCE (178, H3). 177 shipped reading `===` only and
 * printed the result as the population. `test-integration/` writes `assert.equal(x.f, lit)`
 * about as often as it writes `===`, and it is the same claim about the same reply — four
 * of 178's five defects are spelled that way and none of them was visible.
 */
export function comparisons(file, text, conduit = new Map(), h = helpers(file, text)) {
  const s = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    /\.ts$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const lines = text.split("\n");
  // 🔴 179: WHY A RECEIVER WAS REFUSED IS PART OF THE READING. A site with `tool: null` and
  // no `drop` is an honest under-reach — nothing bound it. A site with a `drop` is a
  // receiver this gate COULD have resolved and declined to, and the count of those belongs
  // on the population line beside `unresolved` and `opaque`.
  const toolOf = (e, drop = {}) => {
    const d = down(e);
    if (ts.isCallExpression(d)) {
      // 🔴 THE CONDUIT IS CHECKED FIRST, AND THE SELF-TEST IS WHY. `rm("Host/Thing")` and
      // `read("bound_strength")` are conduits whose first argument is a string that is NOT
      // a tool name — taking it as one resolved the receiver to a tool nothing registers,
      // which fails CLOSED (unjudged) and so would never have shown up as a red gate.
      if (ts.isIdentifier(d.expression) && conduit.has(d.expression.text)) return conduit.get(d.expression.text);
      // 🔴 AND THE THROWING TEST, ON THE DIRECT SPELLING (179). `conduits()` refuses a
      // wrapper over `raw()` because `raw()` does not throw, so the error path DOES reach
      // the comparison and the claim really can fail. `await raw("runtime_node_add", …)`
      // is the same receiver with the hop spelled out, and 178 judged seventeen of them.
      if (ts.isIdentifier(d.expression) && h.defined.has(d.expression.text) && !h.throwers.has(d.expression.text)) {
        // 🔴 AND WHAT IT WOULD HAVE SAID IS RECORDED, BECAUSE THE COUNT ALONE IS USELESS.
        // Most refusals here are `parsePathLedger("…")` and `dispatchMap("…")` — helpers
        // whose first argument is a string that was never a tool name. Those were always
        // unjudgeable; folding them into a new counter would report 172 where the finding
        // is 18. `scan()` counts only the refusals whose `wouldBe` names a REGISTERED
        // tool, which is the population this rule actually took away.
        const a0 = d.arguments[0];
        drop.why = "nonthrowing";
        drop.wouldBe = a0 && ts.isStringLiteralLike(a0) ? a0.text : null;
        return null;
      }
      const a = d.arguments[0];
      if (a && ts.isStringLiteralLike(a)) return a.text;
    }
    return null;
  };
  // 🔴 THE BINDING MAP IS LEXICALLY SCOPED (179), AND IT WAS FILE-SCOPED AND LAST-WINS.
  //
  //     for (const spelling of ROOT_SPELLINGS) {
  //       const r = await raw("runtime_node_add", …);   // one block
  //       assert.equal(r.isError, true, …);
  //     }
  //     for (const path of leftovers) {
  //       const r = await rm(path);                     // another block, another tool
  //       assert.equal(r.removed, true, …);
  //     }
  //
  // One flat `Map<name, tool>` for the whole file meant the SECOND declaration overwrote
  // the first and every `r.field` claim above it was judged against `runtime_node_remove`.
  // Twenty identifiers in this tree are declared more than once; nine judged claims rested
  // on one, and SIX were judged against an operation other than the one that replied.
  //
  // 🔴 AND THE FIRST FIX FOR THIS WAS WRONG IN A WAY ONLY THE SWEEP COULD SHOW. Refusing
  // every multiply-declared name — the rule `toolOps()` and `conduits()` already apply —
  // made the gate green under mutant G19, which restores one of the five defects 178 had
  // just fixed. A narrowing that is CORRECT can still cost real coverage, and the reverse
  // sweep is the only thing in this repo that can say so. Scope resolution keeps both:
  // each `r` resolves to its own declaration, and nothing is refused for being reused.
  const SCOPE = (n) => ts.isSourceFile(n) || ts.isBlock(n) || ts.isModuleBlock(n) || ts.isCaseBlock(n)
    || ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n)
    || ts.isCatchClause(n) || ts.isArrowFunction(n) || ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n);
  const scopes = new Map();
  const slot = (scope, id) => {
    if (!scopes.has(scope)) scopes.set(scope, new Map());
    const m = scopes.get(scope);
    if (!m.has(id)) m.set(id, { tools: new Set(), drops: new Set(), wouldBe: new Set() });
    return m.get(id);
  };
  const scopeOf = (n) => { let p = n.parent; while (p && !SCOPE(p)) p = p.parent; return p ?? s; };
  const record = (scope, id, init) => {
    const drop = {};
    const t = toolOf(init, drop);
    if (t) slot(scope, id).tools.add(t);
    else if (drop.why) {
      const sl = slot(scope, id);
      sl.drops.add(drop.why);
      if (drop.wouldBe) sl.wouldBe.add(drop.wouldBe);
    }
  };
  const bind = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer)
      record(scopeOf(n), n.name.text, n.initializer);
    // 🔴 A REASSIGNMENT IS A SECOND BINDING IN THE SAME SCOPE, AND THAT ONE REALLY IS
    // AMBIGUOUS. Two `const`s of a name in one block is a syntax error, so after scope
    // resolution the ambiguity rule would be dead code — except for `let r = await
    // call(A); … r = await call(B);`, where nothing in the source says which reply a later
    // `r.field` is about. Refused and counted, not guessed.
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left))
      record(scopeOf(n), n.left.text, n.right);
    ts.forEachChild(n, bind);
  };
  bind(s);
  /** The tool an identifier resolves to at a USE SITE, walking outward from its scope. */
  const ofName = (id, at) => {
    let p = scopeOf(at);
    while (p) {
      const b = scopes.get(p)?.get(id);
      if (b) {
        if (b.tools.size === 1 && b.drops.size === 0) return { tool: [...b.tools][0], drop: null, wouldBe: null };
        if (b.tools.size === 0) return { tool: null, drop: [...b.drops][0] ?? null, wouldBe: [...b.wouldBe][0] ?? null };
        // two tools in ONE scope — a tool and a refusal is as ambiguous as two tools
        return { tool: null, drop: "ambiguous", wouldBe: [...b.tools][0] ?? null };
      }
      if (ts.isSourceFile(p)) break;
      p = scopeOf(p);
    }
    return { tool: null, drop: null, wouldBe: null };
  };

  const out = [];
  const isLit = (b) => b.kind === ts.SyntaxKind.TrueKeyword || b.kind === ts.SyntaxKind.FalseKeyword
    || ts.isNumericLiteral(b) || ts.isStringLiteralLike(b);
  const push = (node, acc, litNode, idiom) => {
    const recv = strip(down(acc.expression));
    const line = s.getLineAndCharacterOfPosition(node.getStart(s)).line;
    const inlineDrop = {};
    const inline = toolOf(recv, inlineDrop);
    const named = !inline && ts.isIdentifier(recv) ? ofName(recv.text, recv) : { tool: null, drop: null, wouldBe: null };
    out.push({
      file, line: line + 1, field: acc.name.text,
      lit: litNode.getText(s).replace(/^["']|["']$/g, ""),
      tool: inline ?? named.tool,
      drop: inline ? null : (inlineDrop.why ?? named.drop),
      wouldBe: inline ? null : (inlineDrop.wouldBe ?? named.wouldBe ?? null),
      text: lines[line].trim(), idiom,
    });
  };
  const visit = (n) => {
    if (ts.isBinaryExpression(n)
        && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(n.operatorToken.kind)) {
      for (const [a, b] of [[n.left, n.right], [n.right, n.left]]) {
        const acc = down(a);
        if (ts.isPropertyAccessExpression(acc) && isLit(b)) push(n, acc, b, "===");
      }
    }
    if (ts.isCallExpression(n) && /(^|\.)(equal|strictEqual)$/.test(n.expression.getText(s)) && n.arguments.length >= 2) {
      const acc = down(n.arguments[0]);
      if (ts.isPropertyAccessExpression(acc) && isLit(n.arguments[1])) push(n, acc, n.arguments[1], "assert");
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

// 🔴 SIX FLOORS, BECAUSE THERE ARE SIX WAYS THIS COLLAPSES INTO A GREEN LIE, and each one
// alone leaves the others reporting a clean tree. Measured on the tree this ships with,
// then set below the measurement — a floor at the exact reading reddens on the next honest
// edit, and a gate that reds on good work gets deleted.
//
//   CONST   `hardwired()` stops recognising `_ok({...})`      -> 0 constants, 0 offenders
//   OP      `dispatchMap()` stops recognising the match arms  -> no tool resolves
//   TOOL    `toolOps()` stops recognising `registerTool`      -> no tool resolves
//   SITE    `comparisons()` stops recognising the idioms      -> 0 sites, 0 offenders
//   RETURN  🆕 the reply-dict READER goes quiet. 177 §10.2's hole exactly: CONST_FLOOR
//           counts fields FOUND, not returns READ, so dropping the multi-line `_ok({`
//           spelling loses twelve returns and every floor above stays green.
//   PLANE   🆕 a dispatcher file stops resolving. 177 read one of the two and called the
//           result the population; nothing would have reddened if it had read zero.
//   JUDGED  🆕 179. THE SEVENTH, AND THE ONE THAT WAS MISSING FOR TWO SESSIONS. Every
//           floor above pins an INPUT — constants found, arms read, tools registered,
//           sites found, returns read, planes opened. None of them pins the OUTPUT. The
//           six could all hold while `comparisons()` resolved not one receiver, and the
//           gate would print `BOUNDARY_GATE ok — 0 judged claim(s), none compared against
//           a constant` and exit 0. 178 §10.22 said an instrument's population is the
//           least audited number it prints; `judged` is that number here, and it was the
//           only population in this file with nothing under it.
export const CONST_FLOOR = 20;    // measured 25 fields across both planes
export const OP_FLOOR = 150;      // measured 177 dispatcher arms across both planes
export const TOOL_FLOOR = 150;    // measured 171 tools resolved to exactly one operation
export const SITE_FLOOR = 1500;   // measured 1816 literal comparisons in the walked tree
export const RETURN_FLOOR = 150;  // measured 187 reply dicts actually read
export const PLANE_FLOOR = 2;     // operations.gd and runtime_bridge.gd
export const JUDGED_FLOOR = 150;  // measured 185 claims resolved to an operation (179)
//   HELPER  🆕 182. AND THE TWO THAT RUN ONCE PER FILE, WHICH IS WHY NEITHER OF THE
//   CONDUIT  seven above could see them. `helpers()` and `conduits()` are called inside
//           the walk — ninety-nine times each — and their outputs were counted NOWHERE.
//           Every floor above pins a population derived ONCE, so a resolver that answers
//           for the first file and then goes quiet satisfies all seven. Measured with a
//           LATE blind (call 1 honest, calls 2..99 blinded), which is 181 §6's shape and
//           the thing `instrument_gate.py` could not construct until this session:
//
//             conduits blinded late -> judged 185 -> 162, floor 150, ok, exit 0
//             helpers  blinded late -> nonthrowing 18 -> 0, judged 185 -> 180, exit 0
//
//           🔴 AND `nonthrowing` IS NOT THE THING TO FLOOR, though it is the number that
//           collapsed hardest. It counts receivers REFUSED, so honest work on those
//           eighteen drives it toward zero and a floor there would fire on the fix. The
//           population that only a working resolver can produce is what it RESOLVED:
//           locally-defined helpers, and conduit entries. Those are floored instead.
export const HELPER_FLOOR = 350;  // measured 510 locally-defined helpers across 99 files
export const CONDUIT_FLOOR = 15;  // measured 24 conduit entries across 8 of those files

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
    + `reads=${pop.reads}/${RETURN_FLOOR} planes=${pop.planes}/${PLANE_FLOOR} `
    + `opaque=${pop.opaque} ambiguous=${pop.ambiguous ?? 0} nonthrowing=${pop.nonthrowing ?? 0} `
    + `unresolved=${pop.unresolved} judged=${pop.judged}/${JUDGED_FLOOR} offenders=${offenders.length}`);
  // 🔴 THE PER-FILE HALF, ON ITS OWN LINE (182). The summary above is one population per
  // WHOLE-TREE derivation; these two are summed across ninety-nine files, and a reader
  // comparing two CI logs needs to see them move independently of `judged`.
  say(`BOUNDARY_GATE_PERFILE helper_defs=${pop.helperDefs ?? 0}/${HELPER_FLOOR} `
    + `conduit_entries=${pop.conduitEntries ?? 0}/${CONDUIT_FLOOR}`);

  for (const [what, n, floor, why] of [
    ["CONSTS", pop.consts, CONST_FLOOR, "the addon stopped yielding hard-wired fields — the `_ok({…})` reader no longer matches"],
    ["OPS", pop.ops, OP_FLOOR, "a dispatcher stopped resolving — no reply can be traced to the function that built it"],
    ["TOOLS", pop.tools, TOOL_FLOOR, "registerTool stopped resolving to an operation string — every comparison becomes unjudgeable"],
    ["SITES", pop.sites, SITE_FLOOR, "no comparison against a literal was found at all — the finder, not the tree, went quiet"],
    ["RETURNS", pop.reads, RETURN_FLOOR, "the reply-dict reader went quiet — a spelling it used to handle is now invisible, and no other floor can see that"],
    ["PLANES", pop.planes, PLANE_FLOOR, "an addon dispatcher file stopped being read — 177 read one of two and printed the result as the population"],
    ["JUDGED", pop.judged, JUDGED_FLOOR, "the number this whole gate is about went quiet. Every other floor pins an INPUT; this one pins the OUTPUT, and until 179 the gate could resolve zero claims and still print `ok — 0 judged claim(s)`"],
    // 🔴 182. THE TWO DERIVED ONCE PER FILE. `?? 0` deliberately: a `pop` built before
    // these existed reads as a COLLAPSE rather than as an exemption — an absent
    // population is the loudest case, not the quietest (172 §6's lesson about the lock
    // fields check 14 skipped when they were missing).
    ["HELPERS", pop.helperDefs ?? 0, HELPER_FLOOR, "the local-helper reader answered for the first file and stopped. It runs once per file, so no whole-tree floor above can see it: measured, a LATE blind takes nonthrowing 18 -> 0 and judged 185 -> 180, and all seven floors hold"],
    ["CONDUITS", pop.conduitEntries ?? 0, CONDUIT_FLOOR, "the conduit resolver answered for the first file and stopped — measured, a LATE blind takes judged 185 -> 162 against a floor of 150, and the gate prints ok"],
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
    say(`   ${d.tool} -> ${d.op} -> ${d.gd} (${d.plane}), and .${d.field} is ${d.lit} on EVERY`);
    say(`   return path of that operation. call() throws on isError, so every other path`);
    say(`   escapes before this line — the literal the addon typed is the only value this`);
    say(`   can hold. The claim has two outcomes: "true", and "never reached". Assert`);
    say(`   something DERIVED (a field the operation computes, or a read-back from the`);
    say(`   engine), or assert the response SHAPE and write down that it is a constant.`);
  }

  say(out.failed ? `\nBOUNDARY_GATE 🔴 FAILED` : `BOUNDARY_GATE ok — ${pop.judged} judged claim(s), none compared against a constant`);
  return out;
}

export function scan(host = HOST, gdPaths = GD) {
  const paths = Array.isArray(gdPaths) ? gdPaths : [gdPaths];
  const planes = [];
  for (const p of paths) {
    const text = readFileSync(p, "utf8");
    const { fields, opaque, reads } = hardwired(text);
    planes.push({ name: p.split("/").pop(), dispatch: dispatchMap(text), fields, opaque, reads });
  }
  const tools = toolOps(walk(host, "src", /\.ts$/).map((f) => [f, readFileSync(join(host, f), "utf8")]));

  const sites = [];
  // 🔴 COUNTED, BECAUSE THESE TWO RUN ONCE PER FILE AND NOTHING ABOVE THEM CAN SEE A
  // RESOLVER THAT ANSWERS ONCE AND STOPS (182). Sums across the walk, one population
  // each — never added together (172 §6): a conduit collapse and a helper collapse are
  // different failures, and a total would let either hide behind the other.
  let helperDefs = 0, conduitEntries = 0;
  for (const f of walk(host)) {
    if (f.startsWith("src/")) continue;          // the registrations, not a claim site
    const text = readFileSync(join(host, f), "utf8");
    const h = helpers(f, text);
    helperDefs += h.defined.size;
    const cd = conduits(f, text, h);
    conduitEntries += cd.size;
    sites.push(...comparisons(f, text, cd, h));
  }

  const offenders = [];
  let judged = 0, unresolved = 0, ambiguous = 0, nonthrowing = 0;
  for (const c of sites) {
    // 🔴 A REFUSAL IS ONLY WORTH COUNTING WHERE IT TOOK SOMETHING AWAY. A receiver
    // refused because its helper does not throw is only interesting if that helper was
    // reaching a REGISTERED TOOL; `parsePathLedger("…")` was never judgeable and folding
    // it in would print 172 where the finding is 18.
    if (c.drop === "ambiguous") ambiguous++;
    if (c.drop === "nonthrowing" && c.wouldBe && tools.has(c.wouldBe)) nonthrowing++;
    if (!c.tool) { unresolved++; continue; }
    const op = tools.get(c.tool) ?? (c.tool.includes(".") ? c.tool : null);
    const plane = op ? planes.find((p) => p.dispatch.has(op)) : null;
    if (!plane) { unresolved++; continue; }
    judged++;
    const gd = plane.dispatch.get(op);
    const fields = plane.fields.get(gd);
    if (!fields || !fields.has(c.field)) continue;
    if (fields.get(c.field).replace(/^"|"$/g, "") !== c.lit) continue;
    offenders.push({ ...c, op, gd, lit: fields.get(c.field), plane: plane.name });
  }

  let consts = 0, ops = 0, reads = 0, opaque = 0;
  for (const p of planes) {
    for (const m of p.fields.values()) consts += m.size;
    ops += p.dispatch.size; reads += p.reads; opaque += p.opaque.length;
  }
  return {
    pop: { consts, ops, tools: tools.size, sites: sites.length, reads, opaque, planes: planes.length, judged, unresolved, ambiguous, nonthrowing, helperDefs, conduitEntries },
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
// ══ 🆕 233 — THE DISCOVER HALF, AND `PLANES` IS THE ROSTER IT IS ABOUT ═══════════════
//
// 🔴 `PLANES` IS TWO FILE NAMES AND THE ADDON HAS EIGHT `.gd` FILES. Every floor in this gate is
// about a reader going quiet over the population it already reads; not one of them can
// see a population that GREW. `PLANE_FLOOR = 2` catches `operations.gd` becoming
// unreadable and is satisfied, permanently, by a tree that ships a third dispatcher — the
// gate would grade two of three and print `ok` about the two, which is 232 §5.1's finding
// with `INSTRUMENTS` swapped for `PLANES`.
//
// 🔴 THE DISCRIMINATOR IS THE DISPATCHER SHAPE, MEASURED — NOT A NAME. A plane is a file
// that maps an operation string onto a handler: it carries `"noun.verb":` arms AND
// `func _noun_verb(params…)` definitions. Measured over the live addon, the two halves
// agree exactly and name exactly the two files `PLANES` names:
//
//     addons/breakpoint_mcp/*.gd             8 file(s)
//     dispatch keys AND params handlers      operations.gd (154/146), runtime_bridge.gd (24/22)
//     dispatch keys and no handlers          none
//     handlers and no dispatch keys          none
//
// The alternative was a suffix or a directory convention, refused for `instrument_gate.py`'s
// reason one gate over: a rule scoped to a SPELLING rots in the direction the spelling
// does not cover (183 §12.29).
//
// 🔴 AND THE WALK IS SCOPED TO THE CANONICAL ADDON, WHICH IS A LIMIT WITH A REASON RATHER
// THAN A SILENCE. `example/addons/breakpoint_mcp/` and `example-csharp/addons/breakpoint_mcp/`
// hold copies, and contract check 24b asserts they are BYTE-IDENTICAL to this one. A
// dispatcher that appeared in a copy and not here is that check's refusal, not this one's;
// widening the walk would put the same file in the population three times and make the
// dispatch floor mean a third of what it says.
export const ADDON_DIR = join(HOST, "..", "addons", "breakpoint_mcp");
const DISPATCH_KEY = /^\s*"[a-z_]+\.[a-z_0-9]+"\s*:/m;
const HANDLER_DEF = /^func _[a-z_0-9]+\(\s*params/m;

/** Does this GDScript file map operation strings onto handlers? Both halves, never one. */
export function dispatcherShaped(text) {
  return DISPATCH_KEY.test(text) && HANDLER_DEF.test(text);
}

// 🔴 EMPTY, AND THE RULE IS THEREFORE PROVED ON FIXTURES RATHER THAN ON A POPULATION —
// the U1 lesson `instrument_gate.py`'s `DISCOVER_EXEMPT` states in full. A row here needs
// a REASON a reader can check, not a name (174 §5).
export const PLANE_EXEMPT = {};

// 🔴 TWO FLOORS, NEVER A SUM (172 §6). A walk pointed at a directory that moved reads
// zero files and every check below passes over nothing; a walk that still reads ten while
// `dispatcherShaped` stops recognising an arm is the same collapse one layer in, and the
// file count cannot see it. Measured: 10 walked, 2 dispatcher-shaped. Floored from BELOW
// (198 §36) so a plane being ADDED never reddens a healthy tree — only being missed does.
export const PLANE_WALK_FLOOR = 6;
export const PLANE_DISPATCH_FLOOR = 2;

/** (name, is-it-dispatcher-shaped) for every .gd in the canonical addon directory. */
export function planeWalk(dir = ADDON_DIR) {
  let names;
  try {
    names = readdirSync(dir).filter((f) => f.endsWith(".gd")).sort();
  } catch {
    return [];
  }
  return names.map((n) => [n, dispatcherShaped(readFileSync(join(dir, n), "utf8"))]);
}

/**
 * PURE over its inputs (174 §8), so the self-test can hand it a tree that cannot exist.
 * A collector only ever asserted over the healthy population loses its filter invisibly.
 */
export function discoveryProblems(files, planes, exempt, walkFloor = PLANE_WALK_FLOOR, dispatchFloor = PLANE_DISPATCH_FLOOR) {
  const problems = [];
  const walked = new Set(files.map(([n]) => n));
  const shaped = files.filter(([, d]) => d).map(([n]) => n);
  const roster = new Set(planes);

  for (const n of shaped) {
    if (roster.has(n) || n in exempt) continue;
    problems.push(`BOUNDARY_DISCOVER UNDECLARED ${n} — it maps operation strings onto `
      + `params handlers, so it is a dispatcher this gate grades claims against, and it is `
      + `neither in PLANES nor a row in PLANE_EXEMPT. Nothing else in this file can see `
      + `that: every floor here is about the files already being read. Add it to PLANES, `
      + `or the row with a reason`);
  }
  for (const n of Object.keys(exempt).sort()) {
    if (!walked.has(n)) {
      problems.push(`BOUNDARY_DISCOVER STALE_EXEMPT ${n} — declared exempt, and the walk `
        + `cannot find it. An exclusion outliving its subject is one nobody re-argued (174 §5)`);
    } else if (roster.has(n)) {
      problems.push(`BOUNDARY_DISCOVER EXEMPT_IS_PLANE ${n} — it is graded as a plane AND `
        + `carries a reason for not being one. One of the two is wrong and this file cannot `
        + `decide which`);
    }
  }
  // 🔴 THE OTHER DIRECTION, because a walk's coverage of its own roster rots in whichever
  // direction nobody reads (232 §4, `floor_pin_gate.py`'s UNDISCOVERABLE).
  for (const n of planes) {
    if (!walked.has(n)) {
      problems.push(`BOUNDARY_DISCOVER MISSING_PLANE ${n} — PLANES names it and the walk `
        + `over the canonical addon cannot find it. The roster and the tree disagree, and `
        + `the gate reads the roster`);
    } else if (!shaped.includes(n)) {
      problems.push(`BOUNDARY_DISCOVER UNSHAPED_PLANE ${n} — graded as a dispatcher and the `
        + `walk does not recognise it as one. Either the file stopped dispatching, or `
        + `dispatcherShaped stopped reading its idiom; a name cannot separate those, and the `
        + `second makes every UNDECLARED above impossible to report`);
    }
  }
  // 🔴 THE OBSERVATION, NOT A CAUSE (228 §7.17). A count cannot tell a directory that lost
  // files from a walk that stopped reaching them.
  if (files.length < walkFloor) {
    problems.push(`BOUNDARY_DISCOVER WALK_FLOOR ${files.length} < ${walkFloor} — fewer .gd `
      + `files than the floor. The addon may have lost them or the walk may have stopped `
      + `reaching them; either way a discovery half over a population this small reports `
      + `nothing undeclared and passes`);
  }
  if (shaped.length < dispatchFloor) {
    problems.push(`BOUNDARY_DISCOVER DISPATCH_FLOOR ${shaped.length} < ${dispatchFloor} — `
      + `fewer dispatcher-shaped files than the floor, over ${files.length} file(s) read. `
      + `Planes may have merged, or dispatcherShaped may have stopped matching; the count `
      + `cannot separate those, and the file count above cannot see the second at all`);
  }
  return problems;
}

export function run(host = HOST, gdPaths = GD) {
  const { pop, offenders } = scan(host, gdPaths);
  const r = judge(pop, offenders);
  // 🔴 THE DISCOVERY HALF REPORTS INTO THE SAME VERDICT, not beside it. A line printed
  // next to a `failed` that never moves is 184's "a number an instrument prints and no
  // gate reads is an unasked question".
  const walked = planeWalk();
  const problems = discoveryProblems(walked, PLANES, PLANE_EXEMPT);
  // 🔴 SPLICED IN ABOVE THE VERDICT, not appended below it. A refusal printed under an
  // `ok —` line is a report that contradicts its own last sentence, and the last sentence
  // is what a CI log is read for.
  const verdict = r.lines.pop();
  r.lines.push(`BOUNDARY_GATE_DISCOVER ${walked.length} .gd walked · `
    + `${walked.filter(([, d]) => d).length} dispatcher-shaped · ${PLANES.length} plane(s) · `
    + `${Object.keys(PLANE_EXEMPT).length} exempt · ${problems.length} problem(s) `
    + `(floors ${PLANE_WALK_FLOOR}/${PLANE_DISPATCH_FLOOR})`);
  for (const m of problems) r.lines.push(`🔴 ${m}.`);
  r.failed = r.failed || problems.length > 0;
  r.lines.push(r.failed ? `\nBOUNDARY_GATE 🔴 FAILED` : verdict);
  return r;
}

export function report(r, log = console.log) {
  for (const l of r.lines) log(l);
  return r.failed ? 1 : 0;
}

export function main() {
  return report(run());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main());
